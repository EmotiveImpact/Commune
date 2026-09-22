import { useEffect, useState, type CSSProperties } from "react";
import { NOTE_BODY_HINT } from "../data/household";
import { todayIso } from "../data/operations";
import { useApp } from "../state";
import { Icon } from "../ui/Icon";
import { Avatar, Choose, Pill, Switch } from "../ui/widgets";
import { ImagePick } from "../ui/photos";
import { cx } from "../ui/cx";
import { OperationEdit, OperationNew, OperationView } from "./OperationsWindows";

const NOTE_TYPES = [
  ["wifi", "Wi-Fi"],
  ["bins", "Bins"],
  ["keys", "Keys / door"],
  ["landlord", "Landlord"],
  ["emergency", "Emergency"],
  ["rules", "House rules"],
  ["other", "Other"],
] as const;

export function Windows() {
  const {
    window,
    closeWindow,
    go,
    notes,
    noteKey,
    selectedExpense,
    selectedOperation,
    addNote,
  } = useApp();
  useEffect(() => {
    if (!window) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeWindow();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeWindow, window]);
  if (!window) return null;
  const title =
    window === "expense" || window === "expense-paid"
      ? selectedExpense?.name ?? "Expense"
      : window === "note"
      ? notes[noteKey]?.title ?? "Note"
      : window === "operation" || window === "operation-edit"
        ? selectedOperation?.title ?? "Schedule item"
        : titleFor(window);

  return (
    <div className="a-windows">
      <button className="a-window-back" type="button" aria-label="Close" onClick={closeWindow} />
      <div className="a-window-frame" role="dialog" aria-modal="true" aria-labelledby="commune-window-title">
        <header className="a-window-bar">
          <h2 id="commune-window-title">{title}</h2>
          <button className="a-window-x" type="button" aria-label="Close" onClick={closeWindow}>
            <Icon name="close" size={16} />
          </button>
        </header>
        <div className="a-window-body">
          {window === "notices" && <Notices />}
          {window === "add-expense" && <AddExpense />}
          {window === "expense" && <Expense />}
          {window === "expense-paid" && <ExpensePaid />}
          {window === "commune-new" && <CommuneNew />}
          {window === "member-invite" && <MemberInvite />}
          {window === "profile" && <Profile />}
          {window === "breakdown" && <Breakdown />}
          {window === "pay" && <Pay />}
          {window === "pay-method" && <PayMethod />}
          {window === "note" && <NoteCardView />}
          {window === "note-new" && <NoteNew onSave={addNote} />}
          {window === "operation" && <OperationView />}
          {window === "operation-new" && <OperationNew />}
          {window === "operation-edit" && <OperationEdit />}
        </div>
      </div>
    </div>
  );
}

function titleFor(id: string): string {
  const map: Record<string, string> = {
    notices: "Notices",
    "add-expense": "Add expense",
    expense: "British Gas",
    "expense-paid": "British Gas",
    "commune-new": "New commune",
    "member-invite": "Invite",
    profile: "Profile",
    breakdown: "Breakdown",
    pay: "Pay Jordan",
    "pay-method": "Pay me",
    "note-new": "Add note",
    "operation-new": "Add to calendar",
    "operation-edit": "Edit",
  };
  return map[id] ?? id;
}

function Notices() {
  const { go, emptyHub, hub, operationsByHub, noticesOn } = useApp();
  const bins = operationsByHub[hub.id]
    .filter((item) => item.title === "Put the bins out" && item.status === "open")
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const binsOverdue = Boolean(bins && bins.date < todayIso());
  if (!noticesOn) {
    return (
      <section className="a-window">
        <p className="a-window-kicker">Bell</p>
        <p className="a-window-note">Notices are paused. Turn them back on in Settings when you want the bell to surface bills and chores.</p>
        <button className="a-btn" type="button" onClick={() => go("settings")}>Open settings</button>
      </section>
    );
  }
  if (emptyHub || !hub.now.length) {
    return (
      <section className="a-window">
        <p className="a-window-kicker">Bell</p>
        <p className="a-window-note">You’re caught up. Nothing needs you in this hub.</p>
      </section>
    );
  }
  return (
    <section className="a-window">
      <p className="a-window-kicker">Bell</p>
      {hub.now.map((row) => {
        const isBins = row.title === "Bins" && bins;
        return (
          <button
            className="a-notice"
            type="button"
            key={`${row.tag}-${row.title}`}
            onClick={() =>
              isBins
                ? go("operation", { operation: bins.id })
                : go(row.go)
            }
          >
            <Pill tone={isBins ? (binsOverdue ? "warn" : "open") : row.pill}>
              {isBins ? (binsOverdue ? "Overdue" : "Tuesday") : row.tag}
            </Pill>
            <div className="grow">
              <strong>{row.title}</strong>
              <div className="when">
                {isBins
                  ? `${bins.assignee?.split(" ")[0] ?? "Unassigned"} · ${bins.date}`
                  : row.when}
              </div>
            </div>
          </button>
        );
      })}
    </section>
  );
}

