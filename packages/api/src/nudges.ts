import { supabase } from './client';

/** Minimum interval between nudges to the same user (in days). */
const NUDGE_COOLDOWN_DAYS = 3;

export interface PaymentNudge {
  id: string;
  group_id: string;
  from_user_id: string;
  to_user_id: string;
  expense_id: string | null;
  amount: number;
  sent_at: string;
  created_at: string;
}

/**
 * Check whether a nudge can be sent to a specific user within a group.
 * Returns { allowed: true } or { allowed: false, lastSentAt } when a nudge
 * was already sent within the cooldown period.
 */
export async function canNudge(
  groupId: string,
  toUserId: string,
): Promise<{ allowed: boolean; lastSentAt?: string }> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - NUDGE_COOLDOWN_DAYS);

  const { data, error } = await supabase
    .from('payment_nudges')
    .select('sent_at')
    .eq('group_id', groupId)
    .eq('to_user_id', toUserId)
    .gte('sent_at', cutoff.toISOString())
    .order('sent_at', { ascending: false })
    .limit(1);

  if (error) throw error;

  if (data && data.length > 0 && data[0]) {
    return { allowed: false, lastSentAt: data[0].sent_at as string };
  }

  return { allowed: true };
}

/**
 * Send a payment nudge — inserts a record into `payment_nudges`.
 * The caller should check `canNudge` first to enforce the cooldown.
 */
export async function sendNudge(
  groupId: string,
  toUserId: string,
  amount: number,
  expenseId?: string,
): Promise<PaymentNudge> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('payment_nudges')
    .insert({
      group_id: groupId,
      from_user_id: user.id,
      to_user_id: toUserId,
      expense_id: expenseId ?? null,
      amount,
    })
    .select()
    .single();

  if (error) throw error;

  // Fire-and-forget: send email notification to the nudge recipient
  (async () => {
    try {
      // Look up sender name
      const { data: sender } = await supabase
        .from('users')
        .select('name')
        .eq('id', user.id)
        .single();

      // Look up recipient email + notification preferences
      const { data: recipient } = await supabase
        .from('users')
        .select('email, notification_preferences')
        .eq('id', toUserId)
        .single();

      if (
        recipient?.email &&
        recipient.notification_preferences?.email_on_payment_reminder !== false
      ) {
        const senderName = sender?.name ?? 'A group member';
        const formattedAmount = new Intl.NumberFormat('en-GB', {
          style: 'currency',
          currency: 'GBP',
        }).format(amount);

        supabase.functions
          .invoke('send-notification', {
            body: {
              to: recipient.email,
              subject: `${senderName} sent you a payment reminder`,
              body: `<p><strong>${senderName}</strong> has sent you a payment reminder for <strong>${formattedAmount}</strong>.</p><p>Log in to Commune to view and settle your balance.</p>`,
              type: 'payment_reminder',
            },
          })
          .catch((err) => {
            console.error('Failed to send nudge email:', err);
          });
      }
    } catch (err) {
      console.error('Failed to look up nudge notification data:', err);
    }
  })();

  return data as PaymentNudge;
}

/**
 * Get recent nudge history for a group (sent or received by the current user).
 * Returns nudges from the last 30 days, newest first.
 */
export async function getNudgeHistory(
  groupId: string,
): Promise<PaymentNudge[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const { data, error } = await supabase
    .from('payment_nudges')
    .select('*')
    .eq('group_id', groupId)
    .gte('sent_at', cutoff.toISOString())
    .order('sent_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as PaymentNudge[];
}
