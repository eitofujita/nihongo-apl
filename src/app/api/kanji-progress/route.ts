import {z} from 'zod';
import {apiFailure, apiJson, ApiError, readJson, requireSameOrigin} from '@/lib/api-security';
import {requireAccount as authenticated} from '@/lib/api-auth';
import {kanjiList} from '@/content/kanji';
import {KANJI_MODES, kanjiStoreSchema} from '@/lib/kanji-progress';

// Kanji handwriting progress for the signed-in account. Guests keep progress in the browser.
const practiceKanji = new Set(kanjiList.map(kanji => kanji.char));
const attemptSchema = z.object({
  kanji: z.string().refine(value => practiceKanji.has(value)),
  mode: z.enum(KANJI_MODES as [string, ...string[]]),
  mistakes: z.number().int().min(0).max(1000)
}).strict();

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
