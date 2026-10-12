import type { HubId } from "../data/household";
import { isStoredImage, readHubPhotos } from "../data/images";
import { readLocal, readStored, removeLocal, removeStored, writeLocal } from "./storage";

// What this browser remembers between visits. Device preferences belong to
// the browser, whoever signs in. Account preferences belong to one account
// and are removed when it signs out here, so the next person on a shared
// device finds none of its photos, payment hints or last commune.

export type NavMode = "basic" | "advanced";
/** "system" follows the device's own light or dark setting. */
export type Theme = "system" | "light" | "dark";
export type PayMethod = {
  provider: "Revolut" | "PayPal" | "Monzo" | "Bank transfer";
  value: string;
};
export type DevicePrefs = {
  theme: Theme;
  navMode: NavMode;
  noticesOn: boolean;
};
export type AccountPrefs = {
  /** The commune last opened, opened again next time while still a member. */
  activeHubId?: string;
  payMethods: PayMethod[];
  hubPhotos: Partial<Record<HubId, string>>;
  avatar?: string;
};

export const DEFAULT_DEVICE: DevicePrefs = { theme: "system", navMode: "basic", noticesOn: true };
export const DEFAULT_ACCOUNT: AccountPrefs = { payMethods: [], hubPhotos: {} };

export const DEVICE_KEY = "commune.device";
export const accountKey = (userId: string) => `commune.local.${userId}`;

function parse(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function deviceFrom(value: Record<string, unknown>): DevicePrefs {
  return {
    theme: value.theme === "light" || value.theme === "dark" ? value.theme : "system",
    navMode: value.navMode === "advanced" ? "advanced" : "basic",
    noticesOn: value.noticesOn !== false,
  };
}

function accountFrom(value: Record<string, unknown>): AccountPrefs {
  return {
    activeHubId: typeof value.activeHubId === "string" ? value.activeHubId : undefined,
    payMethods: Array.isArray(value.payMethods) ? value.payMethods.filter(
      (method): method is PayMethod => !!method && typeof method.value === "string" &&
        ["Revolut", "PayPal", "Monzo", "Bank transfer"].includes(method.provider),
    ) : [],
    hubPhotos: readHubPhotos(value.hubPhotos) ?? {},
    avatar: isStoredImage(value.avatar) ? value.avatar : undefined,
  };
}

/** Null when this browser keeps none, or cannot be read. */
export function readDevicePrefs(): DevicePrefs | null {
  const value = parse(readLocal(DEVICE_KEY));
  return value ? deviceFrom(value) : null;
}

export function readAccountPrefs(userId: string): AccountPrefs | null {
  const value = parse(readLocal(accountKey(userId)));
  return value ? accountFrom(value) : null;
}

/** Whether the browser kept them; if not, they last for this visit only. */
export function saveDevicePrefs(prefs: DevicePrefs): boolean {
  return writeLocal(DEVICE_KEY, JSON.stringify(prefs));
}

export function saveAccountPrefs(userId: string, prefs: AccountPrefs): boolean {
  return writeLocal(accountKey(userId), JSON.stringify(prefs));
}

/** Signing out: nothing of the account stays in this browser. */
export function forgetAccountPrefs(userId: string): void {
  removeLocal(accountKey(userId));
  removeStored(accountKey(userId));
}

/**
 * Until October 2026 every preference was kept in the tab's session storage,
 * one record per account, and was lost when the tab closed. A tab that still
 * has one moves it to this browser's storage once, keeping anything already
 * there, and the old copy goes when it has moved. Dark mode on becomes Dark;
 * off was the default, so it now follows the device.
 */
export function adoptTabPrefs(userId: string): void {
  const key = accountKey(userId);
  const old = parse(readStored(key));
  if (!old) return;
  const account = readLocal(key) !== null || writeLocal(key, JSON.stringify(accountFrom(old)));
  const device = readLocal(DEVICE_KEY) !== null ||
    writeLocal(DEVICE_KEY, JSON.stringify({ ...deviceFrom(old), theme: old.dark === true ? "dark" : "system" }));
  if (account && device) removeStored(key);
}
