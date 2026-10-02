import { useState, type ReactNode } from "react";
import { Archive, CalendarDays, ChevronRight, Plus, ReceiptText, UsersRound, type LucideIcon } from "lucide-react";
import { useApp } from "../state";
import { Avatar } from "../ui/widgets";
import { Icon } from "../ui/Icon";
import { isNotePinned, noteCategory, notePreview } from "../data/notePresentation";
import { addDays, dateFromIso, todayIso } from "../data/operations";
import type { Hub, RouteId } from "../data/household";
import "./Hub.css";

function HubSection({ title, icon: HeadingIcon, context, count, action, children }: {
  title: string; icon?: LucideIcon; context?: string; count?: string;
  action?: { label: string; to: RouteId; prominent?: boolean }; children: ReactNode;
}) {
  const { go } = useApp();
  return <section className="c-hub-panel" aria-label={title}>
    <div className="c-hub-section-head"><h2 className="c-hub-section-title">{HeadingIcon && <HeadingIcon size={17} strokeWidth={1.5} aria-hidden="true" />}{title}</h2>
      {action ? <button className={action.prominent ? "c-hub-invite" : "c-hub-link"} type="button" onClick={() => go(action.to)}>
        {action.prominent && <Plus size={15} aria-hidden="true" />}{action.label}
      </button> : count && <span className="c-hub-count">{count}</span>}
    </div>
    {context && <p className="c-hub-context">{context}</p>}
    {children}
  </section>;
}

function HubLocation({ hub }: { hub: Hub }) {
  if (hub.type === "Trip") {
    if (!hub.destination && !hub.stayName && !hub.stayAddress) return null;
    return <div className="c-hub-location">
      {hub.destination && <p><span>Area</span>{hub.destination}</p>}
      {(hub.stayName || hub.stayAddress) && <p><span>Stay</span>{[hub.stayName, hub.stayAddress].filter(Boolean).join(" · ")}</p>}
    </div>;
  }
  return hub.address ? <div className="c-hub-location"><p>{hub.address}</p></div> : null;
}

