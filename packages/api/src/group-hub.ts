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
    .order('is_default', { ascending: false });

  // Get recent activity in this group (last 20 expenses they created or participated in)
  const { data: recentActivity } = await supabase
    .from('expenses')
    .select('id, title, amount, category, due_date, created_at, paid_by_user_id')
    .eq('group_id', groupId)
    .eq('is_active', true)
    .or(`paid_by_user_id.eq.${userId}`)
    .order('due_date', { ascending: false })
    .limit(20);

  // Get shared groups (groups where both the viewer and this user are members)
  const { data: viewerSession } = await supabase.auth.getSession();
  const viewerId = viewerSession?.session?.user?.id;

  let sharedGroups: any[] = [];
  if (viewerId && viewerId !== userId) {
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

  return {
    user,
    membership,
    paymentMethods: paymentMethods || [],
    recentActivity: recentActivity || [],
    sharedGroups,
  };
}
