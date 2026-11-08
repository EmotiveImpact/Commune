import type { PayLink, PayLinkInput, PayProvider } from "./payLinks";
import { parsePayLinks } from "./payLinks";
import type { Commune, CurrencyCode, Operation, Snapshot, User } from "./types";
import { requestId } from "./format";
import type { JoinCode, JoinCodeKind, JoinCodePreview, JoinMode, JoinResult, JoinState } from "./joinCodes";
import type { InviteChannel } from "./contactInvite";

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
  /** Demo only: the next sign-in starts an empty account, as a new person would have, not the sample one. */
  startFresh?(name?: string): void;
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
    /** Lets a resend after a dropped connection count once. */
    requestId?: string;
  }): Promise<void>;
  nudge(shareId: string, requestId: string): Promise<void>;
  markRead(notificationId: string): Promise<void>;
  myPayLinks(): Promise<PayLink[]>;
  savePayLink(provider: PayProvider, input: PayLinkInput): Promise<PayLink[]>;
  removePayLink(provider: PayProvider): Promise<PayLink[]>;
  /** Mark one of your links as your favourite, or none (null). */
  setPreferredPayLink(provider: PayProvider | null): Promise<PayLink[]>;
  /** Creates an invitation for that email address and returns the link to send them. */
  invite(communeId: string, email: string, role?: "member" | "admin"): Promise<{ url: string }>;
  /** Emails that invitation to its address from Commune, with a Join button and a QR code to scan from a computer. */
  emailInvitation(token: string): Promise<void>;
  /**
   * A personal invitation: a link for one person you name (picked from your
   * contacts or typed), to send on WhatsApp or by text. It works once, for
   * seven days. Their phone number never leaves the phone.
   */
  invitePerson(communeId: string, name: string, sentVia: InviteChannel): Promise<{ url: string }>;
  /** Admins only: invitations nobody has used yet, newest first. */
  waitingInvites(communeId: string): Promise<WaitingInvite[]>;
  /** Adds a note: a title, an optional short line, and labelled details such as a Wi-Fi password. */
  addNote(communeId: string, input: NoteInput): Promise<void>;
  /** Adds a chore, on one person, taken in turns, or open to anyone, once or repeating. */
  addTask(communeId: string, input: TaskInput): Promise<void>;
  /** Posts an announcement to everyone in the commune. */
  announce(communeId: string, input: { title: string; body: string; needsAcknowledgement: boolean }): Promise<void>;
  /** "I'll do it": takes a chore nobody has yet. expectedDate rejects a stale screen. */
  claimTask(operationId: string, input: { toMemberId: string; expectedDate: string; today: string; requestId: string }): Promise<void>;
  /** Starts a new commune with you as its admin, and returns its id. */
  createCommune(input: { name: string; kind: "household" | "workspace" | "trip"; currency: CurrencyCode; address?: string | null; destination?: string | null }): Promise<string>;
  /** Records money you put into a shared pot against your pledge. Returns the contribution, so it can be undone. */
  contribute(commitmentId: string, amountMinor: number, requestId: string): Promise<string>;
  /** Takes a contribution back off the record, keeping it with a reason. */
  voidContribution(contributionId: string, reason: string): Promise<void>;
  /** Pauses or resumes a repeating bill. Bills already added stay as they are. */
  setRecurringPaused(billId: string, paused: boolean): Promise<void>;
  /** Saves changes to a repeating bill from the version you opened. */
  saveRecurring(communeId: string, input: RecurringInput): Promise<void>;
  /** What an invitation is for, before joining. Null when it has expired or been used. */
  previewInvite(token: string): Promise<InvitePreview | null>;
  /** Joins the commune an invitation is for, and returns its id. */
  acceptInvite(token: string): Promise<string>;
  /** Reads the amount, shop and date from a receipt photo, for the person to check. */
  readReceipt(uri: string): Promise<ReceiptReading>;

  // ---- Editing (communes, bills, chores, notes, announcements) ----
  /** Changes a commune's name, kind, place and currency. Admins only; the server refuses a currency change once there are bills. */
  updateCommune(communeId: string, input: CommuneEdit): Promise<void>;
  /** Leaves a commune. */
  leaveCommune(communeId: string, userId: string): Promise<void>;
  /** Corrects a bill from the version you opened. The before and after are kept with your reason. */
  correctExpense(expenseId: string, input: ExpenseCorrection): Promise<void>;
  /** Takes a bill off the books, keeping it and the reason on record. */
  voidExpense(expenseId: string, input: { expectedVersion: number; reason: string; requestId: string }): Promise<void>;
  /** Changes a chore or event from the version you opened. */
  updateTask(operation: Operation, input: TaskEdit): Promise<void>;
  /** Removes a chore or event. Its history is kept. */
  removeTask(operationId: string): Promise<void>;
  /** Changes a note from the version you opened; earlier versions are kept. */
  updateNote(noteId: string, input: NoteInput & { expectedVersion: number }): Promise<void>;
  /** Removes a note. Its history is kept. */
  removeNote(noteId: string): Promise<void>;
  /** Takes an announcement down for everyone. */
  archiveAnnouncement(announcementId: string): Promise<void>;

  // ---- Joining by QR code ----
  /** The commune's join setting, its working QR codes and who is waiting. Codes and requests are empty for non-admins. */
  joinState(communeId: string): Promise<JoinState>;
  /** Admins only: how a scan joins (approve, instant or off). Email invitations are unaffected. */
  setJoinMode(communeId: string, mode: JoinMode): Promise<JoinState>;
  /** Admins only: a QR code for now (an hour) or a sticker (until turned off; a new one replaces the old). */
  createJoinCode(communeId: string, kind: JoinCodeKind, requestId: string): Promise<JoinCode>;
  revokeJoinCode(codeId: string): Promise<void>;
  /** What a scanned code shows: name, kind, head count. Null when it no longer works. */
  previewJoinCode(token: string): Promise<JoinCodePreview | null>;
  requestToJoin(token: string, requestId: string): Promise<JoinResult>;
  /** Admins only: approve adds them as an ordinary member. */
  decideJoinRequest(requestId: string, decision: "approve" | "decline"): Promise<JoinState>;
}

