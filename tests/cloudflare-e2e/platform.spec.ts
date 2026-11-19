import {expect, test} from '@playwright/test';

test('Worker routes and platform rate bindings preserve safe API responses', async ({request}) => {
  const status = await request.get('/api/auth/status');
  expect(status.status()).toBe(200);
  expect(await status.json()).toEqual({authenticated: false});
  expect(status.headers()['cache-control']).toContain('no-store');

  // Empty input cannot send a sign-in request to the provider.
  const invalid = await request.post('/api/auth/login', {data: {}, headers: {origin: 'http://127.0.0.1:8787'}});
  expect(invalid.status()).toBe(400);
  expect(await invalid.json()).toEqual({error: 'invalid_input'});
  const foreign = await request.post('/api/auth/login', {data: {}, headers: {origin: 'https://attacker.test'}});
  expect(foreign.status()).toBe(403);
  const progress = await request.get('/api/progress');
  expect(progress.status()).toBe(401);
});

test('Worker callback rejects invalid links and returns to the configured origin', async ({request}) => {
  const response = await request.get('/auth/callback?locale=ru&next=https://attacker.test', {maxRedirects: 0});
  expect(response.status()).toBe(307);
  const location = new URL(response.headers().location);
  expect(location.origin).toBe('http://127.0.0.1:8787');
  expect(location.pathname).toBe('/ru/login');
  expect(response.headers()['referrer-policy']).toBe('no-referrer');
  expect(response.headers()['cache-control']).toContain('no-store');
});
