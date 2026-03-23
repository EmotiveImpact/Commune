import type { GroupBudget } from '@commune/types';
import { supabase } from './client';

export async function getGroupBudget(groupId: string, month: string) {
  const { data, error } = await supabase
    .from('group_budgets')
    .select('*')
    .eq('group_id', groupId)
    .eq('month', `${month}-01`)
    .maybeSingle();

  if (error) throw error;
  return data as GroupBudget | null;
}

export async function setGroupBudget(
  groupId: string,
  month: string,
  amount: number,
  categoryBudgets?: Record<string, number> | null,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  // Upsert: insert or update the budget for the given group+month
  const { data, error } = await supabase
    .from('group_budgets')
    .upsert(
      {
        group_id: groupId,
        month: `${month}-01`,
        budget_amount: amount,
        category_budgets: categoryBudgets ?? null,
        created_by: user.id,
      },
      { onConflict: 'group_id,month' },
    )
    .select()
    .single();

  if (error) throw error;
  return data as GroupBudget;
}

export async function getBudgetHistory(groupId: string) {
  const { data, error } = await supabase
    .from('group_budgets')
    .select('*')
    .eq('group_id', groupId)
    .order('month', { ascending: false });

  if (error) throw error;
  return data as GroupBudget[];
}

export async function deleteGroupBudget(groupId: string, month: string) {
  const { error } = await supabase
    .from('group_budgets')
    .delete()
    .eq('group_id', groupId)
    .eq('month', `${month}-01`);

  if (error) throw error;
}
