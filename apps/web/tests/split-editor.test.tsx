import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { SplitMethod } from "@commune/core";
import type { LiveHub } from "../src/live/model";
import { SplitEditor } from "../src/ui/SplitEditor";

vi.mock("../src/ui/widgets", () => ({
  Avatar: ({ initials }: { initials: string }) => <span>{initials}</span>,
}));

const members: LiveHub["members"] = [
  { userId: "first", name: "Alex", ini: "AL", cls: "alex", meta: "Admin", bal: "Even" },
  { userId: "second", name: "Jordan with a longer household member name", ini: "JO", cls: "jordan", meta: "Member", bal: "Even" },
];

function Harness({ disabled = false }: { disabled?: boolean }) {
  const [included, setIncluded] = useState(["first", "second"]);
  const [method, setMethod] = useState<SplitMethod>("Equal");
  const [values, setValues] = useState<Record<string, string>>({ first: "12.01", second: "12.00" });
  return (
    <SplitEditor
      members={members}
      includedIds={included}
      onIncludedIds={setIncluded}
      method={method}
      onMethod={setMethod}
      values={values}
      onValues={setValues}
      amountMinor={2401}
      currency="GBP"
      disabled={disabled}
    />
  );
}

afterEach(cleanup);

describe("stable split editor", () => {
  it.each(["Equal", "Exact", "Percentage", "Shares"] as const)(
    "keeps the same member/control slots and real allocations for %s",
    (method) => {
      const { container } = render(<Harness />);
      const slots = Array.from(container.querySelectorAll(".c-split-value-slot"));
      const results = Array.from(container.querySelectorAll(".c-split-amount"));
      fireEvent.click(screen.getByRole("button", { name: method, exact: true }));
      if (method === "Percentage" || method === "Shares") {
        const value = method === "Percentage" ? "50" : "1";
        for (const member of members)
          fireEvent.change(screen.getByLabelText(`${member.name} ${method.toLowerCase()}`), { target: { value } });
      }
      expect(Array.from(container.querySelectorAll(".c-split-value-slot"))).toEqual(slots);
      expect(Array.from(container.querySelectorAll(".c-split-amount"))).toEqual(results);
      expect(results.map((result) => result.textContent)).toEqual(["£12.01", "£12.00"]);
      expect(results.map((result) => result.getAttribute("data-space"))).toEqual(["£24.01", "£24.01"]);
      expect(screen.queryAllByRole("textbox")).toHaveLength(method === "Equal" ? 0 : 2);
    },
  );

  it("retains result space during validation without showing a guessed allocation", () => {
    const { container } = render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Percentage", exact: true }));
    expect(screen.getByText("Percentages must add up to 100%.")).toBeTruthy();
    const results = Array.from(container.querySelectorAll(".c-split-amount"));
    expect(results).toHaveLength(2);
    expect(results.every((result) => result.textContent === "")).toBe(true);
    expect(results.every((result) => result.getAttribute("data-space") === "£24.01")).toBe(true);
  });

  it("keeps an excluded person's slot but no invisible, focusable input", () => {
    const { container } = render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Exact", exact: true }));
    fireEvent.click(screen.getByRole("checkbox", { name: `Include ${members[1].name}` }));
    expect(container.querySelectorAll(".c-split-value-slot")).toHaveLength(2);
    expect(screen.queryByLabelText(`${members[1].name} exact`)).toBeNull();
    expect(screen.queryAllByRole("textbox")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Equal", exact: true }));
    expect(Array.from(container.querySelectorAll(".c-split-amount")).map((result) => result.textContent)).toEqual(["£24.01", ""]);
  });

  it("continues to disable all split controls while saving", () => {
    render(<Harness disabled />);
    expect(screen.getByRole("group", { name: "How should we split it?" }).matches(":disabled")).toBe(true);
    expect(screen.getAllByRole("button").every((button) => button.matches(":disabled"))).toBe(true);
    expect(screen.getAllByRole("checkbox").every((checkbox) => checkbox.matches(":disabled"))).toBe(true);
  });
});
