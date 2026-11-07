import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useSearch } from "wouter";
import { AuthLayout } from "./AuthLayout";
import { useApp, type JoinCodePreview, type JoinCodeResult } from "../state";
import type { Hub } from "../data/household";
import { LIMITS } from "../data/limits";
import { CommuneLocationFields, EMPTY_COMMUNE_LOCATION } from "../ui/CommuneLocationFields";
import { rememberReturn } from "../nav";

export function InvitePage() {
  const { go, session, authStatus, previewInvite, inviteAddressHint, acceptInvite, signOut } = useApp();
  const signedInUserId = session?.userId;
  const token = new URLSearchParams(useSearch()).get("token") ?? "";
  const [invite, setInvite] = useState<{ communeName: string; role: string; expiresAt: string } | null>(null);
  // The invited address, masked, when this account has another one.
  const [hint, setHint] = useState<string | null>(null);
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
    setHint(null);
    void previewInvite(token)
      .then(async (result) => {
        if (!active) return;
        setInvite(result);
        // Without the hint the page still says the invitation is unavailable.
        if (!result) {
          const masked = await inviteAddressHint(token).catch(() => null);
          if (active) setHint(masked);
        }
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load invitation."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authStatus, inviteAddressHint, previewInvite, signedInUserId, token]);

  function signInFirst(target: "login" | "signup") {
    rememberReturn(`/invite?token=${encodeURIComponent(token)}`);
    go(target);
  }

  // Signing in again, with the other account, comes back here.
  function switchAccount() {
    rememberReturn(`/invite?token=${encodeURIComponent(token)}`);
    void signOut();
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

  const elsewhere = !loading && !invite && session && hint ? hint : null;

  return (
    <AuthLayout invite={{ communeName: invite?.communeName, role: invite?.role }}>
      <div className="commune-auth-panel">
        <h2>{loading ? "Loading invitation…" : invite ? `Join ${invite.communeName}` : token && !session ? "You have a Commune invitation" : elsewhere ? "This invitation is for another address" : "Invitation unavailable"}</h2>
        <p className="commune-auth-lede">
          {invite ? `You’ve been invited as a ${invite.role.toLowerCase()}.` : token && !session ? "Sign in or create an account using the invited email address to see and accept this invitation."
            : elsewhere && session ? `It was sent to ${elsewhere}, and you’re signed in as ${session.email}. To join, sign in with the address it was sent to.`
              : "This link may be invalid, expired, already used, or addressed to a different account."}
        </p>
        {error ? <div className="commune-auth-alert" role="alert">{error}</div> : null}
        {session && !invite && !loading ? (
          <div className="a-field-row">
            {elsewhere ? <button className="a-btn" type="button" onClick={switchAccount}>Sign out and use another account</button> : null}
            <button className={elsewhere ? "a-btn ghost" : "a-btn"} type="button" onClick={() => go("home")}>Continue to Commune</button>
          </div>
        ) : token && authStatus !== "loading" && (invite || !session) ? (
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

/** A join code's short link, /j/<code>, opens the join page with the code kept out of the path. */
export function JoinShortLink({ code }: { code: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation(`/join?code=${encodeURIComponent(code)}`, { replace: true }); }, [code, setLocation]);
  return null;
}

const KIND_WORD: Record<string, string> = { household: "A household", workspace: "A workspace", trip: "A trip" };

/**
 * Someone scanned a commune's QR code (0044). Signed in, they see only the
 * commune's name, kind and head count, and ask to join. Whether an admin must
 * approve is the commune's setting.
 */
export function JoinCodePage() {
  const { go, session, authStatus, previewJoinCode, requestToJoin } = useApp();
  const code = new URLSearchParams(useSearch()).get("code") ?? "";
  const valid = /^[0-9a-f]{32}$/.test(code);
  const [preview, setPreview] = useState<JoinCodePreview | null>(null);
  const [result, setResult] = useState<JoinCodeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requestId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    let active = true;
    if (!valid || authStatus === "loading" || !session) {
      if (authStatus !== "loading") setLoading(false);
      return;
    }
    setLoading(true);
    void previewJoinCode(code)
      .then((found) => { if (active) setPreview(found); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load this code."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authStatus, code, previewJoinCode, session, valid]);

  function signInFirst(target: "login" | "signup") {
    rememberReturn(`/join?code=${encodeURIComponent(code)}`);
    go(target);
  }

  async function ask() {
    setBusy(true);
    setError("");
    try {
      setResult(await requestToJoin(code, requestId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not ask to join.");
    } finally {
      setBusy(false);
    }
  }

  const waiting = result?.status === "pending" || (!result && preview?.waiting);
  const title = !valid ? "This code doesn’t work"
    : !session ? "Join a commune on Commune"
      : loading ? "Loading…"
        : waiting ? `Waiting for ${preview?.communeName ?? "an admin"}`
          : preview ? `Join ${preview.communeName}` : "This code no longer works";
  const lede = !valid ? "Check you scanned the whole code, or ask for a new one."
    : !session ? "Sign in or create an account, then ask to join. Nothing about the group shows until you’re in."
      : loading ? ""
        : waiting ? "An admin has been asked. You’ll see the commune here once they approve."
          : preview ? `${KIND_WORD[preview.communeKind] ?? "A commune"} with ${preview.memberCount} ${preview.memberCount === 1 ? "person" : "people"}. ${preview.joinMode === "instant" ? "You’ll join straight away." : "An admin approves new people before they see anything."}`
            : "It may have been turned off or replaced. Ask someone in the commune for a new one.";

  return (
    <AuthLayout>
      <div className="commune-auth-panel">
        <h2>{title}</h2>
        {lede ? <p className="commune-auth-lede">{lede}</p> : null}
        {error ? <div className="commune-auth-alert" role="alert">{error}</div> : null}
        {valid && !session && authStatus !== "loading" ? (
          <div className="a-field-row">
            <button className="a-btn" type="button" onClick={() => signInFirst("signup")}>Create account</button>
            <button className="a-btn ghost" type="button" onClick={() => signInFirst("login")}>Sign in</button>
          </div>
        ) : session && !loading && preview && !waiting ? (
          <div className="a-field-row">
            <button className="a-btn" type="button" onClick={() => void ask()} disabled={busy}>
              {busy ? "Asking…" : preview.alreadyMember ? "Open the commune" : "Ask to join"}
            </button>
          </div>
        ) : session && !loading ? (
          <div className="a-field-row">
            <button className="a-btn ghost" type="button" onClick={() => go("home")}>Continue to Commune</button>
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
