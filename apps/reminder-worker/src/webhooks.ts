import { createHmac, timingSafeEqual } from "node:crypto";
import type { Pool } from "pg";

// Resend reports bounces and spam complaints by webhook. Svix signs each one:
// an HMAC-SHA256 of "{svix-id}.{svix-timestamp}.{raw body}", keyed with the
// endpoint's signing secret ("whsec_" then base64), sent in svix-signature as
// space-separated "v1,{base64}" signatures. A reported address is recorded in
// public.email_suppressions: invitations to it are then refused, and reminder
// emails to it are skipped as if its owner had turned them off.

const TOLERANCE_SECONDS = 5 * 60;
const MAX_BODY_BYTES = 256 * 1024;
const SUPPRESSIONS = new Map([["email.bounced", "bounce"], ["email.complained", "complaint"]]);

/** The key in a "whsec_" signing secret, or null when there is no usable one. */
export function webhookSigningKey(secret: string | undefined): Buffer | null {
  const encoded = secret?.startsWith("whsec_") ? secret.slice("whsec_".length) : "";
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return null;
  const key = Buffer.from(encoded, "base64");
  return key.length >= 16 ? key : null;
}

/** Whether the headers carry a current signature of this body made with this key. */
export function verifyWebhookSignature(key: Buffer, headers: Headers, body: Buffer, now = Date.now()): boolean {
  const id = headers.get("svix-id") ?? "";
  const timestamp = headers.get("svix-timestamp") ?? "";
  const signatures = headers.get("svix-signature") ?? "";
  if (!id || id.length > 256 || !/^[0-9]{1,12}$/.test(timestamp) || !signatures) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > TOLERANCE_SECONDS) return false;
  const expected = Buffer.from(createHmac("sha256", key)
    .update(Buffer.concat([Buffer.from(`${id}.${timestamp}.`), body]))
    .digest("base64"));
  let valid = false;
  for (const entry of signatures.split(" ")) {
    if (!entry.startsWith("v1,")) continue;
    const given = Buffer.from(entry.slice(3));
    // Compare every candidate in full and in constant time.
    if (given.length === expected.length && timingSafeEqual(given, expected)) valid = true;
  }
  return valid;
}

// Each recipient's address, from "address" or "Name <address>".
function recipients(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [value];
  return list.flatMap((item) => {
    if (typeof item !== "string") return [];
    const address = (/<([^<>]*)>\s*$/.exec(item)?.[1] ?? item).trim();
    return address.length <= 320 && /^[^\s@]+@[^\s@]+$/.test(address) ? [address] : [];
  }).slice(0, 50);
}

export async function resendWebhook(pool: Pool, request: Request, secret: string | undefined): Promise<Response> {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
  const key = webhookSigningKey(secret);
  if (!key) {
    console.error("Resend webhook needs RESEND_WEBHOOK_SECRET, the endpoint's whsec_ signing secret");
    return new Response("Webhook not configured", { status: 503 });
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return new Response("Payload too large", { status: 413 });
  }
  const body = Buffer.from(await request.arrayBuffer());
  if (body.length > MAX_BODY_BYTES) return new Response("Payload too large", { status: 413 });
  if (!verifyWebhookSignature(key, request.headers, body)) return new Response("Invalid signature", { status: 401 });
  let event: { type?: unknown; data?: { to?: unknown } } | null;
  try {
    event = JSON.parse(body.toString("utf8"));
  } catch {
    return new Response("Invalid payload", { status: 400 });
  }
  const reason = typeof event?.type === "string" ? SUPPRESSIONS.get(event.type) : undefined;
  // Every other event type is acknowledged and ignored.
  if (!reason) return Response.json({ received: true });
  const addresses = recipients(event?.data?.to);
  if (!addresses.length) return Response.json({ received: true });
  try {
    // The first report of an address is kept; a replayed event changes nothing.
    await pool.query(`
      INSERT INTO public.email_suppressions (email, reason, provider_event_id)
      SELECT DISTINCT lower(a), $2, $3 FROM unnest($1::text[]) a
      ON CONFLICT (email) DO NOTHING
    `, [addresses, reason, request.headers.get("svix-id")]);
  } catch (error) {
    // Only the code: a row in a database error message would show the address.
    console.error("Resend webhook could not be recorded", { code: (error as { code?: unknown }).code });
    return new Response("Could not record the event", { status: 500 });
  }
  return Response.json({ received: true });
}
