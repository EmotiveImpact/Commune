/**
 * When "Remind me" goes off. Tonight is 7pm, or an hour from now once it is
 * nearly 7pm already; tomorrow morning is 8am the next day.
 */
export type ReminderChoice = { id: "tonight" | "morning"; at: Date; label: string; words: string };

export function reminderChoices(now: Date): ReminderChoice[] {
  const seven = new Date(now); seven.setHours(19, 0, 0, 0);
  const late = seven.getTime() - now.getTime() < 30 * 60 * 1000;
  const tonight: ReminderChoice = late
    ? { id: "tonight", at: new Date(now.getTime() + 60 * 60 * 1000), label: "Remind me in an hour", words: "in an hour" }
    : { id: "tonight", at: seven, label: "Remind me tonight", words: "tonight at 7pm" };
  const morning = new Date(now); morning.setDate(morning.getDate() + 1); morning.setHours(8, 0, 0, 0);
  return [tonight, { id: "morning", at: morning, label: "Remind me tomorrow morning", words: "tomorrow at 8am" }];
}
