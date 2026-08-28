import { supabase } from './client';

export async function getGroupMemories(groupId: string) {
  const { data, error } = await supabase
    .from('group_memories')
    .select('*, creator:users!created_by(id, name, avatar_url)')
    .eq('group_id', groupId)
    .order('memory_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function addMemory(data: {
  group_id: string;
  title: string;
  description?: string;
  memory_date?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: memory, error } = await supabase
    .from('group_memories')
    .insert({
      group_id: data.group_id,
      title: data.title,
      description: data.description || null,
      memory_date: data.memory_date || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return memory;
}

export async function deleteMemory(memoryId: string) {
  const { error } = await supabase
    .from('group_memories')
    .delete()
    .eq('id', memoryId);

  if (error) throw error;
}
