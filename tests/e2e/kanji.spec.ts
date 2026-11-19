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