function AddExpense() {
  const {
    go,
    closeWindow,
    hub,
    you,
    session,
    expenses,
    currency: defaultCurrency,
    recordExpense,
  } = useApp();
  const ledgerSymbol = expenses
    .map((expense) => expense.amount.match(/[£$€]/)?.[0])
    .find((symbol): symbol is string => Boolean(symbol));
  const configuredSymbol = session?.createdHub?.currency.match(/[£$€]/)?.[0];
  const defaultSymbol = defaultCurrency.match(/[£$€]/)?.[0];
  const resolvedSymbol =
    hub.id === "created"
      ? ledgerSymbol ?? configuredSymbol ?? defaultSymbol ?? "£"
      : "£";
  const defaults =
    hub.id === "park"
      ? { what: "British Gas", amount: "£94.20", payer: "Jordan Hale", category: "Utilities", due: "29 Aug", recurring: true }
      : hub.id === "studio"
        ? { what: "Printer ink", amount: "", payer: "Sam Okonkwo", category: "Supplies", due: "Monday", recurring: true }
        : hub.id === "lisbon"
          ? { what: "Airbnb hold", amount: "", payer: you.name, category: "Stay", due: "Thursday", recurring: false }
          : { what: "", amount: "", payer: you.name, category: "Other", due: "Today", recurring: false };
  const [what, setWhat] = useState(defaults.what);
  const [amount, setAmount] = useState(defaults.amount);
  const [payer, setPayer] = useState(defaults.payer);
  const [category, setCategory] = useState(defaults.category);
  const [due, setDue] = useState(defaults.due);
  const [recurring, setRecurring] = useState(defaults.recurring);
  const [split, setSplit] = useState(
    hub.members.length === 1 ? "You · 100%" : `Equal · ${hub.members.length} ways`,
  );
  const [error, setError] = useState("");

  function save() {
    const name = what.trim();
    const numeric = Number.parseFloat(amount.replace(/[^0-9.-]/g, ""));
    if (!name) {
      setError("Name the expense before saving it.");
      return;
    }
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    const amt = `${resolvedSymbol}${numeric.toFixed(2)}`;
    const id = recordExpense({
      name,
      amount: amt,
      paidBy: payer,
      category,
      due: due.trim() || "Today",
      recurring,
      split,
    });
    go("expense", { expense: id });
  }

  return (
    <section className="a-window">
      <p className="a-window-kicker">Expense</p>
      <div className="a-field">
        <label htmlFor="exp-what">What</label>
        <input
          id="exp-what"
          type="text"
          value={what}
          onChange={(e) => setWhat(e.target.value)}
          placeholder="e.g. Rent"
        />
      </div>
      <div className="a-field half">
        <label htmlFor="exp-amt">Amount</label>
        <input id="exp-amt" type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`${resolvedSymbol}0.00`} />
      </div>
      <div className="a-field half">
        <label htmlFor="exp-who">Paid by</label>
        <select id="exp-who" value={payer} onChange={(e) => setPayer(e.target.value)}>
          {hub.members.map((member) => (
            <option key={member.name}>{member.name}</option>
          ))}
        </select>
      </div>
      <div className="a-field half">
        <label htmlFor="exp-category">Category</label>
        <select id="exp-category" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option>Utilities</option>
          <option>Internet</option>
          <option>Groceries</option>
          <option>Rent</option>
          <option>Supplies</option>
          <option>Travel</option>
          <option>Stay</option>
          <option>Other</option>
        </select>
      </div>
      <div className="a-field half">
        <label htmlFor="exp-due">Due</label>
        <input id="exp-due" type="text" value={due} onChange={(e) => setDue(e.target.value)} placeholder="Today" />
      </div>
      <div className="a-field">
        <label htmlFor="exp-split">Split</label>
        <select id="exp-split" value={split} onChange={(e) => setSplit(e.target.value)}>
          {hub.members.length === 1 ? <option>You · 100%</option> : null}
          {hub.members.length > 1 ? <option>Equal · {hub.members.length} ways</option> : null}
          {hub.id === "park" ? <option>Rent from fund</option> : null}
          {hub.id === "park" ? <option>Maya + Jordan only</option> : null}
        </select>
      </div>
      <div className="a-settle-row">
        <div>
          <strong>Recurring</strong>
          <div className="when">Show this expense in the recurring list.</div>
        </div>
        <Switch checked={recurring} onChange={setRecurring} label="Recurring expense" />
      </div>
      {error ? <p className="a-form-error" role="alert">{error}</p> : null}
      <div className="a-field-row">
        <button className="a-btn" type="button" onClick={save}>
          Save
        </button>
        <button className="a-btn ghost" type="button" onClick={closeWindow}>
          Cancel
        </button>
      </div>
    </section>
  );
}

