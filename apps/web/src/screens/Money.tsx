import { useState } from "react";
import { PARK_EXPENSES } from "../data/household";
import { useApp } from "../state";
import { Avatar, Choose, Pill } from "../ui/widgets";
import { cx } from "../ui/cx";

export function ExpensesScreen() {
  const { go, hubId, createdExpenses } = useApp();
  const [filter, setFilter] = useState<"All" | "Open" | "Recurring" | "Settled">("All");
  const source = hubId === "created" ? createdExpenses : PARK_EXPENSES;
  const rows = source.filter((row) => {
    if (filter === "All") return true;
    if (filter === "Open") return row.open === true;
    if (filter === "Settled") return row.status === "settled";
    if (filter === "Recurring") return row.name === "Virgin Media" || row.name === "British Gas" || row.name === "Rent · August" || row.name === "Council tax";
    return true;
  });

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
              <tr key={row.name}>
                <td data-label="Expense">
                  {row.open ? (
                    <button className="a-name-btn" type="button" onClick={() => go("expense")}>
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
                          { label: "Mark paid", onSelect: () => go("expense-paid") },
                          { label: "Nudge", onSelect: () => go("notices") },
                        ]}
                      />
                    </div>
                  </td>
                ) : row.action === "mark-paid" ? (
                  <td data-label="Actions">
                    <div className="a-row-actions">
                      <button className="a-btn" type="button" onClick={() => go("expense-paid")}>
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
  const { go } = useApp();
  return (
    <>
      <div className="a-settle-hero">
        <div className="a-panel a-settle-card">
          <span>You owe</span>
          <strong>£42.00</strong>
          <div style={{ color: "var(--ink-soft)", fontSize: 13 }}>Pay Jordan · British Gas share</div>
        </div>
        <div className="a-panel a-settle-card">
          <span>You’re owed</span>
          <strong>£18.00</strong>
          <div style={{ color: "var(--ink-soft)", fontSize: 13 }}>Jordan · Tesco (your extra)</div>
        </div>
      </div>
      <div className="a-card">
        <div className="a-card-head">
          <div>
            <h2>Suggested transfers</h2>
            <p className="sub">Net the Tesco £18 against the gas bill, or keep them separate — your call.</p>
          </div>
          <button className="a-btn ghost" type="button" onClick={() => go("breakdown")}>
            Breakdown
          </button>
        </div>
        <div className="a-move">
          <div className="a-arrow">→</div>
          <div>
            <div className="names">You → Jordan</div>
            <div className="why">British Gas share · or £24 if you net Tesco</div>
          </div>
          <div className="amt">£42</div>
          <Choose
            items={[
              { label: "Pay Jordan", onSelect: () => go("pay") },
              { label: "Mark paid", onSelect: () => go("expense-paid") },
            ]}
          />
        </div>
        <div className="a-move">
          <div className="a-arrow">→</div>
          <div>
            <div className="names">Jordan → You</div>
            <div className="why">Tesco extras from Monday</div>
          </div>
          <div className="amt">£18</div>
          <button className="a-btn nudge" type="button" onClick={() => go("notices")}>
            Nudge
          </button>
        </div>
        <div className="a-move" style={{ opacity: 0.72 }}>
          <div className="a-arrow" style={{ background: "#f0ece4" }}>
            ↔
          </div>
          <div>
            <div className="names">Alex ↔ You</div>
            <div className="why">Nothing outstanding</div>
          </div>
          <div className="amt" style={{ color: "var(--ink-soft)" }}>
            £0
          </div>
          <Pill tone="settled">Even</Pill>
        </div>
      </div>
    </>
  );
}

export function SettleEvenScreen() {
  const { go, hub } = useApp();
  return (
    <div className="a-empty">
      <h2>You’re even.</h2>
      <p>
        {hub.name} has nothing to send this cycle.
        {hub.id === "studio" ? " Ink on Monday still gets logged as an expense." : " Add an expense when something is shared."}
      </p>
      <button className="a-btn" type="button" onClick={() => go("add-expense", { hub: hub.id })}>
        {hub.id === "studio" ? "Log the ink" : "Add expense"}
      </button>
    </div>
  );
}

export function RecurringScreen() {
  const { go, emptyHub, hub } = useApp();
  if (emptyHub || hub.id === "created") {
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
            <tr>
              <td>
                <strong>Rent</strong>
              </td>
              <td>1st</td>
              <td>House fund</td>
              <td>
                <Pill tone="settled">Auto</Pill>
              </td>
              <td className="amt">£1,800</td>
            </tr>
            <tr>
              <td>
                <strong>Virgin Media</strong>
              </td>
              <td>12th</td>
              <td>Maya Chen</td>
              <td>
                <Pill tone="open">Open</Pill>
              </td>
              <td className="amt">£32.00</td>
            </tr>
            <tr>
              <td>
                <strong>Council tax</strong>
              </td>
              <td>1st</td>
              <td>Maya Chen</td>
              <td>
                <Pill tone="settled">Settled</Pill>
              </td>
              <td className="amt">£146.00</td>
            </tr>
            <tr>
              <td>
                <strong>British Gas</strong>
              </td>
              <td>~28th</td>
              <td>Jordan Hale</td>
              <td>
                <Pill tone="warn">Due Friday</Pill>
              </td>
              <td className="amt">£94.20</td>
            </tr>
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
