import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearch } from "wouter";
import { ChevronLeft, Info } from "lucide-react";
import { formatMoney } from "@commune/core";
import { useApp, type InvitePreview } from "../state";
import { rememberReturn } from "../nav";
import { readInviteHints } from "../data/inviteHints";
import { coverSource } from "../data/covers";
import { PayLinksEditor } from "../ui/PayLinks";
import { ImagePick } from "../ui/photos";
import { Avatar } from "../ui/widgets";
import { CalendarDate } from "../ui/CalendarDate";
import { AppleMark, GoogleMark } from "../ui/Icon";
import "./join.css";

/*
 * Joining a house (approved mock-up, 8 November 2026:
 * https://claude.ai/artifact/1rV9zZqePyDsUEDUFVbb7J). Someone who opens an
 * invitation link gets four screens, then Home: the house and who asked,
 * signing in, their photo and how they like to be paid, then what they owe
 * and their chores. No opening stories, no plans and no trial: the house is
 * already paid for. Phones get one column; tablets and computers keep the
 * house photo on the left throughout.
 */

type Step = "house" | "signin" | "you" | "part";
const HALL = "/join/hall.jpg";
const APPLE_ON = import.meta.env.VITE_APPLE_OAUTH_ENABLED === "true";
const GOOGLE_ON = import.meta.env.VITE_GOOGLE_OAUTH_ENABLED === "true";

