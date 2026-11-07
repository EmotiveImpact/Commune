import assert from "node:assert/strict";
import test from "node:test";
import { renderReminderEmail } from "../src/email.ts";
import { formatMoney } from "../src/money.ts";

test("nudge has branded HTML and a useful plain-text fallback", () => {
  const email = renderReminderEmail({
    kind: "nudge",
    senderName: "Maya Chen",
    communeName: "Park Street",
    label: "Electricity",
    amount: "£42.00",
    appUrl: "https://ourcommune.io",
  });
  assert.equal(email.subject, "A Commune nudge from Maya Chen");
  assert.match(email.text, /£42\.00 expense share for Electricity in Park Street/);
  assert.match(email.html, /<html lang="en">/);
  assert.match(email.html, /#2d6a4f/);
  assert.match(email.html, /#f5f1ea/);
  assert.match(email.html, /#1a1e2b/);
  assert.match(email.html, /href="https:\/\/ourcommune\.io"/);
  assert.match(email.html, /href="https:\/\/ourcommune\.io\/settings"/);
});

test("chase labels its pledge and escapes all member-controlled HTML", () => {
  const email = renderReminderEmail({
    kind: "chase",
    senderName: 'Alex <script>alert("x")</script>\r\nBcc: someone@example.test',
    communeName: 'The "Studio" & Co',
    label: '<img src=x onerror="alert(1)">',
    amount: "£60.00",
    appUrl: "https://ourcommune.io",
  });
  assert.match(email.text, /fund pledge/);
  assert.match(email.html, /Outstanding fund pledge/);
  assert.match(email.html, /&lt;script&gt;/);
  assert.match(email.html, /&quot;Studio&quot; &amp; Co/);
  assert.match(email.html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.doesNotMatch(email.html, /<script\b|<img\b/i);
  assert.doesNotMatch(email.subject, /[\r\n]/);
  assert.match(email.subject, /Bcc: someone@example\.test/);
});

test("links reject non-HTTPS app origins", () => {
  assert.throws(() => renderReminderEmail({
    kind: "nudge",
    senderName: "Maya",
    communeName: "Park",
    label: "Gas",
    amount: "£20.00",
    appUrl: "javascript:alert(1)",
  }), /HTTPS/);
});

test("offers a one-click link to turn reminder emails off when one is given", () => {
  const unsubscribeUrl = "https://worker.example.test/unsubscribe?u=user-1&s=abc";
  const email = renderReminderEmail({
    kind: "nudge",
    senderName: "Maya Chen",
    communeName: "Park Street",
    label: "Electricity",
    amount: "£42.00",
    appUrl: "https://ourcommune.io",
    unsubscribeUrl,
  });
  assert.match(email.text, /turn reminder emails off in Commune settings: https:\/\/ourcommune\.io\/settings/);
  assert.ok(email.text.includes(`Or turn them off now: ${unsubscribeUrl}`));
  assert.ok(email.html.includes('href="https://worker.example.test/unsubscribe?u=user-1&amp;s=abc"'));
  const plain = renderReminderEmail({
    kind: "nudge", senderName: "Maya", communeName: "Park", label: "Gas", amount: "£20.00", appUrl: "https://ourcommune.io",
  });
  assert.doesNotMatch(plain.text, /turn them off now/i);
  assert.doesNotMatch(plain.html, /turn them off now/i);
  assert.throws(() => renderReminderEmail({
    kind: "nudge", senderName: "Maya", communeName: "Park", label: "Gas", amount: "£20.00",
    appUrl: "https://ourcommune.io", unsubscribeUrl: "http://worker.example.test/unsubscribe",
  }), /HTTPS/);
});

test("amounts read as the app writes them, with each currency's own symbol", () => {
  assert.equal(formatMoney(3210, "USD"), "$32.10");
  assert.equal(formatMoney(4200, "GBP"), "£42.00");
  assert.equal(formatMoney(123456, "EUR"), "€1,234.56");
  const email = renderReminderEmail({
    kind: "nudge",
    senderName: "Maya Chen",
    communeName: "Brooklyn loft",
    label: "Internet",
    amount: formatMoney(3210, "USD"),
    appUrl: "https://ourcommune.io",
  });
  assert.match(email.text, /\$32\.10 expense share for Internet in Brooklyn loft/);
  assert.doesNotMatch(email.text, /US\$/);
});

test("invitation email carries the join link as a button and as a QR code drawn only at send time", async () => {
  const { renderInvitationEmail, completeInvitationHtml, invitationUrl, qrTable } = await import("../src/invitations.ts");
  const token = "cd".repeat(32);
  const email = renderInvitationEmail({ commune: "Park House", inviter: "Alice", role: "member", expires: "2026-11-14", appUrl: "https://example.test", inviteId: "3f2b6c1e-9a7d-4c2b-8e1f-0a1b2c3d4e5f" });
  // The stored payload never holds the token or its QR.
  assert.ok(email.html.includes("COMMUNE_INVITATION_QR"));
  assert.ok(!email.html.includes(token));
  assert.match(email.text, /On a computer\? Open this email on your phone/);
  const html = completeInvitationHtml(email.html, "https://example.test", token);
  assert.ok(!html.includes("COMMUNE_INVITATION"), "every placeholder is filled");
  assert.ok(html.includes(`href="${invitationUrl("https://example.test", token)}"`));
  assert.ok(html.includes(qrTable(invitationUrl("https://example.test", token))));
  assert.match(html, /Scan this with your phone’s camera/);
  // Gmail cuts off messages over about 102 KB.
  assert.ok(Buffer.byteLength(html) < 80_000, `email is ${Buffer.byteLength(html)} bytes`);
});

test("QR table has a square grid with a quiet border", async () => {
  const { qrTable } = await import("../src/invitations.ts");
  const table = qrTable("https://example.test/invite?token=" + "ef".repeat(32));
  const rows = table.match(/<tr>/g).length;
  const columns = table.match(/<tr>(.*?)<\/tr>/)[1].match(/<td /g).length;
  assert.equal(rows, columns + 1, "one ruler row plus one row per module");
  // The first and last module rows are quiet (all white), as cameras need.
  const moduleRows = table.match(/<tr>(.*?)<\/tr>/g).slice(1);
  for (const row of [moduleRows[0], moduleRows.at(-1)]) assert.ok(!row.includes("#111111"));
});
