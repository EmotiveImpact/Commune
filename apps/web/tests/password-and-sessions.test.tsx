import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "../src/App";
import { preloadAll } from "../src/shell/lazyComponent";
import { AppProvider } from "../src/state";
import { ApiError, api, loadCommunes, loadSnapshot, post } from "../src/live/api";
import type { Commune, Snapshot } from "../src/live/model";

vi.mock("../src/live/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/live/api")>()),
  api: vi.fn(), post: vi.fn(), loadCommunes: vi.fn(), loadSnapshot: vi.fn(),
}));

const user = { id: "user-1", name: "Test Person", email: "test@example.test", emailVerified: true };
const commune: Commune = { id: "home-1", name: "Our home", kind: "household", currency: "GBP", role: "admin" };
const snapshot: Snapshot = { commune, members: [{ userId: user.id, name: user.name, role: "admin" }], expenses: [], funds: [], notifications: [], reminderTargets: [] };
const STILL_OPEN = "A device that already has Commune open can keep working for up to 15 minutes.";
let signedIn: boolean;

const modalDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const closeDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
// The screens and windows a browser loads on first use are loaded up front,
// so each test sees them drawn at once.
beforeAll(preloadAll);
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); } });
});
afterAll(() => {
  if (modalDescriptor) Object.defineProperty(HTMLDialogElement.prototype, "showModal", modalDescriptor);
  else delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).showModal;
  if (closeDescriptor) Object.defineProperty(HTMLDialogElement.prototype, "close", closeDescriptor);
  else delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).close;
});
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  signedIn = true;
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === "/auth/me") return { user: signedIn ? user : null };
    if (path === "/reminders/usage") return { totalUsed: 0, totalLimit: 60, recipientLimit: 6, recipientUsage: {}, nextSlotAt: null };
    if (path.endsWith("/invites")) return { invites: [] };
    if (path === "/preferences") return { emailReminders: true };
    throw new Error(`Unexpected API request ${path}`);
  });
  vi.mocked(post).mockResolvedValue({ ok: true });
  vi.mocked(loadCommunes).mockResolvedValue({ communes: [commune] });
  vi.mocked(loadSnapshot).mockResolvedValue(snapshot);
});
afterEach(cleanup);

function mount() {
  const location = memoryLocation({ path: "/settings", record: true });
  render(<Router hook={location.hook}><AppProvider><App /></AppProvider></Router>);
  return location;
}
const posted = (path: string) => vi.mocked(post).mock.calls.filter(([to]) => to === path).map(([, body]) => body);
const sessionChecks = () => vi.mocked(api).mock.calls.filter(([path]) => path === "/auth/me").length;

async function openChangePassword() {
  fireEvent.click(await screen.findByRole("button", { name: /^Change password/ }));
  return screen.getByRole("dialog", { name: "Change your password" });
}
function fillIn(dialog: HTMLElement, current: string, next: string) {
  fireEvent.change(within(dialog).getByLabelText("Current password"), { target: { value: current } });
  fireEvent.change(within(dialog).getByLabelText("New password"), { target: { value: next } });
}

