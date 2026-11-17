import {expect, test} from '@playwright/test';
import {placementQuestions} from '../../src/content/lessons';

test('English and Russian pages render with localized metadata and no horizontal overflow', async ({page}) => {
  for (const locale of ['en', 'ru']) {
    const response = await page.goto(`/${locale}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('h1')).toContainText(locale === 'en' ? 'Your Japanese' : 'Японский');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.locator('link[hreflang="en"]').first()).toHaveAttribute('href', /\/en$/);
    await expect(page.locator('link[hreflang="ru"]').first()).toHaveAttribute('href', /\/ru$/);
  }
});

test('a new learner can choose the diagnostic or start lesson one in either language', async ({page}) => {
  for (const locale of ['en', 'ru']) {
    await page.goto(`/${locale}`);
    await expect(page.locator('.next-action .button')).toHaveAttribute('href', `/${locale}/placement`);
    await expect(page.locator('.next-action .first-lesson-link')).toHaveAttribute('href', `/${locale}/lessons/n5-wa-desu`);
    await expect(page.locator('.placement-link')).toHaveCount(0);
    await page.locator('.first-lesson-link').click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/lessons/n5-wa-desu$`));
    await expect(page.locator('.study-example')).toBeVisible();
  }
});

test('a real practice result survives a locale switch and page reload', async ({page}) => {
  await page.goto('/en/lessons/n5-wa-desu');
  await page.getByRole('button', {name: 'Start practice'}).click();
  await page.locator('input[value="は"]').check();
  await page.getByRole('button', {name: 'Check answer'}).click();
  await expect(page.getByRole('status')).toContainText("That's right");
  await page.getByRole('button', {name: 'Next question'}).click();
  await page.locator('input[value="です"]').check();
  await page.getByRole('button', {name: 'Check answer'}).click();
  await page.getByRole('button', {name: 'Next question'}).click();
  await page.getByRole('textbox').fill('は');
  await page.getByRole('button', {name: 'Check answer'}).click();
  await page.getByRole('button', {name: 'Finish lesson'}).click();
  await expect(page.getByRole('heading', {level: 1})).toContainText('complete');
  await expect(page.locator('.result-next .button')).toHaveAttribute('href', '/en/lessons/n5-everyday');
  await page.goto('/en/history');
  await expect(page.locator('tbody')).toContainText('3 / 3');
  await page.getByRole('combobox', {name: 'Language', exact: true}).selectOption('ru');
  await expect(page).toHaveURL(/\/ru\/history/);
  await expect(page.locator('tbody')).toContainText('3 / 3');
  await page.reload();
  await expect(page.locator('tbody')).toContainText('3 / 3');
});

