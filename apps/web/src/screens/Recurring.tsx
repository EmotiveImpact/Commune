import { useRef, useState, type FormEvent } from "react";
import { Plus, Repeat2 } from "lucide-react";
import { useApp, type RecurringBillInput } from "../state";
import { useSearchRecord } from "../ui/useSearchRecord";
import {
  allocateExpense,
  type SplitMethod,
} from "@commune/core";
import { type RecurringBill, money, dateLabel } from "../live/model";
import {
  Button,
  Dialog,
  EmptyState,
  Feedback,
  Field,
  Panel,
  SectionHeading,
} from "../ui/components";
import { Pill } from "../ui/widgets";
import { CalendarDate } from "../ui/CalendarDate";
import { SplitEditor } from "../ui/SplitEditor";
import { moneyInputError, parseMoneyInput } from "../data/moneyInput";
import { LIMITS } from "../data/limits";
import { todayIso } from "../data/operations";
import {
  canSkipNextPeriod,
  departureNotices,
  mergeRecurringEdits,
  recordedMessage,
  recurringActions,
  recurringChanges,
  recurringDepartures,
  recurringEditorFields,
  resumeBlockedNotice,
  sameRecurringFields,
  scaleRecurringShares,
  skippedMessage,
  type RecurringEditorFields,
} from "../data/recurring";
import { formatReminderDay } from "../data/reminders";
import { commandFailure, UNCERTAIN_RETRY_SAFE } from "../data/commands";
import { newRequestId } from "../data/requestId";
import "./Money.css";

/** A name for anyone a bill mentions, including people who have left. */
function useMemberName() {
  const { personName } = useApp();
  return (userId: string) => personName(userId, "A former member");
}

