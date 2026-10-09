import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "../src/App";
import { AppProvider, useApp, type AppState } from "../src/state";
import { api, post, loadCommunes, loadSnapshot, ApiError } from "../src/live/api";
import type { Commune, Snapshot } from "../src/live/model";
import { UNCERTAIN_RETRY_SAFE } from "../src/data/commands";
import { formatTimestampDay } from "../src/data/reminders";

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
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
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

/** The bodies posted to one path, in order. */
const sent = (path: string) => vi.mocked(post).mock.calls.filter(([to]) => to === path).map(([, body]) => body as Record<string, unknown>);
/** A command that fails once with an unknown outcome, then answers. */
function lostOnce(path: string, answer: (attempt: number) => unknown) {
  let attempt = 0;
  vi.mocked(post).mockImplementation(async (to) => {
    if (to !== path) return { ok: true };
    attempt += 1;
    if (attempt === 1) throw new TypeError("Failed to fetch");
    return answer(attempt);
  });
}

describe("one request id per open form", () => {
  async function openExpenseForm() {
    fireEvent.click(await screen.findByRole("button", { name: "Add expense", exact: true }));
    const dialog = screen.getByRole("dialog", { name: "Add expense" });
    fireEvent.change(within(dialog).getByLabelText("What was it for?"), { target: { value: "Tickets" } });
    fireEvent.change(within(dialog).getByLabelText("Amount (GBP)"), { target: { value: "12.00" } });
    return dialog;
  }

  it("retries an expense with the same request id and opens the expense the first attempt saved", async () => {
    lostOnce("/communes/home-1/expenses", () => {
      current.expenses = [{ id: "expense-9", title: "Tickets", category: "Other", amountMinor: 1200, paidByUserId: user.id, dueOn: null,
        createdAt: "2026-10-09T10:00:00Z", shares: [
          { id: "share-own", userId: user.id, amountMinor: 600, settledMinor: 600 },
          { id: "share-9", userId: "user-2", amountMinor: 600, settledMinor: 0 },
        ] }];
      return { id: "expense-9", duplicate: true };
    });
    mount("/expenses");
    const dialog = await openExpenseForm();
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save expense" })); });
    expect(within(dialog).getByRole("alert").textContent).toBe(UNCERTAIN_RETRY_SAFE);
    // The retry has to be the same expense, so its details are locked.
    expect((within(dialog).getByLabelText("What was it for?") as HTMLInputElement).disabled).toBe(true);
    expect((within(dialog).getByLabelText("Amount (GBP)") as HTMLInputElement).disabled).toBe(true);
    expect((within(dialog).getByRole("button", { name: "Save expense" }) as HTMLButtonElement).disabled).toBe(false);
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save expense" })); });
    const attempts = sent("/communes/home-1/expenses");
    expect(attempts).toHaveLength(2);
    expect(attempts[0].requestId).toMatch(uuid);
    expect(attempts[1]).toEqual(attempts[0]);
    await waitFor(() => expect(app.window).toBe("expense"));
    expect(app.selectedExpense?.id).toBe("expense-9");
  });

  it("gives the next expense form a new request id", async () => {
    vi.mocked(post).mockImplementation(async (to) => to === "/communes/home-1/expenses" ? { id: "expense-9", duplicate: false } : { ok: true });
    mount("/expenses");
    let dialog = await openExpenseForm();
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save expense" })); });
    await waitFor(() => expect(app.window).toBe("expense"));
    act(() => app.go("add-expense"));
    dialog = await openExpenseForm();
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save expense" })); });
    const attempts = sent("/communes/home-1/expenses");
    expect(attempts).toHaveLength(2);
    expect(attempts[1].requestId).toMatch(uuid);
    expect(attempts[1].requestId).not.toBe(attempts[0].requestId);
  });

  it("reports a refusal as nothing saved, and a reused request id as possibly saved", async () => {
    vi.mocked(post)
      .mockImplementationOnce(async () => { throw new ApiError("Choose a current member of this commune", 400); })
      .mockImplementationOnce(async () => { throw new ApiError("This request was already used for a different change", 400); });
    mount("/expenses");
    const dialog = await openExpenseForm();
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save expense" })); });
    expect(within(dialog).getByRole("alert").textContent).toBe("Choose a current member of this commune. Nothing was saved.");
    expect((within(dialog).getByLabelText("What was it for?") as HTMLInputElement).disabled).toBe(false);
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save expense" })); });
    expect(within(dialog).getByRole("alert").textContent)
      .toBe("An earlier attempt may already have been saved. Close this and check Expenses before adding it again.");
  });

  it("does not call a later refusal nothing saved once an expense attempt may have saved", async () => {
    // The first attempt may have saved; the retry is then refused (the person was made a member meanwhile).
    lostOnce("/communes/home-1/expenses", () => { throw new ApiError("Only admins can add expenses", 403); });
    mount("/expenses");
    const dialog = await openExpenseForm();
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save expense" })); });
    expect(within(dialog).getByRole("alert").textContent).toBe(UNCERTAIN_RETRY_SAFE);
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save expense" })); });
    expect(within(dialog).getByRole("alert").textContent)
      .toBe("An earlier attempt may already have been saved. Close this and check Expenses before adding it again.");
    expect(sent("/communes/home-1/expenses")).toHaveLength(2);
  });

  it("retries a new fund with the same request id and gives the next fund a new one", async () => {
    lostOnce("/communes/home-1/funds", (attempt) => ({ id: `fund-${attempt}`, duplicate: attempt === 2 }));
    mount("/funds");
    fireEvent.click(await screen.findByRole("button", { name: "Create fund" }));
    let dialog = screen.getByRole("dialog", { name: "Create a fund" });
    fireEvent.change(within(dialog).getByLabelText("Fund name"), { target: { value: "Boiler" } });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save" })); });
    expect(within(dialog).getByRole("alert").textContent).toBe(UNCERTAIN_RETRY_SAFE);
    expect(dialog.querySelector("fieldset")!.disabled).toBe(true);
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save" })); });
    expect(await screen.findByText("Fund saved.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Create fund" }));
    dialog = screen.getByRole("dialog", { name: "Create a fund" });
    expect(dialog.querySelector("fieldset")!.disabled).toBe(false);
    fireEvent.change(within(dialog).getByLabelText("Fund name"), { target: { value: "Garden" } });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save" })); });
    const attempts = sent("/communes/home-1/funds");
    expect(attempts.map((body) => body.name)).toEqual(["Boiler", "Boiler", "Garden"]);
    expect(attempts[0].requestId).toMatch(uuid);
    expect(attempts[1].requestId).toBe(attempts[0].requestId);
    expect(attempts[2].requestId).not.toBe(attempts[0].requestId);
  });

  it("retries a pledge and a contribution with their own dialog's request id", async () => {
    current.funds = [{ id: "fund-1", name: "Boiler fund", targetMinor: 50000, contributedMinor: 0, commitments: [
      { id: "pledge-2", userId: "user-2", amountMinor: 3000, contributedMinor: 0, dueOn: "2026-11-01" },
    ] }];
    lostOnce("/funds/fund-1/pledges", () => ({ id: "pledge-1", duplicate: true }));
    mount("/funds");
    fireEvent.click(await screen.findByRole("button", { name: "Make a pledge" }));
    let dialog = screen.getByRole("dialog", { name: "Make a pledge" });
    fireEvent.change(within(dialog).getByLabelText("Pledge amount (GBP)"), { target: { value: "50.00" } });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save" })); });
    expect(within(dialog).getByRole("alert").textContent).toBe(UNCERTAIN_RETRY_SAFE);
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save" })); });
    expect(await screen.findByText("Your pledge was saved.")).toBeTruthy();
    const pledges = sent("/funds/fund-1/pledges");
    expect(pledges).toHaveLength(2);
    expect(pledges[0]).toMatchObject({ amountMinor: 5000, requestId: expect.stringMatching(uuid) });
    expect(pledges[1]).toEqual(pledges[0]);

    lostOnce("/commitments/pledge-2/contributions", () => ({ id: "contribution-1", duplicate: true }));
    fireEvent.click(screen.getByRole("button", { name: "View fund" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Boiler fund" })).getByRole("button", { name: "Record contribution" }));
    dialog = screen.getByRole("dialog", { name: "Record contribution" });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Confirm contribution" })); });
    expect(within(dialog).getByRole("alert").textContent).toBe(UNCERTAIN_RETRY_SAFE);
    expect(dialog.querySelector("fieldset")!.disabled).toBe(true);
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Confirm contribution" })); });
    expect(await screen.findByText("Contribution recorded. No payment was taken by Commune.")).toBeTruthy();
    const contributions = sent("/commitments/pledge-2/contributions");
    expect(contributions).toHaveLength(2);
    expect(contributions[0]).toMatchObject({ amountMinor: 3000, requestId: expect.stringMatching(uuid) });
    expect(contributions[1]).toEqual(contributions[0]);
    expect(contributions[0].requestId).not.toBe(pledges[0].requestId);
  });

  it("does not call a later refusal nothing saved once a fund, pledge or contribution attempt may have saved", async () => {
    current.funds = [{ id: "fund-1", name: "Boiler fund", targetMinor: 50000, contributedMinor: 0, commitments: [
      { id: "pledge-2", userId: "user-2", amountMinor: 3000, contributedMinor: 0, dueOn: "2026-11-01" },
    ] }];
    /** The first attempt may have saved; the retry is then refused. Returns what the dialog says. */
    async function refusedAfterLoss(path: string, title: string, button: string, refusal: ApiError) {
      lostOnce(path, () => { throw refusal; });
      const dialog = screen.getByRole("dialog", { name: title });
      await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: button })); });
      expect(within(dialog).getByRole("alert").textContent).toBe(UNCERTAIN_RETRY_SAFE);
      await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: button })); });
      expect(sent(path)).toHaveLength(2);
      const said = within(dialog).getByRole("alert").textContent;
      fireEvent.click(within(dialog).getByRole("button", { name: "Close dialog" }));
      return said;
    }
    mount("/funds");
    fireEvent.click(await screen.findByRole("button", { name: "Create fund" }));
    fireEvent.change(within(screen.getByRole("dialog", { name: "Create a fund" })).getByLabelText("Fund name"), { target: { value: "Garden" } });
    expect(await refusedAfterLoss("/communes/home-1/funds", "Create a fund", "Save", new ApiError("Not a commune member", 403)))
      .toBe("An earlier attempt may already have been saved. Close this and check Funds before adding it again.");

    fireEvent.click(screen.getByRole("button", { name: "Make a pledge" }));
    fireEvent.change(within(screen.getByRole("dialog", { name: "Make a pledge" })).getByLabelText("Pledge amount (GBP)"), { target: { value: "50.00" } });
    expect(await refusedAfterLoss("/funds/fund-1/pledges", "Make a pledge", "Save", new ApiError("Not a commune member", 403)))
      .toBe("An earlier attempt may already have been saved. Close this and check the fund before adding it again.");

    fireEvent.click(screen.getByRole("button", { name: "View fund" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Boiler fund" })).getByRole("button", { name: "Record contribution" }));
    expect(await refusedAfterLoss("/commitments/pledge-2/contributions", "Record contribution", "Confirm contribution",
      new ApiError("Sign in again to continue", 401)))
      .toBe("An earlier attempt may already have been saved. Close this and check the fund before adding it again.");

    // A dialog opened afterwards has had no attempt, so its refusal still means nothing was saved.
    vi.mocked(post).mockImplementation(async () => { throw new ApiError("Not a commune member", 403); });
    fireEvent.click(screen.getByRole("button", { name: "Create fund" }));
    const dialog = screen.getByRole("dialog", { name: "Create a fund" });
    fireEvent.change(within(dialog).getByLabelText("Fund name"), { target: { value: "Bikes" } });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save" })); });
    expect(within(dialog).getByRole("alert").textContent).toBe("Not a commune member. Nothing was saved.");
  });
});

