/**
 * Records made with no signal wait here and send once the phone is back
 * online. Each carries the request id it was made with, so sending it again
 * after a dropped connection can never record it twice.
 */
export type ExpenseCommand = {
  title: string; amountMinor: number; category: string; dueOn: string | null; paidByUserId: string;
  shares: Array<{ userId: string; amountMinor: number }>; requestId: string;
};
export type ReportCommand = { amountMinor: number; sentOn: string; reference: string | null; requestId: string };

export type Queued =
  | { id: string; kind: "report"; communeId: string; shareId: string; input: ReportCommand; label: string }
  | { id: string; kind: "expense"; communeId: string; input: ExpenseCommand; label: string };

export const OUTBOX_STORE = "commune.outbox.v1";

/** Adds a record once; the same request id is never queued twice. */
export function enqueue(list: Queued[], item: Queued): Queued[] {
  return list.some((queued) => queued.id === item.id) ? list : [...list, item];
}

/** "Commune can't be reached": the request never got an answer, so it may be retried. */
export function isNetworkError(cause: unknown): boolean {
  return !!cause && typeof cause === "object" && (cause as { status?: unknown }).status === 0;
}

/**
 * Sends the queue in order. A network error stops the run and keeps that
 * record and the rest for next time. Any other error means the server looked
 * at it and said no, so it is dropped and reported rather than retried forever.
 */
export async function flush(list: Queued[], send: (item: Queued) => Promise<void>):
  Promise<{ sent: Queued[]; failed: Array<{ item: Queued; cause: unknown }>; left: Queued[] }> {
  const sent: Queued[] = [];
  const failed: Array<{ item: Queued; cause: unknown }> = [];
  for (let index = 0; index < list.length; index++) {
    const item = list[index];
    try {
      await send(item);
      sent.push(item);
    } catch (cause) {
      if (isNetworkError(cause)) return { sent, failed, left: list.slice(index) };
      failed.push({ item, cause });
    }
  }
  return { sent, failed, left: [] };
}

/** Reads a stored queue, ignoring anything that does not look like one. */
export function parseOutbox(raw: string | null): Queued[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((item): item is Queued =>
      !!item && typeof item === "object" && typeof (item as Queued).id === "string" &&
      ((item as Queued).kind === "report" || (item as Queued).kind === "expense")) : [];
  } catch { return []; }
}
