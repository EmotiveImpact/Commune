// @vitest-environment node
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Everything in public/ is published on the app's domain as it is. Design
// references and prototypes live in reference/, which only the dev server
// serves.
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]);
}

describe("published files", () => {
  it("publishes only the app's own files", () => {
    const root = join(process.cwd(), "public");
    expect(files(root).map((file) => relative(root, file)).sort())
      .toEqual(["favicon.svg", "logo-mark.svg", "logo.png", "styles/calendar-date.css"]);
  });
});
