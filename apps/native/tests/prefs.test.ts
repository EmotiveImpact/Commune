// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DEFAULT_NOTIFY, notifySummary, readPrefs, shouldRelock } from "../src/lib/prefsStore";

describe("phone preferences", () => {
  it("keeps the old saved layout choice and fills in the rest", () => {
    const saved = readPrefs(JSON.stringify({ hubTabsAt: "bottom" }));
    expect(saved).toEqual({ hubTabsAt: "bottom", appearance: "match", faceId: false, notify: DEFAULT_NOTIFY });
  });

  it("ignores values it does not understand", () => {
    const saved = readPrefs(JSON.stringify({ appearance: "sepia", faceId: "yes", notify: { due: false, junk: true } }));
    expect(saved.appearance).toBe("match");
    expect(saved.faceId).toBe(false);
    expect(saved.notify.due).toBe(false);
    expect(readPrefs("not json").hubTabsAt).toBe("top");
  });

  it("says how many notification kinds are on, as v7 did", () => {
    expect(notifySummary(DEFAULT_NOTIFY)).toBe("5 of 6 kinds on");
    expect(notifySummary({ ...DEFAULT_NOTIFY, expense: true })).toBe("All kinds on");
  });

  it("asks for Face ID again only after a minute away", () => {
    expect(shouldRelock(null, 1000)).toBe(false);
    expect(shouldRelock(0, 59_000)).toBe(false);
    expect(shouldRelock(0, 60_000)).toBe(true);
  });
});
