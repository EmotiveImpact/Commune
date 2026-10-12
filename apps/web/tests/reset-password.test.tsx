import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiError, api } from "../src/live/api";
import { ResetPasswordPage } from "../src/auth/ForgotPassword";

vi.mock("../src/live/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/live/api")>()),
  api: vi.fn(),
}));

const original = window.location.href;
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", original);
});

function visit(url: string) {
  window.history.replaceState(null, "", url);
  render(<ResetPasswordPage />);
}
function submit(password: string) {
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
}
const resets = () => vi.mocked(api).mock.calls.filter(([path]) => path === "/auth/reset-password")
  .map(([, init]) => JSON.parse(String(init?.body)) as unknown);
const UNCONFIRMED = "We couldn’t confirm the reset. Check your connection, then try again. If the link then says it was already used, your new password is set and you can sign in with it.";

describe("Reset password page", () => {
  it("takes the token out of the address bar at once and still resets with it", async () => {
    vi.mocked(api).mockResolvedValue({ ok: true });
    visit("/reset-password?token=reset-token-1&native=1");
    await waitFor(() => expect(window.location.search).toBe("?native=1"));
    expect(window.location.pathname).toBe("/reset-password");
    submit("A-new-password-22");
    await screen.findByText("Your password was changed. You can sign in now.");
    expect(resets()).toEqual([{ token: "reset-token-1", password: "A-new-password-22" }]);
    expect(sessionStorage.getItem("commune.reset-token")).toBeNull();
  });

  it("keeps the token for another try and for a reload until the reset works", async () => {
    vi.mocked(api).mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new ApiError("Password does not meet security requirements", 400))
      .mockResolvedValue({ ok: true });
    visit("/reset-password?token=reset-token-2");
    await waitFor(() => expect(window.location.search).toBe(""));
    submit("A-new-password-22");
    expect((await screen.findByRole("alert")).textContent).toBe(UNCONFIRMED);
    submit("A-new-password-22");
    await screen.findByText("Password does not meet security requirements");
    // Reload: the address bar no longer has the token, and this tab still does.
    cleanup();
    visit(window.location.pathname);
    submit("A-new-password-22");
    await screen.findByText("Your password was changed. You can sign in now.");
    expect(resets()).toEqual(Array(3).fill({ token: "reset-token-2", password: "A-new-password-22" }));
    expect(sessionStorage.getItem("commune.reset-token")).toBeNull();
  });

  it("says when a link was used or has expired, or has no token", () => {
    sessionStorage.setItem("commune.reset-token", "older-token");
    visit("/reset-password?error=INVALID_TOKEN");
    expect(screen.getByText("This reset link has expired or was already used. Request a new one.")).toBeTruthy();
    expect(screen.queryByLabelText("New password")).toBeNull();
    expect(sessionStorage.getItem("commune.reset-token")).toBeNull();
    cleanup();
    visit("/reset-password");
    expect(screen.getByText("This reset link is missing a token. Request a new one.")).toBeTruthy();
  });
});
