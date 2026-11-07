/**
 * The stories' photos, named by key. The files themselves are in
 * packages/core/assets/stories, one `<key>.webp` each, so the website and the
 * web app read the same photos. Each app turns a key into a URL with a small
 * map of its own (apps/web/src/stories/images.ts, web/src/stories/images.ts).
 * A new photo goes in that folder and gets a key here.
 */
export const IMAGE_KEYS = [
  "bday-a", "bday-b", "bday-c", "bench", "chips",
  "fest-a", "fest-b", "fest-c", "foot-a", "foot-b", "foot-c", "fridge", "jeanphil",
  "move-a", "move-b", "move-c", "picnic", "rent-a", "rent-b", "rent-c",
  "road-a", "road-b", "road-c", "roast-a", "roast-b", "roast-c", "shadowbox",
  "taxi-a", "taxi-b", "taxi-c", "villa-a", "villa-b", "villa-c",
  "work-a", "work-b", "work-c", "xmas-a", "xmas-b", "xmas-c",
  "p-jeanphil", "p-maya", "p-sam", "p-ama", "p-mei", "p-leo",
  "av-jeanphil", "av-maya", "av-sam", "av-ama", "av-mei", "av-leo",
  "t-home", "t-trip", "t-work", "t-else",
  "inv-home", "inv-trip", "inv-work",
] as const;

export type ImageKey = (typeof IMAGE_KEYS)[number];

/** The file name of a photo in packages/core/assets/stories. */
export const imageFile = (key: ImageKey): string => `${key}.webp`;

/** Every story photo is 2:3 (720 by 1080) except the set-up tiles. */
export const PHOTO_RATIO = 2 / 3;
