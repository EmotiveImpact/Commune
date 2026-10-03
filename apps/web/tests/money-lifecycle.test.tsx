import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "../src/App";
import { AppProvider, useApp, type AppState } from "../src/state";
import { api, post, loadCommunes, loadSnapshot, ApiError } from "../src/live/api";
import type { Commune, Snapshot } from "../src/live/model";

vi.mock("../src/live/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/live/api")>()),
  api: vi.fn(), post: vi.fn(), loadCommunes: vi.fn(), loadSnapshot: vi.fn(),
}));

const user = { id: "user-1", name: "Test Person", email: "test@example.test", emailVerified: true };
const commune: Commune = { id: "home-1", name: "Our home", kind: "household", currency: "GBP", role: "admin" };
const initial: Snapshot = {
  commune,
  members: [
    { userId: user.id, name: user.name, role: "admin", active: true },
    { userId: "user-2", name: "Housemate", role: "member", active: true },
  ],
  expenses: [], funds: [], notes: [], operations: [], notifications: [], reminderTargets: [], sentReminders: [],
  recurringBills: [], splitTemplates: [], activityEvents: [],
};
const usage = { totalUsed: 0, totalLimit: 60, recipientLimit: 8, recipientUsage: {}, nextSlotAt: null };
let current: Snapshot;
let app: AppState;
function Capture() { app = useApp(); return null; }
function mount(path: string) {
  const location = memoryLocation({ path, record: true });
  render(<Router hook={location.hook}><AppProvider><Capture /><App /></AppProvider></Router>);
  return location;
}
const modalDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const closeDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
const originalScroll = Element.prototype.scrollIntoView;
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); } });
});
afterAll(() => {
  Element.prototype.scrollIntoView = originalScroll;
  if (modalDescriptor) Object.defineProperty(HTMLDialogElement.prototype, "showModal", modalDescriptor);
  else delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).showModal;
  if (closeDescriptor) Object.defineProperty(HTMLDialogElement.prototype, "close", closeDescriptor);
  else delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).close;
});
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  current = structuredClone(initial);
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === "/auth/me") return { user };
    if (path === "/reminders/usage") return usage;
    if (path.endsWith("/invites")) return { invites: [] };
    return { id: "new-id", ok: true };
  });
  vi.mocked(post).mockResolvedValue({ id: "new-id", ok: true });
  vi.mocked(loadCommunes).mockResolvedValue({ communes: [commune] });
  vi.mocked(loadSnapshot).mockImplementation(async () => current);
});
afterEach(cleanup);

/** An overdue bill the viewer paid, with one outstanding share. */
function owedExpense(): Snapshot["expenses"][number] {
  return {
    id: "expense-1", title: "House supplies", category: "Other", amountMinor: 2400, paidByUserId: user.id,
    dueOn: "2026-01-05", createdAt: "2026-01-01T10:00:00Z",
    shares: [
      { id: "share-own", userId: user.id, amountMinor: 1200, settledMinor: 1200 },
      { id: "share-1", userId: "user-2", amountMinor: 1200, settledMinor: 0 },
    ],
  };
}
function nudgeTarget(): Snapshot["reminderTargets"][number] {
  return { kind: "nudge", sourceId: "share-1", recipientUserId: "user-2", amountMinor: 1200, currency: "GBP", label: "House supplies", dueOn: "2026-01-05", lastSentAt: null };
}
const reminderPosts = () => vi.mocked(post).mock.calls.filter(([path]) => path === "/reminders");

