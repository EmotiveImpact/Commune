import type {
  ExpenseCategory,
  GroupType,
  MemberRole,
  MemberStatus,
  OperationCategory,
  OperationTaskType,
  PaymentProvider,
  PaymentStatus,
  RecurrenceType,
  SplitMethod,
  SubscriptionPlan,
  SubscriptionStatus,
} from './enums';

export interface SpaceEssentialValue {
  label: string;
  value: string;
  visible: boolean;
}

export type SpaceEssentials = Record<string, SpaceEssentialValue>;

export interface SetupChecklistProgressItem {
  label: string;
  completed: boolean;
  completed_at: string | null;
}

export type SetupChecklistProgress = Record<string, SetupChecklistProgressItem>;

export interface ExpenseVendorInvoiceContext {
  vendor_name: string | null;
  invoice_reference: string | null;
  invoice_date: string | null;
  payment_due_date: string | null;
}

export interface WorkspaceRolePreset {
  key: string;
  label: string;
  description: string | null;
  responsibility_label: string | null;
  can_approve: boolean;
  is_default: boolean;
}

export interface GroupApprovalPolicy {
  threshold: number | null;
  allowed_roles: MemberRole[];
  allowed_labels: string[];
  role_presets: WorkspaceRolePreset[];
}

// ─── Base database models ───────────────────────────────────────────────────

export interface User {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  email: string;
  avatar_url: string | null;
  phone: string | null;
  country: string | null;
  default_currency: string;
  timezone: string;
  show_shared_groups: boolean;
  is_deactivated: boolean;
  deletion_requested_at: string | null;
  deletion_scheduled_for: string | null;
  created_at: string;
}

export interface UserPaymentMethod {
  id: string;
  user_id: string;
  provider: PaymentProvider;
  label: string | null;
  payment_link: string | null;
  payment_info: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: string;
  name: string;
  type: GroupType;
  subtype: string | null;
  description: string | null;
  owner_id: string;
  cycle_date: number;
  currency: string;
  nudges_enabled: boolean;
  pinned_message: string | null;
  house_info: Record<string, string> | null;
  space_essentials: SpaceEssentials | null;
  setup_checklist_progress: SetupChecklistProgress | null;
  approval_threshold: number | null;
  approval_policy: GroupApprovalPolicy | null;
  avatar_url: string | null;
  cover_url: string | null;
  tagline: string | null;
  created_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: MemberRole;
  status: MemberStatus;
  responsibility_label: string | null;
  joined_at: string;
  linked_partner_id: string | null;
  effective_from: string | null;
  effective_until: string | null;
}

export interface LinkedPartnerInfo {
  memberId: string;
  userId: string;
  userName: string;
}

