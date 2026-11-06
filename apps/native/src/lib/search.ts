import { firstName, money, shortDate } from "./format";
import type { Snapshot } from "./types";

export type SearchHit = {
  kind: "expense" | "person" | "chore" | "note";
  id: string;
  communeId: string;
  title: string;
  meta: string;
};

const KIND_ORDER: SearchHit["kind"][] = ["expense", "chore", "note", "person"];

/** Most hits of each kind, so a long list of bills never pushes people and notes out. */
const CAP: Record<SearchHit["kind"], number> = { expense: 12, chore: 8, note: 8, person: 6 };

/** Every word of the query appears somewhere in the fields, in any order. */
function matches(words: string[], ...fields: Array<string | null | undefined>) {
  const text = fields.filter(Boolean).join(" ").toLowerCase();
  return words.every((word) => text.includes(word));
}

/**
 * Finds bills, chores, notes and people across every commune you are in.
 * Every word typed must match, in any order, so "sam gas" finds the gas bill
 * Sam paid. Bills also match who paid and the amount ("82" or "£82.00"), show
 * their date, and come newest first. Fewer than two characters finds nothing,
 * so the list does not flood on the first letter. Voided bills and people who
 * have left are skipped. You show as "You paid" and "Your turn". The commune is named only when you are in more than one.
 */
export function search(snapshots: Snapshot[], raw: string, viewerId?: string): SearchHit[] {
  const query = raw.trim().toLowerCase();
  if (query.length < 2) return [];
  const words = query.split(/\s+/);
  const many = snapshots.length > 1;
  const found: Array<SearchHit & { sort: string }> = [];
  for (const snapshot of snapshots) {
    const communeId = snapshot.commune.id;
    const where = many ? ` · ${snapshot.commune.name}` : "";
    const nameOf = (userId?: string | null) => (userId ? snapshot.members.find((member) => member.userId === userId)?.name : undefined);
    for (const expense of snapshot.expenses) {
      if (expense.voidedAt) continue;
      const amount = money(expense.amountMinor, snapshot.commune.currency);
      const payer = nameOf(expense.paidByUserId);
      const plain = (expense.amountMinor / 100).toFixed(2);
      if (!matches(words, expense.title, expense.category, payer, amount, plain)) continue;
      const day = expense.dueOn ?? expense.createdAt?.slice(0, 10) ?? "";
      const paid = !payer ? "" : expense.paidByUserId === viewerId ? " · You paid" : ` · ${firstName(payer)} paid`;
      found.push({ kind: "expense", id: expense.id, communeId, title: expense.title, meta: `${amount}${day ? ` · ${shortDate(day)}` : ""}${paid}${where}`, sort: day });
    }
    for (const item of snapshot.operations ?? []) {
      const who = nameOf(item.assigneeId);
      if (!matches(words, item.title, item.notes, who)) continue;
      const label = item.kind === "event" ? "Event" : item.status === "done" ? "Chore, done" : "Chore";
      found.push({ kind: "chore", id: item.id, communeId, title: item.title, meta: `${label} · ${shortDate(item.date)}${!who ? "" : item.assigneeId === viewerId ? " · Your turn" : ` · ${firstName(who)}’s turn`}${where}`, sort: item.date });
    }
    for (const note of snapshot.notes ?? []) {
      if (!matches(words, note.title, note.lede, note.pill, note.body)) continue;
      found.push({ kind: "note", id: note.id, communeId, title: note.title, meta: `Note${note.lede ? ` · ${note.lede}` : ""}${where}`, sort: "" });
    }
    for (const member of snapshot.members) {
      if (member.active === false || !matches(words, member.name)) continue;
      found.push({ kind: "person", id: member.userId, communeId, title: member.name, meta: `Member${where}`, sort: "" });
    }
  }
  return KIND_ORDER.flatMap((kind) => found
    .filter((hit) => hit.kind === kind)
    .sort((a, b) => (kind === "expense" ? b.sort.localeCompare(a.sort) : 0))
    .slice(0, CAP[kind])
    .map(({ sort: _sort, ...hit }) => hit));
}
