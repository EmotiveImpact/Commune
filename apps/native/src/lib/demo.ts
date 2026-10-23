import { addDays, requestId as newId, todayIso } from "./format";
import type { Backend } from "./backend";
import { ApiError } from "./backend";
import { parsePayLinks, type PayLink, type PayLinkInput, type PayProvider } from "./payLinks";
import type { Commune, Expense, Operation, PaymentReport, ReminderTarget, Share, Snapshot, User } from "./types";

/**
 * Maya's three communes from the approved phone prototype, kept on the phone.
 * Nothing leaves the device. Used when no server is configured, so the app
 * can be tried and reviewed without an account.
 */
const MAYA: User = { id: "demo-maya", name: "Maya Chen", email: "maya@example.com", emailVerified: true };
const PEOPLE = {
  maya: { userId: MAYA.id, name: "Maya Chen" },
  jordan: { userId: "demo-jordan", name: "Jordan Hale" },
  alex: { userId: "demo-alex", name: "Alex Rivera" },
  sam: { userId: "demo-sam", name: "Sam Okafor" },
};
type Person = keyof typeof PEOPLE;
const id = (p: Person) => PEOPLE[p].userId;

function demoData(today: string): Snapshot[] {
  const at = (days: number, time = "09:00:00") => `${addDays(today, days)}T${time}Z`;
  const report = (by: Person, amountMinor: number, days: number): PaymentReport => ({
    id: `rep-${by}-${amountMinor}`, reportedBy: id(by), amountMinor, sentOn: addDays(today, days), reference: null,
    reportedAt: at(days, "09:12:00"), status: "pending", resolvedAt: null, resolvedBy: null, note: null, receiptId: null,
  });
  let n = 0;
  const expense = (title: string, category: string, payer: Person, amountMinor: number, due: number | null, created: number,
    people: Person[], settled: Partial<Record<Person, number | "all">> = {}, reports: Partial<Record<Person, PaymentReport>> = {}): Expense => {
    n += 1;
    const each = Math.floor(amountMinor / people.length);
    const spare = amountMinor - each * people.length;
    return {
      id: `exp-${n}`, title, category, amountMinor, paidByUserId: id(payer), dueOn: due === null ? null : addDays(today, due),
      createdAt: at(created), version: 1, voidedAt: null,
      shares: people.map((p, index): Share => {
        const amount = each + (index < spare ? 1 : 0);
        const done = p === payer || settled[p] === "all" ? amount : settled[p] ?? 0;
        return { id: `share-${n}-${p}`, userId: id(p), amountMinor: amount, settledMinor: done, paymentReports: reports[p] ? [reports[p]!] : [] };
      }),
    };
  };
  const members = (people: Person[], admin: Person) => people.map((p) => ({ ...PEOPLE[p], role: p === admin ? "admin" as const : "member" as const, active: true }));
  const op = (opId: string, title: string, days: number, assignee: Person | null, rota: Person[], repeat: Operation["repeat"] = "weekly"): Operation => ({
    id: opId, kind: "task", title, date: addDays(today, days), allDay: true, assigneeId: assignee ? id(assignee) : null,
    rotationIds: rota.map(id), repeat, status: "open",
  });
  const nudges = (expenses: Expense[]): ReminderTarget[] => expenses.flatMap((item) => item.paidByUserId !== MAYA.id || !item.dueOn || item.dueOn > today ? [] :
    item.shares.filter((share) => share.userId !== MAYA.id && share.settledMinor < share.amountMinor).map((share) => ({
      kind: "nudge" as const, sourceId: share.id, recipientUserId: share.userId, amountMinor: share.amountMinor - share.settledMinor,
      currency: "GBP" as const, label: item.title, dueOn: item.dueOn, lastSentAt: null,
    })));
  const links = {
    [id("maya")]: [{ provider: "monzo", handle: "mayachen" }, { provider: "paypal", handle: "mayachen" }],
    [id("sam")]: [{ provider: "monzo", handle: "samokafor" }, { provider: "bank", accountName: "Sam Okafor", sortCode: "204577", accountNumber: "41029388" }],
    [id("jordan")]: [{ provider: "paypal", handle: "jordanhale" }, { provider: "revolut", handle: "jordanhale" }],
    [id("alex")]: [{ provider: "bank", accountName: "Alex Rivera", sortCode: "040004", accountNumber: "17722610" }],
  };
  const pick = (people: Person[]) => Object.fromEntries(people.map((p) => [id(p), links[id(p)]]));

  const everyone: Person[] = ["maya", "jordan", "alex", "sam"];
  const parkExpenses = [
    expense("Broadband", "Bills", "alex", 4800, -1, -10, everyone, { jordan: "all", sam: "all" }),
    expense("British Gas", "Bills", "jordan", 16800, 4, -2, everyone, { alex: "all" }),
    expense("Cleaning supplies", "Household", "sam", 2340, 6, -1, everyone),
    expense("Pizza night", "Food", "jordan", 5400, null, -6, everyone, { alex: "all", sam: "all" }),
    expense("Big Tesco shop", "Groceries", "maya", 8640, -3, -3, everyone, {}, { jordan: report("jordan", 2160, 0) }),
    expense("Council tax, October", "Bills", "maya", 15600, 9, -1, everyone),
    expense("Water rates", "Bills", "maya", 9600, -12, -20, everyone, { jordan: "all", alex: "all", sam: "all" }),
  ];
  const studioExpenses = [
    expense("Printer ink", "Supplies", "sam", 3200, -6, -6, ["maya", "sam"]),
    expense("Studio rent, October", "Rent", "maya", 90000, -10, -12, ["maya", "sam"], { sam: "all" }),
  ];
  const lisbonExpenses = [
    expense("Apartment", "Stay", "maya", 64000, 12, -2, ["maya", "alex"]),
  ];
  const commune = (cid: string, name: string, kind: Commune["kind"], currency: Commune["currency"], people: Person[], extra: Partial<Commune> = {}): Commune =>
    ({ id: cid, name, kind, currency, role: "admin", memberCount: people.length, ...extra });
  return [
    {
      commune: commune("demo-park", "14 Park Street", "household", "GBP", everyone, { address: "Walthamstow, London" }),
      members: members(everyone, "maya"),
      expenses: parkExpenses,
      funds: [], notifications: [], reminderTargets: nudges(parkExpenses),
      notes: [
        { id: "note-bins", title: "Bin days", pill: "Bins", lede: "Black bin Thursday, recycling every other Monday.", facts: [["Black", "Thursday"], ["Recycling", "Every other Monday"]] },
        { id: "note-wifi", title: "Wi-Fi", pill: "Wi-Fi", lede: "ParkStreet-5G. The password is on the router.", facts: [["Network", "ParkStreet-5G"], ["Password", "plantpot-42"]] },
        { id: "note-boiler", title: "Boiler", pill: "Emergency", lede: "Reset button under the panel. Engineer: 020 7946 0182.", facts: [["Reset", "Button under the panel"], ["Engineer", "020 7946 0182"]] },
      ],
      operations: [
        op("op-bins", "Put the bins out", -1, "maya", ["maya", "jordan", "alex", "sam"]),
        op("op-hoover", "Hoover the stairs", 0, "maya", ["maya", "sam", "jordan", "alex"]),
        op("op-plants", "Water the plants", 3, "jordan", ["jordan", "maya"]),
        op("op-gutters", "Clear the gutters", 5, null, [], "none"),
      ],
      recurringBills: [
        { id: "rb-netflix", title: "Netflix", amountMinor: 1799, paidByUserId: id("maya"), allocations: [], frequency: "monthly", nextDueOn: addDays(today, 3), paused: false },
        { id: "rb-council", title: "Council tax", amountMinor: 15600, paidByUserId: id("maya"), allocations: [], frequency: "monthly", nextDueOn: addDays(today, 9), paused: false },
        { id: "rb-broadband", title: "Broadband", amountMinor: 4800, paidByUserId: id("alex"), allocations: [], frequency: "monthly", nextDueOn: addDays(today, 30), paused: false },
      ],
      splitTemplates: [
        { id: "tpl-1", name: "Everyone equally", method: "Equal", participants: everyone.map((p) => ({ userId: id(p), value: "1" })), archivedAt: null },
        { id: "tpl-2", name: "Rooms by size", method: "Percentage", participants: everyone.map((p, i) => ({ userId: id(p), value: String([30, 25, 25, 20][i]) })), archivedAt: null },
      ],
      payLinks: pick(everyone),
      activityEvents: [{ id: "ev-1", actorId: id("jordan"), kind: "operations", entityId: "op-plants", title: "Water the plants", description: "Task completed", createdAt: at(-4) }],
    },
    {
      commune: commune("demo-studio", "Studio East", "workspace", "GBP", ["maya", "sam"], { address: "Unit 4, Hackney Wick" }),
      members: members(["maya", "sam"], "maya"),
      expenses: studioExpenses,
      funds: [], notifications: [], reminderTargets: nudges(studioExpenses),
      notes: [{ id: "note-alarm", title: "Alarm code and opening hours", lede: "Code is on the card in the drawer. Open 8 till 8." }],
      operations: [], recurringBills: [], splitTemplates: [], payLinks: pick(["maya", "sam"]), activityEvents: [],
    },
    {
      commune: commune("demo-lisbon", "Lisbon in September", "trip", "EUR", ["maya", "alex"], { destination: "Lisbon" }),
      members: members(["maya", "alex"], "maya"),
      expenses: lisbonExpenses,
      funds: [], notifications: [], reminderTargets: [],
      notes: [{ id: "note-flights", title: "Flights and the apartment", lede: "Out Friday 07:10 from Gatwick. Rua da Rosa 41, 2nd floor." }],
      operations: [op("op-taxi", "Book the airport taxi", 6, null, [], "none")],
      recurringBills: [], splitTemplates: [], payLinks: pick(["maya", "alex"]),
      activityEvents: [{ id: "ev-2", actorId: id("alex"), kind: "members", entityId: id("alex"), title: "Alex Rivera", description: "Joined the commune", createdAt: at(-2) }],
    },
  ];
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function demoBackend(now: () => string = todayIso): Backend {
  let signedIn = true;
  let data = demoData(now());
  // What a completion changed, so Undo can put it back.
  const undone = new Map<string, { snapshot: Snapshot; before: Operation; events: NonNullable<Snapshot["activityEvents"]> }>();
  const find = (shareId: string) => {
    for (const snapshot of data) for (const item of snapshot.expenses) {
      const share = item.shares.find((candidate) => candidate.id === shareId);
      if (share) return { snapshot, expense: item, share };
    }
    throw new ApiError("That share is no longer here", 404);
  };
  const findReport = (reportId: string) => {
    for (const snapshot of data) for (const item of snapshot.expenses) for (const share of item.shares) {
      const report = share.paymentReports?.find((candidate) => candidate.id === reportId);
      if (report) return { snapshot, expense: item, share, report };
    }
    throw new ApiError("That payment report is no longer here", 404);
  };
  const myLinks = () => parsePayLinks(data[0].payLinks?.[MAYA.id]);
  const setMyLinks = (links: PayLink[]) => {
    for (const snapshot of data) snapshot.payLinks = { ...snapshot.payLinks, [MAYA.id]: links };
    return links;
  };
  return {
    mode: "demo",
    async me() { return signedIn ? MAYA : null; },
    async signIn() { signedIn = true; data = demoData(now()); return MAYA; },
    async signOut() { signedIn = false; },
    async communes() { return data.map((snapshot) => clone(snapshot.commune)); },
    async snapshot(commune) {
      const found = data.find((snapshot) => snapshot.commune.id === commune.id);
      if (!found) throw new ApiError("Not a commune member", 403);
      return clone(found);
    },
    async reportPayment(shareId, input) {
      const { share } = find(shareId);
      if (share.userId !== MAYA.id) throw new ApiError("Only the person who owes a share can report paying it", 403);
      if (share.paymentReports?.some((report) => report.status === "pending")) return;
      if (input.amountMinor > share.amountMinor - share.settledMinor) throw new ApiError("That is more than is left to pay", 400);
      share.paymentReports = [{
        id: `rep-${input.requestId}`, reportedBy: MAYA.id, amountMinor: input.amountMinor, sentOn: input.sentOn, reference: input.reference,
        reportedAt: new Date().toISOString(), status: "pending", resolvedAt: null, resolvedBy: null, note: null, receiptId: null,
      }, ...(share.paymentReports ?? [])];
    },
    async resolveReport(reportId, decision, _requestId, note) {
      const { expense, share, report } = findReport(reportId);
      if (expense.paidByUserId !== MAYA.id) throw new ApiError("Only the bill payer can confirm this", 403);
      if (report.status !== "pending") return;
      report.status = decision === "confirm" ? "confirmed" : "declined";
      report.resolvedAt = new Date().toISOString();
      report.resolvedBy = MAYA.id;
      report.note = note ?? null;
      if (decision === "confirm") share.settledMinor = Math.min(share.amountMinor, share.settledMinor + report.amountMinor);
    },
    async withdrawReport(reportId) {
      const { report } = findReport(reportId);
      if (report.status === "pending") report.status = "withdrawn";
    },
    async completeTask(operationId, input) {
      for (const snapshot of data) {
        const item = snapshot.operations?.find((candidate) => candidate.id === operationId);
        if (!item) continue;
        if (item.status !== "open") throw new ApiError("This task is already done", 409);
        if (input.expectedDate !== item.date) throw new ApiError("This task has already moved on. Refresh to see who has it now.", 409);
        if (item.assigneeId && item.assigneeId !== MAYA.id && !input.doneBy) {
          throw new ApiError("Say whether you did it or they did.", 400);
        }
        const occurrenceId = `occ-${newId()}`;
        undone.set(occurrenceId, { snapshot, before: clone(item), events: snapshot.activityEvents ?? [] });
        const rota = item.rotationIds ?? [];
        if (item.repeat === "none" || !rota.length) item.status = "done";
        else {
          item.assigneeId = rota[(rota.indexOf(item.assigneeId ?? "") + 1) % rota.length];
          item.date = addDays(item.date, item.repeat === "weekly" ? 7 : 30);
        }
        item.undoOccurrenceId = occurrenceId;
        snapshot.activityEvents = [{ id: newId(), actorId: MAYA.id, kind: "operations", entityId: item.id, title: item.title, description: "Task completed", createdAt: new Date().toISOString() }, ...(snapshot.activityEvents ?? [])];
        return occurrenceId;
      }
      throw new ApiError("That task is no longer here", 404);
    },
    async undoCompletion(occurrenceId) {
      const saved = undone.get(occurrenceId);
      if (!saved) throw new ApiError("That can no longer be undone", 409);
      undone.delete(occurrenceId);
      saved.snapshot.operations = (saved.snapshot.operations ?? []).map((item) => (item.id === saved.before.id ? saved.before : item));
      saved.snapshot.activityEvents = saved.events;
    },
    async addExpense(communeId, input) {
      const snapshot = data.find((candidate) => candidate.commune.id === communeId);
      if (!snapshot) throw new ApiError("Not a commune member", 403);
      const expenseId = `exp-${newId()}`;
      snapshot.expenses.unshift({
        id: expenseId, title: input.title, category: input.category, amountMinor: input.amountMinor, paidByUserId: input.paidByUserId,
        dueOn: input.dueOn, createdAt: new Date().toISOString(), version: 1, voidedAt: null,
        shares: input.shares.map((share) => ({
          id: `share-${newId()}`, userId: share.userId, amountMinor: share.amountMinor,
          settledMinor: share.userId === input.paidByUserId ? share.amountMinor : 0, paymentReports: [],
        })),
      });
    },
    async nudge(shareId) {
      for (const snapshot of data) {
        const target = snapshot.reminderTargets.find((item) => item.sourceId === shareId);
        if (target) { target.lastSentAt = new Date().toISOString(); return; }
      }
      throw new ApiError("Nothing to nudge", 404);
    },
    async markRead(notificationId) {
      for (const snapshot of data) for (const item of snapshot.notifications) if (item.id === notificationId) item.readAt ??= new Date().toISOString();
    },
    async myPayLinks() { return myLinks(); },
    async savePayLink(provider: PayProvider, input: PayLinkInput) {
      const handle = (input.handle ?? "").trim().replace(/^(https?:\/\/)?(www\.)?(monzo\.me|paypal\.me|revolut\.me)\//i, "").replace(/^@/, "").replace(/\/.*$/, "");
      const sortCode = (input.sortCode ?? "").replace(/[\s-]/g, "");
      const accountNumber = (input.accountNumber ?? "").replace(/\s/g, "");
      if (provider === "bank") {
        if (!input.accountName?.trim()) throw new ApiError("Enter the name on the account, up to 60 characters", 400);
        if (!/^\d{6}$/.test(sortCode)) throw new ApiError("Enter a six-digit sort code, for example 20-45-77", 400);
        if (!/^\d{8}$/.test(accountNumber)) throw new ApiError("Enter an eight-digit account number", 400);
      } else if (!/^[A-Za-z0-9._-]{1,40}$/.test(handle)) {
        throw new ApiError("Enter your username: letters, numbers, dots, dashes or underscores, up to 40", 400);
      }
      const link: PayLink = provider === "bank"
        ? { provider, handle: null, accountName: input.accountName!.trim(), sortCode, accountNumber }
        : { provider, handle, accountName: null, sortCode: null, accountNumber: null };
      return setMyLinks(parsePayLinks([...myLinks().filter((item) => item.provider !== provider), link]));
    },
    async removePayLink(provider) { return setMyLinks(myLinks().filter((item) => item.provider !== provider)); },
  };
}
