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
    [id("sam")]: [{ provider: "monzo", handle: "samokafor", preferred: true }, { provider: "bank", accountName: "Sam Okafor", sortCode: "204577", accountNumber: "41029388" }],
    [id("jordan")]: [{ provider: "paypal", handle: "jordanhale" }, { provider: "revolut", handle: "jordanhale" }],
    [id("alex")]: [{ provider: "bank", accountName: "Alex Rivera", sortCode: "040004", accountNumber: "17722610" }],
  };
  const pick = (people: Person[]) => Object.fromEntries(people.map((p) => [id(p), links[id(p)]]));

  const everyone: Person[] = ["maya", "jordan", "alex", "sam"];
  const equal = (amountMinor: number, people: Person[]) => people.map((p, index) => ({
    userId: id(p), amountMinor: Math.floor(amountMinor / people.length) + (index < amountMinor % people.length ? 1 : 0),
  }));
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
      funds: [{
        id: "fund-kitty", name: "Holiday kitty", targetMinor: 40000,
        commitments: everyone.map((p, index) => {
          const paid = p === "maya" ? [2000, 2000] : [2000, 2000, 2000];
          return { id: `commit-${p}`, userId: id(p), amountMinor: 10000, dueOn: addDays(today, 40), contributedMinor: paid.reduce((a, b) => a + b, 0),
            contributions: paid.map((amountMinor, k) => ({ id: `contrib-${p}-${k}`, amountMinor, contributedAt: at(-30 * (k + 1) + index), voidedAt: null })) };
        }),
      }],
      notifications: [], reminderTargets: nudges(parkExpenses),
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
        { id: "rb-netflix", title: "Netflix", amountMinor: 1799, paidByUserId: id("maya"), allocations: equal(1799, everyone), frequency: "monthly", nextDueOn: addDays(today, 3), paused: false, version: 1 },
        { id: "rb-council", title: "Council tax", amountMinor: 15600, paidByUserId: id("maya"), allocations: equal(15600, everyone), frequency: "monthly", nextDueOn: addDays(today, 9), paused: false, version: 1 },
        { id: "rb-broadband", title: "Broadband", amountMinor: 4800, paidByUserId: id("alex"), allocations: equal(4800, everyone), frequency: "monthly", nextDueOn: addDays(today, 30), paused: false, version: 1 },
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
    async addNote(communeId, input) {
      const snapshot = data.find((candidate) => candidate.commune.id === communeId);
      if (!snapshot) throw new ApiError("Not a commune member", 403);
      snapshot.notes = [...(snapshot.notes ?? []), { id: `note-${newId()}`, title: input.title, pill: input.pill ?? undefined, lede: input.lede ?? undefined, body: input.body ?? undefined, facts: input.facts }];
    },
    async addTask(communeId, input) {
      const snapshot = data.find((candidate) => candidate.commune.id === communeId);
      if (!snapshot) throw new ApiError("Not a commune member", 403);
      const assigneeId = input.assigneeId ?? input.rotationIds?.[0] ?? null;
      snapshot.operations = [...(snapshot.operations ?? []), { id: `op-${newId()}`, kind: "task", title: input.title, date: input.date, allDay: true,
        assigneeId, rotationIds: input.rotationIds, repeat: input.repeat, status: "open", notes: input.notes ?? undefined }];
    },
    async contribute(commitmentId, amountMinor) {
      for (const snapshot of data) for (const fund of snapshot.funds) {
        const commitment = fund.commitments.find((item) => item.id === commitmentId);
        if (!commitment) continue;
        if (commitment.userId !== MAYA.id) throw new ApiError("You can only record your own contributions", 403);
        if (amountMinor <= 0 || commitment.contributedMinor + amountMinor > commitment.amountMinor) throw new ApiError("That is more than is left on your pledge", 400);
        const contributionId = `contrib-${newId()}`;
        commitment.contributions = [{ id: contributionId, amountMinor, contributedAt: new Date().toISOString(), voidedAt: null }, ...(commitment.contributions ?? [])];
        commitment.contributedMinor += amountMinor;
        return contributionId;
      }
      throw new ApiError("Pledge not found", 404);
    },
    async voidContribution(contributionId) {
      for (const snapshot of data) for (const fund of snapshot.funds) for (const commitment of fund.commitments) {
        const item = commitment.contributions?.find((candidate) => candidate.id === contributionId);
        if (!item || item.voidedAt) continue;
        item.voidedAt = new Date().toISOString();
        commitment.contributedMinor -= item.amountMinor;
        return;
      }
      throw new ApiError("Contribution not found", 404);
    },
    async setRecurringPaused(billId, paused) {
      const bill = data.flatMap((snapshot) => snapshot.recurringBills ?? []).find((item) => item.id === billId);
      if (!bill) throw new ApiError("Bill not found", 404);
      if (bill.paused !== paused) { bill.paused = paused; bill.version = (bill.version ?? 1) + 1; }
    },
    async saveRecurring(communeId, input) {
      const snapshot = data.find((candidate) => candidate.commune.id === communeId);
      const bill = snapshot?.recurringBills?.find((item) => item.id === input.id);
      if (!bill) throw new ApiError("Bill not found", 404);
      if ((bill.version ?? 1) !== input.expectedVersion) throw new ApiError("Someone changed this bill while you were editing. Open it again.", 409);
      if (input.allocations.reduce((sum, item) => sum + item.amountMinor, 0) !== input.amountMinor) throw new ApiError("The shares must add up to the amount", 400);
      Object.assign(bill, { title: input.title, amountMinor: input.amountMinor, paidByUserId: input.paidByUserId, allocations: input.allocations,
        frequency: input.frequency, nextDueOn: input.nextDueOn, version: (bill.version ?? 1) + 1 });
    },
    async announce(communeId, input) {
      const snapshot = data.find((candidate) => candidate.commune.id === communeId);
      if (!snapshot) throw new ApiError("Not a commune member", 403);
      snapshot.announcements = [{ id: `ann-${newId()}`, title: input.title, body: input.body, authorId: MAYA.id, createdAt: new Date().toISOString(),
        needsAcknowledgement: input.needsAcknowledgement, acknowledgements: [] }, ...(snapshot.announcements ?? [])];
    },
    async claimTask(operationId, input) {
      for (const snapshot of data) {
        const item = snapshot.operations?.find((candidate) => candidate.id === operationId);
        if (!item) continue;
        if (item.status !== "open") throw new ApiError("This task is already done", 409);
        if (input.expectedDate !== item.date || item.assigneeId) throw new ApiError("This task has already moved on. Refresh to see who has it now.", 409);
        item.assigneeId = input.toMemberId;
        return;
      }
      throw new ApiError("This task has been removed", 404);
    },
    async createCommune(input) {
      const id = `demo-${newId()}`;
      data.push({
        commune: { id, name: input.name, kind: input.kind, currency: input.currency, role: "admin", memberCount: 1 },
        members: [{ ...PEOPLE.maya, role: "admin", active: true }],
        expenses: [], funds: [], notifications: [], reminderTargets: [], notes: [], operations: [],
        recurringBills: [], splitTemplates: [], payLinks: {}, activityEvents: [],
      });
      return id;
    },
    async invite(communeId, email) {
      if (!data.some((snapshot) => snapshot.commune.id === communeId)) throw new Error("That commune isn’t here any more.");
      const token = Array.from(email.trim().toLowerCase()).reduce((hash, ch) => (hash * 31 + ch.charCodeAt(0)) >>> 0, 7).toString(16).padStart(8, "0");
      return { url: `https://app.ourcommune.io/invite?token=demo${token}` };
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
      const kept = myLinks().find((item) => item.provider === provider)?.preferred ?? false;
      const link: PayLink = provider === "bank"
        ? { provider, handle: null, accountName: input.accountName!.trim(), sortCode, accountNumber, preferred: kept }
        : { provider, handle, accountName: null, sortCode: null, accountNumber: null, preferred: kept };
      return setMyLinks(parsePayLinks([...myLinks().filter((item) => item.provider !== provider), link]));
    },
    async removePayLink(provider) { return setMyLinks(myLinks().filter((item) => item.provider !== provider)); },
    async setPreferredPayLink(provider) {
      if (provider && !myLinks().some((item) => item.provider === provider)) throw new ApiError("Add that way to be paid before making it your favourite", 400);
      return setMyLinks(parsePayLinks(myLinks().map((item) => ({ ...item, preferred: item.provider === provider }))));
    },
    // "demo" is the invitation the Help screen's "Preview joining" opens: Sam
    // asks Maya to join 22 Elm Road. Joining adds a commune with one bill and
    // one chore that are hers from today, and nothing from before.
    async previewInvite(token) {
      if (token !== "demo") return null;
      if (data.some((snapshot) => snapshot.commune.id === "demo-elm")) return null;
      return { communeName: "22 Elm Road", kind: "household", inviterName: "Sam Okafor", people: ["Sam Okafor", "Jordan Hale", "Alex Rivera"] };
    },
    async acceptInvite(token) {
      if (token !== "demo") throw new ApiError("This invitation has expired or been used", 410);
      if (data.some((snapshot) => snapshot.commune.id === "demo-elm")) return "demo-elm";
      const today = now();
      const people = [MAYA.id, "demo-sam", "demo-jordan", "demo-alex"];
      const share = (n: number, userId: string, amountMinor: number, paid: boolean): Share =>
        ({ id: `share-elm-${n}-${userId}`, userId, amountMinor, settledMinor: paid ? amountMinor : 0, paymentReports: [] });
      data.push({
        commune: { id: "demo-elm", name: "22 Elm Road", kind: "household", currency: "GBP", role: "member", memberCount: 4 },
        members: [
          { ...PEOPLE.sam, role: "admin", active: true }, { ...PEOPLE.jordan, role: "member", active: true },
          { ...PEOPLE.alex, role: "member", active: true }, { ...PEOPLE.maya, role: "member", active: true },
        ],
        expenses: [{
          id: "exp-elm-1", title: "Broadband", category: "Bills", amountMinor: 4000, paidByUserId: "demo-sam",
          dueOn: addDays(today, 3), createdAt: `${today}T08:00:00Z`, version: 1, voidedAt: null,
          shares: people.map((userId) => share(1, userId, 1000, userId === "demo-sam")),
        }],
        funds: [], notifications: [], reminderTargets: [],
        notes: [{ id: "note-elm-wifi", title: "Wi-Fi and bins", lede: "Network ElmRoad5G. Bins go out on Thursday night." }],
        operations: [{ id: "op-elm-bins", kind: "task", title: "Put the bins out", date: addDays(today, 2), allDay: true,
          assigneeId: MAYA.id, rotationIds: [MAYA.id, "demo-jordan", "demo-alex", "demo-sam"], repeat: "weekly", status: "open" }],
        recurringBills: [], splitTemplates: [], payLinks: {}, activityEvents: [],
      });
      return "demo-elm";
    },
  };
}