describe("changing someone else's pledge", () => {
  function boilerFund(pledger: string, contributedMinor = 2000): Snapshot["funds"][number] {
    return { id: "fund-1", name: "Boiler fund", targetMinor: 50000, contributedMinor, commitments: [{
      id: "pledge-1", userId: pledger, amountMinor: 12000, contributedMinor, dueOn: "2026-11-01",
      contributions: contributedMinor ? [{ id: "contribution-1", amountMinor: contributedMinor, contributedAt: "2026-10-01T12:00:00Z", voidedAt: null, voidReason: null }] : [],
    }] };
  }
  /** Each change sent for the pledge: its method and parsed body. */
  const changes = () => vi.mocked(api).mock.calls.filter(([path]) => path === "/commitments/pledge-1")
    .map(([, init]) => ({ method: init?.method, body: JSON.parse(String(init?.body)) as Record<string, unknown> }));
  async function openFund() {
    mount("/funds");
    fireEvent.click(await screen.findByRole("button", { name: "View fund" }));
    return screen.getByRole("dialog", { name: "Boiler fund" });
  }
  async function openEditor() {
    fireEvent.click(within(await openFund()).getByRole("button", { name: "Edit pledge" }));
    return screen.getByRole("dialog", { name: "Edit pledge" });
  }

  it("lets an admin only lower it or move it later, and says who can do the rest", async () => {
    current.funds = [boilerFund("user-2")];
    const dialog = await openEditor();
    expect(dialog.textContent).toContain(
      "You can lower this pledge or move its due date later. Only Housemate can raise it or bring the date forward. They will be told what you changed.");
    expect(dialog.textContent).toContain("Up to £120.00, and not below the £20.00 already recorded.");
    expect(dialog.textContent).toContain("1 Nov 2026 or later.");
    const amount = within(dialog).getByLabelText("Pledge amount (GBP)") as HTMLInputElement;
    const due = within(dialog).getByLabelText("Due date") as HTMLInputElement;
    expect(due.min).toBe("2026-11-01");
    const form = dialog.querySelector("form")!;

    fireEvent.change(amount, { target: { value: "130.00" } });
    fireEvent.submit(form);
    expect(within(dialog).getByRole("alert").textContent).toBe("Only Housemate can raise this pledge. Enter £120.00 or less.");
    fireEvent.change(amount, { target: { value: "100.00" } });
    fireEvent.change(due, { target: { value: "2026-10-20" } });
    fireEvent.submit(form);
    expect(within(dialog).getByRole("alert").textContent).toBe("Only Housemate can bring the due date forward. Choose 1 Nov 2026 or later.");
    fireEvent.change(amount, { target: { value: "10.00" } });
    fireEvent.change(due, { target: { value: "2026-11-15" } });
    fireEvent.submit(form);
    expect(within(dialog).getByRole("alert").textContent).toBe("£20.00 is already recorded, so the pledge cannot be lower than that.");
    expect(changes()).toHaveLength(0);

    fireEvent.change(amount, { target: { value: "100.00" } });
    await act(async () => { fireEvent.submit(form); });
    // The change names the pledge it was based on, so it cannot undo a later one.
    expect(changes()).toEqual([{ method: "PATCH",
      body: { amountMinor: 10000, dueOn: "2026-11-15", expectedAmountMinor: 12000, expectedDueOn: "2026-11-01" } }]);
    expect(await screen.findByText("Pledge saved.")).toBeTruthy();
  });

  it("lets the pledger raise their own pledge and bring it forward", async () => {
    current.funds = [boilerFund(user.id)];
    const dialog = await openEditor();
    expect(dialog.textContent).not.toContain("You can lower this pledge");
    expect(dialog.textContent).toContain("Not below the £20.00 already recorded.");
    const due = within(dialog).getByLabelText("Due date") as HTMLInputElement;
    expect(due.min).toBe("");
    fireEvent.change(within(dialog).getByLabelText("Pledge amount (GBP)"), { target: { value: "150.00" } });
    fireEvent.change(due, { target: { value: "2026-10-20" } });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save" })); });
    expect(changes()).toEqual([{ method: "PATCH",
      body: { amountMinor: 15000, dueOn: "2026-10-20", expectedAmountMinor: 12000, expectedDueOn: "2026-11-01" } }]);
    expect(await screen.findByText("Your pledge was saved.")).toBeTruthy();
  });

  it("shows the server's refusal when the pledge changed meanwhile", async () => {
    current.funds = [boilerFund("user-2")];
    const base = vi.mocked(api).getMockImplementation()!;
    vi.mocked(api).mockImplementation(async (path, options) => {
      if (path === "/commitments/pledge-1") throw new ApiError("Only the person who made this pledge can raise it or bring its due date forward", 403);
      return base(path, options);
    });
    const dialog = await openEditor();
    fireEvent.change(within(dialog).getByLabelText("Pledge amount (GBP)"), { target: { value: "110.00" } });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save" })); });
    expect(within(dialog).getByRole("alert").textContent).toBe("Only the person who made this pledge can raise it or bring its due date forward");
    expect(dialog.querySelector("fieldset")!.disabled).toBe(false);
  });

  const changedMeanwhile = "This pledge changed while you were editing. Nothing was saved. Check it again.";
  /** The first change is refused because Housemate raised the pledge to £150.00 meanwhile. */
  function raisedMeanwhile(contributedMinor: number) {
    const base = vi.mocked(api).getMockImplementation()!;
    let refused = false;
    vi.mocked(api).mockImplementation(async (path, options) => {
      if (path === "/commitments/pledge-1" && !refused) {
        refused = true;
        const fund = boilerFund("user-2", contributedMinor);
        current = { ...current, funds: [{ ...fund, commitments: [{ ...fund.commitments[0], amountMinor: 15000 }] }] };
        throw new ApiError(changedMeanwhile, 409);
      }
      return base(path, options);
    });
  }

  it("reloads the fund and starts the editor again when the pledge changed meanwhile", async () => {
    current.funds = [boilerFund("user-2")];
    raisedMeanwhile(2000);
    const dialog = await openEditor();
    const amount = within(dialog).getByLabelText("Pledge amount (GBP)") as HTMLInputElement;
    fireEvent.change(amount, { target: { value: "90.00" } });
    const loads = vi.mocked(loadSnapshot).mock.calls.length;
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save" })); });
    await waitFor(() => expect(within(dialog).getByRole("alert").textContent).toBe(changedMeanwhile));
    // The fund was reloaded, and the editor now starts from the pledge as it is.
    expect(vi.mocked(loadSnapshot).mock.calls.length).toBeGreaterThan(loads);
    await waitFor(() => expect(amount.value).toBe("150.00"));
    expect(dialog.textContent).toContain("Up to £150.00, and not below the £20.00 already recorded.");
    fireEvent.change(amount, { target: { value: "90.00" } });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save" })); });
    expect(changes().map((change) => change.body)).toEqual([
      { amountMinor: 9000, dueOn: "2026-11-01", expectedAmountMinor: 12000, expectedDueOn: "2026-11-01" },
      { amountMinor: 9000, dueOn: "2026-11-01", expectedAmountMinor: 15000, expectedDueOn: "2026-11-01" },
    ]);
    expect(await screen.findByText("Pledge saved.")).toBeTruthy();
  });

  it("reloads the fund when the pledge changed before it was cancelled", async () => {
    current.funds = [boilerFund("user-2", 0)];
    raisedMeanwhile(0);
    fireEvent.click(within(await openFund()).getByRole("button", { name: "Cancel pledge" }));
    const dialog = screen.getByRole("dialog", { name: "Cancel this pledge?" });
    expect(dialog.textContent).toContain("Cancel the £120.00 pledge?");
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Cancel pledge" })); });
    await waitFor(() => expect(within(dialog).getByRole("alert").textContent).toBe(changedMeanwhile));
    await waitFor(() => expect(dialog.textContent).toContain("Cancel the £150.00 pledge?"));
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Cancel pledge" })); });
    expect(changes().map((change) => change.body)).toEqual([
      { cancel: true, expectedAmountMinor: 12000, expectedDueOn: "2026-11-01" },
      { cancel: true, expectedAmountMinor: 15000, expectedDueOn: "2026-11-01" },
    ]);
    expect(await screen.findByText("Pledge cancelled.")).toBeTruthy();
  });

  it("tells an admin that the pledger will hear about a cancellation", async () => {
    current.funds = [boilerFund("user-2", 0)];
    fireEvent.click(within(await openFund()).getByRole("button", { name: "Cancel pledge" }));
    const dialog = screen.getByRole("dialog", { name: "Cancel this pledge?" });
    expect(dialog.textContent).toContain("Housemate will be told that you cancelled it.");
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Cancel pledge" })); });
    expect(changes()).toEqual([{ method: "PATCH", body: { cancel: true, expectedAmountMinor: 12000, expectedDueOn: "2026-11-01" } }]);
  });

  it("does not mention a notice when the pledger cancels their own pledge", async () => {
    current.funds = [boilerFund(user.id, 0)];
    fireEvent.click(within(await openFund()).getByRole("button", { name: "Cancel pledge" }));
    expect(screen.getByRole("dialog", { name: "Cancel this pledge?" }).textContent).not.toContain("will be told");
  });
});

