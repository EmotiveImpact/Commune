import { useEffect, useRef, useState } from "react";
import { Archive, CalendarDays, ChevronRight, Copy, Eye, Megaphone, Phone, ReceiptText, UsersRound, type LucideIcon } from "lucide-react";
import { useApp } from "../state";
import { Avatar } from "../ui/widgets";
import { Icon } from "../ui/Icon";
import { CalendarDate } from "../ui/CalendarDate";
import { CoverImage, coverToneClass } from "../ui/CoverImage";
import { isNotePinned, isSecretFact, noteCategory, notePreview } from "../data/notePresentation";
import { addDays, dateFromIso, needsDoneBy, taskDoneCopy, todayIso, type DoneBy, type OperationItem } from "../data/operations";
import { useReceiptActions } from "../ui/Receipts";
import { PayButtons } from "../ui/PayLinks";
import type { Need } from "../live/model";
import { hideToast, showToast } from "../ui/Toast";
import { DoneByChoice } from "../ui/DoneByChoice";
import { formatTimestampDay } from "../data/reminders";
import type { Hub, NoteCard } from "../data/household";

const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short" });
import "./Hub.css";

function HubHeading({ title, icon: HeadingIcon }: { title: string; icon: LucideIcon }) {
  return <h2 className="c-hub-section-title"><HeadingIcon className="c-hub-heading-icon" size={17} strokeWidth={1.5} aria-hidden="true" />{title}</h2>;
}

function HubLocation({ hub }: { hub: Pick<Hub, "type" | "address" | "destination" | "stayName" | "stayAddress"> }) {
  if (hub.type === "Trip") {
    if (!hub.destination && !hub.stayName && !hub.stayAddress) return null;
    return <div className="c-hub-location">
      {hub.destination && <p><span>Area</span>{hub.destination}</p>}
      {(hub.stayName || hub.stayAddress) && <p><span>Stay</span>{[hub.stayName, hub.stayAddress].filter(Boolean).join(" · ")}</p>}
    </div>;
  }
  return hub.address ? <div className="c-hub-location"><p>{hub.address}</p></div> : null;
}

