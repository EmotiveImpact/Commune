import { useState, type CSSProperties } from "react";
import { NOTE_BODY_HINT } from "../data/household";
import { todayIso } from "../data/operations";
import { useApp } from "../state";
import { Icon } from "../ui/Icon";
import { Avatar, Choose, Pill } from "../ui/widgets";
import { cx } from "../ui/cx";
import { OperationNew, OperationView } from "./OperationsWindows";

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
  const { window, closeWindow, go, notes, noteKey, selectedOperation, addNote } = useApp();
  if (!window) return null;
  const title =
    window === "note"
      ? notes[noteKey]?.title ?? "Note"
      : window === "operation"
        ? selectedOperation?.title ?? "Schedule item"
        : titleFor(window);

  return (
    <div className="a-windows">
      <button className="a-window-back" type="button" aria-label="Close" onClick={closeWindow} />
      <div className="a-window-frame">
        <header className="a-window-bar">
          <h2>{title}</h2>
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
  };
  return map[id] ?? id;
}

function Notices() {
  const { go, emptyHub, hub, operationsByHub } = useApp();
  const bins = operationsByHub.park
    .filter((item) => item.title === "Put the bins out" && item.status === "open")
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const binsOverdue = Boolean(bins && bins.date < todayIso());
  if (emptyHub || hub.id === "created") {
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
      <button className="a-notice" type="button" onClick={() => go("expenses")}>
        <Pill tone="warn">Friday</Pill>
        <div className="grow">
          <strong>British Gas</strong>
          <div className="when">£94.20 · Jordan paid · your share open</div>
        </div>
      </button>
      {bins ? (
        <button
          className="a-notice"
          type="button"
          onClick={() => go("operation", { hub: "park", operation: bins.id })}
        >
          <Pill tone={binsOverdue ? "warn" : "open"}>{binsOverdue ? "Overdue" : "Tuesday"}</Pill>
          <div className="grow">
            <strong>Bins</strong>
            <div className="when">
              {bins.assignee?.split(" ")[0] ?? "Unassigned"} · {bins.date}
            </div>
          </div>
        </button>
      ) : null}
      <button className="a-notice" type="button" onClick={() => go("funds")}>
        <Pill tone="open">Collect</Pill>
        <div className="grow">
          <strong>Alex · house fund</strong>
          <div className="when">£180 still to pay in</div>
        </div>
      </button>
    </section>
  );
}

