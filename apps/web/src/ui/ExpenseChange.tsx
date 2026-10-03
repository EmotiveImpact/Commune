import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { allocateExpense, type ExpenseAllocation, type SplitMethod } from "../../../../packages/core/src/expenseSplit";
import { useApp } from "../state";
import { money, type CurrencyCode, type ExpenseRevision, type ExpenseState, type LiveExpenseRow } from "../live/model";
import { parseMoneyInput } from "../data/moneyInput";
import { newRequestId } from "../data/requestId";
import { commandFailure, UNCERTAIN_RETRY_SAFE } from "../data/commands";
import { formatReminderDay, formatTimestampDay } from "../data/reminders";
import { LIMITS } from "../data/limits";
import { Button, Dialog, Feedback, Field } from "./components";
import { SplitEditor } from "./SplitEditor";

const CATEGORIES = ["Other", "Rent", "Bills", "Groceries", "Travel"];
type Names = (userId: string) => string;

export function expenseState(expense: LiveExpenseRow): ExpenseState {
  return {
    title: expense.name, amountMinor: expense.amountMinor, paidByUserId: expense.paidByUserId,
    category: expense.category, dueOn: expense.dueOn,
    shares: expense.shares.map(share => ({ userId: share.userId, amountMinor: share.amountMinor })),
  };
}
function shareOf(state: ExpenseState, userId: string): number {
  return state.shares.find(share => share.userId === userId)?.amountMinor ?? 0;
}
function sameShares(a: ExpenseState, b: ExpenseState): boolean {
  return a.shares.length === b.shares.length && a.shares.every(share => shareOf(b, share.userId) === share.amountMinor);
}
export function isFinancialChange(before: ExpenseState, after: ExpenseState): boolean {
  return before.amountMinor !== after.amountMinor || before.paidByUserId !== after.paidByUserId || !sameShares(before, after);
}

/** Field-level differences, in the order a reader would look for them. */
export function describeChanges(before: ExpenseState, after: ExpenseState, names: Names, currency: CurrencyCode): string[] {
  const lines: string[] = [];
  if (before.title !== after.title) lines.push(`Name: “${before.title}” to “${after.title}”`);
  if (before.amountMinor !== after.amountMinor) lines.push(`Total: ${money(before.amountMinor, currency)} to ${money(after.amountMinor, currency)}`);
  if (before.paidByUserId !== after.paidByUserId) lines.push(`Paid by: ${names(before.paidByUserId)} to ${names(after.paidByUserId)}`);
  if (before.category !== after.category) lines.push(`Category: ${before.category} to ${after.category}`);
  if ((before.dueOn ?? null) !== (after.dueOn ?? null)) lines.push(`Due: ${before.dueOn ? formatReminderDay(before.dueOn) : "no date"} to ${after.dueOn ? formatReminderDay(after.dueOn) : "no date"}`);
  const people = [...new Set([...before.shares, ...after.shares].map(share => share.userId))];
  for (const userId of people) {
    const was = shareOf(before, userId), now = shareOf(after, userId);
    if (was === now) continue;
    lines.push(!was ? `${names(userId)} added with a ${money(now, currency)} share`
      : !now ? `${names(userId)} removed (was ${money(was, currency)})`
        : `${names(userId)}’s share: ${money(was, currency)} to ${money(now, currency)}`);
  }
  return lines;
}

/** What each person owes the payer before and after, for those it changes. */
export function balanceChanges(before: ExpenseState, after: ExpenseState, names: Names, currency: CurrencyCode): string[] {
  const owes = (state: ExpenseState, userId: string) => userId === state.paidByUserId ? 0 : shareOf(state, userId);
  const people = [...new Set([...before.shares, ...after.shares].map(share => share.userId))];
  return people.flatMap(userId => {
    const was = owes(before, userId), now = owes(after, userId);
    const creditorChanged = before.paidByUserId !== after.paidByUserId && (was > 0 || now > 0);
    if (was === now && !creditorChanged) return [];
    const earlier = was ? `was ${money(was, currency)} to ${names(before.paidByUserId)}` : "owed nothing before";
    return [now
      ? `${names(userId)} will owe ${names(after.paidByUserId)} ${money(now, currency)} (${earlier})`
      : `${names(userId)} will owe nothing on this expense (${earlier})`];
  });
}

