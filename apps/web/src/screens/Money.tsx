import { useState } from "react";
import { useApp } from "../state";
import { Avatar, Pill } from "../ui/widgets";
import { cx } from "../ui/cx";
import { RecipientReminderCount, reminderLimitReached } from "../ui/ReminderUsage";
import { Plus, ReceiptText, ChevronRight, Search } from "lucide-react";
import { LIMITS } from "../data/limits";
import { ReminderConfirm } from "../ui/ReminderConfirm";
import { CalendarDate } from "../ui/CalendarDate";
import "./Money.css";

function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(minor / 100);
}

export function ExpensesScreen() {
  const { go, expenses, session, hub } = useApp();
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"All" | "Open" | "Settled">("All");
  const needle = searchQuery.trim().toLocaleLowerCase();
  const rows = expenses
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
          {(["All", "Open", "Settled"] as const).map((chip) => (
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
      <p className="c-scope-label">{rows.length} {rows.length === 1 ? "expense" : "expenses"} · {formatMoney(rows.reduce((sum, row) => sum + row.amountMinor, 0), hub.currency)} total recorded in this view</p>
      <section className="c-expense-list" aria-label="Shared expenses">
        {rows.map(row => <button className="c-expense-entry" type="button" key={row.id} onClick={() => go("expense", { expense: row.id })}>
          <span className="c-expense-card-head"><span className="c-money-icon"><ReceiptText size={19} strokeWidth={1.5} aria-hidden="true" /></span><span className="c-expense-copy"><strong>{row.name}</strong></span><Pill tone={row.status}>{row.statusLabel}</Pill></span>
          <span className="c-expense-amount"><span><small>Total paid</small><strong>{row.amount}</strong></span><span className="c-expense-personal"><small>Your share</small><span>{row.shares.some(share => share.userId === session?.userId) ? formatMoney(row.shares.find(share => share.userId === session?.userId)!.amountMinor, hub.currency) : "Not included"}</span></span></span>
          <span className="c-expense-card-foot">{row.dueOn && <CalendarDate date={row.dueOn} label="Due" />}<span className="c-expense-footer-copy"><span>Paid by {row.paidBy}</span><small>{row.category}{row.dueOn ? ` · due ${row.due}` : ""}</small></span><ChevronRight size={16} aria-hidden="true" /></span>
        </button>)}
        {!rows.length && <p className="c-money-empty">No expenses match this view. Try another filter or search.</p>}
      </section>
    </>
  );
}

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
  const { go, hub, expenses, session, reminderTargets, reminderUsage, sendReminder, confirmExpenseShare } = useApp();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reminderFor, setReminderFor] = useState<{ id: string; name: string; subject: string; amount: string } | null>(null);
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

  async function confirm(shareId: string) {
    setError("");
    setMessage("");
    setPendingId(shareId);
    try {
      await confirmExpenseShare(shareId);
      setMessage("Share confirmed as received. No payment was taken by Commune.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not confirm the share.");
    } finally {
      setPendingId(null);
    }
  }

  async function nudge(sourceId: string) {
    setError("");
    setMessage("");
    setPendingId(sourceId);
    try {
      await sendReminder("nudge", sourceId);
      setReminderFor(null);
      setMessage("Nudge sent in Commune.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send the nudge.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <>
        {error ? <p className="a-form-error" role="alert">{error}</p> : null}
        {message ? <p className="a-window-note" role="status">{message}</p> : null}
      <div className="c-settle-columns">{[false, true].map(receivingGroup => <section className="a-panel c-settle-column" aria-label={receivingGroup ? "You’re owed" : "You owe"} key={String(receivingGroup)}>
        <h2>{receivingGroup ? "You’re owed" : "You owe"}</h2>
        <strong className="c-settle-total">{formatMoney(receivingGroup ? youAreOwed : youOwe, hub.currency)}</strong>
        <p className="c-settle-explainer">{receivingGroup ? "Confirm each share after you receive payment." : "Pay outside Commune; the bill payer confirms receipt."}</p>
        {moves.filter(({ expense }) => (expense.paidByUserId === me) === receivingGroup).map(({ expense, share, outstanding }) => {
          const payer = hub.members.find((member) => member.userId === expense.paidByUserId);
          const debtor = hub.members.find((member) => member.userId === share.userId);
          const receiving = expense.paidByUserId === me;
          const target = receiving
            ? reminderTargets.find((item) => item.kind === "nudge" && item.sourceId === share.id)
            : undefined;
          const cooldown = target?.lastSentAt && Date.now() - Date.parse(target.lastSentAt) < 72 * 60 * 60 * 1000;
          const quotaReached = reminderLimitReached(reminderUsage, share.userId);
          const reminderReason = quotaReached ? "Reminder allowance reached." : cooldown ? `Next nudge ${new Date(Date.parse(target!.lastSentAt!) + 72 * 60 * 60 * 1000).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.` : !target ? (expense.dueOn ? `Nudge available from ${expense.due}.` : "Add a due date to enable reminders.") : "";
          return (
            <div
              className="a-move"
              key={share.id}
            >
              <Avatar tone={receiving ? debtor?.cls ?? "house" : payer?.cls ?? "house"} initials={receiving ? debtor?.ini ?? "?" : payer?.ini ?? "?"} />
              <div>
                <div className="names">{receiving ? `${debtor?.name ?? "Member"} owes you` : `You owe ${payer?.name ?? "the bill payer"}`}</div>
                <div className="why">{expense.name}{expense.dueOn ? ` · due ${expense.dueOn}` : ""}</div>
                {receiving && (target || (reminderUsage?.recipientUsage[share.userId] ?? 0) > 0) ? (
                  <RecipientReminderCount usage={reminderUsage} recipientId={share.userId} />
                ) : null}
              </div>
              <div className="amt">{formatMoney(outstanding, hub.currency)}</div>
              {receiving ? (
                <div className="a-row-actions">
                    <button className="a-btn nudge" type="button" disabled={pendingId !== null || !!reminderReason} title={reminderReason || undefined} onClick={() => { setError(""); setReminderFor({ id: share.id, name: debtor?.name ?? "your housemate", subject: expense.name, amount: formatMoney(outstanding, hub.currency) }); }}>
                      Nudge
                    </button>
                  <button className="a-btn ghost" type="button" disabled={pendingId !== null} onClick={() => void confirm(share.id)}>
                    Confirm received
                  </button>
                  {reminderReason && <p className="c-action-hint">{reminderReason}</p>}
                </div>
              ) : (
                <span className="sub">Awaiting payer confirmation</span>
              )}
            </div>
          );
        })}
        {!(receivingGroup ? youAreOwed : youOwe) && <p className="c-money-empty">{receivingGroup ? "Nothing waiting to collect." : "Nothing to pay."}</p>}
      </section>)}</div>
      <div className="c-settle-footer"><p>Each share is tracked separately. Commune does not move money.</p><button className="a-btn ghost" type="button" onClick={() => go("breakdown")}>View breakdown</button></div>
      {reminderFor && <ReminderConfirm {...reminderFor} remaining={reminderUsage ? Math.max(0, reminderUsage.totalLimit - reminderUsage.totalUsed) : null} pending={pendingId !== null} error={error} onClose={() => setReminderFor(null)} onSend={() => void nudge(reminderFor.id)} />}
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
