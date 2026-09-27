import { useState, type ReactNode } from "react";
import { diagnosticsEnabled } from "./live/diagnostics";
import { Redirect, Route, Switch } from "wouter";
import { LoginPage } from "./auth/Login";
import { SignupPage, VerifyEmailPage } from "./auth/Signup";
import { ForgotPasswordPage, ResetPasswordPage } from "./auth/ForgotPassword";
import { InvitePage, OnboardPage } from "./auth/InviteOnboard";
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

export function App() {
  return (
    <Switch>
      <Route path="/hub-empty"><Redirect to={keepSearch("/hub")} replace /></Route>
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
  return <div className="a-empty" role="status"><h2>Opening Commune…</h2><p>Loading your account and shared spaces.</p></div>;
}

function AppUnavailable() {
  const { apiError, refresh } = useApp();
  return <div className="a-empty" role="alert"><h2>Commune could not connect</h2><p>{apiError ?? "The local application service is unavailable."}</p><button className="a-btn" type="button" onClick={() => void refresh()}>Try again</button></div>;
}

function ProductShell() {
  const { screen, navMode, moreOpen, native, dark, window: win, apiError, clearApiError, contentError, hub, refresh } = useApp();
  return (
    <div
      className={cx(
        "a-body",
        navMode === "advanced" ? "nav-advanced" : "nav-basic",
        moreOpen && "more-open",
        native && "is-native",
        dark && "is-dark",
        win && "has-window",
      )}
    >
      <div className="a-app">
        <Sidebar screen={screen} />
        <div className="a-main">
          <Header screen={screen} />
          {diagnosticsEnabled() ? <ConnectionCheck /> : null}
          {apiError ? <div className="a-api-error" role="alert">{apiError}<button type="button" onClick={clearApiError} aria-label="Dismiss error">×</button></div> : null}
          {contentError && hub.activityState === "ready" ? <div className="a-api-error" role="alert">Could not refresh this commune. Showing its last loaded activity.<button type="button" onClick={() => void refresh()}>Try again</button></div> : null}
          <div className="a-content">
            <Screen screen={screen} />
          </div>
        </div>
      </div>
      <PhoneTabs screen={screen} />
      <MoreSheet />
      <Windows />
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

  if (contentLoading && screen !== "settings") {
    return <div className="a-content-loading" role={contentError ? "alert" : "status"} aria-busy={!contentError}>
      <h2>{contentError ? "Could not load your commune" : `Opening ${hub.name}…`}</h2>
      <p>{contentError ? contentError : "Loading your shared activity."}</p>
      {contentError ? <button className="a-btn" type="button" onClick={() => void refresh()}>Try again</button>
        : <div className="a-loading-lines" aria-hidden="true"><span /><span /><span /></div>}
    </div>;
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
      return emptyHub ? <ExpensesEmptyScreen /> : <ExpensesScreen />;
    case "expenses-empty":
      return emptyHub || !hasHubs ? (
        <ExpensesEmptyScreen />
      ) : (
        <ExpensesScreen />
      );
    case "settle":
      return !hasSettlement || !hasHubs ? (
        <SettleEvenScreen />
      ) : (
        <SettleScreen />
      );
    case "settle-even":
      return !hasSettlement || !hasHubs ? (
        <SettleEvenScreen />
      ) : (
        <SettleScreen />
      );
    case "recurring":
      return <RecurringScreen />;
    case "funds":
      return <FundsScreen />;
    case "templates":
      return <TemplatesScreen />;
    case "billing":
      return <BillingScreen />;
    case "analytics":
      return <AnalyticsScreen />;
    case "members":
      return <MembersScreen />;
    case "operations":
      return <OperationsScreen />;
    case "notes":
      return <NotesScreen />;
    case "activity":
      return <ActivityScreen />;
    case "settings":
      return <SettingsScreen />;
    default:
      return hasHubs ? <HomeScreen /> : <HomeEmptyScreen />;
  }
}
