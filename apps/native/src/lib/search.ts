import { money } from "./format";
import type { Snapshot } from "./types";

export type SearchHit = {
  kind: "expense" | "person" | "chore" | "note";
  id: string;
  communeId: string;
  title: string;
  meta: string;
};

const KIND_ORDER: SearchHit["kind"][] = ["expense", "chore", "note", "person"];

function matches(query: string, ...fields: Array<string | null | undefined>) {
  return fields.some((field) => field?.toLowerCase().includes(query));
}

/**
 * Finds expenses, chores, notes and people across every commune you are in.
 * Fewer than two characters finds nothing, so the list does not flood on the
 * first letter. Voided expenses and people who have left are skipped.
 */
export function search(snapshots: Snapshot[], raw: string, limit = 30): SearchHit[] {
  const query = raw.trim().toLowerCase();
  if (query.length < 2) return [];
  const hits: SearchHit[] = [];
  for (const snapshot of snapshots) {
    const communeId = snapshot.commune.id;
    const where = snapshot.commune.name;
    for (const expense of snapshot.expenses) {
      if (expense.voidedAt || !matches(query, expense.title, expense.category)) continue;
      hits.push({ kind: "expense", id: expense.id, communeId, title: expense.title, meta: `${money(expense.amountMinor, snapshot.commune.currency)} · ${where}` });
    }
    for (const item of snapshot.operations ?? []) {
      if (!matches(query, item.title, item.notes)) continue;
      hits.push({ kind: "chore", id: item.id, communeId, title: item.title, meta: `${item.kind === "event" ? "Event" : item.status === "done" ? "Chore, done" : "Chore"} · ${where}` });
    }
    for (const note of snapshot.notes ?? []) {
      if (!matches(query, note.title, note.lede, note.pill)) continue;
      hits.push({ kind: "note", id: note.id, communeId, title: note.title, meta: `Note · ${where}` });
    }
    for (const member of snapshot.members) {
      if (member.active === false || !matches(query, member.name)) continue;
      hits.push({ kind: "person", id: member.userId, communeId, title: member.name, meta: `Member · ${where}` });
    }
  }
  return hits
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
    .slice(0, limit);
}
