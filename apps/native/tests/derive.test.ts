import { describe, expect, it } from "vitest";
import { demoBackend } from "../src/lib/demo";
import { needs, owedTotals, oweTotals, recorded, settle, standing, statusFor, waiting } from "../src/lib/derive";
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
