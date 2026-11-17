import {AUTH_EVENT_KEY} from '@/components/progress-provider';

export function goToLearning(locale: string) {
  try {localStorage.setItem(AUTH_EVENT_KEY, crypto.randomUUID());} catch { /* Cross-tab notification is best effort. */ }
  // Discard the entire per-account React/route cache after an auth change.
  window.location.replace(locale === 'ru' ? '/ru' : '/en');
}
