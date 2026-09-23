import { attachDatabasePool } from "@neon/functions";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { Pool } from "pg";
import { renderReminderEmail } from "./email.ts";

type Outbox = {
  reminder_id: string;
  attempts: number;
  payload: EmailPayload | null;
  payload_amount_minor: string | null;
};

type EmailPayload = {
  from: string;
  to: [string];
  subject: string;
  text: string;
  // Previously frozen text-only payloads must remain replayable unchanged.
  html?: string;
};

type ReminderDetails = {
  kind: "nudge" | "chase";
  outstanding_minor: string | null;
  commune_name: string;
  currency: string;
  sender_name: string;
  recipient_email: string | null;
  recipient_verified: boolean;
  member_active: boolean;
  label: string | null;
  email_reminders: boolean | null;
  still_due: boolean;
};

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const connectionUrl = new URL(databaseUrl);
// The Neon-injected URL currently uses sslmode=require. pg treats that as
// verify-full today but warns that a future major version will weaken it.
// Pin certificate and hostname verification explicitly for hosted Neon only;
// disposable local PostgreSQL test URLs must remain unchanged.
if (connectionUrl.hostname.endsWith(".neon.tech")) {
  connectionUrl.searchParams.set("sslmode", "verify-full");
}
const pool = new Pool({ connectionString: connectionUrl.toString(), max: 5 });
attachDatabasePool(pool);
const MAX_SCHEDULED_BATCH = 100;
const SCHEDULED_CONCURRENCY = 4;
const SCHEDULED_BUDGET_MS = 30_000;
let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

function mailConfig(): { apiKey: string; from: string; appUrl: string } | null {
  const { RESEND_API_KEY, RESEND_FROM, APP_URL } = process.env;
  if (!RESEND_API_KEY || !RESEND_FROM || !APP_URL) return null;
  const url = new URL(APP_URL);
  if (url.protocol !== "https:") throw new Error("APP_URL must use HTTPS");
  return { apiKey: RESEND_API_KEY, from: RESEND_FROM, appUrl: url.origin };
}

async function claimNext(reminderId: string | null = null): Promise<Outbox | null> {
  // The row update is atomic across concurrent scheduled invocations. A stale
  // sending row is retried only inside Resend's 24-hour idempotency window.
  const { rows } = await pool.query<Outbox>(`
    WITH candidate AS (
      SELECT reminder_id FROM public.reminder_email_outbox
      WHERE (
        (status IN ('pending', 'failed') AND next_attempt_at <= now())
        OR (status = 'sending' AND updated_at < now() - interval '5 minutes')
      )
        AND ($1::uuid IS NULL OR reminder_id = $1::uuid)
        AND attempts < 5
        AND created_at > now() - interval '23 hours'
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED LIMIT 1
    )
    UPDATE public.reminder_email_outbox q
      SET status = 'sending', attempts = q.attempts + 1,
          updated_at = now(), last_error = NULL
    FROM candidate WHERE q.reminder_id = candidate.reminder_id
    RETURNING q.reminder_id, q.attempts, q.payload, q.payload_amount_minor::text
  `, [reminderId]);
  return rows[0] ?? null;
}

async function expireUnsendable() {
  // Resend remembers an idempotency key for 24 hours. After 23 hours an
  // uncertain send needs manual review, not an automatic duplicate risk.
  await pool.query(`
    UPDATE public.reminder_email_outbox
      SET status = 'failed', attempts = 5,
          last_error = 'Email retry window expired; inspect provider before retrying',
          updated_at = now()
      WHERE status NOT IN ('sent', 'suppressed')
        AND created_at <= now() - interval '23 hours'
        AND (status <> 'sending'
          OR updated_at < now() - interval '5 minutes')
        AND (attempts < 5 OR status = 'sending')
  `);
  // A crash after claiming the final try must not leave a permanent lease.
  await pool.query(`
    UPDATE public.reminder_email_outbox
      SET status = 'failed',
          last_error = 'Maximum email attempts reached; inspect provider',
          updated_at = now()
      WHERE status = 'sending' AND attempts >= 5
        AND updated_at < now() - interval '5 minutes'
  `);
}

