import { supabase } from './client';

export interface ActivityEntry {
  id: string;
  group_id: string;
  user_id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
  };
}

export async function getActivityLog(
  groupId: string,
  limit = 50,
  offset = 0,
): Promise<ActivityEntry[]> {
  const { data, error } = await supabase
    .from('activity_log')
    .select(
      `
      *,
      user:users(id, name, email, avatar_url)
    `,
    )
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data as unknown as ActivityEntry[];
}
