import {createHash} from 'node:crypto';
import {NextResponse} from 'next/server';
import {getAppUrl} from './config';

export class ApiError extends Error {
  constructor(public status: number, public code: string, public retryAfterSeconds?: number) {super(code);}
}
export function apiJson(value: unknown, status = 200) {
  return NextResponse.json(value, {status, headers: {'Cache-Control': 'private, no-store, max-age=0', Pragma: 'no-cache', Expires: '0'}});
}
export function apiFailure(error: unknown) {
  if (error instanceof ApiError) {
    const retry = error.retryAfterSeconds;
    const response = apiJson({error: error.code, ...(retry === undefined ? {} : {retryAfterSeconds: retry})}, error.status);
    if (retry !== undefined) response.headers.set('Retry-After', String(retry));
    return response;
  }
  console.error('[api] Request failed; sensitive request data omitted.');
  return apiJson({error: 'unavailable'}, 503);
}
export function requireSameOrigin(request: Request) {
  // Next can expose its internal bind address (0.0.0.0) as request.url.
  // Trust the configured public origin, never client-supplied forwarding headers.
  const origin = request.headers.get('origin');
  const app = getAppUrl();
  const allowed = new Set([app.origin]);
  const loopbackHosts = ['localhost', '127.0.0.1', '[::1]'];
  if (process.env.NODE_ENV !== 'production' && loopbackHosts.includes(app.hostname)) {
    for (const hostname of loopbackHosts) {
      const local = new URL(app.origin); local.hostname = hostname;
      allowed.add(local.origin);
    }
  }
  if (!origin || !allowed.has(origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new ApiError(403, 'origin');
}
export async function readJson(request: Request, limit = 16384): Promise<unknown> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new ApiError(415, 'content_type');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'invalid_input');
  const decoder = new TextDecoder(); let size = 0; let text = '';
  try {
    while (true) {
      const {done, value} = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limit) {await reader.cancel(); throw new ApiError(413, 'too_large');}
      text += decoder.decode(value, {stream: true});
    }
    return JSON.parse(text + decoder.decode()) as unknown;
  } catch (error) {if (error instanceof ApiError) throw error; throw new ApiError(400, 'invalid_input');}
  finally {reader.releaseLock();}
}

export class RateLimiter {
  private windows = new Map<string, {count: number; until: number}>();
  consume(key: string, maximum: number, windowMs: number, now = Date.now()) {
    for (const [id, item] of this.windows) if (item.until <= now) this.windows.delete(id);
    const entry = this.windows.get(key) ?? {count: 0, until: now + windowMs};
    if (!this.windows.has(key) && this.windows.size >= 5000) throw new ApiError(429, 'rate_limit', Math.max(1, Math.ceil(windowMs / 1000)));
    if (entry.count >= maximum) throw new ApiError(429, 'rate_limit', Math.max(1, Math.ceil((entry.until - now) / 1000)));
    entry.count++; this.windows.set(key, entry);
  }
}
export const authLimiter = new RateLimiter();
export const progressLimiter = new RateLimiter();
export function authRateKey(request: Request, action: string) {
  // Forwarded IPs are trusted only behind the selected hosting platform.
  const ip = process.env.VERCEL === '1' ? request.headers.get('x-vercel-forwarded-for') ?? 'unknown' : 'local';
  return createHash('sha256').update(`${action}:${ip}`).digest('hex');
}
