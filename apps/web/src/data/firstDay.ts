import { readLocal, removeLocal, writeLocal } from "../live/storage";

/**
 * Someone who has just joined a house sees a short "first day" card on Home
 * (joining flow, 8 November 2026). It is this browser's note, kept for two
 * weeks or until they hide it; nothing about it is saved to the account.
 */
export type FirstDay = { communeId: string; house: string; at: string };

const KEY = "commune.first-day";
const DAYS = 14;

const keyFor = (userId: string) => `${KEY}.${userId}`;

export function rememberFirstDay(userId: string, communeId: string, house: string, now = new Date()): void {
  writeLocal(keyFor(userId), JSON.stringify({ communeId, house, at: now.toISOString() } satisfies FirstDay));
}

export function readFirstDay(userId: string | null | undefined, now = new Date()): FirstDay | null {
  if (!userId) return null;
  const raw = readLocal(keyFor(userId));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<FirstDay>;
    if (typeof value.communeId !== "string" || typeof value.house !== "string" || typeof value.at !== "string") return null;
    const at = Date.parse(value.at);
    if (!Number.isFinite(at) || now.getTime() - at > DAYS * 86_400_000) {
      removeLocal(keyFor(userId));
      return null;
    }
    return { communeId: value.communeId, house: value.house, at: value.at };
  } catch {
    return null;
  }
}

export function forgetFirstDay(userId: string): void {
  removeLocal(keyFor(userId));
}
