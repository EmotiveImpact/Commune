import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { diagnosticsEnabled } from "./live/diagnostics";
import { Link, Redirect, Route, Switch, useLocation, useSearch } from "wouter";
import { LoginPage } from "./auth/Login";
import { SignupPage, VerifyEmailPage } from "./auth/Signup";
import { ForgotPasswordPage, ResetPasswordPage } from "./auth/ForgotPassword";
import { InvitePage, OnboardPage } from "./auth/InviteOnboard";
import { PrivacyPage, TermsPage } from "./legal/LegalPages";
import { useApp } from "./state";
import { Header, MoreSheet, PhoneTabs, Sidebar } from "./shell/Shell";
import { HomeEmptyScreen, HomeScreen, PlacesScreen } from "./screens/Home";
import { HubEmptyScreen, HubScreen } from "./screens/Hub";
import {
  ExpensesEmptyScreen,
  ExpensesScreen,
  FundsScreen,
  RecurringScreen,
  SettleEvenScreen,
  SettleScreen,
} from "./screens/Money";
import {
  ActivityScreen,
  MembersScreen,
  NotesScreen,
  TemplatesScreen,
} from "./screens/House";
import { OperationsScreen } from "./screens/Operations";
import { CommuneSettingsScreen, SettingsScreen } from "./screens/Settings";
import { Windows } from "./windows/Windows";
import { cx } from "./ui/cx";
import { PAGE_TITLES, type ScreenId } from "./data/household";
import { COMMUNE_SCREENS, forgetReturn, keepSearch, readAddress, readReturn, rememberReturn } from "./nav";
import { AuthLayout } from "./auth/AuthLayout";
import { PendingShell } from "./shell/PendingShell";
import { AllActivityScreen, SearchScreen } from "./screens/Search";
import { ConnectionRecovery } from "./shell/ConnectionRecovery";
import { RecoveryBoundary, ScreenRecovery } from "./shell/Recovery";
import { isConnectionFailure } from "./live/connection";

export function App() {
  return (
    <Switch>
      <Route path="/hub-empty"><Redirect to={keepSearch("/hub")} replace /></Route>
      <Route path="/expenses-empty"><Redirect to={keepSearch("/expenses")} replace /></Route>
      <Route path="/settle-even"><Redirect to={keepSearch("/settle")} replace /></Route>
      <Route path="/home-empty"><Redirect to={keepSearch("/")} replace /></Route>
      {/* Billing and Analytics come back when they do something. */}
      <Route path="/billing"><Redirect to={keepSearch("/")} replace /></Route>
      <Route path="/analytics"><Redirect to={keepSearch("/")} replace /></Route>
      <Route path="/login">
        <PageTitle title="Sign in" />
        <GuestOnly>
          <LoginPage />
        </GuestOnly>
      </Route>
      <Route path="/signup">
        <PageTitle title="Create your account" />
        <GuestOnly>
          <SignupPage />
        </GuestOnly>
      </Route>
      <Route path="/verify-email">
        <PageTitle title="Verify your email" />
        <VerifyEmailPage />
      </Route>
      <Route path="/forgot-password">
        <PageTitle title="Reset your password" />
        <GuestOnly>
          <ForgotPasswordPage />
        </GuestOnly>
      </Route>
      <Route path="/reset-password">
        <PageTitle title="Choose a new password" />
        <ResetPasswordPage />
      </Route>
      <Route path="/invite">
        <PageTitle title="Invitation" />
        <InvitePage />
      </Route>
      <Route path="/privacy">
        <PageTitle title="Privacy" />
        <PrivacyPage />
      </Route>
      <Route path="/terms">
        <PageTitle title="Terms of use" />
        <TermsPage />
      </Route>
      <Route path="/onboard">
        <PageTitle title="Name your commune" />
        <AuthenticatedOnly>
          <OnboardPage />
        </AuthenticatedOnly>
      </Route>
      <Route>
        <ProtectedApp />
      </Route>
    </Switch>
  );
}

// "Expenses · Flat 4 · Commune": short, most specific first.
function usePageTitle(...parts: Array<string | undefined>) {
  const title = [...parts.filter(Boolean), "Commune"].join(" · ");
  useEffect(() => { document.title = title; }, [title]);
}

function PageTitle({ title }: { title: string }) {
  usePageTitle(title);
  return null;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { session, authStatus } = useApp();
  if (authStatus === "loading") return <AppLoading />;
  if (authStatus === "error") return <AppUnavailable />;
  if (session) return <SignedIn hasHubs={session.hasHubs} />;
  return children;
}

// Signed in: on to the page that asked for a sign-in, or Home, or naming a
// first commune. Replaced, so Back does not return to the sign-in form.
function SignedIn({ hasHubs }: { hasHubs: boolean }) {
  const [target] = useState(() => readReturn() ?? (hasHubs ? "/" : "/onboard"));
  useEffect(() => forgetReturn(), []);
  return <Redirect to={keepSearch(target)} replace />;
}

