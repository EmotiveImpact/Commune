import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "../src/App";
import { preloadAll } from "../src/shell/lazyComponent";
import { AppProvider, useApp, type AppState } from "../src/state";
import { api, post, loadCommunes, loadSnapshot } from "../src/live/api";
import type { Commune, Snapshot } from "../src/live/model";
import { addDays, todayIso, type OperationItem } from "../src/data/operations";
import { HOLD_MS } from "../src/ui/DoneByChoice";

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
    { userId: "user-2", name: "Housemate Two", role: "member", active: true },
  ],
  expenses: [], funds: [], notes: [], operations: [], notifications: [], reminderTargets: [], sentReminders: [],
  recurringBills: [], splitTemplates: [], activityEvents: [],
};
const today = todayIso();
const rota: OperationItem = {
  id: "task-1", hubId: commune.id, kind: "task", category: "chore", title: "Put the bins out", date: addDays(today, -2), allDay: true,
  assignee: "Housemate Two", assigneeId: "user-2", rotation: [user.name, "Housemate Two"], rotationIds: [user.id, "user-2"],
  repeat: "weekly", status: "open", notes: "", undoOccurrenceId: null, history: [], version: 1,
};
let current: Snapshot;
let app: AppState;
function Capture() { app = useApp(); return null; }
function mount(path: string) {
  const location = memoryLocation({ path, record: true });
  render(<Router hook={location.hook}><AppProvider><Capture /><App /></AppProvider></Router>);
}
const modalDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const closeDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
const originalScroll = Element.prototype.scrollIntoView;
// The screens and windows a browser loads on first use are loaded up front,
// so each test sees them drawn at once.
beforeAll(preloadAll);
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
  current.operations = [structuredClone(rota)];
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === "/auth/me") return { user };
    if (path === "/reminders/usage") return { totalUsed: 0, totalLimit: 60, recipientLimit: 8, recipientUsage: {}, nextSlotAt: null };
    if (path.endsWith("/invites")) return { invites: [] };
    return { ok: true };
  });
  vi.mocked(post).mockResolvedValue({ ok: true });
  vi.mocked(loadCommunes).mockResolvedValue({ communes: [commune] });
  vi.mocked(loadSnapshot).mockImplementation(async () => current);
});
afterEach(cleanup);

const hold = () => act(() => new Promise((resolve) => setTimeout(resolve, HOLD_MS + 60)));
function serverCompletes() {
  const next = addDays(today, 5);
  current.operations = [{ ...rota, date: next, assignee: user.name, assigneeId: user.id }];
  return { id: "occurrence-1", duplicate: false, date: next, assignee: user.name, assigneeId: user.id, status: "open" };
}

