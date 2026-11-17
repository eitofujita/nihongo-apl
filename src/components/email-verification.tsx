'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {ArrowRight, Mail} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import {goToLearning} from '@/lib/auth-navigation';
import {PageHeading} from './dashboard';
import {useProgress} from './progress-provider';

export function EmailVerification() {
  const t = useTranslations('App');
  const locale = useLocale();
  const {account} = useProgress();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('authVerificationWaiting');
  const mounted = useRef(false);
  const inFlight = useRef(false);
  const completed = useRef(false);
  const automatic = useRef(true);
  const controller = useRef<AbortController | null>(null);

  const check = useCallback(async (manual = false) => {
    if (inFlight.current || completed.current || !mounted.current || (!manual && !automatic.current)) return;
    inFlight.current = true; setChecking(true);
    const current = new AbortController(); controller.current = current;
    try {
      const response = await fetch('/api/auth/status', {cache: 'no-store', credentials: 'same-origin',
        signal: AbortSignal.any([current.signal, AbortSignal.timeout(10000)])});
      const data: unknown = await response.json();
      if (!response.ok || !data || typeof data !== 'object' || !('authenticated' in data) || typeof data.authenticated !== 'boolean') throw new Error('Unavailable');
      if (!mounted.current || current.signal.aborted) return;
      if (data.authenticated) {
        completed.current = true; goToLearning(locale);
      } else if (manual || automatic.current) {
        setMessage(manual ? 'authVerificationNotYet' : 'authVerificationWaiting');
      }
    } catch {
      if (mounted.current && !current.signal.aborted && (manual || automatic.current)) setMessage('authVerificationConnectionError');
    } finally {
      inFlight.current = false;
      if (mounted.current) setChecking(false);
    }
  }, [locale]);

  useEffect(() => {
    mounted.current = true;
    if (!account.configured) return () => {mounted.current = false;};
    if (account.user) {
      goToLearning(locale);
      return () => {mounted.current = false;};
    }
    automatic.current = true;
    function resume() {if (automatic.current && document.visibilityState === 'visible') void check();}
    const initial = setTimeout(resume, 0);
    const interval = setInterval(resume, 10000);
    const pause = setTimeout(() => {
      automatic.current = false; clearInterval(interval); setMessage('authVerificationPaused');
    }, 15 * 60 * 1000);
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      mounted.current = false; automatic.current = false; controller.current?.abort();
      clearTimeout(initial); clearInterval(interval); clearTimeout(pause);
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [account.configured, account.user, locale, check]);

  return <div className="account-panel email-verification">
    <div className="verification-icon" aria-hidden="true"><Mail size={26}/></div>
    <PageHeading title={t('authVerificationTitle')} subtitle={t('authVerificationSubtitle')}/>
    {!account.configured ? <><p className="account-notice">{t('accountText')}</p><Link className="button primary" href="/lessons">{t('tryGuest')}</Link></> : <>
      <ol className="verification-steps">
        <li>{t('authVerificationOpenEmail')}</li>
        <li>{t('authVerificationFollowLink')}</li>
        <li>{t('authVerificationContinue')}</li>
      </ol>
      <p className="auth-notice" role="status">{t(message)}</p>
      <button className="button primary" disabled={checking} onClick={() => void check(true)}>{t(checking ? 'authWorking' : 'authVerificationCheck')}<ArrowRight size={17}/></button>
      <p className="auth-help">{t('authVerificationHelp')}</p>
      <div className="auth-links"><Link href="/login">{t('authHaveAccount')}</Link><Link href="/register">{t('authVerificationChangeEmail')}</Link></div>
    </>}
  </div>;
}
