import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
  type RefObject,
} from "react";
import { X } from "lucide-react";
import { cx } from "./cx";
import { leaveGhost } from "./motion";

/** Shared product primitives; these keep semantics and spacing in one place. */
export function Button({
  variant = "primary",
  className,
  type = "button",
  busy = false,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
  /** Its command is running: the label says so at full colour, and a second press does nothing. */
  busy?: boolean;
}) {
  return (
    <button
      type={type}
      className={cx("a-btn", variant === "secondary" && "ghost", className)}
      aria-busy={busy || undefined}
      disabled={disabled || busy}
      {...props}
    />
  );
}
export function Panel({
  children,
  className,
  label,
  id,
  tabIndex,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
  id?: string;
  tabIndex?: number;
}) {
  return (
    <section id={id} tabIndex={tabIndex} className={cx("a-panel", "c-panel", className)} aria-label={label}>
      {children}
    </section>
  );
}
export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="c-section-heading">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  // Native label wrapping also handles generated identifiers in reused forms.
  return (
    <div className="a-field">
      <label className="c-field-label">
        <span>{label}</span>
        {children}
      </label>
      {hint && <small>{hint}</small>}
    </div>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="a-empty">
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}
/**
 * Where keyboard focus can go back to when a dialog closes, nearest first. A
 * successful action can disable or remove its own trigger (a sent reminder,
 * a settled share), and focus must not fall to the page behind a window.
 */
export function focusScopes(opener: HTMLElement | null): Element[] {
  const scopes: Element[] = [];
  for (const selector of [".a-row-actions", ".c-panel", ".a-toolbar", ".a-panel", ".a-window"]) {
    const scope = opener?.closest(selector);
    if (scope && !scopes.includes(scope)) scopes.push(scope);
  }
  return scopes;
}
export function returnFocus(opener: HTMLElement | null, scopes: Element[]): void {
  if (opener?.isConnected && !opener.matches(":disabled")) { opener.focus(); return; }
  for (const scope of scopes) {
    if (!scope.isConnected) continue;
    const target = scope.querySelector<HTMLElement>("button:not(:disabled)");
    if (target) { target.focus(); return; }
  }
}

function focusLost(): boolean {
  const active = document.activeElement;
  return !active || active === document.body || !active.isConnected;
}
// Focus moves to a heading that holds it only until the next step away.
function focusHeading(heading: HTMLElement) {
  if (!heading.hasAttribute("tabindex")) {
    heading.tabIndex = -1;
    heading.addEventListener("blur", () => heading.removeAttribute("tabindex"), { once: true });
  }
  heading.focus({ preventScroll: true });
}

/**
 * Where focus goes when a dialog closes (gate 5): back to the button that
 * opened it; if that button's row has gone, to the action in the row that
 * took its place, or the one before; with no rows left, to the list's
 * heading. Rows are marked data-row. A row can leave a moment after the
 * dialog does, when the commune's records arrive, so this looks again then.
 */
export function focusAfterClose(opener: HTMLElement | null): () => void {
  const scopes = focusScopes(opener);
  const row = opener?.closest<HTMLElement>("[data-row]") ?? null;
  const list = row?.parentElement ?? null;
  const rowsOf = (parent: Element) => [...parent.children].filter((child) => child.matches("[data-row]") && !child.hasAttribute("data-motion-ghost"));
  const index = row && list ? rowsOf(list).indexOf(row) : -1;
  const heading = (row ?? opener)?.closest("section")?.querySelector<HTMLElement>("h2, h3") ?? null;
  const settle = () => {
    if (opener?.isConnected && !opener.matches(":disabled")) { opener.focus({ preventScroll: true }); return; }
    if (row && list?.isConnected) {
      const rows = rowsOf(list);
      for (const candidate of [rows[index], rows[index - 1]]) {
        const action = candidate?.querySelector<HTMLElement>(".a-row-actions button:not(:disabled), button:not(:disabled)");
        if (action) { action.focus({ preventScroll: true }); return; }
      }
      if (heading?.isConnected) { focusHeading(heading); return; }
    }
    returnFocus(opener, scopes);
    if (focusLost() && heading?.isConnected) focusHeading(heading);
    // The whole view changed under it (all square, say): its first heading.
    const first = focusLost() ? document.querySelector<HTMLElement>("#main-content h2") ?? document.querySelector<HTMLElement>(".a-header-title h1") : null;
    if (first) focusHeading(first);
  };
  return () => {
    settle();
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => { if (focusLost()) settle(); });
    // The page may be gone by then (a test that has finished, say).
    window.setTimeout(() => { if (typeof document !== "undefined" && focusLost()) settle(); }, 400);
  };
}

/**
 * A native modal's life: open at once, with its top edge pinned where it
 * first sits (so an error grows it downwards instead of re-centring it); on a
 * phone it is a sheet on the bottom edge and grows upwards. When it closes it
 * plays its exit as a copy while focus goes back at once.
 */
export function useModalDialog(ref: RefObject<HTMLDialogElement | null>) {
  useLayoutEffect(() => {
    const dialog = ref.current;
    const back = focusAfterClose(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    if (!dialog) return undefined;
    if (!dialog.open) dialog.showModal();
    pinTop(dialog);
    return () => {
      leaveGhost(dialog, { backdrop: true });
      dialog.style.marginTop = "";
      dialog.close();
      back();
    };
  }, [ref]);
}

/**
 * Placed inside something that leaves by being removed with its parent (a
 * window, the phone menu): when it goes, the parent's exit plays as a copy.
 */
export function LeaveWithParent({ backdrop = false }: { backdrop?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const parent = ref.current?.parentElement;
    return () => { if (parent) leaveGhost(parent, { backdrop }); };
  }, [backdrop]);
  return <i ref={ref} hidden />;
}

