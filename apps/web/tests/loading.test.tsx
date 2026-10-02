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
    expect(document.querySelector(".c-hub-cover")?.getAttribute("src")).toBe(HUBS.park.photo);
    expect(document.querySelector(".c-hub")?.textContent).not.toContain("↗");
    expect(within(screen.getByRole("region", { name: "Your balance" })).getByRole("button", { name: "Add expense" })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Your balance" })).getByRole("button", { name: "View settlement" })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Shared essentials" })).getByText(note.title)).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Commune identity" })).getByRole("button", { name: "View commune members" })).toBeTruthy();
    fireEvent.click(within(screen.getByRole("region", { name: "Pinned notes" })).getByRole("button", { name: /House essentials/ }));
    await screen.findByRole("complementary", { name: "House essentials" });
  });

  it("shows task saving and confirms completion only after a successful save", async () => {
    let task = { ...hubTask };
    const saved = deferred<void>();
    const baseApi = vi.mocked(api).getMockImplementation()!;
    vi.mocked(api).mockImplementation(async (path, options) => {
      if (path === "/operations/task-1") { await saved.promise; task = { ...task, ...JSON.parse(String(options?.body)) }; return { ok: true }; }
      return baseApi(path, options);
    });
    vi.mocked(loadSnapshot).mockImplementation(async () => ({ ...snapshot, operations: [task] }));
    mount();
    const check = await screen.findByRole("checkbox", { name: "Mark Take recycling out done" }) as HTMLInputElement;
    fireEvent.click(check);
    expect(check.checked).toBe(false);
    expect(check.disabled).toBe(true);
    await act(async () => saved.resolve());
    await waitFor(() => expect(screen.queryByRole("checkbox", { name: "Mark Take recycling out done" })).toBeNull());
    expect(within(screen.getByRole("region", { name: "This week" })).getByText("Nothing planned for this week.")).toBeTruthy();
    expect(task.status).toBe("done");
  });

  it("retains an open task and offers an actionable error when completion fails", async () => {
    const baseApi = vi.mocked(api).getMockImplementation()!;
    vi.mocked(api).mockImplementation(async (path, options) => {
      if (path === "/operations/task-1") throw new Error("Task could not be saved");
      return baseApi(path, options);
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
    const summary = await screen.findByLabelText("Reminder allowance: 0 of 60 used in the last 30 days");
    expect(summary.closest(".a-side-account")).not.toBeNull();
    expect(summary.textContent).toContain("60 reminders left");
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
    await screen.findByLabelText("Reminder allowance: 12 of 60 used in the last 30 days");
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
      saved = { ...(payload as typeof wifiNote), id: "contact-1" };
      return { id: "contact-1" };
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
    await screen.findByRole("button", { name: "Open House contacts" });
    fireEvent.change(screen.getByRole("combobox", { name: "Filter notes" }), { target: { value: "Contacts" } });
    fireEvent.click(screen.getByRole("button", { name: "Open House contacts" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit note" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit note" });
    expect((within(dialog).getByLabelText("Role or service") as HTMLInputElement).value).toBe("Landlord");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
    await screen.findByRole("complementary", { name: "House contacts" });
    expect(saved.pill).toBe("Contacts");
    expect(saved.facts).toEqual(expect.arrayContaining([["Phone", "020 0000 0000"], ["Email", "owner@example.com"], ["Role", "Landlord"], ["Office hours", "Weekdays"], ["This Hub", "Pinned"]]));
  });

  it("does not save an empty note or lose a draft after a failed save", async () => {
    vi.mocked(post).mockRejectedValue(new Error("Could not save. Try again."));
    mount("/notes");
    fireEvent.click(await screen.findByRole("button", { name: "Add note" }));
    const dialog = await screen.findByRole("dialog", { name: "Add note" });
    fireEvent.change(within(dialog).getByLabelText(/^Title/), { target: { value: "Useful detail" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save", exact: true }));
    expect(within(dialog).getByRole("alert").textContent).toBe("Add some details or a note before saving.");
    expect(post).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText(/^Note \(/), { target: { value: "Keep this draft" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save", exact: true }));
    await within(dialog).findByText("Could not save. Try again.");
    expect((within(dialog).getByLabelText(/^Note \(/) as HTMLTextAreaElement).value).toBe("Keep this draft");
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
    const opener = await screen.findByRole("button", { name: "Open Wi-Fi & internet" });
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
    await screen.findByRole("button", { name: "Open Wi-Fi & internet" });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search notes in this commune", exact: true }), { target: { value: "private-secret" } });
    expect(screen.getByRole("heading", { name: "No matching notes." })).toBeTruthy();
    expect(app.searchQuery).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Show all notes" }));
    expect(screen.getAllByRole("button", { name: "Open Wi-Fi & internet" })).toHaveLength(1);
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
    fireEvent.click(await screen.findByRole("button", { name: "Open Wi-Fi & internet" }));
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
    fireEvent.click(await screen.findByRole("button", { name: "Open Wi-Fi & internet" }));
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

  it("clears prior account data when the signed-in account changes", async () => {
    mount();
    await screen.findByRole("heading", { name: "Our home" });
    vi.mocked(api).mockImplementation(async (path) => path === "/auth/me"
      ? { user: { ...user, id: "different-user" } } : path.endsWith("/invites") ? { invites: [] } : null);
    const pending = deferred<Snapshot>();
    vi.mocked(loadSnapshot).mockReturnValue(pending.promise);
    let refresh!: Promise<void>;
    await act(async () => { refresh = app.refresh(); });
    expect(app.hub.members).toHaveLength(0);
    expect(app.contentLoading).toBe(true);
    await act(async () => { pending.resolve({ ...snapshot, members: [] }); await refresh; });
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