function decimal(minor: number): string { return (minor / 100).toFixed(2); }
function sameState(a: ExpenseState, b: ExpenseState): boolean {
  return a.title === b.title && a.amountMinor === b.amountMinor && a.paidByUserId === b.paidByUserId &&
    a.category === b.category && (a.dueOn ?? null) === (b.dueOn ?? null) && sameShares(a, b);
}
/**
 * Active repayments split by whether the payer can still reverse them. A
 * repayment from, or to, someone who has left cannot be reversed (that would
 * reopen a debt for a former member); voiding closes those instead.
 */
function repaymentState(expense: LiveExpenseRow, activeIds: string[]) {
  const payerActive = activeIds.includes(expense.paidByUserId);
  let reversible = 0, closable = 0;
  for (const share of expense.shares) {
    const active = (share.receipts ?? []).filter(receipt => !receipt.reversedAt).length;
    if (!active) continue;
    if (payerActive && activeIds.includes(share.userId)) reversible += active; else closable += active;
  }
  return { reversible, closable, any: reversible + closable > 0 };
}
function isEqualSplit(shares: Array<{ amountMinor: number }>): boolean {
  if (!shares.length) return false;
  const amounts = shares.map(share => share.amountMinor);
  return Math.max(...amounts) - Math.min(...amounts) <= 1;
}

/**
 * Correct an expense in two steps: edit, then review exactly what changes and
 * for whom, with a required reason. The version the form was loaded from is
 * sent with the save, so someone else's change is a visible conflict.
 */