function Expense() {
  const { go, closeWindow, hub, selectedExpense, you, markExpensePaid } = useApp();
  if (!selectedExpense) {
    return (
      <section className="a-window">
        <p className="a-window-note">That expense isn’t in this hub.</p>
      </section>
    );
  }
  const payer = hub.members.find((member) => member.name === selectedExpense.paidBy);
  const isOpen = selectedExpense.open === true;
  const others = hub.members
    .filter((member) => member.name !== selectedExpense.paidBy)
    .map((member) => member.name.split(" ")[0])
    .join(" · ");
  return (
    <section className="a-window">
      <p className="a-window-kicker">Expense</p>
      <div className="a-fund-hero">
        <div>
          <span className="a-hero-kicker">
            {selectedExpense.category} · {selectedExpense.due}
          </span>
          <strong>{selectedExpense.name}</strong>
          <p>
            {selectedExpense.paidBy} paid {selectedExpense.amount}. {isOpen ? "This expense is still open." : "This expense is settled."}
          </p>
        </div>
        <Pill tone={selectedExpense.status}>{selectedExpense.statusLabel}</Pill>
      </div>
      <div className="a-split">
        <div className="a-split-row">
          <Avatar tone={payer?.cls ?? "maya"} initials={payer?.ini ?? you.initials} />
          <div className="grow">
            <strong>{selectedExpense.paidBy}</strong>
            <div className="when">Paid · {selectedExpense.amount}</div>
          </div>
          <Pill tone="settled">Paid in</Pill>
        </div>
        {others ? (
          <div className="a-split-row">
            <Avatar tone="house" initials={String(hub.members.length)} />
            <div className="grow">
              <strong>Shared in {hub.name}</strong>
              <div className="when">{selectedExpense.split ?? others}</div>
            </div>
            <Pill tone={isOpen ? "open" : "settled"}>{isOpen ? "Open" : "Settled"}</Pill>
          </div>
        ) : null}
      </div>
      <div className="a-field-row">
        {isOpen ? (
          <Choose
            items={[
              {
                label: hub.id === "lisbon" ? "Mark settled" : "Mark paid",
                onSelect: () => {
                  markExpensePaid(selectedExpense.id);
                  go("expense-paid", { expense: selectedExpense.id });
                },
              },
              { label: "Open notices", onSelect: () => go("notices") },
            ]}
          />
        ) : null}
        <button className="a-btn ghost" type="button" onClick={closeWindow}>
          Close
        </button>
      </div>
    </section>
  );
}