export type CommuneEdit = {
  name: string; kind: "household" | "workspace" | "trip"; currency: CurrencyCode;
  address: string | null; destination: string | null; stayName: string | null; stayAddress: string | null;
};
export type ExpenseCorrection = {
  expectedVersion: number; title: string; amountMinor: number; category: string; dueOn: string | null; paidByUserId: string;
  shares: Array<{ userId: string; amountMinor: number }>; reason: string; requestId: string;
};
export type TaskEdit = {
  expectedVersion: number; title: string; date: string; assigneeId: string | null; rotationIds: string[] | null;
  repeat: "none" | "weekly" | "monthly"; notes: string | null;
};

export type RecurringInput = {
  id: string; expectedVersion: number; title: string; amountMinor: number; paidByUserId: string;
  allocations: Array<{ userId: string; amountMinor: number }>; frequency: "weekly" | "monthly"; nextDueOn: string;
};

/** An invitation still waiting: for a named person, or for an email address. */
export type WaitingInvite = { id: string; name: string; email: boolean; sentVia: InviteChannel | null; createdAt: string };

export type InvitePreview = {
  communeName: string;
  kind?: "household" | "workspace" | "trip";
  /** Who sent it, when the server says. */
  inviterName?: string;
  /** Who is in it already, when the server says. */
  people?: string[];
};

export type ReceiptReading = { amountMinor: number | null; title: string | null; date: string | null };

