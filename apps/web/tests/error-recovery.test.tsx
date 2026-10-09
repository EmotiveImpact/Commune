import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { App } from "../src/App";
import { AppProvider } from "../src/state";
import { api, ApiError, loadCommunes, loadSnapshot, post } from "../src/live/api";
import type { Commune, Snapshot } from "../src/live/model";
import { todayIso, type OperationItem } from "../src/data/operations";
import { setViewer } from "../src/live/session";
import { routePattern } from "../src/nav";
import { AppRecovery, RecoveryBoundary } from "../src/shell/Recovery";
import { browserFamily, RELEASE, reportError, reportText, watchErrors, watchSpeed } from "../src/live/reports";

vi.mock("../src/live/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/live/api")>(),
  api: vi.fn(), post: vi.fn(), loadCommunes: vi.fn(), loadSnapshot: vi.fn(),
}));

// Finding 21: a drawing error shows a way on in place of the part that broke,
// and errors and sampled speed figures are reported.
const broken = vi.hoisted(() => ({ screen: false, window: false }));
vi.mock("../src/screens/Money", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/screens/Money")>();
  return { ...original, FundsScreen: () => {
    if (broken.screen) throw new Error("Funds could not draw fund 0f8fe1a5-1234-4abc-9def-0123456789ab");
    return <p>Funds drawn</p>;
  } };
});
vi.mock("../src/windows/OperationsWindows", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/windows/OperationsWindows")>();
  return { ...original, OperationView: () => {
    if (broken.window) throw new TypeError("Cannot read properties of undefined (reading 'title')");
    return <p>Task drawn</p>;
  } };
});

const user = { id: "user-1", name: "Test Person", email: "test@example.test", emailVerified: true };
const home: Commune = { id: "home-1", name: "Our home", kind: "household", currency: "GBP", role: "admin" };
const bins: OperationItem = { id: "task-1", hubId: home.id, kind: "task", category: "chore", title: "Bins", date: todayIso(), allDay: true,
  assignee: user.name, repeat: "none", status: "open", notes: "" };
const snapshot: Snapshot = { commune: home, members: [{ userId: user.id, name: user.name, role: "admin" }],
  expenses: [], operations: [bins], funds: [], notifications: [], reminderTargets: [] };

/** What reached the report endpoint. */
function reports() {
  return vi.mocked(api).mock.calls.filter(([path]) => path === "/client-reports")
    .map(([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>);
}
// Each test starts in the browser's own history at its address, signed in.
function start(path: string) {
  window.history.pushState(null, "", path);
  render(<AppProvider><App /></AppProvider>);
}

beforeAll(() => { Element.prototype.scrollIntoView = vi.fn(); });
beforeEach(() => {
  vi.resetAllMocks();
  setViewer(null);
  broken.screen = false;
  broken.window = false;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === "/auth/me") return { user };
    if (path === "/reminders/usage") return { totalUsed: 0, totalLimit: 60, recipientLimit: 6, recipientUsage: {}, nextSlotAt: null };
    if (path.endsWith("/invites")) return { invites: [] };
    if (path === "/preferences") return { emailReminders: true };
    if (path === "/client-reports") return { stored: true };
    throw new Error(`Unexpected API request ${path}`);
  });
  vi.mocked(post).mockResolvedValue({ ok: true });
  vi.mocked(loadCommunes).mockResolvedValue({ communes: [home] });
  vi.mocked(loadSnapshot).mockResolvedValue(snapshot);
});
afterEach(() => {
  cleanup();
  window.history.pushState(null, "", "/");
});

