import type {
  ExpenseCategory,
  GroupType,
  MemberRole,
  MemberStatus,
  PaymentProvider,
  PaymentStatus,
  RecurrenceType,
  SplitMethod,
  SubscriptionPlan,
  SubscriptionStatus,
} from './enums';

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
  description: string | null;
  owner_id: string;
  cycle_date: number;
  currency: string;
  nudges_enabled: boolean;
  created_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: MemberRole;
  status: MemberStatus;
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

export interface Expense {
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
  currency: string;
  created_by: string;
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

export type GroupInvite = GroupMember & {
  group: Group;
};

export type ExpenseWithParticipants = Expense & {
  participants: (ExpenseParticipant & { user: User })[];
  payment_records: PaymentRecord[];
  paid_by_user: User | null;
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
  currency: string;
  settlement: SettlementResult;
}

export interface CrossGroupResult {
  transactions: CrossGroupTransaction[];
  transactionCount: number;
  isSettled: boolean;
  /** Per-group settlement data before netting, so the client can show either view */
  perGroupData?: CrossGroupPerGroupData[];
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
