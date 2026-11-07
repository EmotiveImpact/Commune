/**
 * The bill just added from this phone, so the lists it lands in can slide it
 * in where it appears instead of it simply being there. Matched by commune,
 * title and amount, for a short while after saving.
 */
type Fresh = { communeId: string; title: string; amountMinor: number; at: number };

const WINDOW = 20 * 1000;
let fresh: Fresh | null = null;

export function markFresh(communeId: string, title: string, amountMinor: number) {
  fresh = { communeId, title, amountMinor, at: Date.now() };
}

export function isFresh(communeId: string, title: string, amountMinor?: number, now = Date.now()): boolean {
  return !!fresh && now - fresh.at < WINDOW && fresh.communeId === communeId && fresh.title === title
    && (amountMinor == null || fresh.amountMinor === amountMinor);
}

export function clearFresh() { fresh = null; }
