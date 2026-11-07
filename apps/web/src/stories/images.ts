import type { ImageKey } from "@commune/core/stories";

// The stories' photos live once, in packages/core/assets/stories, for the
// website and this app alike. Vite gives each one a hashed URL on this
// origin (the hosted policy allows images only from 'self').
const files = import.meta.glob<string>("../../../../packages/core/assets/stories/*.webp", { eager: true, query: "?url", import: "default" });
const byKey = new Map(Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf("/") + 1, -".webp".length), url]));

/** A story photo's URL, by its key. */
export function storyImage(key: ImageKey): string {
  return byKey.get(key) ?? "";
}
