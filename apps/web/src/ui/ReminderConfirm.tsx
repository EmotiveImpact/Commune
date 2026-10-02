import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/** The preview does not send anything until the user confirms. */
export function ReminderConfirm({ name, subject, amount, remaining, pending, error, onClose, onSend }: {
  name: string; subject: string; amount: string; remaining: number | null;
  pending: boolean; error: string; onClose: () => void; onSend: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); opener?.isConnected && opener.focus(); };
  }, []);
  return <dialog ref={ref} className="c-reminder-dialog" aria-labelledby="reminder-title" onCancel={event => { event.preventDefault(); if (!pending) onClose(); }}>
    <button className="c-reminder-close" type="button" aria-label="Close reminder" disabled={pending} onClick={onClose}><X size={18} /></button>
    <h2 id="reminder-title">A gentle reminder for {name}</h2>
    <p className="c-reminder-message">Remind {name} about {amount} outstanding for {subject}.</p>
    <p className="c-reminder-help">This sends a notification in Commune. Email delivery depends on their email preferences and the connected service.</p>
    {remaining !== null && <p className="c-reminder-help">{remaining} reminders left in your allowance. Each share has a 72-hour cooldown.</p>}
    {error && <p className="a-form-error" role="alert">{error}</p>}
    <div className="a-field-row"><button className="a-btn" disabled={pending || remaining === 0} onClick={onSend}>{pending ? "Sending…" : "Send reminder"}</button><button className="a-btn ghost" disabled={pending} onClick={onClose}>Cancel</button></div>
  </dialog>;
}
