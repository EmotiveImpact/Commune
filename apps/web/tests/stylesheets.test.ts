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
      '@import "./motion.css" layer(overrides);',
      '@import "./fonts.css";',
    ]);
    expect(stylesheets(resolve(src, "styles")).sort()).toEqual([
      "styles/app.css", "styles/auth.css", "styles/calendar-date.css", "styles/design-system.css",
      "styles/fonts.css", "styles/index.css", "styles/legal.css", "styles/motion.css", "styles/overrides.css", "styles/shared.css",
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

describe("colours", () => {
  it("are written as the token wherever a token holds that colour on every element", () => {
    // A token defined once (on :root) and never set again has the same colour
    // everywhere, so a literal of that colour can always name it instead.
    // calendar-date.css keeps literals: the HTML design reference links it on
    // its own, without the app's tokens.
    const sheets = stylesheets(src).filter((path) => path !== "styles/calendar-date.css");
    const css = sheets.map((path) => [path, withoutComments(read(path))] as const);
    const hex = (value: string) => {
      const digits = value.slice(1).toLowerCase();
      return digits.length === 3 ? [...digits].map((digit) => digit + digit).join("") : digits;
    };
    const definitions = new Map<string, string[]>();
    for (const [, text] of css) {
      for (const [, name, value] of text.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) {
        definitions.set(name, [...(definitions.get(name) ?? []), value.trim()]);
      }
    }
    const fixed = new Map([...definitions]
      .filter(([, values]) => values.length === 1 && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(values[0]))
      .map(([name, [value]]) => [hex(value), name]));
    expect(fixed.get("1a1e2b")).toBe("--navy");
    expect(fixed.get("2d6a4f")).toBe("--sage");
    const literals = css.flatMap(([path, text]) => [...text.replace(/--[\w-]+\s*:[^;}]+/g, "").matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)]
      .filter(([match]) => fixed.has(hex(match)))
      .map(([match]) => `${path}: ${match} is ${fixed.get(hex(match))}`));
    expect(literals).toEqual([]);
  });
});
