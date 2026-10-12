import { beforeEach } from "vitest";

// Preferences are kept in this browser's local storage (src/live/preferences.ts),
// which jsdom keeps for every test in a file. Each test starts from a browser
// that has kept none, as each file's own sessionStorage.clear() starts a tab.
beforeEach(() => {
  if (typeof localStorage !== "undefined") localStorage.clear();
});