describe("Change password in Settings", () => {
  it("changes it, keeps this device signed in and says what happens elsewhere", async () => {
    const location = mount();
    const dialog = await openChangePassword();
    expect(within(dialog).getByText(new RegExp(STILL_OPEN.replace(/\./g, "\\.")))).toBeTruthy();
    fillIn(dialog, "Current-password-1", "A-new-password-22");
    fireEvent.click(within(dialog).getByRole("button", { name: "Change password" }));
    await screen.findByText("Password changed. You’re still signed in here, and other devices will need to sign in again.");
    expect(screen.getByText(STILL_OPEN)).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "Change your password" })).toBeNull();
    expect(posted("/auth/change-password")).toEqual([{ currentPassword: "Current-password-1", newPassword: "A-new-password-22" }]);
    expect(location.history.at(-1)).toBe("/settings");
  });

  it("explains a wrong current password in the dialog and keeps this device signed in", async () => {
    vi.mocked(post).mockRejectedValue(new ApiError("Your current password isn’t right. Nothing was changed.", 400));
    const location = mount();
    const dialog = await openChangePassword();
    const checks = sessionChecks();
    fillIn(dialog, "not-the-password", "A-new-password-22");
    fireEvent.click(within(dialog).getByRole("button", { name: "Change password" }));
    expect((await within(dialog).findByRole("alert")).textContent).toBe("Your current password isn’t right. Nothing was changed.");
    expect(document.querySelector(".a-api-error")).toBeNull();
    expect(sessionChecks()).toBe(checks);
    expect(location.history.at(-1)).toBe("/settings");
  });

  it("checks the new password before sending it", async () => {
    mount();
    const dialog = await openChangePassword();
    fillIn(dialog, "Current-password-1", "elevenchars");
    fireEvent.submit(within(dialog).getByLabelText("New password").closest("form")!);
    expect((await within(dialog).findByRole("alert")).textContent).toBe("Use 12 to 128 characters for your new password.");
    fillIn(dialog, "Current-password-1", "Current-password-1");
    fireEvent.submit(within(dialog).getByLabelText("New password").closest("form")!);
    expect((await within(dialog).findByRole("alert")).textContent).toBe("Your new password is the same as your current one.");
    expect(posted("/auth/change-password")).toEqual([]);
  });

  it("says when there have been too many attempts", async () => {
    vi.mocked(post).mockRejectedValue(new ApiError("Try signing in again later", 429));
    mount();
    const dialog = await openChangePassword();
    fillIn(dialog, "guess-number-eleven", "A-new-password-22");
    fireEvent.click(within(dialog).getByRole("button", { name: "Change password" }));
    expect((await within(dialog).findByRole("alert")).textContent).toBe("Too many attempts. Nothing was changed. Try again later.");
  });

  it("says when the change could not be confirmed, and how to tell", async () => {
    vi.mocked(post).mockRejectedValue(new TypeError("Failed to fetch"));
    mount();
    const dialog = await openChangePassword();
    fillIn(dialog, "Current-password-1", "A-new-password-22");
    fireEvent.click(within(dialog).getByRole("button", { name: "Change password" }));
    expect((await within(dialog).findByRole("alert")).textContent).toBe(
      "We couldn’t confirm the change. Check your connection, then try again. If Commune then says your current password isn’t right, the change went through and your new password is the one to use.");
    expect(document.querySelector(".a-api-error")).toBeNull();
  });

  it("treats a refused sign-in as being signed out", async () => {
    vi.mocked(post).mockImplementation(async () => {
      signedIn = false;
      throw new ApiError("Sign in required", 401);
    });
    const location = mount();
    const dialog = await openChangePassword();
    fillIn(dialog, "Current-password-1", "A-new-password-22");
    fireEvent.click(within(dialog).getByRole("button", { name: "Change password" }));
    await screen.findByText("You were signed out, so your last change wasn’t saved. Sign in to try again.");
    expect(location.history.at(-1)).toBe("/login");
  });
});

describe("Sign out everywhere else in Settings", () => {
  async function openSignOutElsewhere() {
    fireEvent.click(await screen.findByRole("button", { name: /^Sign out everywhere else/ }));
    return screen.getByRole("dialog", { name: "Sign out everywhere else?" });
  }

  it("asks first, keeps this device signed in and is honest about timing", async () => {
    const location = mount();
    const dialog = await openSignOutElsewhere();
    expect(within(dialog).getByText(/You’ll stay signed in on this device\./)).toBeTruthy();
    expect(within(dialog).getByText(new RegExp(STILL_OPEN.replace(/\./g, "\\.")))).toBeTruthy();
    expect(posted("/auth/logout-others")).toEqual([]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Sign out everywhere else" }));
    await screen.findByText("Signed out everywhere else. You’re still signed in here.");
    expect(screen.getByText(STILL_OPEN)).toBeTruthy();
    expect(posted("/auth/logout-others")).toEqual([{}]);
    expect(location.history.at(-1)).toBe("/settings");
  });

  it("can be cancelled, and says when the outcome is unknown", async () => {
    mount();
    fireEvent.click(within(await openSignOutElsewhere()).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Sign out everywhere else?" })).toBeNull();
    vi.mocked(post).mockRejectedValue(new TypeError("Failed to fetch"));
    const dialog = await openSignOutElsewhere();
    fireEvent.click(within(dialog).getByRole("button", { name: "Sign out everywhere else" }));
    expect((await within(dialog).findByRole("alert")).textContent).toBe(
      "We couldn’t confirm this. Check your connection, then try again. Trying again is safe.");
  });
});