/** Record one period as paid: the usual amount, or what was actually paid. */
function RecordPeriodDialog({ bill, pending, error, onRecord, onClose }: {
  bill: RecurringBill; pending: boolean; error: string;
  onRecord: (amountMinor: number) => void; onClose: () => void;
}) {
  const { hub, personName } = useApp();
  const [amount, setAmount] = useState((bill.amountMinor / 100).toFixed(2));
  const [validation, setValidation] = useState("");
  const minor = parseMoneyInput(amount, hub.currency);
  const different = minor !== null && minor !== bill.amountMinor;
  const preview = different && minor ? scaleRecurringShares(bill.allocations, minor) : [];
  const name = (userId: string) => personName(userId, "Former member", { left: true });
  return (
    <Dialog title={`Record ${bill.title} as paid?`} pending={pending} onClose={onClose}>
      <form onSubmit={(event) => {
        event.preventDefault();
        if (!minor) { setValidation(moneyInputError(amount, hub.currency, "Enter the amount paid, for example 55.00.")); return; }
        setValidation("");
        onRecord(minor);
      }}>
        <p>Record the bill for {dateLabel(bill.nextDueOn)} only if it has actually been paid. This creates the member shares and advances the schedule once.</p>
        <Field label={`Amount paid this time (${hub.currency})`} hint={`Usually ${money(bill.amountMinor, hub.currency)}. Change it if this bill came in different.`}>
          <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" maxLength={LIMITS.money} disabled={pending} required />
        </Field>
        {preview.length ? (
          <div className="c-period-split" role="status">
            <p className="c-form-help">The usual split, scaled to {money(minor!, hub.currency)}:</p>
            <ul>{preview.map((share) => <li key={share.userId}><span>{name(share.userId)}</span><span>{money(share.amountMinor, hub.currency)}</span></li>)}</ul>
          </div>
        ) : null}
        <p className="c-form-help">Commune does not charge a card or move money.</p>
        <Feedback error={validation || error} />
        <div className="a-field-row">
          <Button type="submit" disabled={pending}>{pending ? "Recording…" : `Record ${minor ? money(minor, hub.currency) : "bill"} paid`}</Button>
          <Button variant="secondary" disabled={pending} onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Skip one period with a reason. Nothing is charged to anyone for it. */
function SkipPeriodDialog({ bill, pending, error, onSkip, onClose }: {
  bill: RecurringBill; pending: boolean; error: string;
  onSkip: (reason: string) => void; onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [validation, setValidation] = useState("");
  return (
    <Dialog title={`Skip ${bill.title} for ${dateLabel(bill.nextDueOn)}?`} pending={pending} onClose={onClose}>
      <form onSubmit={(event) => {
        event.preventDefault();
        if (reason.trim().length < 3) { setValidation("Say briefly why, so everyone knows."); return; }
        setValidation("");
        onSkip(reason);
      }}>
        <p>No expense is created for this period and nobody is charged. The schedule moves on to the next one.</p>
        <Field label="Why is it skipped?">
          <textarea rows={3} maxLength={240} value={reason} onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Away for the month, nothing to pay" disabled={pending} required />
        </Field>
        <Feedback error={validation || error} />
        <div className="a-field-row">
          <Button type="submit" disabled={pending}>{pending ? "Skipping…" : "Skip this period"}</Button>
          <Button variant="secondary" disabled={pending} onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Dialog>
  );
}

/** The latest periods of one bill, newest first. */
function PeriodHistory({ bill }: { bill: RecurringBill }) {
  const { hub, go, personName } = useApp();
  const history = bill.history ?? [];
  if (!history.length) return null;
  const name = (userId: string | null) => personName(userId, "a former member");
  return (
    <details className="c-contribution-history c-period-history">
      <summary>{history.length === 1 ? "1 period" : `${history.length} recent periods`}</summary>
      {history.map((period) => (
        <div key={period.dueOn}>
          <span>
            <strong>{formatReminderDay(period.dueOn)}</strong>
            {period.status === "skipped"
              ? ` · skipped by ${name(period.actorId)}: ${period.note}`
              : ` · ${money(period.amountMinor ?? 0, hub.currency)} recorded${period.amountMinor !== bill.amountMinor ? ` (usually ${money(bill.amountMinor, hub.currency)})` : ""}${period.actorId ? ` by ${name(period.actorId)}` : ""}`}
          </span>
          {period.expenseId ? <Button variant="secondary" onClick={() => go("expense", { expense: period.expenseId! })}>Open</Button> : null}
        </div>
      ))}
    </details>
  );
}

/** How a save ended: refused outright, refused because the bill had moved
 * on (409), or with no reply, so it may have gone through. */
type SaveOutcome = "saved" | "refused" | "conflict" | "unknown";

/**
 * Add a bill, or edit one from the version it was opened at. People who have
 * left are taken out of the split when it opens, and the editor says so. If
 * someone else changes the bill meanwhile, nothing is saved until the person
 * has looked at the newer version.
 */
function RecurringEditor({
  bill,
  resuming,
  pending,
  error,
  onClearError,
  onSave,
  onSaved,
  onClose,
}: {
  bill?: RecurringBill;
  resuming: boolean;
  pending: boolean;
  error: string;
  onClearError: () => void;
  onSave: (input: RecurringBillInput) => Promise<SaveOutcome>;
  onSaved: () => void;
  onClose: () => void;
}) {
  const { hub, session } = useApp();
  const name = useMemberName();
  const activeIds = new Set(hub.members.map((member) => member.userId));
  const [initial] = useState<RecurringEditorFields>(() => bill
    ? recurringEditorFields(bill, activeIds)
    : {
      title: "", amount: "", payer: session!.userId, frequency: "monthly", date: todayIso(),
      included: hub.members.map((member) => member.userId), method: "Equal", values: {},
    });
  const [notices] = useState(() => bill ? departureNotices(recurringDepartures(bill, activeIds), name) : []);
  // The version this form is based on; an edit is sent against it.
  const [base, setBase] = useState(() => bill ? { version: bill.version, bill } : null);
  const [title, setTitle] = useState(initial.title);
  const [amount, setAmount] = useState(initial.amount);
  const [payer, setPayer] = useState(initial.payer);
  const [frequency, setFrequency] = useState(initial.frequency);
  const [date, setDate] = useState(initial.date);
  const [included, setIncluded] = useState(initial.included);
  const [method, setMethod] = useState<SplitMethod>(initial.method);
  const [values, setValues] = useState(initial.values);
  const [validation, setValidation] = useState("");
  // One add per open form: a retry sends the same request id.
  const requestId = useRef(newRequestId());
  const sent = useRef<RecurringBillInput | null>(null);
  // A save from this form that got no reply may have gone through. A later
  // outright refusal settles that; a conflict does not, as that earlier save
  // may be what moved the bill on.
  const [unconfirmed, setUnconfirmed] = useState(false);
  const conflict = !!bill && !!base && bill.version !== base.version;
  // A newer version that is exactly what this form sent is this person's own
  // save whose reply was lost.
  const ownSave = conflict && !!sent.current && sameRecurringFields(bill!, sent.current);

  function load(fields: RecurringEditorFields) {
    setTitle(fields.title); setAmount(fields.amount); setPayer(fields.payer); setFrequency(fields.frequency);
    setDate(fields.date); setIncluded(fields.included); setMethod(fields.method); setValues(fields.values);
  }
  function adoptLatest(discard: boolean) {
    if (!bill || !base) return;
    const latest = recurringEditorFields(bill, activeIds);
    const mine = { title, amount, payer, frequency, date, included, method, values };
    load(discard ? latest : mergeRecurringEdits(mine, recurringEditorFields(base.bill, activeIds), latest));
    setBase({ version: bill.version, bill });
    sent.current = null;
    setUnconfirmed(false);
    setValidation("");
    onClearError();
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (pending || conflict) return;
    setValidation("");
    try {
      const amountMinor = parseMoneyInput(amount, hub.currency);
      if (!title.trim() || !amountMinor || !date)
        throw new Error(moneyInputError(amount, hub.currency, "Enter a name, amount and next due date."));
      if (!payer) throw new Error("Choose who pays this bill.");
      const allocations = allocateExpense(
        amountMinor,
        included,
        method,
        values,
        hub.currency,
      );
      const fields = {
        title: title.trim(),
        amountMinor,
        paidByUserId: payer,
        allocations,
        frequency,
        nextDueOn: date,
      };
      const input: RecurringBillInput = bill && base
        ? { ...fields, id: bill.id, expectedVersion: base.version }
        : { ...fields, paused: false, requestId: requestId.current };
      sent.current = input;
      void onSave(input).then((outcome) => {
        if (outcome === "unknown") setUnconfirmed(true);
        else if (outcome === "refused") setUnconfirmed(false);
      });
    } catch (cause) {
      setValidation(cause instanceof Error ? cause.message : "Check the bill.");
    }
  }
  const heading = bill ? "Edit recurring bill" : "Add recurring bill";
  if (bill?.archivedAt) {
    return (
      <Dialog title={heading} onClose={onClose}>
        <p className="a-form-error" role="alert">This bill was archived while you were editing, so it cannot be changed until it is restored.</p>
        <div className="a-field-row"><Button onClick={onClose}>Close</Button></div>
      </Dialog>
    );
  }
  if (ownSave) {
    return (
      <Dialog title={heading} onClose={onSaved}>
        <p className="c-receipt-context" role="status">Your changes were saved. The reply was lost on the way back, but the bill now shows them.</p>
        <div className="a-field-row"><Button onClick={onSaved}>Done</Button></div>
      </Dialog>
    );
  }
  const changes = conflict && base ? recurringChanges(base.bill, bill!, name, hub.currency) : [];
  return (
    <Dialog
      title={heading}
      pending={pending}
      onClose={onClose}
    >
      {conflict && (
        <div className="c-change-conflict" role="alert">
          <strong>This bill changed while you were editing.</strong>
          <p>{unconfirmed
            ? "Your earlier save may have gone through. Check the bill below before saving again."
            : "Nothing of yours was saved. Check the bill again before saving."}</p>
          {changes.length > 0 && <ul>{changes.map((line) => <li key={line}>{line}</li>)}</ul>}
          <div className="a-field-row">
            <Button onClick={() => adoptLatest(false)}>Keep my edits and check again</Button>
            <Button variant="secondary" onClick={() => adoptLatest(true)}>Use the latest version</Button>
          </div>
        </div>
      )}
      {notices.map((notice) => (
        <p className="c-receipt-context" role="status" key={notice}>{notice}</p>
      ))}
      <form onSubmit={submit}>
        <fieldset className="c-form-fields" disabled={pending}>
          <Field label="Bill name">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={80}
              required
            />
          </Field>
          <div className="c-form-grid">
            <Field label={`Amount (${hub.currency})`}>
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                maxLength={LIMITS.money}
                required
              />
            </Field>
            <Field label="Paid by">
              <select
                value={payer}
                onChange={(event) => setPayer(event.target.value)}
                disabled={hub.role !== "admin"}
              >
                {!payer && <option value="" disabled>Choose who pays</option>}
                {hub.members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="c-form-grid">
            <Field label="Repeat">
              <select
                value={frequency}
                onChange={(event) =>
                  setFrequency(event.target.value as "weekly" | "monthly")
                }
              >
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
              </select>
            </Field>
            <Field label="Next due date">
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required
              />
            </Field>
          </div>
        </fieldset>
        <SplitEditor
          members={hub.members}
          includedIds={included}
          onIncludedIds={setIncluded}
          method={method}
          onMethod={setMethod}
          values={values}
          onValues={setValues}
          amountMinor={parseMoneyInput(amount, hub.currency)}
          currency={hub.currency}
          disabled={pending}
        />
        <p className="c-form-help">
          Nothing is charged or added to the ledger until the payer or an admin
          confirms the bill was paid.
        </p>
        <Feedback error={conflict ? "" : validation || error} />
        <div className="a-field-row">
          <Button type="submit" disabled={pending || conflict}>
            {pending ? "Saving…" : resuming ? "Save and resume" : "Save recurring bill"}
          </Button>
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function RecurringScreen() {
  const {
    hub,
    recurringBills,
    saveRecurringBill,
    pauseRecurringBill,
    archiveRecurringBill,
    recordRecurringPeriod,
    skipRecurringPeriod,
    clearApiError,
    session,
    go,
    personName,
  } = useApp();
  const name = useMemberName();
  const [editor, setEditor] = useState<{ id: string | null; resuming: boolean } | null>(null);
  const [confirm, setConfirm] = useState<RecurringBill | null>(null);
  const [skipping, setSkipping] = useState<RecurringBill | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const searchRecord = useSearchRecord("recurring", recurringBills.map(item => item.id),
    id => setShowArchived(Boolean(recurringBills.find(item => item.id === id)?.archivedAt)));
  function report(cause: unknown) {
    const failure = commandFailure(cause, "Could not save the bill.");
    setError(!failure.rejected ? UNCERTAIN_RETRY_SAFE
      : /already used for a different/i.test(failure.message)
        ? "An earlier attempt may already have been saved. Close this and check Recurring before adding it again."
        : failure.message);
    return failure;
  }
  async function run<T>(action: () => Promise<T>, success: string | ((result: T) => string)) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const result = await action();
      setEditor(null);
      setConfirm(null);
      setSkipping(null);
      setMessage(typeof success === "function" ? success(result) : success);
    } catch (cause) {
      report(cause);
    } finally {
      setPending(false);
    }
  }
  // Resuming from the editor saves first, then resumes the saved bill.
  async function save(input: RecurringBillInput, resuming: boolean): Promise<SaveOutcome> {
    setPending(true);
    setError("");
    setMessage("");
    try {
      await saveRecurringBill(input);
    } catch (cause) {
      const failure = report(cause);
      setPending(false);
      return !failure.rejected ? "unknown" : failure.conflict ? "conflict" : "refused";
    }
    await saved(resuming && "id" in input ? input.id : null);
    return "saved";
  }
  // Also reached from the editor when a save's reply was lost but it landed.
  async function saved(resumeId: string | null) {
    setEditor(null);
    setPending(true);
    try {
      if (resumeId) await pauseRecurringBill(resumeId, false);
      setMessage(resumeId ? "Bill saved and resumed." : "Recurring bill saved.");
    } catch (cause) {
      const failure = commandFailure(cause, "Could not resume the bill.");
      setError(`Your changes were saved, but the bill is still paused. ${failure.rejected ? failure.message : "Check your connection and resume it again."}`);
    } finally {
      setPending(false);
    }
  }
  if (!hub.id)
    return (
      <EmptyState
        title="Create a commune first."
        description="Recurring bills belong to a commune and its members."
        action={
          <Button onClick={() => go("commune-new")}>Create a commune</Button>
        }
      />
    );
  const activeIds = new Set(hub.members.map((member) => member.userId));
  const archivedCount = recurringBills.filter((bill) => bill.archivedAt).length;
  // The Archived filter appears once a bill has been archived.
  const archivedView = showArchived && archivedCount > 0;
  const shown = recurringBills.filter((bill) => Boolean(bill.archivedAt) === archivedView);
  const activeCount = recurringBills.filter((bill) => !bill.paused && !bill.archivedAt).length;
  const editing = editor?.id ? recurringBills.find((bill) => bill.id === editor.id) : undefined;
  return (
    <>
      <div className="a-toolbar">
        {archivedCount > 0 ? (
          <div className="a-filters">
            <button
              className={`a-chip${!archivedView ? " is-on" : ""}`}
              type="button"
              aria-pressed={!archivedView}
              onClick={() => setShowArchived(false)}
            >
              Active
            </button>
            <button
              className={`a-chip${archivedView ? " is-on" : ""}`}
              type="button"
              aria-pressed={archivedView}
              onClick={() => setShowArchived(true)}
            >
              Archived
            </button>
          </div>
        ) : (
          <p className="c-toolbar-context">
            {hub.name} · {activeCount} active{" "}
            {activeCount === 1 ? "schedule" : "schedules"}
          </p>
        )}
        <Button
          onClick={() => {
            setError("");
            setShowArchived(false);
            setEditor({ id: null, resuming: false });
          }}
        >
          <Plus size={16} />
          Add recurring bill
        </Button>
      </div>
      <Feedback error={!editor && !confirm && !skipping ? error || searchRecord.error : ""} message={message} />
      {!recurringBills.length && (
        <EmptyState
          title="Make repeat bills easier."
          description="Save the amount and split once. When a bill is due, confirm what was paid to record that occurrence without duplicate entries."
        />
      )}
      {recurringBills.length > 0 && !shown.length && (
        <EmptyState
          title="No active recurring bills."
          description="Archived bills keep their history in Archived, where they can be restored."
        />
      )}
      <div className="c-workflow-grid">
        {shown.map((bill) => {
          const actions = recurringActions(bill, session?.userId, hub.role === "admin");
          const departures = recurringDepartures(bill, activeIds);
          const someoneLeft = departures.payer !== null || departures.split.length > 0;
          const due = bill.nextDueOn <= todayIso();
          // A bill with someone gone resumes through the editor, or not at all.
          const canResume = bill.paused && actions.pause && (!someoneLeft || actions.edit);
          return (
            <Panel className={`c-workflow-card${searchRecord.highlightedId === bill.id ? " c-search-record-highlight" : ""}`}
              id={`search-record-recurring-${bill.id}`} tabIndex={-1} key={bill.id} label={bill.title}>
              <SectionHeading
                title={bill.title}
                action={
                  <Pill tone={bill.paused ? "open" : due ? "warn" : "sage"}>
                    {bill.archivedAt ? "Archived" : bill.paused ? "Paused" : due ? "Due" : "Scheduled"}
                  </Pill>
                }
              />
              <strong className="c-workflow-amount">
                {money(bill.amountMinor, hub.currency)}
              </strong>
              <div className="c-dated-detail">
                <CalendarDate date={bill.nextDueOn} label={bill.paused ? "Paused schedule date" : "Next due"} />
                <p className="c-form-help">
                <Repeat2 size={14} aria-hidden="true" />{" "}
                {bill.frequency === "monthly" ? "Monthly" : "Weekly"} · next{" "}
                {dateLabel(bill.nextDueOn)} · paid by{" "}
                {personName(bill.paidByUserId, "Former member", { left: true })}
                </p>
              </div>
              <div className="a-field-row">
                {!bill.paused && due && actions.record && (
                  <Button
                    disabled={pending}
                    onClick={() => {
                      setError("");
                      setConfirm(bill);
                    }}
                  >
                    Record paid bill{" "}<span className="c-visually-hidden">for {bill.title}</span>
                  </Button>
                )}
                {!bill.paused && actions.record && canSkipNextPeriod(bill) && (
                  <Button
                    variant="secondary"
                    disabled={pending}
                    onClick={() => {
                      setError("");
                      setSkipping(bill);
                    }}
                  >
                    Skip this period{" "}<span className="c-visually-hidden">for {bill.title}</span>
                  </Button>
                )}
                {actions.edit && (
                  <Button
                    variant="secondary"
                    disabled={pending}
                    onClick={() => {
                      setError("");
                      setEditor({ id: bill.id, resuming: false });
                    }}
                  >
                    Edit{" "}<span className="c-visually-hidden">{bill.title}</span>
                  </Button>
                )}
                {actions.pause && (!bill.paused || canResume) && (
                  <Button
                    variant="secondary"
                    disabled={pending}
                    onClick={() => {
                      if (bill.paused && someoneLeft) {
                        setError("");
                        setEditor({ id: bill.id, resuming: true });
                        return;
                      }
                      void run(
                        () => pauseRecurringBill(bill.id, !bill.paused),
                        bill.paused ? "Schedule resumed." : "Schedule paused.",
                      );
                    }}
                  >
                    {bill.paused ? "Resume" : "Pause"}{" "}<span className="c-visually-hidden">{bill.title}</span>
                  </Button>
                )}
                {actions.archive && bill.paused && (
                  <Button
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      void run(
                        () => archiveRecurringBill(bill.id, true),
                        "Bill archived and paused. Find it in Archived to restore it.",
                      )
                    }
                  >
                    Archive{" "}<span className="c-visually-hidden">{bill.title}</span>
                  </Button>
                )}
                {actions.restore && (
                  <Button
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      void run(
                        async () => {
                          const result = await archiveRecurringBill(bill.id, false);
                          if (archivedCount === 1) setShowArchived(false);
                          return result;
                        },
                        "Bill restored. It stays paused until someone resumes it.",
                      )
                    }
                  >
                    Restore{" "}<span className="c-visually-hidden">{bill.title}</span>
                  </Button>
                )}
              </div>
              {!actions.record && !bill.paused && due && (
                <p className="c-form-help">
                  Waiting for the payer or an admin to record this bill.
                </p>
              )}
              {bill.paused && !bill.archivedAt && someoneLeft && actions.pause && !actions.edit && (
                <p className="c-form-help">{resumeBlockedNotice(departures, name)}</p>
              )}
              <PeriodHistory bill={bill} />
            </Panel>
          );
        })}
      </div>
      {editor && (!editor.id || editing) && (
        <RecurringEditor
          bill={editing}
          resuming={editor.resuming}
          error={error}
          pending={pending}
          onClearError={() => {
            setError("");
            clearApiError();
          }}
          onSaved={() => {
            setError("");
            clearApiError();
            void saved(editor.resuming ? editor.id : null);
          }}
          onClose={() => setEditor(null)}
          onSave={(input) => save(input, editor.resuming)}
        />
      )}
      {confirm && (
        <RecordPeriodDialog
          bill={confirm}
          pending={pending}
          error={error}
          onClose={() => setConfirm(null)}
          onRecord={(amountMinor) =>
            void run(
              () => recordRecurringPeriod(confirm.id, confirm.nextDueOn, amountMinor),
              (result) => recordedMessage(confirm, amountMinor, result, hub.currency),
            )
          }
        />
      )}
      {skipping && (
        <SkipPeriodDialog
          bill={skipping}
          pending={pending}
          error={error}
          onClose={() => setSkipping(null)}
          onSkip={(reason) =>
            void run(
              () => skipRecurringPeriod(skipping.id, skipping.nextDueOn, reason),
              (result) => skippedMessage(skipping, result),
            )
          }
        />
      )}
    </>
  );
}
