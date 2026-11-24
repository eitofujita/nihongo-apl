import {beforeEach, describe, expect, it, vi} from 'vitest';
import {initialProgress} from '@/lib/progress';
import {ApiError, apiFailure, authLimiter, RateLimiter, readJson, requireSameOrigin} from '@/lib/api-security';
import {loginSchema, registerSchema, submissionSchema} from '@/lib/auth-schemas';
import {getSupabaseConfig} from '@/lib/supabase/config';

const sdk = vi.hoisted(() => ({
  create: vi.fn(), getUser: vi.fn(), rpc: vi.fn(), signUp: vi.fn(), signIn: vi.fn(), signOut: vi.fn(),
  recover: vi.fn(), updateUser: vi.fn(), verify: vi.fn(), exchange: vi.fn(), from: vi.fn(),
  update: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn()
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({createSupabaseServerClient: sdk.create}));
import {GET as authGet, POST as authPost} from '@/app/api/auth/[action]/route';
import {GET as getProgress, POST as postProgress, PATCH as patchProgress, DELETE as deleteProgress} from '@/app/api/progress/route';
import {GET as getKanji, POST as postKanji} from '@/app/api/kanji-progress/route';
import {GET as confirm} from '@/app/auth/confirm/route';
import {GET as callback} from '@/app/auth/callback/route';

const USER = '00000000-0000-4000-8000-000000000001';
const submission = {id: '10000000-0000-4000-8000-000000000001', lessonId: 'n5-no', durationSeconds: 90, answers: [
  {questionId: 'no-1', answer: 'の'}, {questionId: 'no-2', answer: 'の'}, {questionId: 'no-3', answer: 'の'}
]};
function request(path: string, body?: unknown, method = 'POST', origin = 'http://localhost:3000') {
  return new Request(`http://localhost:3000${path}`, {method, headers: {origin, 'content-type': 'application/json'}, body: body === undefined ? undefined : JSON.stringify(body)});
}
function auth(action: string, body?: unknown) {return authPost(request(`/api/auth/${action}`, body), {params: Promise.resolve({action})});}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(authLimiter, 'consume').mockImplementation(() => undefined);
  sdk.getUser.mockResolvedValue({data: {user: {id: USER, email: 'student@example.test'}}, error: null});
  sdk.rpc.mockResolvedValue({data: initialProgress, error: null});
  sdk.signUp.mockResolvedValue({data: {session: null}, error: null});
  sdk.signIn.mockResolvedValue({data: {}, error: null});
  sdk.signOut.mockResolvedValue({error: null});
  sdk.recover.mockResolvedValue({error: null});
  sdk.updateUser.mockResolvedValue({error: null});
  sdk.verify.mockResolvedValue({error: null});
  sdk.exchange.mockResolvedValue({error: null});
  sdk.single.mockResolvedValue({data: {user_id: USER}, error: null});
  sdk.select.mockReturnValue({single: sdk.single});
  sdk.eq.mockReturnValue({select: sdk.select});
  sdk.update.mockReturnValue({eq: sdk.eq});
  sdk.from.mockReturnValue({update: sdk.update});
  sdk.create.mockResolvedValue({auth: {getUser: sdk.getUser, signUp: sdk.signUp, signInWithPassword: sdk.signIn,
    signOut: sdk.signOut, resetPasswordForEmail: sdk.recover, updateUser: sdk.updateUser,
    verifyOtp: sdk.verify, exchangeCodeForSession: sdk.exchange}, rpc: sdk.rpc, from: sdk.from});
});

