import {expect, test, type Page} from '@playwright/test';

// Draws a stroke on the writing pad from KanjiVG-box coordinates (0–109).
async function draw(page: Page, points: [number, number][]) {
  const box = (await page.getByRole('img', {name: /Writing area/}).boundingBox())!;
  const at = ([x, y]: [number, number]) => [box.x + x / 109 * box.width, box.y + y / 109 * box.height] as const;
  await page.mouse.move(...at(points[0]));
  await page.mouse.down();
  for (const point of points.slice(1)) await page.mouse.move(...at(point), {steps: 4});
  await page.mouse.up();
}
const line = (from: [number, number], to: [number, number], steps = 10) =>
  Array.from({length: steps + 1}, (_, i) => [from[0] + (to[0] - from[0]) * i / steps, from[1] + (to[1] - from[1]) * i / steps] as [number, number]);

test('practising a kanji by handwriting grades strokes and saves progress', async ({page}) => {
  await page.goto('/en/kanji');
  await expect(page.getByRole('heading', {name: 'Kanji writing'})).toBeVisible();
  await page.getByRole('link', {name: /^一/}).click();
  await expect(page.getByRole('heading', {name: 'one'})).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Stroke 1 of 1');

  // 一 is written left to right; right to left is a direction mistake.
  await draw(page, line([88, 53], [12, 53]));
  await expect(page.getByRole('status')).toContainText('Check the direction');
  await draw(page, line([12, 54], [90, 52]));
  await expect(page.getByRole('status')).toHaveText('Well done! 1 mistake.');

  await page.getByRole('button', {name: 'Next: Write'}).click();
  await expect(page.getByRole('button', {name: 'Write', pressed: true})).toBeVisible();
  await page.getByRole('link', {name: 'All kanji'}).click();
  await expect(page.getByRole('link', {name: /^一/})).toContainText('Traced');
});

test('writing strokes out of order is caught', async ({page}) => {
  await page.goto('/en/kanji/04e09'); // 三
  await draw(page, line([20, 82], [90, 80])); // Bottom line first.
  await expect(page.getByRole('status')).toContainText('later stroke');
  await expect(page.getByRole('status')).not.toContainText('Stroke 2');
});

test('a kanji page shows how it is used, and hides the kanji while writing from memory', async ({page}) => {
  await page.goto('/en/kanji/065e5'); // 日
  const usage = page.getByRole('region', {name: 'How it’s used'});
  await expect(usage.getByText('今日', {exact: true})).toBeVisible();
  await expect(usage.getByText('every day', {exact: true})).toBeVisible();
  await expect(usage.getByText('Example sentences')).toBeVisible();

  await page.getByRole('button', {name: 'From memory'}).click();
  await expect(usage.getByText('今□', {exact: true})).toBeVisible();
  await expect(usage).not.toContainText('今日');
});

test('a self-chosen kanji test grades each answer and lets you retest misses', async ({page}) => {
  await page.goto('/en/kanji');
  await page.getByRole('link', {name: 'Test yourself'}).click();
  await expect(page.getByRole('heading', {name: 'Kanji test'})).toBeVisible();
  const start = page.getByRole('button', {name: /^Start test/});
  await expect(start).toBeDisabled();
  await page.getByRole('button', {name: /^一/}).click();
  await expect(page.getByRole('button', {name: /^一/})).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('1 kanji selected')).toBeVisible();
  await start.click();

  // The kanji is hidden: only its meaning and readings are given.
  await expect(page.getByText('Question 1 of 1')).toBeVisible();
  await expect(page.getByRole('heading', {name: 'one'})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Show stroke order'})).toHaveCount(0);
  await page.getByRole('button', {name: 'I don’t know'}).click();
  await expect(page.getByRole('status')).toContainText('The answer is 一');
  await page.getByRole('button', {name: 'See results'}).click();
  await expect(page.getByText('0 / 1 correct')).toBeVisible();

  await page.getByRole('button', {name: 'Retest missed (1)'}).click();
  await draw(page, line([12, 54], [90, 52]));
  await expect(page.getByRole('status')).toHaveText('Correct! No mistakes.');
  await page.getByRole('button', {name: 'See results'}).click();
  await expect(page.getByText('1 / 1 correct')).toBeVisible();
  await page.getByRole('link', {name: 'All kanji'}).click();
  await expect(page.getByRole('link', {name: /^一/})).toContainText('From memory');
});

test('practising a missed kanji returns to the same test and lets you continue', async ({page}) => {
  await page.goto('/en/kanji/test');
  await page.getByRole('button', {name: /^一/}).click();
  await page.getByRole('button', {name: /^二/}).click();
  await page.getByRole('button', {name: /^Start test/}).click();
  await expect(page.getByText('Question 1 of 2')).toBeVisible();
  await page.getByRole('button', {name: 'I don’t know'}).click();
  const answer = await page.getByRole('status').textContent();

  // Practice happens in place; the test is not lost.
  await page.getByRole('button', {name: 'Practice this kanji'}).click();
  await expect(page.getByRole('button', {name: 'Show stroke order'})).toBeVisible();
  await page.getByRole('button', {name: 'Back to the test'}).first().click();
  await expect(page.getByText('Question 1 of 2')).toBeVisible();
  await expect(page.getByRole('status')).toHaveText(answer!);
  await page.getByRole('button', {name: 'Next question'}).click();
  await expect(page.getByText('Question 2 of 2')).toBeVisible();
});

test('kanji can be searched by meaning, reading or romaji, also when choosing a test', async ({page}) => {
  await page.goto('/en/kanji');
  const search = page.getByRole('searchbox', {name: 'Search kanji'});
  await search.fill('mizu');
  await expect(page.getByText(/kanji found/)).toBeVisible();
  await expect(page.getByRole('link', {name: /^水/})).toBeVisible();
  await expect(page.getByRole('link', {name: /^一/})).toHaveCount(0);

  await search.fill('学校');
  await expect(page.getByText('2 kanji found')).toBeVisible();
  await search.fill('zzzz');
  await expect(page.getByText(/No kanji match “zzzz”/)).toBeVisible();
  await page.getByRole('button', {name: 'Clear search'}).click();
  await expect(page.getByRole('link', {name: /^一/})).toBeVisible();

  await page.goto('/en/kanji/test');
  await page.getByRole('searchbox', {name: 'Search kanji'}).fill('water');
  await page.getByRole('button', {name: /^水/}).click();
  await page.getByRole('searchbox', {name: 'Search kanji'}).fill('');
  await expect(page.getByText('1 kanji selected')).toBeVisible();
});
