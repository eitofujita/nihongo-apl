// Handwriting practice progress, kept on this device only (not yet synced to the account).
import {useSyncExternalStore} from 'react';
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
const storeSchema = z.record(z.string().max(2), entrySchema);
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

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {if (event.key === KANJI_STORAGE_KEY) listener();};
  window.addEventListener('storage', onStorage);
  return () => {listeners.delete(listener); window.removeEventListener('storage', onStorage);};
}

const empty: KanjiStore = {};
export function useKanjiProgress(): KanjiStore {
  return useSyncExternalStore(subscribe, read, () => empty);
}

export function saveKanjiAttempt(char: string, mode: KanjiMode, mistakes: number): boolean {
  const next = recordAttempt(read(), char, mode, mistakes);
  try {window.localStorage.setItem(KANJI_STORAGE_KEY, JSON.stringify(next));} catch {return false;}
  listeners.forEach(listener => listener());
  return true;
}
