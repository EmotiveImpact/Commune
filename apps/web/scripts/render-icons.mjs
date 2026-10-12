// Renders Commune's home-screen icons from public/logo-mark.svg with a
// headless Chromium, which draws the mark exactly as a browser does. The PNGs
// it writes are committed; run it again only when the mark changes:
//
//   CHROMIUM=/path/to/chrome node apps/web/scripts/render-icons.mjs
//
// (Chrome, Chromium or Playwright's headless_shell all work.) The mark sits on
// the app's navy, the theme colour in index.html. The maskable icon keeps it
// inside the middle 80%, which every launcher's mask shape leaves showing
// (https://www.w3.org/TR/appmanifest/#icon-masks).
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const chromium = process.env.CHROMIUM;
if (!chromium) throw new Error("Set CHROMIUM to a Chrome, Chromium or headless_shell binary.");
const navy = "#1a1e2b";
// The mark's drawing, without its own <svg> element.
const drawing = readFileSync(join(web, "public/logo-mark.svg"), "utf8")
  .replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const icons = [
  { file: "public/icons/icon-192.png", size: 192, scale: 1 },
  { file: "public/icons/icon-512.png", size: 512, scale: 1 },
  { file: "public/icons/icon-maskable-512.png", size: 512, scale: 0.8 },
  { file: "public/apple-touch-icon.png", size: 180, scale: 1 },
];

const work = mkdtempSync(join(tmpdir(), "commune-icons-"));
try {
  for (const icon of icons) {
    const offset = (512 * (1 - icon.scale)) / 2;
    const page = join(work, `${icon.size}-${icon.scale}.html`);
    writeFileSync(page, `<!doctype html><html><body style="margin:0;background:${navy}">
<svg xmlns="http://www.w3.org/2000/svg" width="${icon.size}" height="${icon.size}" viewBox="0 0 512 512" style="display:block">
<rect width="512" height="512" fill="${navy}"/>
<g transform="translate(${offset} ${offset}) scale(${icon.scale})">${drawing}</g>
</svg></body></html>`);
    mkdirSync(dirname(join(web, icon.file)), { recursive: true });
    execFileSync(chromium, [
      "--headless", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
      // Chromium's sandbox cannot start as root, as in a container.
      ...(process.getuid?.() === 0 ? ["--no-sandbox"] : []),
      `--window-size=${icon.size},${icon.size}`, `--screenshot=${join(web, icon.file)}`, pathToFileURL(page).href,
    ], { stdio: "ignore" });
    console.log(`Wrote ${icon.file}`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
