import {EmailVerification} from '@/components/email-verification';
import {enterLocale, pageMetadata, type LocaleParams} from '@/app/[locale]/page-helpers';

export async function generateMetadata({params}: LocaleParams) {return pageMetadata((await params).locale, '/verify-email');}

export default async function Page({params}: LocaleParams) {
  await enterLocale(params);
  return <EmailVerification/>;
}
