// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Finding 61: every rule sits in a cascade layer, so a screen's stylesheet
// that arrives later with its code cannot change which rule wins.
const src = resolve(process.cwd(), "src");
const read = (path: string) => readFileSync(resolve(src, path), "utf8");
const stylesheets = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = resolve(directory, entry.name);
  return entry.isDirectory() ? stylesheets(path) : entry.name.endsWith(".css") ? [relative(src, path)] : [];
});
const withoutComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/** The blocks at the top level of a stylesheet, as their preludes ("@layer screens"). */
function topLevel(css: string): string[] {
  const text = withoutComments(css);
  const blocks: string[] = [];
  let depth = 0;
  let prelude = "";
  for (const char of text) {
    if (char === "{") {
      if (depth === 0) blocks.push(prelude.trim());
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) prelude = "";
    } else if (depth === 0) {
      prelude += char;
      if (char === ";") { blocks.push(prelude.trim()); prelude = ""; }
    }
  }
  expect(depth).toBe(0);
  return blocks;
}

describe("cascade layers", () => {
  const index = read("styles/index.css");

  it("are declared, lowest first, before anything else", () => {
    expect(topLevel(index)[0]).toBe("@layer base, screens, overrides;");
    const main = read("main.tsx");
    expect(main.match(/^import .*$/m)?.[0]).toBe('import "./styles/index.css";');
  });

  it("hold every shared stylesheet, in its old order, with only the font faces outside", () => {
    expect(topLevel(index).slice(1)).toEqual([
      '@import "./calendar-date.css" layer(base);',
      '@import "./shared.css" layer(base);',
      '@import "./app.css" layer(base);',
      '@import "./auth.css" layer(base);',
      '@import "./legal.css" layer(base);',
      '@import "./overrides.css" layer(overrides);',
      '@import "./design-system.css" layer(overrides);',
      '@import "./fonts.css";',
    ]);
    expect(stylesheets(resolve(src, "styles")).sort()).toEqual([
      "styles/app.css", "styles/auth.css", "styles/calendar-date.css", "styles/design-system.css",
      "styles/fonts.css", "styles/index.css", "styles/legal.css", "styles/overrides.css", "styles/shared.css",
    ]);
    expect(topLevel(read("styles/fonts.css")).every((block) => block === "@font-face")).toBe(true);
  });

  it("hold every screen's and window's stylesheet in screens, or overrides where a rule must win there", () => {
    const own = stylesheets(src).filter((path) => !path.startsWith("styles/"));
    expect(own.length).toBeGreaterThan(0);
    for (const path of own) {
      const blocks = topLevel(read(path));
      expect(blocks[0], path).toBe("@layer screens");
      for (const block of blocks) expect(["@layer screens", "@layer overrides"], path).toContain(block);
    }
  });
});
