import type { Snapshot } from "../live/model";
import { isSecretFact } from "./notePresentation";
import { timestampDay } from "./operations";
import { csvCell } from "./statement";

const SECRET = "(left out of exports)";

/**
 * Everything this member can see in one commune, as JSON. Note secrets
 * (passwords, door codes) are left out, as they are masked on the board.
 */
export function communeExportJson(snapshot: Snapshot, exportedAt = new Date()): string {
  const notes = (snapshot.notes ?? []).map((note) => {
    const secrets = note.facts.filter(([label, value]) => isSecretFact(label) && value).map(([, value]) => value);
    const mask = (text: string) => secrets.reduce((result, value) => result.split(value).join(SECRET), text);
    return {
      ...note,
      lede: mask(note.lede), body: mask(note.body),
      facts: note.facts.map(([label, value]) => [label, isSecretFact(label) && value ? SECRET : value] as [string, string]),
    };
  });
  return `${JSON.stringify({
    format: "commune-export", version: 1, exportedAt: exportedAt.toISOString(),
    note: "Commune records as recorded by members. Commune does not hold or move money.",
    ...snapshot, notes,
  }, null, 2)}\n`;
}

/**
 * One row per share of every expense, voided ones included and marked. Each
 * is dated by the day it was entered where the member is.
 */
export function expensesCsv(snapshot: Snapshot): string {
  const currency = snapshot.commune.currency;
  const names = new Map(snapshot.members.map((member) => [member.userId, member.name]));
  const name = (id: string) => names.get(id) ?? "Former member";
  const amount = (minor: number) => (minor / 100).toFixed(2);
  const header = ["Date", "Expense", "Category", `Total (${currency})`, "Paid by", "Member", `Share (${currency})`,
    `Received (${currency})`, `Outstanding (${currency})`, "Status"];
  const lines = [header.map((cell) => csvCell(cell)).join(",")];
  const expenses = [...(snapshot.expenses ?? [])].sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
  for (const expense of expenses) {
    for (const share of expense.shares) {
      const own = share.userId === expense.paidByUserId;
      const voided = !!expense.voidedAt;
      const outstanding = voided || own ? 0 : Math.max(0, share.amountMinor - share.settledMinor);
      const status = voided ? "Voided" : own ? "Paid the bill" : outstanding ? (share.settledMinor ? "Part paid" : "Open") : "Settled";
      lines.push([
        csvCell(timestampDay(expense.createdAt)), csvCell(expense.title), csvCell(expense.category ?? ""),
        csvCell(amount(expense.amountMinor), false), csvCell(name(expense.paidByUserId)), csvCell(name(share.userId)),
        csvCell(amount(share.amountMinor), false), csvCell(amount(own ? share.amountMinor : share.settledMinor), false),
        csvCell(amount(outstanding), false), csvCell(status),
      ].join(","));
    }
  }
  return `${lines.join("\r\n")}\r\n`;
}

/** Save text as a file in the browser. Nothing leaves the device. */
export function downloadText(filename: string, text: string, type: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([text], { type }));
  link.download = filename.replace(/[\\/:*?"<>|]+/g, " ");
  link.click();
  URL.revokeObjectURL(link.href);
}
