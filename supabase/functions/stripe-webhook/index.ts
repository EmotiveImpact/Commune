import Stripe from 'npm:stripe@17';
import { createClient } from 'npm:@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

// Service role client — webhook has no user context
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

function toTimestamp(unix: number): string {
  return new Date(unix * 1000).toISOString();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'content-type, stripe-signature',
      },
    });
  }

  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing signature' }), { status: 400 });
    }

    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;
        const plan = session.metadata?.plan;
        if (!userId || !plan) break;

        const stripeSubscription = await stripe.subscriptions.retrieve(
          session.subscription as string,
        );

        const { error } = await supabase.from('subscriptions').upsert(
          {
            user_id: userId,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
            plan,
            status: stripeSubscription.status === 'trialing' ? 'trialing' : 'active',
            trial_ends_at: stripeSubscription.trial_end
              ? toTimestamp(stripeSubscription.trial_end)
              : toTimestamp(stripeSubscription.current_period_end),
            current_period_start: toTimestamp(stripeSubscription.current_period_start),
            current_period_end: toTimestamp(stripeSubscription.current_period_end),
          },
          { onConflict: 'user_id' },
        );

        if (error) console.error('Upsert error (checkout.session.completed):', error);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        let userId = sub.metadata?.supabase_user_id;

        // Fallback: look up user by subscription ID if metadata is missing
        if (!userId) {
          const { data: existingSub } = await supabase
            .from('subscriptions')
            .select('user_id')
            .eq('stripe_subscription_id', sub.id)
            .maybeSingle();
          if (!existingSub) break;
          userId = existingSub.user_id;
        }

        const plan = sub.metadata?.plan ?? sub.items.data[0]?.price?.lookup_key;

        const statusMap: Record<string, string> = {
          trialing: 'trialing',
          active: 'active',
          past_due: 'past_due',
          canceled: 'cancelled',
          unpaid: 'past_due',
        };

        const { error } = await supabase
          .from('subscriptions')
          .update({
            status: statusMap[sub.status] ?? 'active',
            ...(plan && { plan }),
            trial_ends_at: sub.trial_end
              ? toTimestamp(sub.trial_end)
              : undefined,
            current_period_start: toTimestamp(sub.current_period_start),
            current_period_end: toTimestamp(sub.current_period_end),
          })
          .eq('user_id', userId);

        if (error) console.error('Update error (subscription.updated):', error);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        let userId = sub.metadata?.supabase_user_id;

        if (!userId) {
          const { data: existingSub } = await supabase
            .from('subscriptions')
            .select('user_id')
            .eq('stripe_subscription_id', sub.id)
            .maybeSingle();
          if (!existingSub) break;
          userId = existingSub.user_id;
        }

        const { error } = await supabase
          .from('subscriptions')
          .update({ status: 'cancelled' })
          .eq('user_id', userId);

        if (error) console.error('Update error (subscription.deleted):', error);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = invoice.subscription as string;
        if (!subId) break;

        const { error } = await supabase
          .from('subscriptions')
          .update({ status: 'past_due' })
          .eq('stripe_subscription_id', subId);

        if (error) console.error('Update error (invoice.payment_failed):', error);
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response(JSON.stringify({ error: 'Webhook processing failed' }), { status: 400 });
  }
});
