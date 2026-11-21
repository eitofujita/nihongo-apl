import {readFileSync} from 'node:fs';
import {expect, test, type Page} from '@playwright/test';
import type {SentenceExercise} from '../../src/content/sentences';

const n5 = JSON.parse(readFileSync('public/sentences/n5.json', 'utf8')) as SentenceExercise[];

async function currentExercise(page: Page): Promise<SentenceExercise> {
  const translation = (await page.locator('.sentence-translation').textContent())!.trim();
  const pool = (await page.getByRole('group', {name: 'Phrases to use'}).getByRole('button').allTextContents()).sort();
  return n5.find(e => e.translations.en === translation && JSON.stringify(e.chunks.map(c => c.text).sort()) === JSON.stringify(pool))!;
}

async function place(page: Page, texts: string[]) {
  const pool = page.getByRole('group', {name: 'Phrases to use'});
  for (const text of texts) await pool.getByRole('button', {name: text, exact: true}).first().click();
}

test('sentences are built from phrases, graded, and wrong orders show the model sentence', async ({page}) => {
  await page.goto('/en/sentences');
  await expect(page.getByRole('heading', {name: 'Sentence building'})).toBeVisible();
  await page.getByRole('button', {name: /^Start 10 sentences/}).click();
  await expect(page.getByText('Question 1 of 10')).toBeVisible();

  const first = await currentExercise(page);
  expect(first).toBeTruthy();
  await expect(page.getByRole('button', {name: 'Check'})).toBeDisabled();
  const texts = first.chunks.map(c => c.text);
  await place(page, texts.slice(0, 1));
  // A placed phrase can be taken back.
  await page.getByRole('button', {name: `Remove ${texts[0]}`}).click();
  await place(page, texts);
  await page.getByRole('button', {name: 'Check'}).click();
  await expect(page.getByRole('status')).toContainText('Correct!');
  await page.getByRole('button', {name: 'Next question'}).click();

  await expect(page.getByText('Question 2 of 10')).toBeVisible();
  const second = await currentExercise(page);
  const texts2 = second.chunks.map(c => c.text);
  const wrong = [...texts2.slice(1), texts2[0]]; // Rotating always changes the sentence (chunks are never all the same).
  await place(page, wrong);
  await page.getByRole('button', {name: 'Check'}).click();
  await expect(page.getByRole('status')).toContainText('Not quite');
  await expect(page.getByRole('status')).toContainText(second.japanese);
});
