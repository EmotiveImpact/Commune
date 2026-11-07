// @vitest-environment node
import { describe, expect, it } from "vitest";
import { reminderChoices } from "../src/lib/remindTimes";

describe("reminder times", () => {
  it("offers 7pm tonight and 8am tomorrow during the day", () => {
    const [tonight, morning] = reminderChoices(new Date(2026, 10, 7, 9, 15));
    expect(tonight.at).toEqual(new Date(2026, 10, 7, 19, 0));
    expect(tonight.words).toBe("tonight at 7pm");
    expect(morning.at).toEqual(new Date(2026, 10, 8, 8, 0));
  });

  it("offers an hour from now once 7pm is close or past", () => {
    const now = new Date(2026, 10, 7, 18, 45);
    const [soon] = reminderChoices(now);
    expect(soon.at).toEqual(new Date(2026, 10, 7, 19, 45));
    expect(soon.label).toBe("Remind me in an hour");
  });

  it("rolls tomorrow morning over the end of a month", () => {
    const [, morning] = reminderChoices(new Date(2026, 10, 30, 22, 0));
    expect(morning.at).toEqual(new Date(2026, 11, 1, 8, 0));
  });
});
