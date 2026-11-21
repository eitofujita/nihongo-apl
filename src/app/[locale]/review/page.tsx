import {Review} from '@/components/learning';
import {enterLocale, pageMetadata, type LocaleParams} from '@/app/[locale]/page-helpers';

export async function generateMetadata({params}: LocaleParams) {return pageMetadata((await params).locale, '/review');}

export default async function Page({params}: LocaleParams) {
  await enterLocale(params);
  return <Review/>;
}
