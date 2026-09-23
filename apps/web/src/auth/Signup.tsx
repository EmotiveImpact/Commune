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
    enter(name.trim(), email.trim());
  }

  return (
    <AuthLayout>
      <div className="commune-auth-panel">
        <h2>Explore onboarding</h2>
        <p className="commune-auth-lede">
          This preview does not create an account or send invites. Your name and
          email stay in this browser session while you try the onboarding flow.
        </p>
        {error ? <div className="commune-auth-alert">{error}</div> : null}
        <button
          className="commune-auth-btn commune-auth-btn-google"
          type="button"
          disabled
          title="Google sign-in is not connected in this preview"
        >
          <GoogleMark />
          Google sign-in unavailable
        </button>
        <div className="commune-auth-or">Try the onboarding screens</div>
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
          <button className="commune-auth-btn" type="submit">
            Explore onboarding
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