export function CorrectExpenseDialog({ expense, names, onClose, onSaved }: {
  expense: LiveExpenseRow; names: Names; onClose: () => void; onSaved: (message: string) => void;
}) {
  const { hub, session, correctExpense } = useApp();
  const currency = hub.currency;
  const members = hub.members;
  const viewerIsPayer = session?.userId === expense.paidByUserId;
  const reviewRef = useRef<HTMLHeadingElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const firstStep = useRef(true);
  const [base, setBase] = useState(() => ({ version: expense.version, state: expenseState(expense) }));
  const [title, setTitle] = useState(expense.name);
  const [amount, setAmount] = useState(decimal(expense.amountMinor));
  const [category, setCategory] = useState(expense.category);
  const [due, setDue] = useState(expense.dueOn ?? "");
  const [payer, setPayer] = useState(expense.paidByUserId);
  const [includedIds, setIncludedIds] = useState(() => expense.shares.map(share => share.userId));
  const [method, setMethod] = useState<SplitMethod>(() => isEqualSplit(expense.shares) ? "Equal" : "Exact");
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(expense.shares.map(share => [share.userId, decimal(share.amountMinor)])));
  const [step, setStep] = useState<"edit" | "review">("edit");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  // After an unconfirmed save, the retry must be the same decision.
  const [uncertain, setUncertain] = useState(false);
  const requestId = useRef(newRequestId());

  const latest = expenseState(expense);
  const repayments = repaymentState(expense, members.map(member => member.userId));
  const hasRepayments = repayments.any;
  const formerMember = expense.shares.some(share => !members.some(member => member.userId === share.userId));
  const moneyLocked = hasRepayments || formerMember;
  const amountMinor = parseMoneyInput(amount);
  const proposal = useMemo(() => {
    if (moneyLocked) return { shares: base.state.shares as ExpenseAllocation[], error: "" };
    if (amountMinor === null) return { shares: [] as ExpenseAllocation[], error: "Enter a valid total, for example 93.00." };
    // An untouched equal split keeps the saved pennies exactly as they are.
    const untouched = method === "Equal" && amountMinor === base.state.amountMinor && isEqualSplit(base.state.shares) &&
      includedIds.length === base.state.shares.length && includedIds.every(id => base.state.shares.some(share => share.userId === id));
    if (untouched) return { shares: base.state.shares as ExpenseAllocation[], error: "" };
    try { return { shares: allocateExpense(amountMinor, includedIds, method, values), error: "" }; }
    catch (cause) { return { shares: [] as ExpenseAllocation[], error: cause instanceof Error ? cause.message : "Check the split." }; }
  }, [amountMinor, base.state, includedIds, method, moneyLocked, values]);
  const after: ExpenseState = {
    title: title.trim(), amountMinor: moneyLocked ? base.state.amountMinor : amountMinor ?? 0,
    paidByUserId: moneyLocked ? base.state.paidByUserId : payer, category, dueOn: due || null, shares: proposal.shares,
  };
  const changes = describeChanges(base.state, after, names, currency);
  const balances = balanceChanges(base.state, after, names, currency);
  // A newer version may be this person's own save whose reply was lost.
  const newest = expense.revisions[0];
  const ownSave = expense.version !== base.version && step === "review" && !!newest && newest.version === expense.version &&
    newest.action === "corrected" && newest.actorId === session?.userId && newest.reason === reason.trim() && sameState(newest.after, after);
  const conflict = expense.version !== base.version && !ownSave;

  useEffect(() => {
    if (firstStep.current) { firstStep.current = false; return; }
    (step === "review" ? reviewRef.current : titleRef.current)?.focus();
  }, [step]);

  function review(event: FormEvent) {
    event.preventDefault();
    if (!after.title) { setError("Name the expense."); return; }
    if (proposal.error) { setError(proposal.error); return; }
    const kept = expense.shares.find(share => (share.receipts ?? []).length > 0 && !after.shares.some(item => item.userId === share.userId));
    if (kept) { setError(`${names(kept.userId)} has repayment history on this expense and must stay in the split. Void the expense and record it again instead.`); return; }
    if (!changes.length) { setError("Nothing has changed yet, so there is nothing to correct."); return; }
    setError("");
    // A new decision: retries of this exact review reuse the id below.
    requestId.current = newRequestId();
    setStep("review");
  }
  function adoptLatest(discard: boolean) {
    setBase({ version: expense.version, state: latest });
    setError("");
    setStep("edit");
    if (!discard) return;
    setTitle(latest.title); setAmount(decimal(latest.amountMinor)); setCategory(latest.category); setDue(latest.dueOn ?? "");
    setPayer(latest.paidByUserId); setIncludedIds(latest.shares.map(share => share.userId));
    setMethod(isEqualSplit(latest.shares) ? "Equal" : "Exact");
    setValues(Object.fromEntries(latest.shares.map(share => [share.userId, decimal(share.amountMinor)])));
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (pending || conflict) return;
    if (reason.trim().length < 3) { setError("Give a short reason so everyone can understand the correction."); return; }
    setPending(true); setError("");
    try {
      const result = await correctExpense(expense.id, {
        expectedVersion: base.version, name: after.title, amountMinor: after.amountMinor, category: after.category,
        dueOn: after.dueOn, paidByUserId: after.paidByUserId, allocations: after.shares, reason, requestId: requestId.current,
      });
      onSaved(result.duplicate
        ? "This correction was already saved."
        : `Correction saved as version ${result.version}. The earlier version stays in this expense’s history.`);
    } catch (cause) {
      const failure = commandFailure(cause, "Could not save the correction.");
      if (!failure.rejected) setUncertain(true);
      setError(failure.rejected ? `${failure.message.replace(/\.$/, "")}. Nothing was changed.` : UNCERTAIN_RETRY_SAFE);
    } finally {
      setPending(false);
    }
  }

  if (expense.voidedAt) {
    return <Dialog title="Correct this expense" onClose={onClose} className="c-expense-change">
      <p className="a-form-error" role="alert">This expense was voided while you were editing, so it can no longer be changed.</p>
      <div className="a-field-row"><Button onClick={onClose}>Close</Button></div>
    </Dialog>;
  }
  if (ownSave) {
    return <Dialog title="Correct this expense" onClose={() => onSaved(`Correction saved as version ${expense.version}. The earlier version stays in this expense’s history.`)} className="c-expense-change">
      <p className="c-receipt-context" role="status">Your correction was saved as version {expense.version}. The reply was lost on the way back, but the change is in this expense’s history.</p>
      <div className="a-field-row"><Button onClick={() => onSaved(`Correction saved as version ${expense.version}. The earlier version stays in this expense’s history.`)}>Done</Button></div>
    </Dialog>;
  }
  return <Dialog title="Correct this expense" pending={pending} onClose={onClose} className="c-expense-change">
    {conflict && <div className="c-change-conflict" role="alert">
      <strong>This expense changed while you were editing.</strong>
      <p>Someone saved version {expense.version}. Your edits are still here and nothing of yours was saved.</p>
      {describeChanges(base.state, latest, names, currency).length > 0 && <ul>{describeChanges(base.state, latest, names, currency).map(line => <li key={line}>{line}</li>)}</ul>}
      <div className="a-field-row">
        <Button onClick={() => adoptLatest(false)}>Keep my edits and review again</Button>
        <Button variant="secondary" onClick={() => adoptLatest(true)}>Discard my edits</Button>
      </div>
    </div>}
    {step === "edit" ? <form onSubmit={review}>
      <Field label="What was it for?">
        <input ref={titleRef} type="text" value={title} maxLength={LIMITS.expenseTitle} disabled={pending} onChange={event => setTitle(event.target.value)} />
      </Field>
      <div className="c-change-pair">
        <Field label={`Total (${currency})`}>
          <input type="text" inputMode="decimal" maxLength={LIMITS.money} value={amount} disabled={pending || moneyLocked} onChange={event => setAmount(event.target.value)} />
        </Field>
        <Field label="Paid by" hint={hub.role === "admin" ? undefined : "Only an admin can change who paid."}>
          <select value={payer} disabled={pending || moneyLocked || hub.role !== "admin"} onChange={event => setPayer(event.target.value)}>
            {!members.some(member => member.userId === payer) && <option value={payer}>{names(payer)}</option>}
            {members.map(member => <option key={member.userId} value={member.userId}>{member.name}</option>)}
          </select>
        </Field>
      </div>
      <div className="c-change-pair">
        <Field label="Category">
          <select value={category} disabled={pending} onChange={event => setCategory(event.target.value)}>
            {[...new Set([category, ...CATEGORIES])].map(choice => <option key={choice}>{choice}</option>)}
          </select>
        </Field>
        <Field label="Due date (optional)">
          <input type="date" value={due} disabled={pending} onChange={event => setDue(event.target.value)} />
        </Field>
      </div>
      {moneyLocked
        ? <p className="c-change-lock" role="note">{repayments.reversible
          ? `Repayments are recorded on this expense, so its total, payer and split are locked. ${viewerIsPayer ? "Reverse those repayments first" : `Ask ${names(expense.paidByUserId)} to reverse those repayments first`} if the money needs to change. The name, category and due date can still be corrected.`
          : hasRepayments
            ? "Repayments from or to someone who has left are recorded on this expense, so its total, payer and split are locked. Void it and record it again if the money needs to change. The name, category and due date can still be corrected."
            : "This expense includes a former member, so its total, payer and split are locked. Void it and record it again if the money needs to change."}</p>
        : <SplitEditor members={members} includedIds={includedIds} onIncludedIds={setIncludedIds} method={method} onMethod={setMethod}
            values={values} onValues={setValues} amountMinor={amountMinor} currency={currency} disabled={pending} />}
      <Feedback error={error} />
      <div className="a-field-row">
        <Button type="submit" disabled={pending || conflict}>Review changes</Button>
        <Button variant="secondary" disabled={pending} onClick={onClose}>Cancel</Button>
      </div>
    </form> : <form onSubmit={event => void save(event)}>
      <section className="c-change-review" aria-label="What changes">
        <h3 ref={reviewRef} tabIndex={-1}>What changes</h3>
        <ul>{changes.map(line => <li key={line}>{line}</li>)}</ul>
        <h3>Whose balance changes</h3>
        {balances.length ? <ul>{balances.map(line => <li key={line}>{line}</li>)}</ul> : <p>No one’s balance changes.</p>}
      </section>
      <Field label="Reason for the correction">
        <textarea rows={3} maxLength={240} value={reason} disabled={pending || uncertain} required placeholder="e.g. The receipt total was wrong"
          onChange={event => setReason(event.target.value)} />
      </Field>
      <p className="c-receipt-note">{isFinancialChange(base.state, after) ? "Everyone whose figure changes is told in Commune. " : ""}The earlier version and your reason stay in this expense’s history. No money moves.</p>
      <Feedback error={error} />
      <div className="a-field-row">
        <Button type="submit" disabled={pending || conflict}>{pending ? "Saving…" : "Save correction"}</Button>
        <Button variant="secondary" disabled={pending || uncertain} onClick={() => { setError(""); setStep("edit"); }}>Back to editing</Button>
      </div>
    </form>}
  </Dialog>;
}

