import { useState } from "react";
import { useApp } from "../state";
import { Avatar, Choose, Pill } from "../ui/widgets";
import { cx } from "../ui/cx";

export function ExpensesScreen() {
  const { go, expenses, markExpensePaid, searchQuery, setSearchQuery } = useApp();
  const [filter, setFilter] = useState<"All" | "Open" | "Recurring" | "Settled">("All");
  const needle = searchQuery.trim().toLocaleLowerCase();
  const rows = expenses
    .filter((row) => {
      if (filter === "All") return true;
      if (filter === "Open") return row.open === true;
      if (filter === "Settled") return row.status === "settled";
      if (filter === "Recurring") return row.recurring === true;
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
          {(["All", "Open", "Recurring", "Settled"] as const).map((chip) => (
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
                {row.action === "choose" ? (
                  <td data-label="Actions">
                    <div className="a-row-actions">
                      <Choose
                        items={[
                          {
                            label: "Mark paid",
                            onSelect: () => {
                              markExpensePaid(row.id);
                              go("expense-paid", { expense: row.id });
                            },
                          },
                          { label: "Nudge", onSelect: () => go("notices") },
                        ]}
                      />
                    </div>
                  </td>
                ) : row.action === "mark-paid" ? (
                  <td data-label="Actions">
                    <div className="a-row-actions">
                      <button
                        className="a-btn"
                        type="button"
                        onClick={() => {
                          markExpensePaid(row.id);
                          go("expense-paid", { expense: row.id });
                        }}
                      >
                        Mark paid
                      </button>
                    </div>
                  </td>
                ) : (
                  <td className="a-muted-action" data-label="Actions">
                    —
                  </td>
                )}
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
  const { go } = useApp();
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
  const { go, hub, expenses, markExpensePaid } = useApp();
  const park = hub.id === "park";
  const gasExpense = expenses.find(
    (row) => row.name.toLocaleLowerCase() === "british gas" && row.open === true,
  );
  const gasOpen = Boolean(gasExpense);
  const settleMoves = park && !gasOpen
    ? hub.moves.filter((move) => !move.names.startsWith("You →"))
    : hub.moves;
  const youOwe = park ? (gasOpen ? "£42.00" : "£0.00") : hub.credit ? "£0.00" : hub.oweAmount;
  const owed = park ? "£18.00" : hub.credit ? hub.oweAmount : "£0.00";
  const owedCopy = park
    ? "Jordan · Tesco (your extra)"
    : hub.credit
      ? hub.oweCopy
      : "Nothing waiting to collect this cycle";
  return (
    <>
      <div className="a-settle-hero">
        <div className="a-panel a-settle-card">
          <span>You owe</span>
          <strong>{youOwe}</strong>
          <div style={{ color: "var(--ink-soft)", fontSize: 13 }}>
            {park
              ? gasOpen
                ? "Pay Jordan · British Gas share"
                : "British Gas is marked paid"
              : hub.credit
                ? "Nothing to send this cycle"
                : hub.oweCopy}
          </div>
        </div>
        <div className="a-panel a-settle-card">
          <span>You’re owed</span>
          <strong>{owed}</strong>
          <div style={{ color: "var(--ink-soft)", fontSize: 13 }}>{owedCopy}</div>
        </div>
      </div>
      <div className="a-card">
        <div className="a-card-head">
          <div>
            <h2>Suggested transfers</h2>
            <p className="sub">
              {park
                ? gasOpen
                  ? "Net the Tesco £18 against the gas bill, or keep them separate — your call."
                  : "British Gas is settled. Jordan still owes you for Tesco."
                : hub.credit
                  ? "People can settle their shares separately."
                  : "Mark your share paid when the transfer is complete."}
            </p>
          </div>
          <button className="a-btn ghost" type="button" onClick={() => go("breakdown")}>
            Breakdown
          </button>
        </div>
        {settleMoves.length ? settleMoves.map((move) => {
          const moveExpense = move.expenseId
            ? expenses.find((row) => row.id === move.expenseId)
            : undefined;
          const moveExpenseId = moveExpense?.id;
          return (
            <div
              className="a-move"
              key={`${move.expenseId ?? "balance"}-${move.names}-${move.amt}`}
              style={move.even ? { opacity: 0.72 } : undefined}
            >
              <div className="a-arrow" style={move.even ? { background: "#f0ece4" } : undefined}>
                {move.arrow}
              </div>
              <div>
                <div className="names">{move.names}</div>
                <div className="why">{move.why}</div>
              </div>
              <div className="amt" style={move.even ? { color: "var(--ink-soft)" } : undefined}>
                {move.amt}
              </div>
              {move.even ? (
                <Pill tone="settled">Even</Pill>
              ) : move.names.startsWith("You →") ? (
                <Choose
                  items={[
                    ...(park && moveExpenseId === gasExpense?.id
                      ? [{
                          label: "Pay Jordan",
                          onSelect: () => go("pay", { expense: moveExpenseId }),
                        }]
                      : []),
                    {
                      label: "Mark paid",
                      onSelect: () => {
                        if (!moveExpenseId) return;
                        markExpensePaid(moveExpenseId);
                        go("expense-paid", { expense: moveExpenseId });
                      },
                    },
                  ]}
                />
              ) : (
                <button className="a-btn nudge" type="button" onClick={() => go("notices")}>
                  Nudge
                </button>
              )}
            </div>
          );
        }) : (
          <div className="a-empty" style={{ minHeight: 180 }}>
            <h2>Everyone is even.</h2>
            <p>No transfer is waiting in {hub.name}.</p>
          </div>
        )}
      </div>
    </>
  );
}

export function SettleEvenScreen() {
  const { go, hub } = useApp();
  const inkPending = hub.id === "studio" && hub.oweCta.includes("Log");
  return (
    <div className="a-empty">
      <h2>You’re even.</h2>
      <p>
        {hub.name} has nothing to send this cycle.
        {inkPending ? " Ink on Monday still gets logged as an expense." : " Add an expense when something is shared."}
      </p>
      <button className="a-btn" type="button" onClick={() => go("add-expense", { hub: hub.id })}>
        {inkPending ? "Log the ink" : "Add expense"}
      </button>
    </div>
  );
}

export function RecurringScreen() {
  const { go, emptyHub, hub, expenses } = useApp();
  const recurringExpenses = expenses
    .filter((expense) => expense.recurring)
    .filter(
      (expense, index, rows) =>
        rows.findIndex(
          (row) => row.name.toLocaleLowerCase() === expense.name.toLocaleLowerCase(),
        ) === index,
    );
  if (emptyHub || (hub.id === "created" && !recurringExpenses.length)) {
    return (
      <div className="a-empty">
        <h2>No recurring bills yet.</h2>
        <p>Rent, wifi, the ones that come back. Add them once the first expense exists.</p>
        <button className="a-btn" type="button" onClick={() => go("add-expense")}>
          Add expense
        </button>
      </div>
    );
  }
  const expenseRows = recurringExpenses.map((expense) => ({
    id: expense.id,
    name: expense.name,
    when: expense.due,
    paidBy: expense.paidBy,
    status: expense.statusLabel,
    tone: expense.status,
    amount: expense.amount,
  }));
  const lisbonHold =
    expenses.find(
      (expense) =>
        expense.name.toLocaleLowerCase() === "airbnb hold" && expense.open === true,
    ) ??
    expenses.find(
      (expense) => expense.name.toLocaleLowerCase() === "airbnb hold",
    );
  const rows =
    hub.id === "studio"
      ? [
          ...(expenseRows.some((row) => row.name === "Printer ink")
            ? []
            : [{ id: "studio-printer-plan", name: "Printer ink", when: "Monday", paidBy: "Sam Okonkwo", status: "Due Monday", tone: "warn" as const, amount: "—" }]),
          ...expenseRows,
          { id: "studio-guest-wifi", name: "Guest wifi", when: "4 Sept", paidBy: "Studio East", status: "Soon", tone: "warn" as const, amount: "—" },
        ]
      : hub.id === "lisbon"
        ? lisbonHold
          ? [{
              id: lisbonHold.id,
              name: lisbonHold.name,
              when: lisbonHold.due,
              paidBy: lisbonHold.paidBy,
              status: lisbonHold.statusLabel,
              tone: lisbonHold.status,
              amount: lisbonHold.amount,
            }]
          : []
        : expenseRows;
  return (
    <>
      <div className="a-toolbar">
        <button className="a-btn ghost" type="button" onClick={() => go("templates")}>
          Split templates
        </button>
      </div>
      <div className="a-panel">
        <table className="a-table">
          <thead>
            <tr>
              <th>Bill</th>
              <th>When</th>
              <th>Paid by</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.name}</strong>
                </td>
                <td>{row.when}</td>
                <td>{row.paidBy}</td>
                <td>
                  <Pill tone={row.tone}>{row.status}</Pill>
                </td>
                <td className="amt">{row.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function FundsScreen() {
  const { go, emptyHub, hub } = useApp();
  if (emptyHub || hub.id === "created") {
    return (
      <div className="a-empty">
        <h2>Fund is empty.</h2>
        <p>Nothing in yet. The house pot starts when someone pays in.</p>
      </div>
    );
  }
  if (hub.id !== "park") {
    const fund = hub.kpis[0];
    return (
      <div className="a-panel">
        <div className="a-fund-hero">
          <div>
            <span>{fund.kicker}</span>
            <strong>{fund.num}</strong>
            <p>{fund.hint}</p>
          </div>
          <Pill tone="sage">{hub.id === "studio" ? "Ready for ink" : "Trip pot"}</Pill>
        </div>
        <div className="a-settle-row">
          <Avatar tone="maya" initials="MC" />
          <span>{hub.id === "studio" ? "Nobody is waiting to be repaid" : "Airbnb hold already paid by you"}</span>
          <span className="amt">{hub.id === "studio" ? "Even" : "Paid"}</span>
        </div>
      </div>
    );
  }
  return (
    <div className="a-panel">
      <div className="a-fund-hero">
        <div>
          <span>Balance</span>
          <strong>£420</strong>
          <p>Target £600 this cycle · £180 still to collect</p>
        </div>
        <button className="a-btn" type="button" onClick={() => go("notices")}>
          Chase Alex
        </button>
      </div>
      <div className="a-settle-row">
        <Avatar tone="maya" initials="MC" />
        <span>Maya paid in</span>
        <span className="amt">£200</span>
      </div>
      <div className="a-settle-row">
        <Avatar tone="jordan" initials="JH" />
        <span>Jordan paid in</span>
        <span className="amt">£220</span>
      </div>
      <div className="a-settle-row">
        <Avatar tone="alex" initials="AR" />
        <span>Alex still to pay</span>
        <Pill tone="open">£180 due</Pill>
      </div>
    </div>
  );
}
