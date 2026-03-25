// @ts-expect-error - Vitest is supplied by the workspace test runner, not this package
import { describe, expect, it } from 'vitest';
import {
  computeRecurringDueDate,
  getCurrentMonthKey,
  parsePausedRecurringExpenseState,
} from './recurring';

describe('recurring helpers', () => {
  it('computes recurring due dates using UTC-safe date math', () => {
    expect(
      computeRecurringDueDate(
        'monthly',
        '2026-01-31',
        new Date('2026-02-15T12:00:00.000Z'),
      ),
    ).toBe('2026-02-28');

    expect(
      computeRecurringDueDate(
        'weekly',
        '2026-03-04',
        new Date('2026-03-05T12:00:00.000Z'),
      ),
    ).toBe('2026-03-11');

    expect(
      computeRecurringDueDate(
        'none',
        '2026-03-04',
        new Date('2026-03-05T12:00:00.000Z'),
      ),
    ).toBe('2026-03-05');
  });

  it('preserves pause metadata including the recurrence interval', () => {
    expect(parsePausedRecurringExpenseState('[paused:monthly:3] Office internet')).toEqual({
      recurrence_type: 'monthly',
      recurrence_interval: 3,
      description: 'Office internet',
    });

    expect(parsePausedRecurringExpenseState('[paused:weekly] Slack workspace')).toEqual({
      recurrence_type: 'weekly',
      recurrence_interval: 1,
      description: 'Slack workspace',
    });

    expect(parsePausedRecurringExpenseState('Office internet')).toBeNull();
  });

  it('derives the current month key from the provided reference date', () => {
    expect(getCurrentMonthKey(new Date('2026-03-25T12:00:00.000Z'))).toBe('2026-03');
  });
});
