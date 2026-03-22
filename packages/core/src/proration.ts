// ─── Member Proration for Mid-Cycle Join / Leave ─────────────────────────────
// Pure functions for calculating prorated expense shares.
// All monetary calculations use cents internally to avoid floating-point errors.

/**
 * Calculate the number of days a member was present during a billing period.
 *
 * @param effectiveFrom  - Date when member started (ISO date string YYYY-MM-DD)
 * @param effectiveUntil - Date when member left (ISO date string YYYY-MM-DD), null if still active
 * @param periodStart    - Start of billing period (ISO date string YYYY-MM-DD)
 * @param periodEnd      - End of billing period (ISO date string YYYY-MM-DD, exclusive)
 * @returns Number of days the member was present in the period (0 if none)
 */
export function calculateDaysPresent(
  effectiveFrom: string | null,
  effectiveUntil: string | null,
  periodStart: string,
  periodEnd: string,
): number {
  const pStart = new Date(periodStart);
  const pEnd = new Date(periodEnd);
  const totalDays = daysBetween(pStart, pEnd);

  if (totalDays <= 0) return 0;

  // If no effective_from, member was present for the entire period
  const memberStart = effectiveFrom ? new Date(effectiveFrom) : pStart;
  // If no effective_until, member is still active through end of period
  const memberEnd = effectiveUntil ? new Date(effectiveUntil) : pEnd;

  // Clamp to the billing period
  const clampedStart = memberStart > pStart ? memberStart : pStart;
  const clampedEnd = memberEnd < pEnd ? memberEnd : pEnd;

  const daysPresent = daysBetween(clampedStart, clampedEnd);

  return Math.max(0, daysPresent);
}

/**
 * Calculate a prorated share amount for a member based on their presence
 * during a billing period.
 *
 * @param effectiveFrom  - Date when member started (ISO date string YYYY-MM-DD)
 * @param effectiveUntil - Date when member left (ISO date string YYYY-MM-DD), null if still active
 * @param periodStart    - Start of billing period (ISO date string YYYY-MM-DD)
 * @param periodEnd      - End of billing period (ISO date string YYYY-MM-DD, exclusive)
 * @param fullShare      - The full (non-prorated) share amount in currency units
 * @returns The prorated amount, rounded to 2 decimal places
 */
export function calculateProration(
  effectiveFrom: string | null,
  effectiveUntil: string | null,
  periodStart: string,
  periodEnd: string,
  fullShare: number,
): number {
  const pStart = new Date(periodStart);
  const pEnd = new Date(periodEnd);
  const totalDays = daysBetween(pStart, pEnd);

  if (totalDays <= 0) return 0;

  const daysPresent = calculateDaysPresent(
    effectiveFrom,
    effectiveUntil,
    periodStart,
    periodEnd,
  );

  if (daysPresent <= 0) return 0;
  if (daysPresent >= totalDays) return fullShare;

  // Use cents to avoid floating-point drift
  const fullShareCents = Math.round(fullShare * 100);
  const proratedCents = Math.round((fullShareCents * daysPresent) / totalDays);

  return Number((proratedCents / 100).toFixed(2));
}

/**
 * Check whether a member needs proration for a given billing period.
 * Returns true if the member's effective_from or effective_until falls within
 * the billing period boundaries.
 *
 * @param effectiveFrom  - Date when member started (ISO date string YYYY-MM-DD)
 * @param effectiveUntil - Date when member left (ISO date string YYYY-MM-DD), null if still active
 * @param periodStart    - Start of billing period (ISO date string YYYY-MM-DD)
 * @param periodEnd      - End of billing period (ISO date string YYYY-MM-DD, exclusive)
 * @returns true if proration applies
 */
export function needsProration(
  effectiveFrom: string | null,
  effectiveUntil: string | null,
  periodStart: string,
  periodEnd: string,
): boolean {
  const pStart = new Date(periodStart);
  const pEnd = new Date(periodEnd);

  // Member joined after period start
  if (effectiveFrom) {
    const from = new Date(effectiveFrom);
    if (from > pStart && from < pEnd) return true;
  }

  // Member left before period end
  if (effectiveUntil) {
    const until = new Date(effectiveUntil);
    if (until > pStart && until < pEnd) return true;
  }

  // Member was not present at all during the period
  const daysPresent = calculateDaysPresent(
    effectiveFrom,
    effectiveUntil,
    periodStart,
    periodEnd,
  );
  const totalDays = daysBetween(pStart, pEnd);

  if (daysPresent === 0 && totalDays > 0) return true;

  return false;
}

/**
 * Build proration details for display in the UI.
 *
 * @returns null if no proration needed, or a ProrationInfo object
 */
export function getProrationInfo(
  effectiveFrom: string | null,
  effectiveUntil: string | null,
  periodStart: string,
  periodEnd: string,
): { daysPresent: number; totalDays: number; ratio: number } | null {
  if (
    !needsProration(effectiveFrom, effectiveUntil, periodStart, periodEnd)
  ) {
    return null;
  }

  const pStart = new Date(periodStart);
  const pEnd = new Date(periodEnd);
  const totalDays = daysBetween(pStart, pEnd);
  const daysPresent = calculateDaysPresent(
    effectiveFrom,
    effectiveUntil,
    periodStart,
    periodEnd,
  );

  return {
    daysPresent,
    totalDays,
    ratio: totalDays > 0 ? daysPresent / totalDays : 0,
  };
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Calculate the number of days between two dates (end - start).
 * Both dates are treated as UTC midnight to avoid timezone issues.
 */
function daysBetween(start: Date, end: Date): number {
  const msPerDay = 86_400_000;
  const startUtc = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const endUtc = Date.UTC(
    end.getFullYear(),
    end.getMonth(),
    end.getDate(),
  );
  return Math.round((endUtc - startUtc) / msPerDay);
}
