import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReminderConfirm, ReminderFlowDialog, useReminderFlow, type ReminderRequest } from "../src/ui/ReminderConfirm";
import { reminderEligibility, reminderFailureCopy, reminderResultCopy } from "../src/data/reminders";
import { ApiError } from "../src/live/api";
import type { ReminderResult, ReminderTarget, ReminderUsage } from "../src/live/model";

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); } });
});
afterEach(cleanup);

const request: ReminderRequest = { kind: "nudge", sourceId: "share-1", recipientId: "user-2", name: "Alex", subject: "House supplies", amount: "£12.00", dueOn: "2026-01-05" };
const usage: ReminderUsage = { totalUsed: 2, totalLimit: 60, recipientLimit: 8, recipientUsage: { "user-2": 1 }, nextSlotAt: null };
const base = { request, usage, phase: "ready" as const, result: null, error: "" };

describe("shared reminder preview", () => {
  it("shows recipient, purpose, due date and allowance without sending until confirmed", () => {
    const onSend = vi.fn();
    render(<ReminderConfirm {...base} onSend={onSend} onClose={vi.fn()} />);
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "A gentle reminder for Alex" })).toBeTruthy();
    expect(screen.getByText(/£12.00 outstanding for House supplies/)).toBeTruthy();
    expect(screen.getByText("Nudge · expense share")).toBeTruthy();
    expect(screen.getByText("5 Jan 2026")).toBeTruthy();
    expect(screen.getByText("1 of 8 in 30 days")).toBeTruthy();
    expect(screen.getByText("58 of 60 left")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Send reminder" }));
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("labels a Chase as a fund pledge reminder", () => {
    render(<ReminderConfirm {...base} request={{ ...request, kind: "chase", subject: "Boiler fund" }} onSend={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText("Chase · fund pledge")).toBeTruthy();
    expect(screen.getByText(/This pledge then has a 72-hour cooldown/)).toBeTruthy();
  });

  it("blocks duplicate sends and dismissal while sending", () => {
    const onSend = vi.fn(); const onClose = vi.fn();
    const { container } = render(<ReminderConfirm {...base} phase="sending" onSend={onSend} onClose={onClose} />);
    expect((screen.getByRole("button", { name: "Sending…" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Close reminder" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent(container.querySelector("dialog")!, new Event("cancel", { cancelable: true }));
    expect(onClose).not.toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled();
  });

  it("disables sending when the allowance is used up, and still allows cancelling", () => {
    const onClose = vi.fn();
    render(<ReminderConfirm {...base} usage={{ ...usage, totalUsed: 60 }} onSend={vi.fn()} onClose={onClose} />);
    expect((screen.getByRole("button", { name: "Send reminder" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/allowance for this period is used up/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps a failure visible and offers a retry", () => {
    const onSend = vi.fn();
    render(<ReminderConfirm {...base} phase="error" error="Could not confirm." onSend={onSend} onClose={vi.fn()} />);
    expect(screen.getByRole("alert").textContent).toBe("Could not confirm.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onSend).toHaveBeenCalledOnce();
  });

  it("reports the recorded result truthfully and replaces Send with Done", () => {
    const result: ReminderResult = { id: "r1", duplicate: false, emailStatus: "possible" };
    render(<ReminderConfirm {...base} phase="sent" result={result} onSend={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toBe("Nudge recorded. Alex will see it in Commune. Whether they also get an email depends on their own preferences, so it is not confirmed here.");
    expect(screen.queryByRole("button", { name: "Send reminder" })).toBeNull();
    expect(screen.getByRole("button", { name: "Done" })).toBeTruthy();
  });
});

describe("reminder result and failure wording", () => {
  it("never claims an email was sent, and never reveals the recipient's email preference", () => {
    expect(reminderResultCopy("chase", "Sam", { id: "r", duplicate: false, emailStatus: "none" }))
      .toBe("Chase recorded. Sam will see it in Commune. No email was sent for this reminder.");
    const possible = reminderResultCopy("nudge", "Sam", { id: "r", duplicate: false, emailStatus: "possible" });
    expect(possible).toBe("Nudge recorded. Sam will see it in Commune. Whether they also get an email depends on their own preferences, so it is not confirmed here.");
    expect(possible).not.toMatch(/queued|sent an email|delivered|opted/i);
    expect(reminderResultCopy("nudge", "Sam", { id: "r", duplicate: true, emailStatus: "none" }))
      .toContain("already recorded. Nothing was sent twice.");
  });
  it("separates a server rejection from an unknown outcome", () => {
    const rejected = reminderFailureCopy(new ApiError("A reminder was already sent in the last 3 days", 409));
    expect(rejected.uncertain).toBe(false);
    expect(rejected.message).toBe("A reminder was already sent in the last 3 days. Nothing was sent and your allowance is unchanged.");
    const unknown = reminderFailureCopy(new TypeError("Failed to fetch"));
    expect(unknown.uncertain).toBe(true);
    expect(unknown.message).toContain("Trying again will not send it twice.");
    expect(reminderFailureCopy(new ApiError("Internal server error", 500)).uncertain).toBe(true);
  });
});

describe("reminder eligibility shared by every entry point", () => {
  const now = Date.parse("2026-03-10T12:00:00Z");
  const target: ReminderTarget = { kind: "nudge", sourceId: "share-1", recipientUserId: "user-2", amountMinor: 1200, currency: "GBP", label: "House supplies", dueOn: "2026-03-01", lastSentAt: null };
  const check = (patch: Partial<Parameters<typeof reminderEligibility>[0]>) =>
    reminderEligibility({ kind: "nudge", recipientId: "user-2", target, usage, sent: [], dueOn: "2026-03-01", now, ...patch });
  it("is ready for a due, uncooled share inside the allowance", () => {
    expect(check({})).toEqual({ canSend: true, state: "ready", reason: "" });
  });
  it("explains an undated or not-yet-due share", () => {
    expect(check({ target: undefined, dueOn: null })).toMatchObject({ canSend: false, state: "undated", reason: "Add a due date to enable reminders." });
    expect(check({ target: undefined, dueOn: "2026-03-20" })).toMatchObject({ canSend: false, state: "not-due", reason: "Nudge available from 20 Mar 2026." });
  });
  it("explains the 72-hour source cooldown and the one-day recipient cooldown", () => {
    expect(check({ target: { ...target, lastSentAt: "2026-03-09T12:00:00Z" } })).toMatchObject({ canSend: false, state: "cooldown" });
    expect(check({ sent: [{ id: "r", kind: "chase", sourceId: "pledge-9", recipientUserId: "user-2", amountMinor: 500, createdAt: "2026-03-10T08:00:00Z", emailStatus: "none" }] }))
      .toMatchObject({ canSend: false, state: "recently-reminded" });
    expect(check({ sent: [{ id: "r", kind: "chase", sourceId: "pledge-9", recipientUserId: "user-3", amountMinor: 500, createdAt: "2026-03-10T08:00:00Z", emailStatus: "none" }] }).canSend).toBe(true);
  });
  it("explains total and per-person allowance limits", () => {
    expect(check({ usage: { ...usage, totalUsed: 60 } })).toMatchObject({ canSend: false, state: "limit" });
    expect(check({ usage: { ...usage, recipientUsage: { "user-2": 8 } } })).toMatchObject({ canSend: false, state: "limit", reason: "You have sent this person 8 reminders in 30 days." });
  });
});

describe("one reminder decision, one command", () => {
  function Harness({ send }: { send: Parameters<typeof useReminderFlow>[0] }) {
    const flow = useReminderFlow(send);
    return <><button type="button" onClick={() => flow.open(request)}>Open</button><ReminderFlowDialog flow={flow} usage={usage} /></>;
  }
  it("reuses the same request id when a failed send is retried", async () => {
    const send = vi.fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ id: "r1", duplicate: false, emailStatus: "none" } satisfies ReminderResult);
    render(<Harness send={send} />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Send reminder" })); });
    expect(screen.getByRole("alert").textContent).toContain("could not confirm");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Try again" })); });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][2]).toMatch(/^[0-9a-f-]{36}$/);
    expect(send.mock.calls[1][2]).toBe(send.mock.calls[0][2]);
    expect(screen.getByRole("status").textContent).toContain("Nudge recorded.");
  });
  it("sends one command for repeated clicks and nothing when cancelled", async () => {
    let resolve!: (value: ReminderResult) => void;
    const send = vi.fn(() => new Promise<ReminderResult>(yes => { resolve = yes; }));
    render(<Harness send={send} />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    const button = screen.getByRole("button", { name: "Send reminder" });
    fireEvent.click(button); fireEvent.click(button);
    expect(send).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ id: "r1", duplicate: false, emailStatus: "none" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(send).toHaveBeenCalledTimes(1);
  });
});
