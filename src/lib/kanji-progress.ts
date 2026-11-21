// Handwriting practice progress: in the browser for guests, in the account (via /api/kanji-progress)
// when signed in. React hooks that pick the right store live in components/kanji-progress-hooks.ts.
import {z} from 'zod';

export const KANJI_STORAGE_KEY = 'nihongo-ai:kanji:v1';
export type KanjiMode = 'trace' | 'guide' | 'recall';
export const KANJI_MODES: KanjiMode[] = ['trace', 'guide', 'recall'];

const entrySchema = z.object({
  // Highest mode completed with at most one mistake, or null if only attempted.
  passed: z.enum(['trace', 'guide', 'recall']).nullable(),
  attempts: z.number().int().min(0).max(100000),
  at: z.iso.datetime()
});
export const kanjiStoreSchema = z.record(z.string().max(2), entrySchema);
const storeSchema = kanjiStoreSchema;
export type KanjiEntry = z.infer<typeof entrySchema>;
export type KanjiStore = z.infer<typeof storeSchema>;

export function parseKanjiStore(raw: string | null): KanjiStore {
  if (!raw) return {};
  try {const parsed = storeSchema.safeParse(JSON.parse(raw)); return parsed.success ? parsed.data : {};} catch {return {};}
}

/** One mistake is forgiven: fingers slip on phones. */
export const PASS_MISTAKES = 1;

export function recordAttempt(store: KanjiStore, char: string, mode: KanjiMode, mistakes: number, at = new Date()): KanjiStore {
  const previous = store[char];
  const rank = (mode: KanjiMode | null) => mode ? KANJI_MODES.indexOf(mode) : -1;
  const passedNow = mistakes <= PASS_MISTAKES ? mode : null;
  const passed = rank(passedNow) > rank(previous?.passed ?? null) ? passedNow : previous?.passed ?? null;
  return {...store, [char]: {passed, attempts: (previous?.attempts ?? 0) + 1, at: at.toISOString()}};
}

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cached: KanjiStore = {};

function read(): KanjiStore {
  let raw: string | null = null;
  try {raw = window.localStorage.getItem(KANJI_STORAGE_KEY);} catch { /* Storage blocked: practice still works, just isn't remembered. */ }
  if (raw !== cachedRaw) {cachedRaw = raw; cached = parseKanjiStore(raw);}
  return cached;
}

export function subscribeKanji(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {if (event.key === KANJI_STORAGE_KEY) listener();};
  window.addEventListener('storage', onStorage);
  return () => {listeners.delete(listener); window.removeEventListener('storage', onStorage);};
}

export const emptyKanjiStore: KanjiStore = {};
export const readLocalKanji = read;

export function saveLocalKanjiAttempt(char: string, mode: KanjiMode, mistakes: number): boolean {
  const next = recordAttempt(read(), char, mode, mistakes);
  try {window.localStorage.setItem(KANJI_STORAGE_KEY, JSON.stringify(next));} catch {return false;}
  listeners.forEach(listener => listener());
  return true;
}

// ---------- Account store ----------
// One account at a time; switching account (or signing out) starts from an empty store.
let cloudUser: string | null = null;
let cloudStore: KanjiStore = {};
let cloudLoad: Promise<void> | null = null;
const notify = () => listeners.forEach(listener => listener());

export function cloudKanjiSnapshot(user: string): KanjiStore {return cloudUser === user ? cloudStore : emptyKanjiStore;}

async function request(user: string, init?: RequestInit): Promise<KanjiStore> {
  const response = await fetch('/api/kanji-progress', {cache: 'no-store', credentials: 'same-origin', ...init,
    headers: {'X-Nihongo-Account': user, ...(init?.body ? {'Content-Type': 'application/json'} : {})}, signal: AbortSignal.timeout(15000)});
  // A session that changed in another tab: the page reloads with the right account.
  if (response.status === 401 || response.status === 409) {window.location.reload(); throw new Error('Account changed');}
  if (!response.ok) throw new Error('Kanji progress unavailable');
  const body = await response.json() as {userId?: unknown; store?: unknown};
  const parsed = kanjiStoreSchema.safeParse(body.store);
  if (body.userId !== user || !parsed.success) throw new Error('Unexpected kanji progress response');
  return parsed.data;
}

/** Loads the account's progress once per account (again after a failed attempt). */
export function ensureCloudKanji(user: string): Promise<void> {
  if (cloudUser !== user) {cloudUser = user; cloudStore = {}; cloudLoad = null; notify();}
  cloudLoad ??= request(user).then(store => {if (cloudUser === user) {cloudStore = store; notify();}})
    .catch(() => {if (cloudUser === user) cloudLoad = null;});
  return cloudLoad;
}

/** Shows the attempt at once, then keeps whatever the server recorded. False when it was not saved. */
export async function saveCloudKanjiAttempt(user: string, char: string, mode: KanjiMode, mistakes: number): Promise<boolean> {
  if (cloudUser !== user) return false;
  cloudStore = recordAttempt(cloudStore, char, mode, mistakes);
  notify();
  try {
    const store = await request(user, {method: 'POST', body: JSON.stringify({kanji: char, mode, mistakes})});
    if (cloudUser === user) {cloudStore = store; notify();}
    return true;
  } catch {return false;}
}
