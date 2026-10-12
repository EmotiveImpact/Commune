import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConnectionRecovery } from "../src/shell/ConnectionRecovery";
import { isConnectionFailure } from "../src/live/connection";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe("connection recovery", () => {
  it("distinguishes transport failures from application errors", () => {
    expect(isConnectionFailure(new TypeError("Failed to fetch"))).toBe(true);
    expect(isConnectionFailure({ status: 503 })).toBe(true);
    expect(isConnectionFailure({ status: 403 })).toBe(false);
    expect(isConnectionFailure(new Error("Amount must be positive"))).toBe(false);
    expect(isConnectionFailure(new TypeError("Cannot read property"))).toBe(false);
  });
  it("explains offline state and reconnects once when the connection returns", async () => {
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const retry = vi.fn().mockResolvedValue(undefined);
    render(<ConnectionRecovery retry={retry} signOut={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "You’re offline" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Try again" }) as HTMLButtonElement).disabled).toBe(true);
    online.mockReturnValue(true);
    fireEvent(window, new Event("online"));
    await waitFor(() => expect(retry).toHaveBeenCalledTimes(1));
    await screen.findByText("Still unable to connect. Please try again shortly.");
  });
  it("lets someone sign out even while offline", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const signOut = vi.fn().mockResolvedValue(undefined);
    render(<ConnectionRecovery retry={vi.fn()} signOut={signOut} />);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
