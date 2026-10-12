import { useId, useRef, useState, type FormEvent } from "react";
import { useApp } from "../state";
import { money, type CurrencyCode, type PaymentReport, type Receipt, type Share } from "../live/model";
import { moneyInputError, parseMoneyInput } from "../data/moneyInput";
import { todayIso } from "../data/operations";
import { newRequestId } from "../data/requestId";
import { commandFailure, UNCERTAIN_RETRY_SAFE } from "../data/commands";
import { formatReminderDay, formatTimestampDay } from "../data/reminders";
import { LIMITS } from "../data/limits";
import { Button, Dialog, Feedback, Field, useFormError } from "./components";
import { firstWord, showToast, type Toast } from "./Toast";
import { PayeeLinks } from "./PayLinks";

export const RECEIPT_REFERENCE_MAX = 80;
// communeId names the commune the share is in, when that may not be the open
// one (Home acts on every commune's payments); it is read again afterwards.
export type ReceiptTarget = {
  shareId: string; debtorName: string; expenseName: string;
  shareMinor: number; outstandingMinor: number; currency: CurrencyCode; communeId?: string;
  /** The expense, so the line that confirms it can offer View. */
  expenseId?: string;
};
export type ReversalTarget = {
  receipt: Receipt; debtorName: string; expenseName: string; currency: CurrencyCode;
};
export type PaymentReportTarget = {
  shareId: string; payerName: string; expenseName: string;
  outstandingMinor: number; currency: CurrencyCode; communeId?: string;
  /** The bill payer, so their pay links can be shown. */
  payerId?: string;
};
export type ReportAnswerTarget = {
  report: PaymentReport; debtorName: string; expenseName: string; currency: CurrencyCode;
  decision: "confirm" | "decline"; communeId?: string;
  expenseId?: string;
};

/** The share's open "I've sent it" report, if any. */
export function pendingReport(share: Share): PaymentReport | undefined {
  return share.paymentReports?.find(report => report.status === "pending");
}

/** One line describing a report, for whichever side is reading it. */
export function reportSummary(report: PaymentReport, currency: CurrencyCode, reporter: string): string {
  return `${reporter} sent ${money(report.amountMinor, currency)} on ${formatReminderDay(report.sentOn)}${report.reference ? ` · ${report.reference}` : ""}`;
}

/** "Jordan's", or "James'" for a name ending in s. */
export function possessive(name: string): string {
  const first = firstWord(name);
  return /s$/i.test(first) ? `${first}’` : `${first}’s`;
}

/** The line once a repayment is recorded as received. No Undo: a confirmed payment is reversed from its history, with a reason. */
export function confirmedCopy(debtorName: string, amount: string, stillOutstanding: string | null): string {
  return `Confirmed. ${possessive(debtorName)} ${amount} is recorded as received.${stillOutstanding ? ` ${stillOutstanding} still outstanding.` : ""}`;
}

