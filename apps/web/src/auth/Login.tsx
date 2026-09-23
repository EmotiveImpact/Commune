import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { AuthLayout } from "./AuthLayout";
import { useApp } from "../state";
import { keepSearch } from "../nav";

export function LoginPage() {
  const { signInWithPassword } = useApp();
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

  return (
    <AuthLayout>
      <div className="commune-auth-panel">
        <h2>Welcome back</h2>
        <p className="commune-auth-lede">Sign in to your shared Commune account.</p>
        {error ? <div className="commune-auth-alert" role="alert">{error}</div> : null}
        <form onSubmit={onSubmit}>
          <div className="commune-auth-field">
            <label htmlFor="login-email">Email</label>
            <input id="login-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="commune-auth-field">
            <label htmlFor="login-password">Password</label>
            <input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          <button className="commune-auth-btn" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="commune-auth-foot">
          New to Commune?{" "}
          <Link href={keepSearch("/signup")} className="commune-auth-link">Create an account</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
