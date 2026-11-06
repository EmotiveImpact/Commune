// @vitest-environment node
import { describe, expect, it } from "vitest";
import { demoBackend } from "../src/lib/demo";
import { search } from "../src/lib/search";
import type { Snapshot } from "../src/lib/types";

async function snapshots(): Promise<Snapshot[]> {
  const backend = demoBackend(() => "2026-10-11");
  return Promise.all((await backend.communes()).map((commune) => backend.snapshot(commune)));
}

describe("search", () => {
  it("finds nothing for one letter", async () => {
    expect(search(await snapshots(), "w")).toEqual([]);
  });
  it("finds notes by title or lede, ignoring case", async () => {
    const hits = search(await snapshots(), "WI-FI");
    expect(hits.some((hit) => hit.kind === "note" && hit.id === "note-wifi")).toBe(true);
  });
  it("finds people once per commune, with the commune named", async () => {
    const hits = search(await snapshots(), "alex").filter((hit) => hit.kind === "person");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((hit) => hit.title === "Alex Rivera" && /^Member( · |$)/.test(hit.meta))).toBe(true);
  });
  it("shows expenses with their amount in pence", async () => {
    const all = await snapshots();
    const title = all[0].expenses[0].title;
    const hit = search(all, title).find((item) => item.kind === "expense");
    expect(hit?.meta).toMatch(/^[£€$]\d[\d,]*\.\d\d · /);
  });
  it("matches words in any order, and who paid", async () => {
    const all = await snapshots();
    const expense = all[0].expenses.find((item) => !item.voidedAt)!;
    const payer = all[0].members.find((member) => member.userId === expense.paidByUserId)!.name.split(" ")[0];
    const word = expense.title.split(" ")[0];
    const hits = search(all, `${word} ${payer}`).filter((hit) => hit.kind === "expense");
    expect(hits.some((hit) => hit.id === expense.id)).toBe(true);
    expect(hits.find((hit) => hit.id === expense.id)?.meta).toContain(`${payer} paid`);
  });
  it("matches a bill by its amount", async () => {
    const all = await snapshots();
    const expense = all[0].expenses.find((item) => !item.voidedAt)!;
    const hits = search(all, (expense.amountMinor / 100).toFixed(2));
    expect(hits.some((hit) => hit.kind === "expense" && hit.id === expense.id)).toBe(true);
  });
  it("shows bills newest first with their date, at most 12", async () => {
    const all = await snapshots();
    const counts = new Map<string, number>();
    for (const item of all[0].expenses) counts.set(item.paidByUserId, (counts.get(item.paidByUserId) ?? 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const name = all[0].members.find((member) => member.userId === top)!.name.split(" ")[0];
    const hits = search(all, name).filter((hit) => hit.kind === "expense");
    expect(hits.length).toBeGreaterThan(1);
    expect(hits.length).toBeLessThanOrEqual(12);
    expect(hits[0].meta).toMatch(/ · \d{1,2} [A-Z][a-z]{2}/);
    const day = (id: string) => { const e = all.flatMap((s) => s.expenses).find((x) => x.id === id)!; return e.dueOn ?? e.createdAt ?? ""; };
    const days = hits.map((hit) => day(hit.id));
    expect([...days].sort().reverse()).toEqual(days);
  });
});