function Responsibilities() {
  const { operations, toggleOperation, go } = useApp();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const today = todayIso();
  const end = addDays(today, 6);
  const items = operations.filter(item => item.status === "open" && item.date <= end && (item.date >= today || item.kind === "task"))
    .sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  async function complete(id: string, title: string) {
    setPending(id); setError(""); setFeedback("");
    try { await toggleOperation(id); setFeedback(`${title} updated.`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update the task. Please try again."); }
    finally { setPending(null); }
  }
  return <HubSection title="This week" icon={CalendarDays} action={{ label: "View week", to: "operations" }}>
    {items.map(item => {
      const date = dateFromIso(item.date);
      const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(date);
      const day = new Intl.DateTimeFormat("en-GB", { day: "numeric" }).format(date);
      const due = item.date === today ? "Today" : new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(dateFromIso(item.date));
      const late = item.status === "open" && item.date < today;
      return <div className={`c-hub-task${item.status === "done" ? " is-done" : ""}`} key={item.id}>
        <time className="c-hub-date" dateTime={item.date} title={due}><span>{weekday}</span><strong>{day}</strong>{item.date === today ? <em>Today</em> : item.date === addDays(today, 1) ? <em>Tomorrow</em> : null}</time>
        <button className="c-hub-task-copy" type="button" onClick={() => go("operation", { operation: item.id })}>
          <strong>{item.title}</strong><span>{item.assignee || "Unassigned"} · <span className={late ? "c-hub-late" : undefined}>{late ? "Overdue · " : ""}{due}</span>{item.time ? ` · ${item.time}` : ""}</span>
        </button>
        {item.kind === "task" && <input type="checkbox" aria-label={`Mark ${item.title} ${item.status === "done" ? "open" : "done"}`}
          checked={item.status === "done"} disabled={pending !== null} onChange={() => void complete(item.id, item.title)} />}
      </div>;
    })}
    {!items.length && <div className="c-hub-empty"><p>Nothing planned for this week.</p><button className="c-hub-link" type="button" onClick={() => go("operation-new")}>Add a task or event</button></div>}
    {error && <p role="alert" className="a-form-error">{error}</p>}
    <span className="sr-only" role="status">{feedback}</span>
  </HubSection>;
}

export function HubScreen() {
  const { hub, go, notes, emptyHub, expenses, operations, you } = useApp();
  const entries = Object.entries(notes);
  const pinned = entries.filter(([, note]) => isNotePinned(note));
  const essentials = entries.filter(([, note]) => !isNotePinned(note));
  const outstanding = hub.moves.filter(move => !move.even);
  const yours = operations.filter(item => item.status === "open" && item.kind === "task" && item.assignee === you.name && item.date <= todayIso());
  const canInvite = hub.role === "admin";
  return <div className="c-hub">
    <section className={`c-hub-identity${hub.photo ? " has-photo" : ""}`} aria-label="Commune identity">
      {hub.photo && <img className="c-hub-cover" src={hub.photo} alt="" />}
      <div className="c-hub-identity-copy"><span className="c-hub-type">{hub.type}</span>
        <h1>{hub.name}</h1>
        <HubLocation hub={hub} />
        <button type="button" className="c-hub-people-link" aria-label="View commune members" onClick={() => go("members")}>
          <span className="avatar-stack">{hub.members.slice(0, 5).map(member => <Avatar key={member.userId ?? member.name} tone={member.cls} initials={member.ini} />)}</span>
          <span>{hub.members.length} {hub.members.length === 1 ? "person" : "people"}</span>
        </button>
      </div>
      <div className="c-hub-hero-actions">
        {canInvite && <button className="c-hub-settings" type="button" onClick={() => go("member-invite")}><UsersRound size={16} strokeWidth={1.5} />Invite</button>}
        <button className="c-hub-settings" type="button" aria-label="Commune settings" onClick={() => go("commune-settings")}><Icon name="settings" size={16} /></button>
      </div>
    </section>
    <div className="c-hub-overview">
      <section className="c-hub-balance" aria-label="Your balance"><span className="c-hub-eyebrow">{hub.oweLabel}</span><strong className="c-hub-amount">{hub.oweAmount}</strong>
        <p>{hub.oweCopy}</p><div className="c-hub-balance-actions"><button className="c-hub-button" type="button" onClick={() => go("add-expense")}><Icon name="plus" size={16} />Add expense</button>
        <button className="c-hub-link" type="button" onClick={() => go("settle")}>View settlement</button></div>
      </section>
      <HubSection title="Needs you" count={`${outstanding.length + yours.length} ${outstanding.length + yours.length === 1 ? "item" : "items"}`}>
        {outstanding.slice(0, 3).map((move, index) => <div key={`${move.names}-${move.expenseId ?? index}`} className="c-hub-attention-row">
          <span className="c-hub-attention-copy"><span className="c-hub-icon-chip"><ReceiptText size={18} strokeWidth={1.5} /></span><span><strong>{move.why}</strong><small>{move.names}</small></span></span>
          <span className="c-hub-attention-end"><strong>{move.amt}</strong><button type="button" onClick={() => move.expenseId ? go("expense", { expense: move.expenseId }) : go("settle")}>View</button></span>
        </div>)}
        {yours.slice(0, 2).map(item => <button className="c-hub-note-row" type="button" key={item.id} onClick={() => go("operation", { operation: item.id })}><span><strong>{item.title}</strong><small>{item.date < todayIso() ? "Overdue · your turn" : "Your turn today"}</small></span><ChevronRight size={16} /></button>)}
        {!outstanding.length && !yours.length && <div className="c-hub-empty"><p>{emptyHub && canInvite ? "Bring your people in to share costs, jobs and the useful details." : "Nothing needs your attention right now."}</p>
          {emptyHub && canInvite && <button className="c-hub-button" type="button" onClick={() => go("member-invite")}>Invite your people</button>}</div>}
        {outstanding.length > 3 && <button className="c-hub-link c-hub-more" type="button" onClick={() => go("settle")}>View all outstanding shares</button>}
      </HubSection>
    </div>
    <div className="c-hub-lower">
      <Responsibilities key={hub.id} />
      <HubSection title="Shared essentials" icon={Archive} action={{ label: "All notes", to: "notes" }}>
        {essentials.slice(0, 3).map(([id, note]) => <button key={id} className="c-hub-note-row" type="button" onClick={() => go("note", { note: id })}>
          <span><strong>{note.title}</strong><small>{noteCategory(note)}</small></span><ChevronRight size={16} aria-hidden="true" />
        </button>)}
        {!essentials.length && <div className="c-hub-empty"><p>Keep Wi-Fi, contacts and other useful details here.</p><button type="button" className="c-hub-link" onClick={() => go("note-new")}>Add a shared detail</button></div>}
        {pinned.length > 0 && <section className="c-hub-pinned" aria-label="Pinned notes">{pinned.slice(0, 2).map(([id, note]) => <button key={id} className="c-hub-note-row" type="button" onClick={() => go("note", { note: id })}>
          <span><strong>{note.title}</strong><small>{notePreview(note)}</small></span><ChevronRight size={16} aria-hidden="true" />
        </button>)}</section>}
      </HubSection>
    </div>
    {expenses.length > 0 && <section className="c-hub-recent" aria-label="Recent expenses">
      <div className="c-hub-section-head"><h2 className="c-hub-section-title">Recently in your commune</h2><button className="c-hub-link" type="button" onClick={() => go("expenses")}>All expenses</button></div>
        {expenses.slice(0, 3).map(row => <button key={row.id} className="c-hub-expense-row" type="button" onClick={() => go("expense", { expense: row.id })}>
          <span><strong>{row.name}</strong><small>{row.paidBy}</small></span>
          <span className="c-hub-expense-end"><strong>{row.amount}</strong><small className={`c-hub-expense-status is-${row.status}`}>{row.statusLabel}</small></span>
        </button>)}
    </section>}
  </div>;
}

// An empty ledger still has people, notes and responsibilities. Keep them usable.
export function HubEmptyScreen() { return <HubScreen />; }
