import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "../src/App";
import { AppProvider, useApp, type AppState } from "../src/state";
import { api, post, loadCommunes, loadSnapshot, ApiError } from "../src/live/api";
import type { Commune, Snapshot } from "../src/live/model";
import { addDays, holdsTurn, nextPerson, todayIso, type OperationItem } from "../src/data/operations";
import { UNCERTAIN_RETRY_SAFE } from "../src/data/commands";

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
  assignee: user.name, rotation: [user.name, "Housemate Two"], repeat: "weekly", status: "open", notes: "", undoOccurrenceId: null, history: [], version: 1,
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
    const trigger = await screen.findByRole("button", { name: /^Done · Housemate \(/ });
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
    const trigger = await screen.findByRole("button", { name: /^Done · Housemate \(/ });
    await act(async () => { fireEvent.click(trigger); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Undo" })); });
    expect(vi.mocked(post).mock.calls.map(([path]) => path)).toEqual(["/operations/task-1/occurrences", "/occurrences/occurrence-1/undo"]);
    expect(screen.getByRole("status").textContent).toContain("Undone · back with Test");
    expect(app.operations[0]).toMatchObject({ date: rota.date, assignee: user.name, undoOccurrenceId: null });
    expect(await screen.findByRole("button", { name: /^Done · Housemate \(/ })).toBeTruthy();
  });

  it("shows the other person's result when a completion arrives too late", async () => {
    vi.mocked(post).mockImplementation(async () => {
      serverCompletes();
      throw new ApiError("This task has already moved on. Refresh to see who has it now.", 409);
    });
    mount("/operations");
    const trigger = await screen.findByRole("button", { name: /^Done · Housemate \(/ });
    await act(async () => { fireEvent.click(trigger); });
    expect(screen.getByRole("status").textContent).toBe("This task has already moved on. Refresh to see who has it now.");
    expect(screen.getByRole("alert").textContent).toContain("This task has already moved on.");
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    // The stale late card is replaced by what was actually saved.
    expect(app.operations[0]).toMatchObject({ assignee: "Housemate Two", date: addDays(today, 5) });
    expect(screen.queryByRole("button", { name: /^Done · Housemate \(/ })).toBeNull();
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
    const trigger = await screen.findByRole("button", { name: /^Skip a week for / });
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
    expect(body).toMatchObject({ assigneeId: user.id, rotationIds: [user.id, "user-2"], expectedVersion: 1 });
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


describe("handing over a turn and skip reasons", () => {
  async function openTask() {
    mount("/operations");
    await screen.findByRole("tablist", { name: "Operations view" });
    act(() => app.go("operation", { operation: "task-1" }));
    return screen.findByRole("dialog", { name: "Put the bins out" });
  }

  it("moves the rotation on from whose turn it is, not from the person covering", () => {
    const item = { rotation: ["Avery", "Blake", "Casey"], rotationIds: ["a", "b", "c"], assignee: "Dana", assigneeId: "d", turnOwnerId: "a" };
    expect(nextPerson(item)).toBe("Blake");
    expect([0, 1, 2].map((index) => holdsTurn(item, index))).toEqual([true, false, false]);
  });

  it("hands the turn to another member as a command, with an optional reason", async () => {
    vi.mocked(post).mockImplementation(async () => {
      current.operations = [{ ...rota, assignee: "Housemate Two", assigneeId: "user-2", turnOwnerId: user.id, turnOwner: user.name, undoOccurrenceId: "occurrence-3",
        history: [{ id: "occurrence-3", action: "handed_over", dueOn: rota.date, assignee: user.name, actorId: user.id, actedOn: today,
          actedAt: new Date().toISOString(), nextDate: rota.date, nextAssignee: "Housemate Two", reason: "Away this weekend", undoneAt: null, undoneBy: null }] }];
      return { id: "occurrence-3", duplicate: false, date: rota.date, assignee: "Housemate Two", assigneeId: "user-2", turnOwnerId: user.id, status: "open" };
    });
    current.operations = [{ ...rota, assigneeId: user.id, rotationIds: [user.id, "user-2"] }];
    const windowFrame = await openTask();
    await act(async () => { fireEvent.click(within(windowFrame).getByRole("button", { name: "Hand over" })); });
    const panel = windowFrame.querySelector<HTMLElement>(".operation-panel")!;
    const confirm = within(panel).getByRole("button", { name: "Hand over" }) as HTMLButtonElement;
    // Nobody is chosen yet, and the person who has it is not offered.
    expect(confirm.disabled).toBe(true);
    const choices = [...(within(windowFrame).getByLabelText("Hand to") as HTMLSelectElement).options].map((option) => option.value);
    expect(choices).toEqual(["", "user-2"]);
    fireEvent.change(within(windowFrame).getByLabelText("Hand to"), { target: { value: "user-2" } });
    fireEvent.change(within(windowFrame).getByLabelText("Reason (optional)"), { target: { value: "  Away this weekend " } });
    await act(async () => { fireEvent.click(confirm); });
    const [path, body] = vi.mocked(post).mock.calls[0];
    expect(path).toBe("/operations/task-1/handovers");
    expect(body).toMatchObject({ toMemberId: "user-2", expectedDate: rota.date, expectedAssigneeId: user.id, today, reason: "Away this weekend" });
    expect((body as { requestId: string }).requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(within(windowFrame).getByRole("status").textContent).toBe("Handed to Housemate. You can undo this in History.");
    expect(within(windowFrame).getByText(/covering for Test/)).toBeTruthy();
    const line = within(windowFrame).getByText("Handed over").closest("div")?.textContent ?? "";
    expect(line).toContain("to Housemate");
    expect(line).toContain("“Away this weekend”");
  });

  it("asks for an optional reason before skipping from the task window", async () => {
    vi.mocked(post).mockResolvedValue({ id: "occurrence-4", duplicate: false, date: addDays(today, 7), assignee: user.name, status: "open" });
    const windowFrame = await openTask();
    await act(async () => { fireEvent.click(within(windowFrame).getByRole("button", { name: "Skip a week" })); });
    expect(vi.mocked(post)).not.toHaveBeenCalled();
    fireEvent.change(within(windowFrame).getByLabelText("Reason (optional)"), { target: { value: "Bins not collected" } });
    const panel = windowFrame.querySelector<HTMLElement>(".operation-panel")!;
    await act(async () => { fireEvent.click(within(panel).getByRole("button", { name: "Skip a week" })); });
    expect(vi.mocked(post).mock.calls[0][1]).toMatchObject({ action: "skipped", expectedDate: rota.date, reason: "Bins not collected" });
  });

  it("keeps a cover out of the rotation when the task is edited", async () => {
    current.members.push({ userId: "user-3", name: "Guest Three", role: "member", active: true });
    current.operations = [{ ...rota, assignee: "Guest Three", assigneeId: "user-3", rotation: [user.name, "Housemate Two"],
      rotationIds: [user.id, "user-2"], turnOwnerId: user.id, turnOwner: user.name }];
    mount("/operations");
    await screen.findByRole("tablist", { name: "Operations view" });
    act(() => app.go("operation-edit", { operation: "task-1" }));
    const form = await screen.findByRole("group", { name: "Takes turns" });
    expect(within(form).getByText("Their turn now, covered")).toBeTruthy();
    expect((within(form).getByRole("checkbox", { name: /Guest Three/ }) as HTMLInputElement).checked).toBe(false);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save changes" })); });
    const put = vi.mocked(api).mock.calls.find(([path, init]) => path === "/operations/task-1" && init?.method === "PUT");
    expect(JSON.parse(String(put![1]!.body))).toMatchObject({ assigneeId: "user-3", rotationIds: [user.id, "user-2"] });
  });
});

describe("late tasks in the week", () => {
  const lateTask = (id: string, title: string, days: number, extra: Partial<OperationItem> = {}): OperationItem => ({
    ...rota, id, title, date: addDays(today, -days), repeat: "none", rotation: undefined, rotationIds: null, ...extra });
  const lateCards = () => [...document.querySelectorAll<HTMLElement>(".ops-late")];

  it("lists every late task, yours first and then the oldest, and counts yours under Yours", async () => {
    current.operations = [
      lateTask("task-a", "Water the plants", 5, { assignee: "Housemate Two", assigneeId: "user-2" }),
      lateTask("task-b", "Put the bins out", 1, { assignee: user.name, assigneeId: user.id }),
      lateTask("task-c", "Clear the gutters", 3, { assignee: undefined, assigneeId: null }),
      { ...rota, id: "task-d", title: "Hoover the stairs", date: addDays(today, 2), repeat: "none", rotation: undefined, assignee: "Housemate Two", assigneeId: "user-2" },
    ];
    mount("/operations");
    await screen.findByRole("tablist", { name: "Operations view" });
    expect(lateCards().map((card) => card.querySelector("h2")?.textContent)).toEqual(["Put the bins out", "Water the plants", "Clear the gutters"]);
    expect(lateCards().map((card) => card.querySelector(".ops-kicker")?.textContent)).toEqual(["1 day late · Test", "5 days late · Housemate", "3 days late · Unassigned"]);
    expect(lateCards().map((card) => [...card.querySelectorAll(".ops-note")].at(-1)?.textContent))
      .toEqual(["Test still has this.", "Housemate still has this.", "Nobody has this yet."]);
    // A one-off task cannot be skipped, so its card does not offer it.
    expect(lateCards().every((card) => !within(card).queryByRole("button", { name: /^Skip a week/ }))).toBe(true);
    // Yours never says you are clear while one of yours is late.
    const yours = document.querySelector<HTMLElement>(".ops-yours")!;
    expect(yours.textContent).not.toContain("You’re clear today.");
    expect(within(yours).getByText("1 day late · All day · Test")).toBeTruthy();
    // The week list carries on from today without repeating them.
    expect([...document.querySelectorAll(".ops-week-row strong")].map((title) => title.textContent)).toEqual(["Hoover the stairs"]);
  });

  it("says you are clear today when only other people's tasks are late", async () => {
    current.operations = [lateTask("task-a", "Water the plants", 2, { assignee: "Housemate Two", assigneeId: "user-2" })];
    mount("/operations");
    await screen.findByRole("tablist", { name: "Operations view" });
    expect(lateCards()).toHaveLength(1);
    expect(document.querySelector(".ops-yours")?.textContent).toContain("You’re clear today.");
  });

  it("holds every late card's actions while a change is saving", async () => {
    current.operations = [
      lateTask("task-a", "Water the plants", 5, { assignee: "Housemate Two", assigneeId: "user-2", repeat: "weekly" }),
      lateTask("task-b", "Put the bins out", 1, { assignee: user.name, assigneeId: user.id, repeat: "weekly" }),
    ];
    let finish!: (value: unknown) => void;
    vi.mocked(post).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    mount("/operations");
    await screen.findByRole("tablist", { name: "Operations view" });
    const [first, second] = lateCards();
    await act(async () => { fireEvent.click(within(first).getByRole("button", { name: /^Mark done \(/ })); });
    // Each card's actions name its task after the visible words.
    const button = (card: HTMLElement, name: string) => within(card).getByRole("button", { name: new RegExp(`^${name}\\b`) }) as HTMLButtonElement;
    for (const card of [first, second]) {
      expect([button(card, "Mark done").disabled, button(card, "Skip a week").disabled, button(card, "Open").disabled]).toEqual([true, true, false]);
    }
    fireEvent.click(button(second, "Mark done"));
    expect(post).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ id: "occurrence-1", duplicate: false, date: today, assignee: user.name, status: "done" }); });
    expect(button(second, "Mark done").disabled).toBe(false);
  });

  it("says how late a task is in the People view", async () => {
    mount("/operations");
    const tabs = await screen.findByRole("tablist", { name: "Operations view" });
    await act(async () => { fireEvent.click(within(tabs).getByText("People")); });
    expect([...document.querySelectorAll(".ops-person-task small")].map((line) => line.textContent)).toEqual(["2 days late · then Housemate"]);
  });
});

describe("adding, editing and removing tasks as commands", () => {
  async function openEdit() {
    mount("/operations");
    await screen.findByRole("tablist", { name: "Operations view" });
    act(() => app.go("operation-edit", { operation: "task-1" }));
    return screen.findByRole("dialog", { name: "Put the bins out" });
  }

  it("adds with one request id per form, so a retry after an unconfirmed save is the same add", async () => {
    vi.mocked(post).mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce({ id: "task-9", version: 1, duplicate: true });
    mount("/operations");
    await screen.findByRole("tablist", { name: "Operations view" });
    act(() => app.go("operation-new"));
    const dialog = await screen.findByRole("dialog", { name: "Add to calendar" });
    fireEvent.change(within(dialog).getByLabelText(/^Title/), { target: { value: "Descale the kettle" } });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Add to calendar" })); });
    expect(within(dialog).getByRole("alert").textContent).toBe(UNCERTAIN_RETRY_SAFE);
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Add to calendar" })); });
    const bodies = vi.mocked(post).mock.calls.map(([, body]) => body as Record<string, unknown>);
    expect(bodies).toHaveLength(2);
    expect(bodies[0].requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(bodies[1].requestId).toBe(bodies[0].requestId);
    // Status and completion are never part of an add.
    expect(bodies[0]).not.toHaveProperty("status");
    expect(bodies[0]).not.toHaveProperty("lastDone");
  });

  it("refuses a stale edit after someone marks the task done, and starts again from the latest", async () => {
    current.operations = [{ ...rota, assigneeId: user.id, rotationIds: [user.id, "user-2"], version: 3 }];
    const puts: Array<Record<string, unknown>> = [];
    vi.mocked(api).mockImplementation(async (path, init) => {
      if (path === "/auth/me") return { user };
      if (path === "/reminders/usage") return { totalUsed: 0, totalLimit: 60, recipientLimit: 8, recipientUsage: {}, nextSlotAt: null };
      if (path.endsWith("/invites")) return { invites: [] };
      if (path === "/operations/task-1" && init?.method === "PUT") {
        const body = JSON.parse(String(init.body));
        puts.push(body);
        if (body.expectedVersion !== current.operations![0].version) {
          throw new ApiError("This task was changed by someone else. Review the latest version before saving your changes.", 409);
        }
        return { id: "task-1", version: body.expectedVersion + 1, duplicate: false };
      }
      return { ok: true };
    });
    const dialog = await openEdit();
    fireEvent.change(within(dialog).getByLabelText(/^Title/), { target: { value: "Put the bins and recycling out" } });
    // Housemate Two marks it done while this is open: a new date, person and version.
    current.operations = [{ ...current.operations![0], date: addDays(today, 5), assignee: "Housemate Two", assigneeId: "user-2", version: 4 }];
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" })); });
    expect(puts[0]).toMatchObject({ expectedVersion: 3, title: "Put the bins and recycling out", assigneeId: user.id });
    expect(puts[0]).not.toHaveProperty("status");
    expect(puts[0]).not.toHaveProperty("lastDone");
    expect(within(dialog).getByRole("alert").textContent).toContain("This task changed while you were editing, and nothing here has been saved.");
    expect((within(dialog).getByRole("button", { name: "Save changes" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Load the latest details" })); });
    expect((within(dialog).getByLabelText(/^Title/) as HTMLInputElement).value).toBe("Put the bins out");
    expect((within(dialog).getByLabelText("Assigned to") as HTMLSelectElement).value).toBe("user-2");
    fireEvent.change(within(dialog).getByLabelText(/^Title/), { target: { value: "Put the bins and recycling out" } });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" })); });
    expect(puts).toHaveLength(2);
    expect(puts[1]).toMatchObject({ expectedVersion: 4, title: "Put the bins and recycling out", assigneeId: "user-2", date: addDays(today, 5) });
  });

  it("knows its own save when the reply was lost, and builds the next save on it", async () => {
    current.operations = [{ ...rota, assigneeId: user.id, rotationIds: [user.id, "user-2"], version: 3 }];
    const puts: Array<Record<string, unknown>> = [];
    vi.mocked(api).mockImplementation(async (path, init) => {
      if (path === "/auth/me") return { user };
      if (path === "/reminders/usage") return { totalUsed: 0, totalLimit: 60, recipientLimit: 8, recipientUsage: {}, nextSlotAt: null };
      if (path.endsWith("/invites")) return { invites: [] };
      if (path === "/operations/task-1" && init?.method === "PUT") {
        const body = JSON.parse(String(init.body));
        puts.push(body);
        const saved = current.operations![0];
        if (body.expectedVersion !== saved.version) {
          throw new ApiError("This task was changed by someone else. Review the latest version before saving your changes.", 409);
        }
        // A new snapshot object, so the page sees it only when it next loads.
        current = { ...current, operations: [{ ...saved, title: body.title, notes: body.notes, version: saved.version! + 1 }] };
        // The first save goes through, but its reply never arrives.
        if (puts.length === 1) throw new TypeError("Failed to fetch");
        return { id: "task-1", version: saved.version! + 1, duplicate: false };
      }
      return { ok: true };
    });
    const dialog = await openEdit();
    fireEvent.change(within(dialog).getByLabelText(/^Title/), { target: { value: "Put the bins and recycling out" } });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" })); });
    expect(within(dialog).getByRole("alert").textContent).toBe(UNCERTAIN_RETRY_SAFE);
    // A refresh brings in version 4, which is exactly what this form sent:
    // this person's own change, not someone else's.
    await act(async () => { await app.refresh(); });
    expect(within(dialog).queryByText(/changed while you were editing/)).toBeNull();
    expect(within(dialog).getByRole("status").textContent).toBe("Your last save went through.");
    const save = within(dialog).getByRole("button", { name: "Save changes" }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    fireEvent.change(within(dialog).getByLabelText("Details"), { target: { value: "Green bin too" } });
    await act(async () => { fireEvent.click(save); });
    expect(puts.map((body) => body.expectedVersion)).toEqual([3, 4]);
    expect(current.operations![0]).toMatchObject({ title: "Put the bins and recycling out", notes: "Green bin too", version: 5 });
  });

  it("notices a change that arrives while the edit is open, before anything is saved", async () => {
    const dialog = await openEdit();
    current.operations = [{ ...rota, date: addDays(today, 5), assignee: "Housemate Two", version: 2 }];
    await act(async () => { await app.refresh(); });
    expect(within(dialog).getByRole("alert").textContent).toContain("This task changed while you were editing");
    expect((within(dialog).getByRole("button", { name: "Save changes" }) as HTMLButtonElement).disabled).toBe(true);
    expect(vi.mocked(api).mock.calls.some(([path, init]) => path === "/operations/task-1" && init?.method === "PUT")).toBe(false);
  });

  it("offers Remove only to the person who added it or an admin", async () => {
    const member: Commune = { ...commune, role: "member" };
    vi.mocked(loadCommunes).mockResolvedValue({ communes: [member] });
    current.commune = member;
    current.operations = [{ ...rota, createdBy: "user-2" }, { ...rota, id: "task-2", title: "Return the keys", createdBy: user.id }];
    mount("/operations");
    await screen.findByRole("tablist", { name: "Operations view" });
    act(() => app.go("operation", { operation: "task-1" }));
    expect(within(await screen.findByRole("dialog", { name: "Put the bins out" })).queryByRole("button", { name: "Remove" })).toBeNull();
    act(() => app.go("operation", { operation: "task-2" }));
    const own = await screen.findByRole("dialog", { name: "Return the keys" });
    await act(async () => { fireEvent.click(within(own).getByRole("button", { name: "Remove" })); });
    await act(async () => { fireEvent.click(within(own).getByRole("button", { name: "Remove" })); });
    expect(vi.mocked(api)).toHaveBeenCalledWith("/operations/task-2", { method: "DELETE" });
  });
});
