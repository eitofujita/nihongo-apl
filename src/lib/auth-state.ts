import 'server-only';
import {createSupabaseServerClient} from './supabase/server';
import {getSupabaseConfig} from './supabase/config';
import {loadCloudProgress} from './cloud-progress';
import type {Progress} from './progress';

export type AccountState = {
  configured: boolean;
  user: {id: string; email: string} | null;
  progress: Progress | null;
  loadError: boolean;
};
export async function getAccountState(): Promise<AccountState> {
  if (!getSupabaseConfig()) return {configured: false, user: null, progress: null, loadError: false};
  const client = await createSupabaseServerClient();
  if (!client) return {configured: false, user: null, progress: null, loadError: false};
  try {
    const {data, error} = await client.auth.getUser();
    if (!data.user) return {configured: true, user: null, progress: null, loadError: Boolean(error && error.status && error.status >= 500)};
    const user = {id: data.user.id, email: data.user.email ?? ''};
    try {return {configured: true, user, progress: await loadCloudProgress(client), loadError: false};}
    catch {return {configured: true, user, progress: null, loadError: true};}
  } catch {return {configured: true, user: null, progress: null, loadError: true};}
}