function AddExpense() {
  const { go, closeWindow, hub, you, recordExpense } = useApp();
  const fresh = hub.id === "created";
  const [what, setWhat] = useState(fresh ? "" : "British Gas");
  const [amount, setAmount] = useState(fresh ? "" : "£94.20");
  const [payer, setPayer] = useState(fresh ? you.name : "Jordan Hale");

  function save() {
    const name = what.trim() || (fresh ? "Expense" : "British Gas");
    const amt = amount.trim() || (fresh ? "£0" : "£94.20");
    if (fresh) recordExpense({ name, amount: amt, paidBy: payer });
    go("expense");
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
          placeholder={fresh ? "e.g. Rent" : undefined}
        />
      </div>
      <div className="a-field half">
        <label htmlFor="exp-amt">Amount</label>
        <input id="exp-amt" type="text" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="£0.00" />
      </div>
      <div className="a-field half">
        <label htmlFor="exp-who">Paid by</label>
        <select id="exp-who" value={payer} onChange={(e) => setPayer(e.target.value)}>
          {hub.members.map((member) => (
            <option key={member.name}>{member.name}</option>
          ))}
        </select>
      </div>
      <div className="a-field">
        <label htmlFor="exp-split">Split</label>
        <select id="exp-split">
          {fresh ? <option>You · 100%</option> : null}
          {!fresh ? <option>Equal · three ways</option> : null}
          {!fresh ? <option>Rent from fund</option> : null}
          {!fresh ? <option>Maya + Jordan only</option> : null}
        </select>
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

function Expense() {
  const { go, closeWindow, hub, lastExpense, you } = useApp();
  if (hub.id === "created" && lastExpense) {
    return (
      <section className="a-window">
        <p className="a-window-kicker">Expense</p>
        <div className="a-fund-hero">
          <div>
            <span className="a-hero-kicker">Just you · open</span>
            <strong>{lastExpense.name}</strong>
            <p>
              {lastExpense.paidBy} paid {lastExpense.amount}. Nobody else is on this hub yet.
            </p>
          </div>
          <Pill tone="open">Open</Pill>
        </div>
        <div className="a-split">
          <div className="a-split-row">
            <Avatar tone="maya" initials={you.initials} />
            <div className="grow">
              <strong>{you.name}</strong>
              <div className="when">Paid · {lastExpense.amount}</div>
            </div>
            <Pill tone="settled">You</Pill>
          </div>
        </div>
        <div className="a-field-row">
          <button className="a-btn" type="button" onClick={closeWindow}>
            Close
          </button>
        </div>
      </section>
    );
  }
  return (
    <section className="a-window">
      <p className="a-window-kicker">Expense</p>
      <div className="a-fund-hero">
        <div>
          <span className="a-hero-kicker">Utilities · due Friday</span>
          <strong>British Gas</strong>
          <p>Jordan paid £94.20. Split three ways. Your share is still open.</p>
        </div>
        <Pill tone="warn">Due Friday</Pill>
      </div>
      <div className="a-split">
        <div className="a-split-row">
          <Avatar tone="jordan" initials="JH" />
          <div className="grow">
            <strong>Jordan Hale</strong>
            <div className="when">Paid the bill</div>
          </div>
          <Pill tone="settled">Paid in</Pill>
        </div>
        <div className="a-split-row">
          <Avatar tone="maya" initials="MC" />
          <div className="grow">
            <strong>Maya Chen</strong>
            <div className="when">Your share · £31.40</div>
          </div>
          <Pill tone="warn">Open</Pill>
        </div>
        <div className="a-split-row">
          <Avatar tone="alex" initials="AR" />
          <div className="grow">
            <strong>Alex Rivera</strong>
            <div className="when">Share · £31.40</div>
          </div>
          <Pill tone="open">Open</Pill>
        </div>
      </div>
      <div className="a-field-row">
        <Choose
          items={[
            { label: "Mark my share paid", onSelect: () => go("expense-paid") },
            { label: "Nudge Alex", onSelect: () => go("notices") },
          ]}
        />
        <button className="a-btn ghost" type="button" onClick={closeWindow}>
          Close
        </button>
      </div>
    </section>
  );
}

function ExpensePaid() {
  const { go, closeWindow } = useApp();
  return (
    <section className="a-window">
      <p className="a-window-kicker">Expense</p>
      <div className="a-fund-hero">
        <div>
          <span className="a-hero-kicker">Utilities</span>
          <strong>British Gas</strong>
          <p>Your share is marked paid. Settle still has You → Jordan if you net Tesco.</p>
        </div>
        <Pill tone="settled">You paid</Pill>
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
          onClick={() => createHub({ name: name.trim() || "New commune", type, currency })}
        >
          Create
        </button>
        <button className="a-btn ghost" type="button" onClick={closeWindow}>
          Cancel
        </button>
      </div>
    </section>
  );
}

function MemberInvite() {
  const { go, closeWindow } = useApp();
  return (
    <section className="a-window">
      <p className="a-window-kicker">Members</p>
      <div className="a-field">
        <label htmlFor="inv-email">Email</label>
        <input id="inv-email" type="email" defaultValue="ness@lisbon.trip" />
      </div>
      <div className="a-field">
        <label htmlFor="inv-role">Role</label>
        <select id="inv-role">
          <option>Member</option>
          <option>Admin</option>
        </select>
      </div>
      <div className="a-field-row">
        <button className="a-btn" type="button" onClick={() => go("members")}>
          Send invite
        </button>
        <button className="a-btn ghost" type="button" onClick={closeWindow}>
          Cancel
        </button>
      </div>
    </section>
  );
}

function Profile() {
  const { go, you } = useApp();
  return (
    <section className="a-window">
      <p className="a-window-kicker">You</p>
      <div className="a-member-row">
        <Avatar tone="maya" initials={you.initials} />
        <div className="who">
          <strong>{you.name}</strong>
          <span>{you.email}</span>
        </div>
        <Pill tone="sage">You</Pill>
      </div>
      <p className="a-window-note">
        People settle you through these. Tap Pay on Settle and they open with the amount filled.
      </p>
      <div className="a-settle-row">
        <div>
          <strong>Revolut</strong>
          <div className="when">@mayachen</div>
        </div>
        <Pill tone="sage">Default</Pill>
      </div>
      <div className="a-settle-row">
        <div>
          <strong>PayPal</strong>
          <div className="when">paypal.me/mayachen</div>
        </div>
        <button className="a-btn ghost" type="button" onClick={() => go("pay-method")}>
          Edit
        </button>
      </div>
      <div className="a-settle-row">
        <div>
          <strong>Monzo</strong>
          <div className="when">Not added</div>
        </div>
        <button className="a-btn ghost" type="button" onClick={() => go("pay-method")}>
          Add
        </button>
      </div>
      <div className="a-field-row">
        <button className="a-btn" type="button" onClick={() => go("pay-method")}>
          Add a pay link
        </button>
      </div>
      <div className="a-settle-row">
        <div>
          <strong>Plan</strong>
          <div className="when">Standard · 8 members · 1 hub</div>
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
  const { go, closeWindow } = useApp();
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
        <button className="a-move" type="button" onClick={() => go("settle")}>
          <div className="a-arrow">→</div>
          <div>
            <div className="names">You → Jordan</div>
            <div className="why">Gas share · or £24 if you net Tesco</div>
          </div>
          <div className="amt">£42</div>
        </button>
        <button className="a-move" type="button" onClick={() => go("settle")}>
          <div className="a-arrow">→</div>
          <div>
            <div className="names">Jordan → You</div>
            <div className="why">Tesco extras from Monday</div>
          </div>
          <div className="amt">£18</div>
        </button>
        <button className="a-move is-even" type="button" onClick={() => go("settle")}>
          <div className="a-arrow" style={{ background: "#f0ece4" }}>
            ↔
          </div>
          <div>
            <div className="names">Alex ↔ You</div>
            <div className="why">Even on expenses · still £180 for the fund</div>
          </div>
          <div className="amt" style={{ color: "var(--ink-soft)" }}>
            £0
          </div>
        </button>
      </div>
    </section>
  );
}

function Pay() {
  const { go, closeWindow } = useApp();
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
        <button className="a-btn" type="button" onClick={() => go("expense-paid")}>
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
  const { go, closeWindow } = useApp();
  return (
    <section className="a-window">
      <p className="a-window-kicker">You</p>
      <div className="a-field">
        <label htmlFor="pm-prov">How people pay you</label>
        <select id="pm-prov">
          <option>Revolut</option>
          <option>PayPal</option>
          <option>Monzo</option>
          <option>Bank transfer</option>
        </select>
      </div>
      <div className="a-field">
        <label htmlFor="pm-link">Username or link</label>
        <input id="pm-link" type="text" defaultValue="@mayachen" />
      </div>
      <div className="a-field-row">
        <button className="a-btn" type="button" onClick={() => go("profile")}>
          Save
        </button>
        <button className="a-btn ghost" type="button" onClick={closeWindow}>
          Cancel
        </button>
      </div>
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
