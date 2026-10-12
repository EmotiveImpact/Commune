import { formatDay } from "@commune/core";
import { commandFailure } from "./commands";
import { timestampDay } from "./operations";
import type { ReminderEmailStatus, ReminderResult, ReminderTarget, ReminderUsage, SentReminder } from "../live/model";

/** Mirrors the server's display rules. send_reminder remains the authority. */
export const SOURCE_COOLDOWN_MS = 72 * 60 * 60 * 1000;
export const RECIPIENT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export type ReminderKind = "nudge" | "chase";
export type ReminderEligibility = {
  canSend: boolean;
  state: "ready" | "not-due" | "undated" | "cooldown" | "recently-reminded" | "limit" | "unavailable";
  /** Empty when the reminder can be sent. */
  reason: string;
};

const whenFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function reminderWord(kind: ReminderKind): "Nudge" | "Chase" {
  return kind === "chase" ? "Chase" : "Nudge";
}

/** A timestamp shown as the member's local calendar day: "9 Oct", or "9 Oct 2025" in another year. */
export function formatTimestampDay(timestamp: string | null | undefined): string {
  const day = timestampDay(timestamp);
  return day ? formatReminderDay(day) : timestamp ?? "";
}

/** A date-only value (due, received) as "9 Oct", with the year when it is not this year. Never shifted by time zone. */
export function formatReminderDay(iso: string | null | undefined): string {
  return iso ? formatDay(iso) : "";
}

/**
 * One explanation for every entry point. A missing target means the server
 * does not currently list this obligation as remindable.
 */
export function reminderEligibility(input: {
  kind: ReminderKind;
  recipientId: string;
  target: ReminderTarget | undefined;
  usage: ReminderUsage | null;
  sent: SentReminder[];
  dueOn: string | null | undefined;
  now?: number;
}): ReminderEligibility {
  const { kind, recipientId, target, usage, sent, dueOn } = input;
  const now = input.now ?? Date.now();
  const word = reminderWord(kind);
  if (usage && usage.totalUsed >= usage.totalLimit) {
    const next = usage.nextSlotAt ? Date.parse(usage.nextSlotAt) : NaN;
    return { canSend: false, state: "limit", reason: Number.isNaN(next)
      ? "Reminder allowance reached."
      : `Reminder allowance reached. Next slot opens ${whenFormat.format(next)}.` };
  }
  if (usage && (usage.recipientUsage[recipientId] ?? 0) >= usage.recipientLimit) {
    return { canSend: false, state: "limit", reason: `You have sent this person ${usage.recipientLimit} reminders in 30 days.` };
  }
  if (!target) {
    if (!dueOn) return { canSend: false, state: "undated", reason: kind === "nudge" ? "Add a due date to enable reminders." : "Reminders need a due date." };
    if (dueOn > new Date(now).toISOString().slice(0, 10)) {
      return { canSend: false, state: "not-due", reason: `${word} available from ${formatReminderDay(dueOn)}.` };
    }
    return { canSend: false, state: "unavailable", reason: `${word} is not available for this ${kind === "chase" ? "pledge" : "share"} right now.` };
  }
  const lastForSource = target.lastSentAt ? Date.parse(target.lastSentAt) : NaN;
  if (!Number.isNaN(lastForSource) && now - lastForSource < SOURCE_COOLDOWN_MS) {
    return { canSend: false, state: "cooldown", reason: `Next ${word.toLowerCase()} ${whenFormat.format(lastForSource + SOURCE_COOLDOWN_MS)}.` };
  }
  // The server's one-day limit spans communes; the allowance read reports it.
  const lastToRecipient = [...sent.filter(item => item.recipientUserId === recipientId).map(item => item.createdAt),
    usage?.recipientLastSent?.[recipientId]]
    .filter((value): value is string => !!value)
    .map(value => Date.parse(value)).filter(value => !Number.isNaN(value)).sort((a, b) => b - a)[0];
  if (lastToRecipient !== undefined && now - lastToRecipient < RECIPIENT_COOLDOWN_MS) {
    return { canSend: false, state: "recently-reminded", reason: `You reminded this person in the last day. Next reminder ${whenFormat.format(lastToRecipient + RECIPIENT_COOLDOWN_MS)}.` };
  }
  return { canSend: true, state: "ready", reason: "" };
}

const EMAIL_COPY: Record<ReminderEmailStatus, string> = {
  none: "No email was sent for this reminder.",
  possible: "Whether they also get an email depends on their own preferences, so it is not confirmed here.",
};

/** States only what the server reported. Never claims an email was sent or delivered. */
export function reminderResultCopy(kind: ReminderKind, name: string, result: ReminderResult): string {
  const recorded = result.duplicate
    ? `This ${reminderWord(kind).toLowerCase()} was already recorded. Nothing was sent twice.`
    : `${reminderWord(kind)} recorded. ${name} will see it in Commune.`;
  return `${recorded} ${EMAIL_COPY[result.emailStatus]}`;
}

/**
 * The line shown once a reminder is recorded: who it is for and how much of
 * the allowance is now used. "No email was sent this time." only when the
 * server says so; a possible email is not claimed either way.
 */
export function reminderToastCopy(kind: ReminderKind, name: string, result: ReminderResult, usage: ReminderUsage | null): string {
  const first = name.trim().split(/\s+/)[0] || name;
  if (result.duplicate) return `This ${reminderWord(kind).toLowerCase()} for ${first} was already recorded. Nothing was sent twice.`;
  const count = usage ? ` ${Math.min(usage.totalLimit, usage.totalUsed + 1)} of ${usage.totalLimit} in 30 days.` : "";
  const email = result.emailStatus === "none" ? " No email was sent this time." : "";
  return `${reminderWord(kind)} recorded for ${first}.${count}${email}`;
}

/**
 * A 4xx is a decision by the server: nothing was created. Anything else
 * (offline, timeout, 5xx) leaves the outcome unknown, and retrying with the
 * same request id is safe.
 */
export function reminderFailureCopy(error: unknown): { message: string; uncertain: boolean } {
  const failure = commandFailure(error, "The reminder could not be sent.");
  if (failure.rejected) {
    return { message: `${failure.message.replace(/\.$/, "")}. Nothing was sent and your allowance is unchanged.`, uncertain: false };
  }
  return { message: "We could not confirm whether this reminder was recorded. Check your connection and try again. Trying again will not send it twice.", uncertain: true };
}
