// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = new URL("../src/styles/", import.meta.url);
const css = readFileSync(new URL("fonts.css", styles), "utf8");
const faces = css.match(/@font-face\s*{[^}]*}/g) ?? [];
const family = (face: string) => /font-family:\s*"([^"]+)"/.exec(face)?.[1];

describe("self-hosted fonts", () => {
  it("serves Inter and the wordmark from files kept with the app", () => {
    expect(faces.map(family)).toEqual([...Array<string>(7).fill("Inter"), "DM Sans Wordmark"]);
    for (const face of faces) {
      const file = /src:\s*url\("(\.\/fonts\/[\w-]+\.woff2)"\)\s*format\("woff2"\);/.exec(face)?.[1];
      expect(file).toBeTruthy();
      expect(existsSync(new URL(file!, styles))).toBe(true);
    }
  });

  it("keeps every Inter subset the old Google Fonts link served, so names in other scripts stay in Inter", () => {
    const inter = faces.filter((face) => family(face) === "Inter");
    expect(inter.map((face) => /inter-([\w-]+)\.woff2/.exec(face)?.[1]))
      .toEqual(["cyrillic-ext", "cyrillic", "greek-ext", "greek", "vietnamese", "latin-ext", "latin"]);
    // A browser downloads a subset only for a page that shows one of its characters.
    for (const face of inter) expect(face).toMatch(/unicode-range: U\+[0-9A-F]{4}/);
  });

  it("shows text straight away and swaps the font in when it arrives", () => {
    for (const face of faces) expect(face).toContain("font-display: swap;");
  });

  it("keeps each font's licence beside it", () => {
    for (const licence of ["fonts/Inter-OFL.txt", "fonts/DMSans-OFL.txt"]) {
      expect(readFileSync(new URL(licence, styles), "utf8")).toContain("SIL OPEN FONT LICENSE Version 1.1");
    }
  });

  it("draws the wordmark with the subset made for it", () => {
    const app = readFileSync(new URL("app.css", styles), "utf8");
    expect(/\.a-wordmark\s*{[^}]*font-family:\s*"DM Sans Wordmark"/.exec(app)).not.toBeNull();
    const main = readFileSync(new URL("../main.tsx", styles), "utf8");
    expect(main).toContain('import "./styles/fonts.css";');
    expect(main).not.toContain("@fontsource");
  });
});