function ExpensePaid() {
  const { go, closeWindow, selectedExpense, hub } = useApp();
  if (!selectedExpense) {
    return (
      <section className="a-window">
        <p className="a-window-note">That expense isn’t in this hub.</p>
      </section>
    );
  }
  return (
    <section className="a-window">
      <p className="a-window-kicker">Expense</p>
      <div className="a-fund-hero">
        <div>
          <span className="a-hero-kicker">{selectedExpense.category}</span>
          <strong>{selectedExpense.name}</strong>
          <p>{selectedExpense.name} is marked settled in {hub.name}.</p>
        </div>
        <Pill tone="settled">{hub.id === "lisbon" ? "Settled" : "You paid"}</Pill>
      </div>
      <div className="a-field-row">
        <button
          className="a-btn"
          type="button"
          onClick={() => {
            closeWindow();
            go("settle");
          }}
        >
          Open settlement
        </button>
        <button className="a-btn ghost" type="button" onClick={closeWindow}>
          Close
        </button>
      </div>
    </section>
  );
}

function CommuneNew() {
  const { closeWindow, createHub } = useApp();
  const [name, setName] = useState("Studio East");
  const [type, setType] = useState<"Household" | "Workspace" | "Trip">("Workspace");
  const [currency, setCurrency] = useState("£ GBP");
  const [error, setError] = useState("");
  return (
    <section className="a-window">
      <p className="a-window-kicker">Places</p>
      <div className="a-field">
        <label htmlFor="new-name">Name</label>
        <input id="new-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="a-field half">
        <label htmlFor="new-type">Type</label>
        <select
          id="new-type"
          value={type}
          onChange={(e) => setType(e.target.value as "Household" | "Workspace" | "Trip")}
        >
          <option>Household</option>
          <option>Workspace</option>
          <option>Trip</option>
        </select>
      </div>
      <div className="a-field half">
        <label htmlFor="new-cur">Currency</label>
        <select id="new-cur" value={currency} onChange={(e) => setCurrency(e.target.value)}>
          <option>£ GBP</option>
          <option>$ USD</option>
          <option>€ EUR</option>
        </select>
      </div>
      <div className="a-field-row">
        <button
          className="a-btn"
          type="button"
          onClick={() => {
            const created = createHub({ name: name.trim() || "New commune", type, currency });
            if (!created) {
              setError("Your Standard plan already has its newly created commune. Open it from the switcher, or review Billing before adding another.");
            }
          }}
        >
          Create
        </button>
        <button className="a-btn ghost" type="button" onClick={closeWindow}>
          Cancel
        </button>
      </div>
      {error ? <p className="a-form-error" role="alert">{error}</p> : null}
    </section>
  );
}

function MemberInvite() {
  const { go, closeWindow, addInvite } = useApp();
  const [email, setEmail] = useState("ness@lisbon.trip");
  const [role, setRole] = useState<"Member" | "Admin">("Member");
  const [error, setError] = useState("");
  return (
    <section className="a-window">
      <p className="a-window-kicker">Members</p>
      <div className="a-field">
        <label htmlFor="inv-email">Email</label>
        <input id="inv-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </div>
      <div className="a-field">
        <label htmlFor="inv-role">Role</label>
        <select id="inv-role" value={role} onChange={(event) => setRole(event.target.value as "Member" | "Admin")}>
          <option>Member</option>
          <option>Admin</option>
        </select>
      </div>
      <div className="a-field-row">
        <button
          className="a-btn"
          type="button"
          onClick={() => {
            if (!addInvite({ email, role })) {
              setError("Enter a valid email that is not already pending.");
              return;
            }
            go("members");
          }}
        >
          Send invite
        </button>
        <button className="a-btn ghost" type="button" onClick={closeWindow}>
          Cancel
        </button>
      </div>
      <p className="a-window-note">V1 saves pending invites in this browser session. It does not pretend an email was sent without a mail service.</p>
      {error ? <p className="a-form-error" role="alert">{error}</p> : null}
    </section>
  );
}