function useFieldIds() {
  const base = useId();
  return { amount: `${base}amount`, date: `${base}date`, reference: `${base}reference` };
}

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
  target: ReceiptTarget; onClose: () => void; onRecorded: (toast: Toast) => void;
}) {
  const { recordShareReceipt } = useApp();
  const [amount, setAmount] = useState((target.outstandingMinor / 100).toFixed(2));
  const [receivedOn, setReceivedOn] = useState(todayIso());
  const [reference, setReference] = useState("");
  const [pending, setPending] = useState(false);
  // An error about a field sits under it, is linked to it and takes focus.
  const { setError, invalid, message } = useFormError();
  const ids = useFieldIds();
  // After an unconfirmed attempt the fields lock, so a retry is the exact same
  // repayment and the server can recognise it instead of recording another.
  const [uncertain, setUncertain] = useState(false);
  // One id for this decision: every retry of this dialog reuses it.
  const requestId = useRef(newRequestId());
  const minor = parseMoneyInput(amount, target.currency);
  const after = minor !== null && minor <= target.outstandingMinor ? target.outstandingMinor - minor : null;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (minor === null) { setError(moneyInputError(amount, target.currency, "Enter the amount received, for example 25.00."), ids.amount); return; }
    if (minor > target.outstandingMinor) { setError(`Only ${money(target.outstandingMinor, target.currency)} is still outstanding on this share.`, ids.amount); return; }
    if (!receivedOn || receivedOn > todayIso()) { setError("Enter the date the money was received, not a future date.", ids.date); return; }
    if (unsafeReference(reference)) { setError("Leave out card or account numbers. A short note such as “bank transfer” is enough.", ids.reference); return; }
    setPending(true); setError("");
    try {
      const result = await recordShareReceipt(target.shareId, { amountMinor: minor, receivedOn, reference, requestId: requestId.current }, target.communeId);
      onRecorded({ text: result.duplicate
        ? `This repayment was already recorded. ${money(result.outstandingMinor, target.currency)} is outstanding from ${firstWord(target.debtorName)}.`
        : confirmedCopy(target.debtorName, money(minor, target.currency), result.outstandingMinor > 0 ? money(result.outstandingMinor, target.currency) : null) });
    } catch (cause) {
      const failure = commandFailure(cause, "Could not record the repayment.");
      if (!failure.rejected) setUncertain(true);
      // Once an attempt may have saved, a later refusal does not mean nothing was.
      setError(!failure.rejected ? UNCERTAIN_RETRY_SAFE
        : uncertain || /already used for a different/i.test(failure.message)
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
        <input id={ids.amount} type="text" inputMode="decimal" maxLength={LIMITS.money} value={amount} disabled={pending || uncertain} required
          onChange={event => setAmount(event.target.value)} {...invalid(ids.amount)} />
      </Field>
      {message(ids.amount)}
      <Field label="Date received">
        <input id={ids.date} type="date" value={receivedOn} max={todayIso()} disabled={pending || uncertain} required
          onChange={event => setReceivedOn(event.target.value)} {...invalid(ids.date)} />
      </Field>
      {message(ids.date)}
      <Field label="Reference (optional)" hint="Everyone in this commune can see it. Leave out card or account numbers.">
        <input id={ids.reference} type="text" maxLength={RECEIPT_REFERENCE_MAX} value={reference} disabled={pending || uncertain} placeholder="e.g. Bank transfer"
          onChange={event => setReference(event.target.value)} {...invalid(ids.reference)} />
      </Field>
      {message(ids.reference)}
      <p className="c-receipt-outcome" role="status">
        {after === null ? "Enter an amount up to what is outstanding."
          : after > 0 ? `After this entry: ${money(after, target.currency)} still outstanding.`
            : "After this entry: this share is settled."}
      </p>
      {message()}
      <div className="a-field-row">
        <Button type="submit" busy={pending}>{pending ? "Recording…" : `Record ${minor !== null && minor <= target.outstandingMinor ? money(minor, target.currency) : "repayment"} received`}</Button>
        <Button variant="secondary" disabled={pending} onClick={onClose}>Cancel</Button>
      </div>
      <p className="c-receipt-note">This records money you received outside Commune. It does not move money or send an email.</p>
    </form>
  </Dialog>;
}

/**
 * The member who owes says they have paid outside Commune. It is a claim the
 * bill payer answers; it never changes a balance by itself.
 */
export function ReportPaymentDialog({ target, onClose, onReported }: {
  target: PaymentReportTarget; onClose: () => void; onReported: (toast: Toast) => void;
}) {
  const { reportSharePayment } = useApp();
  const [amount, setAmount] = useState((target.outstandingMinor / 100).toFixed(2));
  const [sentOn, setSentOn] = useState(todayIso());
  const [reference, setReference] = useState("");
  const [pending, setPending] = useState(false);
  const { setError, invalid, message } = useFormError();
  const ids = useFieldIds();
  const [uncertain, setUncertain] = useState(false);
  const requestId = useRef(newRequestId());
  const minor = parseMoneyInput(amount, target.currency);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (minor === null) { setError(moneyInputError(amount, target.currency, "Enter the amount you sent, for example 25.00."), ids.amount); return; }
    if (minor > target.outstandingMinor) { setError(`Only ${money(target.outstandingMinor, target.currency)} is still outstanding on this share.`, ids.amount); return; }
    if (!sentOn || sentOn > todayIso()) { setError("Enter the date you sent the money, not a future date.", ids.date); return; }
    if (unsafeReference(reference)) { setError("Leave out card or account numbers. A short note such as “bank transfer” is enough.", ids.reference); return; }
    setPending(true); setError("");
    try {
      const result = await reportSharePayment(target.shareId, { amountMinor: minor, sentOn, reference, requestId: requestId.current }, target.communeId);
      // Recorded, and they know: the line names who confirms it next.
      onReported({ text: result.duplicate
        ? `Already recorded. ${firstWord(target.payerName)} will confirm your ${money(minor, target.currency)}.`
        : `Recorded. ${firstWord(target.payerName)} will confirm your ${money(minor, target.currency)}.` });
    } catch (cause) {
      const failure = commandFailure(cause, "Could not report the payment.");
      if (!failure.rejected) setUncertain(true);
      // Once an attempt may have saved, a later refusal does not mean nothing was.
      setError(!failure.rejected ? UNCERTAIN_RETRY_SAFE
        : uncertain || /already used for a different/i.test(failure.message)
          ? "An earlier attempt may already have been reported. Close this and check the expense before trying again."
          : `${failure.message.replace(/\.$/, "")}. Nothing was reported.`);
    } finally {
      setPending(false);
    }
  }

  return <Dialog title={`Tell ${target.payerName} you’ve paid`} pending={pending} onClose={onClose} className="c-receipt-dialog">
    <form onSubmit={event => void save(event)}>
      <p className="c-receipt-context">{target.expenseName} · {money(target.outstandingMinor, target.currency)} outstanding</p>
      {target.payerId ? <PayeeLinks userId={target.payerId} communeId={target.communeId} name={target.payerName}
        amountMinor={target.outstandingMinor} currency={target.currency} note={target.expenseName} /> : null}
      <Field label={`Amount sent (${target.currency})`} hint="Change this if you paid part of it.">
        <input id={ids.amount} type="text" inputMode="decimal" maxLength={LIMITS.money} value={amount} disabled={pending || uncertain} required
          onChange={event => setAmount(event.target.value)} {...invalid(ids.amount)} />
      </Field>
      {message(ids.amount)}
      <Field label="Date sent">
        <input id={ids.date} type="date" value={sentOn} max={todayIso()} disabled={pending || uncertain} required
          onChange={event => setSentOn(event.target.value)} {...invalid(ids.date)} />
      </Field>
      {message(ids.date)}
      <Field label="Reference (optional)" hint="Everyone in this commune can see it. Leave out card or account numbers.">
        <input id={ids.reference} type="text" maxLength={RECEIPT_REFERENCE_MAX} value={reference} disabled={pending || uncertain} placeholder="e.g. Bank transfer"
          onChange={event => setReference(event.target.value)} {...invalid(ids.reference)} />
      </Field>
      {message(ids.reference)}
      {message()}
      <div className="a-field-row">
        <Button type="submit" busy={pending}>{pending ? "Recording…" : `Tell ${target.payerName}`}</Button>
        <Button variant="secondary" disabled={pending} onClick={onClose}>Cancel</Button>
      </div>
      <p className="c-receipt-note">This tells {target.payerName} in Commune. It does not move money, and your share stays open until they confirm they received it.</p>
    </form>
  </Dialog>;
}

/** The bill payer answers a report: confirm it as received, or say why not. */
export function AnswerReportDialog({ target, onClose, onAnswered }: {
  target: ReportAnswerTarget; onClose: () => void; onAnswered: (toast: Toast) => void;
}) {
  const { resolvePaymentReport } = useApp();
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(newRequestId());
  const amount = money(target.report.amountMinor, target.currency);
  const confirming = target.decision === "confirm";

  async function save(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!confirming && note.trim().length < 3) { setError(`Say briefly why, so ${target.debtorName} knows what to check.`); return; }
    setPending(true); setError("");
    try {
      const result = await resolvePaymentReport(target.report.id, confirming
        ? { decision: "confirm", requestId: requestId.current } : { decision: "decline", note }, target.communeId);
      onAnswered({ text: confirming
        ? confirmedCopy(target.debtorName, amount, result.outstandingMinor > 0 ? money(result.outstandingMinor, target.currency) : null)
        : `${firstWord(target.debtorName)} has been told the ${amount} has not arrived. Nothing was recorded.` });
    } catch (cause) {
      const failure = commandFailure(cause, "Could not answer the report.");
      setError(failure.rejected ? `${failure.message.replace(/\.$/, "")}. Nothing was changed.` : UNCERTAIN_RETRY_SAFE);
    } finally {
      setPending(false);
    }
  }

  return <Dialog title={confirming ? `Confirm ${amount} received?` : "Not received yet?"} pending={pending} onClose={onClose} className="c-receipt-dialog">
    <form onSubmit={event => void save(event)}>
      <p className="c-receipt-context">{reportSummary(target.report, target.currency, target.debtorName)} · {target.expenseName}</p>
      {confirming
        ? <p className="c-receipt-note">This records {amount} as received from {target.debtorName}, dated {formatReminderDay(target.report.sentOn)}. If the amount is different, choose Not received and record what arrived instead.</p>
        : <Field label="What should they check?">
          <textarea rows={3} maxLength={240} value={note} disabled={pending} required placeholder="e.g. Nothing has arrived in my account yet"
            onChange={event => setNote(event.target.value)} />
        </Field>}
      <Feedback error={error} />
      <div className="a-field-row">
        <Button type="submit" busy={pending}>{pending ? confirming ? "Confirming…" : "Recording…" : confirming ? `Confirm ${possessive(target.debtorName)} ${amount}` : "Send"}</Button>
        <Button variant="secondary" disabled={pending} onClick={onClose}>Cancel</Button>
      </div>
      <p className="c-receipt-note">{target.debtorName} is told in Commune. No money moves.</p>
    </form>
  </Dialog>;
}

