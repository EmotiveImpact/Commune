import Stripe from 'npm:stripe@17';
import { createClient } from 'npm:@supabase/supabase-js@2';

// ── Rate Limiting ──────────────────────────────────────────────────────────────
// Max 5 requests per user per 60 seconds. Map resets on cold start (acceptable).
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimitMap = new Map<string, number[]>();

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of rateLimitMap) {
    const valid = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (valid.length === 0) {
      rateLimitMap.delete(key);
    } else {
      rateLimitMap.set(key, valid);
    }
  }
}, 300_000);

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const timestamps = (rateLimitMap.get(userId) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS,
  );
  if (timestamps.length >= RATE_LIMIT_MAX) {
    rateLimitMap.set(userId, timestamps);
    return false;
  }
  timestamps.push(now);
  rateLimitMap.set(userId, timestamps);
  return true;
}

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);

const PRICE_MAP: Record<string, { monthly: string; annual: string }> = {
  standard: {
    monthly: Deno.env.get('STRIPE_PRICE_STANDARD')!,
    annual: Deno.env.get('STRIPE_PRICE_STANDARD_ANNUAL') ?? Deno.env.get('STRIPE_PRICE_STANDARD')!,
  },
  pro: {
    monthly: Deno.env.get('STRIPE_PRICE_PRO')!,
    annual: Deno.env.get('STRIPE_PRICE_PRO_ANNUAL') ?? Deno.env.get('STRIPE_PRICE_PRO')!,
  },
  agency: {
    monthly: Deno.env.get('STRIPE_PRICE_AGENCY')!,
    annual: Deno.env.get('STRIPE_PRICE_AGENCY_ANNUAL') ?? Deno.env.get('STRIPE_PRICE_AGENCY')!,
  },
};

const APP_URL = Deno.env.get('APP_URL')!;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    // Rate limit: max 5 requests per user per minute
    if (!checkRateLimit(user.id)) {
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again shortly.' }),
        { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } },
      );
    }

    const { plan, interval = 'monthly' } = await req.json();
    const planPrices = PRICE_MAP[plan];
    if (!planPrices) {
      return new Response(JSON.stringify({ error: 'Invalid plan' }), { status: 400 });
    }
    const priceId = planPrices[interval as 'monthly' | 'annual'] ?? planPrices.monthly;

    // Check for existing Stripe customer
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    let customerId = subscription?.stripe_customer_id;

    // Create Stripe customer if needed
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
    }

    // Only offer a trial to first-time subscribers
    const isFirstSubscription = !subscription?.stripe_customer_id;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        ...(isFirstSubscription && { trial_period_days: 7 }),
        metadata: { supabase_user_id: user.id, plan },
      },
      success_url: `${APP_URL}/pricing?success=true`,
      cancel_url: `${APP_URL}/pricing?cancelled=true`,
      metadata: { supabase_user_id: user.id, plan },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Checkout error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
});
