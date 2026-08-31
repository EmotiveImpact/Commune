import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { AuthLayout } from "./AuthLayout";
import { GoogleMark } from "../ui/Icon";
import { useApp } from "../state";
import { keepSearch } from "../nav";

export function LoginPage() {
  const { signIn } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function enter() {
    signIn({
      name: "Maya Chen",
      email: email.trim() || "maya@14park.st",
      seed: "maya",
      hasHubs: true,
      emptyLedger: false,
    });
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!email.includes("@")) {
      setError("Valid email required");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    enter();
  }

  return (
    <AuthLayout>
      <div className="commune-auth-panel">
        <h2>Welcome Back</h2>
        <p className="commune-auth-lede">Enter your email and password to access your account.</p>
        {error ? <div className="commune-auth-alert">{error}</div> : null}
        <form onSubmit={onSubmit}>
          <div className="commune-auth-field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="user@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="commune-auth-field">
            <label htmlFor="login-pass">Password</label>
            <input
              id="login-pass"
              type="password"
              autoComplete="current-password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="commune-auth-row">
            <Link href={keepSearch("/forgot-password")} className="commune-auth-link">
              Forgot Your Password?
            </Link>
          </div>
          <button className="commune-auth-btn" type="submit" disabled={loading}>
            Log In
          </button>
        </form>
        <div className="commune-auth-or">Or login with</div>
        <button className="commune-auth-btn commune-auth-btn-google" type="button" onClick={enter}>
          <GoogleMark />
          Continue with Google
        </button>
        <p className="commune-auth-foot">
          Don&apos;t Have An Account?{" "}
          <Link href={keepSearch("/signup")} className="commune-auth-link">
            Register Now.
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
