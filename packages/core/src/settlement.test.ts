import { describe, it, expect } from 'vitest';
import type { LinkedPair } from '@commune/types';
import {
  calculateNetBalances,
  simplifyDebts,
  calculateSettlement,
  calculateSettlementWithCouples,
  mergeLinkedBalances,
  type NetBalance,
} from './settlement';

// ─── Small seeded LCG for deterministic property-style tests ─────────────────
// Numerical Recipes constants. Good enough for non-cryptographic randomness.
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}

function sumCents(nums: number[]): number {
  return nums.reduce((s, n) => s + Math.round(n * 100), 0);
}

// ─── calculateNetBalances ────────────────────────────────────────────────────

describe('calculateNetBalances', () => {
  it('returns empty when no expenses', () => {
    expect(calculateNetBalances([])).toEqual([]);
  });

  it('excludes users whose balance nets to zero', () => {
    // Alice pays 30, split equally between Alice/Bob/Charlie
    // then Bob pays 30 split the same way, etc. — everyone nets 0
    const balances = calculateNetBalances([
      {
        payerId: 'alice',
        participants: [
          { userId: 'alice', shareAmount: 10 },
          { userId: 'bob', shareAmount: 10 },
          { userId: 'charlie', shareAmount: 10 },
        ],
      },
      {
        payerId: 'bob',
        participants: [
          { userId: 'alice', shareAmount: 10 },
          { userId: 'bob', shareAmount: 10 },
          { userId: 'charlie', shareAmount: 10 },
        ],
      },
      {
        payerId: 'charlie',
        participants: [
          { userId: 'alice', shareAmount: 10 },
          { userId: 'bob', shareAmount: 10 },
          { userId: 'charlie', shareAmount: 10 },
        ],
      },
    ]);
    expect(balances).toEqual([]);
  });

  it('credits payer and debits participants correctly', () => {
    // Alice pays 30; Alice/Bob/Charlie each owe 10
    // Alice nets +20 (paid 30, owes 10); Bob nets -10; Charlie nets -10
    const balances = calculateNetBalances([
      {
        payerId: 'alice',
        participants: [
          { userId: 'alice', shareAmount: 10 },
          { userId: 'bob', shareAmount: 10 },
          { userId: 'charlie', shareAmount: 10 },
        ],
      },
    ]);
    const byUser = Object.fromEntries(balances.map((b) => [b.userId, b.amount]));
    expect(byUser.alice).toBe(20);
    expect(byUser.bob).toBe(-10);
    expect(byUser.charlie).toBe(-10);
  });

  it('sum of net balances is zero (conservation of money)', () => {
    const balances = calculateNetBalances([
      {
        payerId: 'a',
        participants: [
          { userId: 'a', shareAmount: 33.34 },
          { userId: 'b', shareAmount: 33.33 },
          { userId: 'c', shareAmount: 33.33 },
        ],
      },
      {
        payerId: 'b',
        participants: [
          { userId: 'a', shareAmount: 5 },
          { userId: 'b', shareAmount: 5 },
        ],
      },
    ]);
    expect(sumCents(balances.map((b) => b.amount))).toBe(0);
  });
});

// ─── simplifyDebts ───────────────────────────────────────────────────────────

