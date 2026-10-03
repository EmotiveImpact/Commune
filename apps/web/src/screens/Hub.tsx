import { useEffect, useRef, useState, type ReactNode } from "react";
import { Archive, CalendarDays, ChevronRight, CircleAlert, Plus, ReceiptText, UsersRound, Wallet, type LucideIcon } from "lucide-react";
import { useApp } from "../state";
import { Avatar } from "../ui/widgets";
import { Icon } from "../ui/Icon";
import { CalendarDate } from "../ui/CalendarDate";
import { isNotePinned, noteCategory, notePreview } from "../data/notePresentation";
import { addDays, dateFromIso, todayIso } from "../data/operations";
import type { Hub, RouteId } from "../data/household";
import "./Hub.css";

function HubHeading({ title, icon: HeadingIcon }: { title: string; icon: LucideIcon }) {
  return <h2 className="c-hub-section-title"><HeadingIcon className="c-hub-heading-icon" size={17} strokeWidth={1.5} aria-hidden="true" />{title}</h2>;
}

function HubSection({ title, icon, context, count, action, children }: {
  title: string; icon: LucideIcon; context?: string; count?: string;
  action?: { label: string; to: RouteId; prominent?: boolean }; children: ReactNode;
}) {
  const { go } = useApp();
  return <section className="c-hub-panel" aria-label={title}>
    <div className="c-hub-section-head"><HubHeading title={title} icon={icon} />
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
  const { operations, toggleOperation, undoOperation, go } = useApp();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<{ text: string; undoId?: string } | null>(null);
  // A completed task leaves the list (and its checkbox with it). Move focus to
  // the result once the controls are enabled again, so it is not lost.
  const [focusTarget, setFocusTarget] = useState<{ kind: "undo" | "feedback" } | { kind: "task"; id: string } | null>(null);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (pending !== null || !focusTarget) return;
    if (focusTarget.kind === "task") {
      (listRef.current?.querySelector<HTMLElement>(`[data-task="${focusTarget.id}"] input`) ?? feedbackRef.current)?.focus();
    } else if (focusTarget.kind === "undo" && undoRef.current) {
      undoRef.current.focus();
    } else {
      feedbackRef.current?.focus();
    }
    setFocusTarget(null);
  }, [pending, focusTarget]);
  const today = todayIso();
  const end = addDays(today, 6);
  const items = operations.filter(item => item.status === "open" && item.date <= end && (item.date >= today || item.kind === "task"))
    .sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  async function complete(id: string, title: string) {
    setPending(id); setError(""); setFeedback(null);
    try {
      const result = await toggleOperation(id);
      setFeedback({ text: result.status === "done" ? `${title} marked done.` : `${title} done. Next: ${result.assignee ?? "unassigned"}.`, undoId: result.occurrenceId });
      setFocusTarget({ kind: "undo" });
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update the task. Please try again."); }
    finally { setPending(null); }
  }
  async function undo(occurrenceId: string) {
    setPending(occurrenceId); setError("");
    try {
      const result = await undoOperation(occurrenceId);
      setFeedback({ text: "Undone. The task is back as it was." });
      setFocusTarget({ kind: "task", id: operations.find(item => item.history?.some(entry => entry.id === result.occurrenceId))?.id ?? "" });
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not undo that. Please try again."); }
    finally { setPending(null); }
  }
  return <HubSection title="This week" icon={CalendarDays} action={{ label: "View week", to: "operations" }}>
    <div ref={listRef}>
    {items.map(item => {
      const due = item.date === today ? "Today" : new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(dateFromIso(item.date));
      const late = item.status === "open" && item.date < today;
      return <div className={`c-hub-task${item.status === "done" ? " is-done" : ""}`} key={item.id} data-task={item.id}>
        <CalendarDate date={item.date} today={today} showMonth={false} />
        <button className="c-hub-task-copy" type="button" onClick={() => go("operation", { operation: item.id })}>
          <strong>{item.title}</strong><span>{item.assignee || "Unassigned"} · <span className={late ? "c-hub-late" : undefined}>{late ? "Overdue · " : ""}{due}</span>{item.time ? ` · ${item.time}` : ""}</span>
        </button>
        {item.kind === "task" && <input type="checkbox" aria-label={`Mark ${item.title} ${item.status === "done" ? "open" : "done"}`}
          checked={item.status === "done"} disabled={pending !== null} onChange={() => void complete(item.id, item.title)} />}
      </div>;
    })}
    </div>
    {!items.length && <div className="c-hub-empty"><p>Nothing planned for this week.</p><button className="c-hub-link" type="button" onClick={() => go("operation-new")}>Add a task or event</button></div>}
    {error && <p role="alert" className="a-form-error">{error}</p>}
    <p ref={feedbackRef} tabIndex={-1} className={feedback ? "c-hub-task-feedback" : "sr-only"} role="status">{feedback?.text}{feedback?.undoId
      ? <button ref={undoRef} className="c-hub-link" type="button" disabled={pending !== null} onClick={() => void undo(feedback.undoId!)}>Undo</button> : null}</p>
  </HubSection>;
}

export function HubScreen() {
  const { hub, go, notes, expenses, operations, you } = useApp();
  const entries = Object.entries(notes);
  const pinned = entries.filter(([, note]) => isNotePinned(note));
  const priority = ["Emergency", "Keys / door", "Wi-Fi", "Contacts", "Bins", "House rules", "Other"];
  const essentials = entries.filter(([, note]) => !isNotePinned(note)).sort((a, b) => {
    const rank = (note: typeof a[1]) => { const index = priority.indexOf(noteCategory(note)); return index < 0 ? priority.length : index; };
    return rank(a[1]) - rank(b[1]);
  });
  const outstanding = hub.moves.filter(move => !move.even);
  const yours = operations.filter(item => item.status === "open" && item.kind === "task" && item.assignee === you.name && item.date <= todayIso());
  const yourPledges = hub.now.filter(item => item.go === "funds");
  const attentionCount = outstanding.length + yours.length + yourPledges.length;
  const canInvite = hub.role === "admin";
  return <div className="c-hub">
    <section className={`c-hub-identity${hub.photo ? " has-photo" : ""}`} aria-label="Commune identity">
      {hub.photo && <img className="c-hub-cover" src={hub.photo} alt="" />}
      <div className="c-hub-identity-copy"><span className="c-hub-type">{hub.type}</span>
        <h2>{hub.name}</h2>
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
      <section className="c-hub-balance" aria-label="Your balance"><HubHeading title={hub.oweLabel} icon={Wallet} /><strong className="c-hub-amount">{hub.oweAmount}</strong>
        <p>{hub.oweCopy}</p><div className="c-hub-balance-actions"><button className="c-hub-button" type="button" onClick={() => go("add-expense")}><Icon name="plus" size={16} />Add expense</button>
        <button className="c-hub-link" type="button" onClick={() => go("settle")}>View settlement</button></div>
      </section>
      <HubSection title="Needs you" icon={CircleAlert} count={`${attentionCount} ${attentionCount === 1 ? "item" : "items"}`}>
        {outstanding.slice(0, 3).map((move, index) => <div key={`${move.names}-${move.expenseId ?? index}`} className="c-hub-attention-row">
          <span className="c-hub-attention-copy"><span className="c-hub-icon-chip"><ReceiptText size={18} strokeWidth={1.5} /></span><span><strong>{move.why}</strong><small>{move.names}</small></span></span>
          <span className="c-hub-attention-end"><strong>{move.amt}</strong><button type="button" onClick={() => move.expenseId ? go("expense", { expense: move.expenseId }) : go("settle")}>View</button></span>
        </div>)}
        {yours.slice(0, 2).map(item => <button className="c-hub-note-row" type="button" key={item.id} onClick={() => go("operation", { operation: item.id })}><span><strong>{item.title}</strong><small>{item.date < todayIso() ? "Overdue · your turn" : "Your turn today"}</small></span><ChevronRight size={16} /></button>)}
        {yourPledges.slice(0, 2).map((item, index) => <button className="c-hub-note-row" type="button" key={`pledge-${index}`} onClick={() => go("funds")}><span><strong>{item.title}</strong><small>{item.when}</small></span><ChevronRight size={16} /></button>)}
        {!attentionCount && <div className="c-hub-empty"><p>{hub.members.length<2 && canInvite ? "Bring your people in to share costs, jobs and the useful details." : "Nothing needs your attention right now."}</p></div>}
        {outstanding.length > 3 && <button className="c-hub-link c-hub-more" type="button" onClick={() => go("settle")}>View all outstanding shares</button>}
        {yours.length > 2 && <button className="c-hub-link c-hub-more" type="button" onClick={() => go("operations")}>View your other tasks</button>}
        {yourPledges.length > 2 && <button className="c-hub-link c-hub-more" type="button" onClick={() => go("funds")}>View your other pledges</button>}
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
      <div className="c-hub-section-head"><HubHeading title="Recently in your commune" icon={ReceiptText} /><button className="c-hub-link" type="button" onClick={() => go("expenses")}>All expenses</button></div>
        {expenses.slice(0, 3).map(row => <button key={row.id} className="c-hub-expense-row" type="button" onClick={() => go("expense", { expense: row.id })}>
          <span><strong>{row.name}</strong><small>{row.paidBy}</small></span>
          <span className="c-hub-expense-end"><strong>{row.amount}</strong><small className={`c-hub-expense-status is-${row.status}`}>{row.statusLabel}</small></span>
        </button>)}
    </section>}
  </div>;
}

// An empty ledger still has people, notes and responsibilities. Keep them usable.
export function HubEmptyScreen() { return <HubScreen />; }
