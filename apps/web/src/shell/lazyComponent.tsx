import { lazy, useState, type ComponentType } from "react";

export type LazyComponent<P extends object> = ComponentType<P> & {
  /** Starts loading the code now, so it is ready when it is first drawn. */
  preload: () => Promise<unknown>;
};

// Every component made here, so that preloadAll can find the code still to come.
const everyComponent = new Set<{ preload: () => Promise<unknown> }>();

// A browser keeps a failed import() failed for the life of the page, so code
// that could not load (a release replaced it, or the connection dropped) only
// loads again with a fresh page. Reload once; if that was moments ago, let the
// error reach the recovery card rather than loading the page over and over.
const RELOADED_AT = "commune.codeReloadedAt";
function reloadForCode(): boolean {
  try {
    if (Date.now() - Number(sessionStorage.getItem(RELOADED_AT) ?? 0) < 30_000) return false;
    sessionStorage.setItem(RELOADED_AT, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/**
 * A component whose code loads when it is first drawn, or earlier through
 * preload(). The nearest Suspense fallback shows while it loads; once the
 * code is here, it draws straight away.
 */
export function lazyComponent<P extends object>(load: () => Promise<ComponentType<P>>): LazyComponent<P> {
  let loaded: ComponentType<P> | null = null;
  let loading: Promise<ComponentType<P>> | null = null;
  const preload = () => (loading ??= load().then((component) => (loaded = component)));
  const Lazy = lazy(() => preload().then(
    (component) => ({ default: component }),
    (error: unknown) => {
      // Stay on the loading state until the page reloads.
      if (reloadForCode()) return new Promise<never>(() => {});
      throw error;
    },
  ));
  function LazyComponent(props: P) {
    // Chosen once for each use, so it never swaps underneath its own state.
    const [Component] = useState<ComponentType<P>>(() => loaded ?? Lazy);
    return <Component {...props} />;
  }
  const component = Object.assign(LazyComponent, { preload });
  everyComponent.add(component);
  return component;
}

/**
 * Loads the code of every component made here so far, and of the components
 * that code makes in turn (the signed-in app brings its own screens).
 */
export async function preloadAll(): Promise<void> {
  const started = new Set<{ preload: () => Promise<unknown> }>();
  for (;;) {
    const next = [...everyComponent].filter((component) => !started.has(component));
    if (!next.length) return;
    for (const component of next) started.add(component);
    await Promise.all(next.map((component) => component.preload()));
  }
}

/**
 * Loads the code still to come once the browser has nothing else to do,
 * unless the browser asks to save data. Returns a cancel for an effect.
 */
export function preloadWhenIdle(): () => void {
  if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return () => {};
  // A failure here is left for the first real use, which can reload the page.
  const run = () => { preloadAll().catch(() => {}); };
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(run, { timeout: 5000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(run, 2000);
  return () => window.clearTimeout(id);
}
