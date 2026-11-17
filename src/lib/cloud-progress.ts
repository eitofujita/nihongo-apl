import 'server-only';
import {progressSchema, type Progress} from './progress';
import {ApiError} from './api-security';
import type {AuthClient} from './supabase/server';

export async function loadCloudProgress(client: AuthClient): Promise<Progress> {
  const {data, error} = await client.rpc('get_learning_progress', {});
  if (error) throw new ApiError(503, 'storage_unavailable');
  const parsed = progressSchema.safeParse(data);
  if (!parsed.success) throw new ApiError(503, 'storage_unavailable');
  return parsed.data;
}
