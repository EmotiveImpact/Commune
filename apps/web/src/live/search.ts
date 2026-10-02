import { ApiError } from "./api";

export const SEARCH_KINDS = ["commune", "expense", "note", "operation", "fund", "recurring", "member", "template"] as const;
export const SEARCH_MAX_QUERY = 80;
export type SearchKind = typeof SEARCH_KINDS[number];
export type SearchResult = {
  kind: SearchKind;
  id: string;
  communeId: string;
  communeName: string;
  title: string;
  subtitle: string;
  meta: string;
  amountMinor: number | null;
  currency: string;
};
export type SearchResponse = { query: string; items: SearchResult[]; total: number; hasMore: boolean };
export const SEARCH_LABELS: Record<SearchKind, string> = {
  commune: "Communes", expense: "Expenses", note: "Notes", operation: "Tasks & events",
  fund: "Funds", recurring: "Recurring bills", member: "People", template: "Saved splits",
};

// The hosted RPC and local adapter have the same response contract. Reject a
// malformed response instead of sending the user to a guessed or fallback ID.
export function parseSearchResponse(value: unknown): SearchResponse {
  const result = value as Partial<SearchResponse> | null;
  if (!result || typeof result.query !== "string" || !Array.isArray(result.items) ||
      !Number.isSafeInteger(result.total) || result.total! < 0 || typeof result.hasMore !== "boolean" ||
      result.items.length > SEARCH_KINDS.length * 25 || result.items.some(item =>
        !item || !SEARCH_KINDS.includes(item.kind) ||
        [item.id, item.communeId, item.communeName, item.title, item.subtitle, item.meta, item.currency]
          .some(field => typeof field !== "string") || !item.id || !item.communeId ||
        !["GBP", "USD", "EUR"].includes(item.currency) ||
        (item.amountMinor !== null && (!Number.isSafeInteger(item.amountMinor) || item.amountMinor < 0)))) {
    throw new ApiError("Search returned an invalid response. Please try again.", 502);
  }
  return result as SearchResponse;
}
