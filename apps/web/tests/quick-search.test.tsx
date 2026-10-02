import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "../src/shell/Shell";
import { QuickSearch } from "../src/ui/QuickSearch";
import { parseSearchResponse, type SearchKind, type SearchResult } from "../src/live/search";
import { openSearchResult } from "../src/ui/searchNavigation";

const mocks = vi.hoisted(() => ({ api: vi.fn(), go: vi.fn(), setQuery: vi.fn(), setScope: vi.fn(), app: {} as Record<string, unknown> }));
vi.mock("../src/state", () => ({ useApp: () => mocks.app }));
vi.mock("../src/live/api", async () => ({ ...await vi.importActual<typeof import("../src/live/api")>("../src/live/api"), api: mocks.api }));
const item = (kind: SearchKind, id: string, title: string): SearchResult => ({ kind, id, title, communeId: "home-2", communeName: "Maple House", subtitle: "Shared record", meta: "Open", amountMinor: null, currency: "GBP" });
const response = (items: SearchResult[]) => ({ query: "garden", items, total: items.length, hasMore: false });
const originalShow = HTMLDialogElement.prototype.showModal;
const originalClose = HTMLDialogElement.prototype.close;
const originalScroll = Element.prototype.scrollIntoView;
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  Element.prototype.scrollIntoView = vi.fn();
});
afterAll(() => {
  HTMLDialogElement.prototype.showModal = originalShow;
  HTMLDialogElement.prototype.close = originalClose;
  Element.prototype.scrollIntoView = originalScroll;
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.app = { hub: { id: "home-1", name: "Our home" }, hubId: "home-1",
    places: [{ id: "home-1", name: "Our home" }, { id: "home-2", name: "Maple House" }],
    session: { hasHubs: true }, go: mocks.go, setSearchQuery: mocks.setQuery, setSearchScope: mocks.setScope,
    pageTitle: "Expenses", pageLede: "Shared expenses", setMoreOpen: vi.fn(), native: false,
    you: { name: "Alex", initials: "AL" }, noticesOn: true, notifications: [], window: null };
  mocks.api.mockResolvedValue(response([item("expense", "expense-2", "Garden supplies")]));
});
afterEach(cleanup);
function mount() {
  const close = vi.fn();
  render(<QuickSearch initialScope="home-1" onClose={close} />);
  return close;
}
async function query(text = "garden") {
  fireEvent.change(screen.getByRole("combobox", { name: "Search Commune" }), { target: { value: text } });
  await waitFor(() => expect(mocks.api).toHaveBeenCalled());
}

