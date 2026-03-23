import { supabase } from './client';

/**
 * Upload a group image (avatar or cover) and update the group record.
 */
export async function uploadGroupImage(
  groupId: string,
  file: File,
  type: 'avatar' | 'cover',
) {
  const ext = file.name.split('.').pop();
  const path = `${groupId}/${type}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('group-images')
    .upload(path, file, { upsert: true });

  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from('group-images').getPublicUrl(path);

  // Update group record with the new URL
  const field = type === 'avatar' ? 'avatar_url' : 'cover_url';
  const { error: updateError } = await supabase
    .from('groups')
    .update({ [field]: publicUrl })
    .eq('id', groupId);

  if (updateError) throw updateError;

  return publicUrl;
}

/**
 * Get full hub data for a group: group details, members, and this month's expense summary.
 */
export async function getGroupHub(groupId: string) {
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select(
      `
      *,
      members:group_members(
        *,
        user:users(*)
      )
    `,
    )
    .eq('id', groupId)
    .single();

  if (groupError) throw groupError;

  // Get this month's expenses for summary
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

  const { data: expenses } = await supabase
    .from('expenses')
    .select(
      'id, title, amount, category, created_at, expense_participants(user_id, share_amount)',
    )
    .eq('group_id', groupId)
    .eq('is_active', true)
    .gte('due_date', monthStart)
    .lte('due_date', monthEnd);

  // Calculate per-member monthly totals
  const memberTotals: Record<string, number> = {};
  const categoryTotals: Record<string, number> = {};

  (expenses || []).forEach((exp) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase join result
    ((exp.expense_participants as any[]) || []).forEach((p) => {
      memberTotals[p.user_id] =
        (memberTotals[p.user_id] || 0) + (p.share_amount || 0);
    });
    categoryTotals[exp.category] =
      (categoryTotals[exp.category] || 0) + exp.amount;
  });

  const totalMonthly = (expenses || []).reduce((sum, e) => sum + e.amount, 0);

  return {
    group,
    expenses: expenses || [],
    memberTotals,
    categoryTotals,
    totalMonthly,
    activeMembers: (group.members as any[]).filter(
      (m: any) => m.status === 'active',
    ).length,
  };
}

/**
 * Get member profile data within a group context.
 */
export async function getMemberProfile(userId: string, groupId: string) {
  // Get user info
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (userError) throw userError;

  // Get membership in this group
  const { data: membership } = await supabase
    .from('group_members')
    .select('*')
    .eq('user_id', userId)
    .eq('group_id', groupId)
    .single();

  // Get payment methods
  const { data: paymentMethods } = await supabase
    .from('user_payment_methods')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });

  // Get recent activity in this group (last 20 expenses they created, paid, or participated in)
  const { data: directExpenses, error: directExpensesError } = await supabase
    .from('expenses')
    .select('id, title, amount, category, due_date, created_at, paid_by_user_id, created_by')
    .eq('group_id', groupId)
    .eq('is_active', true)
    .or(`created_by.eq.${userId},paid_by_user_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(20);

  if (directExpensesError) throw directExpensesError;

  const { data: participantRows, error: participantRowsError } = await supabase
    .from('expense_participants')
    .select('expense_id')
    .eq('user_id', userId);

  if (participantRowsError) throw participantRowsError;

  const participantExpenseIds = Array.from(
    new Set((participantRows ?? []).map((row) => row.expense_id as string)),
  );

  let participantExpenses: Array<Record<string, unknown>> = [];
  if (participantExpenseIds.length > 0) {
    const { data, error } = await supabase
      .from('expenses')
      .select('id, title, amount, category, due_date, created_at, paid_by_user_id, created_by')
      .in('id', participantExpenseIds)
      .eq('group_id', groupId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    participantExpenses = (data ?? []) as Array<Record<string, unknown>>;
  }

  const recentActivityMap = new Map<string, Record<string, unknown>>();
  for (const activity of directExpenses ?? []) {
    recentActivityMap.set(activity.id as string, activity as Record<string, unknown>);
  }
  for (const activity of participantExpenses) {
    const activityId = activity.id as string;
    if (!recentActivityMap.has(activityId)) {
      recentActivityMap.set(activityId, activity);
    }
  }

  const recentActivity = Array.from(recentActivityMap.values())
    .sort((a, b) => {
      const aTime = new Date(String(a.created_at ?? '')).getTime();
      const bTime = new Date(String(b.created_at ?? '')).getTime();
      return bTime - aTime;
    })
    .slice(0, 20);

  // Get shared groups (groups where both the viewer and this user are members)
  const { data: viewerSession } = await supabase.auth.getSession();
  const viewerId = viewerSession?.session?.user?.id;

  let sharedGroups: any[] = [];
  if (viewerId && viewerId !== userId) {
    // Check if the target user allows shared group visibility
    const { data: targetUser } = await supabase
      .from('users')
      .select('show_shared_groups')
      .eq('id', userId)
      .single();

    if (targetUser?.show_shared_groups === false) {
      // User has opted out of showing shared groups
      sharedGroups = [];
    } else {
    // Get all groups for this user
    const { data: userGroups } = await supabase
      .from('group_members')
      .select('group_id, groups(id, name, type)')
      .eq('user_id', userId)
      .eq('status', 'active');

    // Get all groups for the viewer
    const { data: viewerGroups } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', viewerId)
      .eq('status', 'active');

    const viewerGroupIds = new Set(
      (viewerGroups || []).map((g) => g.group_id),
    );
    sharedGroups = (userGroups || [])
      .filter((g) => viewerGroupIds.has(g.group_id))
      .map((g) => g.groups);
    }
  }

  return {
    user,
    membership,
    paymentMethods: paymentMethods || [],
    recentActivity: recentActivity || [],
    sharedGroups,
  };
}
