/**
 * Invitation links carry two display hints, the commune's name and the first
 * name of whoever invited you, so the joining page can greet someone before
 * they sign in. The invitation itself is read from the database only once
 * they have signed in (preview_commune_invite is never open to anonymous
 * callers), and that answer replaces the hints. The hints grant nothing:
 * joining still needs the token, checked by accept_commune_invite against the
 * signed-in account.
 */
export const HINT_LIMIT = 60;

export type InviteHints = { house: string | null; by: string | null };

function clean(value: string | null | undefined): string | null {
  // Letters, numbers, spaces and ordinary punctuation; nothing that reads as markup or a link.
  const text = (value ?? "").replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim();
  if (!text || /:\/\//.test(text)) return null;
  return text.slice(0, HINT_LIMIT);
}

export function firstNameOf(name: string | null | undefined): string | null {
  return clean((name ?? "").trim().split(/\s+/)[0]);
}

/** The link with the commune's name and the inviter's first name added. */
export function withInviteHints(url: URL, house: string | null | undefined, inviterName: string | null | undefined): URL {
  const next = new URL(url.href);
  const h = clean(house), by = firstNameOf(inviterName);
  if (h) next.searchParams.set("house", h); else next.searchParams.delete("house");
  if (by) next.searchParams.set("by", by); else next.searchParams.delete("by");
  return next;
}

export function readInviteHints(search: string): InviteHints {
  const params = new URLSearchParams(search);
  return { house: clean(params.get("house")), by: firstNameOf(params.get("by")) };
}
