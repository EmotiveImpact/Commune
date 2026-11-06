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
    expect(hits.every((hit) => hit.title === "Alex Rivera" && hit.meta.startsWith("Member · "))).toBe(true);
  });
  it("shows expenses with their amount in pence", async () => {
    const all = await snapshots();
    const title = all[0].expenses[0].title;
    const hit = search(all, title).find((item) => item.kind === "expense");
    expect(hit?.meta).toMatch(/^[£€$]\d[\d,]*\.\d\d · /);
  });
});
