// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  arrivalFrom, clockGroup, computeWeek, ctxFrom, demoPeople, pickInGroup, pickStory, scoreStory, split, startScreen, storyById, storyMoney,
} from "../src/opening/engine";
import { CAST, GROUPS, INVITES, STORIES } from "../src/opening/stories";

const first = () => 0;
const at = (iso: string, arrived = "store" as Parameters<typeof ctxFrom>[1]) => ctxFrom(new Date(iso), arrived);

describe("opening stories", () => {
  it("keeps every slide: four per story, five for the crisps", () => {
    for (const s of STORIES) expect(s.beats.length).toBe(s.id === "crisps" ? 5 : 4);
  });

  it("only puts cast faces in stories, never invitees' names", () => {
    const castNames = Object.values(CAST).map((c) => c.n);
    for (const invite of Object.values(INVITES)) for (const n of invite.people) expect(castNames).not.toContain(n);
  });

  it("files every story under exactly one answer", () => {
    for (const s of STORIES) expect(Object.values(GROUPS).filter((g) => g.ids.includes(s.id))).toHaveLength(1);
  });

  it("chooses the taxi home late on a Friday", () => {
    expect(pickStory(at("2026-11-06T23:30:00"), [], first).id).toBe("taxi");
  });

  it("shows Christmas only in December", () => {
    const xmas = storyById("christmas")!;
    expect(scoreStory(xmas, at("2026-11-07T12:00:00")).sc).toBe(0);
    expect(pickStory(at("2026-12-12T12:00:00"), [], first).id).toBe("christmas");
  });

  it("never repeats a story while others are left", () => {
    const ctx = at("2026-11-06T23:30:00");
    expect(pickStory(ctx, ["taxi"], first).id).not.toBe("taxi");
  });

  it("puts Right now on the answer the clock points at", () => {
    expect(clockGroup(at("2026-11-06T23:30:00"))).toBe("night");
    expect(clockGroup(at("2026-11-10T12:00:00"))).toBe("work");
  });

  it("picks inside the chosen answer", () => {
    const s = pickInGroup("trip", at("2026-11-07T10:00:00"), [], first);
    expect(GROUPS.trip.ids).toContain(s.id);
  });

  it("routes arrivals", () => {
    expect(startScreen(arrivalFrom("invite-trip"))).toBe("invited");
    expect(startScreen(arrivalFrom("link-villa"))).toBe("intro");
    expect(startScreen(arrivalFrom("link-nothing"))).toBe("pick");
    expect(startScreen(arrivalFrom(undefined))).toBe("pick");
  });
});

describe("opening maths", () => {
  it("splits with the odd pennies left with the payer", () => {
    expect(split(4860, 5)).toEqual({ each: 972, rem: 0 });
    expect(split(1000, 3)).toEqual({ each: 333, rem: 1 });
  });

  it("writes money as the prototype does", () => {
    expect(storyMoney(245000)).toBe("£2,450.00");
    expect(storyMoney(24000, "€")).toBe("€240.00");
  });

  it("settles each story's week with fewer payments, and everyone ends at zero", () => {
    for (const s of STORIES) {
      const people = demoPeople(s);
      const selected = people.map((_, i) => i < Math.min(people.length, 5));
      const week = computeWeek(s, people, selected);
      expect(week.bills).toHaveLength(3);
      expect(week.pays.length).toBeLessThan(week.ious);
      const after: Record<string, number> = { ...week.net };
      for (const p of week.pays) { after[p.from] += p.amt; after[p.to] -= p.amt; }
      for (const k of people) expect(after[k]).toBe(0);
      const totalPaid = Object.values(week.paid).reduce((a, b) => a + b, 0);
      const totalShares = Object.values(week.share).reduce((a, b) => a + b, 0);
      expect(totalPaid).toBe(totalShares);
    }
  });
});

describe("story slides", () => {
  it("never shows the same photo twice in one story", () => {
    for (const s of STORIES) {
      const imgs = s.beats.map((b) => b.img);
      expect(new Set(imgs).size, s.id).toBe(imgs.length);
    }
  });
});

describe("signing out", () => {
  it("remembers a sign-out and starts a new person's demo empty", async () => {
    const { readOpening } = await import("../src/opening/store");
    expect(readOpening(JSON.stringify({ done: false, signedOut: true })).signedOut).toBe(true);
    expect(readOpening(null).signedOut).toBe(false);
    const { demoBackend } = await import("../src/lib/demo");
    const demo = demoBackend();
    await demo.signOut();
    demo.startFresh?.();
    await demo.signIn("", "");
    expect(await demo.communes()).toHaveLength(0);
    await demo.signOut();
    await demo.signIn("", "");
    expect((await demo.communes()).length).toBeGreaterThan(0);
  });
});
