import {Placement} from '@/components/secondary-pages';
import {enterLocale, pageMetadata, type LocaleParams} from '@/app/[locale]/page-helpers';

export async function generateMetadata({params}: LocaleParams) {return pageMetadata((await params).locale, '/placement');}

export default async function Page({params}: LocaleParams) {
  await enterLocale(params);
  return <Placement/>;
}
