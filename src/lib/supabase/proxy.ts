import {createServerClient} from '@supabase/ssr';
import {NextResponse, type NextRequest} from 'next/server';
import {getSupabaseConfig} from './config';
import type {Database} from './database.types';
import {getAppUrl} from '@/lib/config';

export async function refreshAuth(request: NextRequest) {
  const config = getSupabaseConfig();
  let response = NextResponse.next({request});
  if (!config) return response;
  const client = createServerClient<Database>(config.url, config.key, {
    cookieOptions: {httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' || getAppUrl().protocol === 'https:', path: '/'},
    global: {fetch: (input, init) => fetch(input, {...init, cache: 'no-store', signal: AbortSignal.timeout(10000)})},
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values, headers) {
        values.forEach(({name, value}) => request.cookies.set(name, value));
        const previous = response;
        response = NextResponse.next({request});
        previous.cookies.getAll().forEach(cookie => response.cookies.set(cookie));
        for (const header of ['cache-control', 'expires', 'pragma']) {
          const value = previous.headers.get(header);
          if (value) response.headers.set(header, value);
        }
        values.forEach(({name, value, options}) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      }
    }
  });
  try {await client.auth.getClaims();}
  catch { /* Protected routes validate the user again and fail closed. */ }
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return response;
}