function Profile() {
  const { go, you, setAvatar, payMethods, places } = useApp();
  return (
    <section className="a-window">
      <p className="a-window-kicker">You</p>
      <div className="a-avatar-edit">
        <Avatar tone="maya" initials={you.initials} />
        <div className="who">
          <strong>{you.name}</strong>
          <span>{you.email}</span>
          <ImagePick
            label="Change photo"
            clearLabel="Remove"
            hasCustom={Boolean(you.photo)}
            maxEdge={320}
            inputLabel="Your photo"
            onPhoto={setAvatar}
            onClear={() => setAvatar(null)}
          />
        </div>
        <Pill tone="sage">You</Pill>
      </div>
      <p className="a-window-note">
        People settle you through these. Tap Pay on Settle and they open with the amount filled.
      </p>
      {payMethods.map((method, index) => (
        <div className="a-settle-row" key={method.provider}>
          <div>
            <strong>{method.provider}</strong>
            <div className="when">{method.value}</div>
          </div>
          {index === 0 ? (
            <Pill tone="sage">Default</Pill>
          ) : (
            <button className="a-btn ghost" type="button" onClick={() => go("pay-method")}>
              Edit
            </button>
          )}
        </div>
      ))}
      <div className="a-field-row">
        <button className="a-btn" type="button" onClick={() => go("pay-method")}>
          Add a pay link
        </button>
      </div>
      <div className="a-settle-row">
        <div>
          <strong>Plan</strong>
          <div className="when">Standard · 8 members · {places.length} {places.length === 1 ? "hub" : "hubs"}</div>
        </div>
        <button className="a-btn ghost" type="button" onClick={() => go("billing")}>
          Billing
        </button>
      </div>
      <div className="a-settle-row">
        <div>
          <strong>Settings</strong>
          <div className="when">Currency, notices, sidebar</div>
        </div>
        <button className="a-btn ghost" type="button" onClick={() => go("settings")}>
          Open
        </button>
      </div>
    </section>
  );
}

function Breakdown() {
  const { go, closeWindow, hub } = useApp();
  return (
    <section className="a-window">
      <p className="a-window-kicker">Settle</p>
      <div className="a-toolbar">
        <button
          className="a-btn"
          type="button"
          onClick={() => {
            closeWindow();
            go("settle");
          }}
        >
          Open settlement
        </button>
      </div>
      <div className="a-card a-owes">
        {hub.moves.map((move) => (
          <button
            className={cx("a-move", move.even && "is-even")}
            type="button"
            key={`${move.names}-${move.amt}`}
            onClick={() => go("settle")}
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
          </button>
        ))}
      </div>
    </section>
  );
}

function Pay() {
  const { go, closeWindow, selectedExpense, markExpensePaid } = useApp();
  const expenseId = selectedExpense?.id ?? "park-british-gas";
  return (
    <section className="a-window">
      <p className="a-window-kicker">Settle</p>
      <div className="a-pay-hero">
        <span className="a-hero-kicker">You → Jordan</span>
        <strong>£42.00</strong>
        <p>
          Opens his pay link with the amount filled. Commune does not take the money — Revolut, PayPal, or the bank
          does.
        </p>
      </div>
      <a className="a-pay-link" href="https://revolut.me/jordanhale/42.00" target="_blank" rel="noreferrer">
        <strong>Revolut</strong>
        <span>@jordanhale · £42.00</span>
      </a>
      <a className="a-pay-link" href="https://paypal.me/jordanhale/42.00" target="_blank" rel="noreferrer">
        <strong>PayPal</strong>
        <span>paypal.me/jordanhale/42.00</span>
      </a>
      <div className="a-settle-row">
        <div>
          <strong>Bank transfer</strong>
          <div className="when">Sort 04-00-04 · 12345678</div>
        </div>
        <button
          className="a-btn ghost"
          type="button"
          onClick={() => void navigator.clipboard?.writeText("04-00-04 12345678")}
        >
          Copy
        </button>
      </div>
      <div className="a-field-row">
        <button
          className="a-btn"
          type="button"
          onClick={() => {
            markExpensePaid(expenseId);
            go("expense-paid", { expense: expenseId });
          }}
        >
          I’ve paid
        </button>
        <button className="a-btn ghost" type="button" onClick={closeWindow}>
          Not now
        </button>
      </div>
    </section>
  );
}

