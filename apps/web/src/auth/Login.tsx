import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { AuthLayout } from "./AuthLayout";
import { GoogleMark } from "../ui/Icon";
import { useApp } from "../state";
import { keepSearch } from "../nav";

export function LoginPage() {
  const { signIn } = useApp();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

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
    enter();
  }

  return (
    <AuthLayout>
      <div className="commune-auth-panel">
        <h2>Welcome Back</h2>
        <p className="commune-auth-lede">
          Explore the design preview. This does not sign you in or create a
          shared account; sample data stays in this browser session.
        </p>
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
          <button className="commune-auth-btn" type="submit">
            Explore preview
          </button>
        </form>
        <div className="commune-auth-or">Account sign-in is being connected</div>
        <button className="commune-auth-btn commune-auth-btn-google" type="button" disabled title="Google sign-in is not connected in this preview">
          <GoogleMark />
          Google sign-in unavailable
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
