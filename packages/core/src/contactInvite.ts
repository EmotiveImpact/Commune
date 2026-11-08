/**
 * Inviting one person you picked from your contacts: the message, and the
 * WhatsApp and text links that open with it filled in. The phone number is
 * used only to build these links on the sender's own device. Commune never
 * receives it.
 *
 * apps/native/src/lib/contactInvite.ts is a copy of this file (the phone app
 * keeps its own dependencies); apps/web/tests/contactInvite.test.ts fails when
 * the two differ.
 */

export type InviteChannel = "whatsapp" | "text" | "link";
export type InviteCommuneKind = "household" | "workspace" | "trip";

/** The calling code to assume for a number written without one, from the commune's currency. */
export function defaultCallingCode(currency: string | null | undefined): string | null {
  if (currency === "GBP") return "44";
  if (currency === "USD") return "1";
  return null;
}

/**
 * A phone number as WhatsApp wants it in a wa.me link: digits only, with the
 * country code and no leading zero or plus. Null when it can't be read, so the
 * caller opens WhatsApp without a chosen chat instead.
 *   "+44 7700 900412", "0044 7700 900412" and "07700 900412" (in a GBP commune) -> "447700900412"
 */
export function whatsAppNumber(raw: string | null | undefined, callingCode: string | null = "44"): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  let digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) {
    // Already international.
  } else if (digits.startsWith("00")) {
    digits = digits.slice(2);
  } else if (callingCode === "1" && digits.length === 11 && digits.startsWith("1")) {
    // A US number written with its leading 1.
  } else if (callingCode && digits.startsWith("0")) {
    digits = callingCode + digits.slice(1);
  } else if (callingCode === "1" && digits.length === 10) {
    digits = "1" + digits;
  } else {
    return null;
  }
  // UK numbers written as +44 (0)7700 ... keep a stray zero after the code.
  if (digits.startsWith("440")) digits = "44" + digits.slice(3);
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

/** A number for an sms: link: the plus and digits only. */
export function textNumber(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  return (trimmed.startsWith("+") ? "+" : "") + trimmed.replace(/\D/g, "");
}

/** Opens WhatsApp on that person's chat with the message ready, or on the chat picker when there is no number. */
export function whatsAppLink(number: string | null, message: string): string {
  const text = encodeURIComponent(message);
  return number ? `https://wa.me/${number}?text=${text}` : `https://wa.me/?text=${text}`;
}

/** Opens Messages with the text ready. iPhones read "&body=" after the number, everything else "?body=". */
export function textLink(raw: string | null | undefined, message: string, apple: boolean): string {
  const number = textNumber(raw);
  return `sms:${number}${apple ? "&" : "?"}body=${encodeURIComponent(message)}`;
}

/** The first word of a name, for "Hey Maya". */
export function inviteFirstName(name: string | null | undefined): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

/**
 * The invitation message, written as the sender would. It has no link: the
 * link is made only when they send it, so a message never sent leaves no
 * invitation behind. withInviteLink adds it.
 */
export function inviteMessage(input: { name: string | null | undefined; communeName: string; kind: InviteCommuneKind }): string {
  const first = inviteFirstName(input.name);
  const what = input.kind === "trip" ? "trip costs" : input.kind === "workspace" ? "shared costs and jobs" : "bills and chores";
  return `${first ? `Hey ${first}` : "Hi"}, join ${input.communeName} on Commune so we can keep ${what} fair.`;
}

/** The message as sent: their words, then the link on its own line. */
export function withInviteLink(message: string, url: string): string {
  const words = message.trim();
  return words ? `${words}\n${url}` : url;
}

/** How an invitation went, for the admin's list: "Sent on WhatsApp". */
export function sentViaWords(channel: string | null | undefined): string {
  if (channel === "whatsapp") return "Sent on WhatsApp";
  if (channel === "text") return "Sent by text";
  return "Link shared";
}
