import { readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const longDash = /[\u2014\u2015\u2e3a\u2e3b]|&mdash;|&#(?:8212|x2014);/iu;
const webRoot = process.cwd();

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(path)
      : /\.(?:ts|tsx|html)$/.test(entry.name) ? [path] : [];
  });
}

function offendingCopy(path: string): string[] {
  const source = readFileSync(path, "utf8");
  if (path.endsWith(".html")) {
    return longDash.test(source) ? [relative(webRoot, path)] : [];
  }
  const tree = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const matches: string[] = [];
  function inspect(node: ts.Node) {
    if ((ts.isStringLiteralLike(node) || ts.isTemplateHead(node)
      || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)
      || ts.isJsxText(node)) && longDash.test(node.text)) {
      const { line } = tree.getLineAndCharacterOfPosition(node.getStart(tree));
      matches.push(`${relative(webRoot, path)}:${line + 1}`);
    }
    ts.forEachChild(node, inspect);
  }
  inspect(tree);
  return matches;
}

describe("product copy punctuation", () => {
  it.each([
    "src",
    "public",
    "../reminder-worker/src",
    "../local-api/src",
  ])("keeps long dashes out of product-authored copy in %s", (directory) => {
    const matches = sourceFiles(resolve(webRoot, directory)).flatMap(offendingCopy);
    expect(matches).toEqual([]);
  });

  it("recognizes long dashes without rejecting numeric ranges or minus signs", () => {
    for (const dash of ["\u2014", "\u2015", "\u2e3a", "\u2e3b", "&mdash;", "&#8212;", "&#x2014;"]) {
      expect(longDash.test(`Copy ${dash} continuation`)).toBe(true);
    }
    for (const copy of ["-", "-£15.00", "12\u2013128 characters", "1-25 results", "2026-10-02"]) {
      expect(longDash.test(copy)).toBe(false);
    }
  });
});
