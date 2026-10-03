import {
  useEffect,
  useId,
  useRef,
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
        if (!pending) onClose();
      }}
    >
      <button
        className="c-dialog-close"
        type="button"
        aria-label="Close dialog"
        disabled={pending}
        onClick={onClose}
      >
        <X size={18} />
      </button>
      <h2 id={titleId}>{title}</h2>
      {children}
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
