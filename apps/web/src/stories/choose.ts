import { arrivalFrom, ctxFrom, pickStory, storyById, type Story } from "@commune/core/stories";
import { readLocal, writeLocal } from "../live/storage";

// Which opening story this browser saw, so an empty screen can say "From the
// story you saw" and the next visit shows another. Kept on this device only;
// a browser that refuses storage simply sees a story chosen for the moment.
const STORY_KEY = "commune.story";
const SEEN_KEY = "commune.stories.seen";

let shown: Story | null = null;

function readSeen(): string[] {
  try {
    const list: unknown = JSON.parse(readLocal(SEEN_KEY) ?? "[]");
    return Array.isArray(list) ? list.filter((id): id is string => typeof id === "string" && Boolean(storyById(id))) : [];
  } catch {
    return [];
  }
}

/**
 * The story for this visit's sign-in, sign-up and invitation pages: the one
 * a website or ad link named (?from=link-villa), or else the one that fits
 * the time, day and month best and hasn't been seen here. Chosen once per
 * page load, so moving between those pages keeps the same story.
 */
export function visitStory(now = new Date()): Story {
  if (shown) return shown;
  const arrived = arrivalFrom(typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("from"));
  const linked = arrived.startsWith("link-") ? storyById(arrived.slice(5)) : undefined;
  const seen = readSeen();
  shown = linked ?? pickStory(ctxFrom(now, arrived), seen);
  writeLocal(STORY_KEY, shown.id);
  writeLocal(SEEN_KEY, JSON.stringify([...seen.filter((id) => id !== shown!.id), shown.id]));
  return shown;
}

/** The story this browser saw last, for empty screens and loading lines; one for the moment if none was. */
export function seenStory(now = new Date()): Story {
  return shown ?? storyById(readLocal(STORY_KEY) ?? "") ?? pickStory(ctxFrom(now), [], () => 0);
}

/** For tests: forget the story chosen for this page load. */
export function forgetVisitStory(): void {
  shown = null;
}
