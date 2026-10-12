import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "../src/App";
import { AppProvider, useApp, type AppState } from "../src/state";
import { api, post, loadCommunes, loadSnapshot, ApiError } from "../src/live/api";
import type { Commune, Snapshot } from "../src/live/model";
import { hubFromSnapshot } from "../src/live/model";
import { todayIso, type OperationItem } from "../src/data/operations";
import { HUBS } from "../src/data/household";
import { coverSource } from "../src/data/covers";
import { UNCERTAIN_RETRY_SAFE } from "../src/data/commands";

vi.mock("../src/live/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/live/api")>(),
  api: vi.fn(), post: vi.fn(), loadCommunes: vi.fn(), loadSnapshot: vi.fn(),
}));
const user = { id: "user-1", name: "Test Person", email: "test@example.com", emailVerified: true };
const commune: Commune = { id: "home-1", name: "Our home", kind: "household", currency: "GBP", role: "admin", address: "Test address" };
const snapshot: Snapshot = { commune, members: [{ userId: user.id, name: user.name, role: "admin" }], expenses: [], funds: [], notifications: [], reminderTargets: [] };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
let app: AppState;
function Capture() { app = useApp(); return null; }
function mount(path = "/hub") {
  const location = memoryLocation({ path, record: true });
  render(<Router hook={location.hook}><AppProvider><Capture /><App /></AppProvider></Router>);
  return location;
}
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === "/auth/me") return { user };
    if (path === "/reminders/usage") return { totalUsed: 0, totalLimit: 60, recipientLimit: 6, recipientUsage: {}, nextSlotAt: null };
    if (path.endsWith("/invites")) return { invites: [] };
    throw new Error(`Unexpected API request ${path}`);
  });
  vi.mocked(loadCommunes).mockResolvedValue({ communes: [commune] });
  vi.mocked(loadSnapshot).mockResolvedValue(snapshot);
});
afterEach(cleanup);

