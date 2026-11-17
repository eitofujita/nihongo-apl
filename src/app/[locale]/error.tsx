'use client';

import {useTranslations} from 'next-intl';

export default function ErrorPage({reset}: {error: Error & {digest?: string}; reset: () => void}) {
  const t = useTranslations('App');
  return <div className="empty-state panel" role="alert"><h1>{t('errorTitle')}</h1><p>{t('errorText')}</p><button onClick={reset} className="button primary">{t('tryAgain')}</button></div>;
}
