import { describe, it, expect } from 'vitest';
import {
  calculateEqualSplit,
  calculatePercentageSplit,
  calculateCustomSplit,
  calculateReimbursements,
} from './splits';

// ─── calculateEqualSplit ─────────────────────────────────────────────────────

describe('calculateEqualSplit', () => {
  it('splits evenly divisible amounts', () => {
    const shares = calculateEqualSplit(100, 5);
    expect(shares).toEqual([20, 20, 20, 20, 20]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('handles remainder pennies (100 / 3)', () => {
    const shares = calculateEqualSplit(100, 3);
    // 100 / 3 = 33.33 each, 1 penny remainder → first participant gets extra
    expect(shares).toEqual([33.34, 33.33, 33.33]);
    const sum = shares.reduce((a, b) => a + b, 0);
    expect(Number(sum.toFixed(2))).toBe(100);
  });

  it('handles very small amounts (0.01 / 3)', () => {
    const shares = calculateEqualSplit(0.01, 3);
    // 1 cent total → first gets 0.01, rest get 0
    expect(shares).toEqual([0.01, 0, 0]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(0.01);
  });

  it('splits between two participants', () => {
    const shares = calculateEqualSplit(10.01, 2);
    expect(shares).toEqual([5.01, 5]);
    const sum = shares.reduce((a, b) => a + b, 0);
    expect(Number(sum.toFixed(2))).toBe(10.01);
  });

  it('returns the full amount for a single participant', () => {
    const shares = calculateEqualSplit(42.99, 1);
    expect(shares).toEqual([42.99]);
  });

  it('throws for zero participants', () => {
    expect(() => calculateEqualSplit(100, 0)).toThrow();
  });
});

// ─── calculatePercentageSplit ────────────────────────────────────────────────

describe('calculatePercentageSplit', () => {
  it('splits by basic percentages', () => {
    const result = calculatePercentageSplit(200, [
      { userId: 'a', percentage: 50 },
      { userId: 'b', percentage: 30 },
      { userId: 'c', percentage: 20 },
    ]);
    expect(result).toEqual([
      { userId: 'a', amount: 100 },
      { userId: 'b', amount: 60 },
      { userId: 'c', amount: 40 },
    ]);
  });

  it('handles non-round percentages', () => {
    const result = calculatePercentageSplit(100, [
      { userId: 'a', percentage: 33.33 },
      { userId: 'b', percentage: 33.33 },
      { userId: 'c', percentage: 33.34 },
    ]);
    expect(result[0]!.amount).toBe(33.33);
    expect(result[1]!.amount).toBe(33.33);
    expect(result[2]!.amount).toBe(33.34);
  });
});

// ─── calculateCustomSplit ────────────────────────────────────────────────────

describe('calculateCustomSplit', () => {
  it('passes through amounts unchanged', () => {
    const input = [
      { userId: 'a', amount: 70 },
      { userId: 'b', amount: 30 },
    ];
    const result = calculateCustomSplit(input);
    expect(result).toEqual([
      { userId: 'a', amount: 70 },
      { userId: 'b', amount: 30 },
    ]);
  });
});

// ─── calculateReimbursements ─────────────────────────────────────────────────

describe('calculateReimbursements', () => {
  it('calculates who owes the payer', () => {
    const shares = [
      { userId: 'payer', amount: 50 },
      { userId: 'b', amount: 30 },
      { userId: 'c', amount: 20 },
    ];
    const result = calculateReimbursements(shares, 'payer');
    expect(result).toEqual([
      { userId: 'b', owesTo: 'payer', amount: 30 },
      { userId: 'c', owesTo: 'payer', amount: 20 },
    ]);
  });

  it('returns empty array when payer is the only participant', () => {
    const shares = [{ userId: 'payer', amount: 100 }];
    const result = calculateReimbursements(shares, 'payer');
    expect(result).toEqual([]);
  });

  it('excludes participants with zero amount', () => {
    const shares = [
      { userId: 'payer', amount: 100 },
      { userId: 'b', amount: 0 },
      { userId: 'c', amount: 25 },
    ];
    const result = calculateReimbursements(shares, 'payer');
    expect(result).toEqual([
      { userId: 'c', owesTo: 'payer', amount: 25 },
    ]);
  });
});
