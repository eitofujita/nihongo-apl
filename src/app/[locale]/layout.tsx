import type {ReactNode} from 'react';
import {hasLocale, NextIntlClientProvider} from 'next-intl';
import {setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {routing} from '@/i18n/routing';
import {ProgressProvider} from '@/components/progress-provider';
import {AppShell} from '@/components/app-shell';
import {getAccountState} from '@/lib/auth-state';
import '@fontsource-variable/dm-sans';
import '@fontsource/noto-sans-jp/400.css';
import '@fontsource/noto-sans-jp/500.css';
import '../globals.css';

export default async function LocaleLayout({children, params}: {children: ReactNode; params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const account = await getAccountState();
  return <html lang={locale}><body><NextIntlClientProvider><ProgressProvider key={account.user?.id ?? (account.loadError ? 'unavailable' : 'guest')} account={account}><a className="skip-link" href="#main-content">{locale === 'ru' ? 'Перейти к содержимому' : 'Skip to content'}</a><AppShell>{children}</AppShell></ProgressProvider></NextIntlClientProvider></body></html>;
}
