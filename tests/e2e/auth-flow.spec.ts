import {expect, test} from '@playwright/test';

for (const locale of ['en', 'ru']) {
  test(`mocked ${locale} recovery email limit shows a cooldown without sending automatic retries`, async ({page}) => {
    let requests = 0;
    await page.clock.install();
    await page.route('**/api/auth/recover', async route => {
      requests++;
      await route.fulfill({status: 429, json: {error: 'email_rate_limit'}});
    });
    await page.goto(`/${locale}/forgot-password`);
    test.skip(!await page.locator('input[name="email"]').isVisible(), 'Requires a configured Supabase environment; recovery is mocked.');
    await page.locator('input[name="email"]').fill('student@example.test');
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator('form').getByRole('alert')).toContainText(locale === 'en' ? 'Email sending is temporarily limited' : 'Отправка писем временно ограничена');
    await expect(page.locator('form button[type="submit"]')).toBeDisabled();
    await expect(page.locator('form').getByRole('status')).toHaveCount(0);
    await page.clock.fastForward(60000);
    await expect(page.locator('form button[type="submit"]')).toBeEnabled();
    expect(requests).toBe(1);
  });
  test(`mocked ${locale} signup opens email guidance and returns home only after server confirmation`, async ({page}) => {
    let authenticated = false;
    let registrations = 0;
    await page.route('**/api/auth/register', async route => {
      registrations++;
      await route.fulfill({json: {ok: true, confirmation: true}});
    });
    await page.route('**/api/auth/status', route => route.fulfill({json: {authenticated}}));
    await page.goto(`/${locale}/register`);
    test.skip(!await page.locator('input[name="email"]').isVisible(), 'Requires a configured Supabase environment; all registration/status calls are mocked.');
    await page.locator('input[name="email"]').fill('student@example.test');
    await page.locator('input[name="password"]').fill('a-strong-test-password');
    await page.locator('input[name="confirmPassword"]').fill('a-strong-test-password');
    await page.locator('form button[type="submit"]').click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/verify-email$`));
    await expect(page.getByRole('heading', {level: 1})).toHaveText(locale === 'en' ? 'Check your email' : 'Проверьте почту');
    await expect(page.locator('.verification-steps li')).toHaveCount(3);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    const check = page.locator('.email-verification button');
    await expect(check).toBeEnabled();
    await check.click();
    await expect(page.getByRole('status')).toContainText(locale === 'en' ? 'not complete' : 'ещё не завершено');
    await expect(page).toHaveURL(new RegExp(`/${locale}/verify-email$`));
    expect(registrations).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    authenticated = true;
    // Simulate returning from the tab where the confirmation link was opened.
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page).toHaveURL(new RegExp(`/${locale}$`));
    await expect(page.locator('.next-action')).toBeVisible();
  });
}

test('failed registration remains on the form and does not claim email was sent', async ({page}) => {
  await page.route('**/api/auth/register', route => route.fulfill({status: 400, json: {error: 'registration_failed'}}));
  await page.goto('/en/register');
  test.skip(!await page.locator('input[name="email"]').isVisible(), 'Requires a configured Supabase environment; registration is mocked.');
  await page.locator('input[name="email"]').fill('student@example.test');
  await page.locator('input[name="password"]').fill('a-strong-test-password');
  await page.locator('input[name="confirmPassword"]').fill('a-strong-test-password');
  await page.locator('form button[type="submit"]').click();
  await expect(page.locator('form').getByRole('alert')).toContainText('could not complete registration');
  await expect(page).toHaveURL(/\/en\/register$/);
});