describe("one Nudge/Chase interaction at every entry point", () => {
  beforeEach(() => {
    current.expenses = [owedExpense()];
    current.reminderTargets = [nudgeTarget()];
  });

  it("previews from the expense window and sends nothing until confirmed", async () => {
    vi.mocked(post).mockImplementation(async (path) => path === "/reminders"
      ? { id: "reminder-1", duplicate: false, emailStatus: "none" } : { id: "new-id", ok: true });
    mount("/expenses");
    fireEvent.click(await screen.findByRole("button", { name: /House supplies/ }));
    const windowFrame = await screen.findByRole("dialog", { name: "House supplies" });
    fireEvent.click(within(windowFrame).getByRole("button", { name: "Nudge" }));
    const preview = screen.getByRole("dialog", { name: "A gentle reminder for Housemate" });
    expect(within(preview).getByText(/£12.00 outstanding for House supplies/)).toBeTruthy();
    expect(within(preview).getByText("Nudge · expense share")).toBeTruthy();
    expect(reminderPosts()).toHaveLength(0);
    fireEvent.click(within(preview).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "A gentle reminder for Housemate" })).toBeNull();
    expect(reminderPosts()).toHaveLength(0);

    fireEvent.click(within(windowFrame).getByRole("button", { name: "Nudge" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Send reminder" })); });
    expect(reminderPosts()).toHaveLength(1);
    expect(reminderPosts()[0][1]).toMatchObject({ kind: "nudge", sourceId: "share-1" });
    expect((reminderPosts()[0][1] as { requestId: string }).requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect((await screen.findByRole("status")).textContent)
      .toBe("Nudge recorded. Housemate will see it in Commune. No email was sent for this reminder.");
  });

  it("keeps the expense window open when Escape closes only the reminder preview", async () => {
    mount("/expenses");
    fireEvent.click(await screen.findByRole("button", { name: /House supplies/ }));
    const windowFrame = await screen.findByRole("dialog", { name: "House supplies" });
    fireEvent.click(within(windowFrame).getByRole("button", { name: "Nudge" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(app.window).toBe("expense");
  });

  it("uses the same preview and the same explanation from Settle", async () => {
    mount("/settle");
    fireEvent.click(await screen.findByRole("button", { name: "Nudge" }));
    const preview = screen.getByRole("dialog", { name: "A gentle reminder for Housemate" });
    expect(within(preview).getByText("Nudge · expense share")).toBeTruthy();
    expect(within(preview).getByText("5 Jan 2026")).toBeTruthy();
    expect(reminderPosts()).toHaveLength(0);
  });

  it.each(["/settle", "/expenses"])("explains a cooldown and disables Nudge on %s", async (path) => {
    current.reminderTargets = [{ ...nudgeTarget(), lastSentAt: new Date(Date.now() - 60_000).toISOString() }];
    mount(path);
    if (path === "/expenses") fireEvent.click(await screen.findByRole("button", { name: /House supplies/ }));
    const nudge = await screen.findByRole("button", { name: "Nudge" }) as HTMLButtonElement;
    expect(nudge.disabled).toBe(true);
    expect(screen.getByText(/^Next nudge /)).toBeTruthy();
  });

  it("reports a server rejection as nothing sent, and an unknown outcome as safe to retry", async () => {
    vi.mocked(post).mockImplementation(async (path) => {
      if (path === "/reminders") throw new ApiError("This member was already reminded in the last day", 409);
      return { ok: true };
    });
    mount("/settle");
    fireEvent.click(await screen.findByRole("button", { name: "Nudge" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Send reminder" })); });
    const preview = screen.getByRole("dialog", { name: "A gentle reminder for Housemate" });
    expect(within(preview).getByRole("alert").textContent)
      .toBe("This member was already reminded in the last day. Nothing was sent and your allowance is unchanged.");

    vi.mocked(post).mockImplementation(async (path) => {
      if (path === "/reminders") throw new TypeError("Failed to fetch");
      return { ok: true };
    });
    await act(async () => { fireEvent.click(within(preview).getByRole("button", { name: "Try again" })); });
    expect(within(preview).getByRole("alert").textContent).toContain("Trying again will not send it twice.");
    const ids = reminderPosts().map(([, body]) => (body as { requestId: string }).requestId);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
  });

  it("still reports an accepted reminder when only the allowance refresh fails", async () => {
    vi.mocked(post).mockImplementation(async (path) => path === "/reminders"
      ? { id: "reminder-1", duplicate: false, emailStatus: "possible" } : { ok: true });
    let usageCalls = 0;
    vi.mocked(api).mockImplementation(async (path) => {
      if (path === "/auth/me") return { user };
      if (path === "/reminders/usage") { if (usageCalls++ > 0) throw new ApiError("Temporarily unavailable", 503); return usage; }
      if (path.endsWith("/invites")) return { invites: [] };
      return { ok: true };
    });
    mount("/settle");
    fireEvent.click(await screen.findByRole("button", { name: "Nudge" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Send reminder" })); });
    expect((await screen.findByRole("status")).textContent)
      .toBe("Nudge recorded. Housemate will see it in Commune. Whether they also get an email depends on their own preferences, so it is not confirmed here.");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("previews a Chase from Funds with the same dialog and reports its result there", async () => {
    current.funds = [{ id: "fund-1", name: "Boiler fund", targetMinor: 10000, commitments: [
      { id: "pledge-1", userId: "user-2", amountMinor: 1000, contributedMinor: 0, dueOn: "2026-01-01" }] }];
    current.reminderTargets = [{ kind: "chase", sourceId: "pledge-1", recipientUserId: "user-2", amountMinor: 1000, currency: "GBP", label: "Boiler fund", dueOn: "2026-01-01", lastSentAt: null }];
    vi.mocked(post).mockImplementation(async (path) => path === "/reminders"
      ? { id: "reminder-2", duplicate: true, emailStatus: "none" } : { ok: true });
    mount("/funds");
    fireEvent.click(await screen.findByRole("button", { name: "View fund" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Boiler fund" })).getByRole("button", { name: "Chase", exact: true }));
    const preview = screen.getByRole("dialog", { name: "A gentle reminder for Housemate" });
    expect(within(preview).getByText("Chase · fund pledge")).toBeTruthy();
    expect(reminderPosts()).toHaveLength(0);
    await act(async () => { fireEvent.click(within(preview).getByRole("button", { name: "Send reminder" })); });
    expect(reminderPosts()[0][1]).toMatchObject({ kind: "chase", sourceId: "pledge-1" });
    await waitFor(() => expect(within(preview).getByRole("status").textContent)
      .toBe("This chase was already recorded. Nothing was sent twice. No email was sent for this reminder."));
    expect(screen.getByRole("dialog", { name: "Boiler fund" })).toBeTruthy();
  });
});

describe("partial repayment receipts and reversals", () => {
  const receiptPosts = () => vi.mocked(post).mock.calls.filter(([path]) => /^\/shares\/.+\/receipts$/.test(path));
  const reversalPosts = () => vi.mocked(post).mock.calls.filter(([path]) => /^\/receipts\/.+\/reverse$/.test(path));
  function partPaid(): Snapshot["expenses"][number] {
    const expense = owedExpense();
    expense.amountMinor = 12000;
    expense.shares = [
      { id: "share-own", userId: user.id, amountMinor: 4000, settledMinor: 4000 },
      { id: "share-1", userId: "user-2", amountMinor: 8000, settledMinor: 2500, receipts: [
        { id: "receipt-1", amountMinor: 2500, receivedOn: "2026-01-06", reference: "Bank transfer", recordedBy: user.id, recordedAt: "2026-01-06T09:00:00Z", origin: "recorded", reversedAt: null, reversedBy: null, reversalReason: null },
      ] },
    ];
    return expense;
  }
  beforeEach(() => { current.expenses = [owedExpense()]; });

  it("defaults to the full outstanding amount and records a smaller part with one request id", async () => {
    vi.mocked(post).mockImplementation(async (path) => /receipts$/.test(path)
      ? { id: "receipt-1", duplicate: false, settledMinor: 500, outstandingMinor: 700 } : { ok: true });
    mount("/settle");
    fireEvent.click(await screen.findByRole("button", { name: "Confirm received" }));
    const dialog = screen.getByRole("dialog", { name: "Record a repayment from Housemate" });
    const amount = within(dialog).getByLabelText(/Amount received/) as HTMLInputElement;
    expect(amount.value).toBe("12.00");
    expect(within(dialog).getByText("After this entry: this share is settled.")).toBeTruthy();
    expect(receiptPosts()).toHaveLength(0);
    fireEvent.change(amount, { target: { value: "5.00" } });
    expect(within(dialog).getByText("After this entry: £7.00 still outstanding.")).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText(/Reference/), { target: { value: "Bank transfer" } });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Record £5.00 received" })); });
    expect(receiptPosts()).toHaveLength(1);
    expect(receiptPosts()[0][0]).toBe("/shares/share-1/receipts");
    expect(receiptPosts()[0][1]).toMatchObject({ amountMinor: 500, reference: "Bank transfer" });
    expect((receiptPosts()[0][1] as { requestId: string }).requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(screen.queryByRole("dialog", { name: "Record a repayment from Housemate" })).toBeNull();
    expect(screen.getByRole("status").textContent)
      .toBe("£5.00 recorded as received from Housemate. £7.00 still outstanding. No payment was taken by Commune.");
  });

  it("keeps keyboard focus in the panel when a full repayment removes its own row", async () => {
    current.expenses = [owedExpense(), { ...owedExpense(), id: "expense-2", title: "Window cleaner",
      shares: [{ id: "share-own-2", userId: user.id, amountMinor: 1200, settledMinor: 1200 }, { id: "share-2", userId: "user-2", amountMinor: 1200, settledMinor: 0 }] }];
    vi.mocked(post).mockImplementation(async (path) => {
      if (!/receipts$/.test(path)) return { ok: true };
      current.expenses[0].shares[1] = { ...current.expenses[0].shares[1], settledMinor: 1200 };
      return { id: "receipt-1", duplicate: false, settledMinor: 1200, outstandingMinor: 0 };
    });
    mount("/settle");
    const buttons = await screen.findAllByRole("button", { name: "Confirm received" });
    buttons[0].focus();
    fireEvent.click(buttons[0]);
    const dialog = screen.getByRole("dialog", { name: "Record a repayment from Housemate" });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Record £12.00 received" })); });
    expect(screen.getAllByRole("button", { name: "Confirm received" })).toHaveLength(1);
    expect(screen.getByRole("region", { name: "You’re owed" }).contains(document.activeElement)).toBe(true);
  });

  it("refuses an excess amount, a future date and an account-like reference before sending", async () => {
    mount("/settle");
    fireEvent.click(await screen.findByRole("button", { name: "Confirm received" }));
    const dialog = screen.getByRole("dialog", { name: "Record a repayment from Housemate" });
    const submit = () => fireEvent.submit(dialog.querySelector("form")!);
    fireEvent.change(within(dialog).getByLabelText(/Amount received/), { target: { value: "12.01" } });
    submit();
    expect(within(dialog).getByRole("alert").textContent).toBe("Only £12.00 is still outstanding on this share.");
    fireEvent.change(within(dialog).getByLabelText(/Amount received/), { target: { value: "5" } });
    fireEvent.change(within(dialog).getByLabelText("Date received"), { target: { value: "2099-01-01" } });
    submit();
    expect(within(dialog).getByRole("alert").textContent).toContain("not a future date");
    fireEvent.change(within(dialog).getByLabelText("Date received"), { target: { value: "2026-01-06" } });
    fireEvent.change(within(dialog).getByLabelText(/Reference/), { target: { value: "sort 12 34 56 acct 12345678" } });
    submit();
    expect(within(dialog).getByRole("alert").textContent).toContain("Leave out card or account numbers");
    expect(receiptPosts()).toHaveLength(0);
  });

  it("keeps the form and reuses its request id when the outcome is unknown, then succeeds", async () => {
    vi.mocked(post).mockImplementationOnce(async () => { throw new TypeError("Failed to fetch"); })
      .mockImplementation(async () => ({ id: "receipt-1", duplicate: true, settledMinor: 1200, outstandingMinor: 0 }));
    mount("/settle");
    fireEvent.click(await screen.findByRole("button", { name: "Confirm received" }));
    const dialog = screen.getByRole("dialog", { name: "Record a repayment from Housemate" });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Record £12.00 received" })); });
    expect(within(dialog).getByRole("alert").textContent).toContain("Trying again will not record it twice.");
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Record £12.00 received" })); });
    const ids = receiptPosts().map(([, body]) => (body as { requestId: string }).requestId);
    expect(ids).toHaveLength(2);
    expect(ids[1]).toBe(ids[0]);
    expect(screen.getByRole("status").textContent).toContain("This repayment was already recorded.");
  });

  it("reports a server rejection as nothing recorded", async () => {
    vi.mocked(post).mockImplementation(async () => { throw new ApiError("Only £3.00 is still outstanding on this share", 409); });
    mount("/settle");
    fireEvent.click(await screen.findByRole("button", { name: "Confirm received" }));
    const dialog = screen.getByRole("dialog", { name: "Record a repayment from Housemate" });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Record £12.00 received" })); });
    expect(within(dialog).getByRole("alert").textContent).toBe("Only £3.00 is still outstanding on this share. Nothing was recorded.");
  });

  it("shows the same part-paid balance in the expense, Settle and Hub", async () => {
    current.expenses = [partPaid()];
    mount("/settle");
    const owed = await screen.findByRole("region", { name: "You’re owed" });
    expect(within(owed).getByText("£55.00", { selector: ".c-settle-total" })).toBeTruthy();
    expect(within(owed).getByText("£25.00 of £80.00 received")).toBeTruthy();
    const recent = screen.getByRole("region", { name: "Recent repayments" });
    expect(within(recent).getByText("Recorded as received")).toBeTruthy();
    expect(within(recent).getByText(/received 6 Jan 2026 · Bank transfer/)).toBeTruthy();
    expect(app.hub.oweAmount).toBe("£55.00");
    act(() => app.go("expense", { expense: "expense-1" }));
    const windowFrame = await screen.findByRole("dialog", { name: "House supplies" });
    expect(within(windowFrame).getByText("£80.00 share · £55.00 outstanding")).toBeTruthy();
    expect(within(windowFrame).getByText("Part paid")).toBeTruthy();
    expect(within(windowFrame).getByText("£25.00 received · 1 repayment")).toBeTruthy();
  });

  it("lets only the payer reverse, requires a reason, and keeps the original entry visible", async () => {
    current.expenses = [partPaid()];
    vi.mocked(post).mockImplementation(async (path) => /reverse$/.test(path)
      ? { id: "receipt-1", duplicate: false, settledMinor: 0, outstandingMinor: 8000 } : { ok: true });
    mount("/expenses");
    fireEvent.click(await screen.findByRole("button", { name: /House supplies/ }));
    const windowFrame = await screen.findByRole("dialog", { name: "House supplies" });
    fireEvent.click(within(windowFrame).getByText("£25.00 received · 1 repayment"));
    fireEvent.click(within(windowFrame).getByRole("button", { name: "Reverse" }));
    const dialog = screen.getByRole("dialog", { name: "Reverse this repayment?" });
    expect(within(dialog).getByText(/£25.00 from Housemate · House supplies · received 6 Jan 2026 · Bank transfer/)).toBeTruthy();
    fireEvent.submit(dialog.querySelector("form")!);
    expect(within(dialog).getByRole("alert").textContent).toContain("Give a short reason");
    expect(reversalPosts()).toHaveLength(0);
    fireEvent.change(within(dialog).getByLabelText("Reason for the reversal"), { target: { value: "Transfer bounced" } });
    current.expenses[0].shares[1] = { ...current.expenses[0].shares[1], settledMinor: 0, receipts: [
      { ...current.expenses[0].shares[1].receipts![0], reversedAt: "2026-01-07T09:00:00Z", reversedBy: user.id, reversalReason: "Transfer bounced" }] };
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Reverse repayment" })); });
    expect(reversalPosts()).toEqual([["/receipts/receipt-1/reverse", { reason: "Transfer bounced" }]]);
    expect(within(windowFrame).getByRole("status").textContent)
      .toBe("£25.00 repayment reversed. £80.00 is outstanding from Housemate. The original entry stays in the history.");
    expect(within(windowFrame).getByText("£80.00 share · £80.00 outstanding")).toBeTruthy();
    expect(within(windowFrame).getByText(/Reversed by you on 7 Jan 2026: Transfer bounced/)).toBeTruthy();
    expect(within(windowFrame).queryByRole("button", { name: "Reverse" })).toBeNull();
  });

  it("shows a debtor the history without any record or reverse controls", async () => {
    const expense = partPaid();
    expense.paidByUserId = "user-2";
    expense.shares = [
      { id: "share-own", userId: "user-2", amountMinor: 4000, settledMinor: 4000 },
      { ...expense.shares[1], userId: user.id, receipts: [{ ...expense.shares[1].receipts![0], recordedBy: "user-2" }] },
    ];
    current.expenses = [expense];
    mount("/settle");
    const owe = await screen.findByRole("region", { name: "You owe" });
    expect(within(owe).getByText("£25.00 of £80.00 received")).toBeTruthy();
    expect(within(owe).getByText("Awaiting payer confirmation")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Confirm received" })).toBeNull();
    expect(within(screen.getByRole("region", { name: "Recent repayments" })).getByText("You to Housemate")).toBeTruthy();
    act(() => app.go("expense", { expense: "expense-1" }));
    const windowFrame = await screen.findByRole("dialog", { name: "House supplies" });
    expect(within(windowFrame).getByText(/recorded by Housemate/)).toBeTruthy();
    expect(within(windowFrame).queryByRole("button", { name: "Reverse" })).toBeNull();
    expect(within(windowFrame).queryByRole("button", { name: "Confirm received" })).toBeNull();
  });

  it("opens the exact expense from a reversal notice", async () => {
    current.expenses = [partPaid()];
    current.notifications = [{ id: "notice-1", kind: "receipt-reversed", sourceId: "expense-1", amountMinor: 2500, communeId: commune.id,
      senderUserId: "user-2", expenseId: "expense-1", title: "House supplies", detail: "Transfer bounced", createdAt: "2026-01-07T09:00:00Z", readAt: null }];
    mount("/hub");
    await screen.findByRole("heading", { name: "Shared essentials" });
    act(() => app.go("notices"));
    const notice = within(await screen.findByRole("dialog", { name: "Notices" })).getByRole("button", { name: /House supplies/ });
    expect(notice.textContent).toContain("Reversed");
    expect(notice.textContent).toContain("£25.00 repayment reversed by Housemate");
    expect(notice.textContent).toContain("Transfer bounced");
    await act(async () => { fireEvent.click(notice); });
    expect(vi.mocked(post)).toHaveBeenCalledWith("/notifications/notice-1/read", {});
    await waitFor(() => expect(app.window).toBe("expense"));
    expect(app.selectedExpense?.id).toBe("expense-1");
  });
});

describe("safe expense correction and void", () => {
  const changeCalls = () => vi.mocked(api).mock.calls.filter(([path]) => path.startsWith("/expenses/"));
  function mockChange(handler: (path: string, body: Record<string, unknown>) => unknown) {
    vi.mocked(api).mockImplementation(async (path, init) => {
      if (path === "/auth/me") return { user };
      if (path === "/reminders/usage") return usage;
      if (path.endsWith("/invites")) return { invites: [] };
      if (path.startsWith("/expenses/")) return handler(path, JSON.parse(String(init?.body ?? "{}")));
      return { ok: true };
    });
  }
  async function openCorrection() {
    mount("/expenses");
    fireEvent.click(await screen.findByRole("button", { name: /House supplies/ }));
    const windowFrame = await screen.findByRole("dialog", { name: "House supplies" });
    fireEvent.click(within(windowFrame).getByRole("button", { name: "Correct" }));
    return { windowFrame, dialog: screen.getByRole("dialog", { name: "Correct this expense" }) };
  }
  beforeEach(() => { current.expenses = [{ ...owedExpense(), version: 1 }]; });

  it("previews what changes and for whom, requires a reason, and sends the version it loaded", async () => {
    mockChange(() => ({ version: 2, duplicate: false }));
    const { windowFrame, dialog } = await openCorrection();
    fireEvent.change(within(dialog).getByLabelText("Total (GBP)"), { target: { value: "30.00" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Review changes" }));
    const review = within(dialog).getByRole("region", { name: "What changes" });
    expect(within(review).getByText("Total: £24.00 to £30.00")).toBeTruthy();
    expect(within(review).getByText("Housemate’s share: £12.00 to £15.00")).toBeTruthy();
    expect(within(review).getByText("Housemate will owe Test Person £15.00 (was £12.00 to Test Person)")).toBeTruthy();
    expect(changeCalls()).toHaveLength(0);
    fireEvent.submit(within(dialog).getByRole("button", { name: "Save correction" }).closest("form")!);
    expect(within(dialog).getByRole("alert").textContent).toContain("Give a short reason");
    expect(changeCalls()).toHaveLength(0);
    fireEvent.change(within(dialog).getByLabelText("Reason for the correction"), { target: { value: "Receipt total was wrong" } });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save correction" })); });
    expect(changeCalls()).toHaveLength(1);
    const [path, init] = changeCalls()[0];
    expect(path).toBe("/expenses/expense-1");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      expectedVersion: 1, title: "House supplies", amountMinor: 3000, paidByUserId: user.id, reason: "Receipt total was wrong",
      shares: [{ userId: user.id, amountMinor: 1500 }, { userId: "user-2", amountMinor: 1500 }],
    });
    expect(within(windowFrame).getByRole("status").textContent)
      .toBe("Correction saved as version 2. The earlier version stays in this expense’s history.");
  });

  it("refuses an empty correction before any request", async () => {
    const { dialog } = await openCorrection();
    fireEvent.click(within(dialog).getByRole("button", { name: "Review changes" }));
    expect(within(dialog).getByRole("alert").textContent).toBe("Nothing has changed yet, so there is nothing to correct.");
    expect(changeCalls()).toHaveLength(0);
  });

  it("turns a competing change into a recoverable conflict that keeps the editor's work", async () => {
    let attempts = 0;
    mockChange((_path, body) => {
      if (attempts++ === 0) {
        current.expenses[0] = { ...current.expenses[0], version: 2, title: "House supplies (shop)" };
        throw new ApiError("This expense was changed by someone else. Review the latest version before saving your correction.", 409);
      }
      return { version: (body.expectedVersion as number) + 1, duplicate: false };
    });
    const { windowFrame, dialog } = await openCorrection();
    fireEvent.change(within(dialog).getByLabelText("Total (GBP)"), { target: { value: "30.00" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Review changes" }));
    fireEvent.change(within(dialog).getByLabelText("Reason for the correction"), { target: { value: "Receipt total was wrong" } });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save correction" })); });
    const alerts = within(dialog).getAllByRole("alert").map(item => item.textContent).join(" ");
    expect(alerts).toContain("This expense changed while you were editing.");
    expect(alerts).toContain("Someone saved version 2.");
    expect(alerts).toContain("Name: “House supplies” to “House supplies (shop)”");
    expect((within(dialog).getByRole("button", { name: "Save correction" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep my edits and review again" }));
    // The editor's total survives; their untouched name no longer overwrites the newer one silently.
    expect((within(dialog).getByLabelText("Total (GBP)") as HTMLInputElement).value).toBe("30.00");
    fireEvent.click(within(dialog).getByRole("button", { name: "Review changes" }));
    expect(within(dialog).getByText("Name: “House supplies (shop)” to “House supplies”")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Back to editing" }));
    fireEvent.change(within(dialog).getByLabelText("What was it for?"), { target: { value: "House supplies (shop)" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Review changes" }));
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save correction" })); });
    const bodies = changeCalls().map(([, init]) => JSON.parse(String(init?.body)));
    expect(bodies.map(body => body.expectedVersion)).toEqual([1, 2]);
    expect(bodies[1]).toMatchObject({ title: "House supplies (shop)", amountMinor: 3000 });
    expect(bodies[1].requestId).not.toBe(bodies[0].requestId);
    expect(within(windowFrame).getByRole("status").textContent).toContain("Correction saved as version 3.");
  });

  it("locks the money while repayments exist but still allows a rename", async () => {
    current.expenses[0].shares[1] = { ...current.expenses[0].shares[1], settledMinor: 500, receipts: [
      { id: "receipt-1", amountMinor: 500, receivedOn: "2026-01-06", reference: null, recordedBy: user.id, recordedAt: "2026-01-06T09:00:00Z", reversedAt: null, reversedBy: null, reversalReason: null }] };
    mockChange(() => ({ version: 2, duplicate: false }));
    const { dialog } = await openCorrection();
    expect((within(dialog).getByLabelText("Total (GBP)") as HTMLInputElement).disabled).toBe(true);
    expect((within(dialog).getByLabelText("Paid by") as HTMLSelectElement).disabled).toBe(true);
    expect(within(dialog).getByRole("note").textContent).toContain("Reverse those repayments first");
    expect(within(dialog).queryByRole("group", { name: "Split method" })).toBeNull();
    fireEvent.change(within(dialog).getByLabelText("What was it for?"), { target: { value: "Cleaning supplies" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Review changes" }));
    expect(within(dialog).getByText("No one’s balance changes.")).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText("Reason for the correction"), { target: { value: "Clearer name" } });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save correction" })); });
    expect(JSON.parse(String(changeCalls()[0][1]?.body))).toMatchObject({ title: "Cleaning supplies", amountMinor: 2400,
      shares: [{ userId: user.id, amountMinor: 1200 }, { userId: "user-2", amountMinor: 1200 }] });
  });

  it("voids with a reason and a version, and reports a rejection as nothing changed", async () => {
    let reject = true;
    mockChange(() => { if (reject) { reject = false; throw new ApiError("Repayments are recorded on this expense. Reverse them before voiding it.", 409); } return { version: 2, duplicate: false }; });
    mount("/expenses");
    fireEvent.click(await screen.findByRole("button", { name: /House supplies/ }));
    const windowFrame = await screen.findByRole("dialog", { name: "House supplies" });
    fireEvent.click(within(windowFrame).getByRole("button", { name: "Void" }));
    const dialog = screen.getByRole("dialog", { name: "Void this expense?" });
    expect(within(dialog).getByText(/£12.00 of outstanding shares will stop being owed/)).toBeTruthy();
    fireEvent.submit(dialog.querySelector("form")!);
    expect(within(dialog).getByRole("alert").textContent).toContain("Give a short reason");
    fireEvent.change(within(dialog).getByLabelText("Reason for voiding"), { target: { value: "Entered twice" } });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Void expense" })); });
    expect(within(dialog).getByRole("alert").textContent).toBe("Repayments are recorded on this expense. Reverse them before voiding it. Nothing was changed.");
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Void expense" })); });
    const bodies = changeCalls().map(([path, init]) => [path, JSON.parse(String(init?.body))]);
    expect(bodies[1][0]).toBe("/expenses/expense-1/void");
    expect(bodies[1][1]).toMatchObject({ expectedVersion: 1, reason: "Entered twice" });
    expect(bodies[1][1].requestId).toBe(bodies[0][1].requestId);
    expect(within(windowFrame).getByRole("status").textContent).toContain("Expense voided.");
  });

  it("keeps a voided expense as history that never counts towards a balance", async () => {
    current.expenses = [{ ...owedExpense(), version: 2, voidedAt: "2026-01-08T09:00:00Z", voidedBy: user.id, voidReason: "Entered twice",
      revisions: [{ id: "rev-1", version: 2, action: "voided", actorId: user.id, reason: "Entered twice", createdAt: "2026-01-08T09:00:00Z",
        before: { title: "House supplies", amountMinor: 2400, paidByUserId: user.id, category: "Other", dueOn: "2026-01-05", shares: [] },
        after: { title: "House supplies", amountMinor: 2400, paidByUserId: user.id, category: "Other", dueOn: "2026-01-05", shares: [], voided: true } }] },
      { ...owedExpense(), id: "expense-2", title: "Window cleaner", version: 1 }];
    mount("/settle");
    const owed = await screen.findByRole("region", { name: "You’re owed" });
    expect(within(owed).getByText("£12.00", { selector: ".c-settle-total" })).toBeTruthy();
    expect(within(owed).queryByText(/House supplies/)).toBeNull();
    expect(app.hub.oweAmount).toBe("£12.00");
    expect(app.expenses.map(row => row.id)).toEqual(["expense-2"]);
    act(() => app.go("expenses"));
    expect(await screen.findByText("1 expense · £24.00 total recorded in this view")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Voided" }));
    expect(screen.getByText("1 voided expense · kept for history, not counted in any balance")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /House supplies/ }));
    const windowFrame = await screen.findByRole("dialog", { name: "House supplies" });
    expect(within(windowFrame).getByText("Voided by Test Person on 8 Jan 2026: Entered twice")).toBeTruthy();
    expect(within(windowFrame).getByText("1 change to this expense")).toBeTruthy();
    for (const name of ["Correct", "Void", "Nudge", "Confirm received"]) {
      expect(within(windowFrame).queryByRole("button", { name })).toBeNull();
    }
  });

  it("offers correction to the payer or an admin only", async () => {
    current.commune = { ...commune, role: "member" };
    current.members = [{ userId: user.id, name: user.name, role: "member", active: true }, { userId: "user-2", name: "Housemate", role: "admin", active: true }];
    current.expenses = [{ ...owedExpense(), version: 1, paidByUserId: "user-2", shares: [
      { id: "share-own", userId: "user-2", amountMinor: 1200, settledMinor: 1200 }, { id: "share-1", userId: user.id, amountMinor: 1200, settledMinor: 0 }] }];
    vi.mocked(loadCommunes).mockResolvedValue({ communes: [{ ...commune, role: "member" }] });
    mount("/expenses");
    fireEvent.click(await screen.findByRole("button", { name: /House supplies/ }));
    const windowFrame = await screen.findByRole("dialog", { name: "House supplies" });
    expect(within(windowFrame).queryByRole("button", { name: "Correct" })).toBeNull();
    expect(within(windowFrame).queryByRole("button", { name: "Void" })).toBeNull();
  });
});

describe("review fixes: voided ledger, lost replies, locks and Escape", () => {
  const repayment = { id: "receipt-1", amountMinor: 500, receivedOn: "2026-01-06", reference: null, recordedBy: "user-2", recordedAt: "2026-01-06T09:00:00Z", reversedAt: null, reversedBy: null, reversalReason: null };

  it("keeps the Expenses list and its Voided filter when every expense is voided", async () => {
    current.expenses = [{ ...owedExpense(), version: 2, voidedAt: "2026-01-08T09:00:00Z", voidedBy: user.id, voidReason: "Entered twice", revisions: [] }];
    mount("/expenses");
    expect(await screen.findByRole("button", { name: "Voided" })).toBeTruthy();
    expect(screen.queryByText("No expenses yet.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Voided" }));
    expect(screen.getByRole("button", { name: /House supplies/ })).toBeTruthy();
  });

  it("tells an admin who did not pay to ask the payer to reverse, not to reverse themselves", async () => {
    const expense = owedExpense();
    expense.paidByUserId = "user-2";
    expense.shares = [{ id: "share-own", userId: "user-2", amountMinor: 1200, settledMinor: 1200 },
      { id: "share-1", userId: user.id, amountMinor: 1200, settledMinor: 500, receipts: [repayment] }];
    current.expenses = [{ ...expense, version: 1 }];
    mount("/expenses");
    fireEvent.click(await screen.findByRole("button", { name: /House supplies/ }));
    const windowFrame = await screen.findByRole("dialog", { name: "House supplies" });
    fireEvent.click(within(windowFrame).getByRole("button", { name: "Correct" }));
    expect(within(screen.getByRole("dialog", { name: "Correct this expense" })).getByRole("note").textContent)
      .toContain("Ask Housemate to reverse those repayments first");
    fireEvent.click(within(screen.getByRole("dialog", { name: "Correct this expense" })).getByRole("button", { name: "Cancel" }));
    fireEvent.click(within(windowFrame).getByRole("button", { name: "Void" }));
    expect(within(screen.getByRole("dialog", { name: "Void this expense?" })).getByRole("note").textContent)
      .toContain("Ask Housemate to reverse them first");
  });

  it("lets a void close repayments that belong to someone who has left", async () => {
    current.members = [{ userId: user.id, name: user.name, role: "admin", active: true }, { userId: "user-2", name: "Housemate", role: "member", active: false }];
    const expense = owedExpense();
    expense.shares[1] = { ...expense.shares[1], settledMinor: 500, receipts: [{ ...repayment, recordedBy: user.id }] };
    current.expenses = [{ ...expense, version: 1 }];
    mount("/expenses");
    fireEvent.click(await screen.findByRole("button", { name: /House supplies/ }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "House supplies" })).getByRole("button", { name: "Void" }));
    const dialog = screen.getByRole("dialog", { name: "Void this expense?" });
    expect(within(dialog).queryByRole("note")).toBeNull();
    expect(within(dialog).getByText(/someone who has left will be closed with this void/)).toBeTruthy();
    expect((within(dialog).getByRole("button", { name: "Void expense" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("locks the repayment form after an unconfirmed attempt so a retry is the same repayment", async () => {
    current.expenses = [owedExpense()];
    vi.mocked(post).mockImplementation(async () => { throw new TypeError("Failed to fetch"); });
    mount("/settle");
    fireEvent.click(await screen.findByRole("button", { name: "Confirm received" }));
    const dialog = screen.getByRole("dialog", { name: "Record a repayment from Housemate" });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Record £12.00 received" })); });
    expect((within(dialog).getByLabelText(/Amount received/) as HTMLInputElement).disabled).toBe(true);
    expect((within(dialog).getByLabelText("Date received") as HTMLInputElement).disabled).toBe(true);
    expect((within(dialog).getByLabelText(/Reference/) as HTMLInputElement).disabled).toBe(true);
    expect((within(dialog).getByRole("button", { name: "Record £12.00 received" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("recognises its own correction when the reply was lost, instead of calling it someone else's", async () => {
    current.expenses = [{ ...owedExpense(), version: 1, revisions: [] }];
    vi.mocked(api).mockImplementation(async (path) => {
      if (path === "/auth/me") return { user };
      if (path === "/reminders/usage") return usage;
      if (path.endsWith("/invites")) return { invites: [] };
      if (path === "/expenses/expense-1") throw new TypeError("Failed to fetch");
      return { ok: true };
    });
    // What the server actually saved before the reply was lost.
    const saveOnServer = () => {
        const before = { title: "House supplies", amountMinor: 2400, paidByUserId: user.id, category: "Other", dueOn: "2026-01-05",
          shares: [{ userId: user.id, amountMinor: 1200 }, { userId: "user-2", amountMinor: 1200 }] };
        const after = { ...before, amountMinor: 3000, shares: [{ userId: user.id, amountMinor: 1500 }, { userId: "user-2", amountMinor: 1500 }] };
        current.expenses = [{ ...owedExpense(), amountMinor: 3000, version: 2,
          shares: [{ id: "share-own", userId: user.id, amountMinor: 1500, settledMinor: 1500 }, { id: "share-1", userId: "user-2", amountMinor: 1500, settledMinor: 0 }],
          revisions: [{ id: "rev-2", version: 2, action: "corrected", actorId: user.id, reason: "Receipt total was wrong", before, after, createdAt: "2026-01-07T09:00:00Z" }] }];
    };
    mount("/expenses");
    fireEvent.click(await screen.findByRole("button", { name: /House supplies/ }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "House supplies" })).getByRole("button", { name: "Correct" }));
    const dialog = screen.getByRole("dialog", { name: "Correct this expense" });
    fireEvent.change(within(dialog).getByLabelText("Total (GBP)"), { target: { value: "30.00" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Review changes" }));
    fireEvent.change(within(dialog).getByLabelText("Reason for the correction"), { target: { value: "Receipt total was wrong" } });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save correction" })); });
    expect(within(dialog).getByRole("alert").textContent).toContain("Trying again will not record it twice.");
    expect((within(dialog).getByLabelText("Reason for the correction") as HTMLTextAreaElement).disabled).toBe(true);
    saveOnServer();
    await act(async () => { await app.refresh(); });
    const settled = screen.getByRole("dialog", { name: "Correct this expense" });
    expect(within(settled).getByRole("status").textContent).toContain("Your correction was saved as version 2.");
    expect(within(settled).queryByText(/Someone saved version/)).toBeNull();
  });

  it("closes only the allowance popover on Escape, not the expense window", async () => {
    current.expenses = [owedExpense()];
    current.reminderTargets = [nudgeTarget()];
    mount("/expenses");
    fireEvent.click(await screen.findByRole("button", { name: /House supplies/ }));
    const windowFrame = await screen.findByRole("dialog", { name: "House supplies" });
    const details = windowFrame.querySelector("details.a-reminder-usage") as HTMLDetailsElement;
    details.open = true;
    fireEvent.keyDown(details, { key: "Escape" });
    expect(details.open).toBe(false);
    expect(app.window).toBe("expense");
  });
});