/** Void keeps the expense and its history; it only stops counting. */
export function VoidExpenseDialog({ expense, onClose, onSaved }: {
  expense: LiveExpenseRow; onClose: () => void; onSaved: (message: string) => void;
}) {
  const { hub, session, voidExpense } = useApp();
  const [baseVersion, setBaseVersion] = useState(expense.version);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const requestId = useRef(newRequestId());
  const conflict = expense.version !== baseVersion;
  const repayments = repaymentState(expense, hub.members.map(member => member.userId));
  // Only repayments the payer can still reverse block a void.
  const hasRepayments = repayments.reversible > 0;
  const viewerIsPayer = session?.userId === expense.paidByUserId;
  const open = expense.shares.filter(share => share.userId !== expense.paidByUserId).reduce((sum, share) => sum + share.amountMinor - share.settledMinor, 0);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (pending || conflict || hasRepayments) return;
    if (reason.trim().length < 3) { setError("Give a short reason so everyone can understand why it was voided."); return; }
    setPending(true); setError("");
    try {
      const result = await voidExpense(expense.id, { expectedVersion: baseVersion, reason, requestId: requestId.current });
      onSaved(result.duplicate ? "This expense was already voided." : "Expense voided. It stays in the ledger with its history and no longer counts towards any balance.");
    } catch (cause) {
      const failure = commandFailure(cause, "Could not void the expense.");
      if (!failure.rejected) setUncertain(true);
      setError(failure.rejected ? `${failure.message.replace(/\.$/, "")}. Nothing was changed.` : UNCERTAIN_RETRY_SAFE);
    } finally {
      setPending(false);
    }
  }

  if (expense.voidedAt) {
    // After a lost reply, the void that landed may be this person's own.
    const own = expense.voidedBy === session?.userId && (expense.voidReason ?? "") === reason.trim();
    const done = () => own ? onSaved("Expense voided. It stays in the ledger with its history and no longer counts towards any balance.") : onClose();
    return <Dialog title="Void this expense?" onClose={done} className="c-receipt-dialog">
      <p className="c-receipt-context" role="status">{own ? "Your void was saved. The reply was lost on the way back, but the expense is now voided." : "This expense is already voided."}</p>
      <div className="a-field-row"><Button onClick={done}>{own ? "Done" : "Close"}</Button></div>
    </Dialog>;
  }
  return <Dialog title="Void this expense?" pending={pending} onClose={onClose} className="c-receipt-dialog">
    <form onSubmit={event => void save(event)}>
      <p className="c-receipt-context">{expense.name} · {money(expense.amountMinor, hub.currency)} · paid by {expense.paidBy}</p>
      {conflict && <div className="c-change-conflict" role="alert">
        <strong>This expense changed while this was open.</strong>
        <p>Someone saved version {expense.version}. Check the details above before voiding it.</p>
        <div className="a-field-row"><Button onClick={() => { setBaseVersion(expense.version); setError(""); requestId.current = newRequestId(); }}>Use the latest version</Button></div>
      </div>}
      {hasRepayments
        ? <p className="c-change-lock" role="note">Repayments are recorded on this expense. {viewerIsPayer ? "Reverse them first" : `Ask ${expense.paidBy} to reverse them first`}, so no received money is left unexplained, then void it.</p>
        : <p className="c-receipt-note">{open ? `${money(open, hub.currency)} of outstanding shares will stop being owed. ` : ""}{repayments.closable ? "Repayments from or to someone who has left will be closed with this void, using your reason. " : ""}The expense stays in the ledger, marked as voided, with its history. Everyone in the split is told in Commune. This cannot be undone here; record the expense again if it was voided by mistake.</p>}
      <Field label="Reason for voiding">
        <textarea rows={3} maxLength={240} value={reason} disabled={pending || hasRepayments || uncertain} required placeholder="e.g. Entered twice"
          onChange={event => setReason(event.target.value)} />
      </Field>
      <Feedback error={error} />
      <div className="a-field-row">
        <Button type="submit" className="danger" disabled={pending || conflict || hasRepayments}>{pending ? "Voiding…" : "Void expense"}</Button>
        <Button variant="secondary" disabled={pending} onClick={onClose}>Keep it</Button>
      </div>
    </form>
  </Dialog>;
}

