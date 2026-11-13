// @vitest-environment node
import { describe, expect, it } from "vitest";
import { googlePlaces, tidyAddress } from "../src/lib/places";

describe("googlePlaces", () => {
  it("asks once per query with the key and session, and picks the full address in the same session", async () => {
    const calls: Array<{ url: string; init: { method?: string; headers: Record<string, string>; body?: string } }> = [];
    const replies = [
      { suggestions: [{ placePrediction: { placeId: "abc", structuredFormat: { mainText: { text: "22 Elm Road" }, secondaryText: { text: "London E17, UK" } } } }, { queryPrediction: {} }] },
      { formattedAddress: "22 Elm Rd, London E17 4QS, UK" },
    ];
    let n = 0;
    const search = googlePlaces("KEY", async (url, init) => { calls.push({ url, init }); const body = replies[calls.length - 1]; return { ok: true, json: async () => body }; },
      () => `t${++n}`);
    const rows = await search.suggest("22 elm");
    expect(rows.map(({ title, subtitle }) => ({ title, subtitle }))).toEqual([{ title: "22 Elm Road", subtitle: "London E17" }]);
    expect(calls[0].init.headers["X-Goog-Api-Key"]).toBe("KEY");
    expect(JSON.parse(calls[0].init.body!)).toMatchObject({ input: "22 elm", sessionToken: "t1" });
    expect(await rows[0].pick()).toBe("22 Elm Rd, London E17 4QS");
    expect(calls[1].url).toContain("/places/abc?sessionToken=t1");
    expect(calls[1].init.headers["X-Goog-FieldMask"]).toBe("formattedAddress");
  });

  it("asks nothing for under three letters and falls back to the suggestion when details fail", async () => {
    let asked = 0;
    const search = googlePlaces("KEY", async () => {
      asked += 1;
      return asked === 1
        ? { ok: true, json: async () => ({ suggestions: [{ placePrediction: { placeId: "x", text: { text: "Unit 4, Hackney Wick" } } }] }) }
        : { ok: false, json: async () => ({}) };
    });
    expect(await search.suggest("ab")).toEqual([]);
    expect(asked).toBe(0);
    const [row] = await search.suggest("unit 4");
    expect(await row.pick()).toBe("Unit 4, Hackney Wick");
  });

  it("drops a trailing UK", () => {
    expect(tidyAddress("1 High St, Leeds LS1 1AA, United Kingdom")).toBe("1 High St, Leeds LS1 1AA");
    expect(tidyAddress("10 Main St, Austin, TX, USA")).toBe("10 Main St, Austin, TX, USA");
  });
});
