import type { ReminderUsage as Usage } from "../live/model";

export function reminderLimitReached(usage: Usage | null, recipientId: string): boolean {
  return !!usage && (
    usage.totalUsed >= usage.totalLimit ||
    (usage.recipientUsage[recipientId] ?? 0) >= usage.recipientLimit
  );
}

// When the oldest reminder in the last 30 days stops counting.
function nextSlotLabel(usage: Usage): string | null {
  const next = usage.nextSlotAt ? new Date(usage.nextSlotAt) : null;
  return next && !Number.isNaN(next.valueOf())
    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(next)
    : null;
}

export function ReminderUsageMeter({ usage, placement = "default" }: { usage: Usage | null; placement?: "default" | "account" }) {
  if (!usage) return null;
  const full = usage.totalUsed >= usage.totalLimit;
  const nextLabel = nextSlotLabel(usage);
  return (
    <details className={`a-reminder-usage a-reminder-usage--${placement}`} onKeyDown={(event) => {
      // Close only this popover, not the window or dialog around it.
      if (event.key === "Escape" && event.currentTarget.open) {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.open = false;
        event.currentTarget.querySelector("summary")?.focus();
      }
    }}>
      {/* Named from what it shows, with the allowance in words after it. */}
      <summary>
        <span>Reminders</span><strong aria-hidden="true">{usage.totalUsed}/{usage.totalLimit}</strong>
        {" "}<span className="c-visually-hidden">({usage.totalUsed} of {usage.totalLimit} used in the last 30 days)</span>
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

/**
 * Where reminders are sent: a short notice once a fifth of the allowance or
 * less is left. Until then nothing; the confirmation shows the allowance.
 */
export function ReminderAllowanceNotice({ usage }: { usage: Usage | null }) {
  if (!usage || usage.totalLimit <= 0) return null;
  const left = Math.max(0, usage.totalLimit - usage.totalUsed);
  if (left * 5 > usage.totalLimit) return null;
  const next = nextSlotLabel(usage);
  return (
    <p className="c-allowance-note" role="note">
      {left
        ? `${left} of your ${usage.totalLimit} reminders left. Each one comes back 30 days after it was sent.`
        : `No reminders left.${next ? ` The next one comes back on ${next}.` : ""}`}
    </p>
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
