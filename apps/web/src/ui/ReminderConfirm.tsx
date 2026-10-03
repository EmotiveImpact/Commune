import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { ReminderResult, ReminderUsage } from "../live/model";
import { formatReminderDay, reminderFailureCopy, reminderResultCopy, reminderWord, type ReminderKind } from "../data/reminders";
import { newRequestId } from "../data/requestId";
// Dialog styles stay with the other money surfaces in screens/Money.css.
import { focusScopes, returnFocus } from "./components";
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
type Phase = "ready" | "sending" | "sent" | "error";

/**
 * The single Nudge/Chase interaction: preview, explicit confirmation, then the
 * result the server reported. Nothing is sent until Send is pressed.
 */
export function ReminderConfirm({ request, usage, phase, result, error, onClose, onSend }: {
  request: ReminderRequest; usage: ReminderUsage | null; phase: Phase;
  result: ReminderResult | null; error: string; onClose: () => void; onSend: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    // A sent reminder disables its own trigger (cooldown). Fall back to the
    // next action in the same row or panel so keyboard focus is not lost.
    const scopes = focusScopes(opener);
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      returnFocus(opener, scopes);
    };
  }, []);
  useEffect(() => { if (phase === "sent") doneRef.current?.focus(); }, [phase]);
  const pending = phase === "sending";
  const word = reminderWord(request.kind);
  const remaining = usage ? Math.max(0, usage.totalLimit - usage.totalUsed) : null;
  const toRecipient = usage ? usage.recipientUsage[request.recipientId] ?? 0 : null;
  const blocked = remaining === 0 || (usage !== null && toRecipient !== null && toRecipient >= usage.recipientLimit);
  return <dialog ref={ref} className="c-reminder-dialog" aria-labelledby="reminder-title" aria-busy={pending}
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
    {phase === "sent" && result
      ? <p className="c-reminder-result" role="status">{reminderResultCopy(request.kind, request.name, result)}</p>
      : <p className="c-reminder-help">This records one notification in Commune. Email depends on their preferences and the connected service. This {request.kind === "chase" ? "pledge" : "share"} then has a 72-hour cooldown.</p>}
    {phase !== "sent" && blocked && <p className="c-reminder-help" role="status">Your reminder allowance for this {remaining === 0 ? "period" : "person"} is used up, so this cannot be sent.</p>}
    {error && phase === "error" && <p className="a-form-error" role="alert">{error}</p>}
    <div className="a-field-row">
      {phase === "sent"
        ? <button ref={doneRef} className="a-btn" type="button" onClick={onClose}>Done</button>
        : <><button className="a-btn" type="button" disabled={pending || blocked} onClick={onSend}>{pending ? "Sending…" : phase === "error" ? "Try again" : "Send reminder"}</button>
          <button className="a-btn ghost" type="button" disabled={pending} onClick={onClose}>Cancel</button></>}
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
  const [result, setResult] = useState<ReminderResult | null>(null);
  const [error, setError] = useState("");
  const requestId = useRef("");
  const busy = useRef(false);
  const open = useCallback((next: ReminderRequest) => {
    requestId.current = newRequestId();
    setError(""); setResult(null); setPhase("ready"); setRequest(next);
  }, []);
  const close = useCallback(() => { if (!busy.current) setRequest(null); }, []);
  const confirm = useCallback(async () => {
    if (!request || busy.current) return;
    busy.current = true;
    setPhase("sending"); setError("");
    try {
      setResult(await send(request.kind, request.sourceId, requestId.current));
      setPhase("sent");
    } catch (cause) {
      setError(reminderFailureCopy(cause).message);
      setPhase("error");
    } finally {
      busy.current = false;
    }
  }, [request, send]);
  return { request, phase, result, error, pending: phase === "sending", open, close, confirm };
}

/** Renders the dialog for a flow, wired to the shared allowance display. */
export function ReminderFlowDialog({ flow, usage }: { flow: ReturnType<typeof useReminderFlow>; usage: ReminderUsage | null }) {
  if (!flow.request) return null;
  return <ReminderConfirm request={flow.request} usage={usage} phase={flow.phase} result={flow.result}
    error={flow.error} onClose={flow.close} onSend={() => void flow.confirm()} />;
}
