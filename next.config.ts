import type {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  poweredByHeader: false,
  async headers() {
    return [{source: '/(.*)', headers: [
      {key: 'X-Content-Type-Options', value: 'nosniff'},
      {key: 'X-Frame-Options', value: 'DENY'},
      {key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin'},
      {key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()'}
    ]}, {
      source: '/auth/:path*',
      // Keep confirmation/recovery URLs out of subsequent Referer headers.
      headers: [{key: 'Referrer-Policy', value: 'no-referrer'}]
    }];
  }
};

export default createNextIntlPlugin('./src/i18n/request.ts')(nextConfig);
