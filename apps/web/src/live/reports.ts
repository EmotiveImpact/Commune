import { api, ApiError } from "./api";
import { currentViewer } from "./session";
import { routePattern } from "../nav";

// Error reports and sampled speed figures, so failures on real phones are
// found without anyone having to complain. Only a signed-in person's are
// sent, and the database keeps them for 30 days where no client can read
// them (migration 0038). A report names its page as a pattern such as
// /expenses/:id and carries nothing anyone typed into Commune: record ids,
// queries and email addresses are taken out here and again by the database.

declare const __COMMUNE_RELEASE__: string | undefined;
/** The build that sent a report: its commit when Vercel built it (vite.config.ts). */
export const RELEASE = typeof __COMMUNE_RELEASE__ === "string" ? __COMMUNE_RELEASE__ : "local";

export type BrowserFamily = "chrome" | "edge" | "firefox" | "safari" | "samsung" | "other";

export function browserFamily(agent: string): BrowserFamily {
  // Most browsers also name the ones they are built on, so the most
  // specific name comes first.
  if (/SamsungBrowser\//.test(agent)) return "samsung";
  if (/Edg(e|A|iOS)?\//.test(agent)) return "edge";
  if (/OPR\/|Opera|YaBrowser\//.test(agent)) return "other";
  if (/Firefox\/|FxiOS\//.test(agent)) return "firefox";
  if (/Chrome\/|CriOS\//.test(agent)) return "chrome";
  if (/Safari\//.test(agent)) return "safari";
  return "other";
}

/** Text as it is sent: no site name, record id, email address, or a link's query or fragment. */
export function reportText(text: string): string {
  return text
    .replace(/https?:\/\/[^/\s)]+/g, "")
    .replace(/(\/[^\s?#)]*)[?#][^\s):]*/g, "$1")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g, "[email]");
}

function described(error: unknown): { message: string; stack: string | null } {
  if (!(error instanceof Error)) return { message: reportText(String(error)).slice(0, 300) || "Error", stack: null };
  // The frames only: V8 starts a stack with the message, which is sent apart.
  const frames = (error.stack ?? "").split("\n").filter((line) => /^\s*at |@/.test(line)).slice(0, 10);
  return {
    message: reportText(`${error.name}: ${error.message}`).slice(0, 300),
    stack: reportText(frames.join("\n")).slice(0, 2000) || null,
  };
}

async function send(report: Record<string, unknown>, keepalive = false): Promise<void> {
  try {
    if (!currentViewer()) return;
    await api("/client-reports", {
      method: "POST", keepalive,
      body: JSON.stringify({ ...report, release: RELEASE, browser: browserFamily(navigator.userAgent) }),
    });
  } catch {
    // A report that cannot be sent is dropped. It never becomes an error of its own.
  }
}

const reported = new Set<string>();

/** Reports an error, each one once a page load and at most ten. Never throws. */
export function reportError(error: unknown): void {
  try {
    if (!currentViewer() || reported.size >= 10) return;
    const { message, stack } = described(error);
    const route = routePattern(window.location.pathname);
    if (reported.has(`${route} ${message}`)) return;
    reported.add(`${route} ${message}`);
    void send({ kind: "error", route, message, stack });
  } catch {
    // As above.
  }
}

// A refused or failed request is shown where it was made, and a dropped
// connection is not a fault in Commune.
function unexpected(reason: unknown): boolean {
  if (!(reason instanceof Error) || reason instanceof ApiError) return false;
  if (reason.name === "AbortError" || reason.name === "TimeoutError") return false;
  return !(reason instanceof TypeError && /fetch|network|load failed/i.test(reason.message));
}

/** Errors no error boundary sees: in event handlers, timers and promises. */
export function watchErrors(target: Window = window): () => void {
  const onError = (event: ErrorEvent) => { if (event.error) reportError(event.error); };
  const onRejection = (event: PromiseRejectionEvent) => { if (unexpected(event.reason)) reportError(event.reason); };
  target.addEventListener("error", onError);
  target.addEventListener("unhandledrejection", onRejection);
  return () => {
    target.removeEventListener("error", onError);
    target.removeEventListener("unhandledrejection", onRejection);
  };
}

type Shift = PerformanceEntry & { value: number; hadRecentInput: boolean };
type Interaction = PerformanceEntry & { interactionId?: number };

/**
 * About one page load in ten measures how quickly the page drew its main
 * content (largest contentful paint), the slowest response to a tap or key
 * (interaction to next paint) and how much the layout jumped (cumulative
 * layout shift), with the browser's own PerformanceObserver, and reports
 * them when the page is first hidden.
 */
export function watchSpeed(random: () => number = Math.random): void {
  try {
    if (typeof PerformanceObserver === "undefined" || document.visibilityState === "hidden" || random() >= 0.1) return;
    const supported = PerformanceObserver.supportedEntryTypes ?? [];
    const route = routePattern(window.location.pathname);
    const observe = (type: string, read: (entries: PerformanceEntryList) => void, options: Record<string, unknown> = {}) => {
      if (!supported.includes(type)) return false;
      new PerformanceObserver((list) => read(list.getEntries())).observe({ type, buffered: true, ...options } as PerformanceObserverInit);
      return true;
    };
    let paint: number | null = null;
    observe("largest-contentful-paint", (entries) => { paint = entries.at(-1)?.startTime ?? paint; });
    // Shifts less than a second apart, within five seconds, make one burst;
    // the score is the worst burst.
    let shift: number | null = null;
    let burst = 0, burstStart = 0, burstLast = 0;
    if (observe("layout-shift", (entries) => {
      for (const entry of entries as Shift[]) {
        if (entry.hadRecentInput) continue;
        if (burst && entry.startTime - burstLast < 1000 && entry.startTime - burstStart < 5000) burst += entry.value;
        else { burst = entry.value; burstStart = entry.startTime; }
        burstLast = entry.startTime;
        shift = Math.max(shift ?? 0, burst);
      }
    })) shift = 0;
    const interactions = new Map<number, number>();
    observe("event", (entries) => {
      for (const entry of entries as Interaction[]) {
        if (entry.interactionId) interactions.set(entry.interactionId, Math.max(interactions.get(entry.interactionId) ?? 0, entry.duration));
      }
    }, { durationThreshold: 40 });
    const hidden = () => {
      if (document.visibilityState !== "hidden") return;
      document.removeEventListener("visibilitychange", hidden);
      // The slowest interaction, passing over one in every fifty as a fluke.
      const slowest = [...interactions.values()].sort((a, b) => b - a);
      const response = slowest.length ? slowest[Math.min(slowest.length - 1, Math.floor(slowest.length / 50))] : null;
      if (paint === null && response === null && shift === null) return;
      void send({
        kind: "speed", route,
        lcpMs: paint === null ? null : Math.round(paint),
        inpMs: response === null ? null : Math.round(response),
        cls: shift === null ? null : Math.round(shift * 10000) / 10000,
      }, true);
    };
    document.addEventListener("visibilitychange", hidden);
  } catch {
    // A browser that cannot measure is not measured.
  }
}
