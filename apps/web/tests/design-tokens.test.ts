import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readStyle = (path: string) => readFileSync(resolve(process.cwd(), "src", path), "utf8");

const styles = {
  shared: readStyle("styles/shared.css"),
  app: readStyle("styles/app.css"),
  primitives: readStyle("styles/design-system.css"),
  hub: readStyle("screens/Hub.css"),
  money: readStyle("screens/Money.css"),
  notes: readStyle("screens/Notes.css"),
  auth: readStyle("styles/auth.css"),
};

function declarations(sheet: keyof typeof styles, selector: string) {
  const source = `\n${styles[sheet]}`;
  const start = source.indexOf(`\n${selector} {`);
  if (start < 0) throw new Error(`Missing ${selector} in ${sheet}`);
  return source.slice(source.indexOf("{", start) + 1, source.indexOf("}", start));
}

describe("shared page header contract", () => {
  it("keeps Hub header styling in the shared shell, including responsive rules", () => {
    expect(styles.hub).not.toMatch(/\.hub-editorial\s+\.a-header(?:\b|[-\s])/);
    expect(declarations("app", ".a-header")).toContain("padding: 12px 28px;");
    expect(declarations("app", ".a-header")).toContain("color: var(--ink);");
    expect(declarations("primitives", ".a-header-title h1")).toContain("font-size: 21px;");
    expect(declarations("primitives", ".a-header-title h1")).toContain("font-weight: 550;");
  });
});

describe("Settle share action alignment", () => {
  it("right-aligns the buttons and their guidance while allowing narrow rows to wrap", () => {
    const actions = declarations("money", ".c-settle-column .a-row-actions");
    expect(actions).toContain("display: flex;");
    expect(actions).toContain("justify-content: flex-end;");
    expect(actions).toContain("gap: 8px;");
    expect(actions).toContain("flex-wrap: wrap;");
    expect(declarations("money", ".c-settle-column .c-action-hint")).toContain("text-align: right;");
  });
});

describe("shared corner contracts", () => {
  it("defines a single control/surface family with legacy aliases", () => {
    expect(styles.shared).toContain("--radius-control: 9px;");
    expect(styles.shared).toContain("--radius-surface: 15px;");
    expect(styles.shared).toContain("--radius: var(--radius-surface);");
    expect(styles.shared).toContain("--radius-sm: var(--radius-control);");
    expect(styles.primitives).not.toMatch(/--radius(?:-sm)?:\s*\d/);
  });

  it.each([
    ["app", ".a-search"],
    ["app", ".a-icon-btn"],
    ["app", ".a-btn"],
    ["app", ".a-window-x"],
    ["app", ".a-field textarea"],
    ["primitives", ".c-dialog-close"],
    ["hub", ".c-hub-button"],
    ["hub", ".c-hub-settings"],
    ["notes", ".notes-toolbar select"],
    ["notes", ".note-icon-button"],
    ["auth", ".commune-auth-field input"],
    ["auth", ".commune-auth-btn"],
  ] as const)("uses the control token for %s %s", (sheet, selector) => {
    expect(declarations(sheet, selector)).toContain("border-radius: var(--radius-control);");
  });

  it.each([
    ["app", ".a-window-frame"],
    ["primitives", ".c-product-dialog"],
    ["hub", ".c-hub-identity"],
    ["hub", ".c-hub-panel"],
    ["money", ".c-expense-entry"],
    ["money", ".c-reminder-dialog"],
    ["notes", ".note-tile"],
    ["notes", ".note-reader"],
  ] as const)("uses the surface token for %s %s", (sheet, selector) => {
    expect(declarations(sheet, selector)).toContain("border-radius: var(--radius-surface);");
  });

  it("keeps portraits and status labels intentionally round", () => {
    expect(declarations("shared", ".avatar")).toContain("border-radius: var(--radius-pill);");
    expect(declarations("shared", ".pill")).toContain("border-radius: var(--radius-pill);");
    expect(declarations("app", ".a-icon-btn.a-you-btn")).toContain("border-radius: var(--radius-pill);");
  });

  it("uses the surface token for the top corners of narrow dialog sheets", () => {
    expect(declarations("app", ".a-body.is-native .a-window-frame")).toContain(
      "border-radius: var(--radius-surface) var(--radius-surface) 0 0;",
    );
    expect(styles.app.includes("border-radius: 20px 20px 0 0;")).toBe(false);
  });
});
