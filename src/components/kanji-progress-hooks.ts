'use client';

import {useCallback, useEffect, useSyncExternalStore} from 'react';
import {cloudKanjiSnapshot, emptyKanjiStore, ensureCloudKanji, readLocalKanji, saveCloudKanjiAttempt, saveLocalKanjiAttempt,
  subscribeKanji, type KanjiMode, type KanjiStore} from '@/lib/kanji-progress';
import {useProgress} from './progress-provider';

/** Kanji progress of the signed-in account, or of this browser for guests. */
export function useKanjiProgress(): KanjiStore {
  const {account} = useProgress();
  const user = account.user?.id ?? null;
  useEffect(() => {if (user) void ensureCloudKanji(user);}, [user]);
  return useSyncExternalStore(subscribeKanji, () => user ? cloudKanjiSnapshot(user) : readLocalKanji(), () => emptyKanjiStore);
}

/** Records a finished attempt in the right place; resolves to false when it could not be saved. */
export function useSaveKanjiAttempt(): (char: string, mode: KanjiMode, mistakes: number) => Promise<boolean> {
  const {account} = useProgress();
  const user = account.user?.id ?? null;
  return useCallback((char, mode, mistakes) => user
    ? saveCloudKanjiAttempt(user, char, mode, mistakes)
    : Promise.resolve(saveLocalKanjiAttempt(char, mode, mistakes)), [user]);
}

/** True when progress goes to the account rather than this browser. */
export function useKanjiSavedToAccount(): boolean {
  return Boolean(useProgress().account.user);
}
