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

async function verifyAdminForExpense(expenseId: string, userId: string) {
  // Get the expense's group_id
  const { data: expense, error: expError } = await supabase
    .from('expenses')
    .select('group_id')
    .eq('id', expenseId)
    .single();

  if (expError || !expense) throw new Error('Expense not found');

  // Verify user is admin in that group
  const { data: membership, error: memError } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', expense.group_id)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (memError || !membership || membership.role !== 'admin') {
    throw new Error('Only group admins can approve or reject expenses');
  }
}

export async function approveExpense(expenseId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  await verifyAdminForExpense(expenseId, user.id);

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

  await verifyAdminForExpense(expenseId, user.id);

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
