import { useEffect, useState, type CSSProperties } from "react";
import { NOTE_BODY_HINT } from "../data/household";
import { LIMITS } from "../data/limits";
import { useApp } from "../state";
import { Icon } from "../ui/Icon";
import { Avatar, Pill } from "../ui/widgets";
import { ImagePick } from "../ui/photos";
import { cx } from "../ui/cx";
import { OperationEdit, OperationNew, OperationView } from "./OperationsWindows";
import { CommuneLocationFields, EMPTY_COMMUNE_LOCATION } from "../ui/CommuneLocationFields";

const NOTE_TYPES = [
  ["wifi", "Wi-Fi"],
  ["bins", "Bins"],
  ["keys", "Keys / door"],
  ["landlord", "Landlord"],
  ["emergency", "Emergency"],
  ["rules", "House rules"],
  ["other", "Other"],
] as const;

function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(minor / 100);
}

function parseMoney(value: string): number | null {
  const clean = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(clean)) return null;
  const [major, decimals = ""] = clean.split(".");
  const minor = Number(major) * 100 + Number(decimals.padEnd(2, "0"));
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

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
          {window === "reminder-preview" && <ReminderPreview />}
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
    "reminder-preview": "Reminders",
    "add-expense": "Add expense",
    expense: "Expense",
    "expense-paid": "Expense",
    "commune-new": "New commune",
    "member-invite": "Invite",
    profile: "Profile",
    breakdown: "Breakdown",
    pay: "Settle a share",
    "pay-method": "Pay me",
    "note-new": "Add note",
    "operation-new": "Add to calendar",
    "operation-edit": "Edit",
  };
  return map[id] ?? id;
}

function ReminderPreview() {
  const { closeWindow, go } = useApp();
  return (
    <section className="a-window">
      <p className="a-window-kicker">Reminders</p>
      <h3>No reminder was sent.</h3>
      <p className="a-window-note">
        Open an outstanding expense share to send an eligible Nudge, or a fund
        pledge to send an eligible Chase. The server checks the recipient, due
        date, outstanding amount, and cooldown before creating an in-app notice.
      </p>
      <button className="a-btn" type="button" onClick={() => go("settle")}>Open settlement</button>
      <button className="a-btn" type="button" onClick={closeWindow}>Got it</button>
    </section>
  );
}

