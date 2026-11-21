import {AccountPanel} from '@/components/account-panel';
import {enterLocale, pageMetadata, type LocaleParams} from '@/app/[locale]/page-helpers';

type Props = LocaleParams & {searchParams: Promise<Record<string, string | string[] | undefined>>};
export async function generateMetadata({params}: LocaleParams) {return pageMetadata((await params).locale, '/login');}

export default async function Page({params, searchParams}: Props) {
  await enterLocale(params);
  return <AccountPanel confirmationError={(await searchParams).error === 'confirmation'}/>;
}
