import type { ReminderUsage as Usage } from "../live/model";

export function reminderLimitReached(usage: Usage | null, recipientId: string): boolean {
  return !!usage && (
    usage.totalUsed >= usage.totalLimit ||
    (usage.recipientUsage[recipientId] ?? 0) >= usage.recipientLimit
  );
}

export function ReminderUsageMeter({ usage, placement = "default" }: { usage: Usage | null; placement?: "default" | "sidebar" | "account" }) {
  if (!usage) return null;
  const full = usage.totalUsed >= usage.totalLimit;
  const next = usage.nextSlotAt ? new Date(usage.nextSlotAt) : null;
  const nextLabel = next && !Number.isNaN(next.valueOf())
    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(next)
    : null;
  return (
    <details className={`a-reminder-usage a-reminder-usage--${placement}`} onKeyDown={(event) => {
      if (event.key === "Escape") {
        event.currentTarget.open = false;
        event.currentTarget.querySelector("summary")?.focus();
      }
    }}>
      <summary aria-label={`Reminder allowance: ${usage.totalUsed} of ${usage.totalLimit} used in the last 30 days`}>
        {placement === "sidebar"
          ? <span>{Math.max(0, usage.totalLimit - usage.totalUsed)} reminders left</span>
          : <><span>Reminders</span><strong>{usage.totalUsed}/{usage.totalLimit}</strong></>}
      </summary>
      <div className="a-reminder-usage-details">
      <div className="a-reminder-usage-copy">
        <span>Reminders sent</span>
        <p>Nudges and Chases together · last 30 days · all communes</p>
        <p>Up to {usage.recipientLimit} per person. Each reminder has a 72-hour cooldown.</p>
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
    </details>
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
