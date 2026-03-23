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

export const inviteTokenSchema = z.object({
  token: z.string().min(1),
});
export type InviteTokenInput = z.infer<typeof inviteTokenSchema>;

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
  first_name: z.string().min(1, 'First name is required').max(50),
  last_name: z.string().max(50).optional().default(''),
  avatar_url: z.union([z.string().url(), z.literal(''), z.null()]).optional(),
  phone: z.union([z.string().max(20), z.literal(''), z.null()]).optional(),
  country: z.union([z.string().max(100), z.literal(''), z.null()]).optional(),
});

export const updateSettingsSchema = z.object({
  default_currency: z.string().length(3).optional(),
  timezone: z.string().min(1).max(100).optional(),
  notification_preferences: notificationPreferencesSchema.optional(),
});

export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

// ─── Template Schemas ───────────────────────────────────────────────────────

const templateParticipantSchema = z.object({
  user_id: z.string().regex(uuidRegex, 'Must be a valid UUID'),
  percentage: z.number().min(0).max(100).optional(),
  amount: z.number().min(0).optional(),
});

export const createTemplateSchema = z.object({
  group_id: z.string().regex(uuidRegex, 'Must be a valid UUID'),
  name: z.string().min(1, 'Template name is required').max(100),
  split_method: z.enum(splitMethodValues),
  participants: z.array(templateParticipantSchema).min(1, 'At least one participant is required'),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  split_method: z.enum(splitMethodValues).optional(),
  participants: z.array(templateParticipantSchema).min(1).optional(),
});

export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

// ─── Fund Schemas ───────────────────────────────────────────────────────────

export const createFundSchema = z.object({
  group_id: z.string().regex(uuidRegex, 'Must be a valid UUID'),
  name: z.string().min(1, 'Fund name is required').max(100),
  target_amount: z.number().positive().nullable().optional(),
  currency: z.string().length(3).default('GBP'),
});

export type CreateFundInput = z.infer<typeof createFundSchema>;

export const createContributionSchema = z.object({
  amount: z.number().positive('Amount must be greater than 0'),
  note: z.string().max(500).optional(),
});

export type CreateContributionInput = z.infer<typeof createContributionSchema>;

export const createFundExpenseSchema = z.object({
  description: z.string().min(1, 'Description is required').max(200),
  amount: z.number().positive('Amount must be greater than 0'),
  receipt_url: z.string().url().nullable().optional(),
});

export type CreateFundExpenseInput = z.infer<typeof createFundExpenseSchema>;

// ─── Proration Schemas ──────────────────────────────────────────────────────

export const prorationInfoSchema = z.object({
  daysPresent: z.number().int().min(0),
  totalDays: z.number().int().min(1),
  ratio: z.number().min(0).max(1),
});

export type ProrationInfoInput = z.infer<typeof prorationInfoSchema>;

export const prorationRequestSchema = z.object({
  effectiveFrom: z.string().regex(dateRegex, 'Must be YYYY-MM-DD format').nullable(),
  effectiveUntil: z.string().regex(dateRegex, 'Must be YYYY-MM-DD format').nullable(),
  periodStart: z.string().regex(dateRegex, 'Must be YYYY-MM-DD format'),
  periodEnd: z.string().regex(dateRegex, 'Must be YYYY-MM-DD format'),
  fullShare: z.number().min(0),
});

export type ProrationRequestInput = z.infer<typeof prorationRequestSchema>;

// ─── Settlement Schemas ─────────────────────────────────────────────────────

export const settlementTransactionSchema = z.object({
  fromUserId: z.string().regex(uuidRegex, 'Must be a valid UUID'),
  toUserId: z.string().regex(uuidRegex, 'Must be a valid UUID'),
  amount: z.number().positive(),
  fromUserName: z.string().optional(),
  toUserName: z.string().optional(),
  paymentLink: z.string().nullable().optional(),
  paymentProvider: z
    .enum(['revolut', 'monzo', 'paypal', 'bank_transfer', 'other'])
    .nullable()
    .optional(),
});

export const settlementResultSchema = z.object({
  transactions: z.array(settlementTransactionSchema),
  transactionCount: z.number().int().min(0),
  isSettled: z.boolean(),
});

export type SettlementTransactionInput = z.infer<typeof settlementTransactionSchema>;
export type SettlementResultInput = z.infer<typeof settlementResultSchema>;

// ─── Payment Method Schemas ─────────────────────────────────────────────────

export const createPaymentMethodSchema = z.object({
  provider: z.enum(['revolut', 'monzo', 'paypal', 'bank_transfer', 'other']),
  label: z.string().max(50).optional().nullable(),
  payment_link: z.string().max(200).optional().nullable(),
  payment_info: z.string().max(500).optional().nullable(),
  is_default: z.boolean().optional(),
});

export const updatePaymentMethodSchema = createPaymentMethodSchema.partial();

export type CreatePaymentMethodInput = z.infer<typeof createPaymentMethodSchema>;
export type UpdatePaymentMethodInput = z.infer<typeof updatePaymentMethodSchema>;

// ─── Chore Schemas ──────────────────────────────────────────────────────────

export const createChoreSchema = z.object({
  group_id: z.string().regex(uuidRegex),
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional().nullable(),
  frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'once']),
  assigned_to: z.string().regex(uuidRegex).optional().nullable(),
  rotation_order: z.array(z.string()).optional().nullable(),
  next_due: z.string().regex(dateRegex).optional(),
});

export const updateChoreSchema = createChoreSchema.partial().omit({ group_id: true });

export type CreateChoreInput = z.infer<typeof createChoreSchema>;
export type UpdateChoreInput = z.infer<typeof updateChoreSchema>;
