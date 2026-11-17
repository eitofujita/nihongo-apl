'use client';

import {createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode} from 'react';
import {z} from 'zod';
import {addSession, initialProgress, parseProgress, progressSchema, STORAGE_KEY, type Progress, type Session} from '@/lib/progress';
import type {AccountState} from '@/lib/auth-state';
import type {SubmittedAnswer} from '@/lib/auth-schemas';

export const AUTH_EVENT_KEY = 'nihongo-ai:auth-changed';
const cloudResponse = z.object({userId: z.uuid(), progress: progressSchema});
const guest: AccountState = {configured: false, user: null, progress: null, loadError: false};
type ProgressContextType = {
  progress: Progress; ready: boolean; storageError: boolean; syncError: boolean; syncing: boolean; account: AccountState;
  saveSession: (session: Session, answers: SubmittedAnswer[]) => Promise<void>;
  setGoal: (goal: number) => Promise<void>;
  setLocale: (locale: 'en' | 'ru') => Promise<void>;
  reset: () => Promise<void>;
};
const ProgressContext = createContext<ProgressContextType | null>(null);

export function ProgressProvider({children, account = guest}: {children: ReactNode; account?: AccountState}) {
  const [progress, setProgress] = useState<Progress>(account.progress ?? initialProgress);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [syncError, setSyncError] = useState(account.loadError);
  const [pending, setPending] = useState(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const mounted = useRef(true);

  const cloudRequest = useCallback((method: string, body?: unknown): Promise<void> => {
    setPending(value => value + 1);
    const operation = queue.current.catch(() => undefined).then(async () => {
      if (!mounted.current) throw new Error('Account view closed');
      const response = await fetch('/api/progress', {method, cache: 'no-store', credentials: 'same-origin',
        headers: {'X-Nihongo-Account': account.user?.id ?? '', ...(body === undefined ? {} : {'Content-Type': 'application/json'})},
        body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000)});
      if (response.status === 401 || response.status === 409) {window.location.reload(); throw new Error('Account session changed');}
      if (!response.ok) throw new Error('Could not save progress');
      const parsed = cloudResponse.safeParse(await response.json());
      if (!parsed.success) throw new Error('Invalid server response');
      if (parsed.data.userId !== account.user?.id) {window.location.reload(); throw new Error('Account changed');}
      if (mounted.current) {setProgress(parsed.data.progress); setSyncError(false); setReady(true);}
    });
    queue.current = operation;
    return operation.catch(error => {if (mounted.current) setSyncError(true); throw error;})
      .finally(() => {if (mounted.current) setPending(value => value - 1);});
  }, [account.user?.id]);

  useEffect(() => {
    mounted.current = true;
    if (!account.user && !account.loadError) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      try {setProgress(parseProgress(localStorage.getItem(STORAGE_KEY)));} catch {setStorageError(true);}
      setReady(true);
    }
    if (account.user && account.progress && !account.loadError) setReady(true);
    function sync(event: StorageEvent) {
      if (event.key === AUTH_EVENT_KEY) {window.location.reload(); return;}
      if (!account.user && (event.key === STORAGE_KEY || event.key === null)) setProgress(parseProgress(event.newValue));
    }
    function focus() {if (account.user) void cloudRequest('GET').catch(() => undefined);}
    function restored(event: PageTransitionEvent) {if (event.persisted && account.user) window.location.reload();}
    window.addEventListener('storage', sync);
    window.addEventListener('focus', focus);
    window.addEventListener('pageshow', restored);
    return () => {mounted.current = false; window.removeEventListener('storage', sync); window.removeEventListener('focus', focus); window.removeEventListener('pageshow', restored);};
  }, [account.user, account.progress, account.loadError, cloudRequest]);

  const updateLocal = useCallback((transform: (current: Progress) => Progress) => {
    if (!ready || account.user || account.loadError) throw new Error('Progress not ready');
    let current = progress;
    try {current = parseProgress(localStorage.getItem(STORAGE_KEY));} catch {setStorageError(true);}
    const next = progressSchema.parse(transform(current));
    try {localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setStorageError(false);}
    catch {setStorageError(true); throw new Error('Browser storage unavailable');}
    setProgress(next);
  }, [progress, ready, account.user, account.loadError]);

  return <ProgressContext.Provider value={{progress, ready, storageError, syncError, syncing: pending > 0, account,
    saveSession: async (session, answers) => {
      if (account.user) await cloudRequest('POST', {id: session.id, lessonId: session.lessonId, durationSeconds: session.durationSeconds, answers});
      else updateLocal(current => addSession(current, session));
    },
    setGoal: async goal => {
      if (account.user) await cloudRequest('PATCH', {dailyGoal: goal});
      else updateLocal(current => progressSchema.parse({...current, dailyGoal: goal}));
    },
    setLocale: async locale => {if (account.user) await cloudRequest('PATCH', {locale});},
    reset: async () => {if (account.user) await cloudRequest('DELETE'); else updateLocal(() => initialProgress);}
  }}>{children}</ProgressContext.Provider>;
}
export function useProgress() {
  const context = useContext(ProgressContext);
  if (!context) throw new Error('useProgress requires ProgressProvider');
  return context;
}