describe("a part of the app that fails to draw", () => {
  it("leaves the rest of the app working and says what happened", async () => {
    broken.screen = true;
    start("/funds?commune=home-1");
    const card = await screen.findByRole("alert");
    expect(within(card).getByRole("heading", { name: "This page couldn’t be shown." })).toBeTruthy();
    expect(within(card).getByText("Something went wrong while showing it. Try again, or go to Home.")).toBeTruthy();
    // The navigation is still there.
    expect(within(screen.getByRole("navigation", { name: "Primary" })).getAllByRole("button", { name: /Expenses/ }).length).toBeGreaterThan(0);
    await waitFor(() => expect(reports()).toHaveLength(1));
    expect(reports()[0]).toMatchObject({ kind: "error", release: RELEASE, route: "/funds", browser: "other",
      message: "Error: Funds could not draw fund :id" });
    expect(String(reports()[0].stack)).not.toMatch(/commune=|0f8fe1a5|https?:/);

    broken.screen = false;
    fireEvent.click(within(card).getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Funds drawn")).toBeTruthy();
  });

  it("goes Home, and starts afresh on another page", async () => {
    broken.screen = true;
    start("/funds?commune=home-1");
    fireEvent.click(within(await screen.findByRole("alert")).getByRole("button", { name: "Go to Home" }));
    await screen.findByRole("heading", { name: "Your communes, Test." });
    expect(window.location.pathname).toBe("/");
  });

  it("keeps a broken window to itself, with the screen behind it untouched", async () => {
    broken.window = true;
    start("/operations/task-1?commune=home-1");
    const dialog = await screen.findByRole("dialog", { name: "Bins" });
    const card = await within(dialog).findByRole("alert");
    expect(within(card).getByText("Something went wrong while showing this. Try again, or go to Home.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Operations", level: 1 })).toBeTruthy();
    await waitFor(() => expect(reports()).toHaveLength(1));
    expect(reports()[0]).toMatchObject({ kind: "error", route: "/operations/:id",
      message: "TypeError: Cannot read properties of undefined (reading 'title')" });

    broken.window = false;
    fireEvent.click(within(card).getByRole("button", { name: "Try again" }));
    expect(await within(dialog).findByText("Task drawn")).toBeTruthy();
  });

  it("shows a whole-page card when the app itself fails, which tries again", () => {
    let fail = true;
    function App() {
      if (fail) throw new Error("The app could not start");
      return <p>Started</p>;
    }
    render(<RecoveryBoundary fallback={(retry) => <AppRecovery retry={retry} />}><App /></RecoveryBoundary>);
    const card = screen.getByRole("alert");
    expect(within(card).getByRole("heading", { name: "Something went wrong" })).toBeTruthy();
    expect(within(card).getByText("Commune couldn’t show this page. Try again, or go to Home.")).toBeTruthy();
    expect(within(card).getByRole("button", { name: "Go to Home" })).toBeTruthy();
    fail = false;
    fireEvent.click(within(card).getByRole("button", { name: "Try again" }));
    expect(screen.getByText("Started")).toBeTruthy();
  });

  it("starts afresh when it is given another page", () => {
    function Broken({ page }: { page: string }) {
      if (page === "a") throw new Error("Page a broke");
      return <p>Page {page}</p>;
    }
    const fallback = () => <p>Recovery card</p>;
    const view = render(<RecoveryBoundary resetKey="a" fallback={fallback}><Broken page="a" /></RecoveryBoundary>);
    expect(screen.getByText("Recovery card")).toBeTruthy();
    view.rerender(<RecoveryBoundary resetKey="b" fallback={fallback}><Broken page="b" /></RecoveryBoundary>);
    expect(screen.getByText("Page b")).toBeTruthy();
  });
});

