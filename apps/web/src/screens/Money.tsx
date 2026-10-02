import { useState, type FormEvent } from "react";
import { useApp } from "../state";
import { Avatar, Pill } from "../ui/widgets";
import { cx } from "../ui/cx";
import { LIMITS } from "../data/limits";
import { RecipientReminderCount, reminderLimitReached } from "../ui/ReminderUsage";
import { Plus, ReceiptText, ChevronRight, HandCoins } from "lucide-react";
import { ReminderConfirm } from "../ui/ReminderConfirm";
import "./Money.css";

function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(minor / 100);
}

function parseMoney(value: string): number | null {
  const clean = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(clean)) return null;
  const [pounds, pennies = ""] = clean.split(".");
  const minor = Number(pounds) * 100 + Number(pennies.padEnd(2, "0"));
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

export function ExpensesScreen() {
  const { go, expenses, searchQuery, setSearchQuery } = useApp();
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
              onClick={() => setFilter(chip)}
            >
              {chip}
            </button>
          ))}
        </div>
        {needle ? (
          <button className="a-chip is-on" type="button" onClick={() => setSearchQuery("")}>
            Search: {searchQuery} ×
          </button>
        ) : null}
        <button className="a-btn" type="button" onClick={() => go("add-expense")}>
          <Plus size={16} aria-hidden="true" /> Add expense
        </button>
      </div>
      <section className="c-expense-list" aria-label="Shared expenses">
        {rows.map(row => <button className="c-expense-entry" type="button" key={row.id} onClick={() => go("expense", { expense: row.id })}>
          <span className="c-money-icon"><ReceiptText size={19} strokeWidth={1.5} /></span>
          <span className="c-expense-copy"><strong>{row.name}</strong><small>{row.paidBy} · {row.category}{row.dueOn ? ` · due ${row.due}` : ""}</small></span>
          <span className="c-expense-amount"><strong>{row.amount}</strong><Pill tone={row.status}>{row.statusLabel}</Pill></span>
          <ChevronRight size={16} aria-hidden="true" />
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
                  {target && !cooldown && !quotaReached ? (
                    <button className="a-btn nudge" type="button" disabled={pendingId !== null} onClick={() => { setError(""); setReminderFor({ id: share.id, name: debtor?.name ?? "your housemate", subject: expense.name, amount: formatMoney(outstanding, hub.currency) }); }}>
                      Nudge
                    </button>
                  ) : null}
                  <button className="a-btn ghost" type="button" disabled={pendingId !== null} onClick={() => void confirm(share.id)}>
                    Confirm received
                  </button>
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
  const { go, hub, session } = useApp();
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
    <div className="a-empty">
      <h2>You’re even.</h2>
      <p>{hub.name} has no outstanding shares for you. Add an expense when something is shared.</p>
      <button className="a-btn" type="button" onClick={() => go("add-expense", { hub: hub.id })}>
        Add expense
      </button>
    </div>
  );
}

export function RecurringScreen() {
  const { go } = useApp();
  return (
    <div className="a-empty">
      <h2>Recurring bills are not enabled yet.</h2>
      <p>New expenses are one-off entries. Nothing will be created or charged automatically.</p>
      <button className="a-btn" type="button" onClick={() => go("add-expense")}>Add a one-off expense</button>
    </div>
  );
}

