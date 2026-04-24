import { describe, it, expect } from 'vitest';
import {
  calculateDaysPresent,
  calculateProration,
  needsProration,
  getProrationInfo,
} from './proration';

// ─── Small seeded LCG for deterministic property-style tests ─────────────────
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

// ─── calculateDaysPresent ────────────────────────────────────────────────────

describe('calculateDaysPresent', () => {
  it('returns total days for a member present through a full 30-day period', () => {
    // April has 30 days. Period is [2026-04-01, 2026-05-01) = 30 days.
    expect(
      calculateDaysPresent(null, null, '2026-04-01', '2026-05-01'),
    ).toBe(30);
  });

  it('returns zero when period is degenerate (start >= end)', () => {
    expect(
      calculateDaysPresent(null, null, '2026-04-01', '2026-04-01'),
    ).toBe(0);
    expect(
      calculateDaysPresent(null, null, '2026-04-05', '2026-04-01'),
    ).toBe(0);
  });

  it('handles a member joining mid-cycle (joined on day 16 of a 30-day month)', () => {
    // Joined 2026-04-16, period [2026-04-01, 2026-05-01)
    // Days present = [2026-04-16, 2026-05-01) = 15 days
    expect(
      calculateDaysPresent('2026-04-16', null, '2026-04-01', '2026-05-01'),
    ).toBe(15);
  });

  it('handles a member leaving mid-cycle', () => {
    // Left 2026-04-16, period [2026-04-01, 2026-05-01)
    // Days present = [2026-04-01, 2026-04-16) = 15 days
    expect(
      calculateDaysPresent(null, '2026-04-16', '2026-04-01', '2026-05-01'),
    ).toBe(15);
  });

  it('cycle boundary: joined on day 1 (== periodStart) → full period', () => {
    expect(
      calculateDaysPresent('2026-04-01', null, '2026-04-01', '2026-05-01'),
    ).toBe(30);
  });

  it('cycle boundary: left on periodEnd → full period', () => {
    // effectiveUntil === periodEnd, which is exclusive — member is present
    // through the final day, so expect 30 days.
    expect(
      calculateDaysPresent(null, '2026-05-01', '2026-04-01', '2026-05-01'),
    ).toBe(30);
  });

  it('cycle boundary: left on periodStart → zero days', () => {
    expect(
      calculateDaysPresent(null, '2026-04-01', '2026-04-01', '2026-05-01'),
    ).toBe(0);
  });

  it('member joined after the period entirely → zero days', () => {
    expect(
      calculateDaysPresent('2026-06-01', null, '2026-04-01', '2026-05-01'),
    ).toBe(0);
  });

  it('member left before the period entirely → zero days', () => {
    expect(
      calculateDaysPresent(null, '2026-03-01', '2026-04-01', '2026-05-01'),
    ).toBe(0);
  });

  it('clamps effectiveFrom earlier than periodStart', () => {
    expect(
      calculateDaysPresent('2025-01-01', null, '2026-04-01', '2026-05-01'),
    ).toBe(30);
  });

  it('clamps effectiveUntil later than periodEnd', () => {
    expect(
      calculateDaysPresent(null, '2030-01-01', '2026-04-01', '2026-05-01'),
    ).toBe(30);
  });

  it('leap-year February 2024 has 29 days', () => {
    expect(
      calculateDaysPresent(null, null, '2024-02-01', '2024-03-01'),
    ).toBe(29);
  });

  it('non-leap February 2026 has 28 days', () => {
    expect(
      calculateDaysPresent(null, null, '2026-02-01', '2026-03-01'),
    ).toBe(28);
  });

  it('31-day month (January) has 31 days', () => {
    expect(
      calculateDaysPresent(null, null, '2026-01-01', '2026-02-01'),
    ).toBe(31);
  });

  it('member present for 14 of 28 days in February gives 14', () => {
    expect(
      calculateDaysPresent(
        '2026-02-15',
        null,
        '2026-02-01',
        '2026-03-01',
      ),
    ).toBe(14);
  });
});

// ─── calculateProration ──────────────────────────────────────────────────────