async function loadReminderDetails(reminderId: string) {
  const { rows } = await pool.query<ReminderDetails>(`
    SELECT r.kind, c.name AS commune_name,
      c.currency, sender.name AS sender_name,
      recipient.email AS recipient_email,
      recipient."emailVerified" AS recipient_verified,
      EXISTS (
        SELECT 1 FROM public.commune_members m
        WHERE m.commune_id = r.commune_id
          AND m.user_id = r.recipient_user_id
      ) AS member_active,
      pref.email_reminders,
      CASE WHEN r.kind = 'nudge'
        THEN coalesce(s.amount_minor > s.settled_minor, false)
        ELSE coalesce(fc.amount_minor > paid.total, false)
      END AS still_due,
      (CASE WHEN r.kind = 'nudge'
        THEN s.amount_minor - s.settled_minor
        ELSE fc.amount_minor - paid.total
      END)::text AS outstanding_minor,
      CASE WHEN r.kind = 'nudge' THEN e.title ELSE f.name END AS label
    FROM public.reminders r
    JOIN public.communes c ON c.id = r.commune_id
    JOIN neon_auth."user" sender ON sender.id = r.sender_user_id::uuid
    JOIN neon_auth."user" recipient ON recipient.id = r.recipient_user_id::uuid
    LEFT JOIN public.notification_preferences pref
      ON pref.user_id = r.recipient_user_id
    LEFT JOIN public.expense_shares s
      ON r.kind = 'nudge' AND s.id = r.source_id
    LEFT JOIN public.expenses e ON e.id = s.expense_id
    LEFT JOIN public.fund_commitments fc
      ON r.kind = 'chase' AND fc.id = r.source_id
    LEFT JOIN public.funds f ON f.id = fc.fund_id
    LEFT JOIN LATERAL (
      SELECT coalesce(sum(amount_minor), 0) AS total
      FROM public.fund_contributions
      WHERE commitment_id = fc.id
    ) paid ON true
    WHERE r.id = $1
  `, [reminderId]);
  return rows[0] ?? null;
}

function isDeliverable(detail: ReminderDetails | null): detail is ReminderDetails & {
  recipient_email: string;
  outstanding_minor: string;
} {
  return !!detail && detail.still_due &&
    detail.member_active && detail.recipient_verified &&
    detail.email_reminders !== false && !!detail.recipient_email &&
    !!detail.outstanding_minor;
}

async function suppress(reminderId: string, attempt: number) {
  await pool.query(`
    UPDATE public.reminder_email_outbox
      SET status = 'suppressed', updated_at = now()
    WHERE reminder_id = $1 AND status = 'sending' AND attempts = $2
  `, [reminderId, attempt]);
}

async function buildPayload(
  reminderId: string,
  attempt: number,
  detail: ReminderDetails & {
    recipient_email: string;
    outstanding_minor: string;
  },
  from: string,
  appUrl: string,
) {
  const amount = new Intl.NumberFormat("en-GB", {
    style: "currency", currency: detail.currency,
  }).format(Number(detail.outstanding_minor) / 100);
  const content = renderReminderEmail({
    kind: detail.kind,
    senderName: detail.sender_name,
    communeName: detail.commune_name,
    label: detail.label ?? detail.commune_name,
    amount,
    appUrl,
  });
  const payload: EmailPayload = {
    from,
    to: [detail.recipient_email],
    ...content,
  };
  // Freeze the exact request before calling Resend. Replays must send the same
  // body with the same idempotency key, even if a name or amount changes.
  const saved = await pool.query(`
    UPDATE public.reminder_email_outbox
      SET payload = $2::jsonb, payload_amount_minor = $3,
          updated_at = now()
      WHERE reminder_id = $1 AND payload IS NULL
        AND status = 'sending' AND attempts = $4
      RETURNING reminder_id
  `, [reminderId, JSON.stringify(payload), detail.outstanding_minor, attempt]);
  return saved.rowCount === 1 ? payload : null;
}

async function markFailure(reminderId: string, attempt: number, message: string) {
  await pool.query(`
    UPDATE public.reminder_email_outbox
      SET status = 'failed', last_error = left($2, 500),
          next_attempt_at = now() + make_interval(
            mins => least(power(2, attempts)::integer, 60)
          ), updated_at = now()
      WHERE reminder_id = $1 AND status = 'sending' AND attempts = $3
  `, [reminderId, message, attempt]);
}

