import {Pricing} from '@/components/secondary-pages';
import {getPlusPrice} from '@/lib/config';
import {enterLocale, pageMetadata, type LocaleParams} from '@/app/[locale]/page-helpers';

export async function generateMetadata({params}: LocaleParams) {return pageMetadata((await params).locale, '/pricing');}

export default async function Page({params}: LocaleParams) {
  await enterLocale(params);
  return <Pricing price={getPlusPrice()}/>;
}
