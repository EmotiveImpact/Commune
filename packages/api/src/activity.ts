import { supabase } from './client';
import {
  createWorkspaceBillingContext,
  type WorkspaceBillingContext,
  type WorkspaceBillingExpenseRecord,
} from './workspace-billing';

export interface ActivityEntry {
  id: string;
  group_id: string;
  user_id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  workspace_billing_context?: ActivityWorkspaceBillingContext | null;
  user: {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
  };
}

export interface ActivitySummary {
  thisMonth: number;
  mostActiveName: string;
  mostActiveCount: number;
  byType: Array<{ type: string; count: number }>;
}

export interface ActivityFeedData {
  entries: ActivityEntry[];
  total: number;
  summary: ActivitySummary;
}

export type ActivityWorkspaceBillingContext = WorkspaceBillingContext;
export type ActivityEntityFilter = 'expense' | 'payment' | 'member' | 'chore';

interface ActivityQueryOptions {
  limit?: number;
  offset?: number;
  entityTypes?: ActivityEntityFilter[];
}

interface ActivityFeedRpcResult {
  entries?: ActivityEntry[];
  total?: number;
  summary?: Partial<ActivitySummary> & {
    byType?: Array<{ type: string; count: number }>;
  };
}

type ActivitySummaryRow = {
  user_id: string;
  entity_type: string | null;
  user?:
    | { name: string | null; email: string | null }
    | Array<{ name: string | null; email: string | null }>
    | null;
};

const VALID_ACTIVITY_ENTITY_TYPES = new Set<ActivityEntityFilter>([
  'expense',
  'payment',
  'member',
  'chore',
]);

function normalizeActivityEntityTypes(entityTypes?: ActivityEntityFilter[]): ActivityEntityFilter[] {
  if (!entityTypes?.length) return [];

  return [...new Set(entityTypes)]
    .filter((entityType): entityType is ActivityEntityFilter =>
      VALID_ACTIVITY_ENTITY_TYPES.has(entityType),
    )
    .sort();
}

function getActivityUserSummary(
  user?: ActivitySummaryRow['user'],
): { name: string | null; email: string | null } | null {
  if (!user) return null;
  return Array.isArray(user) ? user[0] ?? null : user;
}

