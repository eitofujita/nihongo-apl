import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {apiFailure, authLimiter, authRateKey, limitAuthRequest, limitProgressRequest, progressLimiter} from '@/lib/api-security';

const platform = vi.hoisted(() => ({context: vi.fn(), sensitive: vi.fn(), standard: vi.fn(), status: vi.fn(), progress: vi.fn()}));
vi.mock('@opennextjs/cloudflare', () => ({getCloudflareContext: platform.context}));
const bindings = () => ({
  NIHONGO_AUTH_SENSITIVE: {limit: platform.sensitive}, NIHONGO_AUTH_STANDARD: {limit: platform.standard},
  NIHONGO_AUTH_STATUS: {limit: platform.status}, NIHONGO_PROGRESS: {limit: platform.progress}
});
function request(ip = '192.0.2.1', extra: Record<string, string> = {}) {
  return new Request('https://learn.example.test/api/auth/login', {headers: {'cf-connecting-ip': ip, ...extra}});
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('NIHONGO_HOSTING', 'cloudflare');
  vi.stubEnv('VERCEL', '');
  platform.context.mockReturnValue({env: bindings()});
  for (const limiter of [platform.sensitive, platform.standard, platform.status, platform.progress]) limiter.mockResolvedValue({success: true});
});
afterEach(() => {vi.unstubAllEnvs(); vi.restoreAllMocks();});

describe('Cloudflare rate limits across Worker instances', () => {
  it('separates clients and actions using only the platform IP, without storing raw IPs', async () => {
    await limitAuthRequest(request(), 'login');
    await limitAuthRequest(request('192.0.2.2'), 'login');
    const first = platform.standard.mock.calls[0][0].key as string;
    const second = platform.standard.mock.calls[1][0].key as string;
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toBe(second);
    expect(authRateKey(request('192.0.2.1', {'x-forwarded-for': '192.0.2.99', 'x-vercel-forwarded-for': '192.0.2.99'}), 'login')).toBe(first);
    expect(authRateKey(request(), 'logout')).not.toBe(first);
    expect(authRateKey(request('2001:db8::1'), 'login')).toMatch(/^[a-f0-9]{64}$/);
  });
  it('uses the sensitive, normal and status platform limits, rather than a per-process map', async () => {
    const local = vi.spyOn(authLimiter, 'consume');
    await limitAuthRequest(request(), 'register');
    await limitAuthRequest(request(), 'recover');
    await limitAuthRequest(request(), 'login');
    await limitAuthRequest(request(), 'status');
    expect(platform.sensitive).toHaveBeenCalledTimes(2);
    expect(platform.standard).toHaveBeenCalledTimes(1);
    expect(platform.status).toHaveBeenCalledTimes(1);
    expect(local).not.toHaveBeenCalled();
  });
  it('keeps progress limits per verified account even when IPs are shared', async () => {
    const local = vi.spyOn(progressLimiter, 'consume');
    await limitProgressRequest('account-a');
    await limitProgressRequest('account-b');
    await limitProgressRequest('account-a');
    expect(platform.progress.mock.calls[0][0]).toEqual(platform.progress.mock.calls[2][0]);
    expect(platform.progress.mock.calls[0][0]).not.toEqual(platform.progress.mock.calls[1][0]);
    expect(platform.progress.mock.calls[0][0].key).toMatch(/^[a-f0-9]{64}$/);
    expect(local).not.toHaveBeenCalled();
  });
  it('returns a safe 429 when the platform rejects a request', async () => {
    platform.standard.mockResolvedValue({success: false});
    const response = await limitAuthRequest(request(), 'login').catch(apiFailure);
    expect(response).toBeInstanceOf(Response);
    if (!(response instanceof Response)) throw new Error('Expected a rejection response.');
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
    expect(await response.json()).toEqual({error: 'rate_limit', retryAfterSeconds: 60});
  });
  it('fails closed on missing or malformed platform IPs and missing bindings', async () => {
    for (const ip of ['', 'invalid', '192.0.2.1, 192.0.2.2']) {
      await expect(limitAuthRequest(request(ip), 'login')).rejects.toMatchObject({status: 503});
    }
    platform.context.mockReturnValue({env: {}});
    await expect(limitAuthRequest(request(), 'login')).rejects.toMatchObject({status: 503});
    await expect(limitProgressRequest('account-a')).rejects.toMatchObject({status: 503});
  });
  it('never bypasses a failed platform binding with the local fallback', async () => {
    const local = vi.spyOn(authLimiter, 'consume');
    platform.standard.mockRejectedValue(new Error('Platform unavailable'));
    await expect(limitAuthRequest(request(), 'login')).rejects.toThrow('Platform unavailable');
    expect(local).not.toHaveBeenCalled();
  });
  it('preserves the bounded local limiter when running next dev outside Cloudflare', async () => {
    vi.stubEnv('NIHONGO_HOSTING', '');
    const local = vi.spyOn(authLimiter, 'consume').mockReturnValue(undefined);
    await limitAuthRequest(request(), 'recover');
    expect(local).toHaveBeenCalledWith(expect.any(String), 3, 60000);
    expect(platform.context).not.toHaveBeenCalled();
    // The ordinary dev server does not trust a spoofed Cloudflare header.
    expect(authRateKey(request('192.0.2.1'), 'login')).toBe(authRateKey(request('192.0.2.2'), 'login'));
  });
});