describe("pledge notices", () => {
  it("names who changed or cancelled the reader's pledge and opens its fund", async () => {
    current.members[1].role = "admin";
    current.funds = [{ id: "fund-1", name: "Boiler fund", targetMinor: 50000, contributedMinor: 0, commitments: [
      { id: "pledge-1", userId: user.id, amountMinor: 11000, contributedMinor: 0, dueOn: "2026-11-01" },
      { id: "pledge-0", userId: user.id, amountMinor: 3000, contributedMinor: 0, dueOn: "2026-10-01", cancelledAt: "2026-10-02T09:00:00Z" },
    ] }];
    current.notifications = [
      { id: "notice-1", kind: "pledge-changed", sourceId: "pledge-1", amountMinor: 11000, communeId: commune.id, senderUserId: "user-2",
        expenseId: null, title: "Boiler fund", detail: "Lowered from £120.00 to £110.00.", createdAt: "2026-10-07T09:00:00Z", readAt: null },
      { id: "notice-2", kind: "pledge-cancelled", sourceId: "pledge-0", amountMinor: 3000, communeId: commune.id, senderUserId: "user-2",
        expenseId: null, title: "Boiler fund", detail: null, createdAt: "2026-10-02T09:00:00Z", readAt: "2026-10-03T09:00:00Z" },
    ];
    mount("/hub");
    await screen.findByRole("heading", { name: "Shared essentials" });
    act(() => app.go("notices"));
    const [changed, cancelled] = within(await screen.findByRole("dialog", { name: "Notices" })).getAllByRole("button", { name: /Boiler fund/ });
    expect(changed.textContent).toContain("Changed");
    expect(changed.textContent).toContain("Your pledge was changed by Housemate");
    expect(changed.textContent).toContain("Lowered from £120.00 to £110.00.");
    expect(cancelled.textContent).toContain("Cancelled");
    expect(cancelled.textContent).toContain("Your £30.00 pledge was cancelled by Housemate");
    await act(async () => { fireEvent.click(changed); });
    expect(vi.mocked(post)).toHaveBeenCalledWith("/notifications/notice-1/read", {});
    expect(await screen.findByRole("dialog", { name: "Boiler fund" })).toBeTruthy();
  });
});

