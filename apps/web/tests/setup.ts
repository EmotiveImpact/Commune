import { beforeEach } from "vitest";

// Preferences are kept in this browser's local storage (src/live/preferences.ts),
// which jsdom keeps for every test in a file. Each test starts from a browser
// that has kept none, as each file's own sessionStorage.clear() starts a tab.
beforeEach(() => {
  if (typeof localStorage !== "undefined") localStorage.clear();
});

// jsdom has no canvas. Scenes that draw (the street runner) draw nothing in
// tests, without jsdom's "not implemented" message on every render.
if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
}
