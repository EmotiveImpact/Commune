import type {
  GroupFund,
  GroupFundWithTotals,
  GroupFundDetails,
  FundContribution,
  FundContributionWithUser,
  FundExpense,
  FundExpenseWithUser,
} from '@commune/types';
import { supabase } from './client';

export async function getGroupFunds(groupId: string) {
  const { data: funds, error } = await supabase
    .from('group_funds')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Fetch totals for each fund
  const fundIds = (funds as GroupFund[]).map((f) => f.id);

  if (fundIds.length === 0) return [] as GroupFundWithTotals[];

  const [{ data: contributions, error: contErr }, { data: expenses, error: expErr }] =
    await Promise.all([
      supabase
        .from('fund_contributions')
        .select('fund_id, amount')
        .in('fund_id', fundIds),
      supabase
        .from('fund_expenses')
        .select('fund_id, amount')
        .in('fund_id', fundIds),
    ]);

  if (contErr) throw contErr;
  if (expErr) throw expErr;

  const contTotals: Record<string, number> = {};
  for (const c of contributions ?? []) {
    contTotals[c.fund_id] = (contTotals[c.fund_id] ?? 0) + Number(c.amount);
  }

  const expTotals: Record<string, number> = {};
  for (const e of expenses ?? []) {
    expTotals[e.fund_id] = (expTotals[e.fund_id] ?? 0) + Number(e.amount);
  }

  return (funds as GroupFund[]).map((fund) => {
    const totalContributions = contTotals[fund.id] ?? 0;
    const totalExpenses = expTotals[fund.id] ?? 0;
    return {
      ...fund,
      total_contributions: totalContributions,
      total_expenses: totalExpenses,
      balance: totalContributions - totalExpenses,
    } as GroupFundWithTotals;
  });
}

interface CreateFundData {
  group_id: string;
  name: string;
  target_amount?: number | null;
  currency: string;
}

export async function createFund(data: CreateFundData) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  const { data: fund, error } = await supabase
    .from('group_funds')
    .insert({
      group_id: data.group_id,
      name: data.name,
      target_amount: data.target_amount ?? null,
      currency: data.currency,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return fund as unknown as GroupFund;
}

export async function getFundDetails(fundId: string, groupId?: string) {
  let fundQuery = supabase
    .from('group_funds')
    .select('*')
    .eq('id', fundId);

  if (groupId) {
    fundQuery = fundQuery.eq('group_id', groupId);
  }

  const { data: fund, error: fundErr } = await fundQuery.maybeSingle();

  if (fundErr) throw fundErr;
  if (!fund) return null;

  const [{ data: contributions, error: contErr }, { data: expenses, error: expErr }] =
    await Promise.all([
      supabase
        .from('fund_contributions')
        .select('*, user:users!fund_contributions_user_id_fkey(*)')
        .eq('fund_id', fundId)
        .order('contributed_at', { ascending: false }),
      supabase
        .from('fund_expenses')
        .select('*, user:users!fund_expenses_spent_by_fkey(*)')
        .eq('fund_id', fundId)
        .order('spent_at', { ascending: false }),
    ]);

  if (contErr) throw contErr;
  if (expErr) throw expErr;

  const typedContributions = (contributions ?? []) as unknown as FundContributionWithUser[];
  const typedExpenses = (expenses ?? []) as unknown as FundExpenseWithUser[];

  const totalContributions = typedContributions.reduce(
    (sum, c) => sum + Number(c.amount),
    0,
  );
  const totalExpenses = typedExpenses.reduce(
    (sum, e) => sum + Number(e.amount),
    0,
  );

  return {
    ...(fund as unknown as GroupFund),
    contributions: typedContributions,
    expenses: typedExpenses,
    total_contributions: totalContributions,
    total_expenses: totalExpenses,
    balance: totalContributions - totalExpenses,
  } as GroupFundDetails;
}

interface AddContributionData {
  amount: number;
  note?: string;
}

export async function addContribution(fundId: string, data: AddContributionData) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  const { data: contribution, error } = await supabase
    .from('fund_contributions')
    .insert({
      fund_id: fundId,
      user_id: user.id,
      amount: data.amount,
      note: data.note ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return contribution as unknown as FundContribution;
}

interface AddFundExpenseData {
  description: string;
  amount: number;
  receipt_url?: string | null;
}

export async function addFundExpense(fundId: string, data: AddFundExpenseData) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  const { data: expense, error } = await supabase
    .from('fund_expenses')
    .insert({
      fund_id: fundId,
      description: data.description,
      amount: data.amount,
      spent_by: user.id,
      receipt_url: data.receipt_url ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return expense as unknown as FundExpense;
}

export async function deleteFund(fundId: string) {
  const { error } = await supabase
    .from('group_funds')
    .delete()
    .eq('id', fundId);

  if (error) throw error;
}
