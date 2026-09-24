import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { AuthLayout } from "./AuthLayout";
import { useApp } from "../state";
import { LIMITS } from "../data/limits";
import { keepSearch } from "../nav";
import { GoogleMark } from "../ui/Icon";

export function LoginPage() {
  const { signInWithPassword, signInWithGoogle } = useApp();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!email.includes("@") || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      await signInWithPassword(email.trim(), password);
      const returnTo = sessionStorage.getItem("commune.return-to");
      sessionStorage.removeItem("commune.return-to");
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
        {error || new URLSearchParams(window.location.search).has("oauth")
          ? <div className="commune-auth-alert" role="alert">{error || "Google sign-in did not complete. Please try again."}</div>
          : null}
        <form onSubmit={onSubmit}>
          <div className="commune-auth-field">
            <label htmlFor="login-email">Email</label>
            <input id="login-email" type="email" autoComplete="email" required maxLength={LIMITS.email} value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="commune-auth-field">
            <label htmlFor="login-password">Password</label>
            <input id="login-password" type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          <p className="commune-auth-foot"><Link href={keepSearch("/forgot-password")} className="commune-auth-link">Forgot your password?</Link></p>
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
