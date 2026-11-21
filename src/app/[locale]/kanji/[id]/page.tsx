import {notFound} from 'next/navigation';
import {KanjiPractice} from '@/components/kanji';
import {getKanji} from '@/content/kanji';
import {enterLocale, pageMetadata, type LocaleParams} from '@/app/[locale]/page-helpers';

type Props = LocaleParams<{id: string}>;
export async function generateMetadata({params}: Props) {const {locale, id} = await params; return pageMetadata(locale, `/kanji/${id}`);}

export default async function Page({params}: Props) {
  await enterLocale(params);
  const {id} = await params;
  if (!getKanji(id)) notFound();
  return <KanjiPractice key={id} id={id}/>;
}
