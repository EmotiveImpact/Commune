import { useCallback, useRef, useState } from "react";
import { X } from "lucide-react";
import type { ReminderResult, ReminderUsage } from "../live/model";
import { formatReminderDay, reminderFailureCopy, reminderToastCopy, reminderWord, type ReminderKind } from "../data/reminders";
import { newRequestId } from "../data/requestId";
// Dialog styles stay with the other money surfaces in screens/Money.css.
import { Button, useModalDialog } from "./components";
import { showToast } from "./Toast";
import "../screens/Money.css";

export type ReminderRequest = {
  kind: ReminderKind;
  /** Expense share id for a Nudge, fund pledge id for a Chase. */
  sourceId: string;
  recipientId: string;
  name: string;
  subject: string;
  amount: string;
  dueOn?: string | null;
};
type Phase = "ready" | "sending" | "error";

/**
 * The single Nudge/Chase interaction: preview, then explicit confirmation.
 * Nothing is sent until Send is pressed. Once the server has recorded it the
 * dialog goes, and the toast says what was recorded (no Undo: a reminder
 * someone may already have seen cannot be taken back).
 */
export function ReminderConfirm({ request, usage, phase, error, onClose, onSend }: {
  request: ReminderRequest; usage: ReminderUsage | null; phase: Phase;
  error: string; onClose: () => void; onSend: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useModalDialog(ref);
  const pending = phase === "sending";
  const word = reminderWord(request.kind);
  const remaining = usage ? Math.max(0, usage.totalLimit - usage.totalUsed) : null;
  const toRecipient = usage ? usage.recipientUsage[request.recipientId] ?? 0 : null;
  const blocked = remaining === 0 || (usage !== null && toRecipient !== null && toRecipient >= usage.recipientLimit);
  return <dialog ref={ref} data-leave="surface" className="c-reminder-dialog" aria-labelledby="reminder-title" aria-busy={pending}
    onCancel={event => { event.preventDefault(); if (!pending) onClose(); }}>
    <button className="c-reminder-close" type="button" aria-label="Close reminder" disabled={pending} onClick={onClose}><X size={18} /></button>
    <h2 id="reminder-title">A gentle reminder for {request.name}</h2>
    <p className="c-reminder-message">Remind {request.name} about {request.amount} outstanding for {request.subject}.</p>
    <dl className="c-reminder-facts">
      <div><dt>Reminder</dt><dd>{word} · {request.kind === "chase" ? "fund pledge" : "expense share"}</dd></div>
      <div><dt>Due</dt><dd>{request.dueOn ? formatReminderDay(request.dueOn) : "No due date"}</dd></div>
      {usage && <div><dt>To {request.name}</dt><dd>{toRecipient} of {usage.recipientLimit} in 30 days</dd></div>}
      {usage && <div><dt>Your allowance</dt><dd>{remaining} of {usage.totalLimit} left</dd></div>}
    </dl>
    <p className="c-reminder-help">This records one notification in Commune. Email depends on their preferences and the connected service. This {request.kind === "chase" ? "pledge" : "share"} then has a 72-hour cooldown.</p>
    {blocked && <p className="c-reminder-help" role="status">Your reminder allowance for this {remaining === 0 ? "period" : "person"} is used up, so this cannot be sent.</p>}
    {error && phase === "error" && <p className="a-form-error" role="alert">{error}</p>}
    <div className="a-field-row">
      <Button busy={pending} disabled={blocked} onClick={onSend}>{pending ? "Reminding…" : phase === "error" ? "Try again" : "Send reminder"}</Button>
      <button className="a-btn ghost" type="button" disabled={pending} onClick={onClose}>Cancel</button>
    </div>
  </dialog>;
}

/**
 * Owns one reminder decision: a request id is created when the preview opens
 * and reused on every retry, so the server records at most one reminder.
 */
export function useReminderFlow(send: (kind: ReminderKind, sourceId: string, requestId: string) => Promise<ReminderResult>) {
  const [request, setRequest] = useState<ReminderRequest | null>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [error, setError] = useState("");
  const requestId = useRef("");
  const busy = useRef(false);
  const open = useCallback((next: ReminderRequest) => {
    requestId.current = newRequestId();
    setError(""); setPhase("ready"); setRequest(next);
  }, []);
  const close = useCallback(() => { if (!busy.current) setRequest(null); }, []);
  /** Sends once; usage is the allowance as the preview showed it, before this one. */
  const confirm = useCallback(async (usage: ReminderUsage | null = null) => {
    if (!request || busy.current) return;
    busy.current = true;
    setPhase("sending"); setError("");
    try {
      const result = await send(request.kind, request.sourceId, requestId.current);
      busy.current = false;
      setPhase("ready");
      setRequest(null);
      showToast({ text: reminderToastCopy(request.kind, request.name, result, usage) });
    } catch (cause) {
      setError(reminderFailureCopy(cause).message);
      setPhase("error");
    } finally {
      busy.current = false;
    }
  }, [request, send]);
  return { request, phase, error, pending: phase === "sending", open, close, confirm };
}

/** Renders the dialog for a flow, wired to the shared allowance display. */
export function ReminderFlowDialog({ flow, usage }: { flow: ReturnType<typeof useReminderFlow>; usage: ReminderUsage | null }) {
  if (!flow.request) return null;
  return <ReminderConfirm request={flow.request} usage={usage} phase={flow.phase}
    error={flow.error} onClose={flow.close} onSend={() => void flow.confirm(usage)} />;
}