describe("marking someone else's task done", () => {
  it("asks who did it, ignores a tap, and records the answer once it is held", async () => {
    vi.mocked(post).mockImplementation(async () => serverCompletes());
    mount("/operations");
    const done = await screen.findByRole("button", { name: /^Done · Test \(/ });
    await act(async () => { fireEvent.click(done); });
    expect(vi.mocked(post)).not.toHaveBeenCalled();
    const ask = screen.getByRole("group", { name: /This is Housemate’s turn\. Who did it\?/ });
    const theyDid = within(ask).getByRole("button", { name: "Housemate did it" });
    expect(document.activeElement).toBe(within(ask).getByRole("button", { name: "I did it" }));
    // A tap is not enough.
    fireEvent.pointerDown(theyDid, { button: 0, pointerId: 1 });
    fireEvent.pointerUp(theyDid, { button: 0, pointerId: 1 });
    fireEvent.click(theyDid);
    expect(within(ask).getByRole("status").textContent).toBe("Keep holding until the bar fills.");
    fireEvent.click(theyDid);
    expect(within(ask).getByRole("status").textContent).toBe("Press and hold to confirm.");
    expect(vi.mocked(post)).not.toHaveBeenCalled();
    // Held until the bar fills, it counts.
    fireEvent.pointerDown(theyDid, { button: 0, pointerId: 1 });
    expect(theyDid.className).toContain("is-holding");
    await hold();
    expect(vi.mocked(post)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(post).mock.calls[0][1]).toMatchObject({ action: "completed", expectedDate: rota.date, doneBy: "assignee" });
    expect(document.querySelector(".ops-toast")?.textContent).toContain("Marked done for Housemate");
  });

  it("takes a keyboard hold for I did it, and Cancel puts the Done button back", async () => {
    vi.mocked(post).mockImplementation(async () => serverCompletes());
    mount("/operations");
    const done = await screen.findByRole("button", { name: /^Done · Test \(/ });
    await act(async () => { fireEvent.click(done); });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("group", { name: /Who did it/ })).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /^Done · Test \(/ })); });
    const mine = screen.getByRole("button", { name: "I did it" });
    fireEvent.keyDown(mine, { key: " " });
    await hold();
    fireEvent.keyUp(mine, { key: " " });
    expect(vi.mocked(post).mock.calls[0][1]).toMatchObject({ action: "completed", doneBy: "me" });
    expect(document.querySelector(".ops-toast")?.textContent).toContain("Done, covering Housemate");
  });

  it("marks your own task done at once, with no question", async () => {
    current.operations = [{ ...rota, assignee: user.name, assigneeId: user.id }];
    vi.mocked(post).mockImplementation(async () => serverCompletes());
    mount("/operations");
    const done = await screen.findByRole("button", { name: /^Done · Housemate \(/ });
    await act(async () => { fireEvent.click(done); });
    expect(screen.queryByRole("group", { name: /Who did it/ })).toBeNull();
    expect(vi.mocked(post).mock.calls[0][1]).not.toHaveProperty("doneBy");
  });

  it("asks in the task window and on This Hub too", async () => {
    vi.mocked(post).mockImplementation(async () => serverCompletes());
    mount("/hub");
    const box = await screen.findByRole("checkbox", { name: "Mark Put the bins out done" });
    await act(async () => { fireEvent.click(box); });
    expect(vi.mocked(post)).not.toHaveBeenCalled();
    const hubAsk = screen.getByRole("group", { name: /This is Housemate’s turn/ });
    fireEvent.click(within(hubAsk).getByRole("button", { name: "Cancel" }));

    act(() => app.go("operation", { operation: "task-1" }));
    const windowFrame = await screen.findByRole("dialog", { name: "Put the bins out" });
    await act(async () => { fireEvent.click(within(windowFrame).getByRole("button", { name: "Done" })); });
    const ask = within(windowFrame).getByRole("group", { name: /This is Housemate’s turn/ });
    fireEvent.pointerDown(within(ask).getByRole("button", { name: "Housemate did it" }), { button: 0, pointerId: 1 });
    await hold();
    expect(vi.mocked(post).mock.calls[0][1]).toMatchObject({ doneBy: "assignee" });
    expect(within(windowFrame).getByText("Marked done for Housemate. You can undo this in History.")).toBeTruthy();
  });

  it("shows both names in the history and on the task", async () => {
    current.operations = [{ ...rota, date: addDays(today, 5), assignee: user.name, assigneeId: user.id,
      lastDone: { by: "Housemate Two", date: today, markedBy: user.name },
      history: [
        { id: "occurrence-2", action: "completed", dueOn: today, assignee: "Housemate Two", assigneeId: "user-2", actorId: user.id, doneById: "user-2",
          actedOn: today, actedAt: new Date().toISOString(), nextDate: addDays(today, 5), nextAssignee: user.name, undoneAt: null, undoneBy: null },
        { id: "occurrence-1", action: "completed", dueOn: addDays(today, -7), assignee: "Housemate Two", assigneeId: "user-2", actorId: user.id, doneById: user.id,
          actedOn: addDays(today, -7), actedAt: new Date(Date.now() - 7 * 86_400_000).toISOString(), nextDate: today, nextAssignee: "Housemate Two", undoneAt: null, undoneBy: null },
      ] }];
    mount("/operations");
    await screen.findByRole("group", { name: "Operations view" });
    act(() => app.go("operation", { operation: "task-1" }));
    const windowFrame = await screen.findByRole("dialog", { name: "Put the bins out" });
    const entries = windowFrame.querySelectorAll(".operation-history > div");
    expect(entries[0].textContent).toContain("Completed by Housemate Two, marked by Test Person on");
    expect(entries[1].textContent).toContain("Completed by Test Person, covering Housemate on");
    expect(within(windowFrame).getByText("Last done").nextElementSibling?.textContent).toMatch(/^Housemate Two · .+ · marked by Test$/);
  });
});
