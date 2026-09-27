import { useEffect, useState, type FormEvent } from "react";
import { AuthLayout } from "./AuthLayout";
import { useApp } from "../state";
import type { Hub } from "../data/household";
import { LIMITS } from "../data/limits";
import { CommuneLocationFields, EMPTY_COMMUNE_LOCATION } from "../ui/CommuneLocationFields";

export function InvitePage() {
  const { go, session, authStatus, previewInvite, acceptInvite } = useApp();
  const signedInUserId = session?.userId;
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [invite, setInvite] = useState<{ communeName: string; role: string; expiresAt: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!token || authStatus === "loading") {
      if (!token) setLoading(false);
      return;
    }
    if (!signedInUserId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void previewInvite(token)
      .then((result) => { if (active) setInvite(result); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load invitation."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authStatus, previewInvite, signedInUserId, token]);

  function signInFirst(target: "login" | "signup") {
    sessionStorage.setItem("commune.return-to", `/invite?token=${encodeURIComponent(token)}`);
    go(target);
  }

  async function join() {
    if (!session) {
      signInFirst("login");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await acceptInvite(token);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not accept invitation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <div className="commune-auth-panel">
        <h2>{loading ? "Loading invitation…" : invite ? `Join ${invite.communeName}` : token && !session ? "You have a Commune invitation" : "Invitation unavailable"}</h2>
        <p className="commune-auth-lede">
          {invite ? `You’ve been invited as a ${invite.role.toLowerCase()}.` : token && !session ? "Sign in or create an account using the invited email address to see and accept this invitation." : "This link may be invalid, expired, already used, or addressed to a different account."}
        </p>
        {error ? <div className="commune-auth-alert" role="alert">{error}</div> : null}
        {token && authStatus !== "loading" && (invite || !session) ? (
          <div className="a-field-row">
            {session ? (
              <button className="a-btn" type="button" onClick={() => void join()} disabled={busy}>
                {busy ? "Joining…" : "Join commune"}
              </button>
            ) : (
              <>
                <button className="a-btn" type="button" onClick={() => signInFirst("signup")}>Create account</button>
                <button className="a-btn ghost" type="button" onClick={() => signInFirst("login")}>Sign in</button>
              </>
            )}
          </div>
        ) : null}
      </div>
    </AuthLayout>
  );
}

export function OnboardPage() {
  const { createHub, session } = useApp();
  const [name, setName] = useState("");
  const [type, setType] = useState<Hub["type"]>("Household");
  const [currency, setCurrency] = useState("£ GBP");
  const [location, setLocation] = useState(EMPTY_COMMUNE_LOCATION);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Give your commune a name.");
      return;
    }
    setBusy(true);
    try {
      const created = await createHub({ name: name.trim(), type, currency, ...location });
      if (!created) throw new Error("Could not create the commune.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the commune.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <form className="commune-auth-panel" onSubmit={(event) => void create(event)}>
        <h2>Name your commune.</h2>
        <p className="commune-auth-lede">
          {session?.name ? `${session.name} · ` : ""}A home, a studio, or a trip. Invite other people after you create it.
        </p>
        {error ? <div className="commune-auth-alert" role="alert">{error}</div> : null}
        <div className="a-field">
          <label htmlFor="ob-name">Name</label>
          <input id="ob-name" type="text" required maxLength={LIMITS.communeName} value={name} onChange={(event) => setName(event.target.value)} />
          <span className="a-field-limit">{name.length}/{LIMITS.communeName}</span>
        </div>
        <div className="a-field">
          <label htmlFor="ob-type">Type</label>
          <select id="ob-type" value={type} onChange={(event) => setType(event.target.value as Hub["type"])}>
            <option>Household</option><option>Workspace</option><option>Trip</option>
          </select>
        </div>
        <div className="a-field">
          <label htmlFor="ob-cur">Currency</label>
          <select id="ob-cur" value={currency} onChange={(event) => setCurrency(event.target.value)}>
            <option>£ GBP</option><option>$ USD</option><option>€ EUR</option>
          </select>
        </div>
        <CommuneLocationFields type={type} value={location} onChange={setLocation} disabled={busy} idPrefix="onboard" />
        <div className="a-field-row">
          <button className="a-btn" type="submit" disabled={busy}>{busy ? "Creating…" : "Create commune"}</button>
        </div>
      </form>
    </AuthLayout>
  );
}
