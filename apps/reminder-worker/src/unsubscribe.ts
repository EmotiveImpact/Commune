import { createHmac, timingSafeEqual } from "node:crypto";

// A reminder email carries a link that turns reminder emails off without
// signing in. The link names the recipient and an HMAC of their id, so only
// this worker can make one. It does not expire: it can only ever turn
// reminder emails off for that one person, and Settings turns them back on.

export type UnsubscribeConfig = { secret: string; baseUrl: string };

export function unsubscribeConfig(env: Record<string, string | undefined>): UnsubscribeConfig | null {
  const secret = env.UNSUBSCRIBE_SECRET;
  const base = env.WORKER_PUBLIC_URL;
  if (!secret || !base) return null;
  if (secret.length < 32) throw new Error("UNSUBSCRIBE_SECRET must be at least 32 characters");
  const url = new URL(base);
  if (url.protocol !== "https:") throw new Error("WORKER_PUBLIC_URL must use HTTPS");
  return { secret, baseUrl: url.origin };
}

function signature(secret: string, userId: string): string {
  return createHmac("sha256", secret).update(`commune-unsubscribe:v1:${userId}`).digest("base64url");
}

export function unsubscribeUrl(config: UnsubscribeConfig, userId: string): string {
  const url = new URL("/unsubscribe", config.baseUrl);
  url.searchParams.set("u", userId);
  url.searchParams.set("s", signature(config.secret, userId));
  return url.href;
}

/** The recipient a link was made for, or null when it was not made here. */
export function unsubscribeRecipient(config: UnsubscribeConfig, requestUrl: string): string | null {
  const params = new URL(requestUrl).searchParams;
  const userId = params.get("u") ?? "";
  const given = Buffer.from(params.get("s") ?? "");
  if (!userId || userId.length > 128) return null;
  const expected = Buffer.from(signature(config.secret, userId));
  return given.length === expected.length && timingSafeEqual(given, expected) ? userId : null;
}

const PAGE_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  // The address holds the link's signature; keep it out of other sites' logs.
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  "X-Content-Type-Options": "nosniff",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => `&#${character.charCodeAt(0)};`);
}

export function unsubscribePage(title: string, message: string, appUrl: string, form?: { action: string; label: string }, status = 200): Response {
  const button = form
    ? `<form method="post" action="${escapeHtml(form.action)}"><button type="submit" style="margin-top:20px;padding:12px 22px;border:0;border-radius:999px;background:#2d6a4f;color:#ffffff;font:inherit;font-weight:600;cursor:pointer;">${escapeHtml(form.label)}</button></form>`
    : "";
  const body = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:40px 16px;background:#f5f1ea;color:#1a1e2b;font-family:Inter,Arial,Helvetica,sans-serif;">
  <main style="max-width:480px;margin:0 auto;padding:32px;background:#ffffff;border:1px solid #e8e1d8;border-radius:15px;">
    <p style="margin:0 0 16px;font-weight:600;">Commune</p>
    <h1 style="margin:0;font-size:24px;line-height:1.3;font-weight:600;">${escapeHtml(title)}</h1>
    <p style="margin:12px 0 0;font-size:15px;line-height:1.6;">${escapeHtml(message)}</p>
    ${button}
    <p style="margin:24px 0 0;font-size:14px;"><a href="${escapeHtml(`${appUrl}/settings`)}" style="color:#2d6a4f;">Open Commune settings</a></p>
  </main>
</body>
</html>`;
  return new Response(body, { status, headers: PAGE_HEADERS });
}
