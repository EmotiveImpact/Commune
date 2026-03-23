import { supabase } from './client';

export async function getPendingApprovals(groupId: string) {
  const { data, error } = await supabase
    .from('expenses')
    .select('*, paid_by:users!expenses_paid_by_user_id_fkey(id, name, avatar_url), created_by_user:users!expenses_created_by_fkey(id, name)')
    .eq('group_id', groupId)
    .eq('approval_status', 'pending')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function approveExpense(expenseId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('expenses')
    .update({
      approval_status: 'approved',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq('id', expenseId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function rejectExpense(expenseId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('expenses')
    .update({
      approval_status: 'rejected',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq('id', expenseId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}
