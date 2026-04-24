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

    // Minimal RFC-5321-ish address check. Blocks comma- and newline-injection
    // (prevents a caller from smuggling a BCC into the recipient list, or
    // header-injecting into the SMTP envelope via a \r\n).
    const addressRegex = /^[^\s,<>"@]+@[^\s,<>"@]+\.[^\s,<>"@]+$/;
    if (typeof to !== 'string' || !addressRegex.test(to)) {
      return new Response(
        JSON.stringify({ error: 'Invalid "to" address' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Subject goes in an email header. CR/LF are the classic header-injection
    // sequence — reject rather than sanitise so a surprising payload is loud.
    if (/[\r\n]/.test(subject)) {
      return new Response(
        JSON.stringify({ error: 'Invalid subject' }),
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

/**
 * Escape a user-controlled string so it is safe to interpolate into HTML text
 * or attribute values. Every caller that passes user data into the template
 * below MUST go through this first.
 */
function escapeHtml(value: string | undefined | null): string {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Only allow http/https URLs in CTA buttons. Rejecting `javascript:`, `data:`,
 * and other dangerous schemes here prevents a malicious caller from smuggling
 * a `javascript:` URL into an anchor href.
 */
function sanitizeUrl(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Body HTML is composed by trusted server-side callers (groups.ts, nudges.ts,
 * payment-reminders) and can therefore contain a small, known set of tags
 * (<p>, <strong>, <em>, <br>). This allow-list strips everything else so a
 * user name like `<script>...` baked into a body string by a caller cannot
 * escape into executable HTML.
 */
const BODY_ALLOWED_TAGS = /<\/?(?:p|strong|em|br)\s*\/?>/gi;
function sanitizeBody(value: string | undefined | null): string {
  if (!value) return '';
  // First: fully escape everything.
  const escaped = escapeHtml(value);
  // Then: restore the small whitelist of benign tags by unescaping only those
  // exact sequences the callers produce.
  return escaped
    .replace(/&lt;(\/?)(p|strong|em|br)\s*(\/?)&gt;/gi, '<$1$2$3>');
}

function wrapInTemplate(subject: string, body: string, options?: TemplateOptions): string {
  let ctaButtonHtml = '';

  const safeInviteUrl = sanitizeUrl(options?.invite_url);
  const safePaymentUrl = sanitizeUrl(options?.payment_url);
  const safeAmount = escapeHtml(options?.amount);
  const safeProvider = options?.payment_provider ?? '';
  const providerLabel = PROVIDER_LABELS[safeProvider] ?? 'Pay now';

  if (safeInviteUrl) {
    ctaButtonHtml = `<div style="text-align: center; margin-top: 24px;">
        <a href="${escapeHtml(safeInviteUrl)}" target="_blank" rel="noopener noreferrer"
           style="display: inline-block; background-color: #6366f1; color: #ffffff; text-decoration: none;
                  padding: 14px 36px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Accept Invitation
        </a>
      </div>`;
  } else if (safePaymentUrl) {
    ctaButtonHtml = `<div style="text-align: center; margin-top: 24px;">
        <a href="${escapeHtml(safePaymentUrl)}" target="_blank" rel="noopener noreferrer"
           style="display: inline-block; background-color: #6366f1; color: #ffffff; text-decoration: none;
                  padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 15px;">
          ${providerLabel}${safeAmount ? ` — £${safeAmount}` : ''}
        </a>
      </div>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
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
      <div class="content">${sanitizeBody(body)}</div>
      ${ctaButtonHtml}
    </div>
    <div class="footer">
      You're receiving this because of your notification settings in Commune.
    </div>
  </div>
</body>
</html>`;
}