function ProtectedApp() {
  const [path] = useLocation();
  // An address Commune does not have needs no sign-in to say so.
  if (!readAddress(path).screen) return <><PageTitle title="Page not found" /><NotFoundPage /></>;
  return <AuthenticatedOnly><ProductShell /></AuthenticatedOnly>;
}

function AuthenticatedOnly({ children }: { children: ReactNode }) {
  const { session, authStatus, sessionNotice } = useApp();
  const [path] = useLocation();
  const search = useSearch();
  if (authStatus === "loading") return <AppLoading />;
  if (authStatus === "error") return <AppUnavailable />;
  // A link opened signed out (a reminder email's link to Settings, a shared
  // expense) opens after signing in. A session that ended keeps what is saved.
  if (!session) return <SignInFirst requested={sessionNotice ? null : search ? `${path}?${search}` : path} />;
  return children;
}

function SignInFirst({ requested }: { requested: string | null }) {
  useLayoutEffect(() => { if (requested !== null) rememberReturn(requested); }, [requested]);
  return <Redirect to={keepSearch("/login")} replace />;
}

function NotFoundPage() {
  return (
    <AuthLayout>
      <div className="commune-auth-panel">
        <h2>This page isn’t here.</h2>
        <p className="commune-auth-lede">The link may be mistyped, or the page may have moved.</p>
        <div className="a-field-row">
          <Link href={keepSearch("/")} className="a-btn">Go to Home</Link>
        </div>
      </div>
    </AuthLayout>
  );
}

function AppLoading() {
  return <PendingShell />;
}

function AppUnavailable() {
  const { refresh, signOut } = useApp();
  return <ConnectionRecovery retry={refresh} signOut={signOut} />;
}

function ProductShell() {
  const { screen, navMode, moreOpen, native, dark, window: win, notes, noteKey, apiError, clearApiError, contentError, hub, refresh, searchTarget, unknownCommune } = useApp();
  const noteReader = screen === "notes" && win === "note" && Boolean(notes[noteKey]);
  const modalOpen = Boolean(win) && !noteReader;
  usePageFocus(screen, hub.id, Boolean(win) || Boolean(searchTarget));
  usePageTitle(unknownCommune ? "Commune not found" : (win && PAGE_TITLES[win]) || PAGE_TITLES[screen],
    COMMUNE_SCREENS.has(screen) && !unknownCommune ? hub.name : undefined);
  return (
    <div
      className={cx(
        "a-body",
        (screen === "hub" || screen === "hub-empty") && "hub-editorial",
        navMode === "advanced" ? "nav-advanced" : "nav-basic",
        moreOpen && "more-open",
        native && "is-native",
        dark && "is-dark",
        modalOpen && "has-window",
        noteReader && "has-note-reader",
      )}
    >
      <div className="a-app" inert={modalOpen}>
        <a className="a-skip-link" href="#main-content" onClick={skipToContent}>Skip to content</a>
        <Sidebar screen={screen} />
        <div className="a-main">
          <Header screen={screen} />
          {diagnosticsEnabled() ? <ConnectionCheck /> : null}
          {apiError ? <div className="a-api-error" role="alert">{isConnectionFailure(apiError) ? <>Connection interrupted. Your last loaded view is still available.<button type="button" onClick={() => void refresh()}>Try again</button></> : apiError}<button type="button" onClick={clearApiError} aria-label="Dismiss error">×</button></div> : null}
          {contentError && hub.activityState === "ready" ? <div className="a-api-error" role="alert">Could not refresh this commune. Showing its last loaded activity.<button type="button" onClick={() => void refresh()}>Try again</button></div> : null}
          <main className="a-content" id="main-content">
            <RecoveryBoundary resetKey={`${screen} ${hub.id}`} fallback={(retry) => <ScreenRecovery retry={retry} />}>
              <Screen screen={screen} />
            </RecoveryBoundary>
          </main>
        </div>
      </div>
      <div inert={modalOpen} style={{ display: "contents" }}>
        <PhoneTabs screen={screen} />
        <MoreSheet />
      </div>
      <Windows key={hub.id} />
    </div>
  );
}

// Focus moves to an element that only holds it until the next step away.
function focusOnce(element: HTMLElement) {
  if (!element.hasAttribute("tabindex")) {
    element.tabIndex = -1;
    element.addEventListener("blur", () => element.removeAttribute("tabindex"), { once: true });
  }
  element.focus({ preventScroll: true });
}

function skipToContent(event: MouseEvent<HTMLAnchorElement>) {
  const main = document.getElementById("main-content");
  if (!main) return;
  event.preventDefault();
  focusOnce(main);
}

// After moving to another page or commune, start at the new page's heading
// rather than on a control that has gone. A window, the note reader or a
// search result places focus itself; if one was opening, wait until it closes
// and only step in when focus would otherwise be lost.
function usePageFocus(screen: ScreenId, hubId: string, held: boolean) {
  const shown = useRef({ screen, hubId });
  const waiting = useRef(false);
  useEffect(() => {
    const previous = shown.current;
    shown.current = { screen, hubId };
    const moved = previous.screen !== screen || (Boolean(previous.hubId) && previous.hubId !== hubId);
    if (moved) waiting.current = true;
    if (!waiting.current || held) return;
    waiting.current = false;
    const active = document.activeElement;
    if (!moved && active && active !== document.body) return;
    const heading = document.querySelector<HTMLElement>(".a-header-title h1");
    if (heading) focusOnce(heading);
  }, [screen, hubId, held]);
}

