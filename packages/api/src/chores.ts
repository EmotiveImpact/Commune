import { supabase } from './client';
import { calculateNextDue, getNextInRotation } from '@commune/core';
import type { ChoreFrequency } from '@commune/core';

export async function getGroupChores(groupId: string) {
  const { data, error } = await supabase
    .from('chores')
    .select('*, assigned_user:users!chores_assigned_to_fkey(id, name, avatar_url)')
    .eq('group_id', groupId)
    .eq('is_active', true)
    .order('next_due', { ascending: true });

  if (error) throw error;

  // Get latest completion for each chore
  const choreIds = (data ?? []).map((c) => c.id);
  let completionMap = new Map<string, any>();

  if (choreIds.length > 0) {
    const { data: completions } = await supabase
      .from('chore_completions')
      .select('*, completed_user:users!chore_completions_completed_by_fkey(id, name, avatar_url)')
      .in('chore_id', choreIds)
      .order('completed_at', { ascending: false });

    for (const c of completions ?? []) {
      if (!completionMap.has(c.chore_id)) {
        completionMap.set(c.chore_id, c);
      }
    }
  }

  return (data ?? []).map((chore) => ({
    ...chore,
    last_completion: completionMap.get(chore.id) ?? null,
  }));
}

export async function createChore(data: {
  group_id: string;
  title: string;
  description?: string | null;
  frequency: string;
  assigned_to?: string | null;
  rotation_order?: string[] | null;
  next_due?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: chore, error } = await supabase
    .from('chores')
    .insert({
      ...data,
      next_due: data.next_due ?? new Date().toISOString().slice(0, 10),
      created_by: user.id,
    })
    .select('*')
    .single();

  if (error) throw error;
  return chore;
}

export async function updateChore(choreId: string, updates: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('chores')
    .update(updates)
    .eq('id', choreId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteChore(choreId: string) {
  const { error } = await supabase
    .from('chores')
    .update({ is_active: false })
    .eq('id', choreId);

  if (error) throw error;
}

export async function completeChore(choreId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Insert completion
  const { error: completionError } = await supabase
    .from('chore_completions')
    .insert({ chore_id: choreId, completed_by: user.id });

  if (completionError) throw completionError;

  // Get chore to advance next_due and rotation
  const { data: chore, error: choreError } = await supabase
    .from('chores')
    .select('*')
    .eq('id', choreId)
    .single();

  if (choreError || !chore) throw choreError ?? new Error('Chore not found');

  const updates: Record<string, unknown> = {};

  // Advance next_due
  if (chore.frequency !== 'once') {
    updates.next_due = calculateNextDue(
      chore.frequency as ChoreFrequency,
      chore.next_due,
    );
  }

  // Advance rotation
  if (chore.rotation_order && Array.isArray(chore.rotation_order) && chore.rotation_order.length > 1) {
    const nextPerson = getNextInRotation(chore.rotation_order, chore.assigned_to);
    if (nextPerson) updates.assigned_to = nextPerson;
  }

  if (Object.keys(updates).length > 0) {
    await supabase.from('chores').update(updates).eq('id', choreId);
  }

  return { success: true };
}
