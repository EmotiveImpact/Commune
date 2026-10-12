type ReminderEmailInput = {
  kind: "nudge" | "chase";
  senderName: string;
  communeName: string;
  label: string;
  amount: string;
  appUrl: string;
  /** A signed one-click link that turns reminder emails off, when configured. */
  unsubscribeUrl?: string;
};

function inlineText(value: string): string {
  // Names and labels come from members. Keep them on one line so they cannot
  // manufacture extra paragraphs or headers in the plain-text message.
  return value.replace(/[\u0000-\u001f\u007f-\u009f\s]+/gu, " ").trim();
}

function escapeHtml(value: string): string {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return value.replace(/[&<>"']/gu, (character) => entities[character] ?? character);
}

export function renderReminderEmail(input: ReminderEmailInput) {
  const sender = inlineText(input.senderName);
  const commune = inlineText(input.communeName);
  const label = inlineText(input.label);
  const amount = inlineText(input.amount);
  const action = input.kind === "nudge" ? "expense share" : "fund pledge";
  const category = input.kind === "nudge" ? "Expense reminder" : "Fund reminder";
  const url = new URL(input.appUrl);
  if (url.protocol !== "https:") throw new Error("Email app URL must use HTTPS");
  const appUrl = url.origin;
  const settingsUrl = `${appUrl}/settings`;
  const unsubscribeUrl = input.unsubscribeUrl ? new URL(input.unsubscribeUrl) : null;
  if (unsubscribeUrl && unsubscribeUrl.protocol !== "https:") throw new Error("Email unsubscribe URL must use HTTPS");
  const summary = `${sender} reminded you about your ${amount} ${action} for ${label} in ${commune}.`;
  const subject = `A Commune ${input.kind} from ${sender}`.slice(0, 180);
  const text = `${summary}\n\nOpen Commune: ${appUrl}\n\nYou can turn reminder emails off in Commune settings: ${settingsUrl}`
    + (unsubscribeUrl ? `\nOr turn them off now: ${unsubscribeUrl.href}` : "");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f1ea;color:#1a1e2b;font-family:Inter,Arial,Helvetica,sans-serif;">
  <div style="display:none;font-size:1px;line-height:1px;color:#f5f1ea;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(summary)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:#f5f1ea;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;max-width:560px;background:#faf9f7;border:1px solid #e8e1d8;border-radius:20px;">
        <tr><td style="padding:30px 32px 0;">
          <span style="display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;background:#1a1e2b;color:#f5f1ea;border-radius:9px;font-family:Georgia,serif;font-size:23px;font-weight:bold;vertical-align:middle;">C</span>
          <span style="padding-left:10px;color:#1a1e2b;font-size:17px;font-weight:700;vertical-align:middle;">Commune</span>
        </td></tr>
        <tr><td style="padding:32px 32px 0;">
          <p style="margin:0 0 12px;color:#2d6a4f;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">${escapeHtml(category)}</p>
          <h1 style="margin:0;color:#1a1e2b;font-size:28px;line-height:1.2;font-weight:700;">A reminder from ${escapeHtml(sender)}</h1>
          <p style="margin:16px 0 0;color:#555c62;font-size:15px;line-height:1.6;">${escapeHtml(sender)} reminded you about your ${escapeHtml(action)} in ${escapeHtml(commune)}.</p>
        </td></tr>
        <tr><td style="padding:26px 32px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;background:#f5f1ea;border-radius:14px;">
            <tr><td style="padding:20px 22px;">
              <p style="margin:0 0 6px;color:#59645e;font-size:13px;line-height:1.4;">${escapeHtml(label)}</p>
              <p style="margin:0;color:#1a1e2b;font-size:30px;line-height:1.2;font-weight:700;">${escapeHtml(amount)}</p>
              <p style="margin:6px 0 0;color:#59645e;font-size:13px;line-height:1.4;">Outstanding ${escapeHtml(action)}</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:28px 32px 32px;">
          <a href="${escapeHtml(appUrl)}" style="display:inline-block;padding:12px 22px;background:#2d6a4f;border-radius:999px;color:#ffffff;font-size:14px;font-weight:700;line-height:1.2;text-decoration:none;">Open Commune</a>
        </td></tr>
        <tr><td style="padding:22px 32px 28px;border-top:1px solid #e8e1d8;color:#69716b;font-size:12px;line-height:1.6;">
          This reminder concerns ${escapeHtml(commune)}. You can turn reminder emails off in <a href="${escapeHtml(settingsUrl)}" style="color:#2d6a4f;text-decoration:underline;">Commune settings</a>${unsubscribeUrl ? ` or <a href="${escapeHtml(unsubscribeUrl.href)}" style="color:#2d6a4f;text-decoration:underline;">turn them off now</a>` : ""}.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  return { subject, text, html };
}
