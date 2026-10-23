import { describe, expect, it } from "vitest";
import { demoBackend } from "../src/lib/demo";
import { aheadBy, essentials, feed, hubMoneyLine, needs, owedTotals, oweTotals, people, recorded, settle, standing, standingClause, statusFor, tilePulse, waiting, week, weekSentence } from "../src/lib/derive";
import { equalShares, moneyList, parseAmount } from "../src/lib/format";
import { payLinkHref } from "../src/lib/payLinks";
import type { Snapshot } from "../src/lib/types";

// Saturday 11 October 2026, the prototype's day.
const TODAY = "2026-10-11";

async function load() {
  const backend = demoBackend(() => TODAY);
  const user = (await backend.me())!;
  const snapshots: Snapshot[] = await Promise.all((await backend.communes()).map((commune) => backend.snapshot(commune)));
  return { backend, user, snapshots };
}

describe("what Maya has to do", () => {
  it("lists her shares and her turns, overdue first", async () => {
    const { user, snapshots } = await load();
    const items = needs(snapshots, user.id, TODAY);
    expect(items.map((item) => item.title)).toEqual([
      "Printer ink", "Broadband", "Put the bins out", "Hoover the stairs", "British Gas", "Cleaning supplies", "Pizza night",
    ]);
    expect(items[0]).toMatchObject({ kind: "share", amountMinor: 1600, payerName: "Sam Okafor", band: "Overdue", status: { text: "6 days overdue", tone: "late" } });
    expect(items[2]).toMatchObject({ kind: "task", status: { text: "Due yesterday" } });
    expect(items.at(-1)).toMatchObject({ band: "No due date", status: { text: "Whenever suits" } });
  });

  it("keeps pounds and euros apart", async () => {
    const { user, snapshots } = await load();
    const owed = waiting(snapshots, user.id, TODAY);
    expect(oweTotals(needs(snapshots, user.id, TODAY))).toEqual({ GBP: 1600 + 1200 + 4200 + 585 + 1350 });
    const totals = owedTotals(owed);
    expect(totals.EUR).toBe(32000);
    expect(totals.GBP).toBe(2160 * 3 + 3900 * 3);
    expect(moneyList(totals)).toBe("£181.80 and €320.00");
  });

  it("shows Jordan's report for Maya to confirm, and stops asking Maya to nudge him", async () => {
    const { user, snapshots } = await load();
    const tesco = waiting(snapshots, user.id, TODAY).find((entry) => entry.title === "Big Tesco shop")!;
    const jordan = tesco.debtors.find((debtor) => debtor.name === "Jordan Hale")!;
    expect(jordan.pending?.amountMinor).toBe(2160);
    expect(tesco.debtors.filter((debtor) => debtor.canNudge && !debtor.pending)).toHaveLength(2);
    const people = settle([], waiting(snapshots, user.id, TODAY)).owedToYou;
    expect(people.find((row) => row.name === "Alex Rivera" && row.currency === "EUR")?.amountMinor).toBe(32000);
  });
});

describe("recording a payment", () => {
  it("moves the share out of Needs you until the bill payer confirms it", async () => {
    const { backend, user, snapshots } = await load();
    const ink = needs(snapshots, user.id, TODAY).find((item) => item.title === "Printer ink")!;
    if (ink.kind !== "share") throw new Error("expected a share");
    await backend.reportPayment(ink.shareId, { amountMinor: 1600, sentOn: TODAY, reference: null, requestId: "r1" });
    const studio = await backend.snapshot(snapshots[1].commune);
    const after = [snapshots[0], studio, snapshots[2]];
    expect(needs(after, user.id, TODAY).some((item) => item.title === "Printer ink")).toBe(false);
    const mine = recorded(after, user.id);
    expect(mine).toHaveLength(1);
    expect(standing(studio, needs(after, user.id, TODAY), waiting(after, user.id, TODAY), mine))
      .toEqual({ line: "All recorded", state: { text: "Waiting to confirm", tone: "plain" } });
  });

  it("only changes a balance when the bill payer confirms", async () => {
    const { backend, user, snapshots } = await load();
    const report = waiting(snapshots, user.id, TODAY).flatMap((entry) => entry.debtors).find((debtor) => debtor.pending)!.pending!;
    await backend.resolveReport(report.id, "confirm", "r2");
    const park = await backend.snapshot(snapshots[0].commune);
    const tesco = waiting([park], user.id, TODAY).find((entry) => entry.title === "Big Tesco shop")!;
    expect(tesco.debtors.map((debtor) => debtor.name)).toEqual(["Alex Rivera", "Sam Okafor"]);
  });
});

describe("helpers", () => {
  it("words due dates the way the prototype does", () => {
    expect(statusFor("2026-10-10", TODAY)).toEqual({ text: "1 day overdue", tone: "late" });
    expect(statusFor("2026-10-11", TODAY)).toEqual({ text: "Today", tone: "attention" });
    expect(statusFor("2026-10-15", TODAY)).toEqual({ text: "Due Thu", tone: "plain" });
    expect(statusFor("2026-10-23", TODAY)).toEqual({ text: "Due Fri 23 Oct", tone: "plain" });
  });
  it("splits pennies fairly and reads typed amounts", () => {
    expect(equalShares(1000, ["a", "b", "c"]).map((share) => share.amountMinor)).toEqual([334, 333, 333]);
    expect(parseAmount("£16")).toBe(1600);
    expect(parseAmount("16.5")).toBe(1650);
    expect(parseAmount("16.555")).toBeNull();
    expect(parseAmount("0")).toBeNull();
  });
  it("fills the amount into a Monzo link", () => {
    expect(payLinkHref({ provider: "monzo", handle: "samokafor", accountName: null, sortCode: null, accountNumber: null }, 1600, "GBP", "Printer ink"))
      .toEqual({ href: "https://monzo.me/samokafor/16.00?d=Printer%20ink", amountFilled: true });
  });
});

