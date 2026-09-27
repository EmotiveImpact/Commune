import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { PendingShell } from "../src/shell/PendingShell";

afterEach(cleanup);

it("keeps the public layout without a loading splash or unverified account actions", () => {
  const { container } = render(<PendingShell />);
  expect(screen.queryByText(/Opening Commune/)).toBeNull();
  expect(screen.queryByText(/No communes|Create a commune/)).toBeNull();
  expect(container.querySelector(".a-side")).not.toBeNull();
  expect(container.querySelector(".a-main")).not.toBeNull();
  expect(container.querySelectorAll("button, a, input").length).toBe(0);
  expect(screen.getByLabelText("Loading account").getAttribute("aria-busy")).toBe("true");
});
