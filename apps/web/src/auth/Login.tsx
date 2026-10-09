import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { AuthLayout } from "./AuthLayout";
import { useApp } from "../state";
import { LIMITS } from "../data/limits";
import { keepSearch } from "../nav";
import { GoogleMark } from "../ui/Icon";
import { readStored, removeStored } from "../live/storage";
import { useFormError } from "../ui/components";

export function LoginPage() {
  const { signInWithPassword, signInWithGoogle, signOutUnconfirmed, retrySignOut, sessionNotice } = useApp();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { error, setError, invalid, messageProps } = useFormError();
  const [signOutRetry, setSignOutRetry] = useState<"idle" | "busy" | "failed">("idle");

  async function onRetrySignOut() {
    setSignOutRetry("busy");
    setSignOutRetry(await retrySignOut() ? "idle" : "failed");
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!email.includes("@") || !password) {
      setError("Enter your email and password.", email.includes("@") ? "login-password" : "login-email");
      return;
    }
    setBusy(true);
    try {
      await signInWithPassword(email.trim(), password);
      const returnTo = readStored("commune.return-to");
      removeStored("commune.return-to");
      setLocation(returnTo || keepSearch("/"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogleSignIn() {
    setError("");
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign in with Google.");
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <div className="commune-auth-panel">
        <h2>Welcome back</h2>
        <p className="commune-auth-lede">Sign in to your shared Commune account.</p>
        {signOutUnconfirmed ? (
          <div className="commune-auth-alert" role="alert">
            {signOutRetry === "failed"
              ? "Sign-out still isn’t confirmed. Check your connection, then try again."
              : "Commune couldn’t confirm your sign-out, so this device may still be signed in."}{" "}
            <button className="commune-auth-link" type="button" disabled={signOutRetry === "busy"} onClick={() => void onRetrySignOut()}>
              {signOutRetry === "busy" ? "Signing out…" : "Try again"}
            </button>
          </div>
        ) : sessionNotice && !error ? <div className="commune-auth-alert" role="status">{sessionNotice}</div> : null}
        {error || new URLSearchParams(window.location.search).has("oauth")
          ? <div className="commune-auth-alert" role="alert" {...messageProps}>{error || "Google sign-in did not complete. Please try again."}</div>
          : null}
        <form onSubmit={onSubmit}>
          <div className="commune-auth-field">
            <label htmlFor="login-email">Email</label>
            <input id="login-email" type="email" autoComplete="email" required maxLength={LIMITS.email} value={email} onChange={(event) => setEmail(event.target.value)} {...invalid("login-email")} />
          </div>
          <div className="commune-auth-field">
            <label htmlFor="login-password">Password</label>
            <input id="login-password" type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} {...invalid("login-password")} />
          </div>
          <p className="commune-auth-foot commune-auth-solo"><Link href={keepSearch("/forgot-password")} className="commune-auth-link">Forgot your password?</Link></p>
          <button className="commune-auth-btn" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        {import.meta.env.VITE_GOOGLE_OAUTH_ENABLED === "true" ? <>
          <div className="commune-auth-or">or</div>
          <button className="commune-auth-btn commune-auth-btn-google" type="button" disabled={busy} onClick={() => void onGoogleSignIn()}>
            <GoogleMark /> Continue with Google
          </button>
        </> : null}
        <p className="commune-auth-foot">
          New to Commune?{" "}
          <Link href={keepSearch("/signup")} className="commune-auth-link">Create an account</Link>
        </p>
        {import.meta.env.PROD ? <p className="commune-auth-foot">
          Have a verification code?{" "}
          <Link href={keepSearch("/verify-email")} className="commune-auth-link">Verify your email</Link>
        </p> : null}
      </div>
    </AuthLayout>
  );
}
