import { useRef, useState, type FormEvent } from "react";
import { useApp } from "../state";
import { money, type CurrencyCode, type Receipt, type Share } from "../live/model";
import { parseMoneyInput } from "../data/moneyInput";
import { todayIso } from "../data/operations";
import { newRequestId } from "../data/requestId";
import { commandFailure, UNCERTAIN_RETRY_SAFE } from "../data/commands";
import { formatReminderDay, formatTimestampDay } from "../data/reminders";
import { LIMITS } from "../data/limits";
import { Button, Dialog, Feedback, Field } from "./components";

export const RECEIPT_REFERENCE_MAX = 80;
export type ReceiptTarget = {
  shareId: string; debtorName: string; expenseName: string;
  shareMinor: number; outstandingMinor: number; currency: CurrencyCode;
};
export type ReversalTarget = {
  receipt: Receipt; debtorName: string; expenseName: string; currency: CurrencyCode;
};

/** The server applies the same rule; this only saves a round trip. */
export function unsafeReference(value: string): boolean {
  return /\d{8,}/.test(value.replace(/\s/g, ""));
}

/**
 * The payer records money received outside Commune against one share. The
 * amount defaults to everything outstanding, so a full confirmation is one
 * decision, and a smaller amount records a partial repayment.
 */
export function RecordReceiptDialog({ target, onClose, onRecorded }: {
  target: ReceiptTarget; onClose: () => void; onRecorded: (message: string) => void;
}) {
  const { recordShareReceipt } = useApp();
  const [amount, setAmount] = useState((target.outstandingMinor / 100).toFixed(2));
  const [receivedOn, setReceivedOn] = useState(todayIso());
  const [reference, setReference] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  // After an unconfirmed attempt the fields lock, so a retry is the exact same
  // repayment and the server can recognise it instead of recording another.
  const [uncertain, setUncertain] = useState(false);
  // One id for this decision: every retry of this dialog reuses it.
  const requestId = useRef(newRequestId());
  const minor = parseMoneyInput(amount);
  const after = minor !== null && minor <= target.outstandingMinor ? target.outstandingMinor - minor : null;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (minor === null) { setError("Enter the amount received, for example 25.00."); return; }
    if (minor > target.outstandingMinor) { setError(`Only ${money(target.outstandingMinor, target.currency)} is still outstanding on this share.`); return; }
    if (!receivedOn || receivedOn > todayIso()) { setError("Enter the date the money was received, not a future date."); return; }
    if (unsafeReference(reference)) { setError("Leave out card or account numbers. A short note such as “bank transfer” is enough."); return; }
    setPending(true); setError("");
    try {
      const result = await recordShareReceipt(target.shareId, { amountMinor: minor, receivedOn, reference, requestId: requestId.current });
      onRecorded(result.duplicate
        ? `This repayment was already recorded. ${money(result.outstandingMinor, target.currency)} is outstanding from ${target.debtorName}.`
        : result.outstandingMinor > 0
          ? `${money(minor, target.currency)} recorded as received from ${target.debtorName}. ${money(result.outstandingMinor, target.currency)} still outstanding. No payment was taken by Commune.`
          : `${money(minor, target.currency)} recorded as received from ${target.debtorName}. Their share is settled. No payment was taken by Commune.`);
    } catch (cause) {
      const failure = commandFailure(cause, "Could not record the repayment.");
      if (!failure.rejected) setUncertain(true);
      setError(!failure.rejected ? UNCERTAIN_RETRY_SAFE
        : /already used for a different/i.test(failure.message)
          ? "An earlier attempt may already have been recorded. Close this and check the repayment history before trying again."
          : `${failure.message.replace(/\.$/, "")}. Nothing was recorded.`);
    } finally {
      setPending(false);
    }
  }

  return <Dialog title={`Record a repayment from ${target.debtorName}`} pending={pending} onClose={onClose} className="c-receipt-dialog">
    <form onSubmit={event => void save(event)}>
      <p className="c-receipt-context">{target.expenseName} · {money(target.shareMinor, target.currency)} share · {money(target.outstandingMinor, target.currency)} outstanding</p>
      <Field label={`Amount received (${target.currency})`} hint="Change this to record part of the share.">
        <input type="text" inputMode="decimal" maxLength={LIMITS.money} value={amount} disabled={pending || uncertain} required
          onChange={event => setAmount(event.target.value)} />
      </Field>
      <Field label="Date received">
        <input type="date" value={receivedOn} max={todayIso()} disabled={pending || uncertain} required
          onChange={event => setReceivedOn(event.target.value)} />
      </Field>
      <Field label="Reference (optional)" hint="Everyone in this commune can see it. Leave out card or account numbers.">
        <input type="text" maxLength={RECEIPT_REFERENCE_MAX} value={reference} disabled={pending || uncertain} placeholder="e.g. Bank transfer"
          onChange={event => setReference(event.target.value)} />
      </Field>
      <p className="c-receipt-outcome" role="status">
        {after === null ? "Enter an amount up to what is outstanding."
          : after > 0 ? `After this entry: ${money(after, target.currency)} still outstanding.`
            : "After this entry: this share is settled."}
      </p>
      <Feedback error={error} />
      <div className="a-field-row">
        <Button type="submit" disabled={pending}>{pending ? "Recording…" : `Record ${minor !== null && minor <= target.outstandingMinor ? money(minor, target.currency) : "repayment"} received`}</Button>
        <Button variant="secondary" disabled={pending} onClick={onClose}>Cancel</Button>
      </div>
      <p className="c-receipt-note">This records money you received outside Commune. It does not move money or send an email.</p>
    </form>
  </Dialog>;
}