describe('simplifyDebts', () => {
  it('returns no transfers when balances are empty', () => {
    expect(simplifyDebts([])).toEqual([]);
  });

  it('returns no transfers when there is only one member', () => {
    expect(simplifyDebts([{ userId: 'a', amount: 50 }])).toEqual([]);
  });

  it('handles a single creditor with a single debtor', () => {
    const txns = simplifyDebts([
      { userId: 'a', amount: 50 },
      { userId: 'b', amount: -50 },
    ]);
    expect(txns).toEqual([{ fromUserId: 'b', toUserId: 'a', amount: 50 }]);
  });

  it('handles multiple creditors and debtors with a greedy match', () => {
    // a owes 100, b owes 40 ; c is owed 90, d is owed 50
    const txns = simplifyDebts([
      { userId: 'a', amount: -100 },
      { userId: 'b', amount: -40 },
      { userId: 'c', amount: 90 },
      { userId: 'd', amount: 50 },
    ]);

    // Sum of transfer amounts must equal sum of |balances| / 2
    const absSum = sumCents([100, 40, 90, 50]) / 2;
    expect(sumCents(txns.map((t) => t.amount))).toBe(absSum);

    // Transfers ≤ n - 1 (classic debt-minimization upper bound)
    expect(txns.length).toBeLessThanOrEqual(3);

    // No phantom zero rows
    for (const t of txns) {
      expect(t.amount).toBeGreaterThan(0);
    }

    // Every transfer is from a true debtor to a true creditor
    for (const t of txns) {
      expect(['a', 'b']).toContain(t.fromUserId);
      expect(['c', 'd']).toContain(t.toUserId);
    }
  });

  it('produces no zero-amount phantom rows when balances cancel exactly', () => {
    const txns = simplifyDebts([
      { userId: 'a', amount: 25 },
      { userId: 'b', amount: 25 },
      { userId: 'c', amount: -25 },
      { userId: 'd', amount: -25 },
    ]);
    expect(txns.length).toBe(2);
    for (const t of txns) {
      expect(t.amount).toBe(25);
    }
  });

  it('skips zero-balance members entirely (no self-settlement)', () => {
    // 'zero' shouldn't appear anywhere in the transactions
    const txns = simplifyDebts([
      { userId: 'zero', amount: 0 },
      { userId: 'creditor', amount: 10 },
      { userId: 'debtor', amount: -10 },
    ]);
    for (const t of txns) {
      expect(t.fromUserId).not.toBe('zero');
      expect(t.toUserId).not.toBe('zero');
      expect(t.fromUserId).not.toBe(t.toUserId);
    }
    expect(txns).toHaveLength(1);
  });

  it('never produces a self-transfer (fromUserId === toUserId)', () => {
    const txns = simplifyDebts([
      { userId: 'a', amount: 30 },
      { userId: 'b', amount: -20 },
      { userId: 'c', amount: -10 },
    ]);
    for (const t of txns) {
      expect(t.fromUserId).not.toBe(t.toUserId);
    }
  });

  it('is deterministic: same input produces the same output', () => {
    const input: NetBalance[] = [
      { userId: 'a', amount: 17.5 },
      { userId: 'b', amount: -12.25 },
      { userId: 'c', amount: -5.25 },
      { userId: 'd', amount: 33.33 },
      { userId: 'e', amount: -33.33 },
    ];
    const first = simplifyDebts([...input]);
    const second = simplifyDebts([...input]);
    expect(second).toEqual(first);
  });

  it('transfer count ≤ n - 1 across many random balance vectors', () => {
    const rand = lcg(0xc0ffee);
    for (let trial = 0; trial < 20; trial++) {
      const n = 3 + Math.floor(rand() * 8); // 3..10 members
      const cents: number[] = [];
      let running = 0;
      for (let i = 0; i < n - 1; i++) {
        // random in [-5000, 5000] cents
        const c = Math.floor(rand() * 10001) - 5000;
        cents.push(c);
        running += c;
      }
      // final member absorbs remainder so the total sums to zero
      cents.push(-running);
      const balances: NetBalance[] = cents
        .map((c, i) => ({ userId: `u${i}`, amount: round2(c / 100) }))
        .filter((b) => b.amount !== 0);

      const txns = simplifyDebts(balances);
      expect(txns.length).toBeLessThanOrEqual(Math.max(0, balances.length - 1));

      const absCents = sumCents(balances.map((b) => Math.abs(b.amount)));
      // Transfers equal |balances|/2 exactly (all ledgers sum to zero)
      expect(sumCents(txns.map((t) => t.amount))).toBe(absCents / 2);

      for (const t of txns) {
        expect(t.amount).toBeGreaterThan(0);
        expect(t.fromUserId).not.toBe(t.toUserId);
      }
    }
  });

  it('handles rounding with 3-way fractional-penny splits', () => {
    // a paid 10.00 split 3 ways → 3.34 / 3.33 / 3.33
    // nets: a = +6.66, b = -3.33, c = -3.33
    const txns = simplifyDebts([
      { userId: 'a', amount: 6.66 },
      { userId: 'b', amount: -3.33 },
      { userId: 'c', amount: -3.33 },
    ]);
    expect(sumCents(txns.map((t) => t.amount))).toBe(666);
  });
});

// ─── calculateSettlement ─────────────────────────────────────────────────────

describe('calculateSettlement', () => {
  it('returns empty isSettled=true when there are no expenses', () => {
    const result = calculateSettlement([], new Map());
    expect(result).toEqual({
      transactions: [],
      transactionCount: 0,
      isSettled: true,
    });
  });

  it('returns isSettled=true when all balances cancel', () => {
    // Everyone pays their own share of something split equally
    const result = calculateSettlement(
      [
        {
          payerId: 'a',
          participants: [{ userId: 'a', shareAmount: 10 }],
        },
      ],
      new Map([['a', 'Alice']]),
    );
    expect(result.isSettled).toBe(true);
    expect(result.transactions).toEqual([]);
  });

  it('attaches display names', () => {
    const result = calculateSettlement(
      [
        {
          payerId: 'a',
          participants: [
            { userId: 'a', shareAmount: 10 },
            { userId: 'b', shareAmount: 10 },
          ],
        },
      ],
      new Map([
        ['a', 'Alice'],
        ['b', 'Bob'],
      ]),
    );
    expect(result.transactionCount).toBe(1);
    expect(result.transactions[0]).toMatchObject({
      fromUserId: 'b',
      toUserId: 'a',
      amount: 10,
      fromUserName: 'Bob',
      toUserName: 'Alice',
    });
  });

  it('falls back to "Unknown" for missing names', () => {
    const result = calculateSettlement(
      [
        {
          payerId: 'ghost',
          participants: [
            { userId: 'ghost', shareAmount: 5 },
            { userId: 'real', shareAmount: 5 },
          ],
        },
      ],
      new Map([['real', 'Real']]),
    );
    expect(result.transactions[0]!.toUserName).toBe('Unknown');
    expect(result.transactions[0]!.fromUserName).toBe('Real');
  });

  it('produces a self-skip: a user who pays only for themselves has no transfer', () => {
    // Alice pays 100, only Alice participates. Net is 0. No transfers.
    const result = calculateSettlement(
      [
        {
          payerId: 'alice',
          participants: [{ userId: 'alice', shareAmount: 100 }],
        },
      ],
      new Map([['alice', 'Alice']]),
    );
    expect(result.transactions).toEqual([]);
    expect(result.isSettled).toBe(true);
  });
});

