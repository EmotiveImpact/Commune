import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "../src/App";
import { AppProvider, useApp, type AppState } from "../src/state";
import { api, post, loadCommunes, loadSnapshot, ApiError } from "../src/live/api";
import type { Commune, Snapshot } from "../src/live/model";
import { addDays, holdsTurn, nextPerson, todayIso, type OperationItem } from "../src/data/operations";

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
  assignee: user.name, rotation: [user.name, "Housemate Two"], repeat: "weekly", status: "open", notes: "", undoOccurrenceId: null, history: [],
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

/** A fake of the server's rule: advance one week past today and rotate. */
function serverCompletes() {
  const next = addDays(today, 5);
  current.operations = [{ ...rota, date: next, assignee: "Housemate Two", lastDone: { by: user.name, date: today }, undoOccurrenceId: "occurrence-1",
    history: [{ id: "occurrence-1", action: "completed", dueOn: rota.date, assignee: user.name, actorId: user.id, actedOn: today, actedAt: new Date().toISOString(),
      nextDate: next, nextAssignee: "Housemate Two", undoneAt: null, undoneBy: null }] }];
  return { id: "occurrence-1", duplicate: false, date: next, assignee: "Housemate Two", status: "open" };
}

describe("task completion, undo and occurrence history", () => {
  it("sends a completion command and reports the rotation the server saved", async () => {
    vi.mocked(post).mockImplementation(async () => serverCompletes());
    mount("/operations");
    const trigger = await screen.findByRole("button", { name: "Done · Housemate" });
    await act(async () => { fireEvent.click(trigger); });
    expect(vi.mocked(post)).toHaveBeenCalledTimes(1);
    const [path, body] = vi.mocked(post).mock.calls[0];
    expect(path).toBe("/operations/task-1/occurrences");
    expect(body).toMatchObject({ action: "completed", expectedDate: rota.date, today });
    expect((body as { requestId: string }).requestId).toMatch(/^[0-9a-f-]{36}$/);
    // No client-computed row overwrite any more.
    expect(vi.mocked(api).mock.calls.some(([requestPath]) => requestPath === "/operations/task-1")).toBe(false);
    const toast = screen.getByRole("status");
    expect(toast.textContent).toContain("Handed to Housemate");
    expect(within(toast).getByRole("button", { name: "Undo" })).toBeTruthy();
  });

  it("undoes the completion from the toast and restores the same person and date", async () => {
    vi.mocked(post).mockImplementation(async (path) => {
      if (path === "/occurrences/occurrence-1/undo") {
        current.operations = [{ ...rota, history: [{ ...current.operations![0].history![0], undoneAt: new Date().toISOString(), undoneBy: user.id }] }];
        return { id: "occurrence-1", duplicate: false, date: rota.date, assignee: user.name, status: "open" };
      }
      return serverCompletes();
    });
    mount("/operations");
    const trigger = await screen.findByRole("button", { name: "Done · Housemate" });
    await act(async () => { fireEvent.click(trigger); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Undo" })); });
    expect(vi.mocked(post).mock.calls.map(([path]) => path)).toEqual(["/operations/task-1/occurrences", "/occurrences/occurrence-1/undo"]);
    expect(screen.getByRole("status").textContent).toContain("Undone · back with Test");
    expect(app.operations[0]).toMatchObject({ date: rota.date, assignee: user.name, undoOccurrenceId: null });
    expect(await screen.findByRole("button", { name: "Done · Housemate" })).toBeTruthy();
  });

  it("shows the other person's result when a completion arrives too late", async () => {
    vi.mocked(post).mockImplementation(async () => {
      serverCompletes();
      throw new ApiError("This task has already moved on. Refresh to see who has it now.", 409);
    });
    mount("/operations");
    const trigger = await screen.findByRole("button", { name: "Done · Housemate" });
    await act(async () => { fireEvent.click(trigger); });
    expect(screen.getByRole("status").textContent).toBe("This task has already moved on. Refresh to see who has it now.");
    expect(screen.getByRole("alert").textContent).toContain("This task has already moved on.");
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    // The stale late card is replaced by what was actually saved.
    expect(app.operations[0]).toMatchObject({ assignee: "Housemate Two", date: addDays(today, 5) });
    expect(screen.queryByRole("button", { name: "Done · Housemate" })).toBeNull();
  });

  it("lists occurrence history in the task window and undoes only the latest action", async () => {
    serverCompletes();
    current.operations![0].history!.push({ id: "occurrence-0", action: "skipped", dueOn: addDays(today, -9), assignee: user.name, actorId: "user-2",
      actedOn: addDays(today, -9), actedAt: new Date(Date.now() - 9 * 86_400_000).toISOString(), nextDate: rota.date, nextAssignee: user.name, undoneAt: null, undoneBy: null });
    vi.mocked(post).mockImplementation(async () => {
      current.operations = [structuredClone(rota)];
      return { id: "occurrence-1", duplicate: false, date: rota.date, assignee: user.name, status: "open" };
    });
    mount("/operations");
    await screen.findByRole("tablist", { name: "Operations view" });
    act(() => app.go("operation", { operation: "task-1" }));
    const windowFrame = await screen.findByRole("dialog", { name: "Put the bins out" });
    expect(within(windowFrame).getByText("History · 2 entries")).toBeTruthy();
    expect(within(windowFrame).getByText(/Completed/).closest("div")?.textContent).toContain("by Test Person");
    expect(within(windowFrame).getByText(/Skipped/).closest("div")?.textContent).toContain("by Housemate Two");
    expect(within(windowFrame).getAllByRole("button", { name: "Undo" })).toHaveLength(1);
    await act(async () => { fireEvent.click(within(windowFrame).getByRole("button", { name: "Undo" })); });
    expect(vi.mocked(post)).toHaveBeenCalledWith("/occurrences/occurrence-1/undo", {});
    expect(within(windowFrame).getByRole("status").textContent).toBe("Undone. The task is back as it was.");
  });

  it("reopens a finished one-off task by undoing its completion, or as a recorded reopen for older tasks", async () => {
    const done: OperationItem = { ...rota, repeat: "none", rotation: undefined, status: "done", date: today, undoOccurrenceId: "occurrence-9" };
    current.operations = [done];
    vi.mocked(post).mockImplementation(async () => ({ id: "occurrence-9", duplicate: false, date: today, assignee: user.name, status: "open" }));
    mount("/operations");
    await screen.findByRole("tablist", { name: "Operations view" });
    act(() => app.go("operation", { operation: "task-1" }));
    const windowFrame = await screen.findByRole("dialog", { name: "Put the bins out" });
    await act(async () => { fireEvent.click(within(windowFrame).getByRole("button", { name: "Mark open" })); });
    expect(vi.mocked(post).mock.calls[0][0]).toBe("/occurrences/occurrence-9/undo");

    current.operations = [{ ...done, undoOccurrenceId: null }];
    await act(async () => { await app.refresh(); });
    vi.mocked(post).mockClear();
    await act(async () => { fireEvent.click(within(windowFrame).getByRole("button", { name: "Mark open" })); });
    expect(vi.mocked(post).mock.calls[0][0]).toBe("/operations/task-1/occurrences");
    expect(vi.mocked(post).mock.calls[0][1]).toMatchObject({ action: "reopened", expectedDate: today });
  });

  it("skips a repeating task as a recorded, undoable action", async () => {
    vi.mocked(post).mockImplementation(async () => ({ id: "occurrence-2", duplicate: false, date: addDays(today, 7), assignee: user.name, status: "open" }));
    mount("/operations");
    const trigger = await screen.findByRole("button", { name: "Skip a week" });
    await act(async () => { fireEvent.click(trigger); });
    expect(vi.mocked(post).mock.calls[0][1]).toMatchObject({ action: "skipped", expectedDate: rota.date });
    const toast = screen.getByRole("status");
    expect(toast.textContent).toContain("Moved to");
    expect(within(toast).getByRole("button", { name: "Undo" })).toBeTruthy();
  });
});

describe("people by member id", () => {
  it("finds the next person and the current turn by id when two members share a name", () => {
    const item = { rotation: ["Sam", "Sam", "Ana"], rotationIds: ["sam-a", "sam-b", "ana"], assignee: "Sam", assigneeId: "sam-b" };
    // By name the first "Sam" would be taken as current and the second "Sam" as next.
    expect(nextPerson(item)).toBe("Ana");
    expect([0, 1, 2].map((index) => holdsTurn(item, index))).toEqual([false, true, false]);
    // Older rows without ids still work by name.
    expect(nextPerson({ rotation: ["Ana", "Bo"], assignee: "Ana" })).toBe("Bo");
  });

  it("saves the person and the turns as member ids, never names", async () => {
    current.operations = [{ ...rota, assigneeId: user.id, rotation: [user.name], rotationIds: null }];
    mount("/operations");
    await screen.findByRole("tablist", { name: "Operations view" });
    act(() => app.go("operation-edit", { operation: "task-1" }));
    const form = await screen.findByRole("group", { name: "Takes turns" });
    const holder = within(form).getByRole("checkbox", { name: /Test Person · You/ }) as HTMLInputElement;
    expect([holder.checked, holder.disabled]).toEqual([true, true]);
    await act(async () => { fireEvent.click(within(form).getByRole("checkbox", { name: /Housemate Two/ })); });
    expect(within(form).getByText("Turn 2")).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save changes" })); });
    const put = vi.mocked(api).mock.calls.find(([path, init]) => path === "/operations/task-1" && init?.method === "PUT");
    expect(put).toBeTruthy();
    const body = JSON.parse(String(put![1]!.body));
    expect(body).toMatchObject({ assigneeId: user.id, rotationIds: [user.id, "user-2"] });
    expect(body).not.toHaveProperty("assignee");
    expect(body).not.toHaveProperty("rotation");
  });

  it("drops the turns when the task stops repeating, and can leave a task unassigned", async () => {
    current.operations = [{ ...rota, assigneeId: user.id, rotationIds: [user.id, "user-2"] }];
    mount("/operations");
    await screen.findByRole("tablist", { name: "Operations view" });
    act(() => app.go("operation-edit", { operation: "task-1" }));
    await screen.findByRole("group", { name: "Takes turns" });
    fireEvent.change(screen.getByLabelText("Repeats"), { target: { value: "none" } });
    expect(screen.queryByRole("group", { name: "Takes turns" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Assigned to"), { target: { value: "" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save changes" })); });
    const put = vi.mocked(api).mock.calls.find(([path, init]) => path === "/operations/task-1" && init?.method === "PUT");
    expect(JSON.parse(String(put![1]!.body))).toMatchObject({ assigneeId: null, rotationIds: null, repeat: "none" });
  });

  it("puts the viewer's own tasks under them by id, and unheld tasks under House", async () => {
    current.operations = [
      { ...rota, date: today, assignee: "Someone Renamed", assigneeId: user.id },
      { ...rota, id: "task-2", title: "Return the keys", date: today, repeat: "none", assignee: undefined, assigneeId: null, rotation: undefined },
    ];
    mount("/operations");
    const tabs = await screen.findByRole("tablist", { name: "Operations view" });
    await act(async () => { fireEvent.click(within(tabs).getByText("People")); });
    const buckets = [...document.querySelectorAll(".ops-person")].map((section) => [
      section.querySelector("h3")?.textContent, [...section.querySelectorAll(".ops-person-task strong")].map((title) => title.textContent)]);
    expect(buckets).toEqual([["TestYou", ["Put the bins out"]], ["Housemate", []], ["House", ["Return the keys"]]]);
  });
});

