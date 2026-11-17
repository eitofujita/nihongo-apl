import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NextRequest} from 'next/server';

const sdk = vi.hoisted(() => ({create: vi.fn(), config: vi.fn()}));
vi.mock('@supabase/ssr', () => ({createServerClient: sdk.create}));
vi.mock('@/lib/supabase/config', () => ({getSupabaseConfig: sdk.config}));
import {refreshAuth} from '@/lib/supabase/proxy';

type Options = {cookieOptions: {httpOnly: boolean; sameSite: string}; cookies: {
  getAll: () => {name: string; value: string}[];
  setAll: (values: {name: string; value: string; options: {httpOnly: boolean; path: string; sameSite: 'lax'}}[], headers: Record<string, string>) => void
}};
beforeEach(() => {vi.clearAllMocks(); sdk.config.mockReturnValue({url: 'https://example.supabase.co', key: 'sb_publishable_test'});});

describe('Server cookie refresh and cache boundaries', () => {
  it('forwards refreshed cookies to both the server request and browser response', async () => {
    sdk.create.mockImplementation((_url: string, _key: string, options: Options) => ({auth: {getClaims: async () => {
      expect(options.cookieOptions.httpOnly).toBe(true);
      expect(options.cookies.getAll()).toEqual([{name: 'sb-test-auth-token', value: 'old-token'}]);
      options.cookies.setAll([{name: 'sb-test-auth-token', value: 'new-token', options: {httpOnly: true, path: '/', sameSite: 'lax'}}], {'Cache-Control': 'private, no-store', Expires: '0', Pragma: 'no-cache'});
      return {data: {claims: {sub: 'verified-user'}}};
    }}}));
    const request = new NextRequest('http://localhost:3000/api/progress', {headers: {cookie: 'sb-test-auth-token=old-token'}});
    const response = await refreshAuth(request);
    expect(request.cookies.get('sb-test-auth-token')?.value).toBe('new-token');
    expect(response.cookies.get('sb-test-auth-token')?.value).toBe('new-token');
    expect(response.headers.get('x-middleware-request-cookie')).toContain('new-token');
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('pragma')).toBe('no-cache');
  });
  it('does not initialize a client when the service is unconfigured', async () => {
    sdk.config.mockReturnValue(null);
    await refreshAuth(new NextRequest('http://localhost:3000/en'));
    expect(sdk.create).not.toHaveBeenCalled();
  });
});
