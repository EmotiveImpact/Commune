// ─── F38: Couple Mode — Link / Unlink Members API ──────────────────────────

import type { LinkedPair } from '@commune/types';
import { supabase } from './client';

/**
 * Link two group members as a couple. Creates a bidirectional reference
 * so their balances are merged during settlement calculation.
 *
 * @param memberIdA - group_members.id of the first member
 * @param memberIdB - group_members.id of the second member
 */
export async function linkMembers(
  memberIdA: string,
  memberIdB: string,
): Promise<void> {
  if (memberIdA === memberIdB) {
    throw new Error('Cannot link a member to themselves');
  }

  // Verify both members are in the same group and active
  const { data: members, error } = await supabase
    .from('group_members')
    .select('id, group_id, user_id, status, linked_partner_id')
    .in('id', [memberIdA, memberIdB]);

  if (error) throw error;
  if (!members || members.length !== 2) {
    throw new Error('One or both members not found');
  }

  const [a, b] = members;
  if (a!.group_id !== b!.group_id) {
    throw new Error('Members must be in the same group');
  }
  if (a!.status !== 'active' || b!.status !== 'active') {
    throw new Error('Both members must be active');
  }
  if (a!.linked_partner_id || b!.linked_partner_id) {
    throw new Error('One or both members are already linked to a partner');
  }

  // Create bidirectional link
  const { error: updateError1 } = await supabase
    .from('group_members')
    .update({ linked_partner_id: memberIdB })
    .eq('id', memberIdA);

  if (updateError1) throw updateError1;

  const { error: updateError2 } = await supabase
    .from('group_members')
    .update({ linked_partner_id: memberIdA })
    .eq('id', memberIdB);

  if (updateError2) throw updateError2;
}

/**
 * Unlink two group members, restoring individual settlement.
 *
 * @param memberIdA - group_members.id of the first member
 * @param memberIdB - group_members.id of the second member
 */
export async function unlinkMembers(
  memberIdA: string,
  memberIdB: string,
): Promise<void> {
  const { error: e1 } = await supabase
    .from('group_members')
    .update({ linked_partner_id: null })
    .eq('id', memberIdA);

  if (e1) throw e1;

  const { error: e2 } = await supabase
    .from('group_members')
    .update({ linked_partner_id: null })
    .eq('id', memberIdB);

  if (e2) throw e2;
}

/**
 * Get all linked pairs for a group. Returns pairs of user IDs (not member IDs)
 * for use with the settlement algorithm.
 *
 * @param groupId - The group to query
 * @returns Array of linked user-id pairs
 */
export async function getLinkedPairs(groupId: string): Promise<LinkedPair[]> {
  const { data: members, error } = await supabase
    .from('group_members')
    .select('id, user_id, linked_partner_id')
    .eq('group_id', groupId)
    .eq('status', 'active')
    .not('linked_partner_id', 'is', null);

  if (error) throw error;
  if (!members || members.length === 0) return [];

  // Deduplicate: each pair appears twice (A→B and B→A)
  const seen = new Set<string>();
  const pairs: LinkedPair[] = [];

  for (const m of members) {
    const partnerId = m.linked_partner_id as string;
    const key = [m.id, partnerId].sort().join('::');

    if (seen.has(key)) continue;
    seen.add(key);

    // Find the partner to get their user_id
    const partner = members.find((p) => p.id === partnerId);
    if (!partner) continue;

    pairs.push({
      userIdA: m.user_id as string,
      userIdB: partner.user_id as string,
    });
  }

  return pairs;
}
