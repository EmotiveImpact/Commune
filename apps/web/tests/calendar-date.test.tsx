import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CalendarDate } from "../src/ui/CalendarDate";

afterEach(cleanup);

// The full date is visually hidden text inside <time>; the stacked parts are
// for sight only.
function calendar(description: string) {
  const hidden = screen.getByText(description);
  expect(hidden.classList.contains("c-visually-hidden")).toBe(true);
  const time = hidden.closest("time");
  if (!time) throw new Error("No <time> around " + description);
  expect(time.firstElementChild).toBe(hidden);
  return time;
}
const visible = (time: Element) => [...time.children]
  .filter(child => child.getAttribute("aria-hidden") === "true")
  .map(child => child.textContent);

describe("shared Operations calendar", () => {
  it("stacks weekday, number and Today without changing the actual date", () => {
    render(<CalendarDate date="2026-10-02" today="2026-10-02" />);
    const date = calendar("Friday, 2 October 2026 (Today)");
    expect(date.tagName).toBe("TIME");
    expect(date.getAttribute("datetime")).toBe("2026-10-02");
    expect(date.classList.contains("is-today")).toBe(true);
    expect(date.hasAttribute("aria-label")).toBe(false);
    expect(visible(date)).toEqual(["Fri", "2", "Today"]);
  });
  it("handles Tomorrow across a month/year boundary", () => {
    render(<CalendarDate date="2027-01-01" today="2026-12-31" label="Due" />);
    expect(visible(calendar("Due: Friday, 1 January 2027 (Tomorrow)")).join("")).toBe("Fri1Tomorrow");
  });
  it("adds a month for dates outside the week and can preserve Operations' plain footer", () => {
    const { rerender } = render(<CalendarDate date="2026-11-12" today="2026-10-02" />);
    expect(visible(calendar("Thursday, 12 November 2026")).join("")).toBe("Thu12Nov");
    rerender(<CalendarDate date="2026-11-12" today="2026-10-02" showMonth={false} className="ops-week-date" />);
    expect(visible(calendar("Thursday, 12 November 2026")).join("")).toBe("Thu12");
    expect(document.querySelector(".ops-week-date.c-calendar-date")).not.toBeNull();
  });
  it.each(["", "not-a-date", "2026-02-30", "2026-13-01", "2026-10-02T23:00:00Z"])("does not invent a calendar date for %s", date => {
    const { container } = render(<CalendarDate date={date} />);
    expect(container.querySelector("time")).toBeNull();
  });
  it("has a single stylesheet shared by the app and document, with protected Operations columns", () => {
    const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
    // Bundled with the app's styles, so it no longer holds up the first paint.
    expect(read("index.html")).not.toContain("calendar-date.css");
    expect(read("src/styles/index.css")).toContain('@import "./calendar-date.css" layer(base);');
    expect(read("reference/design-language/index.html")).toContain('href="/src/styles/calendar-date.css"');
    const css = read("src/styles/calendar-date.css");
    expect(css).toContain("width: 60px;");
    expect(css).toContain("width: 52px;");
    expect(css).toContain(".a-body.is-dark .c-calendar-date");
    expect(css).not.toMatch(/box-shadow\s*:|border-left\s*:/);
    expect(read("src/screens/Hub.css")).not.toContain(".c-hub-date {");
    expect(read("src/styles/app.css")).toContain("grid-template-columns: 72px 1fr;");
    expect(read("src/styles/app.css")).toContain("grid-template-columns: 56px 1fr;");
  });
});
