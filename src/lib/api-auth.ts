import 'server-only';
import {ApiError, limitProgressRequest} from './api-security';
import {createSupabaseServerClient} from './supabase/server';

/**
 * Resolves the signed-in user for an account API (progress, kanji progress) and applies the per-user
 * rate limit. The X-Nihongo-Account header is a concurrency precondition, never an authorization
 * source: it stops a request queued under account A from being written after the tab signs into B.
 */
export async function requireAccount(request?: Request) {
  const client = await createSupabaseServerClient();
  if (!client) throw new ApiError(503, 'not_configured');
  const {data, error} = await client.auth.getUser();
  if (error || !data.user) throw new ApiError(401, 'unauthorized');
  const expected = request?.headers.get('x-nihongo-account');
  if (expected && expected !== data.user.id) throw new ApiError(409, 'account_changed');
  await limitProgressRequest(data.user.id);
  return {client, userId: data.user.id};
}
