/**
 * Chore utility functions — pure logic for due date calculation and rotation.
 */

export type ChoreFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'once';

/**
 * Calculate the next due date based on frequency.
 */
export function calculateNextDue(frequency: ChoreFrequency, lastDue: string): string {
  const date = new Date(lastDue + 'T00:00:00');

  switch (frequency) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'biweekly':
      date.setDate(date.getDate() + 14);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'once':
      return lastDue; // One-time chores don't advance
  }

  return date.toISOString().slice(0, 10);
}

/**
 * Get the next person in a rotation order.
 */
export function getNextInRotation(
  rotationOrder: string[],
  currentAssignee: string | null,
): string | null {
  if (!rotationOrder || rotationOrder.length === 0) return null;
  if (!currentAssignee) return rotationOrder[0]!;

  const currentIndex = rotationOrder.indexOf(currentAssignee);
  if (currentIndex === -1) return rotationOrder[0]!;

  const nextIndex = (currentIndex + 1) % rotationOrder.length;
  return rotationOrder[nextIndex]!;
}
