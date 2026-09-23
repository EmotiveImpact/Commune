import { useState, type FormEvent } from "react";
import { useApp } from "../state";
import { Avatar, Pill } from "../ui/widgets";
import { cx } from "../ui/cx";
import { LIMITS } from "../data/limits";

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
          Add expense
        </button>
      </div>
      <div className="a-panel">
        <table className="a-table">
          <thead>
            <tr>
              <th>Expense</th>
              <th>Category</th>
              <th>Paid by</th>
              <th>Due</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Amount</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td data-label="Expense">
                  {row.open ? (
                    <button
                      className="a-name-btn"
                      type="button"
                      onClick={() => go("expense", { expense: row.id })}
                    >
                      {row.name}
                    </button>
                  ) : (
                    <strong>{row.name}</strong>
                  )}
                </td>
                <td data-label="Category">{row.category}</td>
                <td data-label="Paid by">{row.paidBy}</td>
                <td data-label="Due">{row.due}</td>
                <td data-label="Status">
                  <Pill tone={row.status}>{row.statusLabel}</Pill>
                </td>
                <td className="amt" data-label="Amount">
                  {row.amount}
                </td>
                <td data-label="Actions">
                  <div className="a-row-actions">
                    <button className="a-btn ghost" type="button" onClick={() => go("expense", { expense: row.id })}>
                      View shares
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={7}>No expenses match this view.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
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
          Add expense
        </button>
      </div>
      <div className="a-empty">
        <h2>Nothing shared this cycle.</h2>
        <p>The first bill is how the house starts telling the truth.</p>
      </div>
    </>
  );
}

export function SettleScreen() {
  const { go, hub, expenses, session, reminderTargets, sendReminder, confirmExpenseShare } = useApp();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
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
      setMessage("In-app nudge sent. Email delivery is not configured locally.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send the nudge.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <>
      <div className="a-settle-hero">
        <div className="a-panel a-settle-card">
          <span>You owe</span>
          <strong>{formatMoney(youOwe, hub.currency)}</strong>
          <div style={{ color: "var(--ink-soft)", fontSize: 13 }}>
            {youOwe ? "Pay your share outside Commune; the bill payer confirms receipt." : "Nothing to send this cycle"}
          </div>
        </div>
        <div className="a-panel a-settle-card">
          <span>You’re owed</span>
          <strong>{formatMoney(youAreOwed, hub.currency)}</strong>
          <div style={{ color: "var(--ink-soft)", fontSize: 13 }}>
            {youAreOwed ? "Confirm each share after you receive payment." : "Nothing waiting to collect"}
          </div>
        </div>
      </div>
      <div className="a-card">
        <div className="a-card-head">
          <div>
            <h2>Outstanding shares</h2>
            <p className="sub">Each share is tracked separately. Commune does not move money.</p>
          </div>
          <button className="a-btn ghost" type="button" onClick={() => go("breakdown")}>
            Breakdown
          </button>
        </div>
        {error ? <p className="a-form-error" role="alert">{error}</p> : null}
        {message ? <p className="a-window-note" role="status">{message}</p> : null}
        {moves.length ? moves.map(({ expense, share, outstanding }) => {
          const payer = hub.members.find((member) => member.userId === expense.paidByUserId);
          const debtor = hub.members.find((member) => member.userId === share.userId);
          const receiving = expense.paidByUserId === me;
          const target = receiving
            ? reminderTargets.find((item) => item.kind === "nudge" && item.sourceId === share.id)
            : undefined;
          const cooldown = target?.lastSentAt && Date.now() - Date.parse(target.lastSentAt) < 72 * 60 * 60 * 1000;
          return (
            <div
              className="a-move"
              key={share.id}
            >
              <div className="a-arrow">→</div>
              <div>
                <div className="names">{receiving ? `${debtor?.name ?? "Member"} → You` : `You → ${payer?.name ?? "Bill payer"}`}</div>
                <div className="why">{expense.name}{expense.dueOn ? ` · due ${expense.dueOn}` : ""}</div>
              </div>
              <div className="amt">{formatMoney(outstanding, hub.currency)}</div>
              {receiving ? (
                <div className="a-row-actions">
                  {target && !cooldown ? (
                    <button className="a-btn nudge" type="button" disabled={pendingId !== null} onClick={() => void nudge(share.id)}>
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
        }) : (
          <div className="a-empty" style={{ minHeight: 180 }}>
            <h2>Everyone is even.</h2>
            <p>No share is waiting in {hub.name}.</p>
          </div>
        )}
      </div>
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
    hub, session, funds, reminderTargets,
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
          <div className="a-panel" key={fund.id} style={{ marginBottom: 20 }}>
            <div className="a-fund-hero">
              <div>
                <span>{fund.name}</span>
                <strong>{formatMoney(fund.contributedMinor ?? 0, hub.currency)}</strong>
                <p>{fund.targetMinor !== null ? `Target ${formatMoney(fund.targetMinor, hub.currency)}` : "No target set"} · recorded contributions, not money held by Commune</p>
              </div>
              <Pill tone="sage">{fund.commitments.length} pledge{fund.commitments.length === 1 ? "" : "s"}</Pill>
            </div>
            {fund.commitments.map((commitment) => {
              const member = hub.members.find((item) => item.userId === commitment.userId);
              const outstanding = commitment.amountMinor - commitment.contributedMinor;
              const reminder = reminderTargets.find((item) => item.kind === "chase" && item.sourceId === commitment.id);
              const cooldown = reminder?.lastSentAt && Date.now() - Date.parse(reminder.lastSentAt) < 72 * 60 * 60 * 1000;
              return (
                <div className="a-settle-row" key={commitment.id}>
                  <Avatar tone="house" initials={member?.ini ?? "?"} />
                  <div style={{ flex: 1 }}>
                    <strong>{member?.name ?? "Member"}</strong>
                    <div className="when">Pledged {formatMoney(commitment.amountMinor, hub.currency)} · due {commitment.dueOn} · recorded {formatMoney(commitment.contributedMinor, hub.currency)}</div>
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
                      {reminder && !cooldown ? (
                        <button className="a-btn nudge" type="button" disabled={pending} onClick={() => void run(() => sendReminder("chase", commitment.id), "In-app chase sent. Email delivery is not configured locally.")}>Chase</button>
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
          </div>
        );
      })}
    </>
  );
}
