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
import { dateLabel, type Commune, type RecurringBill, type Snapshot } from "../src/live/model";
import { addDays, todayIso } from "../src/data/operations";
import { formatReminderDay } from "../src/data/reminders";
import { UNCERTAIN_RETRY_SAFE } from "../src/data/commands";

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
    expect(within(banner).getByRole("button", { name: "Search Commune" })).toBeTruthy();
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
    await screen.findByRole("button", { name: "Make admin Housemate" });
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
    fireEvent.click(await screen.findByRole("button", { name: "View fund House supplies" }));
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
    fireEvent.click(await screen.findByRole("button", { name: "Use split Two to one" }));
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
      screen.getByRole("button", { name: "Restore Old split", exact: true }),
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

  it("filters templates with the same side-by-side chips as Funds, marking the selected one", async () => {
    // Each screen's filters: the chips, the one marked as selected, and any other control among them.
    const filters = () => {
      const group = document.querySelector(".a-toolbar .a-filters")!;
      return {
        chips: [...group.querySelectorAll(".a-chip")].map((chip) => chip.textContent),
        on: [...group.querySelectorAll(".a-chip.is-on[aria-pressed=true]")].map((chip) => chip.textContent),
        others: group.querySelectorAll(":scope > :not(.a-chip)").length,
      };
    };
    mount("/funds");
    await screen.findByRole("button", { name: "Archived", exact: true });
    const funds = filters();
    expect(funds).toEqual({ chips: ["Active", "Archived"], on: ["Active"], others: 0 });
    await act(async () => app.go("templates"));
    await screen.findByRole("button", { name: "Save template" });
    expect(filters()).toEqual(funds);
    fireEvent.click(screen.getByRole("button", { name: "Archived", exact: true }));
    expect(filters()).toEqual({ chips: ["Active", "Archived"], on: ["Archived"], others: 0 });
    expect(screen.getByRole("button", { name: "Active", exact: true }).getAttribute("aria-pressed")).toBe("false");
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
    const call = vi.mocked(api).mock.calls.find(([path]) => path === "/communes/home-1/recurring")!;
    const { requestId, ...sent } = JSON.parse(String(call[1]?.body));
    expect(sent).toEqual({
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
    });
    // An add carries a request id, so a retry cannot add the bill twice.
    expect(requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
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
      await screen.findByRole("button", { name: "Record paid bill for Broadband" }),
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
    fireEvent.click(await screen.findByRole("button", { name: "Record paid bill for Electricity" }));
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
    const nextDueOn = addDays(todayIso(), 10);
    current.recurringBills = [{
      id: "bill-1", title: "Electricity", amountMinor: 9000, paidByUserId: user.id, frequency: "monthly", nextDueOn,
      paused: false, createdBy: user.id, version: 3, allocations: [{ userId: user.id, amountMinor: 9000 }],
      history: [
        { dueOn: "2026-02-28", status: "skipped", amountMinor: null, expenseId: null, actorId: user.id, actedAt: "2026-02-01T09:00:00Z", note: "Away" },
        { dueOn: "2026-01-31", status: "recorded", amountMinor: 10001, expenseId: "expense-1", actorId: user.id, actedAt: "2026-01-31T09:00:00Z", note: null },
      ],
    }];
    const base = vi.mocked(api).getMockImplementation()!;
    vi.mocked(api).mockImplementation(async (path, options) => path === "/recurring/bill-1/skip"
      ? { status: "skipped", expenseId: null, amountMinor: null, dueOn: nextDueOn, nextDueOn: addDays(nextDueOn, 30), duplicate: false }
      : base(path, options));
    mount("/recurring");
    // Not due yet, so it cannot be recorded, but it can be skipped ahead of time.
    expect(screen.queryByRole("button", { name: /^Record paid bill/ })).toBeNull();
    const history = (await screen.findByText("2 recent periods")).closest("details")!;
    expect(history.textContent).toContain("28 Feb 2026 · skipped by Test Person: Away");
    expect(history.textContent).toContain("31 Jan 2026 · £100.01 recorded (usually £90.00) by Test Person");
    fireEvent.click(screen.getByRole("button", { name: "Skip this period for Electricity" }));
    const dialog = screen.getByRole("dialog", { name: /Skip Electricity for/ });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Skip this period" })); });
    expect(api).not.toHaveBeenCalledWith("/recurring/bill-1/skip", expect.anything());
    fireEvent.change(within(dialog).getByLabelText("Why is it skipped?"), { target: { value: "Moving out" } });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Skip this period" })); });
    expect(api).toHaveBeenCalledWith("/recurring/bill-1/skip",
      expect.objectContaining({ body: JSON.stringify({ expectedDueOn: nextDueOn, reason: "Moving out" }) }));
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
    fireEvent.click(await screen.findByRole("button", { name: "View fund House supplies" }));
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
    fireEvent.click(await screen.findByRole("button", { name: "View fund House supplies" }));
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
    const promote = await screen.findByRole("button", { name: "Make admin Housemate" });
    expect(
      (screen.getByRole("button", { name: "Make member Test Person" }) as HTMLButtonElement)
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

describe("recurring bill commands", () => {
  const recurring = (id: string, title: string, overrides: Partial<RecurringBill> = {}): RecurringBill => ({
    id, title, amountMinor: 1000, paidByUserId: user.id, createdBy: user.id, version: 1, archivedAt: null,
    allocations: [{ userId: user.id, amountMinor: 500 }, { userId: "user-2", amountMinor: 500 }],
    frequency: "monthly", nextDueOn: todayIso(), paused: false, ...overrides,
  });
  // The visible words of each action; each also names its bill for screen readers.
  const buttons = async (title: string) =>
    within(await screen.findByRole("region", { name: title })).queryAllByRole("button").map((button) =>
      [...button.childNodes].filter((node) => !(node instanceof Element && node.classList.contains("c-visually-hidden")))
        .map((node) => node.textContent).join("").trim());
  const asMember = () => {
    vi.mocked(loadCommunes).mockResolvedValue({ communes: [{ ...commune, role: "member" }] });
    current.commune = { ...commune, role: "member" };
    current.members = [
      { userId: user.id, name: user.name, role: "member", active: true },
      { userId: "user-2", name: "Housemate", role: "admin", active: true },
      { userId: "user-3", name: "Sam Lee", role: "member", active: false },
    ];
  };
  const saves = () => vi.mocked(api).mock.calls.filter(([path]) => path === "/communes/home-1/recurring")
    .map(([, options]) => JSON.parse(String(options?.body)));

  it("shows each action only to the people its command allows", async () => {
    asMember();
    current.recurringBills = [
      recurring("bill-1", "Mine"),
      recurring("bill-2", "Added by me", { paidByUserId: "user-2" }),
      recurring("bill-3", "Paid by me", { createdBy: "user-2" }),
      recurring("bill-4", "Someone else's", { createdBy: "user-2", paidByUserId: "user-2" }),
    ];
    mount("/recurring");
    expect(await buttons("Mine")).toEqual(["Record paid bill", "Skip this period", "Edit", "Pause"]);
    expect(await buttons("Added by me")).toEqual(["Pause"]);
    expect(await buttons("Paid by me")).toEqual(["Record paid bill", "Skip this period", "Pause"]);
    expect(await buttons("Someone else's")).toEqual([]);
  });

  it("pauses, archives and restores through their own commands, never by saving the bill", async () => {
    current.recurringBills = [recurring("bill-1", "Broadband", { nextDueOn: addDays(todayIso(), 5) })];
    const base = vi.mocked(api).getMockImplementation()!;
    vi.mocked(api).mockImplementation(async (path, options) => {
      const body = options?.body ? JSON.parse(String(options.body)) : {};
      const [bill] = current.recurringBills!;
      if (path === "/recurring/bill-1/pause") {
        current = { ...current, recurringBills: [{ ...bill, paused: body.paused, version: bill.version + 1 }] };
        return { id: bill.id, paused: body.paused, archivedAt: null, version: bill.version + 1, duplicate: false };
      }
      if (path === "/recurring/bill-1/archive") {
        const archivedAt = body.archived ? "2026-10-09T10:00:00Z" : null;
        current = { ...current, recurringBills: [{ ...bill, archivedAt, paused: true, version: bill.version + 1 }] };
        return { id: bill.id, paused: true, archivedAt, version: bill.version + 1, duplicate: false };
      }
      return base(path, options);
    });
    mount("/recurring");
    fireEvent.click(await screen.findByRole("button", { name: "Pause Broadband" }));
    expect(await screen.findByText("Schedule paused.")).toBeTruthy();
    expect(api).toHaveBeenCalledWith("/recurring/bill-1/pause", expect.objectContaining({ body: '{"paused":true}' }));
    fireEvent.click(screen.getByRole("button", { name: "Archive Broadband" }));
    expect(await screen.findByText("Bill archived and paused. Find it in Archived to restore it.")).toBeTruthy();
    expect(api).toHaveBeenCalledWith("/recurring/bill-1/archive", expect.objectContaining({ body: '{"archived":true}' }));
    // It leaves the active list, and the Archived filter appears with it.
    expect(screen.queryByRole("region", { name: "Broadband" })).toBeNull();
    expect(screen.getByText("No active recurring bills.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Archived" }));
    expect(await buttons("Broadband")).toEqual(["Restore"]);
    fireEvent.click(screen.getByRole("button", { name: "Restore Broadband" }));
    expect(await screen.findByText("Bill restored. It stays paused until someone resumes it.")).toBeTruthy();
    expect(api).toHaveBeenCalledWith("/recurring/bill-1/archive", expect.objectContaining({ body: '{"archived":false}' }));
    expect(await buttons("Broadband")).toEqual(["Edit", "Resume", "Archive"]);
    expect(saves()).toEqual([]);
  });

  it("resumes a bill whose payer and split include someone who left by opening the editor", async () => {
    current.members = [...initial.members, { userId: "user-3", name: "Sam Lee", role: "member", active: false }];
    const nextDueOn = addDays(todayIso(), 5);
    current.recurringBills = [recurring("bill-1", "Cleaner", {
      paused: true, version: 4, paidByUserId: "user-3", nextDueOn,
      allocations: [{ userId: user.id, amountMinor: 500 }, { userId: "user-3", amountMinor: 500 }],
    })];
    const base = vi.mocked(api).getMockImplementation()!;
    vi.mocked(api).mockImplementation(async (path, options) => {
      if (path === "/communes/home-1/recurring") return { id: "bill-1" };
      if (path === "/recurring/bill-1/pause") return { id: "bill-1", paused: false, archivedAt: null, version: 6, duplicate: false };
      return base(path, options);
    });
    mount("/recurring");
    fireEvent.click(await screen.findByRole("button", { name: "Resume Cleaner" }));
    expect(api).not.toHaveBeenCalledWith("/recurring/bill-1/pause", expect.anything());
    const dialog = screen.getByRole("dialog", { name: "Edit recurring bill" });
    expect(within(dialog).getByText("Sam Lee has left, so they were taken out of this split. Check the amounts before saving.")).toBeTruthy();
    expect(within(dialog).getByText("Sam Lee paid this bill and has left. Choose who pays it now.")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Save and resume" }));
    expect(await within(dialog).findByText("Choose who pays this bill.")).toBeTruthy();
    expect(saves()).toEqual([]);
    fireEvent.change(within(dialog).getByLabelText("Paid by"), { target: { value: user.id } });
    fireEvent.change(within(dialog).getByLabelText("Amount (GBP)"), { target: { value: "5.00" } });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save and resume" })); });
    expect(await screen.findByText("Bill saved and resumed.")).toBeTruthy();
    expect(saves()).toEqual([{
      title: "Cleaner", amountMinor: 500, paidByUserId: user.id, allocations: [{ userId: user.id, amountMinor: 500 }],
      frequency: "monthly", nextDueOn, id: "bill-1", expectedVersion: 4,
    }]);
    expect(api).toHaveBeenCalledWith("/recurring/bill-1/pause", expect.objectContaining({ body: '{"paused":false}' }));
  });

  it("tells someone who cannot edit a bill why it cannot resume yet", async () => {
    asMember();
    current.recurringBills = [recurring("bill-1", "Cleaner", {
      paused: true, createdBy: "user-2", allocations: [{ userId: user.id, amountMinor: 500 }, { userId: "user-3", amountMinor: 500 }],
    })];
    mount("/recurring");
    expect(await buttons("Cleaner")).toEqual(["Archive"]);
    expect(screen.getByText("Sam Lee has left the commune, so an admin needs to update this bill before it can resume.")).toBeTruthy();
  });

  it("says plainly when the period was already recorded, and refreshes", async () => {
    current.recurringBills = [recurring("bill-1", "Broadband")];
    const base = vi.mocked(api).getMockImplementation()!;
    vi.mocked(api).mockImplementation(async (path, options) => path === "/recurring/bill-1/periods"
      ? { status: "recorded", expenseId: "expense-1", amountMinor: 1000, dueOn: todayIso(), nextDueOn: addDays(todayIso(), 30), duplicate: true }
      : base(path, options));
    mount("/recurring");
    fireEvent.click(await screen.findByRole("button", { name: "Record paid bill for Broadband" }));
    const loads = vi.mocked(loadSnapshot).mock.calls.length;
    const dialog = screen.getByRole("dialog", { name: "Record Broadband as paid?" });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Record £10.00 paid" })); });
    expect(await screen.findByText(`Broadband for ${dateLabel(todayIso())} was already recorded, so nothing new was added.`)).toBeTruthy();
    expect(vi.mocked(loadSnapshot).mock.calls.length).toBeGreaterThan(loads);
  });

  it("shows the newer version when an edit was based on an old one, then saves the person's edits on top of it", async () => {
    const due = addDays(todayIso(), 3);
    const later = addDays(due, 31);
    current.recurringBills = [recurring("bill-1", "Broadband", { version: 2, nextDueOn: due })];
    let calls = 0;
    const base = vi.mocked(api).getMockImplementation()!;
    vi.mocked(api).mockImplementation(async (path, options) => {
      if (path !== "/communes/home-1/recurring") return base(path, options);
      calls += 1;
      if (calls > 1) return { id: "bill-1" };
      // Someone recorded the period while this editor was open.
      current = { ...current, recurringBills: [{ ...current.recurringBills![0], version: 3, nextDueOn: later }] };
      throw new ApiError("This recurring bill was changed by someone else. Review the latest version before saving your changes.", 409);
    });
    mount("/recurring");
    fireEvent.click(await screen.findByRole("button", { name: "Edit Broadband" }));
    const dialog = screen.getByRole("dialog", { name: "Edit recurring bill" });
    fireEvent.change(within(dialog).getByLabelText("Bill name"), { target: { value: "Fibre" } });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save recurring bill" })); });
    const conflict = await within(dialog).findByRole("alert");
    expect(conflict.textContent).toContain("This bill changed while you were editing.");
    expect(conflict.textContent).toContain("Nothing of yours was saved.");
    expect(conflict.textContent).toContain(`Next due: ${formatReminderDay(due)} to ${formatReminderDay(later)}`);
    expect((within(dialog).getByRole("button", { name: "Save recurring bill" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep my edits and check again" }));
    expect((within(dialog).getByLabelText("Bill name") as HTMLInputElement).value).toBe("Fibre");
    expect((within(dialog).getByLabelText("Next due date") as HTMLInputElement).value).toBe(later);
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save recurring bill" })); });
    expect(await screen.findByText("Recurring bill saved.")).toBeTruthy();
    expect(saves().map((body) => [body.expectedVersion, body.title, body.nextDueOn])).toEqual([[2, "Fibre", due], [3, "Fibre", later]]);
  });

  it("recognises its own edit when the reply was lost and a retry finds it saved", async () => {
    current.recurringBills = [recurring("bill-1", "Broadband", { version: 2, nextDueOn: addDays(todayIso(), 3) })];
    let calls = 0;
    const base = vi.mocked(api).getMockImplementation()!;
    vi.mocked(api).mockImplementation(async (path, options) => {
      if (path !== "/communes/home-1/recurring") return base(path, options);
      calls += 1;
      if (calls === 1) {
        current = { ...current, recurringBills: [{ ...current.recurringBills![0], title: "Fibre", version: 3 }] };
        throw new TypeError("Failed to fetch");
      }
      throw new ApiError("This recurring bill was changed by someone else. Review the latest version before saving your changes.", 409);
    });
    mount("/recurring");
    fireEvent.click(await screen.findByRole("button", { name: "Edit Broadband" }));
    const dialog = screen.getByRole("dialog", { name: "Edit recurring bill" });
    fireEvent.change(within(dialog).getByLabelText("Bill name"), { target: { value: "Fibre" } });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save recurring bill" })); });
    expect(await within(dialog).findByText(UNCERTAIN_RETRY_SAFE)).toBeTruthy();
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save recurring bill" })); });
    expect(await screen.findByText("Your changes were saved. The reply was lost on the way back, but the bill now shows them.")).toBeTruthy();
    expect(saves().map((body) => body.expectedVersion)).toEqual([2, 2]);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(await screen.findByText("Recurring bill saved.")).toBeTruthy();
    expect(screen.queryByText(/changed by someone else/)).toBeNull();
  });

  it("says an earlier save may have gone through when its reply was lost and the bill then changed again", async () => {
    const due = addDays(todayIso(), 3);
    const later = addDays(due, 31);
    current.recurringBills = [recurring("bill-1", "Broadband", { version: 2, nextDueOn: due })];
    let calls = 0;
    const base = vi.mocked(api).getMockImplementation()!;
    vi.mocked(api).mockImplementation(async (path, options) => {
      if (path !== "/communes/home-1/recurring") return base(path, options);
      calls += 1;
      if (calls === 1) {
        // The save lands but its reply is lost, then someone records the period.
        current = { ...current, recurringBills: [{ ...current.recurringBills![0], title: "Fibre", version: 4, nextDueOn: later }] };
        throw new TypeError("Failed to fetch");
      }
      throw new ApiError("This recurring bill was changed by someone else. Review the latest version before saving your changes.", 409);
    });
    mount("/recurring");
    fireEvent.click(await screen.findByRole("button", { name: "Edit Broadband" }));
    const dialog = screen.getByRole("dialog", { name: "Edit recurring bill" });
    fireEvent.change(within(dialog).getByLabelText("Bill name"), { target: { value: "Fibre" } });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save recurring bill" })); });
    expect(await within(dialog).findByText(UNCERTAIN_RETRY_SAFE)).toBeTruthy();
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save recurring bill" })); });
    const conflict = await within(dialog).findByRole("alert");
    expect(conflict.textContent).toContain("Your earlier save may have gone through. Check the bill below before saving again.");
    expect(conflict.textContent).not.toContain("Nothing of yours was saved.");
    // Once the person has taken the latest version, a new conflict is about new edits only.
    fireEvent.click(within(dialog).getByRole("button", { name: "Use the latest version" }));
    expect(within(dialog).queryByRole("alert")).toBeNull();
  });

  it("keeps saying nothing was saved when a later attempt was refused outright", async () => {
    const due = addDays(todayIso(), 3);
    current.recurringBills = [recurring("bill-1", "Broadband", { version: 2, nextDueOn: due })];
    let calls = 0;
    const base = vi.mocked(api).getMockImplementation()!;
    vi.mocked(api).mockImplementation(async (path, options) => {
      if (path !== "/communes/home-1/recurring") return base(path, options);
      calls += 1;
      if (calls === 1) throw new TypeError("Failed to fetch");
      if (calls === 2) throw new ApiError("Choose a next due date between 9 Oct 2025 and 9 Oct 2028", 400);
      current = { ...current, recurringBills: [{ ...current.recurringBills![0], amountMinor: 1200, version: 3 }] };
      throw new ApiError("This recurring bill was changed by someone else. Review the latest version before saving your changes.", 409);
    });
    mount("/recurring");
    fireEvent.click(await screen.findByRole("button", { name: "Edit Broadband" }));
    const dialog = screen.getByRole("dialog", { name: "Edit recurring bill" });
    fireEvent.change(within(dialog).getByLabelText("Bill name"), { target: { value: "Fibre" } });
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save recurring bill" })); });
    }
    const conflict = await within(dialog).findByRole("alert");
    expect(conflict.textContent).toContain("Nothing of yours was saved.");
    expect(saves()).toHaveLength(3);
  });

  it("asks the person to check Recurring when an earlier attempt may already have added the bill", async () => {
    current.recurringBills = [];
    let calls = 0;
    const base = vi.mocked(api).getMockImplementation()!;
    vi.mocked(api).mockImplementation(async (path, options) => {
      if (path !== "/communes/home-1/recurring") return base(path, options);
      calls += 1;
      if (calls === 1) throw new TypeError("Failed to fetch");
      throw new ApiError("This request was already used for a different bill", 400);
    });
    mount("/recurring");
    fireEvent.click(await screen.findByRole("button", { name: "Add recurring bill" }));
    const dialog = screen.getByRole("dialog", { name: "Add recurring bill" });
    fireEvent.change(within(dialog).getByLabelText("Bill name"), { target: { value: "Water" } });
    fireEvent.change(within(dialog).getByLabelText("Amount (GBP)"), { target: { value: "30.00" } });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save recurring bill" })); });
    expect(await within(dialog).findByText(UNCERTAIN_RETRY_SAFE)).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText("Amount (GBP)"), { target: { value: "32.00" } });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save recurring bill" })); });
    expect(await within(dialog).findByText(
      "An earlier attempt may already have been saved. Close this and check Recurring before adding it again.")).toBeTruthy();
    const [first, second] = saves();
    expect(second.requestId).toBe(first.requestId);
    expect([first.amountMinor, second.amountMinor]).toEqual([3000, 3200]);
  });

  it("still resumes after a lost reply when the person chose Save and resume", async () => {
    current.members = [...initial.members, { userId: "user-3", name: "Sam Lee", role: "member", active: false }];
    current.recurringBills = [recurring("bill-1", "Cleaner", {
      paused: true, version: 4, nextDueOn: addDays(todayIso(), 5),
      allocations: [{ userId: user.id, amountMinor: 500 }, { userId: "user-3", amountMinor: 500 }],
    })];
    let calls = 0;
    const base = vi.mocked(api).getMockImplementation()!;
    vi.mocked(api).mockImplementation(async (path, options) => {
      if (path === "/recurring/bill-1/pause") return { id: "bill-1", paused: false, archivedAt: null, version: 6, duplicate: false };
      if (path !== "/communes/home-1/recurring") return base(path, options);
      calls += 1;
      if (calls === 1) {
        const body = JSON.parse(String(options?.body));
        current = { ...current, recurringBills: [{ ...current.recurringBills![0], amountMinor: body.amountMinor, allocations: body.allocations, version: 5 }] };
        throw new TypeError("Failed to fetch");
      }
      throw new ApiError("This recurring bill was changed by someone else. Review the latest version before saving your changes.", 409);
    });
    mount("/recurring");
    fireEvent.click(await screen.findByRole("button", { name: "Resume Cleaner" }));
    const dialog = screen.getByRole("dialog", { name: "Edit recurring bill" });
    fireEvent.change(within(dialog).getByLabelText("Amount (GBP)"), { target: { value: "5.00" } });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save and resume" })); });
    expect(await within(dialog).findByText(UNCERTAIN_RETRY_SAFE)).toBeTruthy();
    expect(api).not.toHaveBeenCalledWith("/recurring/bill-1/pause", expect.anything());
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save and resume" })); });
    fireEvent.click(await screen.findByRole("button", { name: "Done" }));
    expect(await screen.findByText("Bill saved and resumed.")).toBeTruthy();
    expect(api).toHaveBeenCalledWith("/recurring/bill-1/pause", expect.objectContaining({ body: '{"paused":false}' }));
  });
});
