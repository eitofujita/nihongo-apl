import type {MetadataRoute} from 'next';
import {getAppUrl} from '@/lib/config';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['welcome', 'pricing', 'lessons', 'kanji'].flatMap(path => ['en', 'ru'].map(locale => ({url: new URL(`/${locale}/${path}`, getAppUrl()).href, alternates: {languages: {en: new URL(`/en/${path}`, getAppUrl()).href, ru: new URL(`/ru/${path}`, getAppUrl()).href}}})));
}
