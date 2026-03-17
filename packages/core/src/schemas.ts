import { z } from 'zod';
import {
  GroupType,
  ExpenseCategory,
  RecurrenceType,
  SplitMethod,
} from '@commune/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const groupTypeValues = Object.values(GroupType) as [string, ...string[]];
const expenseCategoryValues = Object.values(ExpenseCategory) as [
  string,
  ...string[],
];
const recurrenceTypeValues = Object.values(RecurrenceType) as [
  string,
  ...string[],
];
const splitMethodValues = Object.values(SplitMethod) as [
  string,
  ...string[],
];

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// ─── Group Schemas ───────────────────────────────────────────────────────────

export const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(groupTypeValues),
  description: z.string().max(500).optional(),
  cycle_date: z.number().int().min(1).max(28).default(1),
  currency: z.string().length(3).default('GBP'),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;

// ─── Member Schemas ──────────────────────────────────────────────────────────

export const inviteMemberSchema = z.object({
  email: z.string().email(),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

// ─── Expense Schemas ─────────────────────────────────────────────────────────

export const createExpenseSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.enum(expenseCategoryValues),
  amount: z.number().positive(),
  currency: z.string().length(3).default('GBP'),
  due_date: z.string().regex(dateRegex, 'Must be YYYY-MM-DD format'),
  recurrence_type: z.enum(recurrenceTypeValues).default('none'),
  recurrence_interval: z.number().int().positive().optional(),
  split_method: z.enum(splitMethodValues),
  paid_by_user_id: z
    .string()
    .regex(uuidRegex, 'Must be a valid UUID')
    .optional(),
  participant_ids: z
    .array(z.string().regex(uuidRegex, 'Must be a valid UUID'))
    .min(1),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

// ─── Split Validation Schemas ────────────────────────────────────────────────

export const percentageSplitSchema = z
  .array(
    z.object({
      userId: z.string(),
      percentage: z.number().min(0).max(100),
    }),
  )
  .refine(
    (items) => {
      const sum = items.reduce((acc, i) => acc + i.percentage, 0);
      return Math.abs(sum - 100) < 0.01;
    },
    { message: 'Percentages must sum to 100' },
  );

export type PercentageSplitInput = z.infer<typeof percentageSplitSchema>;

export const customSplitSchema = (totalAmount: number) =>
  z
    .array(
      z.object({
        userId: z.string(),
        amount: z.number().min(0),
      }),
    )
    .refine(
      (items) => {
        const sum = items.reduce((acc, i) => acc + i.amount, 0);
        return Math.abs(sum - totalAmount) < 0.01;
      },
      { message: `Amounts must sum to ${totalAmount}` },
    );

export type CustomSplitInput = z.infer<ReturnType<typeof customSplitSchema>>;

// ─── Payment Schemas ─────────────────────────────────────────────────────────

export const markPaymentSchema = z.object({
  status: z.enum(['unpaid', 'paid']),
  note: z.string().optional(),
});

export type MarkPaymentInput = z.infer<typeof markPaymentSchema>;

// ─── Profile Schemas ─────────────────────────────────────────────────────────

export const notificationPreferencesSchema = z.object({
  email_on_new_expense: z.boolean(),
  email_on_payment_received: z.boolean(),
  email_on_payment_reminder: z.boolean(),
  email_on_overdue: z.boolean(),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100),
  avatar_url: z.string().url().optional().nullable(),
  notification_preferences: notificationPreferencesSchema.optional(),
});

export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
