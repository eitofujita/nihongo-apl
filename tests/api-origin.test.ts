import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {requireSameOrigin} from '@/lib/api-security';

function mutation(origin?: string, headers: Record<string, string> = {}, url = 'http://0.0.0.0:3000/api/auth/register') {
  return new Request(url, {method: 'POST', headers: {...(origin === undefined ? {} : {origin}), ...headers}});
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
  vi.stubEnv('NODE_ENV', 'development');
});
afterEach(() => vi.unstubAllEnvs());

describe('Public origin validation behind an internal Next server address', () => {
  it('accepts the configured browser origin when the request URL is the bind address', () => {
    expect(() => requireSameOrigin(mutation('http://localhost:3000'))).not.toThrow();
  });
  it('permits loopback aliases only on the configured development port and protocol', () => {
    for (const host of ['127.0.0.1', '[::1]']) {
      expect(() => requireSameOrigin(mutation(`http://${host}:3000`))).not.toThrow();
    }
    for (const origin of ['http://localhost:3001', 'https://localhost:3000', 'http://0.0.0.0:3000']) {
      expect(() => requireSameOrigin(mutation(origin))).toThrow(expect.objectContaining({status: 403, code: 'origin'}));
    }
  });
  it('rejects missing, null, malformed and foreign origins', () => {
    for (const origin of [undefined, 'null', 'not-a-url', 'https://attacker.test', 'http://localhost:3000.attacker.test']) {
      expect(() => requireSameOrigin(mutation(origin))).toThrow(expect.objectContaining({status: 403}));
    }
  });
  it('rejects cross-site fetches even when the origin header matches', () => {
    expect(() => requireSameOrigin(mutation('http://localhost:3000', {'sec-fetch-site': 'cross-site'}))).toThrow();
  });
  it('does not trust attacker-controlled Host, forwarded headers or request URLs', () => {
    expect(() => requireSameOrigin(mutation('https://attacker.test', {
      host: 'attacker.test', 'x-forwarded-host': 'attacker.test', 'x-forwarded-proto': 'https'
    }, 'https://attacker.test/api/auth/register'))).toThrow();
  });
  it('uses only the exact configured origin in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://learn.example.test');
    expect(() => requireSameOrigin(mutation('https://learn.example.test'))).not.toThrow();
    for (const origin of ['http://learn.example.test', 'https://other.example.test', 'http://localhost:3000']) {
      expect(() => requireSameOrigin(mutation(origin))).toThrow();
    }
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
    expect(() => requireSameOrigin(mutation('http://127.0.0.1:3000'))).toThrow();
  });
});
