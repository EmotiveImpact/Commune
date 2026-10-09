import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { cx } from "./cx";

/** Shared product primitives; these keep semantics and spacing in one place. */
export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
}) {
  return (
    <button
      type={type}
      className={cx("a-btn", variant === "secondary" && "ghost", className)}
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
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const scopes = focusScopes(opener);
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      returnFocus(opener, scopes);
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={cx("c-product-dialog", className)}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
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
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current;
    dialog?.showModal();
    // The safe choice is the one Enter takes.
    keepRef.current?.focus();
    return () => {
      dialog?.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
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
