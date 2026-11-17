import {NextResponse} from 'next/server';
import {callbackLocale} from '@/lib/auth-schemas';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {getAppUrl} from '@/lib/config';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = callbackLocale(url.searchParams.get('locale'));
  const token = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const client = await createSupabaseServerClient();
  let path = `/${locale}/login?error=confirmation`;
  if (client && token && token.length <= 256 && (type === 'email' || type === 'recovery')) {
    try {
      const {error} = await client.auth.verifyOtp({token_hash: token, type});
      if (!error) path = type === 'recovery' ? `/${locale}/reset-password` : `/${locale}`;
    } catch { /* Invalid or expired tokens return the same safe error page. */ }
  }
  const response = NextResponse.redirect(new URL(path, getAppUrl()));
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
