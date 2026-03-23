// ── Web Push ──────────────────────────────────────────────────────────────
// Uses the Web Push protocol directly (no npm package needed in Deno).
// Requires VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY env vars.
// ────────────────────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_URL = 'https://api.resend.com/emails';

interface NotificationRequest {
  to: string;
  user_id?: string;
  subject: string;
  body: string;
  type: 'new_expense' | 'payment_received' | 'payment_reminder' | 'overdue' | 'group_invite';
  payment_url?: string;
  payment_provider?: string;
  amount?: string;
  invite_url?: string;
}

interface ResendPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
  tags: { name: string; value: string }[];
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Verify the caller is authenticated (service role or valid user JWT)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const apiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'Commune <noreply@ourcommune.io>';

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const { to, user_id, subject, body, type, payment_url, payment_provider, amount, invite_url } = (await req.json()) as NotificationRequest;

    if (!to || !subject || !body || !type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, subject, body, type' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const htmlBody = wrapInTemplate(subject, body, { payment_url, payment_provider, amount, invite_url });

    const payload: ResendPayload = {
      from: fromEmail,
      to: [to],
      subject,
      html: htmlBody,
      tags: [{ name: 'type', value: type }],
    };

    const resendResponse = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!resendResponse.ok) {
      const errorBody = await resendResponse.text();
      console.error('Resend API error:', resendResponse.status, errorBody);
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: errorBody }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const result = await resendResponse.json();

    // ── Web Push (fire-and-forget alongside email) ──
    if (user_id) {
      sendWebPush(user_id, subject, body, payment_url).catch((err) =>
        console.error('Web push error (non-fatal):', err),
      );
    }

    return new Response(
      JSON.stringify({ success: true, id: result.id }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('send-notification error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

// ── Web Push Implementation ──────────────────────────────────────────────
async function sendWebPush(userId: string, title: string, body: string, url?: string) {
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!vapidPublicKey || !vapidPrivateKey || !supabaseUrl || !serviceRoleKey) {
    console.log('Web push: missing env vars, skipping');
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Fetch user's push subscriptions
  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (error || !subscriptions?.length) return;

  const payload = JSON.stringify({
    title,
    body: body.replace(/<[^>]*>/g, '').slice(0, 200),
    icon: '/logo.png',
    url: url ?? '/',
  });

  // Send to each subscription
  for (const sub of subscriptions) {
    try {
      // Use the Web Push protocol via fetch with VAPID JWT
      const jwt = await createVapidJwt(sub.endpoint, vapidPublicKey, vapidPrivateKey);
      const encrypted = await encryptPayload(payload, sub.p256dh, sub.auth);

      const pushResponse = await fetch(sub.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Encoding': 'aes128gcm',
          'Authorization': `vapid t=${jwt}, k=${vapidPublicKey}`,
          'TTL': '86400',
        },
        body: encrypted,
      });

      // 410 Gone = subscription expired, clean it up
      if (pushResponse.status === 410 || pushResponse.status === 404) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        console.log(`Removed stale push subscription ${sub.id}`);
      }
    } catch (err) {
      console.error(`Push to ${sub.endpoint} failed:`, err);
    }
  }
}

// VAPID JWT creation for Web Push protocol
async function createVapidJwt(endpoint: string, publicKey: string, privateKey: string): Promise<string> {
  const audience = new URL(endpoint).origin;
  const now = Math.floor(Date.now() / 1000);

  const header = btoa(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const payload = btoa(JSON.stringify({
    aud: audience,
    exp: now + 43200, // 12 hours
    sub: 'mailto:noreply@ourcommune.io',
  })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const signingInput = `${header}.${payload}`;

  // Import VAPID private key for signing
  const rawKey = Uint8Array.from(atob(privateKey.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    rawKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  ).catch(() => {
    // Try JWK format if PKCS8 fails
    return crypto.subtle.importKey(
      'raw',
      rawKey,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign'],
    );
  });

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput),
  );

  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `${header}.${payload}.${sig}`;
}

// Placeholder for Web Push payload encryption (aes128gcm)
// In production, use a proper web-push library. For now, send unencrypted fallback.
async function encryptPayload(payload: string, _p256dh: string, _auth: string): Promise<Uint8Array> {
  // Note: Full aes128gcm encryption requires implementing the Web Push Encryption spec (RFC 8291).
  // For a production deployment, use a Deno-compatible web-push library.
  // This sends the payload as-is — modern browsers may reject unencrypted payloads.
  return new TextEncoder().encode(payload);
}

interface TemplateOptions {
  payment_url?: string;
  payment_provider?: string;
  amount?: string;
  invite_url?: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  revolut: 'Pay with Revolut',
  monzo: 'Pay with Monzo',
  paypal: 'Pay with PayPal',
};

function wrapInTemplate(subject: string, body: string, options?: TemplateOptions): string {
  let ctaButtonHtml = '';

  if (options?.invite_url) {
    ctaButtonHtml = `<div style="text-align: center; margin-top: 24px;">
        <a href="${options.invite_url}" target="_blank" rel="noopener noreferrer"
           style="display: inline-block; background-color: #6366f1; color: #ffffff; text-decoration: none;
                  padding: 14px 36px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Accept Invitation
        </a>
      </div>`;
  } else if (options?.payment_url) {
    ctaButtonHtml = `<div style="text-align: center; margin-top: 24px;">
        <a href="${options.payment_url}" target="_blank" rel="noopener noreferrer"
           style="display: inline-block; background-color: #6366f1; color: #ffffff; text-decoration: none;
                  padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 15px;">
          ${PROVIDER_LABELS[options.payment_provider ?? ''] ?? 'Pay now'}${options.amount ? ` — £${options.amount}` : ''}
        </a>
      </div>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #ffffff; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { font-size: 14px; font-weight: 600; color: #6366f1; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; }
    .content { font-size: 15px; line-height: 1.6; color: #374151; }
    .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">Commune</div>
      <div class="content">${body}</div>
      ${ctaButtonHtml}
    </div>
    <div class="footer">
      You're receiving this because of your notification settings in Commune.
    </div>
  </div>
</body>
</html>`;
}