export function FundsScreen() {
  const {
    hub, session, funds, reminderTargets, reminderUsage,
    createFund, pledgeFund, recordFundContribution, sendReminder,
  } = useApp();
  const [newFundOpen, setNewFundOpen] = useState(false);
  const [fundName, setFundName] = useState("");
  const [target, setTarget] = useState("");
  const [pledgeFor, setPledgeFor] = useState<string | null>(null);
  const [pledgeAmount, setPledgeAmount] = useState("");
  const [pledgeDue, setPledgeDue] = useState("");
  const [contributionFor, setContributionFor] = useState<string | null>(null);
  const [contributionAmount, setContributionAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const isAdmin = hub.role === "admin";

  async function run(action: () => Promise<unknown>, success: string) {
    setError("");
    setMessage("");
    setPending(true);
    try {
      await action();
      setMessage(success);
      setNewFundOpen(false);
      setPledgeFor(null);
      setContributionFor(null);
      setFundName("");
      setTarget("");
      setPledgeAmount("");
      setPledgeDue("");
      setContributionAmount("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The change could not be saved.");
    } finally {
      setPending(false);
    }
  }

  function submitFund(event: FormEvent) {
    event.preventDefault();
    const targetMinor = target.trim() ? parseMoney(target) : null;
    if (!fundName.trim() || (target.trim() && targetMinor === null)) {
      setError("Enter a fund name and a valid target amount.");
      return;
    }
    void run(() => createFund(fundName.trim(), targetMinor ?? undefined), "Fund created.");
  }

  function submitPledge(event: FormEvent, fundId: string) {
    event.preventDefault();
    const amountMinor = parseMoney(pledgeAmount);
    if (amountMinor === null || !pledgeDue) {
      setError("Enter a pledge amount and a due date.");
      return;
    }
    void run(() => pledgeFund(fundId, amountMinor, pledgeDue), "Your pledge was saved for this commune.");
  }

  function submitContribution(event: FormEvent, commitmentId: string, outstanding: number) {
    event.preventDefault();
    const amountMinor = parseMoney(contributionAmount);
    if (amountMinor === null || amountMinor > outstanding) {
      setError(`Enter an amount up to ${formatMoney(outstanding, hub.currency)}.`);
      return;
    }
    void run(
      () => recordFundContribution(commitmentId, amountMinor),
      "Contribution recorded. Commune did not take a payment.",
    );
  }

  if (!hub.id) {
    return (
      <div className="a-empty">
        <h2>No commune yet.</h2>
        <p>Create one before setting up a fund.</p>
      </div>
    );
  }

  return (
    <>
      <div className="a-toolbar">
        {isAdmin ? (
          <button className="a-btn" type="button" onClick={() => setNewFundOpen((open) => !open)}>
            {newFundOpen ? "Cancel" : "Create fund"}
          </button>
        ) : null}
      </div>
      {error ? <p className="a-form-error" role="alert">{error}</p> : null}
      {message ? <p className="a-window-note" role="status">{message}</p> : null}
      {newFundOpen ? (
        <form className="a-panel" onSubmit={submitFund}>
          <div className="a-field"><label htmlFor="fund-name">Fund name</label><input id="fund-name" value={fundName} onChange={(event) => setFundName(event.target.value)} maxLength={LIMITS.fundName} required /><span className="a-field-limit">{fundName.length}/{LIMITS.fundName}</span></div>
          <div className="a-field"><label htmlFor="fund-target">Target (optional)</label><input id="fund-target" value={target} onChange={(event) => setTarget(event.target.value)} inputMode="decimal" maxLength={LIMITS.money} placeholder="0.00" /></div>
          <button className="a-btn" type="submit" disabled={pending}>Save fund</button>
        </form>
      ) : null}
      {!funds.length ? (
        <div className="a-empty">
          <h2>No fund yet.</h2>
          <p>{isAdmin ? "Create a fund, then members can pledge to it." : "An admin can create a fund for this commune."}</p>
        </div>
      ) : funds.map((fund) => {
        const myPledge = fund.commitments.find((commitment) => commitment.userId === session?.userId);
        return (
          <section className="a-panel c-fund-card" key={fund.id} aria-label={fund.name}>
            <div className="a-fund-hero">
              <div>
                <span className="c-fund-title"><HandCoins size={18} strokeWidth={1.5} aria-hidden="true" />{fund.name}</span>
                <strong>{formatMoney(fund.contributedMinor ?? 0, hub.currency)}</strong>
                <p>{fund.targetMinor !== null ? `Target ${formatMoney(fund.targetMinor, hub.currency)}` : "No target set"} · recorded contributions, not money held by Commune</p>
              </div>
              <Pill tone="sage">{fund.commitments.length} pledge{fund.commitments.length === 1 ? "" : "s"}</Pill>
            </div>
            {fund.targetMinor !== null && fund.targetMinor > 0 && <div className="c-fund-progress">
              <div role="progressbar" aria-label={`${fund.name} target progress`} aria-valuemin={0} aria-valuemax={fund.targetMinor} aria-valuenow={Math.min(fund.contributedMinor ?? 0, fund.targetMinor)} aria-valuetext={`${formatMoney(fund.contributedMinor ?? 0, hub.currency)} recorded of ${formatMoney(fund.targetMinor, hub.currency)}`}><span style={{ width: `${Math.min(100, ((fund.contributedMinor ?? 0) / fund.targetMinor) * 100)}%` }} /></div>
              <small>{formatMoney(Math.max(0, fund.targetMinor - (fund.contributedMinor ?? 0)), hub.currency)} to target</small>
            </div>}
            {fund.commitments.map((commitment) => {
              const member = hub.members.find((item) => item.userId === commitment.userId);
              const outstanding = commitment.amountMinor - commitment.contributedMinor;
              const reminder = reminderTargets.find((item) => item.kind === "chase" && item.sourceId === commitment.id);
              const cooldown = reminder?.lastSentAt && Date.now() - Date.parse(reminder.lastSentAt) < 72 * 60 * 60 * 1000;
              const quotaReached = reminderLimitReached(reminderUsage, commitment.userId);
              return (
                <div className="a-settle-row" key={commitment.id}>
                  <Avatar tone="house" initials={member?.ini ?? "?"} />
                  <div style={{ flex: 1 }}>
                    <strong>{member?.name ?? "Member"}</strong>
                    <div className="when">Pledged {formatMoney(commitment.amountMinor, hub.currency)} · due {commitment.dueOn} · recorded {formatMoney(commitment.contributedMinor, hub.currency)}</div>
                    {isAdmin && (reminder || (reminderUsage?.recipientUsage[commitment.userId] ?? 0) > 0) ? (
                      <RecipientReminderCount usage={reminderUsage} recipientId={commitment.userId} />
                    ) : null}
                    {contributionFor === commitment.id && isAdmin && outstanding > 0 ? (
                      <form className="a-field-row" onSubmit={(event) => submitContribution(event, commitment.id, outstanding)}>
                        <input aria-label={`Contribution from ${member?.name ?? "member"}`} value={contributionAmount} onChange={(event) => setContributionAmount(event.target.value)} inputMode="decimal" maxLength={LIMITS.money} placeholder="0.00" />
                        <button className="a-btn" type="submit" disabled={pending}>Record</button>
                      </form>
                    ) : null}
                  </div>
                  <Pill tone={outstanding ? "open" : "settled"}>{outstanding ? formatMoney(outstanding, hub.currency) + " due" : "Paid"}</Pill>
                  {isAdmin && outstanding > 0 ? (
                    <div className="a-row-actions">
                      <button className="a-btn ghost" type="button" disabled={pending} onClick={() => setContributionFor(contributionFor === commitment.id ? null : commitment.id)}>Record contribution</button>
                      {reminder && !cooldown && !quotaReached ? (
                        <button className="a-btn nudge" type="button" disabled={pending} onClick={() => void run(() => sendReminder("chase", commitment.id), "Chase sent in Commune.")}>Chase</button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {!myPledge ? (
              <div className="a-settle-row">
                {pledgeFor === fund.id ? (
                  <form className="a-field-row" onSubmit={(event) => submitPledge(event, fund.id)}>
                    <input aria-label="Your pledge amount" value={pledgeAmount} onChange={(event) => setPledgeAmount(event.target.value)} inputMode="decimal" maxLength={LIMITS.money} placeholder="Amount, e.g. 25.00" />
                    <input aria-label="Pledge due date" type="date" value={pledgeDue} onChange={(event) => setPledgeDue(event.target.value)} />
                    <button className="a-btn" type="submit" disabled={pending}>Save pledge</button>
                  </form>
                ) : (
                  <button className="a-btn ghost" type="button" onClick={() => setPledgeFor(fund.id)}>Make a pledge</button>
                )}
              </div>
            ) : null}
          </section>
        );
      })}
    </>
  );
}
