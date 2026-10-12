// @vitest-environment node
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { build, type Rollup } from "vite";
import { preloadDataClient } from "../vite.config";

type Item = { type: "chunk" | "asset"; fileName: string; isEntry?: boolean; facadeModuleId?: string | null; imports?: string[] };
type Tag = { tag: string; attrs: Record<string, string | boolean>; injectTo: string };

function preloadTags(items: Item[], base = "/"): Tag[] {
  const plugin = preloadDataClient();
  (plugin.configResolved as (config: { base: string }) => void)({ base });
  const hook = plugin.transformIndexHtml as { handler: (html: string, ctx: { bundle?: Record<string, Item> }) => Tag[] };
  return hook.handler("", { bundle: Object.fromEntries(items.map((item) => [item.fileName, item])) });
}

const chunk = (fileName: string, extra: Partial<Item> = {}): Item =>
  ({ type: "chunk", fileName, isEntry: false, facadeModuleId: null, imports: [], ...extra });

describe("preloading the data client", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("names the data client and the chunks it shares, but not the main bundle the page already loads", () => {
    const tags = preloadTags([
      chunk("assets/index-a.js", { isEntry: true, facadeModuleId: "/app/index.html" }),
      chunk("assets/neon-b.js", { facadeModuleId: "/app/src/live/neon.ts", imports: ["assets/index-a.js", "assets/shared-c.js"] }),
      chunk("assets/shared-c.js"),
      chunk("assets/other-d.js", { facadeModuleId: "/app/src/screens/other.tsx" }),
      { type: "asset", fileName: "assets/index-e.css" },
    ], "/app/");
    expect(tags).toEqual(["assets/neon-b.js", "assets/shared-c.js"].map((file) => ({
      tag: "link", attrs: { rel: "modulepreload", crossorigin: true, href: `/app/${file}` }, injectTo: "head",
    })));
  });

  it("adds nothing to a build without the data client, such as a development build", () => {
    expect(preloadTags([chunk("assets/index-a.js", { isEntry: true, facadeModuleId: "/app/index.html" })])).toEqual([]);
  });

  it("is in the index.html of a production build, naming the chunk the app imports", async () => {
    // Vitest runs with NODE_ENV=test, which would build the local app.
    vi.stubEnv("NODE_ENV", "production");
    const root = fileURLToPath(new URL("..", import.meta.url));
    const result = await build({ root, configFile: `${root}vite.config.ts`, logLevel: "silent", build: { write: false } });
    const { output } = (Array.isArray(result) ? result[0] : result) as Rollup.RollupOutput;
    const chunks = output.filter((item): item is Rollup.OutputChunk => item.type === "chunk");
    const entry = chunks.find((item) => item.isEntry);
    const client = chunks.find((item) => item.facadeModuleId?.endsWith("/src/live/neon.ts"));
    expect(client).toBeDefined();
    expect(entry?.dynamicImports).toContain(client!.fileName);
    const html = output.find((item): item is Rollup.OutputAsset => item.fileName === "index.html");
    expect(String(html?.source)).toContain(`<link rel="modulepreload" crossorigin href="/${client!.fileName}">`);
  }, 120_000);
});
