import createMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';
import type {NextRequest} from 'next/server';
import {refreshAuth} from './lib/supabase/proxy';

const localize = createMiddleware(routing);
export default async function middleware(request: NextRequest) {
  const authResponse = await refreshAuth(request);
  if (request.nextUrl.pathname.startsWith('/api/') || request.nextUrl.pathname.startsWith('/auth/')) return authResponse;
  const response = localize(request);
  authResponse.cookies.getAll().forEach(cookie => response.cookies.set(cookie));
  for (const header of ['cache-control', 'expires', 'pragma']) {
    const value = authResponse.headers.get(header);
    if (value) response.headers.set(header, value);
  }
  return response;
}
export const config = {matcher: ['/((?!_next|_vercel|.*\\..*).*)']};
