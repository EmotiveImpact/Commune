import {
  allocateExpense,
  type SplitMethod,
} from "@commune/core";
import type { LiveHub } from "../live/model";
import { Avatar } from "./widgets";
import { LIMITS } from "../data/limits";
import { money } from "../live/model";

export function SplitEditor({
  members,
  includedIds,
  onIncludedIds,
  method,
  onMethod,
  values,
  onValues,
  amountMinor,
  currency,
  disabled = false,
}: {
  members: LiveHub["members"];
  includedIds: string[];
  onIncludedIds: (ids: string[]) => void;
  method: SplitMethod;
  onMethod: (method: SplitMethod) => void;
  values: Record<string, string>;
  onValues: (values: Record<string, string>) => void;
  amountMinor?: number | null;
  currency: LiveHub["currency"];
  disabled?: boolean;
}) {
  let allocations: ReturnType<typeof allocateExpense> = [];
  let error = "";
  if (amountMinor) {
    try {
      allocations = allocateExpense(amountMinor, includedIds, method, values, currency);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Check the split.";
    }
  }
  return (
    <fieldset className="c-split-editor" disabled={disabled}>
      <legend>How should we split it?</legend>
      <div className="c-split-methods" role="group" aria-label="Split method">
        {(["Equal", "Exact", "Percentage", "Shares"] as const).map((choice) => (
          <button
            key={choice}
            type="button"
            aria-pressed={method === choice}
            onClick={() => {
              onMethod(choice);
              if (choice === "Shares")
                onValues(
                  Object.fromEntries(
                    includedIds.map((id) => [id, values[id] || "1"]),
                  ),
                );
            }}
          >
            {choice}
          </button>
        ))}
      </div>
      {members.map((member) => {
        const allocation = allocations.find(
          (item) => item.userId === member.userId,
        );
        return (
          <div className="c-split-person a-settle-row" key={member.userId}>
            <input
              type="checkbox"
              aria-label={`Include ${member.name}`}
              checked={includedIds.includes(member.userId)}
              onChange={(event) =>
                onIncludedIds(
                  event.target.checked
                    ? [...includedIds, member.userId]
                    : includedIds.filter((id) => id !== member.userId),
                )
              }
            />
            <Avatar tone={member.cls} initials={member.ini} />
            <span className="c-split-name">{member.name}</span>
            <span className="c-split-value-slot">
              {method !== "Equal" && includedIds.includes(member.userId) && (
                <input
                  className="c-split-value"
                  aria-label={`${member.name} ${method.toLowerCase()}`}
                  inputMode="decimal"
                  value={values[member.userId] ?? ""}
                  maxLength={LIMITS.money}
                  placeholder={
                    method === "Percentage"
                      ? "%"
                      : method === "Shares"
                        ? "1"
                        : "0.00"
                  }
                  onChange={(event) =>
                    onValues({ ...values, [member.userId]: event.target.value })
                  }
                />
              )}
            </span>
            {/* Reserve the total's width without displaying an unallocated amount. */}
            <span
              className="amt c-split-amount"
              data-space={money(amountMinor || 0, currency)}
            >
              <span>
                {allocation ? money(allocation.amountMinor, currency) : null}
              </span>
            </span>
          </div>
        );
      })}
      <p className="c-split-hint">
        {error ||
          (method === "Percentage"
            ? "Percentages must total 100%."
            : method === "Shares"
              ? "Use whole-number weights, e.g. 2 shares and 1 share."
              : method === "Exact"
                ? "Enter each person’s amount. The total must match the expense."
                : "Split evenly, with every penny accounted for.")}
      </p>
    </fieldset>
  );
}
