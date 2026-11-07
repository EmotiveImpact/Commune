// @vitest-environment node
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  arrivalFrom, clockGroup, computeWeek, ctxFrom, demoPeople, demoSelected, demoSplit, firstBillCard, FOCAL, IMAGE_KEYS, imageFile,
  loadingLines, pickInGroup, pickStory, scoreStory, split, startScreen, storyById, storyMoney, toggleDemo,
  CAST, GENERAL_LINES, GROUPS, INVITES, STORIES, type ImageKey,
} from "../src/stories";

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

  it("has a photo file for every key, and a key for every photo a story uses", () => {
    const folder = fileURLToPath(new URL("../assets/stories", import.meta.url));
    const files = new Set(readdirSync(folder));
    for (const key of IMAGE_KEYS) expect(files, key).toContain(imageFile(key));
    expect(files.size).toBe(IMAGE_KEYS.length);
    const used: ImageKey[] = [
      ...STORIES.flatMap((s) => [s.bill.img, ...s.beats.map((b) => b.img)]),
      ...Object.values(CAST).flatMap((c) => [c.img, c.av]),
      ...Object.values(GROUPS).map((g) => g.img),
      ...Object.values(INVITES).map((i) => i.img),
      ...(Object.keys(FOCAL) as ImageKey[]),
    ];
    for (const key of used) expect(IMAGE_KEYS).toContain(key);
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
    const seen: string[] = [];
    for (let i = 0; i < STORIES.length; i++) seen.push(pickStory(ctx, seen, first).id);
    expect(new Set(seen).size).toBe(STORIES.length - 1);
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

  it("loads with two of the story's lines, one general line, then its signature", () => {
    const s = storyById("crisps")!;
    const lines = loadingLines(s, first);
    expect(lines).toHaveLength(4);
    expect(s.lines).toContain(lines[0]);
    expect(GENERAL_LINES).toContain(lines[1]);
    expect(s.lines).toContain(lines[2]);
    expect(lines[2]).not.toBe(lines[0]);
    expect(lines[3]).toBe("Finding the crisps");
  });

  it("words the empty-screen card as the prototype does", () => {
    expect(firstBillCard(storyById("birthday")!).line).toBe("Mei added Leo's present and Commune split it in seconds. Yours works the same way.");
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

  it("words the demo split as the prototype does", () => {
    const crisps = storyById("crisps")!;
    const people = demoPeople(crisps);
    expect(people).toEqual(["you", "maya", "jp", "theo", "ama", "mei"]);
    const selected = demoSelected(people);
    expect(selected).toEqual([true, true, true, true, true, false]);
    const five = demoSplit(crisps, selected);
    expect(five.title).toBe("Split the picnic in the park.");
    expect(five.lede).toBe("Your turn. Maya paid. Tap who was there.");
    expect(five.line).toBe("5 people, so 4 of you owe Maya £9.72. It divides exactly.");
    const six = demoSplit(crisps, toggleDemo(selected, 5));
    expect(six.line).toBe("6 people, so 5 of you owe Maya £8.10. It divides exactly.");
    const taxi = storyById("taxi")!;
    const two = [true, true, false, false, false];
    expect(demoSplit(taxi, two).line).toBe("2 people, so 1 person owes Maya £19.00. It divides exactly.");
    expect(demoSplit(storyById("lunch")!, [true, true, true]).line).toBe("3 people, so 2 of you owe Ama £32.13. The 1p that doesn't divide stays with Ama.");
    expect(demoSplit(storyById("villa")!, [true, true, true, false, false]).line).toBe("3 people, so 2 of you owe Mei €80.00. It divides exactly.");
  });

  it("keeps you, the payer and at least two people in the demo split", () => {
    expect(toggleDemo([true, true, true], 0)).toEqual([true, true, true]);
    expect(toggleDemo([true, true, true], 1)).toEqual([true, true, true]);
    expect(toggleDemo([true, true, false], 1)).toEqual([true, true, false]);
    expect(toggleDemo([true, true, true], 2)).toEqual([true, true, false]);
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
