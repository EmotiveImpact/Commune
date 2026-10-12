import { createHash } from "node:crypto";
import type { Pool } from "pg";

export class InvitationEmailError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

type Config = { apiKey: string; from: string; appUrl: string };
type Payload = { from: string; to: string[]; subject: string; html: string; text: string };
const TOKEN_PLACEHOLDER = "COMMUNE_INVITATION_TOKEN";
const REPORT_ADDRESS = "support@ourcommune.io";
const INVITER_FALLBACK = "A Commune member";
// Names come from people. Keep each on one line, and drop the marks that
// reorder text on screen, so a reader sees the characters that were checked.
const safe = (value: string) => value
  .replace(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu, "")
  .replace(/[\u0000-\u001f\u007f-\u009f\s]+/gu, " ").trim();
const html = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

// The same rule as commune_private.looks_like_contact (migration 0033): "://"
// or "www.", an email-like x@y, a domain-like token ending in a common
// top-level domain, or 9 or more digits with nothing but spaces, punctuation
// or symbols between them (commas, semicolons and ampersands still part two
// numbers). The joining characters are the database's, code point for code
// point. Compared after NFKC normalisation, without invisible characters.
const INVISIBLE = /[\u00ad\u034f\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufe00-\ufe0f\ufeff]/gu;
const DIGIT_JOINERS = "\\t\\n\\v\\f\\r\\u0020-\\u0025\\u0027-\\u002B\\u002D-\\u002F\\u003A\\u003C-\\u0040\\u005B-\\u0060\\u007B-\\u007E"
  + "\\u0080-\\u00BF\\u00D7\\u00F7\\u1680\\u2000-\\u2BFF\\u3000-\\u303F\\u{1F000}-\\u{1FAFF}";
const CONTACT_PATTERNS = [
  /:\/\/|www\.|[^\s@]@[^\s@]/iu,
  /[^\s.]\.(?:com|net|org|io|co|uk|me|app|info|biz|xyz|link|ly|ru|top|site|online|shop)(?![a-z0-9])/iu,
  new RegExp(`[0-9](?:[${DIGIT_JOINERS}]*[0-9]){8}`, "u"),
];

/** Whether text holds a link, an email address or a phone number. */
export function looksLikeContact(text: string): boolean {
  const value = text.normalize("NFKC").replace(INVISIBLE, "");
  return CONTACT_PATTERNS.some((pattern) => pattern.test(value));
}

/** The inviter as an email names them: one line, at most 60 characters. */
export function inviterName(name: string | null | undefined): string {
  return Array.from(safe(name ?? "")).slice(0, 60).join("").trim() || INVITER_FALLBACK;
}

// Recent invitation emails, each counted through an index: per sender,
// commune and recipient (indexes from 0012) and across all of Commune
// (invitation_email_created_idx, from 0034). A sender whose earliest
// membership is under a day old is a new account.
export const INVITATION_LIMITS_QUERY = `SELECT
  (SELECT count(*) FROM public.invitation_email_deliveries
    WHERE sender_id=$1 AND created_at > now()-interval '24 hours') AS sender_count,
  (SELECT count(*) FROM public.invitation_email_deliveries
    WHERE commune_id=$2 AND created_at > now()-interval '24 hours') AS commune_count,
  (SELECT count(*) FROM public.invitation_email_deliveries
    WHERE recipient_email=$3 AND created_at > now()-interval '24 hours') AS recipient_count,
  (SELECT count(*) FROM public.invitation_email_deliveries
    WHERE recipient_email=$3 AND created_at > now()-interval '10 minutes') AS recent_recipient,
  (SELECT count(*) FROM public.invitation_email_deliveries
    WHERE created_at > now()-interval '24 hours') AS everyone_count,
  coalesce((SELECT min(m.joined_at) FROM public.commune_members m WHERE m.user_id=$1)
    > now()-interval '24 hours', true) AS new_sender`;

