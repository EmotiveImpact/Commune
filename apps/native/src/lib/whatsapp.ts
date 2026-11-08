/**
 * WhatsApp, where the house already talks. Commune has no chat of its own:
 * a commune can link its WhatsApp group, and bills, tasks and nudges can be
 * shared into a chat as a short message with a link back to Commune. Commune
 * sends nothing itself; WhatsApp opens with the message ready and the person
 * picks the chat. The same rules as the web app (apps/web/src/data/whatsapp.ts).
 */

/** Links in a message go to the web app, which works for people without the phone app. */
export const APP_ORIGIN = "https://app.ourcommune.io";

/** The only kind of link the database stores (0045): a group invite link. */
export const GROUP_LINK = /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{10,40}$/;
const PASTED = /^(?:https?:\/\/)?(?:www\.)?chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9]{10,40})\/?(?:[?#].*)?$/i;

/** What people paste, tidied: "" to remove the link, null when it is not a group invite link. */
export function tidyGroupLink(text: string): string | null {
  const value = text.trim();
  if (!value) return "";
  const code = PASTED.exec(value)?.[1];
  return code ? `https://chat.whatsapp.com/${code}` : null;
}

/** A stored link, only if it is still a group invite link. Anything else is never opened. */
export function groupLink(value: unknown): string {
  return typeof value === "string" && GROUP_LINK.test(value) ? value : "";
}

/** Opens WhatsApp with the text ready; the person picks the chat. */
export function shareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** A Commune address in the web app, as a full link. */
export function appLink(path: string, params: Record<string, string> = {}): string {
  const query = new URLSearchParams(params).toString();
  return `${APP_ORIGIN}${path}${query ? `?${query}` : ""}`;
}

const first = (name: string) => name.trim().split(/\s+/)[0] || name;

/** A bill: what it was, who paid, and the share, with a link to see and settle it. */
export function billMessage(input: {
  title: string; amount: string; payerName: string; communeName: string; link: string;
  due?: string; shareAmount?: string;
}): string {
  return [
    `🧾 ${input.title} in ${input.communeName}: ${input.amount}, paid by ${first(input.payerName)}.`,
    [input.shareAmount ? `Each share is ${input.shareAmount}.` : "", input.due ? `Due ${input.due}.` : ""].filter(Boolean).join(" "),
    `See your share and settle up in Commune: ${input.link}`,
  ].filter(Boolean).join("\n");
}

/** A task: whose turn it is and when it is due ("Monday 10 November"), with a link to tick it off. */
export function taskMessage(input: {
  title: string; communeName: string; link: string; when: string; holderName?: string; yours?: boolean;
}): string {
  const who = input.yours ? "my turn" : input.holderName ? `${first(input.holderName)}’s turn` : "up for grabs";
  return [`🧹 ${input.title} in ${input.communeName}: ${who}, due ${input.when}.`, `Tick it off in Commune when it’s done: ${input.link}`].join("\n");
}

/** A friendly nudge from the person owed, to send in a chat instead of, or as well as, a reminder. */
export function nudgeMessage(input: { name: string; amount: string; subject: string; link: string }): string {
  return [`👋 Hi ${first(input.name)}, a gentle reminder about ${input.amount} for ${input.subject}.`,
    `It’s all in Commune: ${input.link}`].join("\n");
}