describe("commune loading", () => {
  it("recovers from one brief startup connection failure without showing the error page", async () => {
    vi.mocked(api).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    mount();
    await screen.findByRole("heading", { name: commune.name });
    expect(vi.mocked(api).mock.calls.filter(([path]) => path === "/auth/me")).toHaveLength(2);
    expect(screen.queryByRole("heading", { name: "We couldn’t connect" })).toBeNull();
    expect(post).not.toHaveBeenCalled();
  });

  it("bounds startup retries and hides raw errors and private content in the recovery page", async () => {
    vi.mocked(api).mockRejectedValue(new TypeError("Failed to fetch"));
    mount("/operations");
    await screen.findByRole("heading", { name: "We couldn’t connect" });
    expect(vi.mocked(api).mock.calls).toHaveLength(2);
    expect(screen.queryByText("Failed to fetch")).toBeNull();
    expect(screen.queryByText(commune.name)).toBeNull();
    expect(document.querySelector(".a-side")).toBeNull();
    const pending = deferred<{ user: typeof user }>();
    vi.mocked(api).mockImplementation(async (path) => path === "/auth/me" ? pending.promise : path.endsWith("/invites") ? { invites: [] } : null);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect((screen.getByRole("button", { name: "Reconnecting…" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => pending.resolve({ user }));
    await screen.findByRole("heading", { name: "Operations", exact: true });
    expect(post).not.toHaveBeenCalled();
  });

  it("does not retry access failures automatically", async () => {
    vi.mocked(api).mockRejectedValue(new ApiError("Access denied", 403));
    mount();
    await screen.findByRole("heading", { name: "We couldn’t connect" });
    expect(api).toHaveBeenCalledTimes(1);
  });

  it("retains loaded content with a useful notice when a later connection fails", async () => {
    mount();
    await screen.findByRole("heading", { name: commune.name });
    vi.mocked(api).mockRejectedValue(new TypeError("Failed to fetch"));
    await act(async () => app.refresh());
    expect(screen.getByRole("heading", { name: commune.name })).toBeTruthy();
    expect(screen.getByText("Connection interrupted. Your last loaded view is still available.")).toBeTruthy();
    expect(screen.queryByText("Failed to fetch")).toBeNull();
  });

  it("saves exact allocations through the real expense command without re-splitting them", async () => {
    vi.mocked(loadSnapshot).mockResolvedValue({ ...snapshot, members: [...snapshot.members, { userId: "user-2", name: "Housemate", role: "member" }] });
    vi.mocked(post).mockResolvedValue({ id: "saved-expense" });
    mount();
    await screen.findByRole("heading", { name: commune.name });
    fireEvent.click(screen.getByRole("button", { name: "Add expense", exact: true }));
    fireEvent.change(screen.getByLabelText("What was it for?"), { target: { value: "Groceries" } });
    fireEvent.change(screen.getByLabelText("Amount (GBP)"), { target: { value: "10.00" } });
    fireEvent.click(screen.getByRole("button", { name: "Exact", exact: true }));
    fireEvent.change(screen.getByLabelText("Test Person exact"), { target: { value: "4.25" } });
    fireEvent.change(screen.getByLabelText("Housemate exact"), { target: { value: "5.75" } });
    fireEvent.click(screen.getByRole("button", { name: "Save expense", exact: true }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/communes/home-1/expenses", expect.objectContaining({ amountMinor: 1000, shares: [{ userId: "user-1", amountMinor: 425 }, { userId: "user-2", amountMinor: 575 }] })));
  });

  it("does not submit an expense with invalid percentages", async () => {
    vi.mocked(loadSnapshot).mockResolvedValue(snapshot);
    mount();
    await screen.findByRole("heading", { name: commune.name });
    fireEvent.click(screen.getByRole("button", { name: "Add expense", exact: true }));
    fireEvent.change(screen.getByLabelText("What was it for?"), { target: { value: "Groceries" } });
    fireEvent.change(screen.getByLabelText("Amount (GBP)"), { target: { value: "10.00" } });
    fireEvent.click(screen.getByRole("button", { name: "Percentage", exact: true }));
    fireEvent.change(screen.getByLabelText("Test Person percentage"), { target: { value: "40" } });
    fireEvent.click(screen.getByRole("button", { name: "Save expense", exact: true }));
    expect(screen.getByRole("alert").textContent).toContain("100%");
    expect(post).not.toHaveBeenCalled();
  });

  const hubTask: OperationItem = { id: "task-1", hubId: commune.id, kind: "task", category: "chore", title: "Take recycling out", date: todayIso(), allDay: true, assignee: user.name, repeat: "none", status: "open", notes: "" };

  it("keeps saved notes and tasks available on a hub with no expenses", async () => {
    const note = { id: "info-1", title: "House essentials", pill: "Other", kicker: "Pinned · everyone", lede: "Quiet after ten", body: "Quiet after ten", facts: [] };
    vi.mocked(loadSnapshot).mockResolvedValue({ ...snapshot, notes: [note], operations: [hubTask] });
    mount();
    await screen.findByRole("heading", { name: commune.name });
    expect(screen.getByRole("region", { name: "Pinned notes" }).textContent).toContain(note.title);
    expect(screen.getByRole("checkbox", { name: "Mark Take recycling out done" })).toBeTruthy();
    expect(document.querySelector(".c-hub-cover")?.getAttribute("src")).toBe(coverSource({ type: "Household", photo: HUBS.park.photo }, "hero").src);
    expect(document.querySelector(".c-hub")?.textContent).not.toContain("↗");
    expect(within(screen.getByRole("region", { name: "Your balance" })).getByRole("button", { name: "Add expense" })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Your balance" })).getByRole("button", { name: "View settlement" })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Shared essentials" })).getByText(note.title)).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Commune identity" })).getByRole("button", { name: /^\d+ (people|person) in this commune, view members$/ })).toBeTruthy();
    fireEvent.click(within(screen.getByRole("region", { name: "Pinned notes" })).getByRole("button", { name: /House essentials/ }));
    await screen.findByRole("complementary", { name: "House essentials" });
  });

  it("shows task saving and confirms completion only after a successful save", async () => {
    let task = { ...hubTask };
    const saved = deferred<void>();
    vi.mocked(post).mockImplementation(async (path, body) => {
      if (path !== "/operations/task-1/occurrences") return { ok: true };
      // The browser sends a command; the server decides the resulting state.
      expect(body).toMatchObject({ action: "completed", expectedDate: hubTask.date, today: todayIso() });
      await saved.promise;
      task = { ...task, status: "done", undoOccurrenceId: "occurrence-1" };
      return { id: "occurrence-1", duplicate: false, date: task.date, assignee: task.assignee, status: "done" };
    });
    vi.mocked(loadSnapshot).mockImplementation(async () => ({ ...snapshot, operations: [task] }));
    mount();
    const check = await screen.findByRole("checkbox", { name: "Mark Take recycling out done" }) as HTMLInputElement;
    fireEvent.click(check);
    expect(check.checked).toBe(false);
    expect(check.disabled).toBe(true);
    await act(async () => saved.resolve());
    await waitFor(() => expect(screen.queryByRole("checkbox", { name: "Mark Take recycling out done" })).toBeNull());
    const week = within(screen.getByRole("region", { name: "This week" }));
    expect(week.getByText("Nothing planned for this week.")).toBeTruthy();
    expect(task.status).toBe("done");
    // The confirmation is visible and offers the way back.
    expect(week.getByRole("status").textContent).toContain("Take recycling out marked done.");
    vi.mocked(post).mockImplementation(async (path) => {
      expect(path).toBe("/occurrences/occurrence-1/undo");
      task = { ...hubTask };
      return { id: "occurrence-1", duplicate: false, date: task.date, assignee: task.assignee, status: "open" };
    });
    await act(async () => { fireEvent.click(week.getByRole("button", { name: "Undo" })); });
    expect(await screen.findByRole("checkbox", { name: "Mark Take recycling out done" })).toBeTruthy();
    expect(week.getByRole("status").textContent).toBe("Undone. The task is back as it was.");
  });

  it("retains an open task and offers an actionable error when completion fails", async () => {
    vi.mocked(post).mockImplementation(async (path) => {
      if (path === "/operations/task-1/occurrences") throw new Error("Task could not be saved");
      return { ok: true };
    });
    vi.mocked(loadSnapshot).mockResolvedValue({ ...snapshot, operations: [hubTask] });
    mount();
    const check = await screen.findByRole("checkbox", { name: "Mark Take recycling out done" }) as HTMLInputElement;
    fireEvent.click(check);
    await within(screen.getByRole("region", { name: "This week" })).findByText("Task could not be saved");
    expect(check.checked).toBe(false);
    expect(check.disabled).toBe(false);
  });

  it.each(["/funds", "/settle"])("keeps the overall reminder allowance in the sidebar instead of the %s toolbar", async (path) => {
    mount(path);
    // Named from what it shows, then the allowance in words.
    const summary = (await screen.findByText("60 reminders left")).closest("summary")!;
    expect(summary.closest(".a-side-account")).not.toBeNull();
    expect(summary.hasAttribute("aria-label")).toBe(false);
    expect(summary.textContent).toBe("60 reminders left (0 of 60 used in the last 30 days)");
    const metadata = summary.closest(".a-side-account-meta")!;
    expect(metadata.querySelector(".a-side-account-role")?.textContent).toBe("Admin");
    expect(metadata.querySelector(".a-side-account-separator")?.getAttribute("aria-hidden")).toBe("true");
    expect(metadata.textContent).toContain("Admin·60 reminders left");
    expect(summary.closest("details")?.parentElement).toBe(metadata);
    expect(summary.closest("button")).toBeNull();
    expect(summary.closest(".a-side-account")?.textContent).not.toContain(commune.name);
    expect(document.querySelector(`${path.replace("/", "#")} .a-reminder-usage`)).toBeNull();
    expect(document.querySelectorAll(".a-reminder-usage")).toHaveLength(1);
  });

  it("does not show a separator or an invented count while the reminder allowance is pending", async () => {
    const usage = deferred<{ totalUsed: number; totalLimit: number; recipientLimit: number; recipientUsage: Record<string, number>; nextSlotAt: null }>();
    const baseApi = vi.mocked(api).getMockImplementation()!;
    vi.mocked(api).mockImplementation(async (path, options) => path === "/reminders/usage" ? usage.promise : baseApi(path, options));
    mount();
    await screen.findByRole("heading", { name: commune.name });
    const metadata = document.querySelector(".a-side-account-meta")!;
    expect(metadata.textContent).toBe("Admin");
    expect(metadata.querySelector(".a-side-account-separator")).toBeNull();
    await act(async () => usage.resolve({ totalUsed: 12, totalLimit: 60, recipientLimit: 6, recipientUsage: {}, nextSlotAt: null }));
    expect((await screen.findByText("48 reminders left")).closest("summary")?.textContent).toContain("12 of 60 used in the last 30 days");
    expect(metadata.textContent).toContain("Admin·48 reminders left");
    expect(metadata.querySelectorAll(".a-side-account-separator")).toHaveLength(1);
  });

  it("offers the same allowance in account settings and closes its details with Escape", async () => {
    mount("/settings");
    await screen.findByRole("heading", { name: "Settings", exact: true });
    await waitFor(() => expect(document.querySelector(".a-reminder-usage--account")).not.toBeNull());
    const details = document.querySelector<HTMLDetailsElement>(".a-reminder-usage--account")!;
    expect(details.closest(".a-set-card")).not.toBeNull();
    expect(details.textContent).toContain("60 remaining");
    expect(details.textContent).toContain("last 30 days · all communes");
    details.open = true;
    fireEvent.keyDown(details.querySelector("summary")!, { key: "Escape" });
    expect(details.open).toBe(false);
    expect(document.activeElement).toBe(details.querySelector("summary"));
  });

  it("sends an invitation email and confirms it only after the server accepts it", async () => {
    const delivery = deferred<{ status: string }>();
    const inviteToken = "a".repeat(64);
    vi.mocked(post).mockImplementation(async (path) => path === "/invitation-email" ? delivery.promise : { token: inviteToken, url: `http://localhost:3000/invite?token=${inviteToken}` });
    mount("/members");
    fireEvent.click(await screen.findByRole("button", { name: "Invite", exact: true }));
    const dialog = await screen.findByRole("dialog", { name: "Invite" });
    fireEvent.change(within(dialog).getByLabelText("Email", { exact: true }), { target: { value: "friend@example.com" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send invitation" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/invitation-email", { token: inviteToken }));
    expect(within(dialog).queryByText(/Invitation email sent to/)).toBeNull();
    expect((within(dialog).getByRole("button", { name: "Sending…" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => delivery.resolve({ status: "sent" }));
    expect(within(dialog).getByRole("status").textContent).toContain("Invitation email sent to friend@example.com");
    expect(within(dialog).getByRole("button", { name: "Copy link" })).toBeTruthy();
  });

  it("retains an invitation link after email failure and retries without recreating it", async () => {
    const inviteToken = "b".repeat(64);
    let attempts = 0;
    vi.mocked(post).mockImplementation(async (path) => {
      if (path === "/invitation-email") { if (++attempts === 1) throw new Error("Email provider unavailable"); return { status: "sent" }; }
      return { token: inviteToken, url: `http://localhost:3000/invite?token=${inviteToken}` };
    });
    mount("/members");
    fireEvent.click(await screen.findByRole("button", { name: "Invite", exact: true }));
    const dialog = await screen.findByRole("dialog", { name: "Invite" });
    fireEvent.change(within(dialog).getByLabelText("Email", { exact: true }), { target: { value: "friend@example.com" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send invitation" }));
    await within(dialog).findByText("Email provider unavailable");
    expect((within(dialog).getByLabelText("Invitation link") as HTMLInputElement).value).toContain(inviteToken);
    fireEvent.click(within(dialog).getByRole("button", { name: "Retry email" }));
    await within(dialog).findByText(/Invitation email sent to/);
    expect(vi.mocked(post).mock.calls.filter(([path]) => path.endsWith("/invites"))).toHaveLength(1);
  });

  it("shows the email sender's refusal of a contact-like name and keeps the link to share", async () => {
    const inviteToken = "d".repeat(64);
    const refusal = "This invitation can't be emailed because a name in it looks like a link or phone number. Copy the link and share it yourself.";
    vi.mocked(post).mockImplementation(async (path) => {
      if (path === "/invitation-email") throw new ApiError(refusal, 422);
      return { token: inviteToken, url: `http://localhost:3000/invite?token=${inviteToken}` };
    });
    mount("/members");
    fireEvent.click(await screen.findByRole("button", { name: "Invite", exact: true }));
    const dialog = await screen.findByRole("dialog", { name: "Invite" });
    fireEvent.change(within(dialog).getByLabelText("Email", { exact: true }), { target: { value: "friend@example.com" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send invitation" }));
    expect((await within(dialog).findByRole("alert")).textContent).toBe(refusal);
    expect((within(dialog).getByLabelText("Invitation link") as HTMLInputElement).value).toContain(inviteToken);
    expect(within(dialog).queryByText(/Invitation email sent to/)).toBeNull();
  });

  it("keeps link-only invitations as an explicit alternative without sending email", async () => {
    const inviteToken = "c".repeat(64);
    vi.mocked(post).mockResolvedValue({ token: inviteToken, url: `http://localhost:3000/invite?token=${inviteToken}` });
    mount("/members");
    fireEvent.click(await screen.findByRole("button", { name: "Invite", exact: true }));
    const dialog = await screen.findByRole("dialog", { name: "Invite" });
    fireEvent.change(within(dialog).getByLabelText("Email", { exact: true }), { target: { value: "friend@example.com" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create link only" }));
    await within(dialog).findByLabelText("Invitation link");
    expect(post).toHaveBeenCalledTimes(1);
    expect(within(dialog).queryByText(/Invitation email sent to/)).toBeNull();
    expect(within(dialog).getByRole("button", { name: "Send invitation" })).toBeTruthy();
  });
  const wifiNote = { id: "note-1", title: "Wi-Fi & internet", pill: "Wi-Fi", kicker: "Pinned · everyone", lede: "private-secret", body: "Connect upstairs. Password: private-secret", facts: [["Network", "Test network"], ["Password", "private-secret"], ["This Hub", "Pinned"]] as Array<[string, string]> };

  it("keeps credentials out of hub pinned cards and essentials previews", async () => {
    const unpinnedWifi = { ...wifiNote, id: "note-2", title: "Guest network", kicker: "Everyone", facts: wifiNote.facts.filter(([key]) => key !== "This Hub") };
    vi.mocked(loadSnapshot).mockResolvedValue({ ...snapshot, notes: [wifiNote, unpinnedWifi] });
    mount();
    await screen.findByRole("heading", { name: commune.name });
    expect(screen.getByRole("region", { name: "Pinned notes" }).textContent).toContain("Network and password. Open to view connection details.");
    expect(screen.getByRole("region", { name: "Shared essentials" }).textContent).toContain("Guest network");
    expect(document.body.textContent).not.toContain("private-secret");
  });

  it("restores default covers while preserving uploads and the activity owner's identity", () => {
    const other = { userId: "other", name: "Other Person", role: "member" as const };
    const expense = { id: "expense-1", title: "Groceries", amountMinor: 2000, paidByUserId: other.userId, dueOn: null, shares: [] };
    const data = { ...snapshot, members: [...snapshot.members, other], expenses: [expense] };
    const hub = hubFromSnapshot(data, user);
    expect(hub.photo).toBe(HUBS.park.photo);
    expect(hubFromSnapshot({ ...data, commune: { ...commune, kind: "workspace" } }, user).photo).toBe(HUBS.studio.photo);
    expect(hubFromSnapshot({ ...data, commune: { ...commune, kind: "trip" } }, user).photo).toBe(HUBS.lisbon.photo);
    expect(hubFromSnapshot(data, user, "data:image/png;base64,test").photo).toBe("data:image/png;base64,test");
    expect(hub.activity[0].cls).toBe(hub.members[1].cls);
    expect(hub.activity[0].cls).not.toBe("maya");
  });

  it("creates a contact with a custom role and no forced body text", async () => {
    let saved: typeof wifiNote | undefined;
    vi.mocked(loadSnapshot).mockImplementation(async () => ({ ...snapshot, notes: saved ? [saved] : [] }));
    vi.mocked(post).mockImplementation(async (path, payload) => {
      expect(path).toBe("/communes/home-1/notes");
      expect((payload as { requestId: string }).requestId).toMatch(/^[0-9a-f-]{36}$/);
      saved = { ...(payload as typeof wifiNote), id: "contact-1" };
      return { id: "contact-1", version: 1, duplicate: false };
    });
    mount("/notes");
    fireEvent.click(await screen.findByRole("button", { name: "Add note" }));
    const dialog = await screen.findByRole("dialog", { name: "Add note" });
    fireEvent.change(within(dialog).getByLabelText("Type", { exact: true }), { target: { value: "contacts" } });
    fireEvent.change(within(dialog).getByLabelText(/^Title/), { target: { value: "Repairs" } });
    fireEvent.change(within(dialog).getByLabelText("Person or business"), { target: { value: "Alex Repairs" } });
    fireEvent.change(within(dialog).getByLabelText("Role or service"), { target: { value: "Plumber" } });
    fireEvent.change(within(dialog).getByLabelText("Email", { exact: true }), { target: { value: "alex@example.com" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save", exact: true }));
    await screen.findByRole("complementary", { name: "Repairs" });
    expect(saved?.pill).toBe("Contacts");
    expect(saved?.body).toBe("");
    expect(saved?.facts).toEqual(expect.arrayContaining([["Contact name", "Alex Repairs"], ["Role", "Plumber"], ["Email", "alex@example.com"]]));
    expect(saved?.facts.flat()).not.toContain("Landlord");
  });

  it("includes legacy landlord notes in Contacts and preserves their details on edit", async () => {
    let saved = { ...wifiNote, title: "House contacts", pill: "Landlord", body: "Call for repairs", facts: [["Phone", "020 0000 0000"], ["Email", "owner@example.com"], ["Office hours", "Weekdays"], ["This Hub", "Pinned"]] as Array<[string, string]> };
    vi.mocked(loadSnapshot).mockImplementation(async () => ({ ...snapshot, notes: [saved] }));
    vi.mocked(api).mockImplementation(async (path, options) => {
      if (path === "/auth/me") return { user };
      if (path === "/notes/note-1" && options?.method === "PUT") { saved = { ...JSON.parse(String(options.body)), id: "note-1" }; return { ok: true }; }
      return { invites: [] };
    });
    mount("/notes");
    await screen.findByRole("button", { name: /^House contacts/ });
    fireEvent.change(screen.getByRole("combobox", { name: "Filter notes" }), { target: { value: "Contacts" } });
    fireEvent.click(screen.getByRole("button", { name: /^House contacts/ }));
    fireEvent.click(screen.getByRole("button", { name: "Edit note" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit note" });
    expect((within(dialog).getByLabelText("Role or service") as HTMLInputElement).value).toBe("Landlord");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
    await screen.findByRole("complementary", { name: "House contacts" });
    expect(saved.pill).toBe("Contacts");
    expect(saved.facts).toEqual(expect.arrayContaining([["Phone", "020 0000 0000"], ["Email", "owner@example.com"], ["Role", "Landlord"], ["Office hours", "Weekdays"], ["This Hub", "Pinned"]]));
  });

  it("refuses to overwrite someone else's newer save, keeps the draft, and can save on top", async () => {
    const members = [...snapshot.members, { userId: "user-2", name: "Blake", role: "member" as const }];
    let current = { ...wifiNote, title: "House rules", pill: "House rules", body: "Quiet after 11", facts: [] as Array<[string, string]>, version: 2, updatedBy: user.id, updatedAt: "2026-10-05T09:00:00Z", revisions: [] };
    vi.mocked(loadSnapshot).mockImplementation(async () => ({ ...snapshot, members, notes: [current] }));
    const puts: Array<Record<string, unknown>> = [];
    vi.mocked(api).mockImplementation(async (path, options) => {
      if (path === "/auth/me") return { user };
      if (path === "/notes/note-1" && options?.method === "PUT") {
        const body = JSON.parse(String(options.body));
        puts.push(body);
        if (body.expectedVersion !== current.version) throw new ApiError("This note was changed by someone else. Review the latest version before saving your changes.", 409);
        current = { ...current, ...body, version: current.version + 1 };
        return { ok: true, version: current.version };
      }
      return { invites: [] };
    });
    mount("/notes");
    fireEvent.click(await screen.findByRole("button", { name: /^House rules/ }));
    fireEvent.click(screen.getByRole("button", { name: "Edit note" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit note" });
    // Blake saves while this edit is open.
    current = { ...current, body: "Quiet after 10", version: 3, updatedBy: "user-2", updatedAt: "2026-10-05T10:15:00Z" };
    fireEvent.change(within(dialog).getByLabelText(/^Note \(/), { target: { value: "Quiet after midnight" } });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" })); });
    expect(puts[0].expectedVersion).toBe(2);
    const conflict = await within(dialog).findByRole("alert");
    expect(conflict.textContent).toContain("Blake saved a newer version");
    expect(conflict.textContent).toContain("Your text is still in this form, unsaved.");
    expect((within(dialog).getByLabelText(/^Note \(/) as HTMLTextAreaElement).value).toBe("Quiet after midnight");
    expect(current.body).toBe("Quiet after 10");
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save mine over theirs" })); });
    expect(puts[1].expectedVersion).toBe(3);
    await screen.findByRole("complementary", { name: "House rules" });
    expect([current.version, current.body]).toEqual([4, "Quiet after midnight"]);
  });

  it("shows a note's earlier versions and restores one as the newest", async () => {
    let current = { ...wifiNote, title: "House rules", pill: "House rules", body: "Quiet after 10", facts: [] as Array<[string, string]>, version: 3, updatedBy: user.id, updatedAt: "2026-10-05T10:15:00Z",
      revisions: [{ id: "rev-2", version: 2, title: "House rules", editedBy: user.id, editedAt: "2026-10-04T09:00:00Z", replacedBy: user.id, replacedAt: "2026-10-05T10:15:00Z" }] };
    vi.mocked(loadSnapshot).mockImplementation(async () => ({ ...snapshot, notes: [current] }));
    const puts: Array<Record<string, unknown>> = [];
    vi.mocked(api).mockImplementation(async (path, options) => {
      if (path === "/auth/me") return { user };
      if (path === "/notes/note-1/revisions/rev-2") return { revision: { id: "rev-2", version: 2, title: "House rules", pill: "House rules", kicker: "Everyone", lede: "Quiet after 11", body: "Quiet after 11. Door code old-secret", facts: [["Door code", "old-secret"]], editedBy: user.id, editedAt: "2026-10-04T09:00:00Z" } };
      if (path === "/notes/note-1" && options?.method === "PUT") { const body = JSON.parse(String(options.body)); puts.push(body); current = { ...current, ...body, version: 4 }; return { ok: true, version: 4 }; }
      return { invites: [] };
    });
    mount("/notes");
    fireEvent.click(await screen.findByRole("button", { name: /^House rules/ }));
    const history = (await screen.findByText(/Version 3 · saved by Test Person · 1 earlier version/)).closest("details")!;
    await act(async () => { fireEvent.click(within(history).getByRole("button", { name: "View" })); });
    const opened = within(history).getByLabelText("Version 2");
    expect(opened.textContent).toContain("Quiet after 11");
    // An earlier code or password is masked here as it is on the board.
    expect(opened.textContent).not.toContain("old-secret");
    await act(async () => { fireEvent.click(within(opened).getByRole("button", { name: "Restore version 2" })); });
    // Restoring brings back the real content, not the masked display.
    expect(puts[0]).toMatchObject({ expectedVersion: 3, body: "Quiet after 11. Door code old-secret", facts: [["Door code", "old-secret"]] });
    expect(within(history).getByRole("status").textContent).toBe("Version 2 restored as the newest version. Nothing was deleted.");
  });

  it("does not save an empty note or lose a draft after a failed save, and retries as the same add", async () => {
    vi.mocked(post).mockRejectedValue(new TypeError("Failed to fetch"));
    mount("/notes");
    fireEvent.click(await screen.findByRole("button", { name: "Add note" }));
    const dialog = await screen.findByRole("dialog", { name: "Add note" });
    fireEvent.change(within(dialog).getByLabelText(/^Title/), { target: { value: "Useful detail" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save", exact: true }));
    expect(within(dialog).getByRole("alert").textContent).toBe("Add some details or a note before saving.");
    expect(post).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText(/^Note \(/), { target: { value: "Keep this draft" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save", exact: true }));
    // The outcome is unknown, so the retry must be recognisable as the same add.
    await within(dialog).findByText(UNCERTAIN_RETRY_SAFE);
    expect((within(dialog).getByLabelText(/^Note \(/) as HTMLTextAreaElement).value).toBe("Keep this draft");
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save", exact: true })); });
    const ids = vi.mocked(post).mock.calls.map(([, body]) => (body as { requestId: string }).requestId);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(ids[1]).toBe(ids[0]);
  });

  it("shows why a new note was refused instead of offering to overwrite anything", async () => {
    vi.mocked(post).mockRejectedValue(new ApiError("This commune already has 500 notes. Remove one you no longer need first.", 409));
    mount("/notes");
    fireEvent.click(await screen.findByRole("button", { name: "Add note" }));
    const dialog = await screen.findByRole("dialog", { name: "Add note" });
    fireEvent.change(within(dialog).getByLabelText(/^Title/), { target: { value: "Spare key" } });
    fireEvent.change(within(dialog).getByLabelText(/^Note \(/), { target: { value: "Under the plant pot" } });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Save", exact: true })); });
    expect(within(dialog).getByRole("alert").textContent).toBe("This commune already has 500 notes. Remove one you no longer need first.");
    expect(within(dialog).queryByRole("button", { name: "Save mine over theirs" })).toBeNull();
  });

  it("keeps sensitive note previews off the Hub as well as the notes board", () => {
    const hub = hubFromSnapshot({ ...snapshot, notes: [wifiNote] }, user);
    expect(hub.notes[0].when).toBe("Network and password. Open to view connection details.");
    expect(JSON.stringify(hub.notes)).not.toContain("private-secret");
  });

  it("opens an inline reader, masks secrets, copies and returns to its card", async () => {
    vi.mocked(loadSnapshot).mockResolvedValue({ ...snapshot, notes: [wifiNote] });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    mount("/notes");
    const opener = await screen.findByRole("button", { name: /^Wi-Fi & internet/ });
    expect(document.body.textContent).not.toContain("private-secret");
    opener.focus(); fireEvent.click(opener);
    const reader = screen.getByRole("complementary", { name: "Wi-Fi & internet" });
    expect(screen.queryByRole("dialog", { name: "Wi-Fi & internet" })).toBeNull();
    expect(document.querySelector(".a-app")?.hasAttribute("inert")).toBe(false);
    expect(document.activeElement).toBe(reader);
    expect(document.body.textContent).not.toContain("private-secret");
    fireEvent.click(within(reader).getByRole("button", { name: "Reveal password" }));
    expect(within(reader).getByText("private-secret", { exact: true })).toBeTruthy();
    fireEvent.click(within(reader).getByRole("button", { name: "Hide password" }));
    fireEvent.click(within(reader).getByRole("button", { name: "Copy password" }));
    await screen.findByText("Password copied.");
    expect(writeText).toHaveBeenCalledWith("private-secret");
    fireEvent.keyDown(reader, { key: "Escape" });
    expect(document.activeElement).toBe(opener);
    fireEvent.click(opener);
    expect(document.body.textContent).not.toContain("private-secret");
  });

  it("filters notes without searching private content or changing expense search", async () => {
    vi.mocked(loadSnapshot).mockResolvedValue({ ...snapshot, notes: [wifiNote] });
    mount("/notes");
    await screen.findByRole("button", { name: /^Wi-Fi & internet/ });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search notes in this commune", exact: true }), { target: { value: "private-secret" } });
    expect(screen.getByRole("heading", { name: "No matching notes." })).toBeTruthy();
    expect(app.searchQuery).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Show all notes" }));
    expect(screen.getAllByRole("button", { name: /^Wi-Fi & internet/ })).toHaveLength(1);
  });

  it("shows a dismissible error rather than a blank mobile reader when a note disappears", async () => {
    mount("/notes");
    await screen.findByRole("button", { name: "Add note" });
    await act(async () => app.go("note", { note: "removed-note" }));
    expect(screen.getByRole("dialog", { name: "Note" })).toBeTruthy();
    expect(screen.getByText("That note isn’t here.")).toBeTruthy();
    expect(document.querySelector(".has-note-reader")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Close", exact: true }));
    expect(screen.queryByRole("dialog", { name: "Note" })).toBeNull();
  });

  it("persists unpin and edits through the existing note endpoint", async () => {
    let saved = { ...wifiNote };
    vi.mocked(loadSnapshot).mockImplementation(async () => ({ ...snapshot, notes: [saved] }));
    const originalApi = vi.mocked(api).getMockImplementation()!;
    vi.mocked(api).mockImplementation(async (path, options) => {
      if (path === "/notes/note-1" && options?.method === "PUT") { saved = { ...JSON.parse(String(options.body)), id: "note-1" }; return { ok: true }; }
      return originalApi(path, options);
    });
    mount("/notes");
    fireEvent.click(await screen.findByRole("button", { name: /^Wi-Fi & internet/ }));
    fireEvent.click(screen.getByRole("button", { name: "Unpin", exact: true }));
    await screen.findByText("Note unpinned.");
    expect(saved.facts.some(([key]) => key === "This Hub")).toBe(false);
    expect(saved.body).toBe(wifiNote.body);
    fireEvent.click(screen.getByRole("button", { name: "Edit note" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit note" });
    const title = within(dialog).getByLabelText(/Title/);
    expect((title as HTMLInputElement).value).toBe(wifiNote.title);
    expect((within(dialog).getByLabelText("Password", { exact: true }) as HTMLInputElement).value).toBe("private-secret");
    fireEvent.change(title, { target: { value: "Internet details" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
    await screen.findByRole("complementary", { name: "Internet details" });
    expect(saved.title).toBe("Internet details");
    expect(saved.facts).toContainEqual(["Password", "private-secret"]);
  });

  it("keeps the saved pin state when saving fails and reports clipboard failure", async () => {
    vi.mocked(loadSnapshot).mockResolvedValue({ ...snapshot, notes: [wifiNote] });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("Denied")) } });
    mount("/notes");
    fireEvent.click(await screen.findByRole("button", { name: /^Wi-Fi & internet/ }));
    fireEvent.click(screen.getByRole("button", { name: "Copy network" }));
    await screen.findByText("Could not copy. Select and copy the text instead.");
    fireEvent.click(screen.getByRole("button", { name: "Unpin", exact: true }));
    await screen.findByRole("button", { name: "Unpin", exact: true });
    await waitFor(() => expect(screen.getByRole("button", { name: "Unpin", exact: true }).hasAttribute("disabled")).toBe(false));
    expect(screen.getByText("Pinned on the notes board")).toBeTruthy();
    expect(screen.queryByText("Note unpinned.")).toBeNull();
  });

  it("keeps page context and keyboard focus inside a note dialog", async () => {
    mount("/notes");
    const opener = await screen.findByRole("button", { name: "Add note" });
    opener.focus();
    fireEvent.click(opener);
    const dialog = await screen.findByRole("dialog", { name: "Add note" });
    expect(app.pageTitle).toBe("Notes");
    expect(app.pageLede).toBe("Shared details, easy to find.");
    expect(document.activeElement).toBe(dialog);
    expect(document.querySelector(".a-app")?.hasAttribute("inert")).toBe(true);
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Close" }));
    fireEvent.keyDown(document.activeElement!, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Save", exact: true }));
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Add note" })).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(document.querySelector(".a-app")?.hasAttribute("inert")).toBe(false);
  });

  it("distinguishes an empty pinned filter from an empty notebook", async () => {
    mount("/notes");
    await screen.findByRole("button", { name: "Add note" });
    fireEvent.change(screen.getByRole("combobox", { name: "Filter notes" }), { target: { value: "Pinned" } });
    expect(screen.getByRole("heading", { name: "No pinned notes." })).toBeTruthy();
    expect((screen.getByRole("combobox", { name: "Filter notes" }) as HTMLSelectElement).value).toBe("Pinned");
    fireEvent.click(screen.getByRole("button", { name: "Show all notes" }));
    expect(screen.getByRole("heading", { name: "No notes yet." })).toBeTruthy();
    expect(screen.getByRole("searchbox", { name: "Search notes in this commune", exact: true })).toBeTruthy();
    expect(within(screen.getByRole("navigation", { name: "Primary" })).getAllByRole("button", { name: "Notes", exact: true }).every((button) => button.getAttribute("aria-current") === "page")).toBe(true);
  });

  it("loads only the selected commune on a product page, then loads another on selection", async () => {
    const other = { ...commune, id: "home-2", name: "Second home" };
    vi.mocked(loadCommunes).mockResolvedValue({ communes: [commune, other] });
    vi.mocked(loadSnapshot).mockImplementation(async (item) => ({ ...snapshot, commune: item }));
    mount();
    await screen.findByRole("heading", { name: "Our home" });
    expect(loadSnapshot).toHaveBeenCalledTimes(1);
    expect(loadSnapshot).toHaveBeenCalledWith(commune);
    await act(async () => app.go("hub", { hub: other.id }));
    await screen.findByRole("heading", { name: "Second home" });
    expect(loadSnapshot).toHaveBeenCalledTimes(2);
    await act(async () => app.go("hub", { hub: commune.id }));
    await screen.findByRole("heading", { name: "Our home" });
    expect(loadSnapshot).toHaveBeenCalledTimes(2);
  });

  it("shows commune identities on home without waiting for all their activity", async () => {
    const other = { ...commune, id: "home-2", name: "Second home" };
    const pending = deferred<Snapshot>();
    vi.mocked(loadCommunes).mockResolvedValue({ communes: [commune, other] });
    vi.mocked(loadSnapshot).mockImplementation((item) => item.id === commune.id
      ? Promise.resolve(snapshot) : pending.promise);
    mount("/");
    await screen.findByRole("heading", { name: "Our home" });
    expect(screen.getByRole("heading", { name: "Second home" })).toBeTruthy();
    expect(screen.queryByText("Nothing waiting right now.")).toBeNull();
    await act(async () => pending.reject(new Error("Not a commune member")));
    expect(screen.getByRole("heading", { name: "Our home" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Could not load Our home" })).toBeNull();
    expect(screen.getByText("Activity unavailable · Open to retry")).toBeTruthy();
  });

  it("does not mistake a failed invitation read for a failed active commune", async () => {
    const pending = deferred<Snapshot>();
    vi.mocked(loadSnapshot).mockReturnValue(pending.promise);
    vi.mocked(api).mockImplementation(async (path) => {
      if (path === "/auth/me") return { user };
      if (path === "/reminders/usage") return null;
      throw new Error("Invitations unavailable");
    });
    mount();
    await screen.findByText("Invitations unavailable");
    expect(screen.getByRole("status", { name: "Loading shared records" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Could not load your commune" })).toBeNull();
    await act(async () => pending.resolve(snapshot));
  });

  it("shows the known commune while activity loads, without an empty ledger", async () => {
    const pending = deferred<Snapshot>();
    vi.mocked(loadSnapshot).mockReturnValue(pending.promise);
    mount();
    await screen.findByRole("status", { name: "Loading shared records" });
    expect(app.session?.hasHubs).toBe(true);
    expect(app.hub.name).toBe("Our home");
    expect(screen.queryByText("No expenses yet. Add the first one to start the shared ledger.")).toBeNull();
    await act(async () => pending.resolve(snapshot));
    await screen.findByRole("heading", { name: "Our home" });
    expect(app.contentLoading).toBe(false);
    expect(vi.mocked(api).mock.calls.filter(([path]) => path === "/auth/me")).toHaveLength(1);
    expect(loadCommunes).toHaveBeenCalledTimes(1);
    expect(loadSnapshot).toHaveBeenCalledTimes(1);
  });

  it("does not make the hub wait for reminder counts or invitations", async () => {
    const pending = deferred<never>();
    vi.mocked(api).mockImplementation(async (path) => path === "/auth/me" ? { user } : pending.promise);
    mount();
    await screen.findByRole("heading", { name: "Our home" });
    expect(app.contentLoading).toBe(false);
    expect(app.reminderUsage).toBeNull();
  });

  it("keeps the reminder counter when invitations fail", async () => {
    vi.mocked(api).mockImplementation(async (path) => {
      if (path === "/auth/me") return { user };
      if (path === "/reminders/usage") return { totalUsed: 12, totalLimit: 60, recipientLimit: 8, recipientUsage: {}, nextSlotAt: null };
      throw new Error("Invitations unavailable");
    });
    mount();
    await screen.findByRole("heading", { name: "Our home" });
    await waitFor(() => expect(app.reminderUsage?.totalUsed).toBe(12));
  });

  it("publishes a created commune after the save, without a full refresh", async () => {
    vi.mocked(loadCommunes).mockResolvedValue({ communes: [] });
    const location = mount("/onboard");
    await screen.findByRole("heading", { name: "Name your commune." });
    vi.mocked(post).mockResolvedValue({ id: "new-home" });
    await act(async () => {
      await app.createHub({ name: "New home", type: "Household", currency: "£ GBP", address: "42 Test Road" });
    });
    await screen.findByRole("heading", { name: "New home" });
    expect(screen.getByText("42 Test Road")).toBeTruthy();
    expect(location.history?.at(-1)).toBe("/hub");
    expect(app.hub.members[0].userId).toBe(user.id);
    expect(loadCommunes).toHaveBeenCalledTimes(1);
    expect(loadSnapshot).not.toHaveBeenCalled();
  });

  it("keeps existing content visible during refresh", async () => {
    mount();
    await screen.findByRole("heading", { name: "Our home" });
    const pending = deferred<Snapshot>();
    vi.mocked(loadSnapshot).mockReturnValue(pending.promise);
    let refresh!: Promise<void>;
    await act(async () => { refresh = app.refresh(); });
    expect(app.contentLoading).toBe(false);
    expect(screen.getByRole("heading", { name: "Our home" })).toBeTruthy();
    await act(async () => { pending.resolve(snapshot); await refresh; });
  });

  it("clears cached private activity if a refresh rejects membership", async () => {
    mount();
    await screen.findByRole("heading", { name: "Our home" });
    vi.mocked(loadSnapshot).mockRejectedValue(new ApiError("Not a commune member", 403));
    await act(async () => app.refresh());
    await screen.findByRole("heading", { name: "Could not load Our home" });
    expect(app.contentLoading).toBe(true);
    expect(app.hub.members).toHaveLength(0);
  });

  it("does not overwrite the current commune when an older selection completes", async () => {
    const other = { ...commune, id: "home-2", name: "Second home" };
    const pending = deferred<Snapshot>();
    vi.mocked(loadCommunes).mockResolvedValue({ communes: [commune, other] });
    vi.mocked(loadSnapshot).mockImplementation((item) => item.id === commune.id
      ? pending.promise : Promise.resolve({ ...snapshot, commune: other }));
    mount();
    await screen.findByRole("status", { name: "Loading shared records" });
    await act(async () => app.go("hub", { hub: other.id }));
    await screen.findByRole("heading", { name: "Second home" });
    await act(async () => pending.resolve(snapshot));
    expect(app.hub.name).toBe("Second home");
    expect(loadSnapshot).toHaveBeenCalledTimes(2);
  });

  it("clears prior account data and asks for a sign-in when the signed-in account changes", async () => {
    mount();
    await screen.findByRole("heading", { name: "Our home" });
    vi.mocked(api).mockImplementation(async (path) => path === "/auth/me"
      ? { user: { ...user, id: "different-user" } } : path.endsWith("/invites") ? { invites: [] } : null);
    vi.mocked(loadSnapshot).mockClear();
    await act(async () => { await app.refresh(); });
    expect(app.hub.members).toHaveLength(0);
    expect(app.session).toBeNull();
    expect(app.sessionNotice).toBe("You were signed out. Sign in to carry on.");
    // Nothing of the other account loads without a sign-in in this tab.
    expect(loadSnapshot).not.toHaveBeenCalled();
    await screen.findByRole("heading", { name: "Welcome back" });
  });

  it("ignores an older refresh that finishes after a commune is created", async () => {
    mount();
    await screen.findByRole("heading", { name: "Our home" });
    const pending = deferred<{ communes: Commune[] }>();
    vi.mocked(loadCommunes).mockReturnValue(pending.promise);
    let refresh!: Promise<void>;
    await act(async () => { refresh = app.refresh(); });
    vi.mocked(post).mockResolvedValue({ id: "new-home" });
    await act(async () => { await app.createHub({ name: "New home", type: "Household", currency: "£ GBP" }); });
    await act(async () => { pending.resolve({ communes: [commune] }); await refresh; });
    expect(app.places.map((place) => place.id)).toContain("new-home");
    expect(app.hub.id).toBe("new-home");
  });

  it("does not display a commune when the save fails", async () => {
    vi.mocked(loadCommunes).mockResolvedValue({ communes: [] });
    mount("/onboard");
    await screen.findByRole("heading", { name: "Name your commune." });
    vi.mocked(post).mockRejectedValue(new Error("Save failed"));
    await act(async () => {
      await expect(app.createHub({ name: "Unsaved home", type: "Household", currency: "£ GBP" })).rejects.toThrow("Save failed");
    });
    expect(app.places).toHaveLength(0);
    expect(app.session?.hasHubs).toBe(false);
  });

  it("offers retry instead of showing an empty commune after a failed load", async () => {
    vi.mocked(loadSnapshot).mockRejectedValue(new Error("Network unavailable"));
    mount();
    await screen.findByRole("heading", { name: "Could not load Our home" });
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryByText("No expenses yet. Add the first one to start the shared ledger.")).toBeNull();
  });

  it("redirects bookmarked empty-state URLs to the canonical hub", async () => {
    const location = mount("/hub-empty");
    await screen.findByRole("heading", { name: "Our home" });
    await waitFor(() => expect(location.history?.at(-1)).toBe("/hub"));
  });

  it("offers commune creation at /hub when membership is genuinely empty", async () => {
    vi.mocked(loadCommunes).mockResolvedValue({ communes: [] });
    mount();
    await screen.findByRole("heading", { name: "No communes yet." });
    expect(screen.queryByRole("button", { name: "Add expense" })).toBeNull();
  });
});
