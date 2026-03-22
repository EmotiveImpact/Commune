// ─── GroupType ───────────────────────────────────────────────────────────────

export const GroupType = {
  HOME: 'home',
  COUPLE: 'couple',
  WORKSPACE: 'workspace',
  PROJECT: 'project',
  TRIP: 'trip',
  OTHER: 'other',
} as const;
export type GroupType = (typeof GroupType)[keyof typeof GroupType];

// ─── MemberRole ─────────────────────────────────────────────────────────────

export const MemberRole = {
  ADMIN: 'admin',
  MEMBER: 'member',
} as const;
export type MemberRole = (typeof MemberRole)[keyof typeof MemberRole];

// ─── MemberStatus ───────────────────────────────────────────────────────────

export const MemberStatus = {
  INVITED: 'invited',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  REMOVED: 'removed',
} as const;
export type MemberStatus = (typeof MemberStatus)[keyof typeof MemberStatus];

// ─── ExpenseCategory ────────────────────────────────────────────────────────

export const ExpenseCategory = {
  RENT: 'rent',
  UTILITIES: 'utilities',
  INTERNET: 'internet',
  CLEANING: 'cleaning',
  GROCERIES: 'groceries',
  ENTERTAINMENT: 'entertainment',
  HOUSEHOLD_SUPPLIES: 'household_supplies',
  TRANSPORT: 'transport',
  WORK_TOOLS: 'work_tools',
  MISCELLANEOUS: 'miscellaneous',
} as const;
export type ExpenseCategory =
  (typeof ExpenseCategory)[keyof typeof ExpenseCategory];

// ─── RecurrenceType ─────────────────────────────────────────────────────────

export const RecurrenceType = {
  NONE: 'none',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
} as const;
export type RecurrenceType =
  (typeof RecurrenceType)[keyof typeof RecurrenceType];

// ─── SplitMethod ────────────────────────────────────────────────────────────

export const SplitMethod = {
  EQUAL: 'equal',
  PERCENTAGE: 'percentage',
  CUSTOM: 'custom',
} as const;
export type SplitMethod = (typeof SplitMethod)[keyof typeof SplitMethod];

// ─── PaymentStatus ──────────────────────────────────────────────────────────

export const PaymentStatus = {
  UNPAID: 'unpaid',
  PAID: 'paid',
  CONFIRMED: 'confirmed',
} as const;
export type PaymentStatus =
  (typeof PaymentStatus)[keyof typeof PaymentStatus];

// ─── PaymentProvider ────────────────────────────────────────────────────────

export const PaymentProvider = {
  REVOLUT: 'revolut',
  MONZO: 'monzo',
  PAYPAL: 'paypal',
  BANK_TRANSFER: 'bank_transfer',
  OTHER: 'other',
} as const;
export type PaymentProvider =
  (typeof PaymentProvider)[keyof typeof PaymentProvider];

// ─── SubscriptionPlan ───────────────────────────────────────────────────────

export const SubscriptionPlan = {
  FREE: 'free',
  STANDARD: 'standard',
  PRO: 'pro',
  AGENCY: 'agency',
} as const;
export type SubscriptionPlan =
  (typeof SubscriptionPlan)[keyof typeof SubscriptionPlan];

// ─── SubscriptionStatus ─────────────────────────────────────────────────────

export const SubscriptionStatus = {
  TRIALING: 'trialing',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELLED: 'cancelled',
} as const;
export type SubscriptionStatus =
  (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];
