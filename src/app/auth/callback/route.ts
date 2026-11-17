import {NextResponse} from 'next/server';
import {callbackLocale, pkceFlowIdSchema} from '@/lib/auth-schemas';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {getAppUrl} from '@/lib/config';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = callbackLocale(url.searchParams.get('locale'));
  const code = url.searchParams.get('code');
  const flowId = url.searchParams.get('sb_flow_id');
  const validFlow = flowId === null || pkceFlowIdSchema.safeParse(flowId).success;
  const client = await createSupabaseServerClient();
  let path = `/${locale}/login?error=confirmation`;
  if (client && code && code.length <= 2048 && validFlow) {
    try {
      const {error} = flowId === null
        ? await client.auth.exchangeCodeForSession(code)
        : await client.auth.exchangeCodeForSession(code, {flowId});
      if (!error) path = url.searchParams.get('recovery') === '1' ? `/${locale}/reset-password` : `/${locale}`;
    } catch { /* No user-controlled return URL is accepted. */ }
  }
  const response = NextResponse.redirect(new URL(path, getAppUrl()));
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
