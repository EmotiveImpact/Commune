import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { formatDay } from "@commune/core";
import { parseSearchResponse, searchMeta, type SearchResult } from "../src/live/search";
import { SearchResults } from "../src/ui/SearchResults";

// Since 0040 each search result carries its date on its own, so the finder
// writes it as every screen does instead of the database's "Due 2026-11-04".
const result = (fields: Partial<SearchResult>): SearchResult => ({
  kind: "recurring", id: "bill-1", communeId: "home-1", communeName: "Brooklyn loft", title: "Internet", subtitle: "Monthly",
  meta: "Due 2026-11-04", label: "Due", date: "2026-11-04", amountMinor: 3210, currency: "USD", ...fields,
});
afterEach(cleanup);

describe("dates in search results", () => {
  it("writes a recurring bill's and a task's date the app's way", () => {
    expect(searchMeta(result({}))).toBe(`Due ${formatDay("2026-11-04")}`);
    expect(searchMeta(result({ kind: "operation", meta: "Task · 2026-10-20", label: "Task", date: "2026-10-20" })))
      .toBe(`Task · ${formatDay("2026-10-20")}`);
    expect(searchMeta(result({ meta: "Paused", label: "Paused", date: null }))).toBe("Paused");
    expect(searchMeta(result({ kind: "expense", meta: "Open", label: "Open", date: null }))).toBe("Open");
  });

  it("shows a database's own text while it sends no separate date", () => {
    const { label: _label, date: _date, ...older } = result({});
    expect(searchMeta(older)).toBe("Due 2026-11-04");
    expect(parseSearchResponse({ query: "int", items: [older], total: 1, hasMore: false }).items[0].meta).toBe("Due 2026-11-04");
  });

  it("refuses a malformed date or label", () => {
    for (const bad of [{ date: "04/11/2026" }, { date: 20261104 }, { label: 7 }]) {
      expect(() => parseSearchResponse({ query: "int", items: [{ ...result({}), ...bad }], total: 1, hasMore: false })).toThrow("invalid response");
    }
  });

  it("shows the date and amount in the finder", () => {
    render(<SearchResults result={{ query: "int", items: [result({})], total: 1, hasMore: false }} pending={false} error=""
      query="int" retry={() => undefined} onOpen={() => undefined} listId="results" />);
    const row = screen.getByRole("button", { name: /Internet/ });
    expect(row.textContent).toContain(`$32.10Due ${formatDay("2026-11-04")}`);
    expect(row.textContent).not.toContain("2026-11-04");
  });
});
