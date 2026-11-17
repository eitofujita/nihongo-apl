import {describe, expect, it} from 'vitest';
import en from '../messages/en.json';
import ru from '../messages/ru.json';

describe('English and Russian UI translations', () => {
  it('contain exactly the same translation keys', () => {
    expect(Object.keys(ru.App).sort()).toEqual(Object.keys(en.App).sort());
  });
  it('have no empty translations or inconsistent ICU parameters', () => {
    for (const key of Object.keys(en.App) as (keyof typeof en.App)[]) {
      expect(ru.App[key].trim(), key).not.toBe('');
      expect(en.App[key].trim(), key).not.toBe('');
      const args = (message: string) => [...message.matchAll(/\{(\w+)(?:,|\})/g)].map(match => match[1]).sort();
      expect(args(ru.App[key]), key).toEqual(args(en.App[key]));
    }
  });
});
