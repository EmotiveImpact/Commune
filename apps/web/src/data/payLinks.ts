import type { CurrencyCode } from "../live/model";

/**
 * How a person likes to be paid. The database keeps only usernames and UK
 * bank details; links are built here. Commune never moves money: a link opens
 * the payer's own app, and they report the payment in Commune afterwards.
 */
export type PayProvider = "monzo" | "paypal" | "revolut" | "bank";
export type PayLink = {
  provider: PayProvider;
  handle: string | null;
  accountName: string | null;
  sortCode: string | null;
  accountNumber: string | null;
};
export type PayLinkInput = {
  handle?: string; accountName?: string; sortCode?: string; accountNumber?: string;
};

export const PAY_PROVIDERS: PayProvider[] = ["monzo", "paypal", "revolut", "bank"];
export const PAY_PROVIDER_NAME: Record<PayProvider, string> = {
  monzo: "Monzo", paypal: "PayPal", revolut: "Revolut", bank: "Bank transfer",
};
const HOST: Record<Exclude<PayProvider, "bank">, string> = {
  monzo: "monzo.me", paypal: "paypal.me", revolut: "revolut.me",
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Reads links from the API or snapshot, dropping anything malformed. */
export function parsePayLinks(value: unknown): PayLink[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): PayLink[] => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const provider = row.provider;
    if (typeof provider !== "string" || !PAY_PROVIDERS.includes(provider as PayProvider)) return [];
    const link: PayLink = {
      provider: provider as PayProvider, handle: text(row.handle), accountName: text(row.accountName),
      sortCode: text(row.sortCode), accountNumber: text(row.accountNumber),
    };
    if (link.provider === "bank" ? !(link.accountName && link.sortCode && link.accountNumber) : !link.handle) return [];
    return [link];
  }).sort((a, b) => PAY_PROVIDERS.indexOf(a.provider) - PAY_PROVIDERS.indexOf(b.provider));
}

/** 204577 becomes 20-45-77. */
export function formatSortCode(value: string | null): string {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length === 6 ? `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}` : digits;
}

/** The short address shown under a link, for example monzo.me/samokafor. */
export function payLinkLabel(link: PayLink): string {
  if (link.provider === "bank") return `${link.accountName} · ${formatSortCode(link.sortCode)} · ${link.accountNumber}`;
  return `${HOST[link.provider]}/${link.handle}`;
}

/**
 * The link to open, with the amount filled in where the provider supports it:
 * Monzo.me takes pounds only, PayPal.me takes an amount and currency, and
 * Revolut.me opens the profile. Bank transfers have no link.
 */
export function payLinkHref(link: PayLink, amountMinor: number, currency: CurrencyCode, note?: string):
  { href: string; amountFilled: boolean } | null {
  if (link.provider === "bank" || !link.handle) return null;
  const handle = encodeURIComponent(link.handle);
  const amount = amountMinor > 0 ? (amountMinor / 100).toFixed(2) : "";
  if (link.provider === "monzo" && amount && currency === "GBP") {
    const description = note?.trim() ? `?d=${encodeURIComponent(note.trim().slice(0, 40))}` : "";
    return { href: `https://monzo.me/${handle}/${amount}${description}`, amountFilled: true };
  }
  if (link.provider === "paypal" && amount) {
    return { href: `https://paypal.me/${handle}/${amount}${currency}`, amountFilled: true };
  }
  return { href: `https://${HOST[link.provider]}/${handle}`, amountFilled: false };
}

/** Bank details as one line, for copying into a banking app. */
export function bankDetailsText(link: PayLink): string {
  return `${link.accountName}\nSort code ${formatSortCode(link.sortCode)}\nAccount ${link.accountNumber}`;
}
