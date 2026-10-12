import { formatDay } from "@commune/core";
import type { HubId } from "./household";

export type OperationKind = "task" | "event";
export type OperationCategory =
  | "chore"
  | "delivery"
  | "visit"
  | "appointment"
  | "other";
export type OperationRepeat = "none" | "weekly" | "monthly";
export type OperationStatus = "open" | "done";

/** One recorded action on a task. Undone actions stay in the history. */
export type OperationOccurrence = {
  id: string;
  action: "completed" | "skipped" | "reopened" | "handed_over";
  /** The occurrence acted on, and who held it then. */
  dueOn: string;
  assignee?: string | null;
  assigneeId?: string | null;
  actorId: string;
  actedOn: string;
  actedAt: string;
  nextDate: string;
  nextAssignee?: string | null;
  nextAssigneeId?: string | null;
  /** Why it was skipped or handed over, when someone said. */
  reason?: string | null;
  /**
   * Who a completion credits: the person who marked it, or the holder they
   * marked it for. Missing on older entries and on tasks held by a name only.
   */
  doneById?: string | null;
  undoneAt: string | null;
  undoneBy: string | null;
};
/**
 * Who did a task someone else holds, said by the person marking it done:
 * themselves, covering the turn, or the holder.
 */
export type DoneBy = "me" | "assignee";

/** Marking this task done has to say who did it: someone else holds it. */
export function needsDoneBy(item: OperationItem, youId: string): boolean {
  return item.kind === "task" && item.status === "open" && Boolean(item.assigneeId) && item.assigneeId !== youId;
}

/** What the server reports after a task action or its undo. */
export type OperationChange = {
  occurrenceId: string;
  duplicate: boolean;
  date: string;
  assignee: string | null;
  assigneeId: string | null;
  turnOwnerId: string | null;
  status: OperationStatus;
};

export type OperationItem = {
  id: string;
  hubId: HubId;
  kind: OperationKind;
  category: OperationCategory;
  title: string;
  date: string;
  time?: string;
  allDay: boolean;
  /** Display names, read live from the member ids below. */
  assignee?: string;
  rotation?: string[];
  /** The member holding the task, and who takes turns, by member id. */
  assigneeId?: string | null;
  rotationIds?: string[] | null;
  /**
   * Whose turn it is while someone else covers it (set by a handover). The
   * rotation carries on from this person, not from the one covering.
   */
  turnOwnerId?: string | null;
  turnOwner?: string | null;
  /**
   * The last completion: who did it, and who marked it done for them or
   * whose turn they covered, when that was someone else.
   */
  lastDone?: { by: string; date: string; markedBy?: string; covering?: string };
  repeat: OperationRepeat;
  status: OperationStatus;
  notes: string;
  /** Day of the month a monthly task was set for; months shorter than it clamp. */
  anchorDay?: number | null;
  /** Latest action that can still be undone, if the task has not moved since. */
  undoOccurrenceId?: string | null;
  history?: OperationOccurrence[];
  /**
   * Goes up with every change, including completions and handovers. An edit
   * names the version it started from, so a stale one is refused.
   */
  version?: number;
  /** Who added it. They, or an admin, can remove it. */
  createdBy?: string | null;
};

/** What an add or an edit sends. Status and completion change only through task actions. */
export type NewOperation = Omit<OperationItem, "id" | "hubId" | "status" | "lastDone" | "undoOccurrenceId" | "history" | "anchorDay"
  | "turnOwnerId" | "turnOwner" | "version" | "createdBy">;
export type OperationStore = Record<HubId, OperationItem[]>;

/**
 * Whether a saved task holds exactly what an edit sent, compared as the
 * database stores it. An edit whose reply was lost arrives this way.
 */
export function holdsEdit(item: OperationItem, edit: NewOperation): boolean {
  const stored = (value: NewOperation) => JSON.stringify([
    value.kind, value.category, value.title.trim(), value.date, value.allDay ? null : value.time ?? null, value.allDay,
    value.kind === "task" ? value.assigneeId ?? null : null,
    value.kind === "task" && value.rotationIds?.length ? value.rotationIds : null,
    value.repeat, value.notes.trim(),
  ]);
  return stored(item) === stored(edit);
}

/**
 * The next person's name for display. Uses member ids when the task has them,
 * so two members with the same name are never confused. The server decides
 * who is actually next (and passes over anyone who has left).
 */
