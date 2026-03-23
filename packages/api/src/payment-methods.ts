import { supabase } from './client';
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
  // If marking as default, unset any existing defaults first
  if (input.is_default) {
    await supabase
      .from('user_payment_methods')
      .update({ is_default: false })
      .eq('user_id', userId)
      .eq('is_default', true);
  }

  const { data, error } = await supabase
    .from('user_payment_methods')
    .insert({
      user_id: userId,
      provider: input.provider,
      label: input.label ?? null,
      payment_link: input.payment_link ?? null,
      payment_info: input.payment_info ?? null,
      is_default: input.is_default ?? false,
    })
    .select()
    .single();

  if (error) throw error;
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
  // If marking as default, unset any existing defaults first
  if (input.is_default) {
    await supabase
      .from('user_payment_methods')
      .update({ is_default: false })
      .eq('user_id', userId)
      .eq('is_default', true);
  }

  const { data, error } = await supabase
    .from('user_payment_methods')
    .update(input)
    .eq('id', methodId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data as UserPaymentMethod;
}

export async function deletePaymentMethod(methodId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('user_payment_methods')
    .delete()
    .eq('id', methodId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function getDefaultPaymentMethod(userId: string): Promise<UserPaymentMethod | null> {
  const { data, error } = await supabase
    .from('user_payment_methods')
    .select('*')
    .eq('user_id', userId)
    .eq('is_default', true)
    .maybeSingle();

  if (error) throw error;
  return (data as UserPaymentMethod) ?? null;
}
