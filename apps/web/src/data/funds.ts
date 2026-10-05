import type { Fund } from "../live/model";

/** The four numbers that explain a fund, all derived from its pledges. */
export type FundFigures = {
  /** Sum of active (not cancelled) pledges. */
  promisedMinor: number;
  /** Contributions recorded as received, net of corrections. */
  receivedMinor: number;
  /** Promised but not yet received, across active pledges. */
  stillToComeMinor: number;
  /** Part of the target nobody has pledged yet; null without a target. */
  unpledgedMinor: number | null;
  /** Part of the target not yet received; null without a target. */
  toTargetMinor: number | null;
};

export function fundFigures(fund: Pick<Fund, "targetMinor" | "contributedMinor" | "commitments">): FundFigures {
  const active = fund.commitments.filter((pledge) => !pledge.cancelledAt);
  const promisedMinor = active.reduce((sum, pledge) => sum + pledge.amountMinor, 0);
  const stillToComeMinor = active.reduce((sum, pledge) => sum + Math.max(0, pledge.amountMinor - pledge.contributedMinor), 0);
  const target = fund.targetMinor ?? null;
  return {
    promisedMinor,
    receivedMinor: fund.contributedMinor,
    stillToComeMinor,
    unpledgedMinor: target === null ? null : Math.max(0, target - promisedMinor),
    toTargetMinor: target === null ? null : Math.max(0, target - fund.contributedMinor),
  };
}