function ConnectionCheck() {
  const { hubId } = useApp();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState("");
  async function check() {
    setRunning(true);
    setResult("");
    try {
      const { inspectMembershipRead } = await import("./live/neon");
      const rows = [];
      for (let round = 1; round <= 5; round++) {
        rows.push({ round, reads: await inspectMembershipRead(hubId) });
      }
      setResult(JSON.stringify(rows, null, 2));
    } catch {
      setResult("Connection test could not complete.");
    } finally { setRunning(false); }
  }
  return <details style={{ margin: "0 28px", fontSize: 12 }}>
    <summary>Read-only connection diagnostics</summary>
    <button type="button" disabled={!hubId || running} onClick={() => void check()}>{running ? "Checking…" : "Compare membership reads"}</button>
    <pre style={{ maxHeight: 240, overflow: "auto" }}>{result}</pre>
  </details>;
}

function Screen({ screen }: { screen: ScreenId }) {
  return (
    <section className="screen" id={screen}>
      <ScreenBody screen={screen} />
    </section>
  );
}

function ScreenBody({ screen }: { screen: ScreenId }) {
  const { session, emptyHub, hub, contentLoading, contentError, refresh, unknownCommune, go } = useApp();
  const hasHubs = Boolean(session?.hasHubs);
  const hasSettlement = hub.moves.some((move) => !move.even);

  // Never another commune's records in its place.
  if (unknownCommune) {
    return <div className="a-empty"><h2>This commune isn’t available to you.</h2><p>You may have left it, or the link is for a different account.</p><button className="a-btn" type="button" onClick={() => go("home")}>Go to Home</button></div>;
  }

  if (contentLoading && screen !== "settings" && screen !== "search") {
    if (contentError) return <div className="a-content-loading" role="alert"><h2>Could not load {hub.name}</h2><p>{contentError}</p><button className="a-btn" type="button" onClick={() => void refresh()}>Try again</button></div>;
    return <div className="c-content-skeleton" role="status" aria-label="Loading shared records" aria-busy="true"><span className="c-visually-hidden">Loading shared records</span>{screen === "hub" && <div className="c-skeleton-identity" style={hub.photo ? { backgroundImage: `linear-gradient(0deg, rgba(26,30,43,.8), rgba(26,30,43,.1)), url("${hub.photo}")` } : undefined}><h2>{hub.name}</h2><p>{hub.switchMeta}</p></div>}<div className="c-skeleton-grid" aria-hidden="true"><div /><div /><div /><div /></div></div>;
  }

  switch (screen) {
    case "home":
      return hasHubs ? <HomeScreen /> : <HomeEmptyScreen />;
    case "home-empty":
      return hasHubs ? <HomeScreen /> : <HomeEmptyScreen />;
    case "home-inbox":
      return hasHubs ? <HomeScreen /> : <HomeEmptyScreen />;
    case "communes":
      return <PlacesScreen />;
    case "hub":
      return !hasHubs ? <HomeEmptyScreen /> : emptyHub ? <HubEmptyScreen /> : <HubScreen />;
    case "hub-empty":
      return emptyHub || !hasHubs ? <HubEmptyScreen /> : <HubScreen />;
    case "commune-settings":
      return <CommuneSettingsScreen key={hub.id} />;
    case "expenses":
      return emptyHub ? <ExpensesEmptyScreen /> : <ExpensesScreen key={hub.id} />;
    case "expenses-empty":
      return emptyHub || !hasHubs ? (
        <ExpensesEmptyScreen />
      ) : (
        <ExpensesScreen key={hub.id} />
      );
    case "settle":
      return !hasSettlement || !hasHubs ? (
        <SettleEvenScreen key={hub.id} />
      ) : (
        <SettleScreen key={hub.id} />
      );
    case "settle-even":
      return !hasSettlement || !hasHubs ? (
        <SettleEvenScreen key={hub.id} />
      ) : (
        <SettleScreen key={hub.id} />
      );
    case "recurring":
      return <RecurringScreen key={hub.id} />;
    case "funds":
      return <FundsScreen key={hub.id} />;
    case "templates":
      return <TemplatesScreen key={hub.id} />;
    case "members":
      return <MembersScreen key={hub.id} />;
    case "operations":
      return <OperationsScreen key={hub.id} />;
    case "notes":
      return <NotesScreen key={hub.id} />;
    case "activity":
      return <ActivityScreen />;
    case "home-activity":
      return <AllActivityScreen />;
    case "search":
      return <SearchScreen />;
    case "settings":
      return <SettingsScreen />;
    default:
      return hasHubs ? <HomeScreen /> : <HomeEmptyScreen />;
  }
}