/** Who changed what, when and why. Newest first. */
export function ExpenseHistory({ revisions, names, currency }: { revisions: ExpenseRevision[]; names: Names; currency: CurrencyCode }) {
  if (!revisions.length) return null;
  return <details className="c-contribution-history c-expense-history">
    <summary>{revisions.length} {revisions.length === 1 ? "change" : "changes"} to this expense</summary>
    {revisions.map(revision => {
      const lines = revision.action === "voided" ? [] : describeChanges(revision.before, revision.after, names, currency);
      return <div key={revision.id}>
        <span>
          <strong>{revision.action === "voided" ? "Voided" : "Corrected"}</strong> by {names(revision.actorId)} on {formatTimestampDay(revision.createdAt)} · version {revision.version}
          <em> · {revision.reason}</em>
          {lines.length > 0 && <span className="c-history-lines">{lines.join(" · ")}</span>}
        </span>
      </div>;
    })}
  </details>;
}

/** One place to open the correction and void dialogs. */
export function useExpenseChange(names: Names, onDone: (message: string) => void) {
  const [mode, setMode] = useState<{ kind: "correct" | "void"; expenseId: string } | null>(null);
  const { expenses, voidedExpenses } = useApp();
  const expense = mode ? [...expenses, ...voidedExpenses].find(row => row.id === mode.expenseId) : undefined;
  const finish = (message: string) => { setMode(null); onDone(message); };
  const dialogs = !mode || !expense ? null : mode.kind === "correct"
    ? <CorrectExpenseDialog key={`correct-${expense.id}`} expense={expense} names={names} onClose={() => setMode(null)} onSaved={finish} />
    : <VoidExpenseDialog key={`void-${expense.id}`} expense={expense} onClose={() => setMode(null)} onSaved={finish} />;
  return {
    correct: (expenseId: string) => setMode({ kind: "correct", expenseId }),
    void: (expenseId: string) => setMode({ kind: "void", expenseId }),
    dialogs,
  };
}