describe('Auth input, CSRF and bounded requests', () => {
  it('validates passwords without truncating Unicode or changing existing login credentials', () => {
    expect(registerSchema.safeParse({email: 'student@example.test', password: 'short', locale: 'en'}).success).toBe(false);
    expect(registerSchema.safeParse({email: 'student@example.test', password: 'あ'.repeat(25), locale: 'en'}).success).toBe(false);
    expect(loginSchema.safeParse({email: 'student@example.test', password: 'legacy', locale: 'ru'}).success).toBe(true);
  });
  it('rejects private keys in the public configuration', () => {
    expect(getSupabaseConfig({url: 'https://example.supabase.co', key: 'sb_secret_private'})).toBeNull();
    expect(getSupabaseConfig({url: 'http://external.test', key: 'sb_publishable_test'})).toBeNull();
    expect(getSupabaseConfig({url: 'https://example.supabase.co', key: 'sb_publishable_test'})).not.toBeNull();
  });
  it('rejects cross-origin mutations before contacting the auth provider', async () => {
    const response = await authPost(request('/api/auth/login', {}, 'POST', 'https://attacker.test'), {params: Promise.resolve({action: 'login'})});
    expect(response.status).toBe(403); expect(sdk.create).not.toHaveBeenCalled();
    expect(() => requireSameOrigin(new Request('http://localhost:3000/api/progress', {method: 'POST'}))).toThrow(ApiError);
  });
  it('rejects malformed JSON, oversized bodies and unsupported media types', async () => {
    await expect(readJson(request('/api/progress', {text: 'a'.repeat(20000)}))).rejects.toMatchObject({status: 413});
    await expect(readJson(new Request('http://localhost:3000', {method: 'POST', headers: {'content-type': 'application/json'}, body: '{'}))).rejects.toMatchObject({status: 400});
    await expect(readJson(new Request('http://localhost:3000', {method: 'POST', body: 'plain'}))).rejects.toMatchObject({status: 415});
  });
  it('bounds attempts and expires each limiter window', () => {
    const limiter = new RateLimiter();
    limiter.consume('one', 2, 60000, 100); limiter.consume('one', 2, 60000, 100);
    expect(() => limiter.consume('one', 2, 60000, 100)).toThrow(ApiError);
    expect(() => limiter.consume('two', 2, 60000, 100)).not.toThrow();
    expect(() => limiter.consume('one', 2, 60000, 60100)).not.toThrow();
  });
  it('returns the remaining local rate-limit window without exposing request details', async () => {
    const limiter = new RateLimiter();
    limiter.consume('attempt', 1, 60000, 1000);
    let failure: unknown;
    try {limiter.consume('attempt', 1, 60000, 32500);} catch (error) {failure = error;}
    const response = apiFailure(failure);
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('29');
    expect(await response.json()).toEqual({error: 'rate_limit', retryAfterSeconds: 29});
  });
});

