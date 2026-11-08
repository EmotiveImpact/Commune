// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The phone app keeps its own dependencies, so it carries a copy of the
// contact invitation rules. This keeps the copy from drifting.
describe("the phone app's copy of the contact invitation rules", () => {
  it("matches packages/core", () => {
    const root = resolve(__dirname, "../../..");
    expect(readFileSync(resolve(root, "apps/native/src/lib/contactInvite.ts"), "utf8"))
      .toBe(readFileSync(resolve(root, "packages/core/src/contactInvite.ts"), "utf8"));
  });
});
