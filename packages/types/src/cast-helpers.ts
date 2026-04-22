import type { Database, Json } from './database.types';

export const asJson = <T>(value: T): Json => value as unknown as Json;

export const fromJson = <T>(value: Json | null | undefined): T | null =>
  value == null ? null : (value as unknown as T);

export type Enums = Database['public']['Enums'];

export type SplitMethodEnum = Enums['split_method'];
export type RecurrenceTypeEnum = Enums['recurrence_type'];
export type PaymentStatusEnum = Enums['payment_status'];
export type MemberRoleEnum = Enums['member_role'];
export type MemberStatusEnum = Enums['member_status'];
export type GroupTypeEnum = Enums['group_type'];
export type ExpenseCategoryEnum = Enums['expense_category'];
export type SubscriptionPlanEnum = Enums['subscription_plan'];
export type SubscriptionStatusEnum = Enums['subscription_status'];

const SPLIT_METHODS: readonly SplitMethodEnum[] = ['equal', 'percentage', 'custom'];
const RECURRENCE_TYPES: readonly RecurrenceTypeEnum[] = ['none', 'weekly', 'monthly'];
const PAYMENT_STATUSES: readonly PaymentStatusEnum[] = ['unpaid', 'paid', 'confirmed'];

export const isSplitMethod = (value: unknown): value is SplitMethodEnum =>
  typeof value === 'string' && (SPLIT_METHODS as readonly string[]).includes(value);

export const isRecurrenceType = (value: unknown): value is RecurrenceTypeEnum =>
  typeof value === 'string' && (RECURRENCE_TYPES as readonly string[]).includes(value);

export const isPaymentStatus = (value: unknown): value is PaymentStatusEnum =>
  typeof value === 'string' && (PAYMENT_STATUSES as readonly string[]).includes(value);

export function toSplitMethod(value: string): SplitMethodEnum {
  if (!isSplitMethod(value)) throw new Error(`Unknown split_method: ${value}`);
  return value;
}

export function toRecurrenceType(value: string): RecurrenceTypeEnum {
  if (!isRecurrenceType(value)) throw new Error(`Unknown recurrence_type: ${value}`);
  return value;
}

export function toPaymentStatus(value: string): PaymentStatusEnum {
  if (!isPaymentStatus(value)) throw new Error(`Unknown payment_status: ${value}`);
  return value;
}
