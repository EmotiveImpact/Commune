import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { AuthLayout } from "./AuthLayout";
import { keepSearch } from "../nav";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!email.includes("@")) {
      setError("Valid email required");
      return;
    }
    setSubmitted(true);
  }

  return (
    <AuthLayout>
      <div className="commune-auth-panel">
        <h2>Reset your password</h2>
        <p className="commune-auth-lede">
          Enter your email and we&apos;ll send you a link to reset your password.
        </p>
        {submitted ? (
          <>
            <p className="commune-auth-ok">Check your email for a reset link</p>
            <p className="commune-auth-lede">
              If an account exists for that email, you&apos;ll receive a password reset link shortly.
            </p>
            <Link href={keepSearch("/login")} className="commune-auth-btn">
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            {error ? <div className="commune-auth-alert">{error}</div> : null}
            <form onSubmit={onSubmit}>
              <div className="commune-auth-field">
                <label htmlFor="fp-email">Email</label>
                <input
                  id="fp-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <button className="commune-auth-btn" type="submit">
                Send reset link
              </button>
            </form>
            <p className="commune-auth-foot">
              Remember your password?{" "}
              <Link href={keepSearch("/login")} className="commune-auth-link">
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