test('lesson filters, empty search, daily goals, and reset confirmation work', async ({page}) => {
  await page.goto('/en/lessons');
  await page.getByRole('button', {name: 'Vocabulary', exact: true}).click();
  await expect(page.locator('.course-grid .lesson-card')).toHaveCount(10);
  await page.getByRole('textbox', {name: 'Find a lesson…'}).fill('nonexistent');
  await expect(page.locator('.course-grid .lesson-card')).toHaveCount(0);
  await expect(page.getByText('No lessons found. Try another search.')).toBeVisible();
  await page.goto('/en/settings');
  await page.getByRole('button', {name: '5 minutes a day', exact: true}).click();
  await expect(page.getByRole('button', {name: '5 minutes a day', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('button', {name: '5 minutes a day', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', {name: 'Reset local progress'}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', {name: 'Keep my progress'}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', {name: '5 minutes a day', exact: true}).click();
  await page.getByRole('button', {name: 'Reset local progress'}).click();
  await page.getByRole('button', {name: 'Reset progress', exact: true}).click();
  await expect(page.getByRole('button', {name: '15 minutes a day', exact: true})).toHaveAttribute('aria-pressed', 'true');
});

test('billing stays disabled and authentication reflects the connection configuration', async ({page}) => {
  await page.goto('/en/pricing');
  await expect(page.getByRole('button', {name: 'Coming soon · payments are not enabled'})).toBeDisabled();
  await page.goto('/en/login');
  const email = page.getByLabel('Email address', {exact: true});
  if (await email.isVisible()) {
    await expect(page.getByLabel('Password', {exact: true})).toBeVisible();
    await expect(page.getByRole('button', {name: 'Sign in', exact: true})).toBeVisible();
    await expect(page.getByRole('link', {name: 'Create an account', exact: true})).toBeVisible();
  } else {
    await expect(page.getByText('Account registration and sign-in are not connected', {exact: false})).toBeVisible();
  }
  await expect(page.getByRole('link', {name: 'Explore as a guest'})).toBeVisible();
});

test('mobile navigation opens, closes, and routes to lessons', async ({page, isMobile}) => {
  test.skip(!isMobile, 'Mobile navigation only');
  await page.goto('/en');
  await page.getByRole('button', {name: 'Open navigation'}).click();
  await page.getByRole('link', {name: 'My learning', exact: true}).click();
  await expect(page).toHaveURL(/\/en\/lessons/);
  await expect(page.getByRole('button', {name: 'Open navigation'})).toHaveAttribute('aria-expanded', 'false');
});

test('unknown lessons and routes return 404', async ({page}) => {
  for (const path of ['/en/lessons/unknown-lesson', '/en/nonexistent']) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.getByText("This step isn't here yet.")).toBeVisible();
  }
});

test('all supporting pages work in both languages without overflowing', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const locale of ['en', 'ru']) {
    for (const route of ['welcome', 'lessons', 'review', 'history', 'pricing', 'settings', 'tutor', 'placement', 'login', 'register', 'verify-email', 'forgot-password', 'reset-password']) {
      const response = await page.goto(`/${locale}/${route}`);
      expect(response?.status(), `${locale}/${route}`).toBe(200);
      await expect(page.getByRole('heading', {level: 1})).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${locale}/${route}`).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});

test('account mutation endpoints reject cross-origin requests and protect guest data', async ({request}) => {
  for (const path of ['/api/auth/login', '/api/auth/register', '/api/auth/logout', '/api/progress']) {
    const response = await request.post(path, {headers: {origin: 'https://attacker.test'}, data: {}});
    expect(response.status()).toBe(403);
  }
  const response = await request.get('/api/progress');
  expect([401, 503]).toContain(response.status());
  expect(response.headers()['cache-control']).toContain('no-store');
});

test('same-origin account requests reach input validation without registering or sending email', async ({page}) => {
  await page.goto('/en/register');
  const result = await page.evaluate(async () => {
    const response = await fetch('/api/auth/register', {method: 'POST', headers: {'content-type': 'application/json'}, body: '{}'});
    return {status: response.status, data: await response.json() as {error: string}};
  });
  // A configured app rejects the empty input; an unconfigured app fails explicitly.
  expect([400, 503]).toContain(result.status);
  expect(['invalid_input', 'not_configured']).toContain(result.data.error);
});

test('the tutor provides a Russian explanation without calling a live AI', async ({page}) => {
  await page.goto('/ru/tutor');
  await page.getByRole('button', {name: 'Для чего нужна частица の?'}).click();
  await expect(page.locator('.tutor-answer')).toContainText('の связывает два существительных');
  await expect(page.locator('.mode-badge')).toContainText('ИИ не подключён');
});

test('lessons teach before practice and vocabulary includes kana readings in Russian', async ({page}) => {
  await page.goto('/en/lessons/n5-te-kudasai');
  await expect(page.getByText('See it in context')).toBeVisible();
  await expect(page.locator('.study-example')).toContainText('名前を書いてください');
  await expect(page.getByRole('radio')).toHaveCount(0);
  await page.getByRole('button', {name: 'Start practice'}).click();
  await expect(page.getByRole('radio')).toHaveCount(4);
  await page.goto('/ru/lessons/n5-people');
  await expect(page.locator('.word-table tbody tr')).toHaveCount(10);
  await expect(page.locator('.word-table')).toContainText('せんせい');
  await expect(page.locator('.word-table')).toContainText('преподаватель');
});

test('the diagnostic records a starting point without completing lessons', async ({page}) => {
  await page.goto('/en');
  await page.locator('.next-action .button').click();
  await expect(page).toHaveURL(/\/en\/placement$/);
  await page.getByRole('button', {name: 'Start the check'}).click();
  for (const question of placementQuestions) {
    const answer = question.id === 'aru-1' ? 'います' : question.answer;
    if (question.type === 'choice') await page.locator(`input[value="${answer}"]`).check();
    else await page.getByRole('textbox').fill(answer);
    await page.getByRole('button', {name: 'Check answer'}).click();
    await page.getByRole('button', {name: question.id === placementQuestions.at(-1)?.id ? 'Finish lesson' : 'Next question'}).click();
  }
  await expect(page.getByRole('heading', {level: 1})).toHaveText('Your starting point is ready.');
  await expect(page.locator('.result-next')).toContainText('Things that exist');
  await page.locator('.result-next .button').click();
  await expect(page).toHaveURL(/\/en\/lessons\/n5-arimasu$/);
  await page.goto('/en');
  await expect(page.locator('.next-action')).toContainText('Things that exist');
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem('nihongo-ai:progress:v1') ?? '{}') as {sessions: {lessonId: string}[]});
  expect(data.sessions.map(s => s.lessonId)).toEqual(['placement']);
});

test('a lesson result leads to due review rather than opening another lesson', async ({page}) => {
  await page.goto('/en');
  await page.evaluate(() => localStorage.setItem('nihongo-ai:progress:v1', JSON.stringify({
    version: 1, dailyGoal: 15, sessions: [], reviews: [{questionId: 'ka-1', step: 0, due: '2020-01-01T00:00:00.000Z'}]
  })));
  await page.goto('/en/lessons/n5-wa-desu');
  await page.getByRole('button', {name: 'Start practice'}).click();
  for (const answer of ['は', 'です']) {
    await page.locator(`input[value="${answer}"]`).check();
    await page.getByRole('button', {name: 'Check answer'}).click();
    await page.getByRole('button', {name: 'Next question'}).click();
  }
  await page.getByRole('textbox').fill('は');
  await page.getByRole('button', {name: 'Check answer'}).click();
  await page.getByRole('button', {name: 'Finish lesson'}).click();
  await expect(page.locator('.result-next .button')).toHaveAttribute('href', '/en/review');
  await page.locator('.result-next .button').click();
  await expect(page).toHaveURL(/\/en\/review$/);
  await expect(page.getByRole('button', {name: 'Start your review'})).toBeVisible();
});

test('older progress remains available and a mistake becomes a due review', async ({page}) => {
  await page.clock.install({time: new Date('2026-11-17T10:00:00Z')});
  await page.goto('/en');
  await page.evaluate(() => localStorage.setItem('nihongo-ai:progress:v1', JSON.stringify({version: 1, dailyGoal: 15, sessions: [{id: 'old-result', lessonId: 'n5-wa-desu', at: new Date().toISOString(), durationSeconds: 90, answers: [{questionId: 'wa-1', correct: false}, {questionId: 'wa-2', correct: true}, {questionId: 'wa-3', correct: true}]}], reviews: [{questionId: 'wa-1', step: 0, due: new Date(Date.now() + 600000).toISOString()}]})));
  await page.goto('/en/history');
  await expect(page.locator('tbody')).toContainText('2 / 3');
  await expect(page.locator('.weak-topics')).toContainText('Meet は and です');
  await page.goto('/en/review');
  await expect(page.getByText("You're all caught up for now.")).toBeVisible();
  await page.clock.fastForward(601000);
  await page.getByRole('button', {name: 'Start your review'}).click();
  await page.locator('input[value="は"]').check();
  await page.getByRole('button', {name: 'Check answer'}).click();
  await page.getByRole('button', {name: 'Finish lesson'}).click();
  await page.goto('/en/history');
  await expect(page.locator('.weak-topics')).toHaveCount(0);
  await page.goto('/en/review');
  await expect(page.getByText("You're all caught up for now.")).toBeVisible();
});
