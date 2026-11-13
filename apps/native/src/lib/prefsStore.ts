/** The shape of the choices kept on this phone, and how a saved copy is read back. */

/** Where the Hub's Overview, Money, Chores and Notes tabs sit. */
export type HubTabsAt = "top" | "bottom";
export type Appearance = "match" | "light" | "dark";
export const APPEARANCE_LABEL: Record<Appearance, string> = { match: "Match phone", light: "Light", dark: "Dark" };

/** v7's "Send me a notification when" list. */
export const NOTIFY_KINDS = [
  { id: "paid-me", label: "Someone says they’ve paid me" },
  { id: "confirmed", label: "Someone confirms what I paid" },
  { id: "due", label: "A day before something is due" },
  { id: "chore", label: "It’s my turn for a chore" },
  { id: "announcement", label: "Someone posts an announcement" },
  { id: "expense", label: "A new expense is added" },
] as const;
export type NotifyKind = (typeof NOTIFY_KINDS)[number]["id"];

export const DEFAULT_NOTIFY: Record<NotifyKind, boolean> = {
  "paid-me": true, confirmed: true, due: true, chore: true, announcement: true, expense: false,
};

/** The evening hours "Remind me tonight" can go off at. */
export const REMIND_HOURS = [18, 19, 20, 21] as const;
export type RemindHour = (typeof REMIND_HOURS)[number];
export function hourWords(hour: number): string {
  return `${hour > 12 ? hour - 12 : hour}${hour >= 12 ? "pm" : "am"}`;
}

export type Saved = {
  hubTabsAt: HubTabsAt; appearance: Appearance; faceId: boolean; notify: Record<NotifyKind, boolean>;
  /** When "Remind me tonight" goes off. */
  remindHour: RemindHour;
  /** The name you chose in Edit profile, shown on this phone. Null keeps your account's name. */
  displayName: string | null;
};

export const DEFAULT_SAVED: Saved = { hubTabsAt: "top", appearance: "match", faceId: false, notify: DEFAULT_NOTIFY, remindHour: 19, displayName: null };

/** Reads what was saved, keeping a default for anything missing or not understood. */
export function readPrefs(raw: string | null): Saved {
  const out: Saved = { ...DEFAULT_SAVED, notify: { ...DEFAULT_NOTIFY } };
  if (!raw) return out;
  let saved: Record<string, unknown>;
  try { saved = JSON.parse(raw) as Record<string, unknown>; } catch { return out; }
  if (!saved || typeof saved !== "object") return out;
  if (saved.hubTabsAt === "top" || saved.hubTabsAt === "bottom") out.hubTabsAt = saved.hubTabsAt;
  if (saved.appearance === "match" || saved.appearance === "light" || saved.appearance === "dark") out.appearance = saved.appearance;
  if (typeof saved.faceId === "boolean") out.faceId = saved.faceId;
  if ((REMIND_HOURS as readonly unknown[]).includes(saved.remindHour)) out.remindHour = saved.remindHour as RemindHour;
  if (typeof saved.displayName === "string" && saved.displayName.trim()) out.displayName = saved.displayName.trim().slice(0, 48);
  if (saved.notify && typeof saved.notify === "object") {
    for (const kind of NOTIFY_KINDS) {
      const on = (saved.notify as Record<string, unknown>)[kind.id];
      if (typeof on === "boolean") out.notify[kind.id] = on;
    }
  }
  return out;
}

/** "5 of 6 kinds on", as v7's Settings row says. */
export function notifySummary(notify: Record<NotifyKind, boolean>): string {
  const on = NOTIFY_KINDS.filter((kind) => notify[kind.id]).length;
  return on === NOTIFY_KINDS.length ? "All kinds on" : on === 0 ? "All off" : `${on} of ${NOTIFY_KINDS.length} kinds on`;
}

/** Face ID asks again after the app has been away this long. */
export const RELOCK_AFTER_MS = 60 * 1000;
export function shouldRelock(awaySince: number | null, now: number): boolean {
  return awaySince != null && now - awaySince >= RELOCK_AFTER_MS;
}