function getActivityMonthStartKey(referenceDate = new Date()): string {
  const year = referenceDate.getFullYear();
  const month = String(referenceDate.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01T00:00:00.000Z`;
}

async function attachWorkspaceBillingContext(
  entries: ActivityEntry[],
): Promise<ActivityEntry[]> {
  if (entries.length === 0) {
    return entries;
  }

  const expenseIds = [
    ...new Set(
      entries
        .filter((entry) => entry.entity_type === 'expense' && entry.entity_id)
        .map((entry) => entry.entity_id as string),
    ),
  ];
  const paymentIds = [
    ...new Set(
      entries
        .filter((entry) => entry.entity_type === 'payment' && entry.entity_id)
        .map((entry) => entry.entity_id as string),
    ),
  ];

  const paymentRows = paymentIds.length > 0
    ? await supabase
        .from('payment_records')
        .select('id, expense_id')
        .in('id', paymentIds)
    : { data: [], error: null as null };

  if (paymentRows.error) throw paymentRows.error;

  const paymentExpenseIds = new Set(
    (paymentRows.data ?? []).map((row) => row.expense_id as string),
  );
  const relatedExpenseIds = [...new Set([...expenseIds, ...paymentExpenseIds])];

  const relatedExpenses =
    relatedExpenseIds.length > 0
      ? await supabase
          .from('expenses')
          .select(
            'id, title, amount, currency, due_date, vendor_name, invoice_reference, invoice_date, payment_due_date',
          )
          .in('id', relatedExpenseIds)
      : { data: [], error: null as null };

  if (relatedExpenses.error) throw relatedExpenses.error;

  const billingByExpenseId = new Map<string, ActivityWorkspaceBillingContext>();
  for (const row of (relatedExpenses.data ?? []) as WorkspaceBillingExpenseRecord[]) {
    billingByExpenseId.set(row.id, createWorkspaceBillingContext(row));
  }

  const billingByPaymentId = new Map<string, ActivityWorkspaceBillingContext>();
  for (const row of (paymentRows.data ?? []) as Array<{ id: string; expense_id: string }>) {
    const context = billingByExpenseId.get(row.expense_id);
    if (context) {
      billingByPaymentId.set(row.id, context);
    }
  }

  return entries.map((entry) => {
    if (entry.entity_type === 'expense' && entry.entity_id) {
      return {
        ...entry,
        workspace_billing_context: billingByExpenseId.get(entry.entity_id) ?? null,
      };
    }

    if (entry.entity_type === 'payment' && entry.entity_id) {
      return {
        ...entry,
        workspace_billing_context: billingByPaymentId.get(entry.entity_id) ?? null,
      };
    }

    return entry;
  });
}

async function fetchActivityEntries(
  groupId: string,
  options: ActivityQueryOptions = {},
): Promise<{ entries: ActivityEntry[]; total: number }> {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  const entityTypes = normalizeActivityEntityTypes(options.entityTypes);

  let query = supabase
    .from('activity_log')
    .select(
      `
      *,
      user:users(id, name, email, avatar_url)
    `,
      { count: 'exact' },
    )
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (entityTypes.length === 1) {
    query = query.eq('entity_type', entityTypes[0]);
  } else if (entityTypes.length > 1) {
    query = query.in('entity_type', entityTypes);
  }

  const { data, error, count } = await query;

  if (error) throw error;

  const entries = await attachWorkspaceBillingContext((data ?? []) as ActivityEntry[]);
  return {
    entries,
    total: count ?? 0,
  };
}

async function getActivitySummary(
  groupId: string,
  entityTypes?: ActivityEntityFilter[],
): Promise<ActivitySummary> {
  const normalizedTypes = normalizeActivityEntityTypes(entityTypes);
  const monthStart = getActivityMonthStartKey();

  let query = supabase
    .from('activity_log')
    .select(
      `
      user_id,
      entity_type,
      user:users(name, email)
    `,
    )
    .eq('group_id', groupId)
    .gte('created_at', monthStart);

  if (normalizedTypes.length === 1) {
    query = query.eq('entity_type', normalizedTypes[0]);
  } else if (normalizedTypes.length > 1) {
    query = query.in('entity_type', normalizedTypes);
  }

  const { data, error } = await query;

  if (error) throw error;

  const rows = (data ?? []) as ActivitySummaryRow[];
  const byMember = new Map<string, { count: number; name: string }>();
  const byType = new Map<string, number>();

  for (const row of rows) {
    const user = getActivityUserSummary(row.user);
    const userName = user?.name ?? user?.email ?? 'Unknown';
    const existingMember = byMember.get(row.user_id) ?? { count: 0, name: userName };
    existingMember.count += 1;
    existingMember.name = existingMember.name || userName;
    byMember.set(row.user_id, existingMember);

    const entityType = row.entity_type ?? 'other';
    byType.set(entityType, (byType.get(entityType) ?? 0) + 1);
  }

  let mostActiveName = '';
  let mostActiveCount = 0;
  for (const member of byMember.values()) {
    if (member.count > mostActiveCount) {
      mostActiveCount = member.count;
      mostActiveName = member.name;
    }
  }

  return {
    thisMonth: rows.length,
    mostActiveName,
    mostActiveCount,
    byType: Array.from(byType.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export async function getActivityFeed(
  groupId: string,
  options: ActivityQueryOptions = {},
): Promise<ActivityFeedData> {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  const entityTypes = normalizeActivityEntityTypes(options.entityTypes);
  const { data, error } = await supabase.rpc('fn_get_activity_feed', {
    p_group_id: groupId,
    p_limit: limit,
    p_offset: offset,
    p_entity_types: entityTypes,
  });

  if (error) throw error;

  const result = (data ?? {}) as ActivityFeedRpcResult;
  const entries = (result.entries ?? []) as ActivityEntry[];
  const summary = result.summary;

  return {
    entries,
    total: result.total ?? 0,
    summary: {
      thisMonth: summary?.thisMonth ?? 0,
      mostActiveName: summary?.mostActiveName ?? '',
      mostActiveCount: summary?.mostActiveCount ?? 0,
      byType: summary?.byType ?? [],
    },
  };
}

export async function getActivityLog(
  groupId: string,
  limit = 50,
  offset = 0,
  entityTypes?: ActivityEntityFilter[],
): Promise<ActivityEntry[]> {
  const { entries } = await fetchActivityEntries(groupId, {
    limit,
    offset,
    entityTypes,
  });
  return entries;
}

export async function getActivityExportEntries(
  groupId: string,
  entityTypes?: ActivityEntityFilter[],
  batchSize = 200,
): Promise<ActivityEntry[]> {
  const normalizedTypes = normalizeActivityEntityTypes(entityTypes);
  const rows: ActivityEntry[] = [];
  let offset = 0;

  while (true) {
    const { entries } = await fetchActivityEntries(groupId, {
      limit: batchSize,
      offset,
      entityTypes: normalizedTypes,
    });

    rows.push(...entries);

    if (entries.length < batchSize || rows.length >= 5000) {
      break;
    }

    offset += batchSize;
  }

  return rows;
}