describe("error reports", () => {
  it("name each page by a pattern, never a record, commune or query", () => {
    expect(routePattern("/expenses/0f8fe1a5-1234-4abc-9def-0123456789ab?commune=home-1")).toBe("/expenses/:id");
    expect(routePattern("/expenses/expense-1/paid")).toBe("/expenses/:id/paid");
    expect(routePattern("/settle/pay/share-1")).toBe("/settle/pay/:id");
    expect(routePattern("/notes/note-1/edit")).toBe("/notes/:id/edit");
    expect(routePattern("/funds/fund-1")).toBe("/funds/:id");
    expect(routePattern("/expenses/new?template=t-1")).toBe("/expenses/new");
    expect(routePattern("/hub?commune=home-1&window=notices")).toBe("/hub");
    expect(routePattern("/")).toBe("/");
    expect(routePattern("/activity/all")).toBe("/activity/all");
    expect(routePattern("/invite?token=abc")).toBe("/invite");
    expect(routePattern("/reset-password#token")).toBe("/reset-password");
    expect(routePattern("/somewhere/else")).toBe("/:unknown");
  });

  it("carry no site, record id, email address or query", () => {
    expect(reportText("TypeError: no 0F8FE1A5-1234-4abc-9def-0123456789ab for emma.j+home@gmail.co.uk"))
      .toBe("TypeError: no :id for [email]");
    expect(reportText("    at render (https://commune.example/assets/index-abc.js?v=3:1:2)")).toBe("    at render (/assets/index-abc.js:1:2)");
    expect(reportText("render@https://commune.example/assets/index-abc.js:4:5")).toBe("render@/assets/index-abc.js:4:5");
  });

  it("know the browser family and nothing more", () => {
    expect(browserFamily("Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36")).toBe("samsung");
    expect(browserFamily("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0")).toBe("edge");
    expect(browserFamily("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1")).toBe("chrome");
    expect(browserFamily("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")).toBe("safari");
    expect(browserFamily("Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0")).toBe("firefox");
    expect(browserFamily("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 OPR/114.0.0.0")).toBe("other");
  });

  it("are sent only when signed in, once for each error", async () => {
    reportError(new Error("Signed out failure"));
    setViewer(user.id);
    reportError(new Error("Signed in failure"));
    reportError(new Error("Signed in failure"));
    await waitFor(() => expect(reports()).toHaveLength(1));
    expect(reports()[0].message).toBe("Error: Signed in failure");
  });

  it("cover errors outside drawing, but not refused or dropped requests", async () => {
    setViewer(user.id);
    const stop = watchErrors();
    // Handled here, so the test runner does not take it for its own.
    const handled = (event: Event) => event.preventDefault();
    window.addEventListener("error", handled);
    window.dispatchEvent(new ErrorEvent("error", { error: new RangeError("Handler failure"), cancelable: true }));
    window.removeEventListener("error", handled);
    const rejected = (reason: unknown) => window.dispatchEvent(Object.assign(new Event("unhandledrejection"), { reason }));
    rejected(new ApiError("You can’t do that", 403));
    rejected(new TypeError("Failed to fetch"));
    rejected(new DOMException("The operation was aborted.", "AbortError"));
    rejected(new TypeError("Promise failure"));
    stop();
    rejected(new TypeError("After stopping"));
    await waitFor(() => expect(reports()).toHaveLength(2));
    expect(reports().map((report) => report.message)).toEqual(["RangeError: Handler failure", "TypeError: Promise failure"]);
  });
});

describe("speed figures", () => {
  // The browser's PerformanceObserver, fed by hand.
  const observers = new Map<string, (entries: object[]) => void>();
  class FakeObserver {
    static supportedEntryTypes = ["largest-contentful-paint", "layout-shift", "event"];
    constructor(private readonly read: (list: { getEntries(): object[] }) => void) {}
    observe({ type }: { type: string }) { observers.set(type, (entries) => this.read({ getEntries: () => entries })); }
  }
  let visibility: DocumentVisibilityState = "visible";
  beforeEach(() => {
    observers.clear();
    visibility = "visible";
    vi.stubGlobal("PerformanceObserver", FakeObserver);
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete (document as unknown as Record<string, unknown>).visibilityState;
  });
  const hide = () => { visibility = "hidden"; document.dispatchEvent(new Event("visibilitychange")); };

  it("are measured on about one page load in ten and sent when the page is first hidden", async () => {
    setViewer(user.id);
    window.history.pushState(null, "", "/expenses/expense-1?commune=home-1");
    watchSpeed(() => 0.05);
    observers.get("largest-contentful-paint")?.([{ startTime: 900.4 }, { startTime: 1840.6 }]);
    observers.get("layout-shift")?.([{ startTime: 100, value: 0.05, hadRecentInput: false },
      { startTime: 600, value: 0.04, hadRecentInput: false }, { startTime: 700, value: 0.5, hadRecentInput: true },
      { startTime: 9000, value: 0.02, hadRecentInput: false }]);
    observers.get("event")?.([{ interactionId: 1, duration: 48 }, { interactionId: 1, duration: 120 },
      { interactionId: 2, duration: 64 }, { interactionId: 0, duration: 400 }]);
    hide();
    hide();
    await waitFor(() => expect(reports()).toHaveLength(1));
    expect(reports()[0]).toEqual({ kind: "speed", route: "/expenses/:id", lcpMs: 1841, inpMs: 120, cls: 0.09,
      release: RELEASE, browser: "other" });
    expect(vi.mocked(api).mock.calls.find(([path]) => path === "/client-reports")?.[1]).toMatchObject({ keepalive: true });
  });

  it("are not measured on the other nine, or sent for someone signed out", async () => {
    watchSpeed(() => 0.5);
    expect(observers.size).toBe(0);
    watchSpeed(() => 0.01);
    observers.get("largest-contentful-paint")?.([{ startTime: 1200 }]);
    hide();
    await act(async () => { await Promise.resolve(); });
    expect(reports()).toHaveLength(0);
  });
});
