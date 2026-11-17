import 'server-only';
import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {getSupabaseConfig} from './config';
import type {Database} from './database.types';
import {getAppUrl} from '@/lib/config';

export async function createSupabaseServerClient() {
  const config = getSupabaseConfig();
  if (!config) return null;
  const store = await cookies();
  return createServerClient<Database>(config.url, config.key, {
    // Correlate each email with its own PKCE verifier, including across resends.
    auth: {experimental: {appendPkceFlowIdToRedirects: true}},
    cookieOptions: {httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' || getAppUrl().protocol === 'https:', path: '/'},
    global: {fetch: (input, init) => fetch(input, {...init, cache: 'no-store', signal: AbortSignal.timeout(10000)})},
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try {values.forEach(({name, value, options}) => store.set(name, value, options));}
        catch { /* Server Components cannot write cookies; proxy handles refresh. */ }
      }
    }
  });
}
export type AuthClient = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
