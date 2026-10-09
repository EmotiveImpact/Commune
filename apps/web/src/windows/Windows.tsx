import { useEffect, useRef, useState, type CSSProperties } from "react";
import { NOTE_BODY_HINT, type NoteCard } from "../data/household";
import { LIMITS } from "../data/limits";
import { useApp } from "../state";
import { Icon } from "../ui/Icon";
import { Avatar, Pill } from "../ui/widgets";
import { ImagePick } from "../ui/photos";
import { cx } from "../ui/cx";
import { OperationEdit, OperationNew, OperationView } from "./OperationsWindows";
import { AnnouncementNew } from "./AnnouncementWindows";
import { CommuneLocationFields, EMPTY_COMMUNE_LOCATION } from "../ui/CommuneLocationFields";
import { RecipientReminderCount, ReminderUsageMeter } from "../ui/ReminderUsage";
import { ReminderFlowDialog, useReminderFlow } from "../ui/ReminderConfirm";
import { reminderEligibility } from "../data/reminders";
import { LatestReportAnswer, PendingReport, ReceiptHistory, pendingReport, useReceiptActions } from "../ui/Receipts";
import { ExpenseHistory, useExpenseChange } from "../ui/ExpenseChange";
import { newRequestId } from "../data/requestId";
import { commandFailure, UNCERTAIN_RETRY_SAFE } from "../data/commands";
import { formatReminderDay, formatTimestampDay } from "../data/reminders";
import { isNotePinned } from "../data/notePresentation";
import { buildStatement, statementCsv } from "../data/statement";
import { NoteHistory } from "../ui/NoteHistory";
import { DiscardQuestion, useFormError, useTypedText } from "../ui/components";
import "./NoteEditor.css";
import { allocateExpense, type SplitMethod } from "../../../../packages/core/src/expenseSplit";
import { netBalances } from "../../../../packages/core/src/balances";
import "./ExpenseEditor.css";
import { SplitEditor } from "../ui/SplitEditor";
import { moneyInputError, parseMoneyInput } from "../data/moneyInput";

const NOTE_TYPES = [
  ["wifi", "Wi-Fi"],
  ["bins", "Bins"],
  ["keys", "Keys / door"],
  ["contacts", "Contacts"],
  ["emergency", "Emergency"],
  ["rules", "House rules"],
  ["other", "Other"],
] as const;

function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(minor / 100);
}

export function Windows() {
  const {
    window,
    screen,
    closeWindow,
    go,
    notes,
    noteKey,
    selectedExpense,
    selectedOperation,
    addNote,
    updateNote,
    mutationPending,
    contentLoading,
    contentError,
    expenseRead,
    retryExpenseRead,
    refresh,
    watchTypedText,
    leaveAsked,
    answerLeave,
  } = useApp();
  const frameRef = useRef<HTMLDivElement>(null);
  const inlineNote = window === "note" && screen === "notes" && Boolean(notes[noteKey]);
  const isOpen = Boolean(window) && !inlineNote;
  // Escape, the backdrop and the close button ask first when typed text
  // would be lost. Cancel in a form is a choice already made.
  const typed = useTypedText();
  const [asking, setAsking] = useState(false);
  const dismiss = () => {
    if (mutationPending) return;
    if (typed.hasTyped()) setAsking(true);
    else closeWindow();
  };
  const dismissRef = useRef(dismiss);
  useEffect(() => { dismissRef.current = dismiss; });
  useEffect(() => { if (!isOpen) setAsking(false); }, [isOpen]);
  // Back asks too (see heldUrl in state.tsx).
  useEffect(() => isOpen ? watchTypedText(typed.hasTyped) : undefined, [isOpen, typed.hasTyped, watchTypedText]);
  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = frameRef.current;
    if (!frame) return;
    frame.focus();
    const onKey = (event: KeyboardEvent) => {
      // A native modal opened from this window (a reminder preview, a receipt
      // form) owns Escape and Tab until it closes.
      if (document.querySelector("dialog[open]")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        dismissRef.current();
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(frame.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]',
      )).filter((element) => !element.closest('[hidden], [inert]') && getComputedStyle(element).visibility !== "hidden" && !element.closest('[style*="display: none"]'));
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) { event.preventDefault(); frame.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === frame)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === frame)) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (opener?.isConnected) opener.focus();
    };
  }, [isOpen]);
  useEffect(() => { if (window) frameRef.current?.focus(); }, [window]);
  if (!window || inlineNote) return null;
  const waitingForRecord = (contentLoading && ["expense", "expense-paid", "note", "note-edit", "operation", "operation-edit"].includes(window)) || !!expenseRead;
  const recordError = contentLoading ? contentError : expenseRead === "failed" ? "That expense couldn’t be loaded. Try again." : null;
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
      <button className="a-window-back" type="button" tabIndex={-1} aria-hidden="true" onClick={() => { frameRef.current?.focus(); dismiss(); }} />
      <div ref={frameRef} tabIndex={-1} className={cx("a-window-frame", window === "add-expense" && "c-expense-frame")} role="dialog" aria-modal="true" aria-labelledby="commune-window-title" onInput={typed.onInput}>
        <header className="a-window-bar">
          <h2 id="commune-window-title">{title}</h2>
          <button className="a-window-x" type="button" aria-label="Close" disabled={mutationPending} onClick={dismiss}>
            <Icon name="close" size={16} />
          </button>
        </header>
        <div className="a-window-body">
          {waitingForRecord ? recordError ? <div role="alert"><p>{recordError}</p>
            <button className="a-btn" type="button" onClick={() => contentLoading ? void refresh() : retryExpenseRead()}>Try again</button></div> :
            <div className="c-window-record-loading" role="status" aria-label="Loading selected record"><span /><span /><span /></div> : <>
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
          {window === "note-new" && <NoteNew key="new" onSave={addNote} />}
          {window === "note-edit" && (notes[noteKey]
            ? <NoteNew key={noteKey} initial={{ ...notes[noteKey], id: noteKey }} onSave={updateNote} />
            : <p className="a-window-note" role="alert">This note is no longer available.</p>)}
          {window === "operation" && <OperationView />}
          {window === "operation-new" && <OperationNew />}
          {window === "operation-edit" && <OperationEdit />}
          {window === "announcement-new" && <AnnouncementNew />}
          </>}
        </div>
      </div>
      {asking ? <DiscardQuestion onDiscard={() => { setAsking(false); closeWindow(); }} onKeep={() => setAsking(false)} />
        : leaveAsked ? <DiscardQuestion onDiscard={() => answerLeave(true)} onKeep={() => answerLeave(false)} /> : null}
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
    "note-edit": "Edit note",
    "operation-new": "Add to calendar",
    "operation-edit": "Edit",
    "announcement-new": "Post an announcement",
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

