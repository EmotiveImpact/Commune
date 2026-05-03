export * from './enums';
export * from './database';
export * from './cast-helpers';

// ─── Generated Supabase schema types ────────────────────────────────────────
// Source of truth for row shapes. Regenerate with:
//   supabase gen types typescript --project-id <id> > packages/types/src/database.types.ts
export type { Database, Json } from './database.types';

import type { Database } from './database.types';

// ─── Table row / insert / update helpers ────────────────────────────────────
// Expose convenience aliases for the tables we interact with most so callers
// get strict typing without reaching into `Database['public']['Tables']['…']`.

export type ExpenseRow = Database['public']['Tables']['expenses']['Row'];
export type ExpenseInsert = Database['public']['Tables']['expenses']['Insert'];
export type ExpenseUpdate = Database['public']['Tables']['expenses']['Update'];

export type ExpenseParticipantRow =
  Database['public']['Tables']['expense_participants']['Row'];
export type ExpenseParticipantInsert =
  Database['public']['Tables']['expense_participants']['Insert'];
export type ExpenseParticipantUpdate =
  Database['public']['Tables']['expense_participants']['Update'];

export type PaymentRecordRow = Database['public']['Tables']['payment_records']['Row'];
export type PaymentRecordInsert =
  Database['public']['Tables']['payment_records']['Insert'];
export type PaymentRecordUpdate =
  Database['public']['Tables']['payment_records']['Update'];

export type GroupRow = Database['public']['Tables']['groups']['Row'];
export type GroupInsert = Database['public']['Tables']['groups']['Insert'];
export type GroupUpdate = Database['public']['Tables']['groups']['Update'];

export type GroupMemberRow = Database['public']['Tables']['group_members']['Row'];
export type GroupMemberInsert =
  Database['public']['Tables']['group_members']['Insert'];
export type GroupMemberUpdate =
  Database['public']['Tables']['group_members']['Update'];

export type UserRow = Database['public']['Tables']['users']['Row'];
export type UserInsert = Database['public']['Tables']['users']['Insert'];
export type UserUpdate = Database['public']['Tables']['users']['Update'];

export type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row'];
export type SubscriptionInsert =
  Database['public']['Tables']['subscriptions']['Insert'];
export type SubscriptionUpdate =
  Database['public']['Tables']['subscriptions']['Update'];

export type UserPaymentMethodRow =
  Database['public']['Tables']['user_payment_methods']['Row'];
export type UserPaymentMethodInsert =
  Database['public']['Tables']['user_payment_methods']['Insert'];
export type UserPaymentMethodUpdate =
  Database['public']['Tables']['user_payment_methods']['Update'];

// Recurrence is tracked through a log table rather than a first-class
// recurring_expenses table; expose it under the same naming convention.
export type RecurringExpenseLogRow =
  Database['public']['Tables']['recurring_expense_log']['Row'];
export type RecurringExpenseLogInsert =
  Database['public']['Tables']['recurring_expense_log']['Insert'];
export type RecurringExpenseLogUpdate =
  Database['public']['Tables']['recurring_expense_log']['Update'];

// Notifications are stored as activity_log rows and payment_nudges; re-export
// both so callers can discover them from @commune/types directly.
export type ActivityLogRow = Database['public']['Tables']['activity_log']['Row'];
export type ActivityLogInsert =
  Database['public']['Tables']['activity_log']['Insert'];
export type ActivityLogUpdate =
  Database['public']['Tables']['activity_log']['Update'];

export type PaymentNudgeRow = Database['public']['Tables']['payment_nudges']['Row'];
export type PaymentNudgeInsert =
  Database['public']['Tables']['payment_nudges']['Insert'];
export type PaymentNudgeUpdate =
  Database['public']['Tables']['payment_nudges']['Update'];

export type NotificationReadRow =
  Database['public']['Tables']['notification_reads']['Row'];
export type NotificationReadInsert =
  Database['public']['Tables']['notification_reads']['Insert'];
export type NotificationReadUpdate =
  Database['public']['Tables']['notification_reads']['Update'];
