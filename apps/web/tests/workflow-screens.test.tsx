import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "../src/App";
import { AppProvider, useApp, type AppState } from "../src/state";
import {
  api,
  post,
  loadCommunes,
  loadSnapshot,
  ApiError,
} from "../src/live/api";
import type { Commune, Snapshot } from "../src/live/model";
import { todayIso } from "../src/data/operations";

vi.mock("../src/live/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/live/api")>()),
  api: vi.fn(),
  post: vi.fn(),
  loadCommunes: vi.fn(),
  loadSnapshot: vi.fn(),
}));
const user = {
  id: "user-1",
  name: "Test Person",
  email: "test@example.test",
  emailVerified: true,
};
const commune: Commune = {
  id: "home-1",
  name: "Our home",
  kind: "household",
  currency: "GBP",
  role: "admin",
};
const initial: Snapshot = {
  commune,
  members: [
    { userId: user.id, name: user.name, role: "admin", active: true },
    { userId: "user-2", name: "Housemate", role: "member", active: true },
  ],
  expenses: [],
  funds: [],
  notes: [],
  operations: [],
  notifications: [],
  reminderTargets: [],
  recurringBills: [],
  splitTemplates: [],
  activityEvents: [],
};
let current: Snapshot;
let app: AppState;
function Capture() {
  app = useApp();
  return null;
}
function mount(path: string) {
  const location = memoryLocation({ path, record: true });
  render(
    <Router hook={location.hook}>
      <AppProvider>
        <Capture />
        <App />
      </AppProvider>
    </Router>,
  );
  return location;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
// jsdom does not implement the browser's native modal top layer.
const modalDescriptor = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  "showModal",
);
const closeDescriptor = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  "close",
);
const originalScroll = Element.prototype.scrollIntoView;
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function () {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function () {
      this.removeAttribute("open");
    },
  });
});
afterAll(() => {
  Element.prototype.scrollIntoView = originalScroll;
  if (modalDescriptor)
    Object.defineProperty(
      HTMLDialogElement.prototype,
      "showModal",
      modalDescriptor,
    );
  else
    delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>)
      .showModal;
  if (closeDescriptor)
    Object.defineProperty(
      HTMLDialogElement.prototype,
      "close",
      closeDescriptor,
    );
  else
    delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>)
      .close;
});
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  current = structuredClone(initial);
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === "/auth/me") return { user };
    if (path === "/reminders/usage")
      return {
        totalUsed: 0,
        totalLimit: 60,
        recipientLimit: 8,
        recipientUsage: {},
        nextSlotAt: null,
      };
    if (path.endsWith("/invites")) return { invites: [] };
    return { id: "new-id", ok: true };
  });
  vi.mocked(post).mockResolvedValue({ id: "new-id", ok: true });
  vi.mocked(loadCommunes).mockResolvedValue({ communes: [commune] });
  vi.mocked(loadSnapshot).mockImplementation(async () => current);
});
afterEach(cleanup);

