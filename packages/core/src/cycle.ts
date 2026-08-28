export interface CycleWindow {
  start: string;
  end: string;
  endExclusive: string;
  key: string;
}

function clampCycleDate(cycleDate: number): number {
  if (!Number.isInteger(cycleDate) || cycleDate < 1 || cycleDate > 28) {
    throw new Error('Cycle date must be an integer between 1 and 28');
  }

  return cycleDate;
}

function parseInputDate(input: Date | string): Date {
  if (input instanceof Date) {
    return new Date(
      Date.UTC(
        input.getUTCFullYear(),
        input.getUTCMonth(),
        input.getUTCDate(),
      ),
    );
  }

  const [year, month, day] = input.split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!));
}

function createUtcDate(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day));
}

function shiftUtcMonth(date: Date, offset: number): Date {
  return createUtcDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + offset,
    date.getUTCDate(),
  );
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getCycleWindow(
  referenceDate: Date | string,
  cycleDate: number,
): CycleWindow {
  const normalizedCycleDate = clampCycleDate(cycleDate);
  const reference = parseInputDate(referenceDate);

  const cycleStart =
    reference.getUTCDate() >= normalizedCycleDate
      ? createUtcDate(
          reference.getUTCFullYear(),
          reference.getUTCMonth(),
          normalizedCycleDate,
        )
      : createUtcDate(
          reference.getUTCFullYear(),
          reference.getUTCMonth() - 1,
          normalizedCycleDate,
        );

  const cycleEndExclusive = shiftUtcMonth(cycleStart, 1);
  const cycleEnd = createUtcDate(
    cycleEndExclusive.getUTCFullYear(),
    cycleEndExclusive.getUTCMonth(),
    cycleEndExclusive.getUTCDate() - 1,
  );

  return {
    start: toDateString(cycleStart),
    end: toDateString(cycleEnd),
    endExclusive: toDateString(cycleEndExclusive),
    key: toDateString(cycleStart),
  };
}

export function getPreviousCycleWindow(
  referenceDate: Date | string,
  cycleDate: number,
): CycleWindow {
  const current = getCycleWindow(referenceDate, cycleDate);
  const previousReference = createUtcDate(
    parseInputDate(current.start).getUTCFullYear(),
    parseInputDate(current.start).getUTCMonth(),
    parseInputDate(current.start).getUTCDate() - 1,
  );

  return getCycleWindow(previousReference, cycleDate);
}

export function getNextCycleWindow(
  referenceDate: Date | string,
  cycleDate: number,
): CycleWindow {
  const current = getCycleWindow(referenceDate, cycleDate);
  return getCycleWindow(current.endExclusive, cycleDate);
}
