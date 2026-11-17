'use client';

import {useTranslations} from 'next-intl';
import {EmptyState} from '@/components/learning';

export default function NotFound() {
  const t = useTranslations('App');
  return <EmptyState title={t('notFound')} text={t('tagline')}/>;
}
