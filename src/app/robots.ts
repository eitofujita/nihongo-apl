import type {MetadataRoute} from 'next';
import {getAppUrl} from '@/lib/config';

export default function robots(): MetadataRoute.Robots {
  return {rules: {userAgent: '*', allow: ['/*/welcome', '/*/pricing', '/*/lessons'], disallow: ['/*/settings', '/*/history', '/*/review', '/*/login']}, sitemap: new URL('/sitemap.xml', getAppUrl()).href};
}
