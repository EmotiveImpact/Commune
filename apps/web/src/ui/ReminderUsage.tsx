import type { ReminderUsage as Usage } from "../live/model";

export function reminderLimitReached(usage: Usage | null, recipientId: string): boolean {
  return !!usage && (
    usage.totalUsed >= usage.totalLimit ||
    (usage.recipientUsage[recipientId] ?? 0) >= usage.recipientLimit
  );
}

export function ReminderUsageMeter({ usage }: { usage: Usage | null }) {
  if (!usage) return (
    <div className="a-reminder-usage" role="status">
      <div className="a-reminder-usage-copy">
        <span>Reminder count unavailable</span>
        <p>Try refreshing this page. Sends are still checked by the server.</p>
      </div>
    </div>
  );
  const full = usage.totalUsed >= usage.totalLimit;
  const next = usage.nextSlotAt ? new Date(usage.nextSlotAt) : null;
  const nextLabel = next && !Number.isNaN(next.valueOf())
    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(next)
    : null;
  return (
    <div className="a-reminder-usage" aria-label="Reminder usage">
      <div className="a-reminder-usage-copy">
        <span>Reminders sent</span>
        <strong>{usage.totalUsed} <small>of {usage.totalLimit}</small></strong>
        <p>Nudges and Chases together · last 30 days · all communes</p>
      </div>
      <div className="a-reminder-usage-side">
        <div className="a-reminder-usage-track" role="progressbar" aria-label="Reminder allowance used"
          aria-valuenow={Math.min(usage.totalUsed, usage.totalLimit)} aria-valuemin={0}
          aria-valuemax={usage.totalLimit}>
          <span style={{ width: `${Math.min(100, usage.totalUsed / usage.totalLimit * 100)}%` }} />
        </div>
        <span>{full ? nextLabel ? `Next slot opens ${nextLabel}` : "Limit reached" : `${usage.totalLimit - usage.totalUsed} remaining`}</span>
      </div>
    </div>
  );
}

export function RecipientReminderCount({ usage, recipientId }: { usage: Usage | null; recipientId: string }) {
  if (!usage) return null;
  return (
    <span className="a-reminder-recipient-count">
      {usage.recipientUsage[recipientId] ?? 0}/{usage.recipientLimit} reminders to this person
    </span>
  );
}
