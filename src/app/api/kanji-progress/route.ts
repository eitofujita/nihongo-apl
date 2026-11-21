import {z} from 'zod';
import {apiFailure, apiJson, ApiError, limitProgressRequest, readJson, requireSameOrigin} from '@/lib/api-security';
import {kanjiList} from '@/content/kanji';
import {KANJI_MODES, kanjiStoreSchema} from '@/lib/kanji-progress';
import {createSupabaseServerClient} from '@/lib/supabase/server';

// Kanji handwriting progress for the signed-in account. Guests keep progress in the browser.
const practiceKanji = new Set(kanjiList.map(kanji => kanji.char));
const attemptSchema = z.object({
  kanji: z.string().refine(value => practiceKanji.has(value)),
  mode: z.enum(KANJI_MODES as [string, ...string[]]),
  mistakes: z.number().int().min(0).max(1000)
}).strict();

async function authenticated(request: Request) {
  const client = await createSupabaseServerClient();
  if (!client) throw new ApiError(503, 'not_configured');
  const {data, error} = await client.auth.getUser();
  if (error || !data.user) throw new ApiError(401, 'unauthorized');
  // Concurrency precondition only (see /api/progress): a queued request never writes into another account.
  const expected = request.headers.get('x-nihongo-account');
  if (expected && expected !== data.user.id) throw new ApiError(409, 'account_changed');
  await limitProgressRequest(data.user.id);
  return {client, userId: data.user.id};
}
function parseStore(data: unknown) {
  const parsed = kanjiStoreSchema.safeParse(data);
  if (!parsed.success) throw new ApiError(503, 'storage_unavailable');
  return parsed.data;
}

export async function GET(request: Request) {
  try {
    const {client, userId} = await authenticated(request);
    const {data, error} = await client.rpc('get_kanji_progress', {});
    if (error) throw new ApiError(503, 'storage_unavailable');
    return apiJson({userId, store: parseStore(data)});
  } catch (error) {return apiFailure(error);}
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const {client, userId} = await authenticated(request);
    const input = attemptSchema.safeParse(await readJson(request, 1024));
    if (!input.success) throw new ApiError(400, 'invalid_input');
    const {data, error} = await client.rpc('record_kanji_attempt', {p_kanji: input.data.kanji, p_mode: input.data.mode, p_mistakes: input.data.mistakes});
    if (error) throw new ApiError(error.code === '22023' ? 400 : error.code === 'P0001' ? 429 : 503, error.code === 'P0001' ? 'rate_limit' : 'storage_unavailable');
    return apiJson({userId, store: parseStore(data)});
  } catch (error) {return apiFailure(error);}
}
