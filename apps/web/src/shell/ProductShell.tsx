import { Suspense, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { diagnosticsEnabled } from "../live/diagnostics";
import { useApp } from "../state";
import { Header, MoreSheet, PhoneTabs, Sidebar } from "./Shell";
import { HomeEmptyScreen, HomeScreen, PlacesScreen } from "../screens/Home";
import { HubEmptyScreen, HubScreen } from "../screens/Hub";
import { ExpensesEmptyScreen, ExpensesScreen, SettleEvenScreen, SettleScreen } from "../screens/Money";
import { Windows } from "../windows/Windows";
import { cx } from "../ui/cx";
import { PAGE_TITLES, type ScreenId } from "../data/household";
import { COMMUNE_SCREENS } from "../nav";
import { RecoveryBoundary, ScreenRecovery } from "./Recovery";
import { isConnectionFailure } from "../live/connection";
import { lazyComponent, preloadWhenIdle } from "./lazyComponent";
import { usePageTitle } from "./pageTitle";

// The signed-in app. App draws it only for someone signed in, and starts
// fetching it while the session is checked on one of its addresses (never on
// the sign-in pages). Home, Hub, Expenses and Settle (the phone's four tabs)
// come with it; the other screens load when first opened, or earlier once the
// browser is idle.
const FundsScreen = lazyComponent(() => import("../screens/Funds").then((m) => m.FundsScreen));
const RecurringScreen = lazyComponent(() => import("../screens/Recurring").then((m) => m.RecurringScreen));
const TemplatesScreen = lazyComponent(() => import("../screens/Templates").then((m) => m.TemplatesScreen));
const MembersScreen = lazyComponent(() => import("../screens/Members").then((m) => m.MembersScreen));
const NotesScreen = lazyComponent(() => import("../screens/Notes").then((m) => m.NotesScreen));
const OperationsScreen = lazyComponent(() => import("../screens/Operations").then((m) => m.OperationsScreen));
const ActivityScreen = lazyComponent(() => import("../screens/House").then((m) => m.ActivityScreen));
const AllActivityScreen = lazyComponent(() => import("../screens/Search").then((m) => m.AllActivityScreen));
const SearchScreen = lazyComponent(() => import("../screens/Search").then((m) => m.SearchScreen));
const SettingsScreen = lazyComponent(() => import("../screens/Settings").then((m) => m.SettingsScreen));
const CommuneSettingsScreen = lazyComponent(() => import("../screens/Settings").then((m) => m.CommuneSettingsScreen));

export function ProductShell() {
  const { screen, navMode, moreOpen, native, dark, window: win, notes, noteKey, apiError, clearApiError, contentError, hub, refresh, searchTarget, unknownCommune } = useApp();
  const noteReader = screen === "notes" && win === "note" && Boolean(notes[noteKey]);
  const modalOpen = Boolean(win) && !noteReader;
  usePageFocus(screen, hub.id, Boolean(win) || Boolean(searchTarget));
  // The screens and windows still to come load once the browser is idle, so
  // they open at once later.
  useEffect(() => preloadWhenIdle(), []);
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
      const { inspectMembershipRead } = await import("../live/neon");
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
      <Suspense fallback={<ContentSkeleton label="Loading this page" />}>
        <ScreenBody screen={screen} />
      </Suspense>
    </section>
  );
}

// The page's own skeleton, while its records load or a screen's code arrives.
function ContentSkeleton({ label, children }: { label: string; children?: ReactNode }) {
  return <div className="c-content-skeleton" role="status" aria-label={label} aria-busy="true"><span className="c-visually-hidden">{label}</span>{children}<div className="c-skeleton-grid" aria-hidden="true"><div /><div /><div /><div /></div></div>;
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
    return <ContentSkeleton label="Loading shared records">{screen === "hub" && <div className="c-skeleton-identity" style={hub.photo ? { backgroundImage: `linear-gradient(0deg, rgba(26,30,43,.8), rgba(26,30,43,.1)), url("${hub.photo}")` } : undefined}><h2>{hub.name}</h2><p>{hub.switchMeta}</p></div>}</ContentSkeleton>;
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