describe('Authentication handlers', () => {
  it('reports only server-verified authentication without exposing user data or loading progress', async () => {
    const response = await authGet(request('/api/auth/status', undefined, 'GET'), {params: Promise.resolve({action: 'status'})});
    expect(await response.json()).toEqual({authenticated: true});
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(sdk.getUser).toHaveBeenCalledOnce(); expect(sdk.rpc).not.toHaveBeenCalled();
    sdk.getUser.mockResolvedValueOnce({data: {user: null}, error: {status: 400, name: 'AuthSessionMissingError'}});
    expect(await (await authGet(request('/api/auth/status', undefined, 'GET'), {params: Promise.resolve({action: 'status'})})).json()).toEqual({authenticated: false});
  });
  it('does not report successful authentication on provider errors or missing configuration', async () => {
    sdk.getUser.mockResolvedValueOnce({data: {user: {id: USER}}, error: {status: 503}});
    expect((await authGet(request('/api/auth/status', undefined, 'GET'), {params: Promise.resolve({action: 'status'})})).status).toBe(503);
    sdk.create.mockResolvedValueOnce(null);
    expect((await authGet(request('/api/auth/status', undefined, 'GET'), {params: Promise.resolve({action: 'status'})})).status).toBe(503);
    expect((await authGet(request('/api/auth/login', undefined, 'GET'), {params: Promise.resolve({action: 'login'})})).status).toBe(404);
  });
  it('requires valid configuration and does not simulate a signed-in user', async () => {
    sdk.create.mockResolvedValue(null);
    const response = await auth('login', {email: 'student@example.test', password: 'a-good-password', locale: 'en'});
    expect(response.status).toBe(503); expect(await response.json()).toEqual({error: 'not_configured'});
  });
  it('registers with a fixed locale callback and waits for email confirmation', async () => {
    const response = await auth('register', {email: 'student@example.test', password: 'a-good-password', locale: 'ru'});
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ok: true, confirmation: true});
    expect(sdk.signUp).toHaveBeenCalledWith(expect.objectContaining({options: {emailRedirectTo: 'http://localhost:3000/auth/callback?locale=ru'}}));
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('allows registration through the Next bind address with the configured browser origin', async () => {
    const response = await authPost(new Request('http://0.0.0.0:3000/api/auth/register', {
      method: 'POST', headers: {origin: 'http://localhost:3000', 'content-type': 'application/json'},
      body: JSON.stringify({email: 'student@example.test', password: 'a-good-password', locale: 'ru'})
    }), {params: Promise.resolve({action: 'register'})});
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ok: true, confirmation: true});
    expect(sdk.signUp).toHaveBeenCalledOnce();
  });
  it('maps failed credentials to a safe response and requires explicit logout', async () => {
    sdk.signIn.mockResolvedValue({error: {status: 400, code: 'invalid_credentials', message: 'secret detail'}});
    const response = await auth('login', {email: 'student@example.test', password: 'a-good-password', locale: 'en'});
    expect(await response.json()).toEqual({error: 'credentials'});
    expect((await auth('logout')).status).toBe(200);
    expect(sdk.signOut).toHaveBeenCalledWith({scope: 'local'});
  });
  it('supports password recovery and rejects unauthenticated password updates', async () => {
    expect((await auth('recover', {email: 'student@example.test', locale: 'en'})).status).toBe(200);
    expect(sdk.recover).toHaveBeenCalledWith('student@example.test', {redirectTo: 'http://localhost:3000/auth/callback?locale=en&recovery=1'});
    sdk.getUser.mockResolvedValue({data: {user: null}, error: {status: 401}});
    expect((await auth('password', {password: 'a-new-password'})).status).toBe(401);
    expect(sdk.updateUser).not.toHaveBeenCalled();
  });
  it('distinguishes provider email limits from local limits without inventing a reset deadline', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      sdk.recover.mockResolvedValueOnce({error: {status: 429, code: 'over_email_send_rate_limit', message: 'private provider message'}});
      const emailLimit = await auth('recover', {email: 'student@example.test', locale: 'ru'});
      expect(emailLimit.status).toBe(429);
      expect(emailLimit.headers.get('Retry-After')).toBeNull();
      expect(await emailLimit.json()).toEqual({error: 'email_rate_limit'});
      expect(warning).toHaveBeenCalledExactlyOnceWith('[auth] Provider email sending rate limit.');
      sdk.recover.mockResolvedValueOnce({error: {status: 429, code: 'over_request_rate_limit'}});
      expect(await (await auth('recover', {email: 'student@example.test', locale: 'en'})).json()).toEqual({error: 'auth_provider_rate_limit'});
      sdk.recover.mockClear(); sdk.create.mockClear();
      vi.mocked(authLimiter.consume).mockImplementationOnce(() => {throw new ApiError(429, 'rate_limit', 17);});
      const localLimit = await auth('recover', {email: 'student@example.test', locale: 'en'});
      expect(localLimit.headers.get('Retry-After')).toBe('17');
      expect(await localLimit.json()).toEqual({error: 'rate_limit', retryAfterSeconds: 17});
      expect(sdk.create).not.toHaveBeenCalled(); expect(sdk.recover).not.toHaveBeenCalled();
    } finally {warning.mockRestore();}
  });
  it('does not accept arbitrary callback redirects or token types', async () => {
    const response = await confirm(new Request('http://localhost:3000/auth/confirm?locale=ru&type=email&token_hash=test&next=https://attacker.test'));
    expect(response.headers.get('location')).toBe('http://localhost:3000/ru');
    const invalid = await confirm(new Request('http://localhost:3000/auth/confirm?type=invite&token_hash=test'));
    expect(invalid.headers.get('location')).toBe('http://localhost:3000/en/login?error=confirmation');
    expect((await callback(new Request('http://localhost:3000/auth/callback?code=test&locale=ru&recovery=1'))).headers.get('location')).toBe('http://localhost:3000/ru/reset-password');
  });
  it('returns email callbacks to the public app URL even when Next exposes the bind address', async () => {
    for (const [handler, path] of [[callback, '/auth/callback?code=test'], [confirm, '/auth/confirm?type=email&token_hash=test']] as const) {
      const response = await handler(new Request(`http://0.0.0.0:3000${path}&locale=ru&next=https://attacker.test`));
      expect(response.headers.get('location')).toBe('http://localhost:3000/ru');
      expect(response.headers.get('cache-control')).toContain('no-store');
    }
    sdk.exchange.mockResolvedValueOnce({error: {status: 400}});
    expect((await callback(new Request('http://0.0.0.0:3000/auth/callback?code=expired&locale=en'))).headers.get('location')).toBe('http://localhost:3000/en/login?error=confirmation');
  });
  it('passes valid PKCE flow ids to the SDK and rejects malformed ones without consuming a code', async () => {
    const response = await callback(new Request('http://localhost:3000/auth/callback?code=test&sb_flow_id=0123456789abcdef&recovery=1&locale=ru'));
    expect(sdk.exchange).toHaveBeenCalledWith('test', {flowId: '0123456789abcdef'});
    expect(response.headers.get('location')).toBe('http://localhost:3000/ru/reset-password');
    sdk.exchange.mockClear();
    for (const flow of ['', '../cookie', 'x'.repeat(65)]) {
      const rejected = await callback(new Request(`http://localhost:3000/auth/callback?code=test&sb_flow_id=${encodeURIComponent(flow)}`));
      expect(rejected.headers.get('location')).toBe('http://localhost:3000/en/login?error=confirmation');
    }
    expect(sdk.exchange).not.toHaveBeenCalled();
  });
});