export function nextPerson(item: Pick<OperationItem, "rotation" | "rotationIds" | "assignee" | "assigneeId" | "turnOwnerId">): string {
  const names = item.rotation ?? [];
  const ids = item.rotationIds;
  if (ids?.length && ids.length === names.length) {
    // A cover does one turn; the rotation moves on from whose turn it was.
    const turn = item.turnOwnerId ?? item.assigneeId;
    const index = turn ? ids.indexOf(turn) : -1;
    return names[(index + 1) % ids.length];
  }
  return names.length ? nextInRotation(names, item.assignee) : "";
}

/** Whether rotation position `index` is the person whose turn it is now. */
export function holdsTurn(item: Pick<OperationItem, "rotation" | "rotationIds" | "assignee" | "assigneeId" | "turnOwnerId">, index: number): boolean {
  const ids = item.rotationIds;
  if (ids?.length && ids.length === (item.rotation ?? []).length) return ids[index] === (item.turnOwnerId ?? item.assigneeId);
  return item.rotation?.[index] === item.assignee;
}

export function nextInRotation(rotation: string[], current?: string): string {
  if (!rotation.length) return current ?? "";
  const index = current ? rotation.indexOf(current) : -1;
  return rotation[(index + 1) % rotation.length];
}

/** Mirrors the server: strictly after today, monthly steps keep the anchor day. */
export function nextOccurrence(
  date: string,
  repeat: OperationRepeat,
  today = todayIso(),
  anchorDay?: number | null,
): string {
  if (repeat === "none") return date;
  let next = addRepeat(date, repeat, anchorDay);
  while (next <= today) next = addRepeat(next, repeat, anchorDay);
  return next;
}

export function firstNameOf(name?: string): string {
  return name?.split(" ")[0] ?? "";
}

export function formatTimeLabel(time?: string): string {
  if (!time) return "All day";
  const [hours, minutes] = time.split(":").map(Number);
  const suffix = hours >= 12 ? "pm" : "am";
  const hour = hours % 12 || 12;
  return minutes
    ? `${hour}:${String(minutes).padStart(2, "0")}${suffix}`
    : `${hour}${suffix}`;
}

export function overdueDays(date: string, today = todayIso()): number {
  const start = dateFromIso(date).getTime();
  const end = dateFromIso(today).getTime();
  return Math.max(0, Math.round((end - start) / 86400000));
}

export function addRepeat(date: string, repeat: OperationRepeat, anchorDay?: number | null): string {
  const next = dateFromIso(date);
  if (repeat === "weekly") next.setDate(next.getDate() + 7);
  if (repeat === "monthly") {
    // Without the anchor, 31 Jan would become 28 Feb and then 28 Mar for good.
    const day = anchorDay ?? next.getDate();
    next.setDate(1);
    next.setMonth(next.getMonth() + 1);
    const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(day, lastDay));
  }
  return isoFromDate(next);
}

export function dateFromIso(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function isoFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayIso(): string {
  return isoFromDate(new Date());
}

/**
 * The calendar day (YYYY-MM-DD) a stored timestamp falls on where the member
 * is. Activity, statements, exports and "This month" all date timestamps this
 * way, never by their UTC date, so something entered late in the evening
 * keeps the day it was entered. Empty for a missing or unreadable timestamp.
 */
export function timestampDay(timestamp: string | null | undefined): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "" : isoFromDate(date);
}

export function addDays(date: string, days: number): string {
  const next = dateFromIso(date);
  next.setDate(next.getDate() + days);
  return isoFromDate(next);
}

const weekdayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short" });

/** "Sat 17 Oct", as a toast says a day. */
export function shortDay(iso: string): string {
  return `${weekdayFormat.format(dateFromIso(iso))} ${formatDay(iso)}`;
}

/**
 * The line once a task is marked done: "Put the bins out marked done. Next:
 * Sat 17 Oct." Who did it is named when it was not the holder alone, and the
 * next turn when the rotation handed it on.
 */
export function taskDoneCopy(item: OperationItem, doneBy: DoneBy | undefined, result: { assignee?: string | null; date: string; status?: string }): string {
  const handed = item.repeat !== "none" && item.rotation?.length ? firstNameOf(result.assignee ?? undefined) : "";
  const holder = firstNameOf(item.assignee);
  const lead = doneBy === "assignee" ? `${item.title} marked done by ${holder}`
    : doneBy === "me" ? `${item.title} marked done, covering ${holder}` : `${item.title} marked done`;
  if (item.repeat === "none" || result.status === "done") return `${lead}.`;
  const next = shortDay(result.date);
  return `${lead}. Next: ${handed ? `${handed}, ` : ""}${next}.`;
}
