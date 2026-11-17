import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Dashboard} from '@/components/dashboard';
import {Courses, LessonDetail, Review} from '@/components/learning';
import {History, Placement, Pricing, Settings, Tutor, Welcome} from '@/components/secondary-pages';
import {AccountPanel} from '@/components/account-panel';
import {EmailVerification} from '@/components/email-verification';
import {getLesson} from '@/content/lessons';
import {getAppUrl, getPlusPrice} from '@/lib/config';
import {routing} from '@/i18n/routing';

type Props = {params: Promise<{locale: string; view?: string[]}>; searchParams: Promise<Record<string, string | string[] | undefined>>};

export async function generateMetadata({params}: Props): Promise<Metadata> {
  const {locale, view = []} = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({locale, namespace: 'App'});
  const path = view.length ? `/${view.join('/')}` : '';
  const publicPage = path === '/welcome' || path === '/pricing' || path === '/lessons';
  return {
    metadataBase: getAppUrl(),
    title: t('seoTitle'), description: t('seoDescription'),
    icons: {icon: '/icon.svg'},
    alternates: {canonical: `/${locale}${path}`, languages: {en: `/en${path}`, ru: `/ru${path}`, 'x-default': `/en${path}`}},
    robots: {index: publicPage, follow: true},
    openGraph: {title: t('seoTitle'), description: t('seoDescription'), locale: locale === 'ru' ? 'ru_RU' : 'en_US', type: 'website'}
  };
}

export default async function Page({params, searchParams}: Props) {
  const {locale, view = []} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  if (view.length === 0) return <Dashboard/>;
  if (view[0] === 'lessons' && view.length === 2) {
    if (!getLesson(view[1])) notFound();
    return <LessonDetail key={view[1]} lessonId={view[1]}/>;
  }
  if (view.length !== 1) notFound();
  switch (view[0]) {
    case 'lessons': return <Courses/>;
    case 'review': return <Review/>;
    case 'history': return <History/>;
    case 'tutor': return <Tutor/>;
    case 'pricing': return <Pricing price={getPlusPrice()}/>;
    case 'settings': return <Settings/>;
    case 'login': return <AccountPanel confirmationError={(await searchParams).error === 'confirmation'}/>;
    case 'register': return <AccountPanel mode="register"/>;
    case 'verify-email': return <EmailVerification/>;
    case 'forgot-password': return <AccountPanel mode="recover"/>;
    case 'reset-password': return <AccountPanel mode="password"/>;
    case 'placement': return <Placement/>;
    case 'welcome': return <Welcome/>;
    default: notFound();
  }
}
