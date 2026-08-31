import type { ReactNode } from "react";
import { Redirect, Route, Switch } from "wouter";
import { LoginPage } from "./auth/Login";
import { SignupPage } from "./auth/Signup";
import { ForgotPasswordPage } from "./auth/ForgotPassword";
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
  OperationsScreen,
  TemplatesScreen,
} from "./screens/House";
import { SettingsScreen } from "./screens/Settings";
import { Windows } from "./windows/Windows";
import { cx } from "./ui/cx";
import type { ScreenId } from "./data/household";

export function App() {
  return (
    <Switch>
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
      <Route path="/forgot-password">
        <GuestOnly>
          <ForgotPasswordPage />
        </GuestOnly>
      </Route>
      <Route path="/invite" component={InvitePage} />
      <Route path="/onboard" component={OnboardPage} />
      <Route>
        <ProtectedApp />
      </Route>
    </Switch>
  );
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { session } = useApp();
  if (session) return <Redirect to="/" />;
  return children;
}

function ProtectedApp() {
  const { session } = useApp();
  if (!session) return <Redirect to="/login" />;
  return <ProductShell />;
}

function ProductShell() {
  const { screen, navMode, moreOpen, native, window: win } = useApp();
  return (
    <div
      className={cx(
        "a-body",
        navMode === "advanced" ? "nav-advanced" : "nav-basic",
        moreOpen && "more-open",
        native && "is-native",
        win && "has-window",
      )}
    >
      <div className="a-app">
        <Sidebar screen={screen} />
        <div className="a-main">
          <Header screen={screen} />
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

function Screen({ screen }: { screen: ScreenId }) {
  switch (screen) {
    case "home":
      return <HomeScreen />;
    case "home-empty":
      return <HomeEmptyScreen />;
    case "home-inbox":
      return <HomeScreen />;
    case "communes":
      return <PlacesScreen />;
    case "hub":
      return <HubScreen />;
    case "hub-empty":
      return <HubEmptyScreen />;
    case "expenses":
      return <ExpensesScreen />;
    case "expenses-empty":
      return <ExpensesEmptyScreen />;
    case "settle":
      return <SettleScreen />;
    case "settle-even":
      return <SettleEvenScreen />;
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
      return <HomeScreen />;
  }
}