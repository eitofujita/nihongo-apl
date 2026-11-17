import {z} from 'zod';

type ConfigInput = {url?: string; key?: string};
export function getSupabaseConfig(input: ConfigInput = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
}): {url: string; key: string} | null {
  const result = z.object({url: z.url(), key: z.string().min(10)}).safeParse(input);
  if (!result.success) return null;
  const {url, key} = result.data;
  const parsed = new URL(url);
  if (parsed.username || parsed.password || parsed.search || parsed.hash) return null;
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname))) return null;
  if (key.startsWith('sb_secret_')) return null;
  if (!key.startsWith('sb_publishable_')) {
    try {
      const payload: unknown = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
      if (!z.object({role: z.literal('anon')}).safeParse(payload).success) return null;
    } catch {return null;}
  }
  return {url, key};
}
