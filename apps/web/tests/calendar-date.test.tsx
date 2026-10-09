import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CalendarDate } from "../src/ui/CalendarDate";

afterEach(cleanup);

describe("shared Operations calendar", () => {
  it("stacks weekday, number and Today without changing the actual date", () => {
    render(<CalendarDate date="2026-10-02" today="2026-10-02" />);
    const date = screen.getByLabelText("Friday, 2 October 2026 (Today)");
    expect(date.tagName).toBe("TIME");
    expect(date.getAttribute("datetime")).toBe("2026-10-02");
    expect(date.classList.contains("is-today")).toBe(true);
    expect([...date.children].map(child => child.textContent)).toEqual(["Fri", "2", "Today"]);
  });
  it("handles Tomorrow across a month/year boundary", () => {
    render(<CalendarDate date="2027-01-01" today="2026-12-31" label="Due" />);
    expect(screen.getByLabelText("Due: Friday, 1 January 2027 (Tomorrow)").textContent).toBe("Fri1Tomorrow");
  });
  it("adds a month for dates outside the week and can preserve Operations' plain footer", () => {
    const { rerender } = render(<CalendarDate date="2026-11-12" today="2026-10-02" />);
    expect(screen.getByLabelText("Thursday, 12 November 2026").textContent).toBe("Thu12Nov");
    rerender(<CalendarDate date="2026-11-12" today="2026-10-02" showMonth={false} className="ops-week-date" />);
    expect(screen.getByLabelText("Thursday, 12 November 2026").textContent).toBe("Thu12");
    expect(document.querySelector(".ops-week-date.c-calendar-date")).not.toBeNull();
  });
  it.each(["", "not-a-date", "2026-02-30", "2026-13-01", "2026-10-02T23:00:00Z"])("does not invent a calendar date for %s", date => {
    const { container } = render(<CalendarDate date={date} />);
    expect(container.querySelector("time")).toBeNull();
  });
  it("has a single stylesheet shared by the app and document, with protected Operations columns", () => {
    const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
    expect(read("index.html")).toContain('href="/styles/calendar-date.css"');
    expect(read("reference/design-language/index.html")).toContain('href="/styles/calendar-date.css"');
    const css = read("public/styles/calendar-date.css");
    expect(css).toContain("width: 60px;");
    expect(css).toContain("width: 52px;");
    expect(css).toContain(".a-body.is-dark .c-calendar-date");
    expect(css).not.toMatch(/box-shadow\s*:|border-left\s*:/);
    expect(read("src/screens/Hub.css")).not.toContain(".c-hub-date {");
    expect(read("src/styles/app.css")).toContain("grid-template-columns: 72px 1fr;");
    expect(read("src/styles/app.css")).toContain("grid-template-columns: 56px 1fr;");
  });
});