describe("the Hub at a glance", () => {
  const park = (snapshots: Snapshot[]) => snapshots.find((item) => item.commune.id === "demo-park")!;

  it("tells one money story: what you owe, what you're owed, and where that leaves you", async () => {
    const { user, snapshots } = await load();
    const owe = oweTotals(needs(snapshots, user.id, TODAY));
    const owed = owedTotals(waiting(snapshots, user.id, TODAY));
    expect(aheadBy(owe, owed)).toEqual([{ currency: "GBP", netMinor: 18180 - 8935 }]);
    expect(standingClause({ currency: "GBP", netMinor: 9245 }, true)).toBe("so in pounds you’re £92.45 ahead");
    expect(hubMoneyLine(7335, 18180, "GBP")).toBe("You’re also owed £181.80, so you’re £108.45 ahead overall.");
    expect(hubMoneyLine(2000, 500, "GBP")).toBe("You’re also owed £5.00, so you owe £15.00 overall.");
  });

  it("lays out the week with late jobs first and bills on their day", async () => {
    const { user, snapshots } = await load();
    const value = week(park(snapshots), user.id, TODAY);
    expect(value.late.map((item) => [item.title, item.who])).toEqual([["Put the bins out", "You"]]);
    expect(value.days.map((day) => day.items.map((item) => item.title))).toEqual([
      ["Hoover the stairs"], [], [], ["Water the plants"], ["British Gas"], ["Clear the gutters"], ["Cleaning supplies"],
    ]);
    expect(value.days[4].items[0]).toMatchObject({ kind: "bill", amountMinor: 16800, yourShareMinor: 4200, who: "Jordan" });
    expect(value.days[5].items[0]).toMatchObject({ who: "Nobody yet", assigneeId: null });
    expect(weekSentence(value)).toBe("1 late, 1 due today and 2 bills due this week.");
  });

  it("gives each person their balance with you, counting a payment they say they sent until it is confirmed", async () => {
    const { user, snapshots } = await load();
    expect(people(park(snapshots), user.id, TODAY).map((line) => [line.name, line.balance, line.job])).toEqual([
      ["You", "£108.45 ahead", "Put the bins out · late"],
      ["Jordan Hale", "Owes you £5.10", "Water the plants · Wed"],
      ["Alex Rivera", "Owes you £48.60", "Nothing this week"],
      ["Sam Okafor", "Owes you £54.75", "Nothing this week"],
    ]);
  });

  it("puts emergency details first and keeps passwords marked secret", async () => {
    const { snapshots } = await load();
    const items = essentials(park(snapshots));
    expect(items.map((item) => item.title)).toEqual(["Boiler", "Wi-Fi", "Bin days"]);
    expect(items[0].facts.find((fact) => fact.label === "Engineer")).toMatchObject({ phone: true, secret: false });
    expect(items[1].facts.find((fact) => fact.label === "Password")).toMatchObject({ secret: true, phone: false });
  });

  it("gives each commune tile a short pulse", async () => {
    const { user, snapshots } = await load();
    expect(snapshots.map((snapshot) => tilePulse(snapshot, user.id, TODAY))).toEqual([
      { text: "1 late chore · 2 overdue bills", late: true },
      { text: "1 overdue bill", late: true },
      { text: "Apartment due in 12 days", late: false },
    ]);
  });

  it("writes the amount into a payment someone says they sent", async () => {
    const { user, snapshots } = await load();
    expect(feed(snapshots, user.id, 10).map((item) => item.text)).toContain("said they paid you £21.60 for Big Tesco shop.");
  });

  it("can undo marking a task done", async () => {
    const { backend } = await load();
    const before = (await backend.snapshot((await backend.communes())[0])).operations!.find((item) => item.id === "op-hoover")!;
    const occurrenceId = await backend.completeTask("op-hoover", { expectedDate: before.date, today: TODAY, requestId: "r1" });
    const moved = (await backend.snapshot((await backend.communes())[0])).operations!.find((item) => item.id === "op-hoover")!;
    expect(moved.date).not.toBe(before.date);
    await backend.undoCompletion(occurrenceId!);
    const back = (await backend.snapshot((await backend.communes())[0])).operations!.find((item) => item.id === "op-hoover")!;
    expect(back).toMatchObject({ date: before.date, assigneeId: before.assigneeId, status: "open" });
  });

  it("asks who did someone else's task", async () => {
    const { backend } = await load();
    const plants = (await backend.snapshot((await backend.communes())[0])).operations!.find((item) => item.id === "op-plants")!;
    await expect(backend.completeTask("op-plants", { expectedDate: plants.date, today: TODAY, requestId: "r2" })).rejects.toThrow("did it");
    await expect(backend.completeTask("op-plants", { expectedDate: plants.date, today: TODAY, requestId: "r3", doneBy: "assignee" })).resolves.toMatch(/^occ-/);
  });
});