const NOTICE_COPY: Record<string, { pill: string; title: string }> = {
  nudge: { pill: "Nudge", title: "Expense share reminder" },
  chase: { pill: "Chase", title: "Fund pledge reminder" },
  "receipt-reversed": { pill: "Reversed", title: "Repayment reversed" },
  "expense-corrected": { pill: "Corrected", title: "Expense corrected" },
  "expense-voided": { pill: "Voided", title: "Expense voided" },
  "payment-reported": { pill: "Sent", title: "Payment reported" },
  "payment-confirmed": { pill: "Confirmed", title: "Payment confirmed" },
  "payment-declined": { pill: "Not received", title: "Payment not received" },
  "pledge-changed": { pill: "Changed", title: "Pledge changed" },
  "pledge-cancelled": { pill: "Cancelled", title: "Pledge cancelled" },
};

/** One plain sentence for a ledger notice: what changed, by whom, for you. */
function ledgerNoticeLine(kind: string, amount: string, actor: string): string {
  if (kind === "receipt-reversed") return `${amount ? `${amount} ` : ""}repayment reversed by ${actor}`;
  if (kind === "payment-reported") return `${actor} says they sent ${amount || "a payment"}`;
  if (kind === "payment-confirmed") return `${actor} confirmed ${amount || "your payment"} received`;
  if (kind === "payment-declined") return `${actor} has not received ${amount || "your payment"}`;
  if (kind === "expense-voided") return `Voided by ${actor}${amount ? ` · your ${amount} share no longer counts` : ""}`;
  // The notice's detail says what changed, from and to.
  if (kind === "pledge-changed") return `Your pledge was changed by ${actor}`;
  if (kind === "pledge-cancelled") return `Your ${amount ? `${amount} ` : ""}pledge was cancelled by ${actor}`;
  return `Corrected by ${actor}${amount ? ` · your share is now ${amount}` : ""}`;
}

