import { beforeEach, describe, expect, it, vi } from "vitest";

// The hosted build reaches the same database functions as the local API, by a
// different path. These tests pin the function names, argument names and
// result/error mapping. They do not contact Neon: hosted behaviour still
// needs verification on a real branch after the migrations are applied.
const mocks = vi.hoisted(() => ({ getSession: vi.fn(), from: vi.fn(), rpc: vi.fn() }));
vi.mock("@neondatabase/neon-js", () => ({
  createClient: () => ({ auth: { getSession: mocks.getSession }, from: mocks.from, rpc: mocks.rpc }),
}));
const requestId = "11111111-2222-4333-8444-555555555555";
const send = async (path: string, body: unknown, method = "POST") => {
  const { neonApi } = await import("../src/live/neon");
  return neonApi<Record<string, unknown>>(path, { method, body: JSON.stringify(body) });
};
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv("VITE_NEON_AUTH_URL", "https://ep-test.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth");
  vi.stubEnv("VITE_REMINDER_FUNCTION_URL", "");
  mocks.getSession.mockResolvedValue({ data: { user: { id: "viewer", emailVerified: true } }, error: null });
});

describe("hosted money lifecycle and task commands", () => {
  it("sends a reminder as an idempotent command and passes through only the coarse email state", async () => {
    mocks.rpc.mockResolvedValue({ data: { id: "reminder-1", duplicate: true, emailStatus: "possible" }, error: null });
    const result = await send("/reminders", { kind: "nudge", sourceId: "share-1", requestId });
    expect(mocks.rpc).toHaveBeenCalledWith("send_reminder_command", { p_kind: "nudge", p_source_id: "share-1", p_request_id: requestId });
    expect(result).toEqual({ id: "reminder-1", duplicate: true, delivery: "in-app", emailStatus: "possible" });
  });

  it("never reports a possible email unless the database says so", async () => {
    mocks.rpc.mockResolvedValue({ data: { id: "reminder-1", duplicate: false }, error: null });
    expect((await send("/reminders", { kind: "chase", sourceId: "pledge-1", requestId })).emailStatus).toBe("none");
    mocks.rpc.mockResolvedValue({ data: { id: "reminder-1", duplicate: false, emailStatus: "queued" }, error: null });
    expect((await send("/reminders", { kind: "chase", sourceId: "pledge-1", requestId })).emailStatus).toBe("none");
  });

  it("records and reverses repayment receipts through the ledger functions", async () => {
    mocks.rpc.mockResolvedValue({ data: { id: "receipt-1", duplicate: false, settledMinor: 2500, outstandingMinor: 5500 }, error: null });
    const recorded = await send("/shares/share-1/receipts", { amountMinor: 2500, receivedOn: "2026-10-02", reference: "Bank transfer", requestId });
    expect(mocks.rpc).toHaveBeenCalledWith("record_share_receipt", {
      p_share_id: "share-1", p_amount_minor: 2500, p_received_on: "2026-10-02", p_reference: "Bank transfer", p_request_id: requestId });
    expect(recorded).toEqual({ id: "receipt-1", duplicate: false, settledMinor: 2500, outstandingMinor: 5500 });
    await send("/receipts/receipt-1/reverse", { reason: "Transfer bounced" });
    expect(mocks.rpc).toHaveBeenLastCalledWith("reverse_share_receipt", { p_receipt_id: "receipt-1", p_reason: "Transfer bounced" });
  });

  it("corrects and voids an expense with the version the editor loaded", async () => {
    mocks.rpc.mockResolvedValue({ data: { version: 3, duplicate: false }, error: null });
    const corrected = await send("/expenses/expense-1", { expectedVersion: 2, title: "Groceries", amountMinor: 9300, category: "Groceries", dueOn: null,
      paidByUserId: "viewer", shares: [{ userId: "viewer", amountMinor: 4650 }, { userId: "other", amountMinor: 4650 }], reason: "Wrong total", requestId }, "PUT");
    expect(mocks.rpc).toHaveBeenCalledWith("correct_expense", {
      p_expense_id: "expense-1", p_expected_version: 2, p_title: "Groceries", p_amount_minor: 9300,
      p_shares: [{ user_id: "viewer", amount_minor: 4650 }, { user_id: "other", amount_minor: 4650 }],
      p_due_on: null, p_paid_by: "viewer", p_category: "Groceries", p_reason: "Wrong total", p_request_id: requestId });
    expect(corrected).toEqual({ version: 3, duplicate: false });
    await send("/expenses/expense-1/void", { expectedVersion: 3, reason: "Entered twice", requestId });
    expect(mocks.rpc).toHaveBeenLastCalledWith("void_expense", { p_expense_id: "expense-1", p_expected_version: 3, p_reason: "Entered twice", p_request_id: requestId });
  });

  it("completes and undoes a task through occurrence functions, not a row overwrite", async () => {
    mocks.rpc.mockResolvedValue({ data: { id: "occurrence-1", duplicate: false, date: "2026-10-09", assignee: "Blake", status: "open" }, error: null });
    const done = await send("/operations/task-1/occurrences", { action: "completed", expectedDate: "2026-10-02", today: "2026-10-02", requestId });
    expect(mocks.rpc).toHaveBeenCalledWith("record_operation_occurrence", {
      p_operation_id: "task-1", p_action: "completed", p_expected_date: "2026-10-02", p_today: "2026-10-02", p_request_id: requestId });
    expect(done).toMatchObject({ id: "occurrence-1", date: "2026-10-09", assignee: "Blake" });
    await send("/occurrences/occurrence-1/undo", {});
    expect(mocks.rpc).toHaveBeenLastCalledWith("undo_operation_occurrence", { p_occurrence_id: "occurrence-1" });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("skips with a reason and hands over a turn through commands", async () => {
    mocks.rpc.mockResolvedValue({ data: { id: "occurrence-2", duplicate: false, date: "2026-10-09", assignee: "Dana", assigneeId: "dana", turnOwnerId: "avery", status: "open" }, error: null });
    await send("/operations/task-1/occurrences", { action: "skipped", expectedDate: "2026-10-02", today: "2026-10-02", requestId, reason: "Away" });
    expect(mocks.rpc).toHaveBeenLastCalledWith("record_operation_occurrence", {
      p_operation_id: "task-1", p_action: "skipped", p_expected_date: "2026-10-02", p_today: "2026-10-02", p_request_id: requestId, p_reason: "Away" });
    const handed = await send("/operations/task-1/handovers", {
      toMemberId: "dana", expectedDate: "2026-10-02", expectedAssigneeId: "avery", today: "2026-10-02", reason: "", requestId });
    expect(mocks.rpc).toHaveBeenLastCalledWith("hand_over_operation", {
      p_operation_id: "task-1", p_to_member_id: "dana", p_expected_date: "2026-10-02", p_expected_assignee_id: "avery",
      p_today: "2026-10-02", p_reason: "", p_request_id: requestId });
    expect(handed).toMatchObject({ assigneeId: "dana", turnOwnerId: "avery" });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it.each([
    ["P0001", 409, "This expense was changed by someone else."],
    ["42501", 403, "Only the bill payer can record a repayment for this share"],
    ["22023", 400, "Give a reason for the correction (3 to 240 characters)"],
    ["28000", 401, "Request identity could not be verified"],
  ])("maps database error %s to HTTP-style status %i so conflicts and rejections stay distinct", async (code, status, message) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code, message } });
    await expect(send("/expenses/expense-1/void", { expectedVersion: 1, reason: "Entered twice", requestId })).rejects.toMatchObject({ status, message });
  });
});
