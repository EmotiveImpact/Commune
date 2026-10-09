import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "../src/App";
import { AppProvider } from "../src/state";
import { api, post, loadCommunes, loadSnapshot } from "../src/live/api";
import { money, type Commune, type Snapshot } from "../src/live/model";
import { LIMITS } from "../src/data/limits";

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
function mount(path: string) {
  const location = memoryLocation({ path, record: true });
  render(<Router hook={location.hook}><AppProvider><App /></AppProvider></Router>);
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
  vi.mocked(post).mockImplementation(async (to) => to === "/communes/home-1/expenses" ? { id: "expense-9", duplicate: false } : { id: "new-id", ok: true });
  vi.mocked(loadCommunes).mockImplementation(async () => ({ communes: [current.commune] }));
  vi.mocked(loadSnapshot).mockImplementation(async () => current);
});
afterEach(cleanup);

/** The bodies posted to one path, in order. */
const sent = (path: string) => vi.mocked(post).mock.calls.filter(([to]) => to === path).map(([, body]) => body as Record<string, unknown>);

async function openExpenseForm(title: string, amount: string) {
  fireEvent.click(await screen.findByRole("button", { name: "Add expense", exact: true }));
  const dialog = screen.getByRole("dialog", { name: "Add expense" });
  fireEvent.change(within(dialog).getByLabelText("What was it for?"), { target: { value: title } });
  fireEvent.change(within(dialog).getByLabelText(`Amount (${current.commune.currency})`), { target: { value: amount } });
  return dialog;
}

describe("Add expense saves the split it previews", () => {
  it("gives the spare penny to the same person in the preview and the save, whatever order people were ticked in", async () => {
    current.members.push({ userId: "user-3", name: "Third Housemate", role: "member", active: true });
    mount("/expenses");
    const dialog = await openExpenseForm("Pizza", "10.00");
    // Untick and tick yourself again: you are now last in the order ticked.
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Include Test Person" }));
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Include Test Person" }));
    const preview = Object.fromEntries(Array.from(dialog.querySelectorAll(".c-split-person")).map((row) =>
      [row.querySelector(".c-split-name")!.textContent, row.querySelector(".c-split-amount span")!.textContent]));
    const yourShare = within(dialog).getByText("Your share").nextElementSibling!.textContent;
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save expense" })); });
    const [body] = sent("/communes/home-1/expenses");
    const names: Record<string, string> = { "user-1": "Test Person", "user-2": "Housemate", "user-3": "Third Housemate" };
    const saved = Object.fromEntries((body.shares as Array<{ userId: string; amountMinor: number }>)
      .map((share) => [names[share.userId], money(share.amountMinor, "GBP")]));
    expect(Object.values(saved).sort()).toEqual(["£3.33", "£3.33", "£3.34"]);
    expect(saved).toEqual(preview);
    expect(yourShare).toBe(saved["Test Person"]);
  });
});

