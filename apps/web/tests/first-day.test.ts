import { beforeEach, describe, expect, it } from "vitest";
import { forgetFirstDay, readFirstDay, rememberFirstDay } from "../src/data/firstDay";

// The first-day card's note (joining flow, 8 November 2026).
describe("first-day note", () => {
  beforeEach(() => localStorage.clear());
  const joined = new Date("2026-11-08T10:00:00Z");

  it("is kept per person and read back", () => {
    rememberFirstDay("user-2", "house-1", "14 Park Street", joined);
    expect(readFirstDay("user-2", joined)).toEqual({ communeId: "house-1", house: "14 Park Street", at: joined.toISOString() });
    expect(readFirstDay("user-3", joined)).toBeNull();
    expect(readFirstDay(null)).toBeNull();
  });

  it("goes after two weeks, or once hidden", () => {
    rememberFirstDay("user-2", "house-1", "14 Park Street", joined);
    expect(readFirstDay("user-2", new Date("2026-11-21T10:00:00Z"))).not.toBeNull();
    expect(readFirstDay("user-2", new Date("2026-11-23T10:00:00Z"))).toBeNull();
    expect(localStorage.getItem("commune.first-day.user-2")).toBeNull();
    rememberFirstDay("user-2", "house-1", "14 Park Street", joined);
    forgetFirstDay("user-2");
    expect(readFirstDay("user-2", joined)).toBeNull();
  });

  it("ignores anything malformed", () => {
    localStorage.setItem("commune.first-day.user-2", "{not json");
    expect(readFirstDay("user-2")).toBeNull();
    localStorage.setItem("commune.first-day.user-2", JSON.stringify({ communeId: 1, house: "x", at: "y" }));
    expect(readFirstDay("user-2")).toBeNull();
  });
});
