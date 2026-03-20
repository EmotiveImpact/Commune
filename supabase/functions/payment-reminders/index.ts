import { createClient } from 'npm:@supabase/supabase-js@2';

// Service role client — cron job has no user context
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const BATCH_LIMIT = 100;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, authorization',
};

interface PaymentRow {
  id: string;
  user_id: string;
  amount: number;
  expense: {
    title: string;
    due_date: string;
    currency: string;
    group: { name: string };
  };
  user: {
    email: string;
    notification_preferences: {
      email_on_payment_reminder?: boolean;
      email_on_overdue?: boolean;
    };
  };
}

async function sendNotification(
  to: string,
  subject: string,
  body: string,
  type: 'payment_reminder' | 'overdue',
): Promise<boolean> {
  const functionsUrl = Deno.env.get('SUPABASE_URL')!.replace(
    '.supabase.co',
    '.supabase.co/functions/v1',
  );
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const res = await fetch(`${functionsUrl}/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ to, subject, body, type }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`send-notification failed (${res.status}):`, text);
      return false;
    }
    return true;
  } catch (err) {
    console.error('send-notification fetch error:', err);
    return false;
  }
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

async function processUpcoming(): Promise<{ sent: number; skipped: number }> {
  const today = new Date();
  const threeDaysLater = new Date(today);
  threeDaysLater.setDate(threeDaysLater.getDate() + 3);

  const todayStr = today.toISOString().split('T')[0];
  const futureStr = threeDaysLater.toISOString().split('T')[0];

  // Fetch unpaid payment records whose expense due_date is between today and today+3
  const { data: records, error } = await supabase
    .from('payment_records')
    .select(`
      id,
      user_id,
      amount,
      expense:expenses!inner (
        title,
        due_date,
        currency,
        group:groups!inner ( name )
      ),
      user:users!inner (
        email,
        notification_preferences
      )
    `)
    .eq('status', 'unpaid')
    .gte('expense.due_date', todayStr)
    .lte('expense.due_date', futureStr)
    .limit(BATCH_LIMIT);

  if (error) {
    console.error('Error fetching upcoming payments:', error);
    return { sent: 0, skipped: 0 };
  }

  let sent = 0;
  let skipped = 0;

  for (const raw of (records ?? []) as unknown as PaymentRow[]) {
    const r = {
      ...raw,
      expense: Array.isArray(raw.expense) ? raw.expense[0] : raw.expense,
      user: Array.isArray(raw.user) ? raw.user[0] : raw.user,
    };

    // Check user preference
    if (!r.user.notification_preferences?.email_on_payment_reminder) {
      skipped++;
      continue;
    }

    // Check if already sent
    const { data: existing } = await supabase
      .from('payment_reminder_log')
      .select('id')
      .eq('payment_record_id', r.id)
      .eq('reminder_type', 'upcoming')
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    const currency = r.expense.currency ?? 'GBP';
    const subject = `Payment reminder: ${r.expense.title}`;
    const body = `<p>Hi,</p>
<p>You have an upcoming payment of <strong>${formatCurrency(r.amount, currency)}</strong> for <strong>${r.expense.title}</strong> in <strong>${r.expense.group.name}</strong>.</p>
<p>Due date: <strong>${formatDate(r.expense.due_date)}</strong></p>
<p>Please mark it as paid once completed.</p>`;

    const ok = await sendNotification(r.user.email, subject, body, 'payment_reminder');
    if (ok) {
      await supabase.from('payment_reminder_log').upsert(
        { payment_record_id: r.id, reminder_type: 'upcoming' },
        { onConflict: 'payment_record_id,reminder_type' },
      );
      sent++;
    }
  }

  return { sent, skipped };
}

async function processOverdue(): Promise<{ sent: number; skipped: number }> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Fetch unpaid payment records whose expense due_date is before today
  const { data: records, error } = await supabase
    .from('payment_records')
    .select(`
      id,
      user_id,
      amount,
      expense:expenses!inner (
        title,
        due_date,
        currency,
        group:groups!inner ( name )
      ),
      user:users!inner (
        email,
        notification_preferences
      )
    `)
    .eq('status', 'unpaid')
    .lt('expense.due_date', todayStr)
    .limit(BATCH_LIMIT);

  if (error) {
    console.error('Error fetching overdue payments:', error);
    return { sent: 0, skipped: 0 };
  }

  let sent = 0;
  let skipped = 0;

  for (const raw of (records ?? []) as unknown as PaymentRow[]) {
    const r = {
      ...raw,
      expense: Array.isArray(raw.expense) ? raw.expense[0] : raw.expense,
      user: Array.isArray(raw.user) ? raw.user[0] : raw.user,
    };

    // Check user preference
    if (!r.user.notification_preferences?.email_on_overdue) {
      skipped++;
      continue;
    }

    // For overdue: allow re-send if last sent > 7 days ago
    const { data: existing } = await supabase
      .from('payment_reminder_log')
      .select('id, sent_at')
      .eq('payment_record_id', r.id)
      .eq('reminder_type', 'overdue')
      .maybeSingle();

    if (existing) {
      const lastSent = new Date(existing.sent_at);
      if (lastSent > sevenDaysAgo) {
        skipped++;
        continue;
      }
    }

    const currency = r.expense.currency ?? 'GBP';
    const daysOverdue = Math.floor(
      (today.getTime() - new Date(r.expense.due_date).getTime()) / (1000 * 60 * 60 * 24),
    );
    const subject = `Overdue payment: ${r.expense.title}`;
    const body = `<p>Hi,</p>
<p>Your payment of <strong>${formatCurrency(r.amount, currency)}</strong> for <strong>${r.expense.title}</strong> in <strong>${r.expense.group.name}</strong> is <strong>${daysOverdue} day${daysOverdue === 1 ? '' : 's'} overdue</strong>.</p>
<p>Original due date: <strong>${formatDate(r.expense.due_date)}</strong></p>
<p>Please settle this payment as soon as possible.</p>`;

    const ok = await sendNotification(r.user.email, subject, body, 'overdue');
    if (ok) {
      // Upsert to update sent_at for re-send tracking
      if (existing) {
        await supabase
          .from('payment_reminder_log')
          .update({ sent_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        await supabase.from('payment_reminder_log').insert({
          payment_record_id: r.id,
          reminder_type: 'overdue',
        });
      }
      sent++;
    }
  }

  return { sent, skipped };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const upcoming = await processUpcoming();
    const overdue = await processOverdue();

    const result = {
      success: true,
      upcoming,
      overdue,
      processed_at: new Date().toISOString(),
    };

    console.log('Payment reminders processed:', result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    console.error('payment-reminders error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    );
  }
});
