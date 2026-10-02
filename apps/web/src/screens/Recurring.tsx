import { useState, type FormEvent } from "react";
import { Plus, Repeat2 } from "lucide-react";
import { useApp, type RecurringBillInput } from "../state";
import { useSearchRecord } from "../ui/useSearchRecord";
import {
  allocateExpense,
  type SplitMethod,
} from "../../../../packages/core/src/expenseSplit";
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
import { parseMoneyInput } from "../data/moneyInput";
import { todayIso } from "../data/operations";

function RecurringEditor({
  bill,
  pending,
  error,
  onSave,
  onClose,
}: {
  bill?: RecurringBill;
  pending: boolean;
  error: string;
  onSave: (input: RecurringBillInput) => void;
  onClose: () => void;
}) {
  const { hub, session } = useApp();
  const [title, setTitle] = useState(bill?.title ?? "");
  const [amount, setAmount] = useState(
    bill ? (bill.amountMinor / 100).toFixed(2) : "",
  );
  const [payer, setPayer] = useState(bill?.paidByUserId ?? session!.userId);
  const [frequency, setFrequency] = useState<"weekly" | "monthly">(
    bill?.frequency ?? "monthly",
  );
  const [date, setDate] = useState(bill?.nextDueOn ?? todayIso());
  const [included, setIncluded] = useState(
    bill?.allocations.map((share) => share.userId) ??
      hub.members.map((member) => member.userId),
  );
  const [method, setMethod] = useState<SplitMethod>(bill ? "Exact" : "Equal");
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(
      bill?.allocations.map((share) => [
        share.userId,
        (share.amountMinor / 100).toFixed(2),
      ]) ?? [],
    ),
  );
  const [validation, setValidation] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    setValidation("");
    try {
      const amountMinor = parseMoneyInput(amount);
      if (!title.trim() || !amountMinor || !date)
        throw new Error("Enter a name, amount and next due date.");
      const allocations = allocateExpense(
        amountMinor,
        included,
        method,
        values,
      );
      onSave({
        id: bill?.id,
        title: title.trim(),
        amountMinor,
        paidByUserId: payer,
        allocations,
        frequency,
        nextDueOn: date,
        paused: bill?.paused ?? false,
      });
    } catch (cause) {
      setValidation(cause instanceof Error ? cause.message : "Check the bill.");
    }
  }
  return (
    <Dialog
      title={bill ? "Edit recurring bill" : "Add recurring bill"}
      pending={pending}
      onClose={onClose}
    >
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
                maxLength={14}
                required
              />
            </Field>
            <Field label="Paid by">
              <select
                value={payer}
                onChange={(event) => setPayer(event.target.value)}
                disabled={hub.role !== "admin"}
              >
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
          amountMinor={parseMoneyInput(amount)}
          currency={hub.currency}
          disabled={pending}
        />
        <p className="c-form-help">
          Nothing is charged or added to the ledger until the payer or an admin
          confirms the bill was paid. Missing members must be replaced before
          recording.
        </p>
        <Feedback error={validation || error} />
        <div className="a-field-row">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save recurring bill"}
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
    recordRecurringBill,
    session,
    go,
  } = useApp();
  const [editor, setEditor] = useState<RecurringBill | "new" | null>(null);
  const [confirm, setConfirm] = useState<RecurringBill | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const searchRecord = useSearchRecord("recurring", recurringBills.map(item => item.id));
  async function run(action: () => Promise<unknown>, success: string) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      await action();
      setEditor(null);
      setConfirm(null);
      setMessage(success);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save the bill.",
      );
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
  const activeCount = recurringBills.filter((bill) => !bill.paused).length;
  return (
    <>
      <div className="a-toolbar">
        <p className="c-toolbar-context">
          {hub.name} · {activeCount} active{" "}
          {activeCount === 1 ? "schedule" : "schedules"}
        </p>
        <Button
          onClick={() => {
            setError("");
            setEditor("new");
          }}
        >
          <Plus size={16} />
          Add recurring bill
        </Button>
      </div>
      <Feedback error={!editor && !confirm ? error || searchRecord.error : ""} message={message} />
      {!recurringBills.length && (
        <EmptyState
          title="Make repeat bills easier."
          description="Save the amount and split once. When a bill is due, confirm what was paid to record that occurrence without duplicate entries."
        />
      )}
      <div className="c-workflow-grid">
        {recurringBills.map((bill) => {
          const editable =
            hub.role === "admin" || bill.createdBy === session?.userId;
          const canRecord =
            hub.role === "admin" || bill.paidByUserId === session?.userId;
          const due = bill.nextDueOn <= todayIso();
          return (
            <Panel className={`c-workflow-card${searchRecord.highlightedId === bill.id ? " c-search-record-highlight" : ""}`}
              id={`search-record-recurring-${bill.id}`} tabIndex={-1} key={bill.id} label={bill.title}>
              <SectionHeading
                title={bill.title}
                action={
                  <Pill tone={bill.paused ? "open" : due ? "warn" : "sage"}>
                    {bill.paused ? "Paused" : due ? "Due" : "Scheduled"}
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
                {hub.members.find(
                  (member) => member.userId === bill.paidByUserId,
                )?.name ?? "Former member"}
                </p>
              </div>
              <div className="a-field-row">
                {!bill.paused && due && canRecord && (
                  <Button
                    disabled={pending}
                    onClick={() => {
                      setError("");
                      setConfirm(bill);
                    }}
                  >
                    Record paid bill
                  </Button>
                )}
                {editable && (
                  <>
                    <Button
                      variant="secondary"
                      disabled={pending}
                      onClick={() => {
                        setError("");
                        setEditor(bill);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={pending}
                      onClick={() =>
                        void run(
                          () =>
                            saveRecurringBill({
                              ...bill,
                              paused: !bill.paused,
                            }),
                          bill.paused
                            ? "Schedule resumed."
                            : "Schedule paused.",
                        )
                      }
                    >
                      {bill.paused ? "Resume" : "Pause"}
                    </Button>
                  </>
                )}
              </div>
              {!canRecord && !bill.paused && due && (
                <p className="c-form-help">
                  Waiting for the payer or an admin to record this bill.
                </p>
              )}
            </Panel>
          );
        })}
      </div>
      {editor && (
        <RecurringEditor
          bill={editor === "new" ? undefined : editor}
          error={error}
          pending={pending}
          onClose={() => setEditor(null)}
          onSave={(input) =>
            void run(() => saveRecurringBill(input), "Recurring bill saved.")
          }
        />
      )}
      {confirm && (
        <Dialog
          title={`Record ${confirm.title} as paid?`}
          pending={pending}
          onClose={() => setConfirm(null)}
        >
          <p>
            Record {money(confirm.amountMinor, hub.currency)} for{" "}
            {dateLabel(confirm.nextDueOn)} only if the bill has actually been
            paid. This creates the exact member shares and advances the schedule
            once.
          </p>
          <p className="c-form-help">
            Commune does not charge a card or move money.
          </p>
          <Feedback error={error} />
          <div className="a-field-row">
            <Button
              disabled={pending}
              onClick={() =>
                void run(
                  () => recordRecurringBill(confirm.id, confirm.nextDueOn),
                  "Bill recorded and next occurrence scheduled.",
                )
              }
            >
              {pending ? "Recording…" : "Yes, record paid bill"}
            </Button>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => setConfirm(null)}
            >
              Cancel
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
