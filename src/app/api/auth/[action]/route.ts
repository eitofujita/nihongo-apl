import {apiFailure, apiJson, ApiError, authLimiter, authRateKey, readJson, requireSameOrigin} from '@/lib/api-security';
import {loginSchema, newPasswordSchema, recoverySchema, registerSchema} from '@/lib/auth-schemas';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {getAppUrl} from '@/lib/config';

const actions = ['login', 'register', 'logout', 'recover', 'password'] as const;
type Props = {params: Promise<{action: string}>};
function providerFailure(error: {status?: number; code?: string}, status: number, code: string) {
  if (error.status === 429) {
    const emailLimit = error.code === 'over_email_send_rate_limit';
    // No email addresses, provider messages, credentials or request bodies.
    console.warn(emailLimit ? '[auth] Provider email sending rate limit.' : '[auth] Provider request rate limit.');
    // The SDK does not expose the provider's reset time; do not invent one.
    return new ApiError(429, emailLimit ? 'email_rate_limit' : 'auth_provider_rate_limit');
  }
  return new ApiError(status, code);
}
export async function GET(request: Request, {params}: Props) {
  try {
    if ((await params).action !== 'status') throw new ApiError(404, 'not_found');
    authLimiter.consume(authRateKey(request, 'status'), 60, 60000);
    const client = await createSupabaseServerClient();
    if (!client) throw new ApiError(503, 'not_configured');
    const {data, error} = await client.auth.getUser();
    if (error && (!error.status || error.status >= 500 || error.status === 429)) throw new ApiError(503, 'unavailable');
    return apiJson({authenticated: !error && Boolean(data.user)});
  } catch (error) {return apiFailure(error);}
}
export async function POST(request: Request, {params}: Props) {
  try {
    requireSameOrigin(request);
    const {action} = await params;
    if (!actions.some(value => value === action)) throw new ApiError(404, 'not_found');
    authLimiter.consume(authRateKey(request, action), action === 'register' || action === 'recover' ? 3 : 15, 60000);
    const client = await createSupabaseServerClient();
    if (!client) throw new ApiError(503, 'not_configured');
    if (action === 'logout') {
      const {error} = await client.auth.signOut({scope: 'local'});
      if (error) throw new ApiError(503, 'unavailable');
      return apiJson({ok: true});
    }
    const body = await readJson(request);
    if (action === 'recover') {
      const input = recoverySchema.safeParse(body);
      if (!input.success) throw new ApiError(400, 'invalid_input');
      const {error} = await client.auth.resetPasswordForEmail(input.data.email, {
        redirectTo: new URL(`/auth/callback?locale=${input.data.locale}&recovery=1`, getAppUrl()).href
      });
      if (error) throw providerFailure(error, 503, 'unavailable');
      return apiJson({ok: true, confirmation: true});
    }
    if (action === 'password') {
      const input = newPasswordSchema.safeParse(body);
      if (!input.success) throw new ApiError(400, 'invalid_input');
      const {data, error: authError} = await client.auth.getUser();
      if (authError || !data.user) throw new ApiError(401, 'unauthorized');
      const {error} = await client.auth.updateUser({password: input.data.password});
      if (error) throw new ApiError(400, 'password_failed');
      return apiJson({ok: true});
    }
    const parsed = (action === 'register' ? registerSchema : loginSchema).safeParse(body);
    if (!parsed.success) throw new ApiError(400, 'invalid_input');
    const {email, password, locale} = parsed.data;
    if (action === 'register') {
      const {data, error} = await client.auth.signUp({email, password, options: {
        emailRedirectTo: new URL(`/auth/callback?locale=${locale}`, getAppUrl()).href
      }});
      if (error) throw providerFailure(error, 400, 'registration_failed');
      return apiJson({ok: true, confirmation: !data.session});
    }
    const {error} = await client.auth.signInWithPassword({email, password});
    if (error) throw providerFailure(error, 400, error.code === 'email_not_confirmed' ? 'email_not_confirmed' : 'credentials');
    return apiJson({ok: true});
  } catch (error) {return apiFailure(error);}
}
