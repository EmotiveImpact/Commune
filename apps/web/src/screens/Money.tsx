import { memo, useState } from "react";
import { useApp, type AppState, type CurrencyCode, type LiveExpenseRow } from "../state";
import { Avatar, Pill } from "../ui/widgets";
import { cx } from "../ui/cx";
import { RecipientReminderCount, ReminderAllowanceNotice } from "../ui/ReminderUsage";
import { Plus, ReceiptText, ChevronRight, Search } from "lucide-react";
import { LIMITS } from "../data/limits";
import { ReminderFlowDialog, useReminderFlow } from "../ui/ReminderConfirm";
import { formatReminderDay, reminderEligibility } from "../data/reminders";
import { LatestReportAnswer, pendingReport, reportSummary, useReceiptActions } from "../ui/Receipts";
import { CalendarDate } from "../ui/CalendarDate";
import { initialsOf } from "../data/household";
import { formatMoney } from "@commune/core";
import "./Money.css";

// Months start at midnight UTC, as the shared records count them.
function monthName(month: string): string {
  const date = new Date(`${month}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC",
    ...(date.getUTCFullYear() === new Date().getUTCFullYear() ? {} : { year: "numeric" }) }).format(date);
}

export function ExpensesScreen() {
  const { go, expenses, voidedExpenses, session, hub, expenseHistory, loadEarlierExpenses } = useApp();
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"All" | "Open" | "Settled" | "Voided">("All");
  // Open expenses always show. Settled and voided ones show from the start of
  // the latest month (UTC) with a settled one loaded, or of this month, and
  // Show earlier reaches back a month at a time.
  const [shownFrom, setShownFrom] = useState(() => {
    const newest = Math.max(...expenses.filter((row) => !row.open).map((row) => Date.parse(row.createdAt ?? "")).filter(Number.isFinite));
    return `${new Date(Number.isFinite(newest) ? newest : Date.now()).toISOString().slice(0, 7)}-01`;
  });
  const [earlier, setEarlier] = useState<"" | "loading" | "error">("");
  const shown = (row: (typeof expenses)[number]) =>
    row.open || !row.createdAt || Date.parse(row.createdAt) >= Date.parse(`${shownFrom}T00:00:00Z`);
  const needle = searchQuery.trim().toLocaleLowerCase();
  // Voided expenses are history only: never in All, Open, Settled or a total.
  const showVoided = filter === "Voided";
  const pool = showVoided ? voidedExpenses : expenses;
  const more = filter !== "Open" && (pool.some((row) => !shown(row)) ||
    (showVoided ? expenseHistory.olderVoidedCount : expenseHistory.olderCount - expenseHistory.olderVoidedCount) > 0);
  async function showEarlier() {
    setEarlier("loading");
    try {
      const month = await loadEarlierExpenses(shownFrom, showVoided);
      if (month) setShownFrom(month);
      setEarlier("");
    } catch {
      setEarlier("error");
    }
  }
  const rows = [...pool.filter((row) => row.open), ...pool.filter((row) => !row.open && shown(row))]
    .filter((row) => {
      if (filter === "All") return true;
      if (filter === "Open") return row.open === true;
      if (filter === "Settled") return row.status === "settled";
      return true;
    })
    .filter(
      (row) =>
        !needle ||
        [row.name, row.category, row.paidBy, row.statusLabel].some((value) =>
          value.toLocaleLowerCase().includes(needle),
        ),
    );

  return (
    <>
      <div className="a-toolbar">
        <div className="a-filters">
          {(voidedExpenses.length || expenseHistory.olderVoidedCount ? ["All", "Open", "Settled", "Voided"] as const : ["All", "Open", "Settled"] as const).map((chip) => (
            <button
              key={chip}
              className={cx("a-chip", filter === chip && "is-on")}
              type="button"
              aria-pressed={filter === chip}
              onClick={() => setFilter(chip)}
            >
              {chip}
            </button>
          ))}
        </div>
        <label className="c-record-filter"><Search size={16} aria-hidden="true" /><input type="search"
          aria-label="Filter expenses in this commune" placeholder="Filter expenses…" maxLength={LIMITS.search}
          value={searchQuery} onChange={event => setSearchQuery(event.target.value)} /></label>
        <button className="a-btn" type="button" onClick={() => go("add-expense")}>
          <Plus size={16} aria-hidden="true" /> Add expense
        </button>
      </div>
      <p className="c-scope-label">{showVoided
        ? `${rows.length} voided ${rows.length === 1 ? "expense" : "expenses"} · kept for history, not counted in any balance`
        : `${rows.length} ${rows.length === 1 ? "expense" : "expenses"} · ${formatMoney(rows.reduce((sum, row) => sum + row.amountMinor, 0), hub.currency)} total recorded in this view`}</p>
      <section className="c-expense-list" aria-label="Shared expenses">
        {rows.map(row => <ExpenseCard key={row.id} row={row} viewerId={session?.userId} currency={hub.currency} go={go} />)}
        {!rows.length && <p className="c-money-empty">No expenses match this view. Try another filter or search.</p>}
      </section>
      {more ? <div className="c-settle-footer">
        {earlier === "error" ? <p role="alert">Earlier expenses couldn’t be loaded. Try again.</p>
          : <p role="status">{earlier === "loading" ? "Loading earlier expenses…"
            : `${showVoided ? "Voided" : "Settled"} expenses before ${monthName(shownFrom)} aren’t shown yet.`}</p>}
        <button className="a-btn ghost" type="button" disabled={earlier === "loading"} aria-busy={earlier === "loading"}
          onClick={() => void showEarlier()}>Show earlier</button>
      </div> : null}
    </>
  );
}

// One expense in the list. It re-renders when its row does, not when the
// filter around it changes.
const ExpenseCard = memo(function ExpenseCard({ row, viewerId, currency, go }: {
  row: LiveExpenseRow; viewerId: string | undefined; currency: CurrencyCode; go: AppState["go"];
}) {
  const yours = row.shares.find(share => share.userId === viewerId);
  return <button className="c-expense-entry" type="button" onClick={() => go("expense", { expense: row.id })}>
    <span className="c-expense-card-head"><span className="c-money-icon"><ReceiptText size={19} strokeWidth={1.5} aria-hidden="true" /></span><span className="c-expense-copy"><strong>{row.name}</strong></span><Pill tone={row.voidedAt ? undefined : row.status}>{row.statusLabel}</Pill></span>
    <span className="c-expense-amount"><span><small>Total paid</small><strong>{row.amount}</strong></span><span className="c-expense-personal"><small>Your share</small><span>{yours ? formatMoney(yours.amountMinor, currency) : "Not included"}</span></span></span>
    <span className="c-expense-card-foot">{row.dueOn && <CalendarDate date={row.dueOn} label="Due" />}<span className="c-expense-footer-copy"><span>Paid by {row.paidBy}</span><small>{row.category}{row.dueOn ? ` · due ${row.due}` : ""}</small></span><ChevronRight size={16} aria-hidden="true" /></span>
  </button>;
});

export function ExpensesEmptyScreen() {
  const { go, session } = useApp();
  if (!session?.hasHubs) {
    return (
      <div className="a-empty">
        <h2>Create your first commune.</h2>
        <p>Then you can add an expense and share it with members.</p>
        <button className="a-btn" type="button" onClick={() => go("commune-new")}>Create a commune</button>
      </div>
    );
  }
  return (
    <>
      <div className="a-toolbar">
        <button className="a-btn" type="button" onClick={() => go("add-expense")}>
          <Plus size={16} aria-hidden="true" /> Add expense
        </button>
      </div>
      <div className="a-empty">
        <h2>No expenses yet.</h2>
        <p>Add something you’ve paid for and share it with your commune.</p>
      </div>
    </>
  );
}

export function SettleScreen() {
  const { go, hub, expenses, session, reminderTargets, reminderUsage, sentReminders, sendReminder, personName } = useApp();
  const reminder = useReminderFlow(sendReminder);
  const [message, setMessage] = useState("");
  const receipts = useReceiptActions(setMessage);
  const me = session?.userId;
  const moves = expenses.flatMap((expense) =>
    expense.shares
      .filter((share) => share.userId !== expense.paidByUserId && share.amountMinor > share.settledMinor)
      .filter((share) => share.userId === me || expense.paidByUserId === me)
      .map((share) => ({ expense, share, outstanding: share.amountMinor - share.settledMinor })),
  );
  const youOwe = moves
    .filter(({ share }) => share.userId === me)
    .reduce((total, { outstanding }) => total + outstanding, 0);
  const youAreOwed = moves
    .filter(({ expense }) => expense.paidByUserId === me)
    .reduce((total, { outstanding }) => total + outstanding, 0);
  // Nudges are offered on what you are owed, unless they say they have sent it.
  const nudgeable = moves.some(({ expense, share }) => expense.paidByUserId === me && !pendingReport(share));
  // The receipt ledger is the confirmation history: every entry the viewer
  // recorded or had recorded against their own share, newest first.
  const recent = expenses.flatMap((expense) => expense.shares
    .filter((share) => share.userId !== expense.paidByUserId && (share.userId === me || expense.paidByUserId === me))
    .flatMap((share) => (share.receipts ?? []).map((receipt) => ({ expense, share, receipt }))))
    .sort((a, b) => Date.parse(b.receipt.reversedAt ?? b.receipt.recordedAt) - Date.parse(a.receipt.reversedAt ?? a.receipt.recordedAt))
    .slice(0, 8);

  return (
    <>
        {message ? <p className="a-window-note" role="status">{message}</p> : null}
      <div className="c-settle-columns">{[false, true].map(receivingGroup => <section className="a-panel c-settle-column" aria-label={receivingGroup ? "You’re owed" : "You owe"} key={String(receivingGroup)}>
        <h2>{receivingGroup ? "You’re owed" : "You owe"}</h2>
        <strong className="c-settle-total">{formatMoney(receivingGroup ? youAreOwed : youOwe, hub.currency)}</strong>
        <p className="c-settle-explainer">{receivingGroup ? "Record each repayment after you receive it, in full or in part." : "Pay outside Commune, then tell the bill payer. They confirm receipt."}</p>
        {receivingGroup && nudgeable ? <ReminderAllowanceNotice usage={reminderUsage} /> : null}
        {moves.filter(({ expense }) => (expense.paidByUserId === me) === receivingGroup).map(({ expense, share, outstanding }) => {
          const payer = hub.members.find((member) => member.userId === expense.paidByUserId);
          const debtor = hub.members.find((member) => member.userId === share.userId);
          // Someone who has left keeps their name, marked as having left.
          const payerName = personName(expense.paidByUserId, "the bill payer");
          const debtorName = personName(share.userId, "this member");
          const receiving = expense.paidByUserId === me;
          const target = receiving
            ? reminderTargets.find((item) => item.kind === "nudge" && item.sourceId === share.id)
            : undefined;
          const eligibility = reminderEligibility({ kind: "nudge", recipientId: share.userId, target, usage: reminderUsage, sent: sentReminders, dueOn: expense.dueOn });
          const reminderReason = eligibility.reason;
          const report = pendingReport(share);
          return (
            <div
              className="a-move"
              key={share.id}
            >
              <Avatar tone={receiving ? debtor?.cls ?? "house" : payer?.cls ?? "house"} initials={receiving ? debtor?.ini ?? initialsOf(personName(share.userId, "")) : payer?.ini ?? initialsOf(personName(expense.paidByUserId, ""))} />
              <div>
                <div className="names">{receiving ? `${personName(share.userId, "A former member", { left: true })} owes you` : `You owe ${personName(expense.paidByUserId, "the bill payer", { left: true })}`}</div>
                <div className="why">{expense.name}{expense.dueOn ? ` · due ${expense.due}` : ""}</div>
                {share.settledMinor > 0 ? <div className="why">{formatMoney(share.settledMinor, hub.currency)} of {formatMoney(share.amountMinor, hub.currency)} received</div> : null}
                {report ? <div className="why c-report-line">{receiving
                  ? `${reportSummary(report, hub.currency, personName(share.userId, "A member"))}. Not yet confirmed.`
                  : `You said you sent ${formatMoney(report.amountMinor, hub.currency)} on ${formatReminderDay(report.sentOn)}. Waiting for ${payerName}.`}</div> : null}
                {!receiving ? <LatestReportAnswer share={share} currency={hub.currency} viewerId={me} names={(userId) => personName(userId, "The bill payer")} /> : null}
                {receiving && (target || (reminderUsage?.recipientUsage[share.userId] ?? 0) > 0) ? (
                  <RecipientReminderCount usage={reminderUsage} recipientId={share.userId} />
                ) : null}
              </div>
              <div className="amt">{formatMoney(outstanding, hub.currency)}</div>
              {receiving && report ? (
                <div className="a-row-actions">
                  <button className="a-btn" type="button" disabled={receipts.busy} onClick={() => { setMessage(""); receipts.answer({ report, debtorName, expenseName: expense.name, currency: hub.currency, decision: "confirm" }); }}>
                    Confirm {formatMoney(report.amountMinor, hub.currency)}{" "}<span className="c-visually-hidden">from {debtorName} for {expense.name}</span>
                  </button>
                  <button className="a-btn ghost" type="button" disabled={receipts.busy} onClick={() => { setMessage(""); receipts.answer({ report, debtorName, expenseName: expense.name, currency: hub.currency, decision: "decline" }); }}>
                    Not received{" "}<span className="c-visually-hidden">from {debtorName} for {expense.name}</span>
                  </button>
                </div>
              ) : receiving ? (
                <div className="a-row-actions">
                    <button className="a-btn nudge" type="button" disabled={!eligibility.canSend} title={reminderReason || undefined} onClick={() => { setMessage(""); reminder.open({ kind: "nudge", sourceId: share.id, recipientId: share.userId, name: personName(share.userId, "your housemate"), subject: expense.name, amount: formatMoney(outstanding, hub.currency), dueOn: expense.dueOn }); }}>
                      Nudge{" "}<span className="c-visually-hidden">{debtorName} about {expense.name}</span>
                    </button>
                  <button className="a-btn ghost" type="button" onClick={() => { setMessage(""); receipts.record({ shareId: share.id, debtorName, expenseName: expense.name, shareMinor: share.amountMinor, outstandingMinor: outstanding, currency: hub.currency }); }}>
                    Confirm received{" "}<span className="c-visually-hidden">from {debtorName} for {expense.name}</span>
                  </button>
                  {reminderReason && <p className="c-action-hint">{reminderReason}</p>}
                </div>
              ) : report ? (
                <div className="a-row-actions">
                  <button className="a-btn ghost" type="button" disabled={receipts.busy} onClick={() => { setMessage(""); void receipts.withdraw(report); }}>
                    Withdraw{" "}<span className="c-visually-hidden">your report for {expense.name}</span>
                  </button>
                </div>
              ) : (
                <div className="a-row-actions">
                  <button className="a-btn ghost" type="button" onClick={() => { setMessage(""); receipts.report({ shareId: share.id, payerName, expenseName: expense.name, outstandingMinor: outstanding, currency: hub.currency }); }}>
                    I’ve sent it{" "}<span className="c-visually-hidden">to {payerName} for {expense.name}</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {!(receivingGroup ? youAreOwed : youOwe) && <p className="c-money-empty">{receivingGroup ? "Nothing waiting to collect." : "Nothing to pay."}</p>}
      </section>)}</div>
      {recent.length > 0 && <section className="a-panel c-settle-recent" aria-label="Recent repayments">
        <h2>Recent repayments</h2>
        {recent.map(({ expense, share, receipt }) => {
          const debtor = hub.members.find((member) => member.userId === share.userId);
          const payer = hub.members.find((member) => member.userId === expense.paidByUserId);
          const mine = share.userId === me;
          const other = mine ? personName(expense.paidByUserId, "the bill payer", { left: true }) : personName(share.userId, "A former member", { left: true });
          return <button className="c-settle-receipt" type="button" key={receipt.id} onClick={() => go("expense", { expense: expense.id })}>
            <Avatar tone={mine ? payer?.cls ?? "house" : debtor?.cls ?? "house"} initials={mine ? payer?.ini ?? initialsOf(personName(expense.paidByUserId, "")) : debtor?.ini ?? initialsOf(personName(share.userId, ""))} />
            <span className="grow"><strong>{mine ? `You to ${other}` : `${other} to you`}</strong>
              <small>{expense.name} · received {formatReminderDay(receipt.receivedOn)}{receipt.reference ? ` · ${receipt.reference}` : ""}{receipt.reversedAt ? ` · reversed: ${receipt.reversalReason}` : ""}</small></span>
            <span className="amt">{formatMoney(receipt.amountMinor, hub.currency)}</span>
            <Pill tone={receipt.reversedAt ? "open" : "settled"}>{receipt.reversedAt ? "Reversed" : "Recorded as received"}</Pill>
          </button>;
        })}
        <p className="c-settle-explainer">A receipt record in Commune, not bank verification. Open an expense to see its full history.</p>
      </section>}
      <div className="c-settle-footer"><p>Each share is tracked separately. Commune does not move money.</p><button className="a-btn ghost" type="button" onClick={() => go("breakdown")}>View breakdown</button></div>
      <ReminderFlowDialog flow={reminder} usage={reminderUsage} />
      {receipts.dialogs}
    </>
  );
}

export function SettleEvenScreen() {
  const { go, session } = useApp();
  if (!session?.hasHubs) {
    return (
      <div className="a-empty">
        <h2>No commune yet.</h2>
        <p>Create one to track individual shares.</p>
        <button className="a-btn" type="button" onClick={() => go("commune-new")}>Create a commune</button>
      </div>
    );
  }
  return (
    <SettleScreen />
  );
}

export { RecurringScreen } from "./Recurring";
export { FundsScreen } from "./Funds";
