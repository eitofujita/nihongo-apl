'use client';

import {useEffect, useRef, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {ArrowRight, LogOut} from 'lucide-react';
import {Link, useRouter} from '@/i18n/navigation';
import {PageHeading} from './dashboard';
import {useProgress} from './progress-provider';
import {loginSchema, newPasswordSchema, recoverySchema, registerSchema} from '@/lib/auth-schemas';
import {goToLearning} from '@/lib/auth-navigation';

type Mode = 'login' | 'register' | 'recover' | 'password';
const errors: Record<string, string> = {
  invalid_input: 'authInputError', credentials: 'authCredentialsError', email_not_confirmed: 'authEmailUnconfirmed',
  registration_failed: 'authRegistrationError', rate_limit: 'authRateError', password_failed: 'authPasswordError',
  email_rate_limit: 'authEmailRateError', auth_provider_rate_limit: 'authProviderRateError',
  unauthorized: 'authSessionError', not_configured: 'authUnavailable'
};

export function AccountPanel({mode = 'login', confirmationError = false}: {mode?: Mode; confirmationError?: boolean}) {
  const t = useTranslations('App');
  const locale = useLocale();
  const router = useRouter();
  const {account} = useProgress();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(confirmationError ? 'authConfirmationError' : '');
  const [notice, setNotice] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const retryAt = useRef(0);
  const title = mode === 'register' ? 'authRegisterTitle' : mode === 'recover' ? 'authRecoverTitle' : mode === 'password' ? 'authNewPasswordTitle' : 'authLoginTitle';

  function pause(seconds: number) {
    retryAt.current = Date.now() + seconds * 1000; setCooldown(seconds);
  }
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(Math.max(0, Math.ceil((retryAt.current - Date.now()) / 1000))), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending || cooldown > 0) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    const input = mode === 'recover' ? {email, locale} : mode === 'password' ? {password} : {email, password, locale};
    const schema = mode === 'register' ? registerSchema : mode === 'recover' ? recoverySchema : mode === 'password' ? newPasswordSchema : loginSchema;
    if (!schema.safeParse(input).success) {setError('authInputError'); return;}
    if ((mode === 'register' || mode === 'password') && password !== form.get('confirmPassword')) {setError('authPasswordMismatch'); return;}
    setPending(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/auth/${mode}`, {method: 'POST', credentials: 'same-origin',
        headers: {'Content-Type': 'application/json'}, body: JSON.stringify(input), signal: AbortSignal.timeout(20000)});
      const data: unknown = await response.json();
      const code = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : '';
      if (!response.ok) {
        setError(errors[code] ?? 'authUnavailable');
        if (response.status === 429) {
          const retry = Number(response.headers.get('Retry-After'));
          pause(Number.isInteger(retry) && retry > 0 && retry <= 3600 ? retry : 60);
        }
        return;
      }
      if (mode === 'register' && data && typeof data === 'object' && 'confirmation' in data && data.confirmation === true) {
        router.replace('/verify-email'); return;
      }
      if (mode === 'recover') {
        setNotice('authCheckEmail'); pause(60); return;
      }
      goToLearning(locale);
    } catch {setError('authUnavailable');}
    finally {setPending(false);}
  }
  async function logout() {
    if (pending) return;
    setPending(true); setError('');
    try {
      const response = await fetch('/api/auth/logout', {method: 'POST', credentials: 'same-origin', signal: AbortSignal.timeout(15000)});
      if (!response.ok) {setError('authUnavailable'); return;}
      goToLearning(locale);
    } catch {setError('authUnavailable');}
    finally {setPending(false);}
  }

  if (!account.configured) return <div className="account-panel"><PageHeading title={t(title)} subtitle={t('authSubtitle')}/><p className="account-notice">{t('accountText')}</p><Link className="button primary" href="/lessons">{t('tryGuest')}<ArrowRight size={17}/></Link></div>;
  if (account.user && mode !== 'password') return <div className="account-panel"><PageHeading title={t('accountLabel')} subtitle={t('authSignedIn')}/><p className="account-email">{account.user.email}</p><p className="account-notice">{t('cloudStorageHelp')}</p>{error && <p role="alert" className="auth-error">{t(error)}</p>}<button className="button outline" disabled={pending} onClick={logout}><LogOut size={16}/>{t('authLogout')}</button></div>;
  if (mode === 'password' && !account.user) return <div className="account-panel"><PageHeading title={t(title)} subtitle={t('authSubtitle')}/><p className="account-notice">{t('authSessionError')}</p><Link href="/forgot-password" className="button primary">{t('authRecoverTitle')}</Link></div>;
  return <div className="account-panel"><PageHeading title={t(title)} subtitle={t('authSubtitle')}/><form className="auth-form" onSubmit={submit}>
    {mode !== 'password' && <label>{t('authEmail')}<input name="email" type="email" autoComplete="email" maxLength={254} required disabled={pending}/></label>}
    {mode !== 'recover' && <label>{t('authPassword')}<input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? undefined : 12} maxLength={72} required disabled={pending}/></label>}
    {(mode === 'register' || mode === 'password') && <><p className="auth-help">{t('authPasswordHelp')}</p><label>{t('authConfirmPassword')}<input name="confirmPassword" type="password" autoComplete="new-password" maxLength={72} required disabled={pending}/></label></>}
    {error && <p className="auth-error" role="alert">{t(error)}</p>}
    {notice && <p className="auth-notice" role="status">{t(notice)}</p>}
    <button className="button primary" type="submit" disabled={pending || cooldown > 0}>{cooldown > 0 ? t('authRetryCountdown', {count: cooldown}) : t(pending ? 'authWorking' : mode === 'register' ? 'authRegisterAction' : mode === 'recover' ? 'authRecoverAction' : mode === 'password' ? 'authSavePassword' : 'login')}<ArrowRight size={17}/></button>
  </form><div className="auth-links"><Link href={mode === 'login' ? '/register' : '/login'}>{t(mode === 'login' ? 'authCreateAccount' : 'authHaveAccount')}</Link>{mode === 'login' && <Link href="/forgot-password">{t('authForgotPassword')}</Link>}</div>{mode === 'register' && <p className="auth-help">{t('authGuestSeparate')}</p>}<Link className="back-link" href="/lessons">{t('tryGuest')}</Link></div>;
}