function PayMethod() {
  const { go, closeWindow, savePayMethod } = useApp();
  const [provider, setProvider] = useState<"Revolut" | "PayPal" | "Monzo" | "Bank transfer">("Revolut");
  const [value, setValue] = useState("@mayachen");
  const [error, setError] = useState("");
  return (
    <section className="a-window">
      <p className="a-window-kicker">You</p>
      <div className="a-field">
        <label htmlFor="pm-prov">How people pay you</label>
        <select
          id="pm-prov"
          value={provider}
          onChange={(event) => setProvider(event.target.value as typeof provider)}
        >
          <option>Revolut</option>
          <option>PayPal</option>
          <option>Monzo</option>
          <option>Bank transfer</option>
        </select>
      </div>
      <div className="a-field">
        <label htmlFor="pm-link">Username or link</label>
        <input id="pm-link" type="text" value={value} onChange={(event) => setValue(event.target.value)} />
      </div>
      <div className="a-field-row">
        <button
          className="a-btn"
          type="button"
          onClick={() => {
            if (!savePayMethod({ provider, value })) {
              setError("Add a username, payment link, or bank reference.");
              return;
            }
            go("profile");
          }}
        >
          Save
        </button>
        <button className="a-btn ghost" type="button" onClick={closeWindow}>
          Cancel
        </button>
      </div>
      {error ? <p className="a-form-error" role="alert">{error}</p> : null}
    </section>
  );
}

function NoteCardView() {
  const { notes, noteKey, go, closeWindow } = useApp();
  const card = notes[noteKey];
  if (!card) {
    return (
      <section className="a-window">
        <p className="a-window-note">That note isn’t here.</p>
      </section>
    );
  }
  return (
    <section className="a-window">
      <div className="a-fund-hero">
        <div>
          <span className="a-hero-kicker">{card.kicker}</span>
          <strong>{card.title}</strong>
          <p>{card.lede}</p>
        </div>
        <Pill tone="sage">{card.pill}</Pill>
      </div>
      <div className="a-note-facts">
        {card.facts.map(([k, v]) => (
          <div key={k} className="a-note-fact">
            <span>{k}</span>
            <strong>{v}</strong>
          </div>
        ))}
      </div>
      <p className="a-window-note">{card.body}</p>
      <div className="a-field-row">
        <button className="a-btn" type="button" onClick={() => go("note-new")}>
          Add another
        </button>
        <button className="a-btn ghost" type="button" onClick={closeWindow}>
          Close
        </button>
      </div>
    </section>
  );
}