const SHEET_BELOW = "(max-width: 599px)";
function pinTop(dialog: HTMLDialogElement) {
  if (typeof window.matchMedia !== "function" || window.matchMedia(SHEET_BELOW).matches) return;
  // The margin it is laid out with, without the rise it is entering on.
  const top = Number.parseFloat(getComputedStyle(dialog).marginTop);
  if (Number.isFinite(top) && top > 0) dialog.style.marginTop = `${Math.round(top)}px`;
}

export function Dialog({
  title,
  children,
  pending = false,
  onClose,
  className,
}: {
  title: string;
  children: ReactNode;
  pending?: boolean;
  onClose: () => void;
  className?: string;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const typed = useTypedText();
  const [asking, setAsking] = useState(false);
  // Escape and the close button ask first when typed text would be lost.
  function dismiss() {
    if (pending) return;
    if (typed.hasTyped()) setAsking(true);
    else onClose();
  }
  useModalDialog(ref);
  return (
    <dialog
      ref={ref}
      data-leave="surface"
      className={cx("c-product-dialog", className)}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        // After repeated Escapes with nothing in between, Chrome closes the
        // dialog whatever the page asks. Follow it: a question opened now would
        // sit unseen inside the closed dialog and block the page.
        if (!event.cancelable) onClose();
        else dismiss();
      }}
      onInput={typed.onInput}
    >
      <button
        className="c-dialog-close"
        type="button"
        aria-label="Close dialog"
        disabled={pending}
        onClick={dismiss}
      >
        <X size={18} />
      </button>
      <h2 id={titleId}>{title}</h2>
      {children}
      {asking ? <DiscardQuestion onDiscard={() => { setAsking(false); onClose(); }} onKeep={() => setAsking(false)} /> : null}
    </dialog>
  );
}
export function Feedback({
  error,
  message,
}: {
  error?: string;
  message?: string;
}) {
  return (
    <>
      {error && (
        <p className="a-form-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="a-window-note" role="status">
          {message}
        </p>
      )}
    </>
  );
}

const TEXT_FIELD = 'input:not([type="search"], [type="checkbox"], [type="radio"], [type="file"], [type="hidden"], [type="button"], [type="submit"], [type="reset"], [type="range"], [type="color"]), textarea';

/**
 * The text fields someone typed in, so a window or dialog can ask before it
 * closes over text that would be lost. A field that has gone, is locked or
 * has been emptied again does not count.
 */
export function useTypedText() {
  const fields = useRef(new Set<HTMLInputElement | HTMLTextAreaElement>());
  const onInput = useCallback((event: { target: EventTarget }) => {
    const field = event.target;
    if ((field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) && field.matches(TEXT_FIELD)) fields.current.add(field);
  }, []);
  const hasTyped = useCallback(() => [...fields.current].some((field) =>
    field.isConnected && !field.disabled && !field.readOnly && field.value.trim() !== ""), []);
  return { onInput, hasTyped };
}

/** Asked before a window or dialog closes over typed text. */
export function DiscardQuestion({ onDiscard, onKeep }: { onDiscard: () => void; onKeep: () => void }) {
  const titleId = useId();
  const textId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current;
    dialog?.showModal();
    // The safe choice is the one Enter takes.
    keepRef.current?.focus();
    return () => {
      if (dialog) leaveGhost(dialog, { backdrop: true });
      dialog?.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      data-leave="surface"
      className="c-product-dialog c-discard-dialog"
      aria-labelledby={titleId}
      aria-describedby={textId}
      onCancel={(event) => {
        // Escape keeps editing, and stays with this question.
        event.preventDefault();
        event.stopPropagation();
        onKeep();
      }}
    >
      <h2 id={titleId}>Discard your changes?</h2>
      <p id={textId}>What you typed here hasn’t been saved.</p>
      <div className="a-field-row">
        <button className="a-btn danger" type="button" onClick={onDiscard}>Discard</button>
        <button ref={keepRef} className="a-btn ghost" type="button" onClick={onKeep}>Keep editing</button>
      </div>
    </dialog>
  );
}

/**
 * A form's error and the field it is about. That field is marked invalid,
 * points at the message and takes focus, so a keyboard or screen reader user
 * lands where the fix is needed. A field id with no element names a place,
 * like an expense's split: the message shown there takes focus. An error about
 * no field takes focus itself only if focus would otherwise be lost.
 */
export function useFormError() {
  const messageId = useId();
  const [error, setState] = useState<{ message: string; field?: string }>({ message: "" });
  const moveFocus = useRef(false);
  useEffect(() => {
    if (!moveFocus.current || !error.message) return;
    moveFocus.current = false;
    const field = error.field ? document.getElementById(error.field) : null;
    if (field) { field.focus(); return; }
    const active = document.activeElement;
    if (error.field || !active || active === document.body || active.matches(":disabled")) document.getElementById(messageId)?.focus();
  }, [error, messageId]);
  const setError = useCallback((message: string, field?: string) => {
    moveFocus.current = Boolean(message);
    setState({ message, field });
  }, []);
  /** For a field: invalid and described by the message while it is about it. */
  const invalid = (field: string, describedBy?: string) => {
    const about = Boolean(error.message) && error.field === field;
    const ids = [describedBy, about ? messageId : ""].filter(Boolean).join(" ");
    return { "aria-invalid": about || undefined, "aria-describedby": ids || undefined };
  };
  const messageProps = { id: messageId, tabIndex: -1 };
  /** The message where it belongs: under its field, or, with no field, in the form's own place. */
  const message = (field?: string) => error.message && error.field === field
    ? <p className="a-form-error" role="alert" {...messageProps}>{error.message}</p>
    : null;
  return { error: error.message, setError, invalid, message, messageProps };
}
