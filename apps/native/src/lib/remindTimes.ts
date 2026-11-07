/**
 * When "Remind me" goes off. Tonight is 7pm (or the hour chosen in
 * Notification settings), or an hour from now once it is
 * nearly 7pm already; tomorrow morning is 8am the next day.
 */
export type ReminderChoice = { id: "tonight" | "morning"; at: Date; label: string; words: string };

export function reminderChoices(now: Date, hour = 19): ReminderChoice[] {
  const seven = new Date(now); seven.setHours(hour, 0, 0, 0);
  const at = `${hour > 12 ? hour - 12 : hour}${hour >= 12 ? "pm" : "am"}`;
  const late = seven.getTime() - now.getTime() < 30 * 60 * 1000;
  const tonight: ReminderChoice = late
    ? { id: "tonight", at: new Date(now.getTime() + 60 * 60 * 1000), label: "Remind me in an hour", words: "in an hour" }
    : { id: "tonight", at: seven, label: "Remind me tonight", words: `tonight at ${at}` };
  const morning = new Date(now); morning.setDate(morning.getDate() + 1); morning.setHours(8, 0, 0, 0);
  return [tonight, { id: "morning", at: morning, label: "Remind me tomorrow morning", words: "tomorrow at 8am" }];
}
