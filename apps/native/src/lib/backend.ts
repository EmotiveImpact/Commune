import type { PayLink, PayLinkInput, PayProvider } from "./payLinks";
import { parsePayLinks } from "./payLinks";
import type { Commune, Snapshot, User } from "./types";

/**
 * Everything the phone app asks of Commune. The database stays the authority:
 * every command goes to the same validated server functions the web app uses,
 * and carries a request id so a retry cannot record anything twice.
 */
export interface Backend {
  readonly mode: "demo" | "server";
  me(): Promise<User | null>;
  signIn(email: string, password: string): Promise<User>;
  signOut(): Promise<void>;
  communes(): Promise<Commune[]>;
  snapshot(commune: Commune): Promise<Snapshot>;
  /** "I've sent it": a claim the bill payer confirms. It changes no balance by itself. */
  reportPayment(shareId: string, input: { amountMinor: number; sentOn: string; reference: string | null; requestId: string }): Promise<void>;
  resolveReport(reportId: string, decision: "confirm" | "decline", requestId: string, note?: string): Promise<void>;
  withdrawReport(reportId: string): Promise<void>;
  /**
   * Marks a task done and returns the completion so it can be undone. On
   * someone else's turn, doneBy says who did it: you ("me") or them ("assignee").
   */
  completeTask(operationId: string, input: { expectedDate: string; today: string; requestId: string; doneBy?: "me" | "assignee" }): Promise<string | null>;
  undoCompletion(occurrenceId: string): Promise<void>;
  addExpense(communeId: string, input: {
    title: string; amountMinor: number; category: string; dueOn: string | null; paidByUserId: string;
    shares: Array<{ userId: string; amountMinor: number }>;
  }): Promise<void>;
  nudge(shareId: string, requestId: string): Promise<void>;
  markRead(notificationId: string): Promise<void>;
  myPayLinks(): Promise<PayLink[]>;
  savePayLink(provider: PayProvider, input: PayLinkInput): Promise<PayLink[]>;
  removePayLink(provider: PayProvider): Promise<PayLink[]>;
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * The local development API (apps/local-api), or any server that speaks its
 * routes. It signs in with a session cookie, which the phone's own HTTP stack
 * keeps between requests.
 */
export function serverBackend(base: string): Backend {
  const root = base === "same-origin" ? "" : base.replace(/\/+$/, "");
  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    let response: Response;
    try {
      response = await fetch(`${root}/api${path}`, { credentials: "include", ...init, headers });
    } catch {
      throw new ApiError("Commune can’t be reached. Check your connection and try again.", 0);
    }
    const type = response.headers.get("content-type") ?? "";
    const body: unknown = type.includes("application/json") ? await response.json() : null;
    if (!response.ok) {
      const error = body && typeof body === "object" ? body as Record<string, unknown> : null;
      const message = typeof error?.error === "string" ? error.error : typeof error?.message === "string" ? error.message : `Request failed (${response.status})`;
      throw new ApiError(message, response.status);
    }
    return body as T;
  }
  const post = <T>(path: string, payload: unknown = {}) => call<T>(path, { method: "POST", body: JSON.stringify(payload) });
  return {
    mode: "server",
    async me() { return (await call<{ user: User | null }>("/auth/me")).user; },
    async signIn(email, password) { return (await post<{ user: User }>("/auth/login", { email, password })).user; },
    async signOut() { await post("/auth/logout"); },
    async communes() { return (await call<{ communes: Commune[] }>("/communes")).communes; },
    snapshot: (commune) => call<Snapshot>(`/communes/${encodeURIComponent(commune.id)}/snapshot`),
    async reportPayment(shareId, input) { await post(`/shares/${shareId}/payment-reports`, input); },
    async resolveReport(reportId, decision, requestId, note) {
      await post(`/payment-reports/${reportId}/resolve`, { decision, note: note ?? null, requestId: decision === "confirm" ? requestId : null });
    },
    async withdrawReport(reportId) { await post(`/payment-reports/${reportId}/withdraw`); },
    async completeTask(operationId, input) {
      const result = await post<{ id?: string }>(`/operations/${operationId}/occurrences`, { action: "completed", ...input });
      return result?.id ?? null;
    },
    async undoCompletion(occurrenceId) { await post(`/occurrences/${occurrenceId}/undo`); },
    async addExpense(communeId, input) { await post(`/communes/${communeId}/expenses`, input); },
    async nudge(shareId, requestId) { await post("/reminders", { kind: "nudge", sourceId: shareId, requestId }); },
    async markRead(notificationId) { await post(`/notifications/${notificationId}/read`); },
    async myPayLinks() { return parsePayLinks((await call<{ links: unknown }>("/pay-links")).links); },
    async savePayLink(provider, input) {
      return parsePayLinks((await call<{ links: unknown }>(`/pay-links/${provider}`, { method: "PUT", body: JSON.stringify(input) })).links);
    },
    async removePayLink(provider) {
      return parsePayLinks((await call<{ links: unknown }>(`/pay-links/${provider}`, { method: "DELETE" })).links);
    },
  };
}
