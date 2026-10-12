import type { Commune, Expense, ExpensePage, Snapshot, User } from "./model";
import { currentViewer } from "./session";

// Pass already-verified identity and commune metadata through one refresh.
// Every database request still authenticates and enforces RLS on the server.
export async function loadCommunes(user: User): Promise<{ communes: Commune[] }> {
  if (import.meta.env.PROD) {
    const { listCommunes } = await import("./neon");
    return { communes: await listCommunes(user) };
  }
  return api("/communes");
}

/** A summary is what the overview screens show of a commune that is not open. */
export async function loadSnapshot(commune: Commune, detail?: "summary"): Promise<Snapshot> {
  if (import.meta.env.PROD) {
    const { snapshot } = await import("./neon");
    return snapshot(commune.id, commune, detail);
  }
  return api(`/communes/${encodeURIComponent(commune.id)}/snapshot${detail ? "?detail=summary" : ""}`);
}

/**
 * Expenses older than the snapshot holds, created in the `months` calendar
 * months (UTC) before `before`, or all of them when months is left out.
 * Without `before`, the page starts where the snapshot's expenses do.
 */
export function loadExpensePage(communeId: string, before: string | null, months?: number): Promise<ExpensePage> {
  const query = new URLSearchParams({ ...(before ? { before } : {}), ...(months ? { months: String(months) } : {}) }).toString();
  return api(`/communes/${encodeURIComponent(communeId)}/expenses/history${query ? `?${query}` : ""}`);
}

/** Named expenses of one commune, at most 50, for links to ones not loaded. */
export function loadExpenseRecords(communeId: string, ids: string[]): Promise<{ expenses: Expense[] }> {
  return api(`/communes/${encodeURIComponent(communeId)}/expenses/records?ids=${ids.map(encodeURIComponent).join(",")}`);
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (import.meta.env.PROD) {
    const { neonApi } = await import("./neon");
    return neonApi<T>(path, init);
  }
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  // The server refuses a request for any account but the one on screen.
  const viewer = currentViewer();
  if (viewer) headers.set("X-Commune-Viewer", viewer);
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    ...init,
    headers,
  });
  let body: unknown = null;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    body = await response.json();
  } else if (response.status !== 204) {
    body = await response.text();
  }
  if (response.ok && response.status !== 204 && !contentType.includes("application/json")) {
    throw new ApiError("Commune's application service did not return JSON", 502);
  }
  if (!response.ok) {
    const error = body && typeof body === "object" ? body as Record<string, unknown> : null;
    const message = typeof error?.error === "string"
      ? error.error
      : typeof error?.message === "string"
        ? error.message
        : typeof body === "string" && body.length < 240
          ? body
          : `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }
  return body as T;
}

export function post<T>(path: string, payload: unknown): Promise<T> {
  return api<T>(path, { method: "POST", body: JSON.stringify(payload) });
}
