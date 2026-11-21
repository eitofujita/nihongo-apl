import type {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// The browser only talks to this origin (Supabase is called from the server), so everything is
// limited to 'self'. Next.js renders inline bootstrap scripts, hence 'unsafe-inline' for scripts;
// eval is not allowed. Dev mode needs eval/websockets for hot reload, so the policy is production-only.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join('; ');

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  poweredByHeader: false,
  async headers() {
    return [{source: '/(.*)', headers: [
      ...(process.env.NODE_ENV === 'production' ? [{key: 'Content-Security-Policy', value: contentSecurityPolicy}] : []),
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