/** Reversing keeps the original entry and adds who, when and why. */
export function ReverseReceiptDialog({ target, onClose, onReversed }: {
  target: ReversalTarget; onClose: () => void; onReversed: (message: string) => void;
}) {
  const { reverseShareReceipt } = useApp();
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const amount = money(target.receipt.amountMinor, target.currency);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (reason.trim().length < 3) { setError("Give a short reason so everyone can understand the change."); return; }
    setPending(true); setError("");
    try {
      const result = await reverseShareReceipt(target.receipt.id, reason.trim());
      onReversed(`${amount} repayment reversed. ${money(result.outstandingMinor, target.currency)} is outstanding from ${target.debtorName}. The original entry stays in the history.`);
    } catch (cause) {
      const failure = commandFailure(cause, "Could not reverse the repayment.");
      // Reversal is idempotent on the receipt itself, so a retry is safe.
      setError(failure.rejected ? `${failure.message.replace(/\.$/, "")}. Nothing was changed.` : UNCERTAIN_RETRY_SAFE);
    } finally {
      setPending(false);
    }
  }

  return <Dialog title="Reverse this repayment?" pending={pending} onClose={onClose} className="c-receipt-dialog">
    <form onSubmit={event => void save(event)}>
      <p className="c-receipt-context">{amount} from {target.debtorName} · {target.expenseName} · received {formatReminderDay(target.receipt.receivedOn)}{target.receipt.reference ? ` · ${target.receipt.reference}` : ""}</p>
      <p className="c-receipt-note">The original entry stays in the history, marked as reversed. {target.debtorName}’s outstanding amount goes up by {amount} and they are told in Commune. No money moves.</p>
      <Field label="Reason for the reversal">
        <textarea rows={3} maxLength={240} value={reason} disabled={pending} required placeholder="e.g. The transfer bounced"
          onChange={event => setReason(event.target.value)} />
      </Field>
      <Feedback error={error} />
      <div className="a-field-row">
        <Button type="submit" className="danger" disabled={pending}>{pending ? "Reversing…" : "Reverse repayment"}</Button>
        <Button variant="secondary" disabled={pending} onClick={onClose}>Keep it</Button>
      </div>
    </form>
  </Dialog>;
}

/** Every entry for one share, newest first. Reversed entries stay listed. */
export function ReceiptHistory({ share, currency, names, onReverse, disabled, open }: {
  share: Share; currency: CurrencyCode; names: (userId: string) => string;
  onReverse?: (receipt: Receipt) => void; disabled?: boolean; open?: boolean;
}) {
  const receipts = share.receipts ?? [];
  if (!receipts.length) return null;
  const active = receipts.filter(item => !item.reversedAt);
  return <details className="c-contribution-history c-receipt-history" open={open}>
    <summary>{money(share.settledMinor, currency)} received · {active.length} {active.length === 1 ? "repayment" : "repayments"}{receipts.length > active.length ? ` · ${receipts.length - active.length} reversed` : ""}</summary>
    {receipts.map(entry => <div key={entry.id} className={entry.reversedAt ? "is-reversed" : undefined}>
      <span>
        <strong>{money(entry.amountMinor, currency)}</strong> · received {formatReminderDay(entry.receivedOn)}
        {entry.reference ? ` · ${entry.reference}` : ""}
        {entry.origin === "migrated" ? " · confirmed before repayment history" : ` · recorded by ${names(entry.recordedBy)}`}
        {entry.reversedAt ? <em> · Reversed by {names(entry.reversedBy ?? "")} on {formatTimestampDay(entry.reversedAt)}: {entry.reversalReason}</em> : null}
      </span>
      {onReverse && !entry.reversedAt && <Button variant="secondary" disabled={disabled} onClick={() => onReverse(entry)}>Reverse</Button>}
    </div>)}
  </details>;
}

/** One place to open the two receipt dialogs from any screen. */
export function useReceiptActions(onDone: (message: string) => void) {
  const [recording, setRecording] = useState<ReceiptTarget | null>(null);
  const [reversing, setReversing] = useState<ReversalTarget | null>(null);
  const dialogs = <>
    {recording && <RecordReceiptDialog key={recording.shareId} target={recording} onClose={() => setRecording(null)}
      onRecorded={message => { setRecording(null); onDone(message); }} />}
    {reversing && <ReverseReceiptDialog key={reversing.receipt.id} target={reversing} onClose={() => setReversing(null)}
      onReversed={message => { setReversing(null); onDone(message); }} />}
  </>;
  return { record: setRecording, reverse: setReversing, dialogs, busy: recording !== null || reversing !== null };
}
