import { useState, type ReactNode } from "react";
import { diagnosticsEnabled } from "./live/diagnostics";
import { Redirect, Route, Switch } from "wouter";
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
  AnalyticsScreen,
  BillingScreen,
  MembersScreen,
  NotesScreen,
  TemplatesScreen,
} from "./screens/House";
import { OperationsScreen } from "./screens/Operations";
import { CommuneSettingsScreen, SettingsScreen } from "./screens/Settings";
import { Windows } from "./windows/Windows";
import { cx } from "./ui/cx";
import type { ScreenId } from "./data/household";
import { keepSearch } from "./nav";
import { PendingShell } from "./shell/PendingShell";
import { AllActivityScreen, SearchScreen } from "./screens/Search";
import { ConnectionRecovery } from "./shell/ConnectionRecovery";
import { isConnectionFailure } from "./live/connection";

export function App() {
  return (
    <Switch>
      <Route path="/hub-empty"><Redirect to={keepSearch("/hub")} replace /></Route>
      <Route path="/expenses-empty"><Redirect to={keepSearch("/expenses")} replace /></Route>
      <Route path="/settle-even"><Redirect to={keepSearch("/settle")} replace /></Route>
      <Route path="/home-empty"><Redirect to={keepSearch("/")} replace /></Route>
      <Route path="/login">
        <GuestOnly>
          <LoginPage />
        </GuestOnly>
      </Route>
      <Route path="/signup">
        <GuestOnly>
          <SignupPage />
        </GuestOnly>
      </Route>
      <Route path="/verify-email">
        <VerifyEmailPage />
      </Route>
      <Route path="/forgot-password">
        <GuestOnly>
          <ForgotPasswordPage />
        </GuestOnly>
      </Route>
      <Route path="/reset-password">
        <ResetPasswordPage />
      </Route>
      <Route path="/invite" component={InvitePage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/onboard">
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

function GuestOnly({ children }: { children: ReactNode }) {
  const { session, authStatus } = useApp();
  if (authStatus === "loading") return <AppLoading />;
  if (authStatus === "error") return <AppUnavailable />;
  if (session?.hasHubs) return <Redirect to={keepSearch("/")} />;
  if (session) return <Redirect to={keepSearch("/onboard")} />;
  return children;
}

function ProtectedApp() {
  return <AuthenticatedOnly><ProductShell /></AuthenticatedOnly>;
}

function AuthenticatedOnly({ children }: { children: ReactNode }) {
  const { session, authStatus } = useApp();
  if (authStatus === "loading") return <AppLoading />;
  if (authStatus === "error") return <AppUnavailable />;
  if (!session) return <Redirect to={keepSearch("/login")} />;
  return children;
}

function AppLoading() {
  return <PendingShell />;
}

function AppUnavailable() {
  const { refresh } = useApp();
  return <ConnectionRecovery retry={refresh} />;
}

function ProductShell() {
  const { screen, navMode, moreOpen, native, dark, window: win, notes, noteKey, apiError, clearApiError, contentError, hub, refresh } = useApp();
  const noteReader = screen === "notes" && win === "note" && Boolean(notes[noteKey]);
  const modalOpen = Boolean(win) && !noteReader;
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
        <Sidebar screen={screen} />
        <div className="a-main">
          <Header screen={screen} />
          {diagnosticsEnabled() ? <ConnectionCheck /> : null}
          {apiError ? <div className="a-api-error" role="alert">{isConnectionFailure(apiError) ? <>Connection interrupted. Your last loaded view is still available.<button type="button" onClick={() => void refresh()}>Try again</button></> : apiError}<button type="button" onClick={clearApiError} aria-label="Dismiss error">×</button></div> : null}
          {contentError && hub.activityState === "ready" ? <div className="a-api-error" role="alert">Could not refresh this commune. Showing its last loaded activity.<button type="button" onClick={() => void refresh()}>Try again</button></div> : null}
          <div className="a-content">
            <Screen screen={screen} />
          </div>
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
  const { session, emptyHub, hub, contentLoading, contentError, refresh } = useApp();
  const hasHubs = Boolean(session?.hasHubs);
  const hasSettlement = hub.moves.some((move) => !move.even);

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
    case "billing":
      return <BillingScreen />;
    case "analytics":
      return <AnalyticsScreen />;
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
