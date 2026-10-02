import type { Pool } from "pg";

export class InvitationEmailError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

type Config = { apiKey: string; from: string; appUrl: string };
type Payload = { from: string; to: string[]; subject: string; html: string; text: string };
const TOKEN_PLACEHOLDER = "COMMUNE_INVITATION_TOKEN";
const safe = (value: string) => value.replace(/[\u0000-\u001f\u007f-\u009f\s]+/gu, " ").trim();
const html = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export function renderInvitationEmail(input: { commune: string; role: string; expires: string; appUrl: string }) {
  const origin = new URL(input.appUrl);
  if (origin.protocol !== "https:") throw new Error("Invitation app URL must use HTTPS");
  const commune = safe(input.commune);
  const url = `${origin.origin}/invite?token=${TOKEN_PLACEHOLDER}`;
  const subject = `You're invited to ${commune} on Commune`.slice(0, 180);
  const summary = `You've been invited to join ${commune} as ${input.role === "admin" ? "an admin" : "a member"}.`;
  const instructions = `Sign in or create an account with the email address that received this invitation. The link expires ${safe(input.expires)}. If you weren't expecting this, you can ignore this email.`;
  return {
    subject,
    text: `${summary}\n\nJoin the commune: ${url}\n\n${instructions}`,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${html(subject)}</title></head>
<body style="margin:0;background:#f5f1ea;font-family:Inter,Arial,sans-serif;color:#1a1e2b"><table role="presentation" width="100%"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" style="max-width:560px;background:#faf9f7;border:1px solid #e8e1d8;border-radius:18px"><tr><td style="padding:32px"><p style="font-weight:700;font-size:18px">Commune</p><p style="color:#2d6a4f">You're invited</p><h1 style="font-size:28px;line-height:1.2">Join ${html(commune)}</h1><p style="font-size:16px;line-height:1.6">${html(summary)}</p><p style="margin:28px 0"><a href="${html(url)}" style="display:inline-block;padding:14px 24px;background:#2d6a4f;color:#fff;border-radius:999px;text-decoration:none;font-weight:700">Join the commune</a></p><p style="font-size:13px;line-height:1.6;color:#59645e">${html(instructions)}</p></td></tr></table></td></tr></table></body></html>`,
  };
}

export function invitationMailConfig(): Config | null {
  const { RESEND_API_KEY, RESEND_FROM, APP_URL } = process.env;
  if (!RESEND_API_KEY || !RESEND_FROM || !APP_URL) return null;
  const url = new URL(APP_URL);
  if (url.protocol !== "https:" || url.username || url.password) return null;
  return { apiKey: RESEND_API_KEY, from: RESEND_FROM, appUrl: url.origin };
}