describe('Authenticated learning API', () => {
  it('authenticates before exposing data, rather than trusting local state', async () => {
    sdk.getUser.mockResolvedValue({data: {user: null}, error: null});
    expect((await getProgress(request('/api/progress', undefined, 'GET'))).status).toBe(401); expect(sdk.rpc).not.toHaveBeenCalled();
  });
  it('returns only the authenticated user identity and validated progress', async () => {
    const response = await getProgress(request('/api/progress', undefined, 'GET'));
    expect(await response.json()).toEqual({userId: USER, progress: initialProgress});
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('submits raw answers to server-side grading and rejects forged ownership or scores', async () => {
    expect((await postProgress(request('/api/progress', submission))).status).toBe(200);
    expect(sdk.rpc).toHaveBeenCalledWith('submit_practice', {p_session_id: submission.id, p_lesson_id: submission.lessonId, p_duration_seconds: 90, p_answers: submission.answers});
    expect((await postProgress(request('/api/progress', {...submission, userId: 'other'}))).status).toBe(400);
    expect(submissionSchema.safeParse({...submission, answers: submission.answers.map(a => ({...a, correct: true}))}).success).toBe(false);
  });
  it('scopes preferences to the verified user and refuses payment or owner updates', async () => {
    expect((await patchProgress(request('/api/progress', {dailyGoal: 10, locale: 'ru'}, 'PATCH'))).status).toBe(200);
    expect(sdk.eq).toHaveBeenCalledWith('user_id', USER);
    expect((await patchProgress(request('/api/progress', {plan: 'plus'}, 'PATCH'))).status).toBe(400);
    expect((await deleteProgress(request('/api/progress', undefined, 'DELETE'))).status).toBe(200);
    expect(sdk.rpc).toHaveBeenCalledWith('reset_learning_progress', {});
  });
  it('reports failed persistence rather than marking the result saved', async () => {
    sdk.rpc.mockResolvedValue({data: null, error: {code: 'NETWORK_ERROR'}});
    const response = await postProgress(request('/api/progress', submission));
    expect(response.status).toBe(503); expect(await response.json()).toEqual({error: 'storage_unavailable'});
  });
  it('does not write an old tab’s pending result into a newly signed-in account', async () => {
    const input = request('/api/progress', submission);
    input.headers.set('X-Nihongo-Account', '00000000-0000-4000-8000-000000000002');
    expect((await postProgress(input)).status).toBe(409);
    expect(sdk.rpc).not.toHaveBeenCalled();
  });
});

describe('Kanji progress API', () => {
  const stored = {'水': {passed: 'recall', attempts: 2, at: '2026-11-22T00:00:00.000Z'}};
  it('requires a signed-in user and returns only that user\'s validated progress', async () => {
    sdk.getUser.mockResolvedValueOnce({data: {user: null}, error: null});
    expect((await getKanji(request('/api/kanji-progress', undefined, 'GET'))).status).toBe(401);
    expect(sdk.rpc).not.toHaveBeenCalled();
    sdk.rpc.mockResolvedValue({data: stored, error: null});
    const response = await getKanji(request('/api/kanji-progress', undefined, 'GET'));
    expect(await response.json()).toEqual({userId: USER, store: stored});
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('records attempts for practice kanji only, with no extra fields, from this origin', async () => {
    sdk.rpc.mockResolvedValue({data: stored, error: null});
    expect((await postKanji(request('/api/kanji-progress', {kanji: '水', mode: 'recall', mistakes: 1}))).status).toBe(200);
    expect(sdk.rpc).toHaveBeenCalledWith('record_kanji_attempt', {p_kanji: '水', p_mode: 'recall', p_mistakes: 1});
    for (const body of [{kanji: '鬱', mode: 'recall', mistakes: 0}, {kanji: '水', mode: 'expert', mistakes: 0},
      {kanji: '水', mode: 'trace', mistakes: -1}, {kanji: '水', mode: 'trace', mistakes: 0, passed: 'recall'}]) {
      expect((await postKanji(request('/api/kanji-progress', body))).status).toBe(400);
    }
    expect((await postKanji(request('/api/kanji-progress', {kanji: '水', mode: 'trace', mistakes: 0}, 'POST', 'https://evil.example'))).status).toBe(403);
    const forged = new Request('http://localhost:3000/api/kanji-progress', {method: 'POST', headers: {origin: 'http://localhost:3000', 'content-type': 'application/json', 'x-nihongo-account': 'someone-else'}, body: JSON.stringify({kanji: '水', mode: 'trace', mistakes: 0})});
    expect((await postKanji(forged)).status).toBe(409);
  });
  it('reports storage failures and malformed database results instead of claiming success', async () => {
    sdk.rpc.mockResolvedValue({data: null, error: {code: 'NETWORK_ERROR'}});
    expect((await postKanji(request('/api/kanji-progress', {kanji: '水', mode: 'trace', mistakes: 0}))).status).toBe(503);
    sdk.rpc.mockResolvedValue({data: {'水': {passed: 'master'}}, error: null});
    expect((await getKanji(request('/api/kanji-progress', undefined, 'GET'))).status).toBe(503);
  });
});