async function sendOne(config: { apiKey: string; from: string; appUrl: string }, reminderId: string | null = null) {
  const item = await claimNext(reminderId);
  if (!item) return false;
  try {
    // A retry must re-check live obligation and preference state, even when
    // its original payload is frozen for the provider's idempotency key.
    const detail = await loadReminderDetails(item.reminder_id);
    if (!isDeliverable(detail)) {
      await suppress(item.reminder_id, item.attempts);
      return true;
    }
    // An earlier attempt may have reached Resend before its response was lost.
    // Reuse its exact body and key only while it still describes the current
    // amount and verified recipient; otherwise suppress rather than misstate it.
    if (item.payload && (
      item.payload_amount_minor !== detail.outstanding_minor ||
      item.payload.to[0] !== detail.recipient_email
    )) {
      await suppress(item.reminder_id, item.attempts);
      return true;
    }
    const payload = item.payload ??
      await buildPayload(item.reminder_id, item.attempts, detail,
        config.from, config.appUrl);
    if (!payload) return true;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `commune-reminder/${item.reminder_id}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    const body = await response.json() as { id?: string; message?: string };
    if (!response.ok || !body.id) {
      throw new Error(`Email provider returned HTTP ${response.status}: ${body.message ?? "unknown"}`);
    }
    await pool.query(`
      UPDATE public.reminder_email_outbox
        SET status = 'sent', provider_message_id = $2,
            updated_at = now(), last_error = NULL
        WHERE reminder_id = $1 AND status = 'sending' AND attempts = $3
    `, [item.reminder_id, body.id, item.attempts]);
    return true;
  } catch (error) {
    await markFailure(item.reminder_id, item.attempts,
      error instanceof Error ? error.message : "Unknown delivery error");
    console.error("Reminder email failed", { reminderId: item.reminder_id });
    return true;
  }
}

function dispatchCors(request: Request, appUrl: string): HeadersInit | null {
  const origin = request.headers.get("origin");
  if (!origin) return {};
  const allowed = [appUrl, ...(process.env.APP_ORIGINS ?? "").split(",")
    .map((value) => value.trim()).filter(Boolean)];
  if (!allowed.includes(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

async function verifiedSender(request: Request): Promise<string | null> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const authUrl = process.env.NEON_AUTH_BASE_URL;
  const jwksUrl = process.env.NEON_AUTH_JWKS_URL;
  if (!authUrl || !jwksUrl) return null;
  try {
    jwks ??= createRemoteJWKSet(new URL(jwksUrl));
    const issuer = new URL(authUrl).origin;
    const { payload } = await jwtVerify(authorization.slice(7), jwks, {
      issuer, audience: issuer,
    });
    return payload.emailVerified === true && typeof payload.sub === "string"
      ? payload.sub : null;
  } catch {
    return null;
  }
}

async function dispatch(request: Request, config: { apiKey: string; from: string; appUrl: string }): Promise<Response> {
  const headers = dispatchCors(request, config.appUrl);
  if (!headers) return new Response("Forbidden origin", { status: 403 });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers });
  const senderId = await verifiedSender(request);
  if (!senderId) return new Response("Unauthorized", { status: 401, headers });
  let reminderId: unknown;
  try {
    reminderId = (await request.json() as { reminderId?: unknown }).reminderId;
  } catch {
    return new Response("Invalid request", { status: 400, headers });
  }
  if (typeof reminderId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reminderId)) {
    return new Response("Invalid reminder", { status: 400, headers });
  }
  const sender = await pool.query<{ sender_user_id: string }>(
    "SELECT sender_user_id FROM public.reminders WHERE id = $1", [reminderId],
  );
  if (sender.rows[0]?.sender_user_id !== senderId) {
    return new Response("Reminder not found", { status: 404, headers });
  }
  const processed = await sendOne(config, reminderId);
  return Response.json({ processed }, { headers });
}

async function drainScheduled(config: { apiKey: string; from: string; appUrl: string }): Promise<number> {
  const deadline = Date.now() + SCHEDULED_BUDGET_MS;
  let claimed = 0;
  let processed = 0;
  await Promise.all(Array.from({ length: SCHEDULED_CONCURRENCY }, async () => {
    while (claimed < MAX_SCHEDULED_BATCH && Date.now() < deadline) {
      claimed += 1;
      if (!await sendOne(config)) break;
      processed += 1;
    }
  }));
  return processed;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const config = mailConfig();
    if (!config) {
      console.error("Reminder worker is missing RESEND_API_KEY, RESEND_FROM, or APP_URL");
      return new Response("Mail provider not configured", { status: 503 });
    }
    const pathname = new URL(request.url).pathname;
    if (pathname === "/dispatch") return dispatch(request, config);
    // Neon strips client-set X-Neon-* headers before invoking a Function.
    // Only the platform's scheduled trigger can supply this header.
    if (pathname !== "/" || request.method !== "POST" ||
        !request.headers.get("x-neon-trigger-invocation-id")) {
      return new Response("Forbidden", { status: 403 });
    }
    await expireUnsendable();
    const processed = await drainScheduled(config);
    return Response.json({ processed });
  },
};
