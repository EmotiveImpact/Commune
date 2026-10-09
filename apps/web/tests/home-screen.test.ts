// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Finding 56: adding Commune to a phone's home screen gives it its name and
// icon, and the page says what it is, in British English.
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url));
const html = read("index.html").toString();
const manifest = JSON.parse(read("public/manifest.webmanifest").toString()) as {
  name: string; short_name: string; description: string; lang: string; start_url: string; scope: string; display: string;
  theme_color: string; background_color: string; icons: Array<{ src: string; sizes: string; type: string; purpose?: string }>;
};
/** A PNG's width and height, from its header. */
function pixels(path: string): string {
  const png = read(path);
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  return `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`;
}

describe("the home-screen app", () => {
  it("is named Commune, in British English, and opens as an app on the theme colour", () => {
    expect(manifest).toMatchObject({ name: "Commune", short_name: "Commune", lang: "en-GB", start_url: "/", scope: "/", display: "standalone" });
    expect(html).toContain(`<meta name="theme-color" content="${manifest.theme_color}" />`);
    expect(manifest.background_color).toBe("#f5f1ea");
  });

  it("has icons at 192 and 512 pixels, a maskable one and an Apple touch icon, each the size it says", () => {
    for (const icon of manifest.icons) {
      expect(icon.type).toBe("image/png");
      expect(pixels(`public${icon.src}`), icon.src).toBe(icon.sizes);
    }
    expect(manifest.icons.map((icon) => `${icon.sizes} ${icon.purpose ?? "any"}`))
      .toEqual(["192x192 any", "512x512 any", "512x512 maskable"]);
    expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />');
    expect(pixels("public/apple-touch-icon.png")).toBe("180x180");
    // Rendered from the mark by a script kept for when the mark changes.
    expect(read("scripts/render-icons.mjs").toString()).toContain("public/logo-mark.svg");
  });

  it("links the manifest, which the hosted policy allows like the icons", () => {
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    const vercel = JSON.parse(read("vercel.json").toString()) as { headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }> };
    const csp = vercel.headers.find((rule) => rule.source === "/(.*)")?.headers.find((header) => header.key === "Content-Security-Policy")?.value ?? "";
    const policy = new Map(csp.split(";").map((part) => { const [name, ...values] = part.trim().split(/\s+/); return [name, values] as const; }));
    expect(policy.get("manifest-src") ?? policy.get("default-src")).toContain("'self'");
    expect(policy.get("img-src")).toContain("'self'");
  });

  it("describes the app in its own words, in British English, with no stylesheet holding up the first paint", () => {
    expect(html).toContain('<html lang="en-GB">');
    const description = html.match(/name="description"\s+content="([^"]+)"/)?.[1];
    expect(description).toBe(manifest.description);
    expect(description).not.toMatch(/Hub OS/i);
    // The home screen shows the app's name, not the page open when it was added.
    expect(html).toContain('<meta name="apple-mobile-web-app-title" content="Commune" />');
    expect(html).not.toMatch(/<link[^>]+rel="stylesheet"/);
    expect(existsSync(new URL("../public/styles", import.meta.url))).toBe(false);
  });
});
