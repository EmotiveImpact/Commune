import { describe, expect, it } from 'vitest';
import {
  getCycleWindow,
  getNextCycleWindow,
  getPreviousCycleWindow,
} from './cycle';

describe('getCycleWindow', () => {
  it('uses the current month when the reference is on the cycle day', () => {
    expect(getCycleWindow('2026-03-15', 15)).toEqual({
      start: '2026-03-15',
      end: '2026-04-14',
      endExclusive: '2026-04-15',
      key: '2026-03-15',
    });
  });

  it('uses the previous month when the reference is before the cycle day', () => {
    expect(getCycleWindow('2026-03-10', 15)).toEqual({
      start: '2026-02-15',
      end: '2026-03-14',
      endExclusive: '2026-03-15',
      key: '2026-02-15',
    });
  });

  it('handles year boundaries', () => {
    expect(getCycleWindow('2026-01-02', 5)).toEqual({
      start: '2025-12-05',
      end: '2026-01-04',
      endExclusive: '2026-01-05',
      key: '2025-12-05',
    });
  });

  it('throws on unsupported cycle dates', () => {
    expect(() => getCycleWindow('2026-03-01', 0)).toThrow(
      'Cycle date must be an integer between 1 and 28',
    );
    expect(() => getCycleWindow('2026-03-01', 29)).toThrow(
      'Cycle date must be an integer between 1 and 28',
    );
  });
});

describe('cycle navigation helpers', () => {
  it('returns the previous cycle window', () => {
    expect(getPreviousCycleWindow('2026-03-22', 12)).toEqual({
      start: '2026-02-12',
      end: '2026-03-11',
      endExclusive: '2026-03-12',
      key: '2026-02-12',
    });
  });

  it('returns the next cycle window', () => {
    expect(getNextCycleWindow('2026-03-22', 12)).toEqual({
      start: '2026-04-12',
      end: '2026-05-11',
      endExclusive: '2026-05-12',
      key: '2026-04-12',
    });
  });
});
