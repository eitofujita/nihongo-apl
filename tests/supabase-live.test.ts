import {loadEnvFile} from 'node:process';
import {beforeAll, describe, expect, it} from 'vitest';
import {getSupabaseConfig} from '@/lib/supabase/config';
import {getAppUrl} from '@/lib/config';
import {z} from 'zod';

// Explicit opt-in: regular unit tests never contact the hosted project.
// These checks do not create accounts, send email or modify learning data.
const enabled = process.env.NIHONGO_LIVE_TESTS === '1';
if (enabled) {
  try {loadEnvFile('.env.local');}
  catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw new Error('Could not load the local environment.');
  }
}
const config = enabled ? getSupabaseConfig() : null;
const app = getAppUrl();
const failure = z.object({code: z.string().optional(), error: z.string().optional()});

async function call(path: string, hosted = false, options: RequestInit = {}) {
  if (hosted && !config) throw new Error('Supabase public connection settings are missing or invalid.');
  const headers = new Headers(options.headers);
  if (hosted && config) headers.set('apikey', config.key);
  let response: Response;
  try {
    response = await fetch(new URL(path, hosted ? config!.url : app), {
      ...options, headers, redirect: 'manual', signal: AbortSignal.timeout(15000), cache: 'no-store'
    });
  } catch {
    // Never include request headers, cookies or credentials in failure output.
    throw new Error(`${hosted ? 'Supabase' : 'Local application'} did not respond to the connection check.`);
  }
  return response;
}
async function errorCode(response: Response) {
  const data: unknown = await response.json();
  const parsed = failure.safeParse(data);
  return parsed.success ? parsed.data.code ?? parsed.data.error : undefined;
}

describe.skipIf(!enabled)('Hosted Supabase and local application — non-mutating smoke checks', () => {
  beforeAll(() => {if (!config) throw new Error('Set the Supabase URL and publishable key in .env.local before running live checks.');});

  it('has email sign-up enabled and requires email confirmation', async () => {
    const response = await call('/auth/v1/settings', true);
    expect(response.status).toBe(200);
    const data: unknown = await response.json();
    const settings = z.object({external: z.object({email: z.boolean()}), disable_signup: z.boolean(), mailer_autoconfirm: z.boolean()}).safeParse(data);
    expect(settings.success).toBe(true);
    if (!settings.success) return;
    expect(settings.data.external.email).toBe(true);
    expect(settings.data.disable_signup).toBe(false);
    expect(settings.data.mailer_autoconfirm).toBe(false);
  });

  for (const table of ['profiles', 'practice_sessions', 'practice_answers', 'review_cards', 'entitlements']) {
    it(`rejects anonymous reads of the existing ${table} table`, async () => {
      const response = await call(`/rest/v1/${table}?select=user_id&limit=0`, true);
      expect([401, 403]).toContain(response.status);
      expect(await errorCode(response)).toBe('42501');
    });
  }

  it('rejects anonymous calls of the existing progress function', async () => {
    const response = await call('/rest/v1/rpc/get_learning_progress', true, {
      method: 'POST', headers: {'content-type': 'application/json'}, body: '{}'
    });
    expect([401, 403]).toContain(response.status);
    expect(await errorCode(response)).toBe('42501');
  });

  it('reports no authenticated session when the browser has no cookies', async () => {
    const response = await call('/api/auth/status');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    const parsed = z.object({authenticated: z.boolean()}).strict().safeParse(await response.json());
    expect(parsed.success && !parsed.data.authenticated).toBe(true);
  });

  it('does not expose progress without a verified session', async () => {
    const response = await call('/api/progress');
    expect(response.status).toBe(401);
    expect(await errorCode(response)).toBe('unauthorized');
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  for (const path of ['/api/auth/login', '/api/auth/register', '/api/auth/logout', '/api/progress']) {
    it(`rejects cross-origin requests to ${path}`, async () => {
      const response = await call(path, false, {method: 'POST', headers: {
        origin: 'https://untrusted.example.test', 'content-type': 'application/json'
      }, body: '{}'});
      expect(response.status).toBe(403);
      expect(await errorCode(response)).toBe('origin');
    });
  }

  it('accepts the configured origin and rejects empty registration input before any email is sent', async () => {
    const response = await call('/api/auth/register', false, {method: 'POST', headers: {
      origin: app.origin, 'content-type': 'application/json'
    }, body: '{}'});
    expect(response.status).toBe(400);
    expect(await errorCode(response)).toBe('invalid_input');
  });

  for (const path of ['/auth/callback', '/auth/confirm']) {
    it(`returns invalid ${path} links to the public app without forwarding confirmation URLs`, async () => {
      const response = await call(`${path}?locale=ru&next=https://untrusted.example.test`);
      expect([302, 303, 307, 308]).toContain(response.status);
      expect(response.headers.get('location')).toBe(new URL('/ru/login?error=confirmation', app).href);
      expect(response.headers.get('cache-control')).toContain('no-store');
      expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    });
  }
});
