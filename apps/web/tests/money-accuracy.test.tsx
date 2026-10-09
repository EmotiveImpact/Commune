import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "../src/App";
import { AppProvider } from "../src/state";
import { api, post, loadCommunes, loadSnapshot } from "../src/live/api";
import { money, type Commune, type Snapshot } from "../src/live/model";

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
