// @vitest-environment node
import { describe, expect, it } from "vitest";
import { enqueue, flush, isNetworkError, parseOutbox, type Queued } from "../src/lib/outbox";

const report = (id: string): Queued => ({
  id, kind: "report", communeId: "c1", shareId: `s-${id}`, label: "Sam",
  input: { amountMinor: 1200, sentOn: "2026-11-07", reference: null, requestId: id },
});
const offline = Object.assign(new Error("Commune can’t be reached."), { status: 0 });
const refused = Object.assign(new Error("Already settled"), { status: 409 });

describe("outbox", () => {
  it("queues a request id only once", () => {
    const once = enqueue([], report("a"));
    expect(enqueue(once, report("a"))).toHaveLength(1);
    expect(enqueue(once, report("b"))).toHaveLength(2);
  });

  it("knows a dropped connection from a refusal", () => {
    expect(isNetworkError(offline)).toBe(true);
    expect(isNetworkError(refused)).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });

  it("sends in order and keeps the rest when the signal drops again", async () => {
    const seen: string[] = [];
    const result = await flush([report("a"), report("b"), report("c")], async (item) => {
      if (item.id === "b") throw offline;
      seen.push(item.id);
    });
    expect(seen).toEqual(["a"]);
    expect(result.sent.map((item) => item.id)).toEqual(["a"]);
    expect(result.left.map((item) => item.id)).toEqual(["b", "c"]);
  });

  it("drops a record the server refuses instead of retrying it forever", async () => {
    const result = await flush([report("a"), report("b")], async (item) => { if (item.id === "a") throw refused; });
    expect(result.failed.map((entry) => entry.item.id)).toEqual(["a"]);
    expect(result.sent.map((item) => item.id)).toEqual(["b"]);
    expect(result.left).toEqual([]);
  });

  it("reads back only what looks like a queue", () => {
    expect(parseOutbox(null)).toEqual([]);
    expect(parseOutbox("not json")).toEqual([]);
    expect(parseOutbox(JSON.stringify([report("a"), { id: 3 }, { id: "x", kind: "other" }]))).toHaveLength(1);
  });
});