function Notices() {
  const { go, hub, funds, notifications, markNotificationRead } = useApp();
  const [error, setError] = useState("");
  if (!notifications.length) {
    return (
      <section className="a-window">
        <p className="a-window-kicker">Bell</p>
        <p className="a-window-note">No notices for you in this commune.</p>
      </section>
    );
  }
  return (
    <section className="a-window">
      <p className="a-window-kicker">Bell</p>
      {error ? <p className="a-form-error" role="alert">{error}</p> : null}
      {notifications.map((notice) => {
        const copy = NOTICE_COPY[notice.kind] ?? { pill: "Notice", title: "Update" };
        const actor = hub.members.find((member) => member.userId === notice.senderUserId)?.name ?? "a former member";
        const ledger = notice.kind !== "nudge" && notice.kind !== "chase";
        const amount = notice.amountMinor != null ? formatMoney(notice.amountMinor, hub.currency) : "";
        const date = new Date(notice.createdAt).toLocaleDateString("en-GB");
        // A pledge notice opens the fund that holds the pledge.
        const pledge = notice.kind === "pledge-changed" || notice.kind === "pledge-cancelled";
        const fund = pledge ? funds.find((item) => !item.archivedAt && item.commitments.some((entry) => entry.id === notice.sourceId)) : undefined;
        return (
          <button
            className="a-notice"
            type="button"
            key={notice.id}
            onClick={() => void markNotificationRead(notice.id)
              .then(() => ledger && notice.expenseId ? go("expense", { expense: notice.expenseId })
                : pledge ? go("funds", fund ? { record: { kind: "fund", id: fund.id } } : undefined)
                  : go(notice.kind === "chase" ? "funds" : "settle"))
              .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not mark the notice read."))}
          >
            <Pill tone={notice.readAt ? undefined : "open"}>{copy.pill}</Pill>
            <div className="grow">
              <strong>{notice.readAt ? null : <span className="c-notice-new">New<span className="sr-only">:</span> </span>}{ledger ? notice.title ?? copy.title : copy.title}</strong>
              <div className="when">
                {ledger
                  ? `${ledgerNoticeLine(notice.kind, amount, actor)} · ${date}${notice.detail ? ` · ${notice.detail}` : ""}`
                  : `${amount ? `${amount} · ` : ""}${date}`}
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
    recordExpense,
    splitTemplates,
    expenseTemplateId,
  } = useApp();
  const members = hub.members.flatMap((member) => member.userId ? [{ ...member, userId: member.userId }] : []);
  const initialTemplate = splitTemplates.find(template => template.id === expenseTemplateId && !template.archivedAt && template.participants.every(item => members.some(member => member.userId === item.userId)));
  const [what, setWhat] = useState("");
  const [amount, setAmount] = useState(() => initialTemplate?.method === "Exact" ? (initialTemplate.participants.reduce((total, item) => total + (parseMoneyInput(item.value) ?? 0), 0) / 100).toFixed(2) : "");
  const [due, setDue] = useState("");
  const [payer, setPayer] = useState(session?.userId ?? "");
  const [category, setCategory] = useState("Other");
  const [templateId,setTemplateId] = useState(initialTemplate?.id ?? "");
  const [includedIds, setIncludedIds] = useState<string[]>(() => initialTemplate?.participants.map(item => item.userId) ?? members.map(member => member.userId));
  const [method, setMethod] = useState<SplitMethod>(initialTemplate?.method ?? "Equal");
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(initialTemplate?.participants.map(item => [item.userId, item.value]) ?? []));
  const [saving, setSaving] = useState(false);
  const { setError, invalid, message } = useFormError();
  // One id for this form: every retry reuses it, so the server records the
  // expense once. After an unconfirmed attempt the fields lock, so a retry is
  // the same expense.
  const requestId = useRef(newRequestId());
  const [uncertain, setUncertain] = useState(false);
  const amountMinor = parseMoneyInput(amount, hub.currency);
  // Someone who leaves while the form is open drops out of the preview as well
  // as the save, so the two always split between the same people.
  const included = members.filter((member) => includedIds.includes(member.userId));
  const includedUserIds = included.map(member => member.userId);
  let allocations: ReturnType<typeof allocateExpense> = [];
  let splitError = "";
  try { allocations = allocateExpense(amountMinor ?? 0, includedUserIds, method, values, hub.currency); }
  catch (cause) { splitError = cause instanceof Error ? cause.message : "Check the split."; }

  async function save() {
    const name = what.trim();
    if (!name) {
      setError("Name the expense before saving it.", "exp-what");
      return;
    }
    if (amountMinor === null || amountMinor < included.length) {
      setError(moneyInputError(amount, hub.currency, "Enter a valid amount of at least one penny per selected person."), "exp-amt");
      return;
    }
    // The split has no single field: its message, just after it, takes focus.
    if (!included.length) {
      setError("Choose at least one person in the split.", "exp-split");
      return;
    }
    if (splitError) { setError(splitError, "exp-split"); return; }
    setSaving(true);
    setError("");
    try {
      const id = await recordExpense({
        name,
        amountMinor,
        dueOn: due || null,
        shareUserIds: included.map((member) => member.userId),
        allocations,
        paidByUserId:payer,
        category,
        requestId: requestId.current,
      });
      go("expense", { expense: id });
    } catch (cause) {
      const failure = commandFailure(cause, "Could not save the expense.");
      if (!failure.rejected) setUncertain(true);
      // Once an attempt may have saved, a later refusal does not mean nothing was.
      setError(!failure.rejected ? UNCERTAIN_RETRY_SAFE
        : uncertain || /already used for a different/i.test(failure.message)
          ? "An earlier attempt may already have been saved. Close this and check Expenses before adding it again."
          : `${failure.message.replace(/\.$/, "")}. Nothing was saved.`);
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
    <div className="c-expense-editor"><section className="a-window c-expense-form">
      <div className="a-field">
        <label htmlFor="exp-what">What was it for?</label>
        <input
          id="exp-what"
          type="text"
          value={what}
          maxLength={LIMITS.expenseTitle}
          disabled={saving || uncertain}
          onChange={(e) => setWhat(e.target.value)}
          placeholder="e.g. Rent"
          {...invalid("exp-what")}
        />
        <span className="a-field-limit">{what.length}/{LIMITS.expenseTitle}</span>
        {message("exp-what")}
      </div>
      <div className="a-field half">
        <label htmlFor="exp-amt">Amount ({hub.currency})</label>
        <input id="exp-amt" type="text" inputMode="decimal" maxLength={LIMITS.money} value={amount} disabled={saving || uncertain} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" {...invalid("exp-amt")} />
        {message("exp-amt")}
      </div>
      <div className="a-field half">
        <label htmlFor="exp-who">Paid by</label>
        <select id="exp-who" value={payer} onChange={event=>setPayer(event.target.value)} disabled={saving || uncertain || hub.role!=="admin"}>{members.map(member=><option key={member.userId} value={member.userId}>{member.name}</option>)}</select>
        <small>{hub.role==="admin" ? "Admins can record on someone’s behalf; the actual payer confirms receipt." : "You’re recording an expense you paid."}</small>
      </div>
      <div className="a-field"><label htmlFor="exp-category">Category</label><select id="exp-category" value={category} disabled={saving || uncertain} onChange={event=>setCategory(event.target.value)}>{["Other","Rent","Bills","Groceries","Travel"].map(choice=><option key={choice}>{choice}</option>)}</select></div>
      {splitTemplates.some(template=>!template.archivedAt) && <div className="a-field"><label htmlFor="exp-template">Saved split (optional)</label><select id="exp-template" value={templateId} disabled={saving || uncertain} onChange={event=>{
        const id=event.target.value;setTemplateId(id);const template=splitTemplates.find(item=>item.id===id);
        if(!template) {setIncludedIds(members.map(member=>member.userId));setMethod("Equal");setValues({});return;}
        if(template.participants.some(item=>!members.some(member=>member.userId===item.userId))) {setError("This template includes a former member. Update it in Templates first.");setTemplateId("");return;}
        setIncludedIds(template.participants.map(item=>item.userId));setMethod(template.method);setValues(Object.fromEntries(template.participants.map(item=>[item.userId,item.value])));setError("");
        if(template.method==="Exact" && !amount.trim()) {const sum=template.participants.reduce((total,item)=>total+(parseMoneyInput(item.value) ?? 0),0);setAmount((sum/100).toFixed(2));}
      }}><option value="">Custom split</option>{splitTemplates.filter(template=>!template.archivedAt).map(template=><option key={template.id} value={template.id}>{template.name} · {template.method}</option>)}</select></div>}
      <div className="a-field">
        <label htmlFor="exp-due">Due date (optional)</label>
        <input id="exp-due" type="date" value={due} disabled={saving || uncertain} onChange={(e) => setDue(e.target.value)} />
        <p className="a-window-note">Nudge becomes available to the payer once this date arrives.</p>
      </div>
      <SplitEditor members={members} includedIds={includedUserIds} onIncludedIds={setIncludedIds} method={method} onMethod={setMethod} values={values} onValues={setValues} amountMinor={amountMinor} currency={hub.currency} disabled={saving || uncertain} />
      {message("exp-split")}
      {message()}
    </section><aside className="c-expense-summary" aria-label="Split summary"><h3>The split, at a glance</h3><div><span>Total</span><strong>{formatMoney(amountMinor ?? 0, hub.currency)}</strong></div><div><span>Your share</span><strong>{formatMoney(allocations.find(share => share.userId === session?.userId)?.amountMinor ?? 0, hub.currency)}</strong></div><p>Paid by {members.find(member=>member.userId===payer)?.name ?? you.name}. Each person will see their exact share.</p><p>Commune records who paid and who owes what. It doesn’t move money.</p></aside>
      {/* One footer under both columns, so it never cuts across the split list. */}
      <div className="c-expense-actions">
        <button className="a-btn" type="button" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save expense"}
        </button>
        <button className="a-btn ghost" type="button" disabled={saving} onClick={closeWindow}>
          Cancel
        </button>
      </div></div>
  );
}

function Expense() {
  const {
    go, closeWindow, hub, selectedExpense, session,
    reminderTargets, reminderUsage, sentReminders, sendReminder,
  } = useApp();
  const reminder = useReminderFlow(sendReminder);
  const [message, setMessage] = useState("");
  const receipts = useReceiptActions(setMessage);
  const fullName = (userId: string) => hub.members.find((item) => item.userId === userId)?.name ?? "A former member";
  const change = useExpenseChange(fullName, setMessage);
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
  const nameOf = (userId: string) => userId === session?.userId ? "you" : hub.members.find((item) => item.userId === userId)?.name ?? "a former member";
  const voided = !!selectedExpense.voidedAt;
  const canChange = !voided && (isPayer || hub.role === "admin");

  return (
    <section className="a-window">
      <p className="a-window-kicker">Expense</p>
      <div className="a-fund-hero">
        <div>
          <span className="a-hero-kicker">{selectedExpense.dueOn ? `Due ${selectedExpense.dueOn}` : "No due date"}</span>
          <strong>{selectedExpense.name}</strong>
          <p>
            {payer?.name ?? selectedExpense.paidBy} paid {formatMoney(selectedExpense.amountMinor, hub.currency)}. {voided ? "This expense is voided and no longer counts towards any balance." : remaining ? `${formatMoney(remaining, hub.currency)} of shares remain open.` : "All shares are settled."}
          </p>
        </div>
        <Pill tone={voided ? undefined : selectedExpense.status}>{selectedExpense.statusLabel}</Pill>
      </div>
      {voided ? <p className="c-expense-voided" role="note">Voided by {fullName(selectedExpense.voidedBy ?? "")} on {formatTimestampDay(selectedExpense.voidedAt)}: {selectedExpense.voidReason}</p> : null}
      {isPayer && !voided ? <ReminderUsageMeter usage={reminderUsage} /> : null}
      <div className="a-split">
        {selectedExpense.shares.map((share) => {
          const member = hub.members.find((item) => item.userId === share.userId);
          const outstanding = voided ? 0 : share.amountMinor - share.settledMinor;
          const isOwnPayerShare = share.userId === selectedExpense.paidByUserId;
          const partPaid = !isOwnPayerShare && share.settledMinor > 0 && outstanding > 0;
          const target = isPayer && !isOwnPayerShare
            ? reminderTargets.find((item) => item.kind === "nudge" && item.sourceId === share.id)
            : undefined;
          const eligibility = reminderEligibility({ kind: "nudge", recipientId: share.userId, target, usage: reminderUsage, sent: sentReminders, dueOn: selectedExpense.dueOn });
          const report = voided ? undefined : pendingReport(share);
          const ownDebt = share.userId === session?.userId && !isOwnPayerShare && outstanding > 0;
          return (
            <div className="c-share-block" key={share.id}>
            <div className="a-split-row">
              <Avatar tone={member?.cls ?? "house"} initials={member?.ini ?? "?"} />
              <div className="grow">
                <strong>{member?.name ?? "Member"}{share.userId === session?.userId ? " (you)" : ""}</strong>
                <div className="when">{formatMoney(share.amountMinor, hub.currency)} share · {voided ? "not counted" : outstanding ? `${formatMoney(outstanding, hub.currency)} outstanding` : isOwnPayerShare ? "paid the bill" : "settled"}</div>
                {isPayer && (target || (reminderUsage?.recipientUsage[share.userId] ?? 0) > 0) ? (
                  <RecipientReminderCount usage={reminderUsage} recipientId={share.userId} />
                ) : null}
              </div>
              <Pill tone={voided ? undefined : outstanding ? "open" : "settled"}>{voided ? "Voided" : outstanding ? partPaid ? "Part paid" : "Open" : "Settled"}</Pill>
              {isPayer && !isOwnPayerShare && outstanding && !report ? (
                <div className="a-row-actions">
                  <button className="a-btn nudge" type="button" disabled={!eligibility.canSend} title={eligibility.reason || undefined}
                    onClick={() => { setMessage(""); reminder.open({ kind: "nudge", sourceId: share.id, recipientId: share.userId, name: member?.name ?? "your housemate", subject: selectedExpense.name, amount: formatMoney(outstanding, hub.currency), dueOn: selectedExpense.dueOn }); }}>Nudge{" "}<span className="c-visually-hidden">{member?.name ?? "this member"}</span></button>
                  <button className="a-btn ghost" type="button" onClick={() => { setMessage(""); receipts.record({ shareId: share.id, debtorName: member?.name ?? "this member", expenseName: selectedExpense.name, shareMinor: share.amountMinor, outstandingMinor: outstanding, currency: hub.currency }); }}>Confirm received{" "}<span className="c-visually-hidden">from {member?.name ?? "this member"}</span></button>
                  {eligibility.reason && <p className="c-action-hint">{eligibility.reason}</p>}
                </div>
              ) : ownDebt && !report ? (
                <div className="a-row-actions">
                  <button className="a-btn ghost" type="button" onClick={() => { setMessage(""); receipts.report({ shareId: share.id, payerName: payer?.name ?? "the bill payer", expenseName: selectedExpense.name, outstandingMinor: outstanding, currency: hub.currency }); }}>I’ve sent it</button>
                </div>
              ) : null}
            </div>
            {report ? <PendingReport share={share} currency={hub.currency} viewerId={session?.userId} payerId={selectedExpense.paidByUserId}
              names={fullName} disabled={receipts.busy}
              onAnswer={(item, decision) => { setMessage(""); receipts.answer({ report: item, debtorName: member?.name ?? "this member", expenseName: selectedExpense.name, currency: hub.currency, decision }); }}
              onWithdraw={(item) => { setMessage(""); void receipts.withdraw(item); }} /> : null}
            {ownDebt ? <LatestReportAnswer share={share} currency={hub.currency} viewerId={session?.userId} names={fullName} /> : null}
            {!isOwnPayerShare && <ReceiptHistory share={share} currency={hub.currency} names={nameOf}
              onReverse={isPayer && !voided ? (receipt) => { setMessage(""); receipts.reverse({ receipt, debtorName: member?.name ?? "this member", expenseName: selectedExpense.name, currency: hub.currency }); } : undefined} />}
            </div>
          );
        })}
      </div>
      <ExpenseHistory revisions={selectedExpense.revisions} names={fullName} currency={hub.currency} />
      {message ? <p className="a-window-note" role="status">{message}</p> : null}
      {!isPayer && remaining && !voided ? <p className="a-window-note">Pay the bill payer outside Commune, then use I’ve sent it. Only they can confirm receipt.</p> : null}
      <div className="a-field-row">
        <button className="a-btn" type="button" onClick={() => go("settle")}>Open settlement</button>
        {canChange ? <button className="a-btn ghost" type="button" onClick={() => { setMessage(""); change.correct(selectedExpense.id); }}>Correct</button> : null}
        {canChange ? <button className="a-btn ghost" type="button" onClick={() => { setMessage(""); change.void(selectedExpense.id); }}>Void</button> : null}
        <button className="a-btn ghost" type="button" onClick={closeWindow}>
          Close
        </button>
      </div>
      <ReminderFlowDialog flow={reminder} usage={reminderUsage} />
      {receipts.dialogs}
      {change.dialogs}
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
        <button className="a-btn" type="button" onClick={() => go("settle")}>
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
  const { setError, invalid, message } = useFormError();

  async function create() {
    if (!name.trim()) {
      setError("Name the commune before creating it.", "new-name");
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
        <input id="new-name" type="text" maxLength={LIMITS.communeName} value={name} onChange={(e) => setName(e.target.value)} {...invalid("new-name")} />
        <span className="a-field-limit">{name.length}/{LIMITS.communeName}</span>
        {message("new-name")}
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
      {message()}
    </section>
  );
}

function MemberInvite() {
  const { closeWindow, createInvite, sendInviteEmail, hub } = useApp();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [sent, setSent] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const { error, setError, invalid, message } = useFormError();

  async function create(emailDelivery: boolean) {
    if (saving) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter a valid email address.", "inv-email");
      return;
    }
    setSaving(true);
    setSendingEmail(emailDelivery);
    setError("");
    try {
      let inviteToken = token;
      if (!inviteToken) {
        const invite = await createInvite(email.trim(), role);
        inviteToken = invite.token;
        setToken(inviteToken);
        setUrl(invite.url);
      }
      if (emailDelivery) {
        await sendInviteEmail(inviteToken);
        setSent(true);
      }
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
    <form className="a-window" onSubmit={(event) => { event.preventDefault(); void create(true); }}>
      <p className="a-window-note">Invite someone to {hub.name}. Send an email invitation or create a link to share yourself.</p>
      <div className="a-field">
        <label htmlFor="inv-email">Email</label>
        <input id="inv-email" type="email" required placeholder="name@example.com" maxLength={LIMITS.email} value={email} disabled={Boolean(url) || saving} onChange={(event) => setEmail(event.target.value)} {...invalid("inv-email")} />
        {message("inv-email")}
      </div>
      <div className="a-field">
        <label htmlFor="inv-role">Role</label>
        <select id="inv-role" value={role} disabled={Boolean(url) || saving} onChange={(event) => setRole(event.target.value as "member" | "admin")}>
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <p className="a-window-note">{role === "admin" ? "Admins can manage commune settings, members and invitations." : "Members can take part in shared expenses and commune activity."}</p>
      </div>
      {sent ? <p role="status" className="a-window-note">Invitation email sent to {email.trim()}. Delivery to their inbox may take a moment.</p> : null}
      {url ? (
        <div className="a-field">
          <label htmlFor="inv-link">Invitation link</label>
          <input id="inv-link" value={url} readOnly onFocus={(event) => event.target.select()} />
          <p className="a-window-note">{sent ? "You can also share this link directly." : "The invitation link is ready. Email sending has not been confirmed."} Only {email.trim()} can accept it after verifying their email. The link expires in seven days.</p>
        </div>
      ) : null}
      {message()}
      <div className="a-field-row">
        <button className="a-btn" type="submit" disabled={saving || sent || hub.role !== "admin"}>
          {saving && sendingEmail ? "Sending…" : sent ? "Email sent" : error && token ? "Retry email" : "Send invitation"}
        </button>
        <button className="a-btn ghost" type="button" disabled={saving || hub.role !== "admin"} onClick={() => void (url ? copy() : create(false))}>
          {saving && !sendingEmail ? "Creating…" : url ? (copied ? "Copied" : "Copy link") : "Create link only"}
        </button>
        <button className="a-btn ghost" type="button" onClick={closeWindow}>
          Close
        </button>
      </div>
      {hub.role !== "admin" ? <p className="a-window-note">Only a commune admin can invite people.</p> : null}
    </form>
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
        Your photo is saved in this browser. Expense shares and balances are shared with your commune.
      </p>
      <div className="a-settle-row">
        <div>
          <strong>Communes</strong>
          <div className="when">{places.length} {places.length === 1 ? "commune" : "communes"} · billing is not enabled</div>
        </div>
      </div>
      <div className="a-settle-row">
        <div>
          <strong>Settings</strong>
          <div className="when">Theme, notices, sidebar</div>
        </div>
        <button className="a-btn ghost" type="button" onClick={() => go("settings")}>
          Open
        </button>
      </div>
    </section>
  );
}

function Breakdown() {
  const { go, hub, expenses, voidedExpenses, session, snapshots, expenseHistory, loadFullHistory } = useApp();
  // A statement covers everything shared with that person, so it waits for every older expense.
  const [historyFailed, setHistoryFailed] = useState(false);
  useEffect(() => {
    if (expenseHistory.complete || historyFailed) return;
    let open = true;
    loadFullHistory().catch(() => { if (open) setHistoryFailed(true); });
    return () => { open = false; };
  }, [expenseHistory.complete, historyFailed, loadFullHistory]);
  const history = expenseHistory.complete ? "ready" : historyFailed ? "error" : "loading";
  const others = hub.members.filter((member) => member.userId !== session?.userId);
  const ledger = [...expenses, ...voidedExpenses];
  // People who have left keep their statements, listed under their own
  // heading when there is anything between you.
  const former = session ? (snapshots[hub.id]?.members ?? []).filter((member) => member.active === false &&
    member.userId !== session.userId && buildStatement(ledger, session.userId, member.userId, member.name).entries.length > 0) : [];
  const people = [...others, ...former];
  const [statementWith, setStatementWith] = useState(people[0]?.userId ?? "");
  const other = people.find((member) => member.userId === statementWith) ?? people[0];
  const statement = other && session
    ? buildStatement(ledger, session.userId, other.userId, other.name)
    : null;
  // The same figure Members shows for this person.
  const net = other && session ? netBalances(expenses, session.userId).get(other.userId) ?? 0 : 0;
  function downloadStatement() {
    if (!statement || !other) return;
    const blob = new Blob([statementCsv(statement, hub.currency)], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${hub.name} - statement with ${other.name}.csv`.replace(/[\\/:*?"<>|]+/g, " ");
    link.click();
    URL.revokeObjectURL(link.href);
  }
  const moves = expenses.flatMap((expense) => expense.shares
    .filter((share) => share.userId !== expense.paidByUserId && share.amountMinor > share.settledMinor)
    .filter((share) => share.userId === session?.userId || expense.paidByUserId === session?.userId)
    .map((share) => ({ expense, share })));
  return (
    <section className="a-window">
      <p className="a-window-kicker">Settle</p>
      <div className="a-toolbar">
        <button className="a-btn" type="button" onClick={() => go("settle")}>
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
      {other && history === "loading" ? <p className="a-window-note" role="status">Loading earlier expenses for the statement…</p> : null}
      {other && history === "error" ? <div role="alert"><p className="a-window-note">Earlier expenses couldn’t be loaded, so the statement isn’t shown.</p>
        <button className="a-btn ghost" type="button" onClick={() => setHistoryFailed(false)}>Try again</button></div> : null}
      {other && statement && history === "ready" ? (
        <section className="c-statement" aria-label="Statement">
          <div className="a-field">
            <label htmlFor="statement-member">Statement with</label>
            <select id="statement-member" value={other.userId} onChange={(event) => setStatementWith(event.target.value)}>
              {others.map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}
              {former.length ? <optgroup label="Former members">
                {former.map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}
              </optgroup> : null}
            </select>
          </div>
          <p className="c-statement-net" role="status">
            {net > 0 ? `${other.name} owes you ${formatMoney(net, hub.currency)}.`
              : net < 0 ? `You owe ${other.name} ${formatMoney(-net, hub.currency)}.`
                : `You and ${other.name} are square.`}
          </p>
          {statement.entries.length ? (
            <ol className="c-statement-list">
              {statement.entries.map((entry) => (
                <li key={entry.key} className={entry.kind === "voided" ? "is-voided" : undefined}>
                  <button type="button" onClick={() => go("expense", { expense: entry.expenseId })}>
                    <span className="c-statement-day">{formatReminderDay(entry.on)}</span>
                    <span className="c-statement-what">{entry.description}</span>
                    <span className="c-statement-amount">{entry.kind === "voided" ? "Not counted"
                      : `${entry.amountMinor > 0 ? "+" : "−"}${formatMoney(Math.abs(entry.amountMinor), hub.currency)}`}</span>
                    <span className="c-statement-balance">{formatMoney(Math.abs(entry.balanceMinor), hub.currency)} {entry.balanceMinor > 0 ? "to you" : entry.balanceMinor < 0 ? "to them" : ""}</span>
                  </button>
                </li>
              ))}
            </ol>
          ) : <p className="a-window-note">Nothing shared with {other.name} yet.</p>}
          <p className="c-statement-note">+ adds to what {other.name} owes you; − reduces it or adds to what you owe. Voided bills are listed but never counted.</p>
          {statement.entries.length ? <button className="a-btn ghost" type="button" onClick={downloadStatement}>Download CSV</button> : null}
        </section>
      ) : null}
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
      <NoteHistory noteId={noteKey} />
      <div className="a-field-row">
        <button className="a-btn" type="button" onClick={() => go("note-edit", { note: noteKey })}>
          Edit note
        </button>
        <button className="a-btn ghost" type="button" onClick={() => go("note-new")}>
          Add another
        </button>
        <button className="a-btn ghost" type="button" onClick={closeWindow}>
          Close
        </button>
      </div>
    </section>
  );
}

function NoteNew({ onSave, initial }: {
  onSave: (card: NoteCard & { id: string; expectedVersion?: number }, requestId: string) => Promise<string>;
  initial?: NoteCard & { id: string; version?: number };
}) {
  const { go, closeWindow, notes, hub } = useApp();
  // The version this edit started from. A save replaces only that version.
  const baseVersion = useRef(initial?.version);
  // One id for this form: an add retried after an unconfirmed save returns
  // the note it already added rather than a second copy.
  const requestId = useRef(newRequestId());
  const [conflict, setConflict] = useState(false);
  const latest = initial ? notes[initial.id] : undefined;
  const editorName = (userId: string | null | undefined) => hub.members.find((member) => member.userId === userId)?.name ?? "Someone";
  const fact = (label: string) => initial?.facts.find(([key]) => key === label)?.[1] ?? "";
  const [type, setType] = useState<(typeof NOTE_TYPES)[number][0]>(() => initial?.pill === "Landlord" ? "contacts" : initial ? NOTE_TYPES.find(([, label]) => label === initial.pill)?.[0] ?? "other" : "other");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [pin, setPin] = useState(initial ? isNotePinned(initial) : false);
  const [net, setNet] = useState(fact("Network"));
  const [pass, setPass] = useState(fact("Password"));
  const [code, setCode] = useState(fact("Door code"));
  const [day, setDay] = useState(fact("Collection"));
  const [where, setWhere] = useState(fact("Where"));
  const [phone, setPhone] = useState(fact("Phone"));
  const [email, setEmail] = useState(fact("Email"));
  const [contact, setContact] = useState(fact("Who to call"));
  const [contactName, setContactName] = useState(fact("Contact name"));
  const [contactRole, setContactRole] = useState(fact("Role") || (initial?.pill === "Landlord" ? "Landlord" : ""));
  const [detail, setDetail] = useState(fact("Detail"));
  const [saving, setSaving] = useState(false);
  const { setError, invalid, message } = useFormError();

  function extra(kind: string): CSSProperties {
    const show =
      (kind === "wifi" && type === "wifi") ||
      (kind === "keys" && type === "keys") ||
      (kind === "bins" && type === "bins") ||
      (kind === "contact-method" && (type === "contacts" || type === "emergency")) ||
      (kind === "contacts" && type === "contacts") ||
      (kind === "emergency" && type === "emergency") ||
      (kind === "other" && (type === "other" || type === "rules"));
    return { display: show ? undefined : "none" };
  }

  async function save() {
    if (!title.trim()) {
      setError("Add a title before saving.", "note-title");
      return;
    }
    const typeLabel = NOTE_TYPES.find((t) => t[0] === type)?.[1] ?? "Note";
    const managedFacts = new Set(["Network", "Password", "Door code", "Collection", "Where", "Phone", "Email", "Contact name", "Role", "Who to call", "Detail", "Who can see", "This Hub"]);
    const facts: Array<[string, string]> = (initial?.facts ?? []).filter(([key]) => !managedFacts.has(key));
    if (type === "wifi") {
      if (net) facts.push(["Network", net]);
      if (pass) facts.push(["Password", pass]);
    }
    if (type === "keys" && code) facts.push(["Door code", code]);
    if (type === "bins") {
      if (day) facts.push(["Collection", day]);
      if (where) facts.push(["Where", where]);
    }
    if (type === "contacts") {
      if (contactName) facts.push(["Contact name", contactName]);
      if (contactRole) facts.push(["Role", contactRole]);
    }
    if (type === "contacts" || type === "emergency") {
      if (phone) facts.push(["Phone", phone]);
      if (email) facts.push(["Email", email]);
    }
    if (type === "emergency" && contact) facts.push(["Who to call", contact]);
    if ((type === "other" || type === "rules") && detail) facts.push(["Detail", detail]);
    if (!body.trim() && !facts.some(([, value]) => value.trim())) {
      setError("Add some details or a note before saving.", "note-body");
      return;
    }
    facts.push(["Who can see", "Everyone in this commune"]);
    if (pin) facts.push(["This Hub", "Pinned"]);
    setSaving(true);
    setError("");
    try {
      const id = await onSave({
        id: initial?.id ?? `draft-${Date.now()}`,
        expectedVersion: baseVersion.current,
        title: title.trim(),
        pill: typeLabel,
        kicker: pin ? "Pinned · everyone" : "Everyone",
        lede: body.trim().slice(0, 200),
        body: body.trim(),
        facts: facts.map(([key, value]) => [key, value.trim()] as [string, string]).filter(([, value]) => value),
      }, requestId.current);
      go("note", { note: id });
    } catch (cause) {
      const failure = commandFailure(cause, "Could not save the note.");
      // A 409 on an edit means someone saved first; their version is loaded.
      setConflict(failure.conflict);
      setError(!failure.rejected ? UNCERTAIN_RETRY_SAFE
        : /already used for a different/i.test(failure.message)
          ? "An earlier attempt may already have been saved. Close this and check the notes before trying again."
          : failure.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="a-window note-editor" onSubmit={(event) => { event.preventDefault(); if (!saving) void save(); }}>
      <p className="note-editor-intro">{type === "contacts" ? "Add one person or service per note. " : "Keep useful details together. "}Everyone in this commune can view and edit them.</p>
      <div className="a-field half">
        <label htmlFor="note-type">Type</label>
        <select id="note-type" value={type} onChange={(event) => setType(event.target.value as typeof type)}>
          {NOTE_TYPES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </div>
      <div className="a-field half">
        <label htmlFor="note-title">
          Title <span className="need">Required</span>
        </label>
        <input id="note-title" type="text" required maxLength={LIMITS.noteTitle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === "contacts" ? "e.g. Repairs & maintenance" : "Give this note a clear name"} {...invalid("note-title")} />
        <span className="a-field-limit">{title.length}/{LIMITS.noteTitle}</span>
        {message("note-title")}
      </div>
      <div className="note-editor-details">
      <div className="a-field" style={extra("contacts")}>
        <label htmlFor="note-contact-name">Person or business</label>
        <input id="note-contact-name" maxLength={LIMITS.noteDetail} value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="e.g. Alex at Riverside Repairs" />
      </div>
      <div className="a-field" style={extra("contacts")}>
        <label htmlFor="note-contact-role">Role or service</label>
        <input id="note-contact-role" maxLength={LIMITS.noteDetail} value={contactRole} onChange={(e) => setContactRole(e.target.value)} placeholder="e.g. Plumber, cleaner, landlord" />
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
      <div className="a-field half" style={extra("contact-method")}>
        <label htmlFor="note-phone">Phone</label>
        <input id="note-phone" type="tel" maxLength={LIMITS.noteDetail} value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div className="a-field half" style={extra("contact-method")}>
        <label htmlFor="note-email">Email</label>
        <input id="note-email" type={type === "contacts" || type === "emergency" ? "email" : "text"} maxLength={LIMITS.noteDetail} value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="a-field" style={extra("emergency")}>
        <label htmlFor="note-contact">Who to call</label>
        <input id="note-contact" maxLength={LIMITS.noteDetail} value={contact} onChange={(e) => setContact(e.target.value)} />
      </div>
      <div className="a-field" style={extra("other")}>
        <label htmlFor="note-extra">Detail</label>
        <input id="note-extra" maxLength={LIMITS.noteDetail} value={detail} onChange={(e) => setDetail(e.target.value)} />
      </div>
      </div>
      <div className="a-field">
        <label htmlFor="note-body">
          Note <span className="a-field-optional">(optional if details are filled in)</span>
        </label>
        <textarea
          id="note-body"
          rows={3}
          value={body}
          maxLength={LIMITS.noteBody}
          onChange={(e) => setBody(e.target.value)}
          placeholder={NOTE_BODY_HINT[type]}
          {...invalid("note-body")}
        />
        <span className="a-field-limit">{body.length}/{LIMITS.noteBody}</span>
        {message("note-body")}
      </div>
      <label className="note-editor-pin">
        <input type="checkbox" checked={pin} onChange={(event) => setPin(event.target.checked)} />
        <span>Pin this note<span className="note-editor-hint">Keep it at the top of the notes board.</span></span>
      </label>
      {conflict && latest ? (
        <div className="c-note-conflict" role="alert">
          <p>
            {editorName(latest.updatedBy)} saved a newer version
            {latest.updatedAt ? ` at ${new Date(latest.updatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}:
            “{latest.title}”. Your text is still in this form, unsaved.
          </p>
          <div className="a-field-row">
            <button className="a-btn" type="button" disabled={saving} onClick={() => {
              // Their version stays in the note's history; this saves yours on top.
              baseVersion.current = latest.version;
              setConflict(false);
              setError("");
              void save();
            }}>Save mine over theirs</button>
            <button className="a-btn ghost" type="button" disabled={saving} onClick={() => go("note", { note: latest.id })}>Discard mine, see theirs</button>
          </div>
        </div>
      ) : message()}
      <div className="a-field-row note-editor-actions">
        <button className="a-btn ghost" type="button" disabled={saving} onClick={() => initial ? go("note", { note: initial.id }) : closeWindow()}>
          Cancel
        </button>
        <button className="a-btn" type="submit" disabled={saving}>
          {saving ? "Saving…" : initial ? "Save changes" : "Save"}
        </button>
      </div>
    </form>
  );
}
