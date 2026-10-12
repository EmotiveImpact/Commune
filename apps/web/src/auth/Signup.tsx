import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { AuthLayout } from "./AuthLayout";
import { useApp } from "../state";
import { LIMITS } from "../data/limits";
import { keepSearch } from "../nav";
import { GoogleMark } from "../ui/Icon";
import { useFormError } from "../ui/components";

export function SignupPage() {
  const { signUpWithPassword, verifyEmailCode, signInWithPassword, signInWithGoogle } = useApp();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { error, setError, invalid, messageProps } = useFormError();
  const [verificationPending, setVerificationPending] = useState(false);
  const [code, setCode] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    // The first field to fix is named, marked and focused.
    if (!name.trim()) {
      setError("Enter your name.", "su-name");
      return;
    }
    if (!email.includes("@")) {
      setError("Enter a valid email address.", "su-email");
      return;
    }
    if (password.length < 12) {
      setError("Use at least 12 characters for your password.", "su-password");
      return;
    }
    setBusy(true);
    try {
      // Signed in, the page moves on by itself (see GuestOnly in App.tsx).
      const status = await signUpWithPassword(name.trim(), email.trim(), password);
      if (status === "verify") setVerificationPending(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create your account.");
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await verifyEmailCode(email.trim(), code.trim());
      await signInWithPassword(email.trim(), password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not verify your email.");
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
      setError(cause instanceof Error ? cause.message : "Could not sign up with Google.");
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <div className="commune-auth-panel">
        <h2>{verificationPending ? "Verify your email" : "Create your account"}</h2>
        <p className="commune-auth-lede">{verificationPending
          ? `Enter the code sent to ${email}. If your message has a verification link, open it and then sign in.`
          : "Your expenses and membership will be shared securely with the people you invite."}</p>
        {error ? <div className="commune-auth-alert" role="alert" {...messageProps}>{error}</div> : null}
        {verificationPending ? <form onSubmit={onVerify}>
          <div className="commune-auth-field">
            <label htmlFor="su-code">Verification code</label>
            <input id="su-code" type="text" inputMode="numeric" autoComplete="one-time-code" required maxLength={12}
              value={code} onChange={(event) => setCode(event.target.value)} />
          </div>
          <button className="commune-auth-btn" type="submit" disabled={busy}>
            {busy ? "Verifying…" : "Verify and continue"}
          </button>
        </form> : <form onSubmit={onSubmit}>
          <div className="commune-auth-field">
            <label htmlFor="su-name">Name</label>
            <input id="su-name" autoComplete="name" required maxLength={LIMITS.userName} value={name} onChange={(event) => setName(event.target.value)} {...invalid("su-name")} />
          </div>
          <div className="commune-auth-field">
            <label htmlFor="su-email">Email</label>
            <input id="su-email" type="email" autoComplete="email" required maxLength={LIMITS.email} value={email} onChange={(event) => setEmail(event.target.value)} {...invalid("su-email")} />
          </div>
          <div className="commune-auth-field">
            <label htmlFor="su-password">Password</label>
            <input id="su-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} {...invalid("su-password", "su-password-hint")} />
            <p className="commune-auth-hint" id="su-password-hint">At least 12 characters.</p>
          </div>
          <button className="commune-auth-btn" type="submit" disabled={busy}>
            {busy ? "Creating account…" : "Create account"}
          </button>
          <p className="commune-auth-legal">
            Read how Commune uses your information in our <Link href="/privacy" className="commune-auth-link">privacy notice</Link>.
          </p>
        </form>}
        {!verificationPending && import.meta.env.VITE_GOOGLE_OAUTH_ENABLED === "true" ? <>
          <div className="commune-auth-or">or</div>
          <button className="commune-auth-btn commune-auth-btn-google" type="button" disabled={busy} onClick={() => void onGoogleSignIn()}>
            <GoogleMark /> Continue with Google
          </button>
        </> : null}
        <p className="commune-auth-foot">
          Already have an account?{" "}
          <Link href={keepSearch("/login")} className="commune-auth-link">Sign in</Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export function VerifyEmailPage() {
  const { verifyEmailCode } = useApp();
  const [email, setEmail] = useState(new URLSearchParams(window.location.search).get("email") ?? "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const { error, setError, messageProps } = useFormError();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await verifyEmailCode(email.trim(), code.trim());
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not verify your email.");
    } finally {
      setBusy(false);
    }
  }

  return <AuthLayout><div className="commune-auth-panel">
    <h2>Verify your email</h2>
    <p className="commune-auth-lede">{done ? "Your email is verified. Sign in to continue." :
      "Enter the code from your verification email. If you received a link instead, open that link."}</p>
    {error ? <div className="commune-auth-alert" role="alert" {...messageProps}>{error}</div> : null}
    {!done ? <form onSubmit={onSubmit}>
      <div className="commune-auth-field">
        <label htmlFor="verify-email">Email</label>
        <input id="verify-email" type="email" autoComplete="email" required maxLength={LIMITS.email}
          value={email} onChange={(event) => setEmail(event.target.value)} />
      </div>
      <div className="commune-auth-field">
        <label htmlFor="verify-code">Verification code</label>
        <input id="verify-code" type="text" inputMode="numeric" autoComplete="one-time-code" required maxLength={12}
          value={code} onChange={(event) => setCode(event.target.value)} />
      </div>
      <button className="commune-auth-btn" type="submit" disabled={busy}>
        {busy ? "Verifying…" : "Verify email"}
      </button>
    </form> : null}
    <p className="commune-auth-foot commune-auth-solo"><Link href={keepSearch("/login")} className="commune-auth-link">Back to sign in</Link></p>
  </div></AuthLayout>;
}
