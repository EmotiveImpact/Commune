import type { CurrencyCode, Snapshot } from "./types";

export type WebNode = { userId: string; name: string; x: number; y: number };
export type WebDebt = { from: string; to: string; amountMinor: number };
export type DebtWeb = {
  currency: CurrencyCode;
  nodes: WebNode[];
  /** Every bill share still owed, one line each: the tangle. */
  debts: WebDebt[];
  /** The same money as one payment per person to person, largest first. */
  payments: WebDebt[];
};

const MAX_PEOPLE = 6;

/**
 * Who owes whom between the viewer and everyone else in one commune, for
 * the settle animation. Each unpaid share of a bill is a line between the
 * person who owes and the person who paid. The lines then fold into one
 * payment for each person, in each direction, which is how Commune asks
 * people to settle: one payment covering every bill between two people.
 * Nothing is netted, so each payment is one the ledger records against
 * real shares.
 *
 * Positions are fractions of the drawing (0 to 1): the viewer on the
 * left, the others in a column on the right.
 */
export function debtWeb(snapshot: Snapshot, viewerId: string): DebtWeb | null {
  const currency = snapshot.commune.currency;
  const all: WebDebt[] = [];
  for (const expense of snapshot.expenses) {
    if (expense.voidedAt) continue;
    for (const share of expense.shares) {
      const left = Math.max(0, share.amountMinor - share.settledMinor);
      if (!left || share.userId === expense.paidByUserId) continue;
      if (share.userId !== viewerId && expense.paidByUserId !== viewerId) continue;
      all.push({ from: share.userId, to: expense.paidByUserId, amountMinor: left });
    }
  }
  if (!all.length) return null;
  // The people with the most money moving with the viewer, at most five.
  const weight = new Map<string, number>();
  for (const debt of all) {
    const other = debt.from === viewerId ? debt.to : debt.from;
    weight.set(other, (weight.get(other) ?? 0) + debt.amountMinor);
  }
  const others = [...weight.keys()].sort((a, b) => weight.get(b)! - weight.get(a)!).slice(0, MAX_PEOPLE - 1);
  const kept = new Set([viewerId, ...others]);
  const debts = all.filter((debt) => kept.has(debt.from) && kept.has(debt.to));
  const pairs = new Map<string, WebDebt>();
  for (const debt of debts) {
    const key = `${debt.from}>${debt.to}`;
    const pair = pairs.get(key);
    if (pair) pair.amountMinor += debt.amountMinor;
    else pairs.set(key, { ...debt });
  }
  const nameOf = (id: string) => snapshot.members.find((member) => member.userId === id)?.name ?? "A former member";
  // The viewer on the left, everyone else in a column on the right, so
  // every line is long enough to carry its amount.
  const nodes: WebNode[] = [{ userId: viewerId, name: nameOf(viewerId), x: 0.16, y: 0.5 },
    ...others.map((userId, index) => ({ userId, name: nameOf(userId), x: 0.8, y: (index + 0.5) / others.length }))];
  return { currency, nodes, debts, payments: [...pairs.values()].sort((a, b) => b.amountMinor - a.amountMinor) };
}

/** A gentle curve between two people, stopping short of each face. Fractions in, units of the drawing out. */
export function curve(from: { x: number; y: number }, to: { x: number; y: number }, width: number, height: number, inset: number, bend = 18, at = 0.5) {
  const x1 = from.x * width, y1 = from.y * height, x2 = to.x * width, y2 = to.y * height;
  const dx = x2 - x1, dy = y2 - y1, length = Math.hypot(dx, dy) || 1, ux = dx / length, uy = dy / length;
  const sx = x1 + ux * inset, sy = y1 + uy * inset, ex = x2 - ux * (inset + 4), ey = y2 - uy * (inset + 4);
  const mx = (sx + ex) / 2 - uy * bend, my = (sy + ey) / 2 + ux * bend;
  let total = 0;
  let px = sx, py = sy;
  for (let i = 1; i <= 24; i++) {
    const t = i / 24, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
    const qx = a * sx + b * mx + c * ex, qy = a * sy + b * my + c * ey;
    total += Math.hypot(qx - px, qy - py); px = qx; py = qy;
  }
  // Where an amount sits along the curve: the middle unless asked otherwise.
  return { d: `M${sx} ${sy} Q${mx} ${my} ${ex} ${ey}`, length: total, label: { x: (1 - at) ** 2 * sx + 2 * at * (1 - at) * mx + at ** 2 * ex, y: (1 - at) ** 2 * sy + 2 * at * (1 - at) * my + at ** 2 * ey }, end: { x: ex, y: ey, angle: Math.atan2(ey - my, ex - mx) } };
}
