import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "../src/App";
import { AppProvider } from "../src/state";
import { api, loadCommunes, loadSnapshot } from "../src/live/api";
import type { Commune, Snapshot } from "../src/live/model";
import { formatSortCode, parsePayLinks, payLinkHref, payLinkLabel, type PayLink } from "../src/data/payLinks";

vi.mock("../src/live/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/live/api")>()),
  api: vi.fn(), post: vi.fn(), loadCommunes: vi.fn(), loadSnapshot: vi.fn(),
}));

const monzo: PayLink = { provider: "monzo", handle: "samokafor", accountName: null, sortCode: null, accountNumber: null };
const paypal: PayLink = { provider: "paypal", handle: "samokafor", accountName: null, sortCode: null, accountNumber: null };
const revolut: PayLink = { provider: "revolut", handle: "sam.o", accountName: null, sortCode: null, accountNumber: null };
const bank: PayLink = { provider: "bank", handle: null, accountName: "Sam Okafor", sortCode: "204577", accountNumber: "41029388" };

describe("pay link addresses", () => {
  it("fills in the amount where the provider allows it", () => {
    expect(payLinkHref(monzo, 1600, "GBP", "Printer ink")).toEqual({ href: "https://monzo.me/samokafor/16.00?d=Printer%20ink", amountFilled: true });
    expect(payLinkHref(paypal, 2160, "EUR")).toEqual({ href: "https://paypal.me/samokafor/21.60EUR", amountFilled: true });
    expect(payLinkHref(revolut, 1600, "GBP")).toEqual({ href: "https://revolut.me/sam.o", amountFilled: false });
    expect(payLinkHref(bank, 1600, "GBP")).toBeNull();
  });

  it("never puts a non-pound amount into a Monzo link", () => {
    expect(payLinkHref(monzo, 1600, "EUR")).toEqual({ href: "https://monzo.me/samokafor", amountFilled: false });
  });

  it("reads only well-formed links, in a fixed order", () => {
    const links = parsePayLinks([
      { provider: "bank", accountName: "Sam Okafor", sortCode: "204577", accountNumber: "41029388" },
      { provider: "venmo", handle: "sam" },
      { provider: "paypal", handle: "" },
      { provider: "monzo", handle: "samokafor" },
      "nonsense",
    ]);
    expect(links.map((link) => link.provider)).toEqual(["monzo", "bank"]);
    expect(parsePayLinks(undefined)).toEqual([]);
  });

  it("shows bank details in the usual UK form", () => {
    expect(formatSortCode("204577")).toBe("20-45-77");
    expect(payLinkLabel(bank)).toBe("Sam Okafor · 20-45-77 · 41029388");
    expect(payLinkLabel(monzo)).toBe("monzo.me/samokafor");
  });
});

const user = { id: "user-1", name: "Test Person", email: "test@example.test", emailVerified: true };
const commune: Commune = { id: "home-1", name: "Our home", kind: "household", currency: "GBP", role: "member" };
let current: Snapshot;
let saved: PayLink[];
function snapshot(): Snapshot {
  return {
    commune,
    members: [
      { userId: user.id, name: user.name, role: "member", active: true },
      { userId: "user-2", name: "Sam", role: "admin", active: true },
    ],
    expenses: [{
      id: "expense-1", title: "Printer ink", category: "Other", amountMinor: 3200, paidByUserId: "user-2",
      dueOn: "2026-01-05", createdAt: "2026-01-01T10:00:00Z",
      shares: [
        { id: "share-payer", userId: "user-2", amountMinor: 1600, settledMinor: 1600 },
        { id: "share-mine", userId: user.id, amountMinor: 1600, settledMinor: 0, paymentReports: [] },
      ],
    }],
    funds: [], notes: [], operations: [], notifications: [], reminderTargets: [], sentReminders: [],
    recurringBills: [], splitTemplates: [], activityEvents: [],
    payLinks: { "user-2": [monzo, bank] },
  };
}
function mount(path: string) {
  const location = memoryLocation({ path, record: true });
  render(<Router hook={location.hook}><AppProvider><App /></AppProvider></Router>);
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
  current = snapshot();
  saved = [];
  vi.mocked(api).mockImplementation(async (path, init) => {
    if (path === "/auth/me") return { user };
    if (path === "/reminders/usage") return { totalUsed: 0, totalLimit: 60, recipientLimit: 8, recipientUsage: {}, nextSlotAt: null };
    if (path.endsWith("/invites")) return { invites: [] };
    if (path === "/pay-links") return { links: saved };
    if (path === "/pay-links/monzo" && init?.method === "PUT") {
      saved = [{ ...monzo, handle: JSON.parse(String(init.body)).handle }];
      return { links: saved };
    }
    if (path === "/pay-links/monzo" && init?.method === "DELETE") { saved = []; return { links: saved }; }
    return { ok: true };
  });
  vi.mocked(loadCommunes).mockResolvedValue({ communes: [commune] });
  vi.mocked(loadSnapshot).mockImplementation(async () => current);
});
afterEach(cleanup);

describe("paying someone who has shared their pay links", () => {
  it("offers their Monzo with the amount filled in, and their bank details, before you report it", async () => {
    mount("/settle");
    fireEvent.click(await screen.findByRole("button", { name: /^I’ve sent it/ }));
    const dialog = screen.getByRole("dialog", { name: "Tell Sam you’ve paid" });
    const open = within(dialog).getByRole("link", { name: "Open Monzo" });
    expect(open.getAttribute("href")).toBe("https://monzo.me/samokafor/16.00?d=Printer%20ink");
    expect(open.getAttribute("rel")).toContain("noopener");
    expect(within(dialog).getByText("£16.00 filled in")).toBeTruthy();
    expect(within(dialog).getByText("Sam Okafor · 20-45-77 · 41029388")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Copy details" })).toBeTruthy();
  });

  it("says plainly when the bill payer has not added any", async () => {
    current.payLinks = {};
    mount("/settle");
    fireEvent.click(await screen.findByRole("button", { name: /^I’ve sent it/ }));
    const dialog = screen.getByRole("dialog", { name: "Tell Sam you’ve paid" });
    expect(within(dialog).queryByRole("link")).toBeNull();
    expect(within(dialog).getByText(/Sam hasn’t added how they like to be paid/)).toBeTruthy();
  });
});

describe("your own pay links", () => {
  it("saves a Monzo username in Commune and can remove it", async () => {
    mount("/settings");
    fireEvent.click(await screen.findByRole("button", { name: /How people pay you/ }));
    const add = await screen.findAllByRole("button", { name: "Add" });
    fireEvent.click(add[0]);
    fireEvent.change(screen.getByLabelText(/Monzo username/), { target: { value: "testperson" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save" })); });
    const put = vi.mocked(api).mock.calls.find(([path, init]) => path === "/pay-links/monzo" && init?.method === "PUT");
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ handle: "testperson" });
    expect(await screen.findByText("monzo.me/testperson")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("People in your communes see it when they owe you");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Remove" })); });
    expect(vi.mocked(api).mock.calls.some(([path, init]) => path === "/pay-links/monzo" && init?.method === "DELETE")).toBe(true);
    expect(screen.getByRole("status").textContent).toBe("Monzo removed.");
  });
});
