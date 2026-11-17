import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {CookieOptions} from '@supabase/ssr';

const cookieStore = vi.hoisted(() => vi.fn());
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({cookies: cookieStore}));
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {GET as callback} from '@/app/auth/callback/route';
import {POST as authPost} from '@/app/api/auth/[action]/route';

const ID = '00000000-0000-4000-8000-000000000001';
const user = {id: ID, email: 'student@example.test', aud: 'authenticated', role: 'authenticated', created_at: '2026-11-17T00:00:00Z', app_metadata: {}, user_metadata: {}};
function transportToken() {
  // Deliberately not a real authentication token. The Auth HTTP boundary is
  // stubbed; these tests exercise the actual SDK's cookie/session transport.
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({alg: 'HS256', typ: 'JWT'})}.${encode({sub: ID, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600})}.test-signature`;
}
const jar = new Map<string, {value: string; options: CookieOptions}>();
const network = vi.fn<typeof fetch>();

beforeEach(() => {
  jar.clear(); network.mockReset();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_transport_test');
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
  cookieStore.mockResolvedValue({
    getAll: () => [...jar.entries()].map(([name, entry]) => ({name, value: entry.value})),
    set(name: string, value: string, options: CookieOptions) {
      if (options.maxAge === 0 || value === '') jar.delete(name);
      else jar.set(name, {value, options});
    }
  });
  vi.stubGlobal('fetch', network);
});
afterEach(() => {vi.unstubAllGlobals(); vi.unstubAllEnvs();});

describe('Official Supabase SDK with a stubbed Auth HTTP service', () => {
  it('keeps a successful recovery email usable when a later resend is rate limited', async () => {
    const token = transportToken();
    let recoveryUrl = '';
    let requests = 0;
    let challenge = '';
    let passwordUpdated = false;
    network.mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/recover')) {
        requests++;
        if (requests === 1) {
          recoveryUrl = url.searchParams.get('redirect_to') ?? '';
          const body = JSON.parse(String(init?.body)) as {code_challenge: string; code_challenge_method: string};
          challenge = body.code_challenge;
          expect(body.code_challenge_method).toBe('s256');
          return Response.json({});
        }
        return Response.json({code: 'over_email_send_rate_limit', message: 'Rate limited'}, {status: 429});
      }
      if (url.searchParams.get('grant_type') === 'pkce') {
        const body = JSON.parse(String(init?.body)) as {auth_code: string; code_verifier: string};
        const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body.code_verifier));
        expect(Buffer.from(hash).toString('base64url')).toBe(challenge);
        expect(body.auth_code).toBe('test-recovery-code');
        return Response.json({access_token: token, token_type: 'bearer', expires_in: 3600, refresh_token: 'test-refresh-token', user});
      }
      if (url.pathname.endsWith('/user')) {
        expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${token}`);
        if (init?.method === 'PUT') {
          expect(JSON.parse(String(init.body))).toMatchObject({password: 'new-test-password-only'});
          passwordUpdated = true;
        }
        return Response.json(user);
      }
      throw new Error('Unexpected stubbed request');
    });
    const client = (await createSupabaseServerClient())!;
    expect((await client.auth.resetPasswordForEmail(user.email, {redirectTo: 'http://localhost:3000/auth/callback?locale=ru&recovery=1'})).error).toBeNull();
    expect((await client.auth.resetPasswordForEmail(user.email, {redirectTo: 'http://localhost:3000/auth/callback?locale=ru&recovery=1'})).error?.status).toBe(429);
    const link = new URL(recoveryUrl); link.searchParams.set('code', 'test-recovery-code');
    const response = await callback(new Request(link));
    expect(response.headers.get('location')).toBe('http://localhost:3000/ru/reset-password');
    expect((await (await createSupabaseServerClient())!.auth.getUser()).data.user?.id).toBe(ID);
    const updated = await authPost(new Request('http://localhost:3000/api/auth/password', {
      method: 'POST', headers: {origin: 'http://localhost:3000', 'content-type': 'application/json'},
      body: JSON.stringify({password: 'new-test-password-only'})
    }), {params: Promise.resolve({action: 'password'})});
    expect(updated.status).toBe(200); expect(passwordUpdated).toBe(true);
  });
  it('does not exchange a recovery code for an unknown flow or a browser without its verifier', async () => {
    let destination = '';
    network.mockImplementation(async input => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/recover')) {
        destination = url.searchParams.get('redirect_to') ?? '';
        return Response.json({});
      }
      throw new Error('No token exchange should be attempted without the matching verifier');
    });
    const client = (await createSupabaseServerClient())!;
    await client.auth.resetPasswordForEmail(user.email, {redirectTo: 'http://localhost:3000/auth/callback?locale=en&recovery=1'});
    const link = new URL(destination);
    expect(link.searchParams.get('sb_flow_id')).toMatch(/^[a-zA-Z0-9_-]{8,64}$/);
    link.searchParams.set('code', 'test-recovery-code');
    const wrongFlow = new URL(link); wrongFlow.searchParams.set('sb_flow_id', 'unknown-flow-id');
    expect((await callback(new Request(wrongFlow))).headers.get('location')).toBe('http://localhost:3000/en/login?error=confirmation');
    jar.clear();
    expect((await callback(new Request(link))).headers.get('location')).toBe('http://localhost:3000/en/login?error=confirmation');
    expect(network).toHaveBeenCalledOnce();
  });
  it('writes HttpOnly cookies, revalidates the next request, and clears them on logout', async () => {
    const token = transportToken();
    network.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/token?grant_type=password')) return Response.json({access_token: token, token_type: 'bearer', expires_in: 3600, refresh_token: 'test-refresh-token', user});
      if (url.includes('/user')) {
        expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${token}`);
        return Response.json(user);
      }
      if (url.includes('/logout')) return Response.json({});
      throw new Error('Unexpected Auth transport request');
    });
    const client = await createSupabaseServerClient();
    expect((await client!.auth.signInWithPassword({email: user.email, password: 'test-password-only'})).error).toBeNull();
    expect(jar.size).toBeGreaterThan(0);
    for (const entry of jar.values()) {expect(entry.options.httpOnly).toBe(true); expect(entry.options.sameSite).toBe('lax');}
    const nextRequest = await createSupabaseServerClient();
    expect((await nextRequest!.auth.getUser()).data.user?.id).toBe(ID);
    expect(network.mock.calls.some(([input]) => String(input).includes('/user'))).toBe(true);
    expect((await nextRequest!.auth.signOut({scope: 'local'})).error).toBeNull();
    expect(jar.size).toBe(0);
  });
  it('does not authorize a cookie when the Auth service rejects it', async () => {
    const token = transportToken();
    network.mockImplementation(async input => String(input).includes('/token?grant_type=password')
      ? Response.json({access_token: token, token_type: 'bearer', expires_in: 3600, refresh_token: 'test-refresh-token', user})
      : Response.json({code: 'session_not_found', message: 'Invalid session'}, {status: 401}));
    const client = await createSupabaseServerClient();
    await client!.auth.signInWithPassword({email: user.email, password: 'test-password-only'});
    const nextRequest = await createSupabaseServerClient();
    const result = await nextRequest!.auth.getUser();
    expect(result.data.user).toBeNull();
    expect(result.error).not.toBeNull();
  });
});
