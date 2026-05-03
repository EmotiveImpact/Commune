import { supabase } from './client';
import {
  createPaymentMethodSchema,
  isClickableProvider,
  updatePaymentMethodSchema,
} from '@commune/core';
import type { UserPaymentMethod } from '@commune/types';

export async function getUserPaymentMethods(userId: string): Promise<UserPaymentMethod[]> {
  const { data, error } = await supabase
    .from('user_payment_methods')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as UserPaymentMethod[];
}

async function ensureSingleDefaultPaymentMethod(
  userId: string,
  preferredMethodId?: string,
): Promise<void> {
  const methods = await getUserPaymentMethods(userId);
  if (methods.length === 0) return;

  if (methods.some((method) => method.is_default)) return;

  const nextDefaultId = preferredMethodId && methods.some((method) => method.id === preferredMethodId)
    ? preferredMethodId
    : methods[0]?.id;

  if (!nextDefaultId) return;

  const { error } = await supabase
    .from('user_payment_methods')
    .update({ is_default: true })
    .eq('id', nextDefaultId)
    .eq('user_id', userId);

  if (error) throw error;
}

function validateMethodDetails(input: {
  provider: string;
  payment_link?: string | null;
  payment_info?: string | null;
}) {
  if (isClickableProvider(input.provider as Parameters<typeof isClickableProvider>[0])) {
    if (!input.payment_link?.trim()) {
      throw new Error('Payment link is required for this provider');
    }
    return;
  }

  if (!input.payment_info?.trim()) {
    throw new Error('Payment details are required for this provider');
  }
}

export async function createPaymentMethod(
  userId: string,
  input: {
    provider: string;
    label?: string | null;
    payment_link?: string | null;
    payment_info?: string | null;
    is_default?: boolean;
  },
): Promise<UserPaymentMethod> {
  const parsed = createPaymentMethodSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid payment method');
  }
  validateMethodDetails(parsed.data);

  const existingMethods = await getUserPaymentMethods(userId);
  const shouldBeDefault = parsed.data.is_default || existingMethods.length === 0;

  if (shouldBeDefault) {
    const { error: clearDefaultsError } = await supabase
      .from('user_payment_methods')
      .update({ is_default: false })
      .eq('user_id', userId)
      .eq('is_default', true);

    if (clearDefaultsError) throw clearDefaultsError;
  }

  const { data, error } = await supabase
    .from('user_payment_methods')
    .insert({
      user_id: userId,
      provider: parsed.data.provider,
      label: parsed.data.label ?? null,
      payment_link: parsed.data.payment_link ?? null,
      payment_info: parsed.data.payment_info ?? null,
      is_default: shouldBeDefault,
    })
    .select()
    .single();

  if (error) throw error;
  await ensureSingleDefaultPaymentMethod(userId, data.id);
  return data as UserPaymentMethod;
}

export async function updatePaymentMethod(
  methodId: string,
  userId: string,
  input: {
    provider?: string;
    label?: string | null;
    payment_link?: string | null;
    payment_info?: string | null;
    is_default?: boolean;
  },
): Promise<UserPaymentMethod> {
  const parsed = updatePaymentMethodSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid payment method');
  }

  const existingMethod = await supabase
    .from('user_payment_methods')
    .select('provider, payment_link, payment_info')
    .eq('id', methodId)
    .eq('user_id', userId)
    .single();

  if (existingMethod.error) throw existingMethod.error;

  validateMethodDetails({
    provider: parsed.data.provider ?? existingMethod.data.provider,
    payment_link: parsed.data.payment_link ?? existingMethod.data.payment_link,
    payment_info: parsed.data.payment_info ?? existingMethod.data.payment_info,
  });

  if (parsed.data.is_default) {
    const { error: clearDefaultsError } = await supabase
      .from('user_payment_methods')
      .update({ is_default: false })
      .eq('user_id', userId)
      .eq('is_default', true);

    if (clearDefaultsError) throw clearDefaultsError;
  }

  const { data, error } = await supabase
    .from('user_payment_methods')
    .update(parsed.data)
    .eq('id', methodId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;

  await ensureSingleDefaultPaymentMethod(
    userId,
    parsed.data.is_default ? methodId : undefined,
  );

  return data as UserPaymentMethod;
}

export async function deletePaymentMethod(methodId: string, userId: string): Promise<void> {
  const { data: method, error: lookupError } = await supabase
    .from('user_payment_methods')
    .select('id, is_default')
    .eq('id', methodId)
    .eq('user_id', userId)
    .maybeSingle();

  if (lookupError) throw lookupError;

  const { error } = await supabase
    .from('user_payment_methods')
    .delete()
    .eq('id', methodId)
    .eq('user_id', userId);

  if (error) throw error;

  if (method) {
    await ensureSingleDefaultPaymentMethod(userId);
  }
}

export async function getDefaultPaymentMethod(userId: string): Promise<UserPaymentMethod | null> {
  const methods = await getUserPaymentMethods(userId);
  return methods[0] ?? null;
}
