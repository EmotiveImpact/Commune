import { useState, type FormEvent } from "react";
import { useApp } from "../state";
import { commandFailure } from "../data/commands";
import { Icon } from "./Icon";
import { Button, Dialog, Feedback, Field } from "./components";

// Both actions end the account's other sessions at once, but a device that
// already holds an access token can keep using it until it expires: the Data
// API and the email worker check only its signature and expiry, and Neon Auth
// issues tokens for 15 minutes. The local API checks the session on every
// request, so there another device stops straight away.
const STILL_OPEN = "A device that already has Commune open can keep working for up to 15 minutes.";

function failureText(cause: unknown, unknownOutcome: string): string {
  if ((cause as { status?: unknown } | null)?.status === 429) {
    return "Too many attempts. Nothing was changed. Try again later.";
  }
  const failure = commandFailure(cause, "Nothing was changed.");
  return failure.rejected ? failure.message : unknownOutcome;
}

/** Account Settings: change the password, or sign out every other device. */
export function SignInSettings() {
  const [open, setOpen] = useState<"password" | "elsewhere" | null>(null);
  const [notice, setNotice] = useState("");
  function show(dialog: "password" | "elsewhere") {
    setNotice("");
    setOpen(dialog);
  }
  function done(message: string) {
    setOpen(null);
    setNotice(message);
  }
  return (
    <div className="a-set-group">
      <h2>Password and sign-in</h2>
      <div className="a-set-list">
        <button className="a-set-row" type="button" onClick={() => show("password")}>
          <span className="a-set-row-copy">
            <strong>Change password</strong>
            <span>You stay signed in here. Other devices will need the new password.</span>
          </span>
          <Icon name="chevron" size={16} />
        </button>
        <button className="a-set-row" type="button" onClick={() => show("elsewhere")}>
          <span className="a-set-row-copy">
            <strong>Sign out everywhere else</strong>
            <span>Every other phone, tablet and browser. You stay signed in here.</span>
          </span>
          <Icon name="chevron" size={16} />
        </button>
      </div>
      {notice ? (
        <div role="status">
          <p className="a-form-success">{notice}</p>
          <p className="a-commune-setting-note">{STILL_OPEN}</p>
        </div>
      ) : null}
      {open === "password" ? <ChangePasswordDialog onClose={() => setOpen(null)} onDone={done} /> : null}
      {open === "elsewhere" ? <SignOutElsewhereDialog onClose={() => setOpen(null)} onDone={done} /> : null}
    </div>
  );
}

function ChangePasswordDialog({ onClose, onDone }: { onClose: () => void; onDone: (message: string) => void }) {
  const { changePassword, clearApiError, session } = useApp();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function save(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!current) { setError("Enter your current password."); return; }
    if (next.length < 12 || next.length > 128) { setError("Use 12 to 128 characters for your new password."); return; }
    if (next === current) { setError("Your new password is the same as your current one."); return; }
    setPending(true);
    setError("");
    try {
      await changePassword(current, next);
      onDone("Password changed. You’re still signed in here, and other devices will need to sign in again.");
    } catch (cause) {
      // This dialog explains what happened, so the page banner doesn't repeat it.
      clearApiError();
      setError(failureText(cause,
        "We couldn’t confirm the change. Check your connection, then try again. If Commune then says your current password isn’t right, the change went through and your new password is the one to use."));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog title="Change your password" pending={pending} onClose={onClose}>
      <form onSubmit={(event) => void save(event)}>
        {/* Tells a password manager which account the new password is for. */}
        <input type="text" autoComplete="username" value={session?.email ?? ""} readOnly hidden />
        <Field label="Current password">
          <input type="password" autoComplete="current-password" maxLength={128} value={current} disabled={pending} required
            onChange={(event) => setCurrent(event.target.value)} />
        </Field>
        <Field label="New password" hint="Use at least 12 characters.">
          <input type="password" autoComplete="new-password" minLength={12} maxLength={128} value={next} disabled={pending} required
            onChange={(event) => setNext(event.target.value)} />
        </Field>
        <p className="c-form-help">
          You’ll stay signed in on this device. Every other phone, tablet and browser will need to sign in again with your new password. {STILL_OPEN}
        </p>
        <Feedback error={error} />
        <div className="a-field-row">
          <Button type="submit" disabled={pending}>{pending ? "Changing…" : "Change password"}</Button>
          <Button variant="secondary" disabled={pending} onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Dialog>
  );
}

function SignOutElsewhereDialog({ onClose, onDone }: { onClose: () => void; onDone: (message: string) => void }) {
  const { signOutOtherDevices, clearApiError } = useApp();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await signOutOtherDevices();
      onDone("Signed out everywhere else. You’re still signed in here.");
    } catch (cause) {
      clearApiError();
      setError(failureText(cause, "We couldn’t confirm this. Check your connection, then try again. Trying again is safe."));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog title="Sign out everywhere else?" pending={pending} onClose={onClose}>
      <p>You’ll stay signed in on this device. Every other phone, tablet and browser signed in to your account will need to sign in again.</p>
      <p className="c-form-help">{STILL_OPEN} If someone else might know your password, change it as well.</p>
      <Feedback error={error} />
      <div className="a-field-row">
        <Button disabled={pending} onClick={() => void confirm()}>{pending ? "Signing out…" : "Sign out everywhere else"}</Button>
        <Button variant="secondary" disabled={pending} onClick={onClose}>Cancel</Button>
      </div>
    </Dialog>
  );
}
