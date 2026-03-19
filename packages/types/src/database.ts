import type {
  ExpenseCategory,
  GroupType,
  MemberRole,
  MemberStatus,
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
  payment_info: string | null;
  default_currency: string;
  timezone: string;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  type: GroupType;
  description: string | null;
  owner_id: string;
  cycle_date: number;
  currency: string;
  created_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: MemberRole;
  status: MemberStatus;
  joined_at: string;
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
  stripe_customer_id: string;
  stripe_subscription_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  trial_ends_at: string;
  current_period_start: string;
  current_period_end: string;
  created_at: string;
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

export interface BreakdownItem {
  expense: Expense;
  share_amount: number;
  payment_status: PaymentStatus;
  paid_by_user: User | null;
}

export interface MonthlyBreakdown {
  month: string;
  total_owed: number;
  total_paid: number;
  remaining: number;
  items: BreakdownItem[];
}

export interface DashboardStats {
  total_spend: number;
  your_share: number;
  amount_paid: number;
  amount_remaining: number;
  overdue_count: number;
  upcoming_items: ExpenseWithParticipants[];
}