// Both the hosted JWT handler and local authenticated API use this service.
// It accepts ONLY a token, never browser-supplied recipients, roles or URLs.
export async function sendInvitationEmail(pool: Pool, actor: string, token: string, config: Config | null) {
  if (!/^[0-9a-f]{64}$/.test(token)) throw new InvitationEmailError(400, "Invalid invitation.");
  if (!config) throw new InvitationEmailError(503, "Email sending is not configured here. You can still copy and share the invitation link.");
  const client = await pool.connect();
  let inviteId = "";
  let attempt = 0;
  let payload: Payload;
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(`
      SELECT i.*, c.name AS commune_name FROM public.commune_invites i
      JOIN public.communes c ON c.id=i.commune_id
      WHERE i.token_hash=digest($1, 'sha256') AND i.accepted_at IS NULL
        AND i.revoked_at IS NULL AND i.expires_at > now()
        AND EXISTS (SELECT 1 FROM public.commune_members m
          JOIN neon_auth."user" u ON u.id::text=m.user_id
          WHERE m.commune_id=i.commune_id AND m.user_id=$2
            AND m.role='admin' AND u."emailVerified" IS TRUE)
      FOR UPDATE OF i`, [token, actor]);
    const invite = rows[0];
    if (!invite) throw new InvitationEmailError(404, "Invitation is unavailable or you are no longer a commune admin.");
    inviteId = invite.id;
    // Serialize per-recipient, actor and commune budgets across all isolates.
    for (const key of [`invite-recipient:${invite.email}`, `invite-sender:${actor}`, `invite-commune:${invite.commune_id}`].sort()) {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [key]);
    }
    const existing = (await client.query("SELECT * FROM public.invitation_email_deliveries WHERE invite_id=$1 FOR UPDATE", [inviteId])).rows[0];
    if (existing?.status === "sent") { await client.query("COMMIT"); return { status: "sent" as const }; }
    if (existing) {
      if (existing.attempts >= 5 || Date.now() - new Date(existing.created_at).getTime() >= 23 * 60 * 60 * 1000) {
        throw new InvitationEmailError(409, "Email retry limit reached. Copy the link or create a new invitation later.");
      }
      const waitMs = existing.status === "sending" ? 60_000 : 10_000;
      if (Date.now() - new Date(existing.updated_at).getTime() < waitMs) {
        throw new InvitationEmailError(429, "Please wait a minute before retrying this email.");
      }
      payload = existing.payload;
      attempt = existing.attempts + 1;
      await client.query("UPDATE public.invitation_email_deliveries SET status='sending', attempts=$2, updated_at=now() WHERE invite_id=$1", [inviteId, attempt]);
    } else {
      const limits = (await client.query(`SELECT
        count(*) FILTER (WHERE sender_id=$1) AS sender_count,
        count(*) FILTER (WHERE commune_id=$2) AS commune_count,
        count(*) FILTER (WHERE recipient_email=$3) AS recipient_count,
        count(*) FILTER (WHERE recipient_email=$3 AND created_at > now()-interval '10 minutes') AS recent_recipient
        FROM public.invitation_email_deliveries
        WHERE created_at > now()-interval '24 hours'
          AND (sender_id=$1 OR commune_id=$2 OR recipient_email=$3)`, [actor, invite.commune_id, invite.email])).rows[0];
      if (+limits.sender_count >= 50 || +limits.commune_count >= 100 || +limits.recipient_count >= 3 || +limits.recent_recipient > 0) {
        throw new InvitationEmailError(429, "Invitation email limit reached. Wait before sending again, or share the link directly.");
      }
      payload = { from: config.from, to: [invite.email], ...renderInvitationEmail({
        commune: invite.commune_name, role: invite.role, appUrl: config.appUrl,
        expires: new Date(invite.expires_at).toISOString().slice(0, 10),
      }) };
      attempt = 1;
      await client.query(`INSERT INTO public.invitation_email_deliveries
        (invite_id, commune_id, sender_id, recipient_email, status, payload)
        VALUES ($1,$2,$3,$4,'sending',$5::jsonb)`, [inviteId, invite.commune_id, actor, invite.email, JSON.stringify(payload)]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `commune-invite/${inviteId}` },
      // Explicit key order also keeps serialized bytes stable after a JSONB
      // round trip (Postgres may reorder object keys).
      body: JSON.stringify({ from: payload.from, to: payload.to, subject: payload.subject,
        text: payload.text.replaceAll(TOKEN_PLACEHOLDER, token), html: payload.html.replaceAll(TOKEN_PLACEHOLDER, token) }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("Email provider rejected the request");
    const result = await response.json() as { id?: string };
    if (!result.id) throw new Error("Email provider did not confirm acceptance");
    await pool.query("UPDATE public.invitation_email_deliveries SET status='sent', provider_id=$2, updated_at=now() WHERE invite_id=$1 AND attempts=$3", [inviteId, result.id, attempt]);
    return { status: "sent" as const };
  } catch {
    await pool.query("UPDATE public.invitation_email_deliveries SET status='failed', updated_at=now() WHERE invite_id=$1 AND attempts=$2 AND status='sending'", [inviteId, attempt]);
    throw new InvitationEmailError(502, "Email sending could not be confirmed. Retry shortly or copy the invitation link.");
  }
}
