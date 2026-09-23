import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { AuthLayout } from "./AuthLayout";
import { useApp } from "../state";
import { keepSearch } from "../nav";

export function SignupPage() {
  const { signUpWithPassword } = useApp();
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!name.trim() || !email.includes("@") || password.length < 12) {
      setError("Enter your name, a valid email and a password of at least 12 characters.");
      return;
    }
    setBusy(true);
    try {
      await signUpWithPassword(name.trim(), email.trim(), password);
      const returnTo = sessionStorage.getItem("commune.return-to");
      sessionStorage.removeItem("commune.return-to");
      setLocation(returnTo || keepSearch("/onboard"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create your account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <div className="commune-auth-panel">
        <h2>Create your account</h2>
        <p className="commune-auth-lede">Your expenses and membership will be shared securely with the people you invite.</p>
        {error ? <div className="commune-auth-alert" role="alert">{error}</div> : null}
        <form onSubmit={onSubmit}>
          <div className="commune-auth-field">
            <label htmlFor="su-name">Name</label>
            <input id="su-name" autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="commune-auth-field">
            <label htmlFor="su-email">Email</label>
            <input id="su-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="commune-auth-field">
            <label htmlFor="su-password">Password</label>
            <input id="su-password" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          <button className="commune-auth-btn" type="submit" disabled={busy}>
            {busy ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p className="commune-auth-foot">
          Already have an account?{" "}
          <Link href={keepSearch("/login")} className="commune-auth-link">Sign in</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
