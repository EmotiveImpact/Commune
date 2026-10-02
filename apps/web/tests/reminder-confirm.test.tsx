import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReminderConfirm } from "../src/ui/ReminderConfirm";

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); } });
});
afterEach(cleanup);
const base = { name: "Alex", subject: "House supplies", amount: "£12.00", remaining: 58, pending: false, error: "" };

it("previews a reminder without sending until confirmed", () => {
  const onSend = vi.fn();
  render(<ReminderConfirm {...base} onSend={onSend} onClose={vi.fn()} />);
  expect(onSend).not.toHaveBeenCalled();
  expect(screen.getByText(/£12.00 outstanding for House supplies/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Send reminder" }));
  expect(onSend).toHaveBeenCalledTimes(1);
});

it("blocks duplicate sends and dismissal while pending", () => {
  const onSend = vi.fn(); const onClose = vi.fn();
  const { container } = render(<ReminderConfirm {...base} pending onSend={onSend} onClose={onClose} />);
  expect((screen.getByRole("button", { name: "Sending…" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent(container.querySelector("dialog")!, new Event("cancel", { cancelable: true }));
  expect(onClose).not.toHaveBeenCalled();
  expect(onSend).not.toHaveBeenCalled();
});

it("keeps the quota and errors visible and allows cancellation", () => {
  const onClose = vi.fn();
  render(<ReminderConfirm {...base} remaining={0} error="Allowance reached" onSend={vi.fn()} onClose={onClose} />);
  expect((screen.getByRole("button", { name: "Send reminder" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole("alert").textContent).toBe("Allowance reached");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(onClose).toHaveBeenCalledOnce();
});
