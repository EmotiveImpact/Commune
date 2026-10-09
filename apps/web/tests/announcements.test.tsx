import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "../src/App";
import { AppProvider, useApp, type AppState } from "../src/state";
import { api, post, loadCommunes, loadSnapshot } from "../src/live/api";
import type { Announcement, Commune, Snapshot } from "../src/live/model";

vi.mock("../src/live/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/live/api")>()),
  api: vi.fn(), post: vi.fn(), loadCommunes: vi.fn(), loadSnapshot: vi.fn(),
}));

const user = { id: "user-1", name: "Test Person", email: "test@example.test", emailVerified: true };
const notice: Announcement = {
  id: "notice-1", title: "Boiler service Thursday", body: "Please be in from 8.", authorId: "user-2",
  createdAt: "2026-10-06T09:00:00.000Z", needsAcknowledgement: true, acknowledgements: [],
};
let current: Snapshot;
let app: AppState;
function Capture() { app = useApp(); return null; }
function mount(role: "admin" | "member") {
  const commune: Commune = { id: "home-1", name: "Our home", kind: "household", currency: "GBP", role };
  current = {
    commune,
    members: [
      { userId: user.id, name: user.name, role, active: true },
      { userId: "user-2", name: "Housemate Two", role: "admin", active: true },
      { userId: "user-3", name: "Lodger Three", role: "member", active: true },
    ],
    expenses: [], funds: [], notes: [], operations: [], notifications: [], reminderTargets: [], sentReminders: [],
    recurringBills: [], splitTemplates: [], activityEvents: [], announcements: [structuredClone(notice)],
  };
  vi.mocked(loadCommunes).mockResolvedValue({ communes: [commune] });
  const location = memoryLocation({ path: "/hub", record: true });
  render(<Router hook={location.hook}><AppProvider><Capture /><App /></AppProvider></Router>);
}
const modalDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const originalScroll = Element.prototype.scrollIntoView;
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
});
afterAll(() => {
  Element.prototype.scrollIntoView = originalScroll;
  if (modalDescriptor) Object.defineProperty(HTMLDialogElement.prototype, "showModal", modalDescriptor);
  else delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).showModal;
});
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === "/auth/me") return { user };
    if (path === "/reminders/usage") return { totalUsed: 0, totalLimit: 60, recipientLimit: 8, recipientUsage: {}, nextSlotAt: null };
    if (path.endsWith("/invites")) return { invites: [] };
    return { ok: true };
  });
  vi.mocked(loadSnapshot).mockImplementation(async () => current);
});
afterEach(cleanup);

describe("announcements on This Hub", () => {
  it("asks a member to confirm an important notice, and records it as a command", async () => {
    vi.mocked(post).mockImplementation(async () => {
      current.announcements![0].acknowledgements.push({ userId: user.id, acknowledgedAt: new Date().toISOString() });
      return { id: notice.id, duplicate: false, archived: false };
    });
    mount("member");
    const section = await screen.findByRole("region", { name: "Announcements" });
    expect(within(section).getByText("Boiler service Thursday")).toBeTruthy();
    expect(within(section).getByText("Please be in from 8.")).toBeTruthy();
    expect(within(section).getByText("Seen by 0 of 2")).toBeTruthy();
    // It also counts as something that needs this member.
    const needs = screen.getByRole("region", { name: "Needs you" });
    expect(within(needs).getByText("1 item")).toBeTruthy();
    // A member cannot take down an admin's notice or post one.
    expect(within(section).queryByRole("button", { name: /^Take down/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Announce" })).toBeNull();
    await act(async () => { fireEvent.click(within(section).getByRole("button", { name: "I’ve seen this" })); });
    expect(vi.mocked(post)).toHaveBeenCalledWith("/announcements/notice-1/acknowledge", {});
    expect(within(section).getByText("You have seen this")).toBeTruthy();
    expect(within(section).getByText("Seen by 1 of 2")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Needs you" })).getByText("0 items")).toBeTruthy();
  });

  it("shows an admin who is still to confirm, and takes a notice down after asking", async () => {
    vi.mocked(post).mockImplementation(async () => {
      current.announcements = [];
      return { id: notice.id, duplicate: false, archived: true };
    });
    mount("admin");
    const section = await screen.findByRole("region", { name: "Announcements" });
    expect(within(section).getByText("Seen by 0 of 2. Waiting for Test, Lodger")).toBeTruthy();
    await act(async () => { fireEvent.click(within(section).getByRole("button", { name: "Take down Boiler service Thursday" })); });
    expect(vi.mocked(post)).not.toHaveBeenCalled();
    expect(within(section).getByText("Take it down? It stays in the activity history.")).toBeTruthy();
    await act(async () => { fireEvent.click(within(section).getByRole("button", { name: "Take down Boiler service Thursday" })); });
    expect(vi.mocked(post)).toHaveBeenCalledWith("/announcements/notice-1/archive", {});
    expect(screen.queryByRole("region", { name: "Announcements" })).toBeNull();
  });

  it("lets an admin post a notice with one request id across retries", async () => {
    let attempts = 0;
    vi.mocked(post).mockImplementation(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("Network failure");
      return { id: "notice-2", duplicate: false, archived: false };
    });
    mount("admin");
    await screen.findByRole("region", { name: "Announcements" });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Announce" })); });
    const dialog = await screen.findByRole("dialog", { name: "Post an announcement" });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Post announcement" })); });
    expect(within(dialog).getByText("Add a title before posting.")).toBeTruthy();
    expect(vi.mocked(post)).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText("Title"), { target: { value: " Window cleaner Friday " } });
    fireEvent.change(within(dialog).getByLabelText("Details"), { target: { value: "Close the windows." } });
    fireEvent.click(within(dialog).getByRole("checkbox"));
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Post announcement" })); });
    expect(within(dialog).getByRole("alert").textContent).toBe("Network failure");
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Post announcement" })); });
    const calls = vi.mocked(post).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0]).toBe("/communes/home-1/announcements");
    expect(calls[0][1]).toMatchObject({ title: "Window cleaner Friday", body: "Close the windows.", needsAcknowledgement: true });
    expect((calls[0][1] as { requestId: string }).requestId).toBe((calls[1][1] as { requestId: string }).requestId);
    expect(app.window).toBeNull();
  });
});
