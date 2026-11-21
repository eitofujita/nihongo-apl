import {AccountPanel} from '@/components/account-panel';
import {enterLocale, pageMetadata, type LocaleParams} from '@/app/[locale]/page-helpers';

export async function generateMetadata({params}: LocaleParams) {return pageMetadata((await params).locale, '/forgot-password');}

export default async function Page({params}: LocaleParams) {
  await enterLocale(params);
  return <AccountPanel mode="recover"/>;
}
