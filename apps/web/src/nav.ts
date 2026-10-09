import {
  PATH_SCREEN,
  SCREEN_PATH,
  WINDOW_PAGE,
  isWindowId,
  type ScreenId,
  type WindowId,
} from "./data/household";
import { readStored, removeStored, writeStored } from "./live/storage";

/** Preserve ?native=1 across client navigations. */

export function keepSearch(path: string): string {
  if (typeof window === "undefined") return path;
  const native = new URLSearchParams(window.location.search).get("native");
  if (native !== "1") return path;
  const [pathname, extra] = path.split("?");
  const params = new URLSearchParams(extra ?? "");
  params.set("native", "1");
  return `${pathname}?${params.toString()}`;
}

export function pathOnly(location: string): string {
  return location.split("?")[0];
}

export function isNativeNow(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("native") === "1";
}

// Every page and window has an address, so Back closes a window, a reload
// opens it again and a link opens it for another member. A screen that shows
// one commune names it (?commune=<id>); a window's address continues its
// screen's, so /expenses/<id> is that expense over Expenses.

/** Screens that show one commune. */
export const COMMUNE_SCREENS: ReadonlySet<ScreenId> = new Set<ScreenId>([
  "hub", "expenses", "settle", "recurring", "funds", "templates", "members", "operations", "notes",
  "activity", "commune-settings",
]);

// Below the screen's address. ":id" is the record the window shows.
const WINDOW_TAILS: Partial<Record<WindowId, string>> = {
  "add-expense": "new",
  expense: ":id",
  "expense-paid": ":id/paid",
  breakdown: "breakdown",
  pay: "pay/:id",
  "note-new": "new",
  note: ":id",
  "note-edit": ":id/edit",
  "operation-new": "new",
  operation: ":id",
  "operation-edit": ":id/edit",
  "commune-new": "new",
  "member-invite": "invite",
  "announcement-new": "announce",
  profile: "profile",
};

/** Windows that edit or add something. Leaving one never leaves it in the history. */
export const FORM_WINDOWS: ReadonlySet<WindowId> = new Set<WindowId>([
  "add-expense", "note-new", "note-edit", "operation-new", "operation-edit",
  "commune-new", "member-invite", "announcement-new",
]);

// Record ids are UUIDs; the sample data uses short names. "new" is the add form.
const RECORD_ID = /^(?!new$)[A-Za-z0-9_-]{1,128}$/;

export type Address = {
  /** Null when Commune has no such page. */
  screen: ScreenId | null;
  window: WindowId | null;
  /** The expense, note, task or fund the address names. */
  record: string;
  /** The commune the address names, which this account may not be in. */
  commune: string;
  params: URLSearchParams;
};

export function readAddress(path: string, search = ""): Address {
  const params = new URLSearchParams(search);
  const commune = params.get("commune") ?? "";
  const pathname = path.length > 1 ? path.replace(/\/+$/, "") : path;
  // A window that belongs to no screen (Notices) opens over the current one.
  const named = params.get("window") ?? "";
  const over = isWindowId(named) ? named : null;
  const screen = PATH_SCREEN[pathname];
  if (screen) return { screen, window: over, record: "", commune, params };
  const parts = pathname.split("/").slice(1);
  for (const [window, tail] of Object.entries(WINDOW_TAILS) as Array<[WindowId, string]>) {
    const page = WINDOW_PAGE[window];
    if (!page) continue;
    const record = matchTail(pathname, SCREEN_PATH[page], tail);
    if (record !== null) return { screen: page, window, record, commune, params };
  }
  // A fund opens in a dialog on Funds rather than in a window.
  if (parts.length === 2 && parts[0] === "funds" && RECORD_ID.test(parts[1])) {
    return { screen: "funds", window: over, record: parts[1], commune, params };
  }
  return { screen: null, window: null, record: "", commune, params };
}

// The record id when the path is the screen's followed by the tail, else null.
function matchTail(pathname: string, base: string, tail: string): string | null {
  const want = `${base}/${tail}`.split("/").slice(1);
  const have = pathname.split("/").slice(1);
  if (want.length !== have.length) return null;
  let record = "";
  for (let index = 0; index < want.length; index += 1) {
    if (want[index] === ":id") {
      if (!RECORD_ID.test(have[index])) return null;
      record = have[index];
    } else if (want[index] !== have[index]) return null;
  }
  return record;
}

/** The address of a screen, or of a window over it. */
export function addressOf(screen: ScreenId, options: {
  window?: WindowId | null;
  record?: string;
  commune?: string;
  params?: Record<string, string | undefined>;
} = {}): string {
  const { window, record = "", commune = "" } = options;
  const params = new URLSearchParams();
  let path = SCREEN_PATH[screen];
  const tail = window ? WINDOW_TAILS[window] : undefined;
  if (window && tail && WINDOW_PAGE[window] === screen && (!tail.includes(":id") || RECORD_ID.test(record))) {
    path = `${path}/${tail.replace(":id", record)}`;
  } else if (window) {
    params.set("window", window);
  } else if (screen === "funds" && RECORD_ID.test(record)) {
    path = `${path}/${record}`;
  }
  if (commune && COMMUNE_SCREENS.has(screen)) params.set("commune", commune);
  for (const [key, value] of Object.entries(options.params ?? {})) if (value) params.set(key, value);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

// Pages outside the signed-in app. None of them names a record in its path.
const OTHER_PAGES = new Set(["/login", "/signup", "/verify-email", "/forgot-password", "/reset-password",
  "/invite", "/privacy", "/terms", "/onboard"]);

/**
 * The page at an address as a pattern that names no record, commune or
 * query, for error reports: /expenses/:id, /settle/pay/:id, /hub.
 */
export function routePattern(path: string): string {
  const pathname = path.split(/[?#]/)[0];
  if (OTHER_PAGES.has(pathname)) return pathname;
  const { screen, window, record } = readAddress(pathname);
  if (!screen) return "/:unknown";
  const base = SCREEN_PATH[screen] === "/" ? "" : SCREEN_PATH[screen];
  const tail = window ? WINDOW_TAILS[window] : undefined;
  if (tail) return `${base}/${tail}`;
  return record ? `${base}/:id` : SCREEN_PATH[screen];
}

/** The same address naming a commune, keeping everything else in it. */
export function withCommune(path: string, search: string, commune: string): string {
  const params = new URLSearchParams(search);
  params.set("commune", commune);
  return `${path}?${params.toString()}`;
}

const RETURN_TO = "commune.return-to";
// Pages a sign-in reaches by itself, so not worth coming back to.
const NO_RETURN = new Set(["/", "/login", "/signup", "/verify-email", "/forgot-password", "/reset-password", "/onboard"]);

/**
 * A page on this site to open after signing in, or null. Never another site:
 * not an absolute URL, a protocol-relative one ("//"), or a backslash or
 * control character that a browser would read as one.
 */
export function safeReturnPath(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 2048 || !raw.startsWith("/") || raw.startsWith("//")) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return null;
  const base = "https://commune.invalid";
  let url: URL;
  try {
    url = new URL(raw, base);
  } catch {
    return null;
  }
  if (url.origin !== base || NO_RETURN.has(url.pathname)) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** The page someone asked for before signing in. Asking for Home forgets it. */
export function rememberReturn(path: string): void {
  const safe = safeReturnPath(path);
  if (safe) writeStored(RETURN_TO, safe);
  else removeStored(RETURN_TO);
}

export function readReturn(): string | null {
  return safeReturnPath(readStored(RETURN_TO));
}

export function forgetReturn(): void {
  removeStored(RETURN_TO);
}