export type NoteInput = { title: string; pill: string | null; lede: string | null; body: string | null; facts: Array<[string, string]> };
export type TaskInput = { title: string; date: string; assigneeId: string | null; rotationIds: string[] | null; repeat: "none" | "weekly" | "monthly"; notes: string | null };

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
  const send = <T>(method: "PUT" | "PATCH", path: string, payload: unknown) => call<T>(path, { method, body: JSON.stringify(payload) });
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
    async addNote(communeId, input) {
      await post(`/communes/${communeId}/notes`, { ...input, kicker: null, requestId: requestId() });
    },
    async addTask(communeId, input) {
      await post(`/communes/${communeId}/operations`, {
        kind: "task", category: "chore", title: input.title, date: input.date, time: null, allDay: true,
        assigneeId: input.assigneeId, rotationIds: input.rotationIds, repeat: input.repeat, notes: input.notes, requestId: requestId(),
      });
    },
    async announce(communeId, input) {
      await post(`/communes/${communeId}/announcements`, { ...input, requestId: requestId() });
    },
    async claimTask(operationId, input) {
      await post(`/operations/${operationId}/handovers`, { ...input, expectedAssigneeId: null, reason: null });
    },
    async createCommune(input) {
      return (await post<{ id: string }>("/communes", input)).id;
    },
    async contribute(commitmentId, amountMinor, request) {
      return (await post<{ id: string }>(`/commitments/${commitmentId}/contributions`, { amountMinor, requestId: request })).id;
    },
    async voidContribution(contributionId, reason) { await post(`/contributions/${contributionId}/void`, { reason }); },
    async setRecurringPaused(billId, paused) { await post(`/recurring/${billId}/pause`, { paused }); },
    async saveRecurring(communeId, input) { await post(`/communes/${communeId}/recurring`, input); },
    async invite(communeId, email, role = "member") {
      const result = await post<{ url: string }>(`/communes/${communeId}/invites`, { email, role });
      return { url: result.url };
    },
    async emailInvitation(token) { await post("/invitation-email", { token }); },
    async invitePerson(communeId, name, sentVia) {
      const result = await post<{ url: string }>(`/communes/${communeId}/invites`, { name, sentVia });
      return { url: result.url };
    },
    async waitingInvites(communeId) {
      const result = await call<{ invites: Array<{ id: string; email: string | null; inviteeName?: string | null; sentVia?: string | null;
        createdAt: string; expiresAt: string; acceptedAt: string | null; revokedAt: string | null }> }>(`/communes/${communeId}/invites`);
      const now = Date.now();
      return result.invites
        .filter((invite) => !invite.acceptedAt && !invite.revokedAt && Date.parse(invite.expiresAt) > now && (invite.inviteeName || invite.email))
        .map((invite) => ({
          id: invite.id, name: invite.inviteeName ?? invite.email ?? "", email: !invite.inviteeName,
          sentVia: invite.sentVia === "whatsapp" || invite.sentVia === "text" || invite.sentVia === "link" ? invite.sentVia : null,
          createdAt: invite.createdAt,
        }));
    },
    async myPayLinks() { return parsePayLinks((await call<{ links: unknown }>("/pay-links")).links); },
    async savePayLink(provider, input) {
      return parsePayLinks((await call<{ links: unknown }>(`/pay-links/${provider}`, { method: "PUT", body: JSON.stringify(input) })).links);
    },
    async removePayLink(provider) {
      return parsePayLinks((await call<{ links: unknown }>(`/pay-links/${provider}`, { method: "DELETE" })).links);
    },
    async setPreferredPayLink(provider) {
      return parsePayLinks((await call<{ links: unknown }>("/pay-links-preferred", { method: "PUT", body: JSON.stringify({ provider }) })).links);
    },
    async previewInvite(token) {
      const result = await call<{ invite: { communeName: string } | null }>(`/invites/${encodeURIComponent(token)}`);
      return result.invite ? { communeName: result.invite.communeName } : null;
    },
    async acceptInvite(token) {
      return (await post<{ communeId: string }>(`/invites/${encodeURIComponent(token)}/accept`)).communeId;
    },
    async joinState(communeId) { return await call<JoinState>(`/communes/${communeId}/join`); },
    async setJoinMode(communeId, mode) { return await post<JoinState>(`/communes/${communeId}/join-mode`, { mode, requestId: requestId() }); },
    async createJoinCode(communeId, kind, request) {
      return await post<JoinCode>(`/communes/${communeId}/join-codes`, { kind, requestId: request });
    },
    async revokeJoinCode(codeId) { await post(`/join-codes/${codeId}/revoke`); },
    async previewJoinCode(token) {
      return (await call<{ preview: JoinCodePreview | null }>(`/join/${encodeURIComponent(token)}`)).preview;
    },
    async requestToJoin(token, request) { return await post<JoinResult>(`/join/${encodeURIComponent(token)}`, { requestId: request }); },
    async decideJoinRequest(id, decision) { return await post<JoinState>(`/join-requests/${id}/${decision}`); },
    async readReceipt() {
      // No server reads receipts yet; the photo stays on the phone and the person fills the details in.
      throw new ApiError("Reading receipts isn’t available yet", 501);
    },

    // ---- Editing ----
    async updateCommune(communeId, input) { await send("PATCH", `/communes/${communeId}`, input); },
    async leaveCommune(communeId, userId) { await post(`/communes/${communeId}/members/${userId}`, { action: "leave" }); },
    async correctExpense(expenseId, input) { await send("PUT", `/expenses/${expenseId}`, input); },
    async voidExpense(expenseId, input) { await post(`/expenses/${expenseId}/void`, input); },
    async updateTask(operation, input) {
      await send("PUT", `/operations/${operation.id}`, {
        expectedVersion: input.expectedVersion, kind: operation.kind, category: operation.category ?? (operation.kind === "task" ? "chore" : "other"),
        title: input.title, date: input.date, time: operation.time ? operation.time.slice(0, 5) : null, allDay: operation.allDay ?? !operation.time,
        assigneeId: input.assigneeId, rotationIds: input.rotationIds, repeat: input.repeat, notes: input.notes,
      });
    },
    async removeTask(operationId) { await call(`/operations/${operationId}`, { method: "DELETE" }); },
    async updateNote(noteId, input) { await send("PUT", `/notes/${noteId}`, { ...input, kicker: null }); },
    async removeNote(noteId) { await call(`/notes/${noteId}`, { method: "DELETE" }); },
    async archiveAnnouncement(announcementId) { await post(`/announcements/${announcementId}/archive`); },
  };
}
