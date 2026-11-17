import {z} from 'zod';

const priceSchema = z.coerce.number().int().min(100).max(100000);
export function getPlusPrice(value = process.env.PLUS_PRICE_JPY): number {
  const result = priceSchema.safeParse(value ?? 980);
  return result.success ? result.data : 980;
}

export function getAppUrl(): URL {
  const result = z.url().safeParse(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000');
  return new URL(result.success ? result.data : 'http://localhost:3000');
}