describe("Commune quick search", () => {
  it("autofocuses and makes no request for fewer than two characters", () => {
    mount(); const input = screen.getByRole("combobox", { name: "Search Commune" });
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: "g" } });
    expect(mocks.api).not.toHaveBeenCalled();
    expect(screen.getByText(/Type at least two characters/)).toBeTruthy();
  });
  it("groups exact record IDs, scopes one request and opens with the keyboard", async () => {
    mocks.api.mockResolvedValue(response([item("note", "note-2", "Garden guide"), item("expense", "expense-2", "Garden supplies")]));
    const close = mount(); await query();
    await screen.findByRole("option", { name: /Garden supplies/ });
    expect(mocks.api.mock.calls[0][0]).toBe("/search?q=garden&limit=8&commune=home-1");
    expect(screen.getByRole("group", { name: "Expenses" })).toBeTruthy();
    const input = screen.getByRole("combobox", { name: "Search Commune" });
    fireEvent.keyDown(input, { key: "ArrowDown" }); fireEvent.keyDown(input, { key: "Enter" });
    expect(close).toHaveBeenCalledOnce();
    expect(mocks.go).toHaveBeenCalledWith("note", { hub: "home-2", note: "note-2" });
  });
  it("changes scope without reloading commune snapshots", async () => {
    mount(); await query();
    fireEvent.click(screen.getByRole("button", { name: "All communes", exact: true }));
    await waitFor(() => expect(mocks.api.mock.calls.at(-1)?.[0]).toBe("/search?q=garden&limit=8"));
    expect(mocks.api.mock.calls.every(([path]) => String(path).startsWith("/search?"))).toBe(true);
  });
  it("does not let an obsolete response replace the current query", async () => {
    let oldResolve!: (value: unknown) => void;
    mocks.api.mockImplementationOnce(() => new Promise(resolve => { oldResolve = resolve; }));
    mocks.api.mockResolvedValue(response([item("note", "note-fresh", "Kitchen guide")]));
    mount(); await query("garden");
    fireEvent.change(screen.getByRole("combobox", { name: "Search Commune" }), { target: { value: "kitchen" } });
    expect(screen.queryByRole("option")).toBeNull();
    await screen.findByRole("option", { name: /Kitchen guide/ });
    await act(async () => { oldResolve(response([item("note", "old-note", "Garden guide")])); });
    expect(screen.queryByRole("option", { name: /Garden guide/ })).toBeNull();
    expect(mocks.api.mock.calls[0][1].signal.aborted).toBe(true);
  });
  it("shows failure as a retryable error, not an empty result", async () => {
    mocks.api.mockRejectedValueOnce(new Error("Search service unavailable"));
    mount(); await query(); await screen.findByRole("alert");
    expect(screen.queryByText(/No matches for/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("option", { name: /Garden supplies/ });
  });
  it("keeps query and scope when moving to full search", async () => {
    const close = mount(); await query();
    fireEvent.click(await screen.findByRole("button", { name: "Open full search" }));
    expect(mocks.setQuery).toHaveBeenCalledWith("garden"); expect(mocks.setScope).toHaveBeenCalledWith("home-1");
    expect(mocks.go).toHaveBeenCalledWith("search"); expect(close).toHaveBeenCalledOnce();
  });
  it("opens with Ctrl-K and slash, closes with the shortcut, and restores focus", async () => {
    render(<Header screen="expenses" />);
    const opener = screen.getByRole("button", { name: "Open search" }); opener.focus();
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(screen.getByRole("dialog", { name: "Search Commune" })).toBeTruthy();
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(screen.queryByRole("dialog")).toBeNull(); expect(document.activeElement).toBe(opener);
    fireEvent.keyDown(document, { key: "/" });
    expect(screen.getByRole("dialog", { name: "Search Commune" })).toBeTruthy();
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { bubbles: false, cancelable: true }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("does not hijack slash while typing or open over another editor", () => {
    render(<><Header screen="notes" /><input aria-label="Note editor" /></>);
    fireEvent.keyDown(screen.getByLabelText("Note editor"), { key: "/" });
    expect(screen.queryByRole("dialog")).toBeNull();
    mocks.app.window = "note-new";
    cleanup(); render(<Header screen="notes" />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("closes a populated native search field with one Escape and restores the opener", async () => {
    render(<Header screen="expenses" />);
    const opener = screen.getByRole("button", { name: "Open search" });
    opener.focus(); fireEvent.click(opener); await query();
    await screen.findByRole("option", { name: /Garden supplies/ });
    const input = screen.getByRole("combobox", { name: "Search Commune" });
    expect(fireEvent.keyDown(input, { key: "Escape" })).toBe(false);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
  it.each(["commune", "expense", "note", "operation", "fund", "recurring", "member", "template"] as const)("routes %s to the precise record and commune", kind => {
    openSearchResult(mocks.go, item(kind, "precise-id", "Garden"));
    const [destination, options] = mocks.go.mock.calls[0];
    expect(options.hub).toBe("home-2");
    if (kind === "commune") expect(destination).toBe("hub");
    else if (["expense", "note", "operation"].includes(kind)) expect(options[kind]).toBe("precise-id");
    else expect(options.record).toEqual({ kind, id: "precise-id" });
  });
  it("rejects malformed results rather than navigating to fallback records", () => {
    expect(() => parseSearchResponse({ query: "garden", total: 1, items: [{ kind: "expense" }] })).toThrow(/invalid response/);
    expect(() => parseSearchResponse(response([{ ...item("note", "x", "Garden"), amountMinor: NaN }]))).toThrow(/invalid response/);
  });
});
