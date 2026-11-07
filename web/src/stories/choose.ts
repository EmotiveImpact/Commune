import { ctxFrom, pickStory, storyById, type Story } from '@commune/core/stories';

// The stories this browser has seen on the website, so the next visit shows
// another. Kept on this device only; a browser that refuses storage simply
// sees the story that fits the moment.
const SEEN_KEY = 'commune.site.stories.seen';

function readSeen(): string[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((id): id is string => typeof id === 'string' && Boolean(storyById(id))) : [];
  } catch {
    return [];
  }
}

let chosen: Story | null = null;

/**
 * The homepage's story: the one a link named (?story=villa, from a story page
 * or an ad), or else the one that fits the time of day, weekday, month and
 * date best and hasn't been seen here. Chosen once per page load.
 */
export function siteStory(now = new Date()): Story {
  if (chosen) return chosen;
  const named = storyById(new URLSearchParams(window.location.search).get('story') ?? '');
  const seen = readSeen();
  chosen = named ?? pickStory(ctxFrom(now), seen);
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen.filter(id => id !== chosen!.id), chosen.id]));
  } catch {
    // Not kept: the next visit chooses for the moment again.
  }
  return chosen;
}

/** The app, opening on the same story (the app reads ?from=link-<id>). */
export const appLink = (story: Story) => `https://app.ourcommune.io/signup?from=link-${story.id}`;

/** A story's own page, for ads and for watching it again. */
export const storyPage = (story: Story) => `/s/${story.id}`;