describe("who sent each invitation", () => {
  it("names the sender and says when a membership change withdraws their invitations", async () => {
    current.members[1].role = "admin";
    const day = 24 * 60 * 60 * 1000;
    const at = (offset: number) => new Date(Date.now() + offset * day).toISOString();
    const records = [
      { id: "inv-1", email: "theirs@example.test", role: "member", createdAt: at(-1), expiresAt: at(6), acceptedAt: null, revokedAt: null,
        invitedBy: "user-2", invitedByName: "Housemate" },
      { id: "inv-2", email: "mine@example.test", role: "admin", createdAt: at(-2), expiresAt: at(5), acceptedAt: null, revokedAt: null,
        invitedBy: user.id, invitedByName: user.name },
      { id: "inv-3", email: "withdrawn@example.test", role: "admin", createdAt: at(-9), expiresAt: at(-2), acceptedAt: null, revokedAt: at(-3),
        invitedBy: "gone-1", invitedByName: "Priya Shah" },
      { id: "inv-4", email: "older@example.test", role: "member", createdAt: at(-20), expiresAt: at(-13), acceptedAt: at(-19), revokedAt: null,
        invitedBy: "gone-2", invitedByName: null },
    ];
    const base = vi.mocked(api).getMockImplementation()!;
    vi.mocked(api).mockImplementation(async (path, options) => path.endsWith("/invites") ? { invites: records } : base(path, options));
    mount("/members");
    const theirs = (await screen.findByText("theirs@example.test")).closest(".a-member-row") as HTMLElement;
    expect(theirs.textContent).toContain(`sent by Housemate on ${formatTimestampDay(records[0].createdAt)}`);
    const mine = screen.getByText("mine@example.test").closest(".a-member-row") as HTMLElement;
    expect(mine.textContent).toContain(`sent by you on ${formatTimestampDay(records[1].createdAt)}`);
    const history = screen.getByText("2 past invitations").closest("details")!;
    expect(history.textContent).toContain("withdrawn@example.test · admin · revoked");
    expect(history.textContent).toContain("sent by Priya Shah");
    expect(history.textContent).toContain("older@example.test · member · accepted");
    expect(history.textContent).toContain("sent by a former member");

    const ask = (userId: string, button: string, title: string) => {
      fireEvent.click(within(document.getElementById(`search-record-member-${userId}`)!).getByRole("button", { name: button }));
      const dialog = screen.getByRole("dialog", { name: title });
      const text = dialog.textContent;
      fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
      return text;
    };
    expect(ask("user-2", "Make member", "Make Housemate a member?")).toContain("Their open invitation will be withdrawn.");
    expect(ask("user-2", "Remove", "Remove Housemate?")).toContain("Their open invitation will be withdrawn.");
    expect(ask(user.id, "Make member", "Make Test Person a member?")).toContain("Your open invitation will be withdrawn.");
    expect(ask(user.id, "Leave", "Leave Our home?")).toContain("Your open invitation will be withdrawn.");
    expect(post).not.toHaveBeenCalled();
  });
});

