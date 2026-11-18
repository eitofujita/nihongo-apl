import {apiFailure, apiJson, ApiError, limitProgressRequest, readJson, requireSameOrigin} from '@/lib/api-security';
import {preferencesSchema, submissionSchema} from '@/lib/auth-schemas';
import {loadCloudProgress} from '@/lib/cloud-progress';
import {progressSchema} from '@/lib/progress';
import {createSupabaseServerClient} from '@/lib/supabase/server';

async function authenticated(request?: Request) {
  const client = await createSupabaseServerClient();
  if (!client) throw new ApiError(503, 'not_configured');
  const {data, error} = await client.auth.getUser();
  if (error || !data.user) throw new ApiError(401, 'unauthorized');
  // This is a concurrency precondition, never an authorization source.
  // It stops a queued request from account A being written after a tab signs into B.
  const expected = request?.headers.get('x-nihongo-account');
  if (expected && expected !== data.user.id) throw new ApiError(409, 'account_changed');
  await limitProgressRequest(data.user.id);
  return {client, userId: data.user.id};
}
export async function GET(request: Request) {
  try {
    const {client, userId} = await authenticated(request);
    return apiJson({userId, progress: await loadCloudProgress(client)});
  } catch (error) {return apiFailure(error);}
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const {client, userId} = await authenticated(request);
    const input = submissionSchema.safeParse(await readJson(request));
    if (!input.success) throw new ApiError(400, 'invalid_input');
    const {id, lessonId, durationSeconds, answers} = input.data;
    const {data, error} = await client.rpc('submit_practice', {p_session_id: id, p_lesson_id: lessonId, p_duration_seconds: durationSeconds, p_answers: answers});
    if (error) throw new ApiError(error.code === '22023' ? 400 : error.code === 'P0001' ? 429 : 503, error.code === 'P0001' ? 'rate_limit' : 'storage_unavailable');
    const parsed = progressSchema.safeParse(data);
    if (!parsed.success) throw new ApiError(503, 'storage_unavailable');
    return apiJson({userId, progress: parsed.data});
  } catch (error) {return apiFailure(error);}
}
export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const {client, userId} = await authenticated(request);
    const input = preferencesSchema.safeParse(await readJson(request));
    if (!input.success) throw new ApiError(400, 'invalid_input');
    const {error} = await client.from('profiles').update({
      ...(input.data.locale !== undefined ? {display_locale: input.data.locale} : {}),
      ...(input.data.dailyGoal !== undefined ? {daily_goal_minutes: input.data.dailyGoal} : {})
    }).eq('user_id', userId).select('user_id').single();
    if (error) throw new ApiError(503, 'storage_unavailable');
    return apiJson({userId, progress: await loadCloudProgress(client)});
  } catch (error) {return apiFailure(error);}
}
export async function DELETE(request: Request) {
  try {
    requireSameOrigin(request);
    const {client, userId} = await authenticated(request);
    const {data, error} = await client.rpc('reset_learning_progress', {});
    const parsed = progressSchema.safeParse(data);
    if (error || !parsed.success) throw new ApiError(503, 'storage_unavailable');
    return apiJson({userId, progress: parsed.data});
  } catch (error) {return apiFailure(error);}
}
