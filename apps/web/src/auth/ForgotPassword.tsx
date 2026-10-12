import { useEffect, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { AuthLayout } from "./AuthLayout";
import { keepSearch } from "../nav";
import { api, post } from "../live/api";
import { readStored, removeStored, writeStored } from "../live/storage";
import { commandFailure } from "../data/commands";
import { LIMITS } from "../data/limits";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post("/auth/request-password-reset", { email: email.trim() });
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not request a reset link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <div className="commune-auth-panel">
        <h2>Reset your password</h2>
        {import.meta.env.PROD ? <>
          <p className="commune-auth-lede">{sent
            ? "If an account exists for that address, a reset link is on its way. Check your inbox."
            : "Enter your account email and we’ll send a password reset link."}</p>
          {error ? <div className="commune-auth-alert" role="alert">{error}</div> : null}
          {!sent ? <form onSubmit={onSubmit}>
            <div className="commune-auth-field">
              <label htmlFor="reset-email">Email</label>
              <input id="reset-email" type="email" autoComplete="email" required maxLength={LIMITS.email}
                value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <button className="commune-auth-btn" type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </form> : null}
        </> : <p className="commune-auth-lede">
          Password reset email is not configured in this local build. No message
          will be sent. Keep your test password safe while we connect verified
          email delivery before public deployment.
        </p>}
        <Link href={keepSearch("/login")} className="commune-auth-btn">
          Back to sign in
        </Link>
      </div>
    </AuthLayout>
  );
}

// The reset link's token leaves the address bar as soon as it is read, so it
// isn't kept in this tab's history or passed on with a copied address. The tab
// keeps it until the reset works, for a reload or another try.
const RESET_TOKEN = "commune.reset-token";
function readResetLink(): { token: string; expired: boolean } {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  if (token) return { token, expired: false };
  // The auth server sends a used or expired link back with an error instead.
  if (params.has("error")) return { token: "", expired: true };
  return { token: readStored(RESET_TOKEN) ?? "", expired: false };
}

export function ResetPasswordPage() {
  const [{ token, expired }] = useState(readResetLink);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (token) writeStored(RESET_TOKEN, token);
    else removeStored(RESET_TOKEN);
    const url = new URL(window.location.href);
    if (!url.searchParams.has("token")) return;
    url.searchParams.delete("token");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [token]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) });
      removeStored(RESET_TOKEN);
      setDone(true);
    } catch (cause) {
      // A lost reply can hide a reset that worked, and the link is then used up.
      const failure = commandFailure(cause, "Could not reset your password.");
      setError(failure.rejected ? failure.message
        : "We couldn’t confirm the reset. Check your connection, then try again. If the link then says it was already used, your new password is set and you can sign in with it.");
    } finally {
      setBusy(false);
    }
  }

  return <AuthLayout><div className="commune-auth-panel">
    <h2>Choose a new password</h2>
    {done ? <p className="commune-auth-lede">Your password was changed. You can sign in now.</p>
      : token ? <>
        <p className="commune-auth-lede">Use at least 12 characters for your new password.</p>
        {error ? <div className="commune-auth-alert" role="alert">{error}</div> : null}
        <form onSubmit={onSubmit}>
          <div className="commune-auth-field">
            <label htmlFor="reset-password">New password</label>
            <input id="reset-password" type="password" autoComplete="new-password" required minLength={12} maxLength={128}
              value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          <button className="commune-auth-btn" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Reset password"}
          </button>
        </form>
      </> : <p className="commune-auth-lede">{expired
        ? "This reset link has expired or was already used. Request a new one."
        : "This reset link is missing a token. Request a new one."}</p>}
    <Link href={keepSearch("/login")} className="commune-auth-btn">Back to sign in</Link>
  </div></AuthLayout>;
}