/** Reversing keeps the original entry and adds who, when and why. */
export function ReverseReceiptDialog({ target, onClose, onReversed }: {
  target: ReversalTarget; onClose: () => void; onReversed: (toast: Toast) => void;
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
      onReversed({ text: `${amount} repayment reversed. ${money(result.outstandingMinor, target.currency)} is outstanding from ${firstWord(target.debtorName)}. The original entry stays in the history.` });
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
        <Button type="submit" className="danger" busy={pending}>{pending ? "Reversing…" : "Reverse repayment"}</Button>
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

/**
 * A pending report, shown on the share for both sides: the reporter can take
 * it back; the bill payer confirms it or says it has not arrived.
 */
export function PendingReport({ share, currency, viewerId, payerId, names, onAnswer, onWithdraw, disabled }: {
  share: Share; currency: CurrencyCode; viewerId: string | undefined; payerId: string;
  names: (userId: string) => string; disabled?: boolean;
  onAnswer: (report: PaymentReport, decision: "confirm" | "decline") => void;
  onWithdraw: (report: PaymentReport) => void;
}) {
  const report = pendingReport(share);
  if (!report) return null;
  const mine = report.reportedBy === viewerId;
  return <div className="c-pending-report" role="note">
    <p>{mine
      ? `You said you sent ${money(report.amountMinor, currency)} on ${formatReminderDay(report.sentOn)}${report.reference ? ` · ${report.reference}` : ""}. Waiting for ${names(payerId)} to confirm.`
      : `${reportSummary(report, currency, names(report.reportedBy))}. Not yet confirmed.`}</p>
    <div className="a-row-actions">
      {viewerId === payerId && <>
        <Button disabled={disabled} onClick={() => onAnswer(report, "confirm")}>Confirm {money(report.amountMinor, currency)} received{" "}<span className="c-visually-hidden">from {names(report.reportedBy)}</span></Button>
        <Button variant="secondary" disabled={disabled} onClick={() => onAnswer(report, "decline")}>Not received{" "}<span className="c-visually-hidden">from {names(report.reportedBy)}</span></Button>
      </>}
      {mine && <Button variant="secondary" disabled={disabled} onClick={() => onWithdraw(report)}>Withdraw</Button>}
    </div>
  </div>;
}

/** The last answer to the viewer's own report, while their share is open. */
export function LatestReportAnswer({ share, currency, viewerId, names }: {
  share: Share; currency: CurrencyCode; viewerId: string | undefined; names: (userId: string) => string;
}) {
  const latest = share.paymentReports?.[0];
  if (!latest || latest.reportedBy !== viewerId || latest.status !== "declined") return null;
  return <p className="c-report-answer">{names(latest.resolvedBy ?? "")} has not received the {money(latest.amountMinor, currency)} you reported: {latest.note}</p>;
}

/**
 * One place to open the receipt and report dialogs from any screen. What was
 * recorded is said in the toast; onError gets what could not be done, to show
 * beside the list it is about. View opens the expense, unless the dialogs
 * were opened from that expense (view: false).
 */
export function useReceiptActions(onError: (message: string) => void, options: { view?: boolean } = {}) {
  const { withdrawPaymentReport, go } = useApp();
  const offerView = options.view !== false;
  const done = (toast: Toast, expenseId?: string, communeId?: string) => {
    onError("");
    showToast(offerView && expenseId
      ? { ...toast, action: { label: "View", run: () => go("expense", { expense: expenseId, hub: communeId }) } }
      : toast);
  };
  const [recording, setRecording] = useState<ReceiptTarget | null>(null);
  const [reversing, setReversing] = useState<ReversalTarget | null>(null);
  const [reporting, setReporting] = useState<PaymentReportTarget | null>(null);
  const [answering, setAnswering] = useState<ReportAnswerTarget | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  async function withdraw(report: PaymentReport) {
    if (withdrawing) return;
    setWithdrawing(true);
    try {
      await withdrawPaymentReport(report.id);
      done({ text: "Report withdrawn. Nothing was recorded." });
    } catch (cause) {
      const failure = commandFailure(cause, "Could not withdraw the report.");
      // Withdrawing is idempotent on the report itself, so a retry is safe.
      onError(failure.rejected ? `${failure.message.replace(/\.$/, "")}.` : UNCERTAIN_RETRY_SAFE);
    } finally {
      setWithdrawing(false);
    }
  }
  const dialogs = <>
    {reporting && <ReportPaymentDialog key={reporting.shareId} target={reporting} onClose={() => setReporting(null)}
      onReported={toast => { setReporting(null); done(toast); }} />}
    {answering && <AnswerReportDialog key={`${answering.report.id}-${answering.decision}`} target={answering} onClose={() => setAnswering(null)}
      onAnswered={toast => { setAnswering(null); done(toast, answering.decision === "confirm" ? answering.expenseId : undefined, answering.communeId); }} />}
    {recording && <RecordReceiptDialog key={recording.shareId} target={recording} onClose={() => setRecording(null)}
      onRecorded={toast => { setRecording(null); done(toast, recording.expenseId, recording.communeId); }} />}
    {reversing && <ReverseReceiptDialog key={reversing.receipt.id} target={reversing} onClose={() => setReversing(null)}
      onReversed={toast => { setReversing(null); done(toast); }} />}
  </>;
  return {
    record: setRecording, reverse: setReversing, report: setReporting, answer: setAnswering, withdraw, dialogs,
    busy: recording !== null || reversing !== null || reporting !== null || answering !== null || withdrawing,
  };
}
