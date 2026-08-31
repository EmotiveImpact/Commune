import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { AuthLayout } from "./AuthLayout";
import { GoogleMark } from "../ui/Icon";
import { useApp } from "../state";
import { keepSearch } from "../nav";

export function SignupPage() {
  const { signIn, go } = useApp();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  function enter(nextName: string, nextEmail: string) {
    signIn({
      name: nextName || "Maya Chen",
      email: nextEmail || "maya@14park.st",
      seed: "new",
      hasHubs: false,
      emptyLedger: true,
    });
    go("onboard");
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!email.includes("@")) {
      setError("Valid email required");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    enter(name.trim(), email.trim());
  }

  return (
    <AuthLayout>
      <div className="commune-auth-panel">
        <h2>Create your account</h2>
        <p className="commune-auth-lede">
          Join Commune to run shared money clearly with the people around you.
        </p>
        {error ? <div className="commune-auth-alert">{error}</div> : null}
        <button
          className="commune-auth-btn commune-auth-btn-google"
          type="button"
          onClick={() => enter("Maya Chen", "maya@14park.st")}
        >
          <GoogleMark />
          Continue with Google
        </button>
        <div className="commune-auth-or">Or sign up with email</div>
        <form onSubmit={onSubmit}>
          <div className="commune-auth-field">
            <label htmlFor="su-name">Name</label>
            <input id="su-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>
          <div className="commune-auth-field">
            <label htmlFor="su-email">Email</label>
            <input
              id="su-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="commune-auth-field">
            <label htmlFor="su-pass">Password</label>
            <input
              id="su-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
          <div className="commune-auth-field">
            <label htmlFor="su-confirm">Confirm password</label>
            <input
              id="su-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat your password"
            />
          </div>
          <button className="commune-auth-btn" type="submit">
            Create account
          </button>
        </form>
        <p className="commune-auth-foot">
          Already have an account?{" "}
          <Link href={keepSearch("/login")} className="commune-auth-link">
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