// ─── mergeLinkedBalances ─────────────────────────────────────────────────────

describe('mergeLinkedBalances', () => {
  it('returns input unchanged when there are no linked pairs', () => {
    const balances: NetBalance[] = [{ userId: 'a', amount: 10 }];
    const names = new Map([['a', 'Alice']]);
    const { mergedBalances, mergedNames } = mergeLinkedBalances(
      balances,
      [],
      names,
    );
    expect(mergedBalances).toEqual(balances);
    expect(mergedNames).toEqual(names);
  });

  it('sums linked partners and attributes to the canonical (lower-id) user', () => {
    const linkedPairs: LinkedPair[] = [{ userIdA: 'b', userIdB: 'a' }];
    const balances: NetBalance[] = [
      { userId: 'a', amount: 5 },
      { userId: 'b', amount: -3 },
      { userId: 'c', amount: -2 },
    ];
    const names = new Map([
      ['a', 'Alice'],
      ['b', 'Bob'],
      ['c', 'Charlie'],
    ]);
    const { mergedBalances, mergedNames } = mergeLinkedBalances(
      balances,
      linkedPairs,
      names,
    );
    const byUser = Object.fromEntries(
      mergedBalances.map((b) => [b.userId, b.amount]),
    );
    expect(byUser.a).toBe(2); // canonical = 'a' (lower id)
    expect(byUser.c).toBe(-2);
    expect(mergedNames.get('a')).toBe('Alice & Bob');
  });

  it('drops a linked pair whose combined balance is zero', () => {
    const linkedPairs: LinkedPair[] = [{ userIdA: 'a', userIdB: 'b' }];
    const balances: NetBalance[] = [
      { userId: 'a', amount: 5 },
      { userId: 'b', amount: -5 },
      { userId: 'c', amount: 0 },
    ];
    const { mergedBalances } = mergeLinkedBalances(
      balances,
      linkedPairs,
      new Map(),
    );
    expect(mergedBalances.find((b) => b.userId === 'a')).toBeUndefined();
  });
});

// ─── calculateSettlementWithCouples ──────────────────────────────────────────

describe('calculateSettlementWithCouples', () => {
  it('returns an empty result when there are no expenses', () => {
    const result = calculateSettlementWithCouples([], new Map(), []);
    expect(result.isSettled).toBe(true);
    expect(result.transactions).toEqual([]);
  });

  it('reduces the number of transactions when partners are linked', () => {
    // Without linking: alice +15, bob +0, carol -10, dave -5
    // With alice↔bob linked (canonical = alice): alice +15, carol -10, dave -5
    const expenses = [
      {
        payerId: 'alice',
        participants: [
          { userId: 'alice', shareAmount: 5 },
          { userId: 'bob', shareAmount: 5 },
          { userId: 'carol', shareAmount: 5 },
          { userId: 'dave', shareAmount: 5 },
        ],
      },
      {
        payerId: 'bob',
        participants: [
          { userId: 'bob', shareAmount: 5 },
          { userId: 'carol', shareAmount: 5 },
        ],
      },
    ];
    const names = new Map([
      ['alice', 'Alice'],
      ['bob', 'Bob'],
      ['carol', 'Carol'],
      ['dave', 'Dave'],
    ]);
    const plain = calculateSettlement(expenses, names);
    const coupled = calculateSettlementWithCouples(expenses, names, [
      { userIdA: 'alice', userIdB: 'bob' },
    ]);
    expect(coupled.transactionCount).toBeLessThanOrEqual(plain.transactionCount);
    for (const t of coupled.transactions) {
      expect(t.amount).toBeGreaterThan(0);
      expect(t.fromUserId).not.toBe(t.toUserId);
    }
    // Composite name should appear whenever 'alice' is either side
    for (const t of coupled.transactions) {
      if (t.fromUserId === 'alice') {
        expect(t.fromUserName).toBe('Alice & Bob');
      }
      if (t.toUserId === 'alice') {
        expect(t.toUserName).toBe('Alice & Bob');
      }
    }
  });
});