describe("an admin's own pledge", () => {
  const withPledges = () => {
    current.funds = [{ id: "fund-1", name: "Boiler fund", targetMinor: 50000, contributedMinor: 0, commitments: [
      { id: "pledge-1", userId: user.id, amountMinor: 4000, contributedMinor: 0, dueOn: "2026-11-01" },
      { id: "pledge-2", userId: "user-2", amountMinor: 3000, contributedMinor: 0, dueOn: "2026-11-01" },
    ] }];
  };
  const rows = async () => {
    fireEvent.click(await screen.findByRole("button", { name: "View fund" }));
    const dialog = screen.getByRole("dialog", { name: "Boiler fund" });
    return Array.from(dialog.querySelectorAll<HTMLElement>(".c-pledge-row"));
  };

  it("is left to another admin to confirm when there is one", async () => {
    current.members.push({ userId: "user-3", name: "Co-admin", role: "admin", active: true });
    withPledges();
    mount("/funds");
    const [mine, theirs] = await rows();
    expect(within(mine).queryByRole("button", { name: "Record contribution" })).toBeNull();
    expect(mine.textContent).toContain("Another admin records what you contribute to your own pledge.");
    expect(within(theirs).getByRole("button", { name: "Record contribution" })).toBeTruthy();
  });

  it("can be confirmed by its admin when they are the only one", async () => {
    current.members.push({ userId: "user-3", name: "Former admin", role: "admin", active: false });
    withPledges();
    mount("/funds");
    const [mine] = await rows();
    expect(within(mine).getByRole("button", { name: "Record contribution" })).toBeTruthy();
    expect(mine.textContent).not.toContain("Another admin");
  });
});
