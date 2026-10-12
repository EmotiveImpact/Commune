import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cx } from "./cx";
import { motionMs } from "./motion";

/**
 * One line near the thumb for every recording act (design panel, 11 October
 * 2026): it names what was recorded and who now knows. It replaces the line
 * at the top of Settle, the nudge's result page and add expense's silence.
 * Errors stay beside the form they are about.
 */
export type ToastAction = {
  label: string;
  run: () => void | Promise<void>;
  /** Undo keeps the line for 9 seconds, and takes focus when the act removed the control that had it. */
  undo?: boolean;
  /** What the action button is called while its own command runs. */
  busyLabel?: string;
};
export type Toast = { text: string; action?: ToastAction };
type Shown = Toast & { id: number };

/** How long a line stays: 6 seconds, or 9 with Undo. Hover or focus holds it. */
export const TOAST_MS = 6000;
export const TOAST_UNDO_MS = 9000;

let current: Shown | null = null;
let nextId = 1;
const listeners = new Set<() => void>();
function emit() { for (const listener of listeners) listener(); }

export function showToast(toast: Toast): void {
  current = { ...toast, id: nextId++ };
  emit();
}
export function hideToast(): void {
  if (!current) return;
  current = null;
  emit();
}
/** The line on screen now, for tests and for the host. */
export function currentToast(): Toast | null {
  return current;
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** "Sam", "Sam and Alex", "Sam, Alex and Jordan", or "Sam, Alex, Jordan and 2 others". */
export function namesInWords(names: string[], most = 3): string {
  if (names.length > most + 1) return `${names.slice(0, most).join(", ")} and ${names.length - most} others`;
  if (names.length < 2) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}
export const firstWord = (name: string) => name.trim().split(/\s+/)[0] || name;

/**
 * Where the line appears: 16px above the tab bar on a phone, at the bottom
 * left of the content beside the sidebar. It rises 16px and fades in over the
 * medium time, and fades out over the short one. role="status" is always
 * there, so each new line is announced.
 */
export function ToastHost() {
  const toast = useSyncExternalStore(subscribe, () => current, () => null);
  const [leaving, setLeaving] = useState<Shown | null>(null);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const held = useRef(false);
  const shownRef = useRef<Shown | null>(null);

  // A new line replaces the last at once; one that is closing fades out.
  useEffect(() => {
    const previous = shownRef.current;
    shownRef.current = toast;
    const out = motionMs("short");
    if (!toast && previous && out) {
      setLeaving(previous);
      const done = window.setTimeout(() => setLeaving(null), out);
      return () => window.clearTimeout(done);
    }
    setLeaving(null);
    return undefined;
  }, [toast]);

  // Off the page, the line goes with it.
  useEffect(() => () => { window.clearTimeout(timer.current); hideToast(); }, []);

  useEffect(() => {
    window.clearTimeout(timer.current);
    held.current = false;
    setBusy(false);
    if (!toast) return;
    const element = box.current;
    // When the act took away the control that had focus, Undo takes it, where
    // the keyboard can reach it in time.
    const active = document.activeElement;
    if (toast.action?.undo && element && (!active || active === document.body || !active.isConnected)) {
      element.querySelector<HTMLElement>(".c-toast-action")?.focus();
    }
    held.current = Boolean(element && (element.contains(document.activeElement) || element.matches(":hover")));
    arm(toast);
    return () => window.clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  function arm(shown: Shown) {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (held.current || current?.id !== shown.id) return;
      const hadFocus = box.current?.contains(document.activeElement);
      hideToast();
      if (hadFocus) document.querySelector<HTMLElement>(".a-header-title h1, #main-content")?.focus({ preventScroll: true });
    }, shown.action?.undo ? TOAST_UNDO_MS : TOAST_MS);
  }
  function hold(on: boolean) {
    held.current = on;
    if (!on && toast) arm(toast);
  }
  async function act(shown: Shown) {
    if (!shown.action || busy) return;
    setBusy(true);
    try {
      await shown.action.run();
    } finally {
      setBusy(false);
      // The action's own result replaces this line; otherwise it has done its job.
      if (current?.id === shown.id) hideToast();
    }
  }

  const shown = toast ?? leaving;
  return (
    <div className="c-toast-region" role="status">
      {shown ? (
        <div
          ref={box}
          key={shown.id}
          className={cx("c-toast", !toast && "is-leaving")}
          onPointerEnter={() => hold(true)}
          onPointerLeave={() => hold(Boolean(box.current?.contains(document.activeElement)))}
          onFocus={() => hold(true)}
          onBlur={(event) => { if (!box.current?.contains(event.relatedTarget as Node | null)) hold(Boolean(box.current?.matches(":hover"))); }}
        >
          <span className="c-toast-text">{shown.text}</span>
          {shown.action ? (
            <button type="button" className="c-toast-action" aria-busy={busy || undefined} disabled={busy || !toast}
              onClick={() => void act(shown)}>
              {busy ? shown.action.busyLabel ?? shown.action.label : shown.action.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
