import type { Need } from "./derive";
import { money } from "./format";
import type { Snapshot } from "./types";

/**
 * What a "Remind me" key points at. The drawer accepts any of these, so a
 * long press anywhere in the app can open it:
 * - a need key from the Still to pay list (`share:<shareId>`, `task:<operationId>`)
 * - `expense:<id>` (also `wait:` and `e:`): your share of a bill, or the bill itself
 * - `task:<operationId>` (also `op:`): a chore or event
 * - `recurring:<id>` (also `rb:`): a repeating bill's next date
 */
export type RemindKey =
  | { kind: "share"; id: string }
  | { kind: "expense"; id: string }
  | { kind: "task"; id: string }
  | { kind: "recurring"; id: string };

export function parseRemindKey(raw: string): RemindKey | null {
  const at = raw.indexOf(":");
  if (at <= 0 || at === raw.length - 1) return null;
  const prefix = raw.slice(0, at);
  const id = raw.slice(at + 1);
  switch (prefix) {
    case "share": return { kind: "share", id };
    case "expense": case "wait": case "e": return { kind: "expense", id };
    case "task": case "op": return { kind: "task", id };
    case "recurring": case "rb": return { kind: "recurring", id };
    default: return null;
  }
}

export type RemindTarget = {
  /** Shown as the drawer's heading and in the toast. */
  title: string;
  /** One line under the heading, without repeating it. */
  what: string;
  /** What the notification says when it goes off. */
  body: string;
  /** Where "Open" goes. */
  open: string;
};

export function remindTarget(raw: string, needs: Need[], snapshots: Snapshot[], viewerId: string): RemindTarget | null {
  const key = parseRemindKey(raw);
  if (!key) return null;
  const nameOf = (snapshot: Snapshot, userId: string) => userId === viewerId ? "you" : snapshot.members.find((member) => member.userId === userId)?.name ?? "someone";

  if (key.kind === "share") {
    const need = needs.find((item) => item.key === raw);
    if (need && need.kind === "share") {
      return {
        title: need.title,
        what: `Your share, ${money(need.amountMinor, need.currency)} to ${need.payerName}`,
        body: `Pay ${need.payerName} ${money(need.amountMinor, need.currency)} for ${need.title}.`,
        open: `/expense/${need.expenseId}`,
      };
    }
    for (const snapshot of snapshots) {
      const expense = snapshot.expenses.find((item) => item.shares.some((share) => share.id === key.id));
      if (expense) return expenseTarget(snapshot, expense.id, viewerId, nameOf);
    }
    return null;
  }

  if (key.kind === "expense") {
    for (const snapshot of snapshots) {
      if (snapshot.expenses.some((item) => item.id === key.id)) return expenseTarget(snapshot, key.id, viewerId, nameOf);
    }
    return null;
  }

  if (key.kind === "task") {
    for (const snapshot of snapshots) {
      const item = snapshot.operations?.find((operation) => operation.id === key.id);
      if (!item) continue;
      const mine = item.assigneeId === viewerId;
      const who = !item.assigneeId ? "Nobody has it yet" : mine ? "Your turn" : `${nameOf(snapshot, item.assigneeId)}’s turn`;
      return {
        title: item.title,
        what: `${who} · ${snapshot.commune.name}`,
        body: mine ? `Your turn: ${item.title}.` : `${item.title} in ${snapshot.commune.name}.`,
        open: `/tasks?focus=${encodeURIComponent(item.id)}`,
      };
    }
    return null;
  }

  for (const snapshot of snapshots) {
    const bill = snapshot.recurringBills?.find((item) => item.id === key.id);
    if (!bill) continue;
    const amount = money(bill.amountMinor, snapshot.commune.currency);
    return {
      title: bill.title,
      what: `${amount} ${bill.frequency === "weekly" ? "weekly" : "monthly"} · ${snapshot.commune.name}`,
      body: `${bill.title} renews soon: ${amount}.`,
      open: "/recurring",
    };
  }
  return null;
}

function expenseTarget(snapshot: Snapshot, expenseId: string, viewerId: string, nameOf: (snapshot: Snapshot, userId: string) => string): RemindTarget {
  const expense = snapshot.expenses.find((item) => item.id === expenseId)!;
  const currency = snapshot.commune.currency;
  const share = expense.shares.find((item) => item.userId === viewerId);
  const left = share ? Math.max(0, share.amountMinor - share.settledMinor) : 0;
  const payer = nameOf(snapshot, expense.paidByUserId);
  if (share && left > 0 && expense.paidByUserId !== viewerId) {
    return {
      title: expense.title,
      what: `Your share, ${money(left, currency)} to ${payer}`,
      body: `Pay ${payer} ${money(left, currency)} for ${expense.title}.`,
      open: `/expense/${expense.id}`,
    };
  }
  return {
    title: expense.title,
    what: `${money(expense.amountMinor, currency)} · ${snapshot.commune.name}`,
    body: `Check on ${expense.title} in ${snapshot.commune.name}.`,
    open: `/expense/${expense.id}`,
  };
}

/** The route that opens the drawer for a key. */
export function remindHref(key: string): string {
  return `/remind/${encodeURIComponent(key)}`;
}
