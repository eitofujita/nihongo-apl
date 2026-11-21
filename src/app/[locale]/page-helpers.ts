import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {getAppUrl} from '@/lib/config';
import {routing, type Locale} from '@/i18n/routing';

// Shared by every page under [locale]. Each screen has its own route so Next.js only ships that
// screen's client code (one catch-all route used to load every screen's code on every page).
export type LocaleParams<T = object> = {params: Promise<{locale: string} & T>};
const INDEXED = new Set(['/welcome', '/pricing', '/lessons', '/kanji', '/sentences']);

export async function pageMetadata(locale: string, path: string): Promise<Metadata> {
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({locale, namespace: 'App'});
  return {
    metadataBase: getAppUrl(),
    title: t('seoTitle'), description: t('seoDescription'),
    icons: {icon: '/icon.svg'},
    alternates: {canonical: `/${locale}${path}`, languages: {en: `/en${path}`, ru: `/ru${path}`, 'x-default': `/en${path}`}},
    robots: {index: INDEXED.has(path), follow: true},
    openGraph: {title: t('seoTitle'), description: t('seoDescription'), locale: locale === 'ru' ? 'ru_RU' : 'en_US', type: 'website'}
  };
}

/** Validates the locale segment and enables static locale rendering for the request. */
export async function enterLocale(params: Promise<{locale: string}>): Promise<Locale> {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return locale;
}