function NoteNew({ onSave }: { onSave: (card: { id: string; title: string; pill: string; kicker: string; lede: string; body: string; facts: Array<[string, string]> }) => void }) {
  const { go, closeWindow } = useApp();
  const [type, setType] = useState<(typeof NOTE_TYPES)[number][0]>("wifi");
  const [title, setTitle] = useState("Guest wifi");
  const [body, setBody] = useState(
    "Same SSID as the house. Password lives on the router card in the kitchen drawer.",
  );
  const [pin, setPin] = useState(true);
  const [who, setWho] = useState<"everyone" | "admins">("everyone");
  const [net, setNet] = useState("ParkStreet_Guest");
  const [pass, setPass] = useState("sage14guest");
  const [code, setCode] = useState("");
  const [day, setDay] = useState("");
  const [where, setWhere] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [detail, setDetail] = useState("");

  function extra(kind: string): CSSProperties {
    const show =
      (kind === "wifi" && type === "wifi") ||
      (kind === "keys" && type === "keys") ||
      (kind === "bins" && type === "bins") ||
      (kind === "landlord" && (type === "landlord" || type === "emergency")) ||
      (kind === "landlord-only" && type === "landlord") ||
      (kind === "emergency" && type === "emergency") ||
      (kind === "other" && (type === "other" || type === "rules"));
    return { display: show ? undefined : "none" };
  }

  function save() {
    const typeLabel = NOTE_TYPES.find((t) => t[0] === type)?.[1] ?? "Note";
    const facts: Array<[string, string]> = [];
    if (type === "wifi") {
      if (net) facts.push(["Network", net]);
      if (pass) facts.push(["Password", pass]);
    }
    if (type === "keys" && code) facts.push(["Door code", code]);
    if (type === "bins") {
      if (day) facts.push(["Collection", day]);
      if (where) facts.push(["Where", where]);
    }
    if (type === "landlord" || type === "emergency") {
      if (phone) facts.push(["Phone", phone]);
    }
    if (type === "landlord" && email) facts.push(["Email", email]);
    if (type === "emergency" && contact) facts.push(["Who to call", contact]);
    if ((type === "other" || type === "rules") && detail) facts.push(["Detail", detail]);
    facts.push(["Who can see", who === "admins" ? "Admins" : "Everyone"]);
    if (pin) facts.push(["This Hub", "Pinned"]);
    const id = `added-${Date.now()}`;
    onSave({
      id,
      title: title || typeLabel,
      pill: typeLabel,
      kicker: `${pin ? "Pinned · " : ""}${who}`,
      lede: facts[0]?.[1] ?? body,
      body,
      facts,
    });
    go("note", { note: id });
  }

  return (
    <section className="a-window">
      <p className="a-window-kicker">Note</p>
      <div className="a-field">
        <label htmlFor="note-title">
          Title <span className="need">Required</span>
        </label>
        <input id="note-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="a-field">
        <label>
          Type <span className="need">Required</span>
        </label>
        <div className="a-note-types" role="group" aria-label="Type">
          {NOTE_TYPES.map(([id, label]) => (
            <button key={id} type="button" className={cx(type === id && "is-on")} onClick={() => setType(id)}>
              {label}
            </button>
          ))}
        </div>
        <p className="hint">Type only changes the extras. The note below stays, so you can keep writing.</p>
      </div>
      <div className="a-field half" style={extra("wifi")}>
        <label htmlFor="note-net">Network</label>
        <input id="note-net" value={net} onChange={(e) => setNet(e.target.value)} />
      </div>
      <div className="a-field half" style={extra("wifi")}>
        <label htmlFor="note-pass">Password</label>
        <input id="note-pass" value={pass} onChange={(e) => setPass(e.target.value)} />
      </div>
      <div className="a-field" style={extra("keys")}>
        <label htmlFor="note-code">Door code</label>
        <input id="note-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="4821" />
      </div>
      <div className="a-field half" style={extra("bins")}>
        <label htmlFor="note-day">Collection</label>
        <input id="note-day" value={day} onChange={(e) => setDay(e.target.value)} placeholder="Black bags Tuesday" />
      </div>
      <div className="a-field half" style={extra("bins")}>
        <label htmlFor="note-where">Where they go</label>
        <input id="note-where" value={where} onChange={(e) => setWhere(e.target.value)} placeholder="Alley behind the kitchen" />
      </div>
      <div className="a-field half" style={extra("landlord")}>
        <label htmlFor="note-phone">Phone</label>
        <input id="note-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div className="a-field half" style={extra("landlord-only")}>
        <label htmlFor="note-email">Email</label>
        <input id="note-email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="a-field" style={extra("emergency")}>
        <label htmlFor="note-contact">Who to call</label>
        <input id="note-contact" value={contact} onChange={(e) => setContact(e.target.value)} />
      </div>
      <div className="a-field" style={extra("other")}>
        <label htmlFor="note-extra">Detail</label>
        <input id="note-extra" value={detail} onChange={(e) => setDetail(e.target.value)} />
      </div>
      <div className="a-field">
        <label htmlFor="note-body">
          Note <span className="need">Required</span>
        </label>
        <textarea
          id="note-body"
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={NOTE_BODY_HINT[type]}
        />
        <p className="hint">Always here. Add the story after the type extras.</p>
      </div>
      <div className="a-field half">
        <label>Pin on This Hub</label>
        <div className="a-seg" role="group" aria-label="Pin on This Hub">
          <button type="button" className={cx(!pin && "is-on")} onClick={() => setPin(false)}>
            Off
          </button>
          <button type="button" className={cx(pin && "is-on")} onClick={() => setPin(true)}>
            Pin
          </button>
        </div>
      </div>
      <div className="a-field half">
        <label>Who should know</label>
        <div className="a-seg" role="group" aria-label="Who should know">
          <button type="button" className={cx(who === "everyone" && "is-on")} onClick={() => setWho("everyone")}>
            Everyone
          </button>
          <button type="button" className={cx(who === "admins" && "is-on")} onClick={() => setWho("admins")}>
            Admins
          </button>
        </div>
      </div>
      <div className="a-field-row">
        <button className="a-btn" type="button" onClick={save}>
          Save
        </button>
        <button className="a-btn ghost" type="button" onClick={closeWindow}>
          Cancel
        </button>
      </div>
    </section>
  );
}
