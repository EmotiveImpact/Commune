import { Suspense, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { Link, Redirect, Route, Switch, useLocation, useSearch } from "wouter";
import { LoginPage } from "./auth/Login";
import { SignupPage, VerifyEmailPage } from "./auth/Signup";
import { ForgotPasswordPage, ResetPasswordPage } from "./auth/ForgotPassword";
import { InvitePage, OnboardPage } from "./auth/InviteOnboard";
import { PrivacyPage, TermsPage } from "./legal/LegalPages";
import { useApp } from "./state";
import { forgetReturn, keepSearch, readAddress, readReturn, rememberReturn } from "./nav";
import { AuthLayout } from "./auth/AuthLayout";
import { PendingShell } from "./shell/PendingShell";
import { ConnectionRecovery } from "./shell/ConnectionRecovery";
import { lazyComponent } from "./shell/lazyComponent";
import { usePageTitle } from "./shell/pageTitle";

// The signed-in app, so that the sign-in pages do not download every screen.
const ProductShell = lazyComponent(() => import("./shell/ProductShell").then((m) => m.ProductShell));

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
  const known = Boolean(readAddress(path).screen);
  // Fetched while the session is checked; until it arrives, the same
  // loading page stays up.
  useEffect(() => { if (known) ProductShell.preload().catch(() => {}); }, [known]);
  // An address Commune does not have needs no sign-in to say so.
  if (!known) return <><PageTitle title="Page not found" /><NotFoundPage /></>;
  return <AuthenticatedOnly><Suspense fallback={<AppLoading />}><ProductShell /></Suspense></AuthenticatedOnly>;
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
        <Link href={keepSearch("/")} className="commune-auth-btn">Go to Home</Link>
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