describe("every money field reads amounts the same way", () => {
  /** The JSON bodies sent through api() to one path, in order. */
  const workflowBodies = (path: string) => vi.mocked(api).mock.calls.filter(([to]) => to === path)
    .map(([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>);
  const save = (dialog: HTMLElement) => act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save expense" })); });

  it("saves an expense typed with a thousands comma", async () => {
    mount("/expenses");
    const dialog = await openExpenseForm("Rent", "1,200");
    expect(within(dialog).getByText("Total").nextElementSibling!.textContent).toBe("£1,200.00");
    await save(dialog);
    const [body] = sent("/communes/home-1/expenses");
    expect(body.amountMinor).toBe(120000);
    expect((body.shares as Array<{ amountMinor: number }>).map((share) => share.amountMinor)).toEqual([60000, 60000]);
  });

  it("explains the full stop in a pound commune, and saves nothing", async () => {
    mount("/expenses");
    const dialog = await openExpenseForm("Lunch", "12,50");
    await save(dialog);
    expect(within(dialog).getByRole("alert").textContent).toBe("Use a full stop for pence, like 12.50.");
    expect(sent("/communes/home-1/expenses")).toHaveLength(0);
  });

  it("reads a decimal comma in a euro commune", async () => {
    current.commune = { ...current.commune, currency: "EUR" };
    mount("/expenses");
    const dialog = await openExpenseForm("Lunch", "12,50");
    await save(dialog);
    expect(sent("/communes/home-1/expenses")[0]).toMatchObject({ amountMinor: 1250 });
  });

  it("refuses more than the database accepts before sending anything", async () => {
    mount("/expenses");
    const dialog = await openExpenseForm("Typo", "10000000000.01");
    await save(dialog);
    expect(within(dialog).getByRole("alert").textContent).toBe("Enter an amount no larger than 10,000,000,000.00.");
    expect(sent("/communes/home-1/expenses")).toHaveLength(0);
  });

  it("saves an exact split template typed with commas in the format the database stores", async () => {
    mount("/templates");
    fireEvent.click(await screen.findByRole("button", { name: "Save template" }));
    const dialog = screen.getByRole("dialog", { name: "Save a split template" });
    fireEvent.change(within(dialog).getByLabelText("Template name"), { target: { value: "Rent" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Exact" }));
    fireEvent.change(within(dialog).getByLabelText("Test Person exact"), { target: { value: "1,000.00" } });
    fireEvent.change(within(dialog).getByLabelText("Housemate exact"), { target: { value: "200" } });
    await act(async () => { fireEvent.submit(dialog.querySelector("form")!); });
    expect(workflowBodies("/communes/home-1/templates")[0]?.participants).toEqual([
      { userId: "user-1", value: "1000.00" },
      { userId: "user-2", value: "200.00" },
    ]);
  });

  it("creates a fund with a target typed with a thousands comma", async () => {
    mount("/funds");
    fireEvent.click(await screen.findByRole("button", { name: "Create fund" }));
    const dialog = screen.getByRole("dialog", { name: "Create a fund" });
    fireEvent.change(within(dialog).getByLabelText("Fund name"), { target: { value: "Holiday" } });
    const target = within(dialog).getByLabelText("Target (optional) (GBP)") as HTMLInputElement;
    fireEvent.change(target, { target: { value: "2,500" } });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save" })); });
    expect(sent("/communes/home-1/funds")[0]).toMatchObject({ name: "Holiday", targetMinor: 250000 });
    expect(target.maxLength).toBe(LIMITS.money);
  });

  it("adds a recurring bill typed with a thousands comma", async () => {
    mount("/recurring");
    fireEvent.click(await screen.findByRole("button", { name: "Add recurring bill" }));
    const dialog = screen.getByRole("dialog", { name: "Add recurring bill" });
    fireEvent.change(within(dialog).getByLabelText("Bill name"), { target: { value: "Rent" } });
    const amount = within(dialog).getByLabelText("Amount (GBP)") as HTMLInputElement;
    fireEvent.change(amount, { target: { value: "1,250" } });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save recurring bill" })); });
    expect(workflowBodies("/communes/home-1/recurring")[0]).toMatchObject({ amountMinor: 125000 });
    expect(amount.maxLength).toBe(LIMITS.money);
  });

  it("records a repayment typed with a thousands comma", async () => {
    current.expenses = [{
      id: "expense-1", title: "Deposit", category: "Rent", amountMinor: 300000, paidByUserId: user.id,
      dueOn: null, createdAt: "2026-10-01T10:00:00Z",
      shares: [
        { id: "share-own", userId: user.id, amountMinor: 150000, settledMinor: 150000 },
        { id: "share-1", userId: "user-2", amountMinor: 150000, settledMinor: 0 },
      ],
    }];
    vi.mocked(post).mockImplementation(async () => ({ id: "receipt-1", duplicate: false, settledMinor: 120000, outstandingMinor: 30000 }));
    mount("/settle");
    fireEvent.click(await screen.findByRole("button", { name: "Confirm received" }));
    const dialog = screen.getByRole("dialog", { name: "Record a repayment from Housemate" });
    fireEvent.change(within(dialog).getByLabelText(/Amount received/), { target: { value: "1,200" } });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Record £1,200.00 received" })); });
    expect(sent("/shares/share-1/receipts")[0]).toMatchObject({ amountMinor: 120000 });
  });
});

describe("the currency stays as it is once the commune has amounts", () => {
  const hint = (select: HTMLElement) => select.parentElement!.querySelector(".hint")!.textContent;
  const taxi: Snapshot["expenses"][number] = {
    id: "expense-1", title: "Taxi", category: "Travel", amountMinor: 900, paidByUserId: user.id, dueOn: null,
    createdAt: "2026-10-01T10:00:00Z", voidedAt: "2026-10-02T10:00:00Z", voidedBy: user.id, voidReason: "Entered twice",
    shares: [
      { id: "share-own", userId: user.id, amountMinor: 450, settledMinor: 450 },
      { id: "share-1", userId: "user-2", amountMinor: 450, settledMinor: 0 },
    ],
  };
  const bill: NonNullable<Snapshot["recurringBills"]>[number] = {
    id: "bill-1", title: "Broadband", amountMinor: 3000, paidByUserId: user.id,
    allocations: [{ userId: user.id, amountMinor: 1500 }, { userId: "user-2", amountMinor: 1500 }],
    frequency: "monthly", nextDueOn: "2026-11-01", paused: false, createdBy: user.id, version: 1, archivedAt: null,
  };
  const template = (method: "Exact" | "Percentage", archivedAt: string | null = null): NonNullable<Snapshot["splitTemplates"]>[number] => ({
    id: `template-${method}`, name: method, method, createdBy: user.id, archivedAt,
    participants: [{ userId: user.id, value: method === "Exact" ? "600.00" : "50" }, { userId: "user-2", value: method === "Exact" ? "400.00" : "50" }],
  });

  it("keeps it locked when every expense is voided, and says why", async () => {
    current.expenses = [taxi];
    current.commune = { ...current.commune, currencyLockedBy: ["expenses"] };
    mount("/commune-settings");
    const select = await screen.findByLabelText("Currency") as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    expect(hint(select)).toBe("Locked because this commune already has an expense, counting voided and archived ones. Changing it would relabel their amounts.");
  });

  it("locks it for a recurring bill or an exact split template, as the database does", async () => {
    current.recurringBills = [bill];
    current.splitTemplates = [template("Exact", "2026-10-03T10:00:00Z")];
    current.commune = { ...current.commune, currencyLockedBy: ["recurringBills", "exactSplitTemplates"] };
    mount("/commune-settings");
    const select = await screen.findByLabelText("Currency") as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    expect(hint(select)).toBe("Locked because this commune already has a recurring bill and an exact split template, counting voided and archived ones. Changing it would relabel their amounts.");
  });

  it("works the same rule out from the records when the database does not report it", async () => {
    current.funds = [];
    current.splitTemplates = [template("Exact", "2026-10-03T10:00:00Z")];
    mount("/commune-settings");
    const select = await screen.findByLabelText("Currency") as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    expect(hint(select)).toBe("Locked because this commune already has an exact split template, counting voided and archived ones. Changing it would relabel their amounts.");
  });

  it("can still change while there are no amounts, such as a percentage split", async () => {
    current.splitTemplates = [template("Percentage")];
    current.commune = { ...current.commune, currencyLockedBy: [] };
    mount("/commune-settings");
    const select = await screen.findByLabelText("Currency") as HTMLSelectElement;
    expect(select.disabled).toBe(false);
    expect(hint(select)).toBe("You can change this until the first expense, fund, recurring bill or exact split template is saved.");
    fireEvent.change(select, { target: { value: "EUR" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save changes" })); });
    expect(vi.mocked(api).mock.calls.some(([path, init]) => path === "/communes/home-1" && JSON.parse(String(init?.body)).currency === "EUR")).toBe(true);
  });
});