export function InvitePage() {
  const app = useApp();
  const { session, authStatus, previewInvite, inviteAddressHint, acceptInvite, signOut, places, go } = app;
  const search = useSearch();
  const token = new URLSearchParams(search).get("token") ?? "";
  const hints = useMemo(() => readInviteHints(search), [search]);
  const signedInUserId = session?.userId;
  const [step, setStep] = useState<Step>("house");
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [joinedId, setJoinedId] = useState<string | null>(null);

  // The invitation is read only once someone has signed in; until then the link's hints greet them.
  useEffect(() => {
    let active = true;
    if (!token || authStatus === "loading") { if (!token) setLoading(false); return; }
    if (!signedInUserId) { setLoading(false); return; }
    setLoading(true);
    setHint(null);
    void previewInvite(token)
      .then(async (result) => {
        if (!active) return;
        setInvite(result);
        if (!result) {
          const masked = await inviteAddressHint(token).catch(() => null);
          if (active) setHint(masked);
        }
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load the invitation."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authStatus, inviteAddressHint, previewInvite, signedInUserId, token]);

  // Back from Google or Apple, or a sign-in page, signed in: the house again, one tap from joining.
  useEffect(() => { if (session && step === "signin") setStep("house"); }, [session, step]);

  const returnHere = `/invite?${search}`;
  const joined = joinedId ? places.find((place) => place.id === joinedId) ?? null : null;
  const house = joined?.name ?? invite?.communeName ?? hints.house;
  const by = hints.by;
  const elsewhere = !loading && !invite && session && hint ? hint : null;
  const unavailable = !loading && session && !invite && !joinedId && !elsewhere;

  async function join() {
    if (!session) { setStep("signin"); return; }
    if (!invite) return;
    setBusy(true);
    setError("");
    try {
      const id = await acceptInvite(token, { stay: true });
      setJoinedId(id);
      setStep("you");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not join. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function social(provider: "apple" | "google") {
    setError("");
    setBusy(true);
    rememberReturn(returnHere);
    try {
      await (provider === "apple" ? app.signInWithApple() : app.signInWithGoogle());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign in. Try again.");
      setBusy(false);
    }
  }

  function switchAccount() {
    rememberReturn(returnHere);
    void signOut();
  }

  const back = (to: Step) => <button className="c-join-back" type="button" onClick={() => setStep(to)}><ChevronLeft size={20} aria-hidden="true" />Back</button>;
  const photo = joined ? coverSource(joined, "hero") : { src: HALL };
  const people = joined?.members ?? [];

  let body: ReactNode;
  if (!token) {
    body = <Panel title="This link isn’t complete">
      <p className="c-join-body">Ask whoever invited you to send the link again, or open it straight from their message.</p>
      <Link href="/" className="c-join-pill">Go to Commune</Link>
    </Panel>;
  } else if (step === "house") {
    body = <>
      <div className={elsewhere || unavailable ? "c-join-heading" : "c-join-heading is-welcome"}>
        <span className="c-join-over">{by ? `${by} invited you` : "You’re invited"}</span>
        <h2>{elsewhere ? "This invitation is for another address" : unavailable ? "Invitation unavailable"
          : house ? <>Join <span className="c-join-nowrap">{house}</span></> : "Join a house on Commune"}</h2>
      </div>
      {elsewhere ? <>
        <p className="c-join-body">It was sent to {elsewhere}, and you’re signed in as {session?.email}. To join, sign in with the address it was sent to.</p>
        <button className="c-join-pill" type="button" onClick={switchAccount}>Sign out and use another account</button>
        <button className="c-join-pill is-quiet" type="button" onClick={() => go("home")}>Continue to Commune</button>
      </> : unavailable ? <>
        <p className="c-join-body">This link may have expired, been used already, or been cancelled. Ask {by ?? "whoever invited you"} for a new one.</p>
        <button className="c-join-pill is-quiet" type="button" onClick={() => go("home")}>Continue to Commune</button>
      </> : <>
        <p className="c-join-body">The house keeps its bills, chores and notes on Commune. You’ll see your share of the bills that include you, and the chores that are yours.</p>
        <p className="c-join-free"><CheckDot />The house already has Commune. It’s free for you.</p>
        {error ? <p className="c-join-alert" role="alert">{error}</p> : null}
        <div className="c-join-actions">
          <button className="c-join-pill" type="button" disabled={busy || authStatus === "loading" || (Boolean(session) && (loading || !invite))} onClick={() => void join()}>
            {busy ? "Joining…" : loading && session ? "Checking your invitation…" : house ? `Join ${house}` : "Join the house"}
          </button>
          {session ? <span className="c-join-small">Signed in as {session.email}</span> : null}
        </div>
      </>}
    </>;
  } else if (step === "signin") {
    body = <>
      <div className="c-join-top">{back("house")}<Progress n={2} /></div>
      <div className="c-join-heading"><h2>Sign in to join</h2>
        <p className="c-join-body">Use the email address your invitation was sent to. {by ?? "The house"} and the others see your name and photo, nothing else.</p></div>
      {error ? <p className="c-join-alert" role="alert">{error}</p> : null}
      <div className="c-join-ways">
        {APPLE_ON ? <button className="c-join-way is-apple" type="button" disabled={busy} onClick={() => void social("apple")}><AppleMark />Continue with Apple</button> : null}
        {GOOGLE_ON ? <button className="c-join-way" type="button" disabled={busy} onClick={() => void social("google")}><GoogleMark />Continue with Google</button> : null}
        <Link href="/signup" className="c-join-way" onClick={() => rememberReturn(returnHere)}>Create an account with email</Link>
      </div>
      <p className="c-join-hint"><Info size={16} aria-hidden="true" /><span>Already on Commune? <Link href="/login" className="c-join-link" onClick={() => rememberReturn(returnHere)}>Sign in</Link> and the house joins your list.</span></p>
      <p className="c-join-small is-centre">Commune never posts anything and never sees your bank login.</p>
    </>;
  } else if (step === "you") {
    body = <YouStep onNext={() => setStep("part")} />;
  } else {
    body = <PartStep hub={joined} by={by} onDone={() => go("home")} onBack={() => setStep("you")} />;
  }

  return (
    <div className={`c-join is-${step}`}>
      <aside className="c-join-side">
        <img className="c-join-photo" src={photo.src} srcSet={photo.srcSet} sizes="(max-width: 860px) 100vw, 46vw" alt="" />
        <div className="c-join-side-top">
          <span className="a-wordmark c-join-mark" role="img" aria-label="Commune">commune.</span>
          {step === "house" && token ? <Progress n={1} light /> : null}
        </div>
        <div className="c-join-side-foot">
          {house ? <>
            <span className="c-join-over is-light">{joined?.type === "Trip" ? "Trip" : joined?.type === "Workspace" ? "Workspace" : "Home"}{joined?.address ? ` · ${joined.address}` : ""}</span>
            <h1 className="c-join-house">{house}</h1>
          </> : <h1 className="c-join-house">Commune</h1>}
          {by ? <span className="c-join-by">{by} invited you to join</span> : null}
          {people.length ? <span className="c-join-faces">{people.slice(0, 6).map((member) => <Avatar key={member.userId} tone={member.cls} initials={member.ini} />)}</span> : null}
          <span className="c-join-tag">for people who do life, together.</span>
        </div>
      </aside>
      <main className="c-join-main">
        <div className="c-join-col">{body}</div>
        <footer className="c-join-legal"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></footer>
      </main>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <><div className="c-join-heading"><h2>{title}</h2></div>{children}</>;
}

function Progress({ n, light = false }: { n: number; light?: boolean }) {
  return <span className={light ? "c-join-prog is-light" : "c-join-prog"} role="img" aria-label={`Step ${n} of 4`}>
    {[1, 2, 3, 4].map((k) => <i key={k} className={k <= n ? "is-on" : undefined} />)}
  </span>;
}

function CheckDot() {
  return <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function YouStep({ onNext }: { onNext: () => void }) {
  const { you, setAvatar, myPayLinks } = useApp();
  const added = (myPayLinks ?? []).length;
  return <>
    <div className="c-join-top"><span /><Progress n={3} /><button className="c-join-link" type="button" onClick={onNext}>Skip</button></div>
    <div className="c-join-heading"><span className="c-join-over">About you</span><h2>This is how the house sees you</h2></div>
    <div className="c-join-me">
      <Avatar tone="maya" initials={you.initials} />
      <div className="c-join-me-text">
        <strong>{you.name}</strong>
        <span>{you.email}</span>
        <ImagePick label={you.photo ? "Change photo" : "Add a photo"} clearLabel="Remove" hasCustom={Boolean(you.photo)} maxEdge={320}
          inputLabel="Your photo" onPhoto={setAvatar} onClear={() => setAvatar(null)} />
      </div>
    </div>
    <section className="c-join-section" aria-labelledby="join-pay">
      <div><h3 id="join-pay" className="c-join-over">How do you like to be paid?</h3>
        <p className="c-join-body is-small">When someone owes you, they see these with the amount filled in. Commune never moves money.</p></div>
      <PayLinksEditor />
    </section>
    <button className="c-join-pill" type="button" onClick={onNext}>{added ? "Continue" : "Continue without"}</button>
  </>;
}

function PartStep({ hub, by, onDone, onBack }: {
  hub: ReturnType<typeof useApp>["places"][number] | null; by: string | null; onDone: () => void; onBack: () => void;
}) {
  const { go } = useApp();
  const ready = hub?.activityState === "ready";
  const owe = hub?.youOweMinor ?? 0;
  const mine = hub ? hub.now.filter((need) => need.kind === "pay" || need.kind === "task") : [];
  const coming = hub ? hub.coming.slice(0, 4) : [];
  return <>
    <div className="c-join-top">
      <button className="c-join-back" type="button" onClick={onBack}><ChevronLeft size={20} aria-hidden="true" />Back</button>
      <Progress n={4} /><span />
    </div>
    <div className="c-join-heading">
      <span className="c-join-over">Your part</span>
      {!hub || !ready ? <h2>Getting your part ready…</h2>
        : owe > 0 ? <h2>You owe <em>{formatMoney(owe, hub.currency)}</em> so far.</h2>
          : <h2>You owe <em>nothing</em> today.</h2>}
      {hub && ready ? <p className="c-join-body">Only bills that include you count. {owe > 0 ? "Each one is below." : "When one does, it shows here and on Home."}</p> : null}
    </div>
    {hub && ready ? <>
      {mine.length ? <section className="c-join-section" aria-label="Yours now">
        <ul className="c-join-list">{mine.map((need, index) => <li key={`${need.kind}-${need.shareId ?? need.operationId ?? index}`}>
          {need.dueOn ? <CalendarDate date={need.dueOn} /> : <span className="c-join-dot" aria-hidden="true" />}
          <span className="c-join-row"><strong>{need.title}</strong><span>{need.when}</span></span>
          {need.amount ? <span className="c-join-amt">{need.amount}</span> : null}
        </li>)}</ul>
      </section> : null}
      <section className="c-join-section" aria-labelledby="join-coming">
        <h3 id="join-coming" className="c-join-over">Coming up in the house</h3>
        {coming.length ? <ul className="c-join-list">{coming.map((item) => <li key={`${item.kind}-${item.operationId ?? item.billId ?? item.title}-${item.dueOn}`}>
          <CalendarDate date={item.dueOn} />
          <span className="c-join-row"><strong>{item.title}</strong><span>{item.when}</span></span>
        </li>)}</ul> : <p className="c-join-body is-small">Nothing in the next two weeks. Chores and regular bills show here when they’re due.</p>}
      </section>
      <p className="c-join-hint"><Info size={16} aria-hidden="true" /><span>Nothing from before today is yours unless {by ?? "someone"} added you to it.</span></p>
    </> : null}
    <div className="c-join-actions">
      <button className="c-join-pill" type="button" onClick={onDone} disabled={!ready}>That looks right</button>
      <button className="c-join-link" type="button" onClick={() => go("hub")}>Open the house instead</button>
    </div>
  </>;
}

