import {KanjiTest} from '@/components/kanji';
import {enterLocale, pageMetadata, type LocaleParams} from '@/app/[locale]/page-helpers';

export async function generateMetadata({params}: LocaleParams) {return pageMetadata((await params).locale, '/kanji/test');}

export default async function Page({params}: LocaleParams) {
  await enterLocale(params);
  return <KanjiTest/>;
}