describe('calculateProration', () => {
  it('returns full share for a full-period member', () => {
    expect(
      calculateProration(null, null, '2026-04-01', '2026-05-01', 100),
    ).toBe(100);
  });

  it('returns zero when member had no presence in the period', () => {
    expect(
      calculateProration(
        '2026-06-01',
        null,
        '2026-04-01',
        '2026-05-01',
        100,
      ),
    ).toBe(0);
  });

  it('returns zero when the period is degenerate', () => {
    expect(
      calculateProration(null, null, '2026-04-01', '2026-04-01', 100),
    ).toBe(0);
  });

  it('prorates a half-period join correctly', () => {
    // 15 of 30 days → half the share
    expect(
      calculateProration(
        '2026-04-16',
        null,
        '2026-04-01',
        '2026-05-01',
        100,
      ),
    ).toBe(50);
  });

  it('prorates a half-period departure correctly', () => {
    expect(
      calculateProration(
        null,
        '2026-04-16',
        '2026-04-01',
        '2026-05-01',
        100,
      ),
    ).toBe(50);
  });

  it('rounds to 2 decimal places using banker-ish rounding', () => {
    // 10 / 30 * 100 = 33.3333... → rounds to 33.33
    expect(
      calculateProration(
        '2026-04-21',
        null,
        '2026-04-01',
        '2026-05-01',
        100,
      ),
    ).toBe(33.33);
  });

  it('handles leap-year February correctly', () => {
    // 2024-02-15 → 2024-03-01 is 15 days of a 29-day month
    // 15/29 * 100 = 51.724... → 51.72
    expect(
      calculateProration(
        '2024-02-15',
        null,
        '2024-02-01',
        '2024-03-01',
        100,
      ),
    ).toBe(51.72);
  });

  it('handles non-leap February correctly (14/28 = 50)', () => {
    expect(
      calculateProration(
        '2026-02-15',
        null,
        '2026-02-01',
        '2026-03-01',
        100,
      ),
    ).toBe(50);
  });

  it('sum of active-member prorated shares equals sum of per-day billings (±1 cent)', () => {
    // Simulate 3 members in a 30-day April cycle, full share = 60.
    // m1: full period
    // m2: joined on day 11 (20 days)
    // m3: left on day 21 (20 days)
    // Expected per-member (rounded to 2dp): 60, 40, 40 → total 140.
    const full = 60;
    const m1 = calculateProration(
      null,
      null,
      '2026-04-01',
      '2026-05-01',
      full,
    );
    const m2 = calculateProration(
      '2026-04-11',
      null,
      '2026-04-01',
      '2026-05-01',
      full,
    );
    const m3 = calculateProration(
      null,
      '2026-04-21',
      '2026-04-01',
      '2026-05-01',
      full,
    );
    expect(m1).toBe(60);
    expect(m2).toBe(40);
    expect(m3).toBe(40);
    expect(Math.round((m1 + m2 + m3) * 100) / 100).toBe(140);
  });

  it('property: prorated ≤ fullShare and prorated ≥ 0 for any random period', () => {
    const rand = lcg(0xfeed);
    for (let trial = 0; trial < 40; trial++) {
      // Period of 28..31 days
      const year = 2024 + Math.floor(rand() * 6);
      const month = 1 + Math.floor(rand() * 12);
      const pStart = `${year}-${String(month).padStart(2, '0')}-01`;
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const pEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

      const fullShare = Math.round(rand() * 50000) / 100; // 0..500.00
      const joinDay = 1 + Math.floor(rand() * 28);
      const effectiveFrom = `${year}-${String(month).padStart(2, '0')}-${String(joinDay).padStart(2, '0')}`;

      const prorated = calculateProration(
        effectiveFrom,
        null,
        pStart,
        pEnd,
        fullShare,
      );
      expect(prorated).toBeGreaterThanOrEqual(0);
      expect(prorated).toBeLessThanOrEqual(fullShare + 0.01);
    }
  });

  it('property: prorated amount in cents equals round(fullCents * days / total)', () => {
    // 23 of 31 days, full share 123.45
    // cents: 12345 * 23 / 31 = 9159.19... → round to 9159 → 91.59
    expect(
      calculateProration(
        '2026-01-09',
        null,
        '2026-01-01',
        '2026-02-01',
        123.45,
      ),
    ).toBe(91.59);
  });
});

// ─── needsProration ──────────────────────────────────────────────────────────

describe('needsProration', () => {
  it('full-period membership does not need proration', () => {
    expect(
      needsProration(null, null, '2026-04-01', '2026-05-01'),
    ).toBe(false);
  });

  it('joined before period and left after period does not need proration', () => {
    expect(
      needsProration(
        '2020-01-01',
        '2030-01-01',
        '2026-04-01',
        '2026-05-01',
      ),
    ).toBe(false);
  });

  it('joined exactly on periodStart does not need proration', () => {
    expect(
      needsProration('2026-04-01', null, '2026-04-01', '2026-05-01'),
    ).toBe(false);
  });

  it('joined mid-period needs proration', () => {
    expect(
      needsProration('2026-04-16', null, '2026-04-01', '2026-05-01'),
    ).toBe(true);
  });

  it('left mid-period needs proration', () => {
    expect(
      needsProration(null, '2026-04-16', '2026-04-01', '2026-05-01'),
    ).toBe(true);
  });

  it('member not present at all during period needs proration (zero share)', () => {
    expect(
      needsProration('2026-06-01', null, '2026-04-01', '2026-05-01'),
    ).toBe(true);
  });

  it('left exactly on periodEnd does not need proration', () => {
    // periodEnd is exclusive, so leaving on that day == staying through the full period
    expect(
      needsProration(null, '2026-05-01', '2026-04-01', '2026-05-01'),
    ).toBe(false);
  });
});

// ─── getProrationInfo ────────────────────────────────────────────────────────

describe('getProrationInfo', () => {
  it('returns null when proration is not needed', () => {
    expect(
      getProrationInfo(null, null, '2026-04-01', '2026-05-01'),
    ).toBeNull();
  });

  it('returns days/total/ratio for a mid-cycle joiner', () => {
    const info = getProrationInfo(
      '2026-04-16',
      null,
      '2026-04-01',
      '2026-05-01',
    );
    expect(info).not.toBeNull();
    expect(info!.daysPresent).toBe(15);
    expect(info!.totalDays).toBe(30);
    expect(info!.ratio).toBe(0.5);
  });

  it('returns ratio=0 for a member who was never present in the period', () => {
    const info = getProrationInfo(
      '2026-06-01',
      null,
      '2026-04-01',
      '2026-05-01',
    );
    expect(info).not.toBeNull();
    expect(info!.daysPresent).toBe(0);
    expect(info!.totalDays).toBe(30);
    expect(info!.ratio).toBe(0);
  });
});