export function renderInvitationEmail(input: { commune: string; inviter: string; role: string; expires: string; appUrl: string; inviteId: string }) {
  const origin = new URL(input.appUrl);
  if (origin.protocol !== "https:") throw new Error("Invitation app URL must use HTTPS");
  // A report names the invitation by its id. The token never leaves the link.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.inviteId)) throw new Error("Invalid invitation id");
  const commune = safe(input.commune);
  const inviter = inviterName(input.inviter);
  const url = `${origin.origin}/invite?token=${TOKEN_PLACEHOLDER}`;
  const report = `mailto:${REPORT_ADDRESS}?subject=${encodeURIComponent(`Report invitation ${input.inviteId}`)}`;
  const subject = Array.from(`${inviter} invited you to join “${commune}” on Commune`).slice(0, 180).join("");
  const summary = `${inviter} has invited you to join “${commune}” as ${input.role === "admin" ? "an admin" : "a member"}.`;
  const instructions = `Sign in or create an account with the email address that received this invitation. The link expires ${safe(input.expires)}.`;
  const unexpected = "If you weren't expecting this, you can ignore this email or";
  return {
    subject,
    text: `${summary}\n\nJoin the commune: ${url}\n\n${instructions}\n\n${unexpected} report it: ${report}`,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${html(subject)}</title></head>
<body style="margin:0;background:#f5f1ea;font-family:Inter,Arial,sans-serif;color:#1a1e2b"><table role="presentation" width="100%"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" style="max-width:560px;background:#faf9f7;border:1px solid #e8e1d8;border-radius:18px"><tr><td style="padding:32px"><p style="font-weight:700;font-size:18px">Commune</p><p style="color:#2d6a4f">You're invited</p><h1 style="font-size:28px;line-height:1.2">Join “${html(commune)}”</h1><p style="font-size:16px;line-height:1.6">${html(summary)}</p><p style="margin:28px 0"><a href="${html(url)}" style="display:inline-block;padding:14px 24px;background:#2d6a4f;color:#fff;border-radius:999px;text-decoration:none;font-weight:700">Join the commune</a></p><p style="font-size:13px;line-height:1.6;color:#59645e">${html(instructions)}</p><p style="font-size:13px;line-height:1.6;color:#59645e">${html(unexpected)} <a href="${html(report)}" style="color:#2d6a4f;text-decoration:underline">report it</a>.</p></td></tr></table></td></tr></table></body></html>`,
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
  // Invitations store the SHA-256 of their token. Hashing it here keeps this
  // query free of database extensions such as pgcrypto.
  const tokenHash = createHash("sha256").update(token).digest();
  const client = await pool.connect();
  let inviteId = "";
  let attempt = 0;
  let payload: Payload;
  try {
    await client.query("BEGIN");
    // An admin leaving, removed or made a member locks the commune and then
    // withdraws their invitations, so the sender takes the commune first and
    // the two wait in turn.
    await client.query(`SELECT 1 FROM public.communes c JOIN public.commune_invites i ON c.id=i.commune_id
      WHERE i.token_hash=$1 FOR KEY SHARE OF c`, [tokenHash]);
    const { rows } = await client.query(`
      SELECT i.*, c.name AS commune_name, u.name AS inviter_name FROM public.commune_invites i
      JOIN public.communes c ON c.id=i.commune_id
      JOIN public.commune_members m ON m.commune_id=i.commune_id AND m.user_id=$2
        AND m.role='admin' AND m.active
      JOIN commune_private.accounts(ARRAY[$2::text]) u ON u.id=m.user_id AND u."emailVerified" IS TRUE
      WHERE i.token_hash=$1 AND i.accepted_at IS NULL
        AND i.revoked_at IS NULL AND i.expires_at > now()
      FOR UPDATE OF i`, [tokenHash, actor]);
    const invite = rows[0];
    if (!invite) throw new InvitationEmailError(404, "Invitation is unavailable or you are no longer a commune admin.");
    inviteId = invite.id;
    // Serialize per-recipient, actor, commune and Commune-wide budgets across all isolates.
    for (const key of [`invite-recipient:${invite.email}`, `invite-sender:${actor}`, `invite-commune:${invite.commune_id}`, "invite-everyone"].sort()) {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [key]);
    }
    const existing = (await client.query("SELECT * FROM public.invitation_email_deliveries WHERE invite_id=$1 FOR UPDATE", [inviteId])).rows[0];
    if (existing?.status === "sent") { await client.query("COMMIT"); return { status: "sent" as const }; }
    // An address that bounced or reported Commune's email as spam gets no more.
    const suppressed = await client.query("SELECT 1 FROM public.email_suppressions WHERE email=lower($1)", [invite.email]);
    if (suppressed.rowCount) throw new InvitationEmailError(409, "This address can't receive Commune emails. Share the link another way.");
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
      // Anyone can name a commune or an account, so neither may carry a way to
      // reach someone else in an email sent from Commune's address.
      const inviter = inviterName(invite.inviter_name);
      if (looksLikeContact(safe(invite.commune_name)) || looksLikeContact(inviter)) {
        throw new InvitationEmailError(422, "This invitation can't be emailed because a name in it looks like a link or phone number. Copy the link and share it yourself.");
      }
      const limits = (await client.query(INVITATION_LIMITS_QUERY, [actor, invite.commune_id, invite.email])).rows[0];
      if (+limits.everyone_count >= 500) {
        throw new InvitationEmailError(429, "Invitation emails are paused for today. Copy the link and share it yourself.");
      }
      if (limits.new_sender && +limits.sender_count >= 5) {
        throw new InvitationEmailError(429, "New accounts can email up to 5 invitations a day. Copy the link and share it yourself.");
      }
      if (+limits.sender_count >= 50 || +limits.commune_count >= 100 || +limits.recipient_count >= 3 || +limits.recent_recipient > 0) {
        throw new InvitationEmailError(429, "Invitation email limit reached. Wait before sending again, or share the link directly.");
      }
      payload = { from: config.from, to: [invite.email], ...renderInvitationEmail({
        commune: invite.commune_name, inviter, role: invite.role, appUrl: config.appUrl, inviteId,
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
