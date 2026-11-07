/**
 * Paying or confirming from a card or row ends in that same place, as in the
 * opening flow: the card itself turns into "All square." instead of a sheet
 * showing it. The card or row claims the payment (by share or report id) when
 * one of its buttons is pressed; the sheet hands the result back if the claim
 * is still there, and closes, otherwise it shows the result itself.
 */
export type Settled = {
  id: string; title: string; body: string;
  /** A small link beside the words, such as Undo. */
  action?: { label: string; run(): void };
  /** The key of a row still on screen (as after a nudge) that this stands in for, rather than going beside it. */
  replaces?: string;
};
export type Landed = Settled & { slot: number };

type Claim = { id: string; owner: number; slot: number; at: number };

const FRESH = 10 * 60 * 1000;
let claim: Claim | null = null;
let owners = 0;
const listeners = new Map<number, (event: Landed) => void>();

export function newOwner() { owners += 1; return owners; }

export function listen(owner: number, listener: (event: Landed) => void) {
  listeners.set(owner, listener);
  return () => { listeners.delete(owner); };
}

/** Called by a card or row as one of its pay or confirm buttons is pressed. */
export function claimSettle(id: string, owner: number, slot = 0) { claim = { id, owner, slot, at: Date.now() }; }

/** Sends the result back to the card or row that started it. True when it took it, so the sheet just closes. */
export function handBack(event: Settled): boolean {
  if (!claim || claim.id !== event.id || Date.now() - claim.at > FRESH) return false;
  const listener = listeners.get(claim.owner);
  if (!listener) return false;
  const slot = claim.slot;
  claim = null;
  listener({ ...event, slot });
  return true;
}

/** As handBack, after the screen underneath has redrawn with the new figures, so a row that has gone is not handed it. */
export function handBackSoon(event: Settled): Promise<boolean> {
  return new Promise((done) => setTimeout(() => done(handBack(event)), 60));
}
