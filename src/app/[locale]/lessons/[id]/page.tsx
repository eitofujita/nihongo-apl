import {notFound} from 'next/navigation';
import {LessonDetail} from '@/components/learning';
import {getLessonMeta} from '@/content/catalog';
import {enterLocale, pageMetadata, type LocaleParams} from '@/app/[locale]/page-helpers';

type Props = LocaleParams<{id: string}>;
export async function generateMetadata({params}: Props) {const {locale, id} = await params; return pageMetadata(locale, `/lessons/${id}`);}

export default async function Page({params}: Props) {
  await enterLocale(params);
  const {id} = await params;
  // Only the lightweight index is used on the server; the lesson body loads in the browser.
  if (!getLessonMeta(id)) notFound();
  return <LessonDetail key={id} lessonId={id}/>;
}