/** Notices from an admin. Important ones ask each member to confirm they have seen them. */
function Announcements() {
  const { announcements, hub, you, acknowledgeAnnouncement, archiveAnnouncement, go, personName } = useApp();
  const [pending, setPending] = useState<string | null>(null);
  const [confirmDown, setConfirmDown] = useState<string | null>(null);
  const [error, setError] = useState("");
  if (!announcements.length) return null;
  const nameOf = (userId: string) => personName(userId, "A former member");
  async function run(id: string, action: () => Promise<unknown>) {
    setPending(id); setError("");
    try { await action(); setConfirmDown(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update the announcement. Please try again."); }
    finally { setPending(null); }
  }
  return <section className="c-hub-panel c-hub-announcements" aria-label="Announcements">
    <div className="c-hub-section-head"><HubHeading title="Announcements" icon={Megaphone} />
      {hub.role === "admin" && <button className="c-hub-link" type="button" onClick={() => go("announcement-new")}>Post another</button>}
    </div>
    {announcements.map(item => {
      // Everyone currently in the commune apart from the person who posted it.
      const audience = hub.members.filter(member => member.userId && member.userId !== item.authorId);
      const seen = new Set(item.acknowledgements.map(entry => entry.userId));
      const waiting = audience.filter(member => !seen.has(member.userId!));
      const mine = item.authorId === you.id;
      const canTakeDown = mine || hub.role === "admin";
      return <article className="c-hub-announcement" key={item.id}>
        <strong>{item.title}</strong>
        {item.body && <p>{item.body}</p>}
        <small>{mine ? "You" : nameOf(item.authorId)} · {formatTimestampDay(item.createdAt)}</small>
        {item.needsAcknowledgement && <div className="c-hub-announcement-seen">
          <span>Seen by {audience.length - waiting.length} of {audience.length}{waiting.length && (mine || hub.role === "admin")
            ? `. Waiting for ${waiting.map(member => member.name.split(" ")[0]).join(", ")}` : ""}</span>
          {!mine && (seen.has(you.id)
            ? <span className="c-hub-announcement-done">You have seen this</span>
            : <button className="c-hub-button" type="button" disabled={pending !== null} onClick={() => void run(item.id, () => acknowledgeAnnouncement(item.id))}>I’ve seen this</button>)}
        </div>}
        {canTakeDown && (confirmDown === item.id
          ? <div className="c-hub-announcement-actions"><span>Take it down? It stays in the activity history.</span>
            <button className="c-hub-link" type="button" disabled={pending !== null} onClick={() => void run(item.id, () => archiveAnnouncement(item.id))}>Take down{" "}<span className="c-visually-hidden">{item.title}</span></button>
            <button className="c-hub-link" type="button" onClick={() => setConfirmDown(null)}>Keep it</button></div>
          : <div className="c-hub-announcement-actions"><button className="c-hub-link" type="button" onClick={() => setConfirmDown(item.id)}>Take down{" "}<span className="c-visually-hidden">{item.title}</span></button></div>)}
      </article>;
    })}
    {error && <p role="alert" className="a-form-error">{error}</p>}
  </section>;
}

/** One line on the photo: what this week holds for the house. */
function weekSentence(late: number, today: number, bills: number): string {
  const parts = [late ? `${late} late` : "", today ? `${today} due today` : "", bills ? `${bills} ${bills === 1 ? "bill" : "bills"} due this week` : ""].filter(Boolean);
  if (!parts.length) return "A quiet week.";
  const text = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
  return `${text[0].toUpperCase()}${text.slice(1)}.`;
}

const firstOf = (name = "") => name.split(" ")[0] || name;

/** Where the viewer stands in this commune, and the one payment to record next. */
function YourPart() {
  const { hub, go, personName } = useApp();
  const [message, setMessage] = useState("");
  const receipts = useReceiptActions(setMessage);
  const money = (hub.now as Need[]).filter(item => item.kind === "confirm" || item.kind === "pay");
  const pledges = (hub.now as Need[]).filter(item => item.kind === "pledge");
  const next = money[0];
  const who = next ? personName(next.person, next.kind === "pay" ? "the bill payer" : "a former member") : "";
  function act(decline = false) {
    if (!next) return;
    setMessage("");
    if (next.kind === "pay" && next.shareId && next.minor) {
      receipts.report({ shareId: next.shareId, payerName: who, expenseName: next.title, outstandingMinor: next.minor, currency: hub.currency, communeId: hub.id, payerId: next.person });
    } else if (next.kind === "confirm" && next.report) {
      receipts.answer({ report: next.report, debtorName: who, expenseName: next.title, currency: hub.currency, decision: decline ? "decline" : "confirm", communeId: hub.id, expenseId: next.expenseId });
    } else go("expense", { expense: next.expenseId });
  }
  const square = hub.oweLabel === "You’re even";
  return <section className="c-hub-part" aria-label="Your part">
    <p className="c-hub-over">Your part in {hub.name}</p>
    <h2 className="c-hub-sentence">{square ? <>You’re all square here.</> : <>{hub.oweLabel} <em>{hub.oweAmount}</em> here.</>}</h2>
    <p className="c-hub-part-copy">{hub.oweCopy}</p>
    {next && <div className="c-hub-next">
      <div className="c-hub-next-body">
        <span><strong>{next.title}</strong><small className={next.late && next.kind !== "confirm" ? "c-hub-late" : undefined}>{next.when}</small></span>
        {next.amount && <strong className="c-hub-next-amount">{next.amount}</strong>}
      </div>
      {next.kind === "pay" && next.minor ? <div className="c-hub-next-pay">
        <PayButtons userId={next.person} communeId={hub.id} name={who} amountMinor={next.minor} currency={hub.currency} note={next.title}
          onOpen={() => act()} disabled={receipts.busy} />
      </div> : null}
      <div className="c-hub-next-foot">
        <button className="c-hub-button is-large" type="button" disabled={receipts.busy} onClick={() => act()}>
          {next.kind === "pay" ? `I’ve paid ${firstOf(who)} ${next.amount ?? ""}`.trim() : next.kind === "confirm" ? `Confirm ${next.amount ?? ""} received`.replace("  ", " ") : "Open"}
        </button>
        {next.kind === "confirm" && <button className="c-hub-pill" type="button" disabled={receipts.busy} onClick={() => act(true)}>Not received</button>}
        {money.length > 1 && <button className="c-hub-link" type="button" onClick={() => go("settle")}>{money.length - 1} more to settle</button>}
      </div>
    </div>}
    {pledges.slice(0, 2).map((item, index) => <button className="c-hub-note-row c-hub-pledge" type="button" key={`pledge-${item.fundId ?? index}`} onClick={() => go("funds", item.fundId ? { record: { kind: "fund", id: item.fundId } } : undefined)}>
      <span><strong>{item.title}</strong><small>{[item.when, item.amount].filter(Boolean).join(" · ")}</small></span><ChevronRight size={16} aria-hidden="true" />
    </button>)}
    <div className="c-hub-part-actions">
      <button className={next ? "c-hub-pill" : "c-hub-button"} type="button" onClick={() => go("add-expense")}><Icon name="plus" size={16} />Add expense</button>
      <button className="c-hub-link" type="button" onClick={() => go("settle")}>View settlement</button>
      {hub.waiting.length > 0 && <span className="c-hub-part-waiting">{hub.waiting.length} waiting on others</span>}
    </div>
    {message && <p role="alert" className="a-form-error">{message}</p>}
    {receipts.dialogs}
  </section>;
}

/** The next seven days as a strip, late jobs first, bills on the day they fall due. */
function Week() {
  const { operations, expenses, toggleOperation, undoOperation, go, you, hub } = useApp();
  const [pending, setPending] = useState<string | null>(null);
  // Someone else's task, ticked: it asks who did it before it is marked done.
  const [asking, setAsking] = useState<string | null>(null);
  const [error, setError] = useState("");
  // Undo puts focus back on the task's checkbox once the controls are enabled again.
  const [focusTask, setFocusTask] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (pending !== null || focusTask === null) return;
    listRef.current?.querySelector<HTMLElement>(`[data-task="${focusTask}"] input`)?.focus();
    setFocusTask(null);
  }, [pending, focusTask]);
  const today = todayIso();
  const days = Array.from({ length: 7 }, (_, index) => addDays(today, index));
  const end = days[6];
  const open = operations.filter(item => item.status === "open" && item.date <= end && (item.date >= today || item.kind === "task"));
  const late = open.filter(item => item.date < today);
  const bills = expenses.filter(row => row.dueOn && row.dueOn >= today && row.dueOn <= end && row.status !== "settled");
  async function complete(item: OperationItem, doneBy?: DoneBy) {
    const { id } = item;
    if (!doneBy && needsDoneBy(item, you.id)) { setAsking(id); setError(""); hideToast(); return; }
    setAsking(null); setPending(id); setError(""); hideToast();
    try {
      const result = await toggleOperation(id, doneBy);
      showToast({ text: taskDoneCopy(item, doneBy, result), action: { label: "Undo", busyLabel: "Undoing…", undo: true, run: () => undo(result.occurrenceId, id) } });
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update the task. Please try again."); }
    finally { setPending(null); }
  }
  async function undo(occurrenceId: string, taskId: string) {
    setPending(occurrenceId); setError("");
    try {
      await undoOperation(occurrenceId);
      setFocusTask(taskId);
      showToast({ text: "Undone. The task is back as it was." });
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not undo that. Please try again."); }
    finally { setPending(null); }
  }
  const face = (item: OperationItem) => {
    const member = hub.members.find(entry => entry.userId === item.assigneeId);
    return member ? <Avatar tone={member.cls} initials={member.ini} decorative /> : null;
  };
  const chip = (item: OperationItem) => <div className={`c-hub-chip${item.kind === "event" ? " is-event" : ""}${item.date < today ? " is-late" : ""}`} key={item.id} data-task={item.id}>
    {item.kind === "event" ? <CalendarDays className="c-hub-chip-icon" size={14} strokeWidth={1.5} aria-hidden="true" /> : face(item)}
    <button className="c-hub-chip-copy" type="button" onClick={() => go("operation", { operation: item.id })}>
      <strong>{item.title}</strong>
      <small>{item.kind === "event" ? item.time || "All day" : item.assigneeId === you.id ? "You" : firstOf(item.assignee) || "Unassigned"}{item.date < today ? " · late" : ""}</small>
    </button>
    {item.kind === "task" && <label className="c-hub-check"><input type="checkbox" aria-label={`Mark ${item.title} done`}
      checked={false} disabled={pending !== null} onChange={() => void complete(item)} /></label>}
  </div>;
  const asked = open.find(item => item.id === asking);
  const empty = !open.length && !bills.length;
  return <section className="c-hub-panel c-hub-week" aria-label="This week">
    <div className="c-hub-section-head"><HubHeading title="This week" icon={CalendarDays} />
      <button className="c-hub-link" type="button" onClick={() => go("operations")}>View week</button></div>
    {asked && <DoneByChoice className="c-hub-doneby" holder={asked.assignee ?? ""} title={asked.title}
      disabled={pending !== null} onChoose={(doneBy) => void complete(asked, doneBy)}
      onCancel={() => { setAsking(null); setFocusTask(asked.id); }} />}
    {empty ? <div className="c-hub-empty"><p>Nothing planned for this week.</p><button className="c-hub-link" type="button" onClick={() => go("operation-new")}>Add a task or event</button></div>
      : <div className="c-hub-days" ref={listRef}>
        {late.length > 0 && <div className="c-hub-day is-late"><p className="c-hub-day-head"><span>Late</span><b>{late.length}</b></p>{late.map(chip)}</div>}
        {days.map(day => {
          const items = open.filter(item => item.date === day);
          const due = bills.filter(row => row.dueOn === day);
          return <div key={day} className={`c-hub-day${day === today ? " is-today" : ""}${items.length || due.length ? "" : " is-free"}`}>
            <CalendarDate className="c-hub-day-date" date={day} today={today} showMonth={false} />
            {items.map(chip)}
            {due.map(row => <button key={row.id} className="c-hub-chip is-bill" type="button" onClick={() => go("expense", { expense: row.id })}>
              <ReceiptText className="c-hub-chip-icon" size={14} strokeWidth={1.5} aria-hidden="true" />
              <span className="c-hub-chip-copy"><strong>{row.name}</strong><small>Bill due · {row.amount}</small></span>
            </button>)}
            {!items.length && !due.length && <span className="c-hub-free">Free</span>}
          </div>;
        })}
      </div>}
    {error && <p role="alert" className="a-form-error">{error}</p>}
  </section>;
}

/** Everyone in the commune: what you and they owe each other, and their next job. */
function People() {
  const { hub, operations, you, go } = useApp();
  const today = todayIso();
  const jobs = operations.filter(item => item.status === "open" && item.kind === "task" && item.date <= addDays(today, 6)).sort((a, b) => a.date.localeCompare(b.date));
  return <section className="c-hub-panel c-hub-people" aria-label="People">
    <div className="c-hub-section-head"><HubHeading title="People" icon={UsersRound} />
      <button className="c-hub-link" type="button" onClick={() => go("members")}>Members</button></div>
    {hub.members.map(member => {
      const mine = member.userId === you.id;
      const job = jobs.find(item => item.assigneeId === member.userId);
      const when = job ? job.date < today ? "late" : job.date === today ? "today" : weekday.format(dateFromIso(job.date)) : "";
      return <button key={member.userId ?? member.name} className="c-hub-person" type="button" onClick={() => go(mine ? "members" : "settle")}>
        <Avatar tone={member.cls} initials={member.ini} decorative />
        <span><strong>{mine ? "You" : member.name}</strong><small className={when === "late" ? "c-hub-late" : undefined}>{job ? `${job.title} · ${when}` : "Nothing this week"}</small></span>
        <span className={`c-hub-person-balance${/^Owes you|^Owed/.test(member.bal) ? " is-in" : ""}`}>{member.bal}</span>
      </button>;
    })}
    {hub.members.length < 2 && hub.role === "admin" && <div className="c-hub-empty"><p>Bring your people in to share costs, jobs and the useful details.</p><button className="c-hub-link" type="button" onClick={() => go("member-invite")}>Invite someone</button></div>}
  </section>;
}

const PHONE = /^\+?[\d ()-]{7,}$/;

/** A shared detail as a card: safe facts shown, passwords and codes behind Show and Copy. */
function Essential({ id, note }: { id: string; note: NoteCard }) {
  const { go } = useApp();
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState("");
  const category = noteCategory(note);
  const facts = note.facts.filter(([key]) => key !== "This Hub").slice(0, 3);
  const secret = (key: string) => isSecretFact(key) || /\bcode\b/i.test(key);
  const secrets = facts.filter(([key]) => secret(key));
  const phone = facts.find(([key, value]) => !secret(key) && PHONE.test(value.trim()));
  async function copy() {
    const text = secrets.map(([, value]) => value).join(" ");
    try { await navigator.clipboard.writeText(text); setCopied("Copied"); }
    catch { setShown(true); setCopied("Select it to copy"); }
  }
  return <article className="c-hub-essential">
    {category.toLowerCase() !== note.title.toLowerCase() && <span className="c-hub-over">{category}</span>}
    <button className="c-hub-essential-title" type="button" onClick={() => go("note", { note: id })}>{note.title}</button>
    {facts.length ? <dl>{facts.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{secret(key) && !shown ? <span aria-label="Hidden">••••••</span> : value}</dd></div>)}</dl>
      : <p className="c-hub-essential-copy">{notePreview(note)}</p>}
    {(secrets.length > 0 || phone) && <div className="c-hub-essential-actions">
      {secrets.length > 0 && <button className="c-hub-pill is-small" type="button" aria-pressed={shown} onClick={() => setShown(value => !value)}><Eye size={14} aria-hidden="true" />{shown ? "Hide" : "Show"}<span className="c-visually-hidden"> {note.title}</span></button>}
      {secrets.length > 0 && <button className="c-hub-pill is-small" type="button" onClick={() => void copy()}><Copy size={14} aria-hidden="true" />Copy<span className="c-visually-hidden"> {note.title}</span></button>}
      {phone && <a className="c-hub-pill is-small" href={`tel:${phone[1].replace(/[^\d+]/g, "")}`}><Phone size={14} aria-hidden="true" />Call {phone[0]}</a>}
      {copied && <span className="c-hub-copied" role="status">{copied}</span>}
    </div>}
  </article>;
}

const PRIORITY = ["Emergency", "Wi-Fi", "Keys / door", "Bins", "Contacts", "House rules", "Other"];

export function HubScreen() {
  const { hub, go, notes, expenses, operations } = useApp();
  // Pinned notes lead, then the details people look up most.
  const rank = (note: NoteCard) => (isNotePinned(note) ? -1 : 0) * 100 + (PRIORITY.indexOf(noteCategory(note)) + 1 || PRIORITY.length + 1);
  const essentials = Object.entries(notes).sort((a, b) => rank(a[1]) - rank(b[1]));
  const canInvite = hub.role === "admin";
  const today = todayIso();
  const end = addDays(today, 6);
  const late = operations.filter(item => item.status === "open" && item.kind === "task" && item.date < today).length;
  const dueToday = operations.filter(item => item.status === "open" && item.date === today).length;
  const bills = expenses.filter(row => row.dueOn && row.dueOn >= today && row.dueOn <= end && row.status !== "settled").length;
  return <div className="c-hub">
    <section className={`c-hub-identity${hub.photo ? ` has-photo ${coverToneClass(hub)}` : ""}`} aria-label="Commune identity">
      {hub.photo && <CoverImage className="c-hub-cover" hub={hub} placement="hero" />}
      <div className="c-hub-identity-copy"><span className="c-hub-type">{hub.type}</span>
        <h2>{hub.name}</h2>
        <HubLocation hub={hub} />
        <button type="button" className="c-hub-people-link" onClick={() => go("members")}>
          <span className="avatar-stack" aria-hidden="true">{hub.members.slice(0, 5).map(member => <Avatar key={member.userId ?? member.name} tone={member.cls} initials={member.ini} />)}</span>
          <span>{hub.members.length} {hub.members.length === 1 ? "person" : "people"}</span>{" "}<span className="c-visually-hidden">in this commune, view members</span>
        </button>
        <p className="c-hub-pulse">{weekSentence(late, dueToday, bills)}</p>
      </div>
      <div className="c-hub-hero-actions">
        {canInvite && <button className="c-hub-settings" type="button" onClick={() => go("announcement-new")}><Megaphone size={16} strokeWidth={1.5} />Announce</button>}
        {canInvite && <button className="c-hub-settings" type="button" onClick={() => go("member-invite")}><UsersRound size={16} strokeWidth={1.5} />Invite</button>}
        <button className="c-hub-settings" type="button" aria-label="Commune settings" onClick={() => go("commune-settings")}><Icon name="settings" size={16} /></button>
      </div>
    </section>
    <div className="c-hub-top">
      <YourPart key={`part-${hub.id}`} />
      <Announcements key={hub.id} />
    </div>
    <Week key={`week-${hub.id}`} />
    <div className="c-hub-lower">
      <People />
      <section className="c-hub-panel c-hub-essentials" aria-label="Shared essentials">
        <div className="c-hub-section-head"><HubHeading title="Shared essentials" icon={Archive} />
          <button className="c-hub-link" type="button" onClick={() => go("notes")}>All notes</button></div>
        {essentials.length ? <div className="c-hub-essential-grid">{essentials.slice(0, 4).map(([id, note]) => <Essential key={id} id={id} note={note} />)}</div>
          : <div className="c-hub-empty"><p>Keep Wi-Fi, contacts and other useful details here.</p><button type="button" className="c-hub-link" onClick={() => go("note-new")}>Add a shared detail</button></div>}
      </section>
    </div>
    {expenses.length > 0 && <section className="c-hub-panel c-hub-recent" aria-label="Recent expenses">
      <div className="c-hub-section-head"><HubHeading title="Recently in your commune" icon={ReceiptText} /><button className="c-hub-link" type="button" onClick={() => go("expenses")}>All expenses</button></div>
        {expenses.slice(0, 3).map(row => <button key={row.id} className="c-hub-expense-row" type="button" onClick={() => go("expense", { expense: row.id })}>
          <span><strong>{row.name}</strong><small>{firstOf(row.paidBy)} paid</small></span>
          <span className="c-hub-expense-end"><strong>{row.amount}</strong><small className={`c-hub-expense-status is-${row.status}`}>{row.statusLabel}</small></span>
        </button>)}
    </section>}
  </div>;
}

// An empty ledger still has people, notes and responsibilities. Keep them usable.
export function HubEmptyScreen() { return <HubScreen />; }
