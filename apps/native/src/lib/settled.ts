/**
 * When a payment starts from the next step card on Home, the card itself
 * turns into "All square." once it is recorded, as in the opening flow,
 * instead of the sheet showing it. The card claims the share when one of its
 * buttons is pressed; the sheet hands the result back if the claim is there.
 */
export type Settled = { shareId: string; title: string; body: string };

let claimed: string | null = null;
let claimedAt = 0;
const FRESH = 10 * 60 * 1000;
const listeners = new Set<(event: Settled) => void>();

export function claimSettle(shareId: string) { claimed = shareId; claimedAt = Date.now(); }

/** True when the card took it, so the sheet should just close. */
export function handBack(event: Settled): boolean {
  if (claimed !== event.shareId || Date.now() - claimedAt > FRESH || !listeners.size) return false;
  claimed = null;
  listeners.forEach((listener) => listener(event));
  return true;
}

export function onSettled(listener: (event: Settled) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
