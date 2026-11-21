import {notFound} from 'next/navigation';
import {enterLocale, type LocaleParams} from '@/app/[locale]/page-helpers';

// Any other path under a locale renders the localized not-found page.
export default async function Page({params}: LocaleParams) {
  await enterLocale(params);
  notFound();
}