describe("complete shared workflows", () => {
  it.each([0, 1, 2])("puts the personal Home greeting and %i-space count in the top bar only", async count => {
    const communes = Array.from({ length: count }, (_, index) => ({ ...commune, id: `home-${index + 1}`, name: `Home ${index + 1}` }));
    vi.mocked(loadCommunes).mockResolvedValue({ communes });
    vi.mocked(loadSnapshot).mockImplementation(async id => ({ ...current, commune: communes.find(item => item.id === id)! }));
    mount("/");
    const greeting = await screen.findByRole("heading", { name: "Your communes, Test.", level: 1 });
    const banner = screen.getByRole("banner");
    const summary = `${count} ${count === 1 ? "space" : "spaces"} · shared details that stay in sync for everyone.`;
    expect(banner.contains(greeting)).toBe(true);
    await within(banner).findByText(summary);
    expect(screen.getAllByText(summary)).toHaveLength(1);
    expect(screen.getAllByText("Your communes, Test.")).toHaveLength(1);
    expect(document.querySelector("#home .a-home-greet")).toBeNull();
    expect(document.querySelectorAll("#home .a-place")).toHaveLength(count);
    expect(document.querySelectorAll("#home .a-focus-lead")).toHaveLength(count ? 1 : 0);
    expect(within(banner).getByRole("button", { name: "Open search" })).toBeTruthy();
    expect(within(banner).getByRole("button", { name: "Notifications" })).toBeTruthy();
  });

  it.each(["/hub", "/operations", "/", "/expenses", "/recurring"])("uses the shared calendar for real dated records on %s", async path => {
    const date = todayIso();
    current.operations = [{ id: "dated-task", hubId: commune.id, kind: "task", category: "chore", title: "Kitchen reset", date, allDay: true, assignee: user.name, repeat: "none", status: "open", notes: "" }];
    current.expenses = [{ id: "dated-expense", title: "House supplies", category: "Other", amountMinor: 1000, paidByUserId: "user-2", dueOn: date, shares: [{ id: "dated-share", userId: user.id, amountMinor: 1000, settledMinor: 0 }] }];
    current.recurringBills = [{ id: "dated-bill", title: "Internet", amountMinor: 4800, paidByUserId: user.id, allocations: [{ userId: user.id, amountMinor: 4800 }], frequency: "monthly", nextDueOn: date, paused: false, createdBy: user.id }];
    mount(path);
    await waitFor(() => expect(document.querySelector(".c-calendar-date.is-today")).not.toBeNull());
    const calendar = document.querySelector(".c-calendar-date")!;
    expect(calendar.getAttribute("datetime")).toBe(date);
    expect(calendar.querySelector(".c-calendar-caption")?.textContent).toBe("Today");
    expect(calendar.querySelector(".c-calendar-weekday")).not.toBeNull();
    expect(calendar.querySelector(".c-calendar-number")).not.toBeNull();
  });
  it("opens the exact fund returned by search without entering edit mode", async () => {
    current.funds = [{ id: "fund-1", name: "Wrong fund", targetMinor: 10000, commitments: [] },
      { id: "fund-2", name: "Selected fund", targetMinor: 20000, commitments: [] }];
    mount("/funds");
    await screen.findByRole("button", { name: "Create fund" });
    act(() => app.go("funds", { hub: commune.id, record: { kind: "fund", id: "fund-2" } }));
    await screen.findByRole("dialog", { name: "Selected fund" });
    expect(app.searchTarget).toBeNull();
    expect(screen.queryByRole("dialog", { name: "Wrong fund" })).toBeNull();
  });
  it("focuses the exact member returned by search without triggering a membership action", async () => {
    mount("/members");
    await screen.findByRole("button", { name: "Make admin" });
    act(() => app.go("members", { hub: commune.id, record: { kind: "member", id: "user-2" } }));
    await waitFor(() => expect(document.activeElement?.id).toBe("search-record-member-user-2"));
    expect(app.window).toBeNull();
    expect(document.querySelector("dialog[open]")).toBeNull();
    expect(vi.mocked(api).mock.calls.some(([path]) => path.includes("/members/"))).toBe(false);
  });
  it("does not claim a search-linked note is missing while its commune is loading", async () => {
    const otherCommune = { ...commune, id: "home-2", name: "Other home" };
    const otherSnapshot = { ...structuredClone(initial), commune: otherCommune, notes: [{
      id: "exact-note", title: "Other home guide", pill: "Other", kicker: "Everyone", lede: "", body: "A real saved note", facts: [],
    }] };
    const pending = deferred<Snapshot>();
    vi.mocked(loadCommunes).mockResolvedValue({ communes: [commune, otherCommune] });
    vi.mocked(loadSnapshot).mockImplementation(async row => row.id === otherCommune.id ? pending.promise : current);
    mount("/expenses");
    await screen.findByRole("heading", { name: "No expenses yet." });
    act(() => app.go("note", { hub: otherCommune.id, note: "exact-note" }));
    expect(screen.queryByText("That note isn’t here.")).toBeNull();
    expect(screen.getByRole("status", { name: "Loading selected record" })).toBeTruthy();
    await act(async () => pending.resolve(otherSnapshot));
    await screen.findByRole("heading", { name: "Other home guide", exact: true });
    expect(app.hub.id).toBe(otherCommune.id);
    expect(app.noteKey).toBe("exact-note");
  });

  it("lets full search render even if the selected commune snapshot is pending", async () => {
    const pending = deferred<Snapshot>();
    vi.mocked(loadSnapshot).mockImplementation(() => pending.promise);
    mount("/search");
    await screen.findByRole("searchbox", { name: "Search Commune" });
    expect(screen.queryByRole("status", { name: "Loading shared records" })).toBeNull();
    await act(async () => pending.resolve(current));
  });
  it.each(["empty", "populated"])("keeps the same quiet heading icons on %s Hub cards", async (state) => {
    if (state === "populated") {
      current.expenses = [{
        id: "expense-1",
        title: "Internet",
        amountMinor: 1000,
        paidByUserId: user.id,
        dueOn: "2026-01-01",
        shares: [{ id: "share-1", userId: "user-2", amountMinor: 1000, settledMinor: 0 }],
      }];
    }
    mount("/hub");
    await screen.findByRole("heading", { name: "Shared essentials" });
    const headings = [
      within(screen.getByRole("region", { name: "Your balance" })).getByRole("heading", { level: 2 }),
      screen.getByRole("heading", { name: "Needs you" }),
      screen.getByRole("heading", { name: "This week" }),
      screen.getByRole("heading", { name: "Shared essentials" }),
    ];
    if (state === "populated") headings.push(screen.getByRole("heading", { name: "Recently in your commune" }));
    for (const heading of headings) {
      const icon = heading.querySelector(".c-hub-heading-icon");
      expect(icon).not.toBeNull();
      expect(icon?.getAttribute("width")).toBe("17");
      expect(icon?.getAttribute("height")).toBe("17");
      expect(icon?.getAttribute("stroke-width")).toBe("1.5");
      expect(icon?.getAttribute("aria-hidden")).toBe("true");
    }
    expect(within(screen.getByRole("region", { name: "Commune identity" })).getByRole("heading").querySelector("svg")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "All notes", exact: true }));
    await screen.findByRole("heading", { name: "No notes yet." });
  });

  it("uses one Notes search field in the web shell instead of duplicating it on mobile", async () => {
    mount("/notes");
    await screen.findByRole("heading", { name: "No notes yet." });
    expect(
      screen.getByRole("searchbox", { name: "Search notes in this commune" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("searchbox", { name: "Search notes on mobile" }),
    ).toBeNull();
  });

  it("returns Chase focus to the same pledge button without remounting it", async () => {
    current.funds = [
      {
        id: "fund-1",
        name: "House supplies",
        targetMinor: 10000,
        commitments: [
          {
            id: "pledge-1",
            userId: "user-2",
            amountMinor: 1000,
            contributedMinor: 0,
            dueOn: "2026-01-01",
          },
        ],
      },
    ];
    current.reminderTargets = [
      {
        kind: "chase",
        sourceId: "pledge-1",
        recipientUserId: "user-2",
        amountMinor: 1000,
        currency: "GBP",
        label: "House supplies",
        dueOn: "2026-01-01",
        lastSentAt: null,
      },
    ];
    mount("/funds");
    fireEvent.click(await screen.findByRole("button", { name: "View fund" }));
    const fund = screen.getByRole("dialog", { name: "House supplies" });
    const chase = within(fund).getByRole("button", {
      name: "Chase",
      exact: true,
    });
    chase.focus();
    fireEvent.click(chase);
    const reminder = screen.getByRole("dialog", {
      name: "A gentle reminder for Housemate",
    });
    expect(chase.isConnected).toBe(true);
    fireEvent.click(
      within(reminder).getByRole("button", { name: "Cancel", exact: true }),
    );
    expect(document.activeElement).toBe(chase);
    expect(post).not.toHaveBeenCalledWith("/reminders", expect.anything());
  });

  it("records the selected payer without forcing the recorder into the split", async () => {
    mount("/expenses");
    fireEvent.click(
      await screen.findByRole("button", { name: "Add expense", exact: true }),
    );
    const dialog = screen.getByRole("dialog", { name: "Add expense" });
    fireEvent.change(within(dialog).getByLabelText("What was it for?"), {
      target: { value: "Tickets" },
    });
    fireEvent.change(within(dialog).getByLabelText("Amount (GBP)"), {
      target: { value: "12.00" },
    });
    fireEvent.change(within(dialog).getByLabelText("Paid by"), {
      target: { value: "user-2" },
    });
    fireEvent.change(within(dialog).getByLabelText("Category"), {
      target: { value: "Travel" },
    });
    fireEvent.click(within(dialog).getByLabelText("Include Test Person"));
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save expense" }),
    );
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        "/communes/home-1/expenses",
        expect.objectContaining({
          amountMinor: 1200,
          paidByUserId: "user-2",
          category: "Travel",
          shares: [{ userId: "user-2", amountMinor: 1200 }],
        }),
      ),
    );
  });

  it("preselects a saved split from its card, with editable real allocations", async () => {
    current.splitTemplates = [
      {
        id: "template-1",
        name: "Two to one",
        method: "Shares",
        participants: [
          { userId: "user-1", value: "2" },
          { userId: "user-2", value: "1" },
        ],
        createdBy: user.id,
        archivedAt: null,
      },
    ];
    mount("/templates");
    fireEvent.click(await screen.findByRole("button", { name: "Use split" }));
    const dialog = screen.getByRole("dialog", { name: "Add expense" });
    expect(
      (
        within(dialog).getByLabelText(
          "Saved split (optional)",
        ) as HTMLSelectElement
      ).value,
    ).toBe("template-1");
    expect(
      within(dialog)
        .getByRole("button", { name: "Shares", exact: true })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.change(within(dialog).getByLabelText("What was it for?"), {
      target: { value: "Shared shop" },
    });
    fireEvent.change(within(dialog).getByLabelText("Amount (GBP)"), {
      target: { value: "9.00" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save expense" }),
    );
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        "/communes/home-1/expenses",
        expect.objectContaining({
          shares: [
            { userId: "user-1", amountMinor: 600 },
            { userId: "user-2", amountMinor: 300 },
          ],
        }),
      ),
    );
  });

  it("keeps archived templates reachable and restores through the scoped command", async () => {
    const template = {
      id: "template-1",
      name: "Old split",
      method: "Equal" as const,
      participants: [{ userId: user.id, value: "" }],
      createdBy: user.id,
      archivedAt: "2026-09-30T00:00:00Z",
    };
    current.splitTemplates = [template];
    const base = vi.mocked(api).getMockImplementation()!;
    vi.mocked(api).mockImplementation(async (path, options) => {
      if (path.endsWith("/templates")) {
        current = {
          ...current,
          splitTemplates: [{ ...template, archivedAt: null }],
        };
        return { id: template.id };
      }
      return base(path, options);
    });
    mount("/templates");
    fireEvent.click(
      await screen.findByRole("button", { name: "Archived", exact: true }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Restore", exact: true }),
    );
    await screen.findByText("Template saved.");
    expect(api).toHaveBeenCalledWith(
      "/communes/home-1/templates",
      expect.objectContaining({
        body: expect.stringContaining('"archived":false'),
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Active", exact: true }),
    );
    expect(screen.getByRole("heading", { name: "Old split" })).toBeTruthy();
  });

  it("saves an actual recurring schedule and its exact penny allocations", async () => {
    const base = vi.mocked(api).getMockImplementation()!;
    vi.mocked(api).mockImplementation(async (path, options) => {
      if (path.endsWith("/recurring")) {
        const input = JSON.parse(String(options?.body));
        current = {
          ...current,
          recurringBills: [{ ...input, id: "bill-1", createdBy: user.id }],
        };
        return { id: "bill-1" };
      }
      return base(path, options);
    });
    mount("/recurring");
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Add recurring bill",
        exact: true,
      }),
    );
    const dialog = screen.getByRole("dialog", { name: "Add recurring bill" });
    fireEvent.change(within(dialog).getByLabelText("Bill name"), {
      target: { value: "Broadband" },
    });
    fireEvent.change(within(dialog).getByLabelText("Amount (GBP)"), {
      target: { value: "10.01" },
    });
    fireEvent.change(within(dialog).getByLabelText("Next due date"), {
      target: { value: "2026-10-31" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save recurring bill" }),
    );
    await screen.findByText("Recurring bill saved.");
    expect(api).toHaveBeenCalledWith(
      "/communes/home-1/recurring",
      expect.objectContaining({
        body: JSON.stringify({
          title: "Broadband",
          amountMinor: 1001,
          paidByUserId: user.id,
          allocations: [
            { userId: "user-1", amountMinor: 501 },
            { userId: "user-2", amountMinor: 500 },
          ],
          frequency: "monthly",
          nextDueOn: "2026-10-31",
          paused: false,
        }),
      }),
    );
    expect(screen.getByRole("heading", { name: "Broadband" })).toBeTruthy();
  });

  it("confirms a recurring occurrence only after payment, and blocks repeat clicks while saving", async () => {
    current.recurringBills = [
      {
        id: "bill-1",
        title: "Broadband",
        amountMinor: 1000,
        paidByUserId: user.id,
        allocations: [{ userId: user.id, amountMinor: 1000 }],
        frequency: "monthly",
        nextDueOn: "2026-01-31",
        paused: false,
        createdBy: user.id,
      },
    ];
    const result = deferred<{ id: string }>();
    const base = vi.mocked(api).getMockImplementation()!;
    vi.mocked(api).mockImplementation(async (path, options) => {
      if (path === "/recurring/bill-1/periods") {
        const saved = await result.promise;
        current = {
          ...current,
          recurringBills: current.recurringBills!.map((bill) => ({
            ...bill,
            nextDueOn: "2026-02-28",
          })),
        };
        return saved;
      }
      return base(path, options);
    });
    mount("/recurring");
    fireEvent.click(
      await screen.findByRole("button", { name: "Record paid bill" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Record Broadband as paid?",
    });
    expect(api).not.toHaveBeenCalledWith(
      "/recurring/bill-1/periods",
      expect.anything(),
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Record £10.00 paid" }),
    );
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        "/recurring/bill-1/periods",
        expect.objectContaining({ body: '{"expectedDueOn":"2026-01-31","amountMinor":1000}' }),
      ),
    );
    expect(
      (
        within(dialog).getByRole("button", {
          name: "Recording…",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        within(dialog).getByRole("button", {
          name: "Cancel",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    await act(async () => result.resolve({ id: "expense-1" }));
    await screen.findByText("Bill recorded and next occurrence scheduled.");
    expect(app.recurringBills[0].nextDueOn).toBe("2026-02-28");
  });

  it("records one period at a different amount, previewing the scaled split", async () => {
    current.recurringBills = [{
      id: "bill-1", title: "Electricity", amountMinor: 9000, paidByUserId: user.id, frequency: "monthly", nextDueOn: "2026-01-31",
      paused: false, createdBy: user.id,
      allocations: [{ userId: user.id, amountMinor: 4500 }, { userId: "user-2", amountMinor: 4500 }],
    }];
    const base = vi.mocked(api).getMockImplementation()!;
    vi.mocked(api).mockImplementation(async (path, options) => path === "/recurring/bill-1/periods"
      ? { status: "recorded", expenseId: "expense-1", amountMinor: 10001, dueOn: "2026-01-31", nextDueOn: "2026-02-28", duplicate: false }
      : base(path, options));
    mount("/recurring");
    fireEvent.click(await screen.findByRole("button", { name: "Record paid bill" }));
    const dialog = screen.getByRole("dialog", { name: "Record Electricity as paid?" });
    fireEvent.change(within(dialog).getByLabelText(/Amount paid this time/), { target: { value: "100.01" } });
    const preview = within(dialog).getByRole("status");
    expect(preview.textContent).toContain("Test Person£50.01");
    expect(preview.textContent).toContain("Housemate£50.00");
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Record £100.01 paid" })); });
    expect(api).toHaveBeenCalledWith("/recurring/bill-1/periods",
      expect.objectContaining({ body: '{"expectedDueOn":"2026-01-31","amountMinor":10001}' }));
    expect(await screen.findByText("Bill recorded at £100.01 and next occurrence scheduled.")).toBeTruthy();
  });

  it("skips a period only with a reason, and lists recorded and skipped periods", async () => {
    current.recurringBills = [{
      id: "bill-1", title: "Electricity", amountMinor: 9000, paidByUserId: user.id, frequency: "monthly", nextDueOn: "2099-03-31",
      paused: false, createdBy: user.id, allocations: [{ userId: user.id, amountMinor: 9000 }],
      history: [
        { dueOn: "2099-02-28", status: "skipped", amountMinor: null, expenseId: null, actorId: user.id, actedAt: "2099-02-01T09:00:00Z", note: "Away" },
        { dueOn: "2099-01-31", status: "recorded", amountMinor: 10001, expenseId: "expense-1", actorId: user.id, actedAt: "2099-01-31T09:00:00Z", note: null },
      ],
    }];
    const base = vi.mocked(api).getMockImplementation()!;
    vi.mocked(api).mockImplementation(async (path, options) => path === "/recurring/bill-1/skip"
      ? { status: "skipped", expenseId: null, amountMinor: null, dueOn: "2099-03-31", nextDueOn: "2099-04-30", duplicate: false }
      : base(path, options));
    mount("/recurring");
    // Not due yet, so it cannot be recorded, but it can be skipped ahead of time.
    expect(screen.queryByRole("button", { name: "Record paid bill" })).toBeNull();
    const history = (await screen.findByText("2 recent periods")).closest("details")!;
    expect(history.textContent).toContain("28 Feb 2099 · skipped by Test Person: Away");
    expect(history.textContent).toContain("31 Jan 2099 · £100.01 recorded (usually £90.00) by Test Person");
    fireEvent.click(screen.getByRole("button", { name: "Skip this period" }));
    const dialog = screen.getByRole("dialog", { name: /Skip Electricity for/ });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Skip this period" })); });
    expect(api).not.toHaveBeenCalledWith("/recurring/bill-1/skip", expect.anything());
    fireEvent.change(within(dialog).getByLabelText("Why is it skipped?"), { target: { value: "Moving out" } });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Skip this period" })); });
    expect(api).toHaveBeenCalledWith("/recurring/bill-1/skip",
      expect.objectContaining({ body: '{"expectedDueOn":"2099-03-31","reason":"Moving out"}' }));
    expect(await screen.findByText(/Electricity skipped for .*Nothing was charged\./)).toBeTruthy();
  });

  it("keeps a failed archive in its confirmation with an actionable error", async () => {
    current.funds = [
      {
        id: "fund-1",
        name: "House supplies",
        targetMinor: 10000,
        commitments: [],
        archivedAt: null,
      },
    ];
    const base = vi.mocked(api).getMockImplementation()!;
    vi.mocked(api).mockImplementation(async (path, options) => {
      if (path === "/funds/fund-1/archive")
        throw new Error("Resolve outstanding pledges first");
      return base(path, options);
    });
    mount("/funds");
    fireEvent.click(await screen.findByRole("button", { name: "View fund" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "House supplies" })).getByRole(
        "button",
        { name: "Archive", exact: true },
      ),
    );
    const dialog = screen.getByRole("dialog", { name: "Archive this fund?" });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Archive fund" }),
    );
    await within(dialog).findByText("Resolve outstanding pledges first");
    expect(current.funds[0].archivedAt).toBeNull();
    expect(
      (
        within(dialog).getByRole("button", {
          name: "Keep active",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it("shows contribution correction history without presenting it as a refund", async () => {
    current.funds = [
      {
        id: "fund-1",
        name: "House supplies",
        targetMinor: 10000,
        commitments: [
          {
            id: "pledge-1",
            userId: "user-2",
            amountMinor: 1000,
            contributedMinor: 0,
            dueOn: "2026-01-01",
            contributions: [
              {
                id: "contribution-1",
                amountMinor: 1000,
                contributedAt: "2026-01-01T12:00:00Z",
                voidedAt: "2026-01-02T12:00:00Z",
                voidReason: "Recorded twice",
              },
            ],
          },
        ],
      },
    ];
    mount("/funds");
    fireEvent.click(await screen.findByRole("button", { name: "View fund" }));
    const dialog = screen.getByRole("dialog", { name: "House supplies" });
    fireEvent.click(
      within(dialog).getByText(/recorded · contribution history/),
    );
    expect(within(dialog).getByText(/corrected: Recorded twice/)).toBeTruthy();
    expect(
      within(dialog).queryByRole("button", { name: "Correct", exact: true }),
    ).toBeNull();
  });

  it("shows each invitation's stage and issues a new link that retires the old one", async () => {
    const day = 24 * 60 * 60 * 1000;
    const at = (offset: number) => new Date(Date.now() + offset * day).toISOString();
    const records = [
      { id: "inv-open", email: "open@example.test", role: "member", createdAt: at(-1), expiresAt: at(6), acceptedAt: null, revokedAt: null },
      { id: "inv-old", email: "late@example.test", role: "admin", createdAt: at(-9), expiresAt: at(-2), acceptedAt: null, revokedAt: null },
      { id: "inv-yes", email: "joined@example.test", role: "member", createdAt: at(-20), expiresAt: at(-13), acceptedAt: at(-19), revokedAt: null },
      { id: "inv-no", email: "gone@example.test", role: "member", createdAt: at(-20), expiresAt: at(-13), acceptedAt: null, revokedAt: at(-18) },
    ];
    const base = vi.mocked(api).getMockImplementation()!;
    vi.mocked(api).mockImplementation(async (path, options) => path.endsWith("/invites") ? { invites: records } : base(path, options));
    vi.mocked(post).mockImplementation(async (path) => path === "/communes/home-1/invites"
      ? { token: "a".repeat(64), url: "http://localhost:3000/invite?token=new" } : { ok: true });
    mount("/members");
    const open = (await screen.findByText("open@example.test")).closest(".a-member-row") as HTMLElement;
    expect(open.textContent).toContain("Pending");
    expect(within(open).getByRole("button", { name: "Revoke invitation for open@example.test" })).toBeTruthy();
    const expired = screen.getByText("late@example.test").closest(".a-member-row") as HTMLElement;
    expect(expired.textContent).toContain("Expired");
    expect(within(expired).queryByRole("button", { name: /Revoke/ })).toBeNull();
    const history = screen.getByText("2 past invitations").closest("details")!;
    expect(history.textContent).toContain("joined@example.test · member · accepted");
    expect(history.textContent).toContain("gone@example.test · member · revoked");

    fireEvent.click(within(expired).getByRole("button", { name: "New link for late@example.test" }));
    const dialog = screen.getByRole("dialog", { name: "New invitation link for late@example.test" });
    expect(dialog.textContent).toContain("This invitation has expired.");
    // Nothing is created until the admin asks for it.
    expect(vi.mocked(post).mock.calls.some(([path]) => path === "/communes/home-1/invites")).toBe(false);
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Create new link" })); });
    expect(vi.mocked(post)).toHaveBeenCalledWith("/communes/home-1/invites", { email: "late@example.test", role: "admin" });
    expect((within(dialog).getByLabelText("New invitation link") as HTMLInputElement).value).toBe("http://localhost:3000/invite?token=new");
    fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
    expect(await screen.findByText("New link ready for late@example.test. The earlier link no longer works.")).toBeTruthy();
  });

  it("requires confirmation for role changes and keeps the last admin protected", async () => {
    mount("/members");
    const promote = await screen.findByRole("button", { name: "Make admin" });
    expect(
      (screen.getByRole("button", { name: "Make member" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(promote);
    const dialog = screen.getByRole("dialog", {
      name: "Make Housemate an admin?",
    });
    expect(post).not.toHaveBeenCalled();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Confirm change" }),
    );
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/communes/home-1/members/user-2", {
        action: "admin",
      }),
    );
  });

  it("does not overwrite a post-write refresh with an older background read", async () => {
    const expense = {
      id: "expense-1",
      title: "Internet",
      amountMinor: 1000,
      paidByUserId: user.id,
      dueOn: "2026-01-01",
      shares: [
        { id: "share-1", userId: "user-2", amountMinor: 1000, settledMinor: 0 },
      ],
    };
    current.expenses = [expense];
    mount("/expenses");
    await screen.findByText("Internet");
    const older = deferred<Snapshot>();
    vi.mocked(loadSnapshot)
      .mockImplementationOnce(() => older.promise)
      .mockImplementation(async () => current);
    let refresh!: Promise<void>;
    act(() => {
      refresh = app.refresh();
    });
    await waitFor(() => expect(loadSnapshot).toHaveBeenCalledTimes(2));
    current = {
      ...current,
      expenses: [
        { ...expense, shares: [{ ...expense.shares[0], settledMinor: 1000 }] },
      ],
    };
    await act(async () => app.confirmExpenseShare("share-1"));
    expect(app.expenses[0].open).toBe(false);
    await act(async () => {
      older.resolve({ ...current, expenses: [expense] });
      await refresh;
    });
    expect(app.expenses[0].open).toBe(false);
  });

  it("does not retry a committed write when only its following read fails", async () => {
    mount("/templates");
    await screen.findByRole("button", { name: "Save template" });
    vi.mocked(loadSnapshot).mockRejectedValue(
      new Error("Connection interrupted"),
    );
    await act(async () =>
      app.saveSplitTemplate({
        name: "Equal",
        method: "Equal",
        participants: [{ userId: user.id, value: "" }],
      }),
    );
    expect(app.splitTemplates).toEqual([]);
    expect(app.contentError).toBe("Connection interrupted");
    expect(screen.getByText(/Showing its last loaded activity/)).toBeTruthy();
    expect(
      vi.mocked(api).mock.calls.filter(([path]) => path.endsWith("/templates")),
    ).toHaveLength(1);
  });

  it("clears private cached records if access is rejected after a write", async () => {
    current.notes = [
      {
        id: "note-1",
        title: "Private household details",
        pill: "Other",
        kicker: "Everyone",
        lede: "",
        body: "Shared privately",
        facts: [],
      },
    ];
    mount("/templates");
    await screen.findByRole("button", { name: "Save template" });
    vi.mocked(loadSnapshot).mockRejectedValue(
      new ApiError("Not a commune member", 403),
    );
    await act(async () =>
      app.saveSplitTemplate({
        name: "Equal",
        method: "Equal",
        participants: [{ userId: user.id, value: "" }],
      }),
    );
    expect(app.snapshots[commune.id]).toBeUndefined();
    expect(app.notes).toEqual({});
    expect(
      screen.getByRole("heading", { name: "Could not load Our home" }),
    ).toBeTruthy();
  });
});