function Notices() {
  const { go, hub, notifications, markNotificationRead } = useApp();
  const [error, setError] = useState("");
  if (!notifications.length) {
    return (
      <section className="a-window">
        <p className="a-window-kicker">Bell</p>
        <p className="a-window-note">No in-app reminders for you in this commune.</p>
      </section>
    );
  }
  return (
    <section className="a-window">
      <p className="a-window-kicker">Bell</p>
      {error ? <p className="a-form-error" role="alert">{error}</p> : null}
      {notifications.map((notice) => (
          <button
            className="a-notice"
            type="button"
            key={notice.id}
            onClick={() => void markNotificationRead(notice.id)
              .then(() => go(notice.kind === "chase" ? "funds" : "settle"))
              .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not mark the notice read."))}
          >
            <Pill tone={notice.readAt ? "settled" : "open"}>{notice.kind === "chase" ? "Chase" : "Nudge"}</Pill>
            <div className="grow">
              <strong>{notice.kind === "chase" ? "Fund pledge reminder" : "Expense share reminder"}</strong>
              <div className="when">{formatMoney(notice.amountMinor, hub.currency)} · {new Date(notice.createdAt).toLocaleDateString("en-GB")}</div>
            </div>
          </button>
      ))}
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
    recordExpense,
  } = useApp();
  const members = hub.members.flatMap((member) => member.userId ? [{ ...member, userId: member.userId }] : []);
  const [what, setWhat] = useState("");
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState("");
  const [includedIds, setIncludedIds] = useState<string[]>(() => members.map((member) => member.userId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const amountMinor = parseMoney(amount);
  const included = members.filter((member) => includedIds.includes(member.userId));

  async function save() {
    const name = what.trim();
    if (!name) {
      setError("Name the expense before saving it.");
      return;
    }
    if (amountMinor === null || amountMinor < included.length) {
      setError("Enter a valid amount of at least one penny per selected person.");
      return;
    }
    if (!included.length || !included.some((member) => member.userId === session?.userId)) {
      setError("Include yourself in the split.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const id = await recordExpense({
        name,
        amountMinor,
        dueOn: due || null,
        shareUserIds: included.map((member) => member.userId),
      });
      go("expense", { expense: id });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the expense.");
    } finally {
      setSaving(false);
    }
  }

  if (!hub.id) {
    return (
      <section className="a-window">
        <h3>Create a commune first.</h3>
        <p className="a-window-note">An expense needs a commune and at least one member.</p>
        <button className="a-btn" type="button" onClick={() => go("commune-new")}>Create a commune</button>
      </section>
    );
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
          maxLength={LIMITS.expenseTitle}
          onChange={(e) => setWhat(e.target.value)}
          placeholder="e.g. Rent"
        />
        <span className="a-field-limit">{what.length}/{LIMITS.expenseTitle}</span>
      </div>
      <div className="a-field half">
        <label htmlFor="exp-amt">Amount ({hub.currency})</label>
        <input id="exp-amt" type="text" inputMode="decimal" maxLength={LIMITS.money} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
      </div>
      <div className="a-field half">
        <label htmlFor="exp-who">Paid by</label>
        <input id="exp-who" value={you.name} readOnly aria-readonly="true" />
      </div>
      <div className="a-field">
        <label htmlFor="exp-due">Due date (optional)</label>
        <input id="exp-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        <p className="a-window-note">Nudge becomes available to the payer once this date arrives.</p>
      </div>
      <div className="a-field">
        <strong>Split equally between</strong>
        {members.map((member) => {
          const isSelf = member.userId === session?.userId;
          return (
            <label className="a-settle-row" key={member.userId}>
              <input
                type="checkbox"
                checked={includedIds.includes(member.userId)}
                disabled={isSelf || saving}
                onChange={(event) => setIncludedIds((current) => event.target.checked
                  ? [...current, member.userId]
                  : current.filter((id) => id !== member.userId))}
              />
              <span>{member.name}{isSelf ? " (you)" : ""}</span>
              {amountMinor !== null && includedIds.includes(member.userId)
                ? <span className="amt">{formatMoney(
                    Math.floor(amountMinor / included.length) + (included.findIndex((item) => item.userId === member.userId) < amountMinor % included.length ? 1 : 0),
                    hub.currency,
                  )}</span>
                : null}
            </label>
          );
        })}
        <div className="when">The server validates that all individual shares add up to the total.</div>
        </div>
      {error ? <p className="a-form-error" role="alert">{error}</p> : null}
      <div className="a-field-row">
        <button className="a-btn" type="button" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save expense"}
        </button>
        <button className="a-btn ghost" type="button" onClick={closeWindow}>
          Cancel
        </button>
      </div>
    </section>
  );
}

function Expense() {
  const {
    go, closeWindow, hub, selectedExpense, session,
    reminderTargets, confirmExpenseShare, sendReminder,
  } = useApp();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  if (!selectedExpense) {
    return (
      <section className="a-window">
        <p className="a-window-note">That expense isn’t in this hub.</p>
      </section>
    );
  }
  const payer = hub.members.find((member) => member.userId === selectedExpense.paidByUserId);
  const isPayer = session?.userId === selectedExpense.paidByUserId;
  const remaining = selectedExpense.shares.reduce(
    (total, share) => total + Math.max(0, share.amountMinor - share.settledMinor), 0,
  );

  async function act(id: string, action: () => Promise<void>, success: string) {
    setPendingId(id);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(success);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update this share.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="a-window">
      <p className="a-window-kicker">Expense</p>
      <div className="a-fund-hero">
        <div>
          <span className="a-hero-kicker">{selectedExpense.dueOn ? `Due ${selectedExpense.dueOn}` : "No due date"}</span>
          <strong>{selectedExpense.name}</strong>
          <p>
            {payer?.name ?? selectedExpense.paidBy} paid {formatMoney(selectedExpense.amountMinor, hub.currency)}. {remaining ? `${formatMoney(remaining, hub.currency)} of shares remain open.` : "All shares are settled."}
          </p>
        </div>
        <Pill tone={selectedExpense.status}>{selectedExpense.statusLabel}</Pill>
      </div>
      <div className="a-split">
        {selectedExpense.shares.map((share) => {
          const member = hub.members.find((item) => item.userId === share.userId);
          const outstanding = share.amountMinor - share.settledMinor;
          const isOwnPayerShare = share.userId === selectedExpense.paidByUserId;
          const target = isPayer && !isOwnPayerShare
            ? reminderTargets.find((item) => item.kind === "nudge" && item.sourceId === share.id)
            : undefined;
          const cooldown = target?.lastSentAt && Date.now() - Date.parse(target.lastSentAt) < 72 * 60 * 60 * 1000;
          return (
            <div className="a-split-row" key={share.id}>
              <Avatar tone={member?.cls ?? "house"} initials={member?.ini ?? "?"} />
              <div className="grow">
                <strong>{member?.name ?? "Member"}{share.userId === session?.userId ? " (you)" : ""}</strong>
                <div className="when">{formatMoney(share.amountMinor, hub.currency)} share · {outstanding ? `${formatMoney(outstanding, hub.currency)} outstanding` : "settled"}</div>
              </div>
              <Pill tone={outstanding ? "open" : "settled"}>{outstanding ? "Open" : "Settled"}</Pill>
              {isPayer && !isOwnPayerShare && outstanding ? (
                <div className="a-row-actions">
                  {target && !cooldown ? (
                    <button className="a-btn nudge" type="button" disabled={pendingId !== null} onClick={() => void act(share.id, () => sendReminder("nudge", share.id), "In-app nudge sent. Email delivery is not configured locally.")}>Nudge</button>
                  ) : null}
                  <button className="a-btn ghost" type="button" disabled={pendingId !== null} onClick={() => void act(share.id, () => confirmExpenseShare(share.id), "Share confirmed as received. No payment was taken by Commune.")}>Confirm received</button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {error ? <p className="a-form-error" role="alert">{error}</p> : null}
      {message ? <p className="a-window-note" role="status">{message}</p> : null}
      {!isPayer && remaining ? <p className="a-window-note">Arrange payment with the bill payer outside Commune. Only they can confirm receipt here.</p> : null}
      <div className="a-field-row">
        <button className="a-btn" type="button" onClick={() => go("settle")}>Open settlement</button>
        <button className="a-btn ghost" type="button" onClick={closeWindow}>
          Close
        </button>
      </div>
    </section>
  );
}

function ExpensePaid() {
  const { go, closeWindow, selectedExpense } = useApp();
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
          <p>See each person’s current share status in this commune.</p>
        </div>
        <Pill tone={selectedExpense.status}>{selectedExpense.statusLabel}</Pill>
      </div>
      <p className="a-window-note">
        Commune does not move money. The bill payer confirms an individual
        share after receiving payment outside the app.
      </p>
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
  const [name, setName] = useState("");
  const [type, setType] = useState<"Household" | "Workspace" | "Trip">("Household");
  const [currency, setCurrency] = useState("GBP");
  const [location, setLocation] = useState(EMPTY_COMMUNE_LOCATION);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    if (!name.trim()) {
      setError("Name the commune before creating it.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await createHub({ name: name.trim(), type, currency, ...location });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the commune.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="a-window">
      <p className="a-window-kicker">Places</p>
      <div className="a-field">
        <label htmlFor="new-name">Name</label>
        <input id="new-name" type="text" maxLength={LIMITS.communeName} value={name} onChange={(e) => setName(e.target.value)} />
        <span className="a-field-limit">{name.length}/{LIMITS.communeName}</span>
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
          <option value="GBP">£ GBP</option>
          <option value="USD">$ USD</option>
          <option value="EUR">€ EUR</option>
        </select>
      </div>
      <CommuneLocationFields type={type} value={location} onChange={setLocation} disabled={saving} idPrefix="new-commune" />
      <div className="a-field-row">
        <button
          className="a-btn"
          type="button"
          onClick={() => void create()}
          disabled={saving}
        >
          {saving ? "Creating…" : "Create"}
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
  const { closeWindow, createInvite, hub } = useApp();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const invite = await createInvite(email.trim(), role);
      setUrl(invite.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the invite.");
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError("Copy failed. Select the link below and copy it manually.");
    }
  }

  return (
    <section className="a-window">
      <p className="a-window-kicker">Members</p>
      <div className="a-field">
        <label htmlFor="inv-email">Email</label>
        <input id="inv-email" type="email" maxLength={LIMITS.email} value={email} disabled={Boolean(url)} onChange={(event) => setEmail(event.target.value)} />
      </div>
      <div className="a-field">
        <label htmlFor="inv-role">Role</label>
        <select id="inv-role" value={role} disabled={Boolean(url)} onChange={(event) => setRole(event.target.value as "member" | "admin")}>
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      {url ? (
        <div className="a-field">
          <label htmlFor="inv-link">Invitation link</label>
          <input id="inv-link" value={url} readOnly onFocus={(event) => event.target.select()} />
          <p className="a-window-note">Share this link with {email.trim()}. No email was sent by Commune. Only that verified email address can accept it.</p>
        </div>
      ) : null}
      <div className="a-field-row">
        <button className="a-btn" type="button" disabled={saving || hub.role !== "admin"} onClick={() => void (url ? copy() : create())}>
          {saving ? "Creating…" : url ? (copied ? "Copied" : "Copy link") : "Create invite link"}
        </button>
        <button className="a-btn ghost" type="button" onClick={closeWindow}>
          Close
        </button>
      </div>
      {hub.role !== "admin" ? <p className="a-window-note">Only a commune admin can create an invite link.</p> : null}
      {error ? <p className="a-form-error" role="alert">{error}</p> : null}
    </section>
  );
}

function Profile() {
  const { go, you, setAvatar, places } = useApp();
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
        Your photo is saved in this browser session. Expense shares and balances are shared through the local database.
      </p>
      <div className="a-settle-row">
        <div>
          <strong>Communes</strong>
          <div className="when">{places.length} {places.length === 1 ? "commune" : "communes"} · billing is not enabled locally</div>
        </div>
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
  const { go, closeWindow, hub, expenses, session } = useApp();
  const moves = expenses.flatMap((expense) => expense.shares
    .filter((share) => share.userId !== expense.paidByUserId && share.amountMinor > share.settledMinor)
    .filter((share) => share.userId === session?.userId || expense.paidByUserId === session?.userId)
    .map((share) => ({ expense, share })));
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
        {moves.map(({ expense, share }) => {
          const debtor = hub.members.find((member) => member.userId === share.userId);
          const payer = hub.members.find((member) => member.userId === expense.paidByUserId);
          return (
          <button
            className="a-move"
            type="button"
            key={share.id}
            onClick={() => go("expense", { expense: expense.id })}
          >
            <div className="a-arrow">→</div>
            <div>
              <div className="names">{expense.paidByUserId === session?.userId ? `${debtor?.name ?? "Member"} → You` : `You → ${payer?.name ?? "Bill payer"}`}</div>
              <div className="why">{expense.name}</div>
            </div>
            <div className="amt">{formatMoney(share.amountMinor - share.settledMinor, hub.currency)}</div>
          </button>
        );})}
        {!moves.length ? <p className="a-window-note">No outstanding shares for you in this commune.</p> : null}
      </div>
    </section>
  );
}

function Pay() {
  const { go, closeWindow, selectedExpense, hub, session } = useApp();
  const share = selectedExpense?.shares.find((item) => item.userId === session?.userId);
  const payer = hub.members.find((member) => member.userId === selectedExpense?.paidByUserId);
  const outstanding = share ? share.amountMinor - share.settledMinor : 0;
  return (
    <section className="a-window">
      <p className="a-window-kicker">Settle</p>
      <div className="a-pay-hero">
        <span className="a-hero-kicker">{selectedExpense ? `You → ${payer?.name ?? "bill payer"}` : "Payment"}</span>
        <strong>{formatMoney(outstanding, hub.currency)}</strong>
        <p>
          Commune does not move money or hold payment details yet. Arrange a transfer directly with the bill payer;
          they can confirm your individual share here after receiving it.
        </p>
      </div>
      <div className="a-field-row">
        {selectedExpense ? <button className="a-btn" type="button" onClick={() => go("expense", { expense: selectedExpense.id })}>View share</button> : null}
        <button className="a-btn ghost" type="button" onClick={closeWindow}>
          Close
        </button>
      </div>
    </section>
  );
}

function PayMethod() {
  const { closeWindow } = useApp();
  return (
    <section className="a-window">
      <p className="a-window-kicker">You</p>
      <h3>Payment links are not connected yet.</h3>
      <p className="a-window-note">For now, arrange transfers directly with your housemates. Commune records each share after the bill payer confirms receipt; it does not store or publish payment details.</p>
      <button className="a-btn" type="button" onClick={closeWindow}>Close</button>
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

function NoteNew({ onSave }: { onSave: (card: { id: string; title: string; pill: string; kicker: string; lede: string; body: string; facts: Array<[string, string]> }) => Promise<string> }) {
  const { go, closeWindow } = useApp();
  const [type, setType] = useState<(typeof NOTE_TYPES)[number][0]>("wifi");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pin, setPin] = useState(false);
  const [net, setNet] = useState("");
  const [pass, setPass] = useState("");
  const [code, setCode] = useState("");
  const [day, setDay] = useState("");
  const [where, setWhere] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [detail, setDetail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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

  async function save() {
    if (!title.trim() || !body.trim()) {
      setError("Add a title and note before saving.");
      return;
    }
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
    facts.push(["Who can see", "Everyone in this commune"]);
    if (pin) facts.push(["This Hub", "Pinned"]);
    setSaving(true);
    setError("");
    try {
      const id = await onSave({
        id: `draft-${Date.now()}`,
        title: title.trim(),
        pill: typeLabel,
        kicker: pin ? "Pinned · everyone" : "Everyone",
        lede: facts[0]?.[1] ?? body.trim().slice(0, 200),
        body: body.trim(),
        facts,
      });
      go("note", { note: id });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the note.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="a-window">
      <p className="a-window-kicker">Note</p>
      <div className="a-field">
        <label htmlFor="note-title">
          Title <span className="need">Required</span>
        </label>
        <input id="note-title" type="text" maxLength={LIMITS.noteTitle} value={title} onChange={(e) => setTitle(e.target.value)} />
        <span className="a-field-limit">{title.length}/{LIMITS.noteTitle}</span>
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
        <input id="note-net" maxLength={LIMITS.noteDetail} value={net} onChange={(e) => setNet(e.target.value)} />
      </div>
      <div className="a-field half" style={extra("wifi")}>
        <label htmlFor="note-pass">Password</label>
        <input id="note-pass" maxLength={LIMITS.noteDetail} value={pass} onChange={(e) => setPass(e.target.value)} />
      </div>
      <div className="a-field" style={extra("keys")}>
        <label htmlFor="note-code">Door code</label>
        <input id="note-code" maxLength={LIMITS.noteDetail} value={code} onChange={(e) => setCode(e.target.value)} placeholder="4821" />
      </div>
      <div className="a-field half" style={extra("bins")}>
        <label htmlFor="note-day">Collection</label>
        <input id="note-day" maxLength={LIMITS.noteDetail} value={day} onChange={(e) => setDay(e.target.value)} placeholder="Black bags Tuesday" />
      </div>
      <div className="a-field half" style={extra("bins")}>
        <label htmlFor="note-where">Where they go</label>
        <input id="note-where" maxLength={LIMITS.noteDetail} value={where} onChange={(e) => setWhere(e.target.value)} placeholder="Alley behind the kitchen" />
      </div>
      <div className="a-field half" style={extra("landlord")}>
        <label htmlFor="note-phone">Phone</label>
        <input id="note-phone" maxLength={LIMITS.noteDetail} value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div className="a-field half" style={extra("landlord-only")}>
        <label htmlFor="note-email">Email</label>
        <input id="note-email" maxLength={LIMITS.noteDetail} value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="a-field" style={extra("emergency")}>
        <label htmlFor="note-contact">Who to call</label>
        <input id="note-contact" maxLength={LIMITS.noteDetail} value={contact} onChange={(e) => setContact(e.target.value)} />
      </div>
      <div className="a-field" style={extra("other")}>
        <label htmlFor="note-extra">Detail</label>
        <input id="note-extra" maxLength={LIMITS.noteDetail} value={detail} onChange={(e) => setDetail(e.target.value)} />
      </div>
      <div className="a-field">
        <label htmlFor="note-body">
          Note <span className="need">Required</span>
        </label>
        <textarea
          id="note-body"
          rows={4}
          value={body}
          maxLength={LIMITS.noteBody}
          onChange={(e) => setBody(e.target.value)}
          placeholder={NOTE_BODY_HINT[type]}
        />
        <p className="hint">Always here. Add the story after the type extras.</p>
        <span className="a-field-limit">{body.length}/{LIMITS.noteBody}</span>
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
      <p className="a-window-note">Everyone in this commune can see the note. Admin-only notes are not supported yet.</p>
      <div className="a-field-row">
        <button className="a-btn" type="button" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button className="a-btn ghost" type="button" onClick={closeWindow}>
          Cancel
        </button>
      </div>
      {error ? <p className="a-form-error" role="alert">{error}</p> : null}
    </section>
  );
}