export interface Expense extends ExpenseVendorInvoiceContext {
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  due_date: string;
  recurrence_type: RecurrenceType;
  recurrence_interval: number;
  paid_by_user_id: string | null;
  split_method: SplitMethod;
  is_active: boolean;
  receipt_url: string | null;
  approval_status: 'approved' | 'pending' | 'rejected';
  approved_by: string | null;
  approved_at: string | null;
  flagged_by: string[];
  flagged_reason: string | null;
  flagged_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseParticipant {
  id: string;
  expense_id: string;
  user_id: string;
  share_amount: number;
  share_percentage: number | null;
  created_at: string;
}

export interface PaymentRecord {
  id: string;
  expense_id: string;
  user_id: string;
  amount: number;
  status: PaymentStatus;
  paid_at: string | null;
  confirmed_by: string | null;
  note: string | null;
  created_at: string;
}

export interface Chore {
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  category: OperationCategory;
  task_type: OperationTaskType;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'once';
  assigned_to: string | null;
  rotation_order: string[] | null;
  checklist_items: string[] | null;
  escalation_days: number | null;
  next_due: string;
  created_by: string;
  is_active: boolean;
  created_at: string;
}

export interface ChoreCompletion {
  id: string;
  chore_id: string;
  completed_by: string;
  completed_at: string;
}

export type ChoreWithDetails = Chore & {
  assigned_user?: { id: string; name: string; avatar_url: string | null } | null;
  last_completion?: ChoreCompletion | null;
};

export interface GroupMemory {
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  photo_url: string | null;
  memory_date: string | null;
  created_by: string;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  trial_ends_at: string;
  current_period_start: string;
  current_period_end: string;
  created_at: string;
}

export interface SplitTemplate {
  id: string;
  group_id: string;
  name: string;
  split_method: SplitMethod;
  participants: {
    user_id: string;
    percentage?: number;
    amount?: number;
  }[];
  created_by: string;
  created_at: string;
}

export interface GroupBudget {
  id: string;
  group_id: string;
  month: string;
  budget_amount: number;
  category_budgets: Record<string, number> | null;
  alert_threshold: number;
  currency: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface GroupCycleClosure {
  id: string;
  group_id: string;
  cycle_start: string;
  cycle_end: string;
  closed_by: string;
  closed_at: string;
  notes: string | null;
  reopened_at: string | null;
  reopened_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Group Fund types ───────────────────────────────────────────────────────

export interface GroupFund {
  id: string;
  group_id: string;
  name: string;
  target_amount: number | null;
  currency: string;
  created_by: string;
  created_at: string;
}

export interface FundContribution {
  id: string;
  fund_id: string;
  user_id: string;
  amount: number;
  contributed_at: string;
  note: string | null;
}

export interface FundExpense {
  id: string;
  fund_id: string;
  description: string;
  amount: number;
  spent_by: string;
  spent_at: string;
  receipt_url: string | null;
}

// ─── Joined / computed types ────────────────────────────────────────────────

export type GroupWithMembers = Group & {
  members: (GroupMember & { user: User })[];
};

export type GroupSummary = Pick<
  Group,
  | 'id'
  | 'name'
  | 'type'
  | 'subtype'
  | 'avatar_url'
  | 'currency'
  | 'approval_policy'
> & {
  active_member_count: number;
};

export type GroupInvite = GroupMember & {
  group: Group;
};

export type ExpenseWithParticipants = Expense & {
  participants: (ExpenseParticipant & { user: User })[];
  payment_records: PaymentRecord[];
  paid_by_user: User | null;
};

export type ExpenseListItem = Pick<
  Expense,
  | 'id'
  | 'title'
  | 'category'
  | 'amount'
  | 'currency'
  | 'due_date'
  | 'approval_status'
  | 'recurrence_type'
  | 'vendor_name'
  | 'invoice_reference'
  | 'invoice_date'
  | 'payment_due_date'
> & {
  participants: Pick<ExpenseParticipant, 'user_id'>[];
  payment_records: Pick<PaymentRecord, 'status'>[];
};

export interface ProrationInfo {
  daysPresent: number;
  totalDays: number;
  ratio: number;
}

export interface BreakdownItem {
  expense: Expense;
  share_amount: number;
  payment_status: PaymentStatus;
  paid_by_user: User | null;
  proration: ProrationInfo | null;
}

export interface MonthlyBreakdown {
  month: string;
  total_owed: number;
  total_paid: number;
  remaining: number;
  items: BreakdownItem[];
}

export interface GroupInviteRecord {
  id: string;
  group_id: string;
  email: string;
  token: string;
  invited_by: string;
  status: 'pending' | 'accepted' | 'expired';
  expires_at: string;
  created_at: string;
}

export interface InviteValidation {
  invite_id: string;
  group_id: string;
  group_name: string;
  email: string;
  invited_by_name: string;
  status: string;
  expires_at: string;
}

export interface DashboardStats {
  total_spend: number;
  your_share: number;
  amount_paid: number;
  amount_remaining: number;
  overdue_count: number;
  upcoming_items: ExpenseWithParticipants[];
}

export interface DashboardUpcomingExpenseItem {
  id: string;
  title: string;
  amount: number;
  currency: string;
  due_date: string;
  user_share: number;
}

export interface DashboardSummaryStats {
  total_spend: number;
  your_share: number;
  amount_paid: number;
  amount_remaining: number;
  overdue_count: number;
  upcoming_items: DashboardUpcomingExpenseItem[];
}

export interface DashboardTrendItem {
  month: string;
  total: number;
}

export interface DashboardCategoryBreakdownItem {
  category: string;
  amount: number;
  percent: number;
}

export interface DashboardRecentExpenseItem {
  id: string;
  title: string;
  category: string;
  amount: number;
  due_date: string;
  unpaid_count: number;
}

export interface DashboardSummaryBudget {
  budget_amount: number;
  category_budgets: Record<string, number> | null;
  alert_threshold: number;
}

export interface DashboardSummary {
  expense_count: number;
  current_month_total: number;
  stats: DashboardSummaryStats | null;
  budget: DashboardSummaryBudget | null;
  trend: DashboardTrendItem[];
  category_breakdown: DashboardCategoryBreakdownItem[];
  current_month_category_totals: Record<string, number>;
  recent_expenses: DashboardRecentExpenseItem[];
}

export interface GroupCycleExpenseStatus {
  id: string;
  title: string;
  amount: number;
  currency: string;
  due_date: string;
  category: ExpenseCategory;
  approval_status: 'approved' | 'pending' | 'rejected';
  unpaid_participants: number;
  remaining_amount: number;
}

export interface GroupCycleMemberBalance {
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  total_share: number;
  paid_amount: number;
  remaining_amount: number;
  overdue_expense_count: number;
}

export interface GroupCycleSummary {
  group_id: string;
  cycle_date: number;
  cycle_start: string;
  cycle_end: string;
  cycle_end_exclusive: string;
  is_closed: boolean;
  closure: GroupCycleClosure | null;
  total_expenses: number;
  approved_expense_count: number;
  pending_expense_count: number;
  total_spend: number;
  total_outstanding: number;
  overdue_expense_count: number;
  unpaid_expense_count: number;
  member_balances: GroupCycleMemberBalance[];
  expenses: GroupCycleExpenseStatus[];
}

export interface GroupLifecycleMember {
  member_id: string;
  user_id: string;
  user_name: string;
  email: string;
  avatar_url: string | null;
  role: MemberRole;
  status: MemberStatus;
  effective_from: string | null;
  effective_until: string | null;
  is_owner: boolean;
  scheduled_departure: boolean;
  proration: ProrationInfo | null;
}

export interface GroupLifecycleSummary {
  group_id: string;
  cycle_date: number;
  cycle_start: string;
  cycle_end: string;
  cycle_end_exclusive: string;
  active_member_count: number;
  admin_count: number;
  owner_transition_required: boolean;
  members: GroupLifecycleMember[];
  joiners_this_cycle: GroupLifecycleMember[];
  departures_this_cycle: GroupLifecycleMember[];
  scheduled_departures: GroupLifecycleMember[];
  proration_members: GroupLifecycleMember[];
}

// ─── Settlement types ───────────────────────────────────────────────────────

export interface SettlementTransaction {
  fromUserId: string;
  toUserId: string;
  amount: number;
  fromUserName?: string;
  toUserName?: string;
  /** Payment link for the payee (creditor), if they have one configured */
  paymentLink?: string | null;
  paymentProvider?: PaymentProvider | null;
}

export interface SettlementResult {
  transactions: SettlementTransaction[];
  transactionCount: number;
  isSettled: boolean;
}

export interface SettlementParticipantRollup {
  userId: string;
  shareAmount: number;
}

export interface SettlementInputRollup {
  payerId: string;
  participants: SettlementParticipantRollup[];
}

export interface GroupSettlementRollup {
  groupId: string;
  groupName: string;
  groupType: string;
  currency: string;
  settlementInputs: SettlementInputRollup[];
  linkedPairs: LinkedPair[];
}

// ─── Cross-Group Settlement types ────────────────────────────────────────────

export interface GroupSettlementInput {
  groupId: string;
  groupName: string;
  currency: string;
  settlements: SettlementTransaction[];
}

export interface CrossGroupTransaction {
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  netAmount: number;
  currency: string;
  groups: string[];
  paymentLink?: string | null;
  paymentProvider?: PaymentProvider | null;
}

export interface CrossGroupPerGroupData {
  groupId: string;
  groupName: string;
  groupType: string;
  currency: string;
  settlement: SettlementResult;
}

export interface CrossGroupGroupSummary {
  groupId: string;
  groupName: string;
  groupType: string;
  currency: string;
  transactionCount: number;
  owesAmount: number;
  owedAmount: number;
  waitingCount: number;
}

export interface CrossGroupResult {
  transactions: CrossGroupTransaction[];
  transactionCount: number;
  isSettled: boolean;
  /** Per-group settlement data before netting, so the client can show either view */
  perGroupData?: CrossGroupPerGroupData[];
}

export interface CrossGroupOverviewResult {
  transactions: CrossGroupTransaction[];
  transactionCount: number;
  isSettled: boolean;
  groupSummaries: CrossGroupGroupSummary[];
}

// ─── Couple Mode types ───────────────────────────────────────────────────────

export interface LinkedPair {
  userIdA: string;
  userIdB: string;
}

// ─── Fund computed types ────────────────────────────────────────────────────

export type FundContributionWithUser = FundContribution & {
  user: User;
};

export type FundExpenseWithUser = FundExpense & {
  user: User;
};

export type GroupFundWithTotals = GroupFund & {
  total_contributions: number;
  total_expenses: number;
  balance: number;
};

export type GroupFundDetails = GroupFund & {
  contributions: FundContributionWithUser[];
  expenses: FundExpenseWithUser[];
  total_contributions: number;
  total_expenses: number;
  balance: number;
};
