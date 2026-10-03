import { useState } from "react";
import {
  dateFromIso,
  firstNameOf,
  nextInRotation,
  nextOccurrence,
  todayIso,
  type NewOperation,
  type OperationOccurrence,
  type OperationCategory,
  type OperationItem,
  type OperationKind,
} from "../data/operations";
import { useApp } from "../state";
import { Pill } from "../ui/widgets";
import { cx } from "../ui/cx";
import { LIMITS } from "../data/limits";

const OPERATION_CATEGORIES: Array<[OperationCategory, string]> = [
  ["delivery", "Delivery"],
  ["visit", "Visit"],
  ["appointment", "Appointment"],
  ["other", "Other"],
];

const operationDateFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

export function OperationView() {
  const {
    selectedOperation: item,
    toggleOperation,
    skipOperation,
    undoOperation,
    removeOperation,
    go,
    closeWindow,
    hub,
    mutationPending,
  } = useApp();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const run = (action: () => Promise<unknown>, success: string) => {
    setError(""); setMessage("");
    void action().then(() => setMessage(success))
      .catch((failure) => setError(failure instanceof Error ? failure.message : "Could not update item"));
  };
  if (!item) {
    return (
      <section className="a-window">
        <p className="a-window-note">That schedule item isn’t here.</p>
        <div className="a-field-row">
          <button className="a-btn" type="button" onClick={closeWindow}>
            Close
          </button>
        </div>
      </section>
    );
  }

  const category =
    item.kind === "task"
      ? "Task"
      : (OPERATION_CATEGORIES.find(([id]) => id === item.category)?.[1] ??
        "Event");
  const when = formatOperationDate(item.date, item.allDay ? undefined : item.time);
  const repeat =
    item.repeat === "weekly"
      ? "Every week"
      : item.repeat === "monthly"
        ? "Every month"
        : "Doesn’t repeat";
  const nextPerson = item.rotation?.length
    ? firstNameOf(nextInRotation(item.rotation, item.assignee))
    : "";
  const nextDate =
    item.repeat !== "none"
      ? nextOccurrence(item.date, item.repeat, todayIso(), item.anchorDay)
      : "";

  return (
    <section className="a-window operation-detail">
      <div className="a-fund-hero operation-detail-hero">
        <div>
          <span className="a-hero-kicker">
            {category} · {item.status === "done" ? "Completed" : "Scheduled"}
          </span>
          <strong>{item.title}</strong>
          <p>{when}</p>
        </div>
        <Pill
          tone={
            item.status === "done"
              ? "settled"
              : item.kind === "task"
                ? "sage"
                : "open"
          }
        >
          {item.status === "done" ? "Done" : category}
        </Pill>
      </div>
      <div className="a-note-facts">
        <div className="a-note-fact">
          <span>When</span>
          <strong>{when}</strong>
        </div>
        <div className="a-note-fact">
          <span>{item.kind === "task" ? "Assigned to" : "Type"}</span>
          <strong>
            {item.kind === "task" ? (item.assignee ?? "Unassigned") : category}
          </strong>
        </div>
        {item.kind === "task" ? (
          <div className="a-note-fact">
            <span>Repeats</span>
            <strong>{repeat}</strong>
          </div>
        ) : null}
        {item.kind === "task" && item.status === "open" && (nextPerson || nextDate) ? (
          <div className="a-note-fact">
            <span>Next</span>
            <strong>
              {nextPerson || "Same person"}
              {nextDate ? ` · ${operationDateFormatter.format(dateFromIso(nextDate))}` : ""}
            </strong>
          </div>
        ) : null}
        <div className="a-note-fact">
          <span>Visible to</span>
          <strong>Everyone in this hub</strong>
        </div>
      </div>
      {item.notes ? (
        <p className="a-window-note operation-notes">{item.notes}</p>
      ) : null}
      {item.rotation?.length ? (
        <div className="ops-rotation" style={{ margin: "0 0 16px" }}>
          {item.rotation.map((name, index) => (
            <span key={name}>
              {index ? <i /> : null}
              <em className={name === item.assignee ? "is-on" : undefined}>
                {firstNameOf(name)}
              </em>
            </span>
          ))}
        </div>
      ) : null}
      {error ? <p className="a-form-error" role="alert">{error}</p> : null}
      {message ? <p className="a-window-note" role="status">{message}</p> : null}
      <OccurrenceHistory
        history={item.history ?? []}
        undoId={item.undoOccurrenceId ?? null}
        nameOf={(userId) => hub.members.find((member) => member.userId === userId)?.name ?? "A former member"}
        disabled={mutationPending}
        onUndo={(occurrenceId) => run(() => undoOperation(occurrenceId), "Undone. The task is back as it was.")}
      />
      {confirmDelete ? (
        <div className="operation-delete">
          <p>Remove this from the calendar? It won’t come back.</p>
          <div className="a-field-row">
            <button
              className="a-btn danger"
              type="button"
              onClick={() => void removeOperation(item.id).catch((failure) =>
                setError(failure instanceof Error ? failure.message : "Could not remove item"))}
            >
              Remove
            </button>
            <button
              className="a-btn ghost"
              type="button"
              onClick={() => setConfirmDelete(false)}
            >
              Keep it
            </button>
          </div>
        </div>
      ) : (
        <div className="a-field-row">
          {item.kind === "task" ? (
            <button
              className="a-btn"
              type="button"
              disabled={mutationPending}
              onClick={() => run(() => toggleOperation(item.id), item.status === "done" ? "Reopened." : "Marked done. You can undo this in History.")}
            >
              {item.status === "done"
                ? "Mark open"
                : nextPerson
                  ? `Done · ${nextPerson}`
                  : "Mark done"}
            </button>
          ) : null}
          {item.kind === "task" && item.status === "open" && item.repeat !== "none" ? (
            <button
              className="a-btn ghost"
              type="button"
              disabled={mutationPending}
              onClick={() => run(() => skipOperation(item.id), "Moved on a week. You can undo this in History.")}
            >
              Skip a week
            </button>
          ) : null}
          <button
            className={cx("a-btn", item.kind === "task" && "ghost")}
            type="button"
            onClick={() => go("operation-edit", { operation: item.id })}
          >
            Edit
          </button>
          <button
            className="a-btn ghost"
            type="button"
            onClick={() => setConfirmDelete(true)}
          >
            Remove
          </button>
        </div>
      )}
    </section>
  );
}

const occurrenceDay = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const OCCURRENCE_VERB: Record<OperationOccurrence["action"], string> = { completed: "Completed", skipped: "Skipped", reopened: "Reopened" };

/** What happened to each occurrence, newest first. Only the latest can be undone. */
function OccurrenceHistory({ history, undoId, nameOf, disabled, onUndo }: {
  history: OperationOccurrence[]; undoId: string | null; nameOf: (userId: string) => string;
  disabled: boolean; onUndo: (occurrenceId: string) => void;
}) {
  if (!history.length) return null;
  return (
    <details className="c-contribution-history operation-history" open={Boolean(undoId)}>
      <summary>History · {history.length} {history.length === 1 ? "entry" : "entries"}</summary>
      {history.map((entry) => (
        <div key={entry.id} className={entry.undoneAt ? "is-undone" : undefined}>
          <span>
            <strong>{OCCURRENCE_VERB[entry.action]}</strong> by {nameOf(entry.actorId)} on {occurrenceDay.format(dateFromIso(entry.actedOn))}
            {entry.action !== "reopened" ? ` · was due ${occurrenceDay.format(dateFromIso(entry.dueOn))}${entry.assignee ? ` with ${firstNameOf(entry.assignee)}` : ""}` : ""}
            {entry.action === "completed" && entry.nextDate !== entry.dueOn
              ? ` · next ${occurrenceDay.format(dateFromIso(entry.nextDate))}${entry.nextAssignee ? ` with ${firstNameOf(entry.nextAssignee)}` : ""}` : ""}
            {entry.action === "skipped" ? ` · moved to ${occurrenceDay.format(dateFromIso(entry.nextDate))}` : ""}
            {entry.undoneAt ? <em> · Undone by {nameOf(entry.undoneBy ?? "")}</em> : null}
          </span>
          {entry.id === undoId ? (
            <button className="a-btn ghost" type="button" disabled={disabled} onClick={() => onUndo(entry.id)}>Undo</button>
          ) : null}
        </div>
      ))}
    </details>
  );
}

export function OperationNew() {
  const { addOperation, closeWindow, go } = useApp();
  return (
    <OperationForm
      submitLabel="Add to calendar"
      onCancel={closeWindow}
      onSave={async (item) => {
        const id = await addOperation(item);
        go("operation", { operation: id });
      }}
    />
  );
}

export function OperationEdit() {
  const { closeWindow, go, selectedOperation, updateOperation } = useApp();
  if (!selectedOperation) {
    return (
      <section className="a-window">
        <p className="a-window-note">That schedule item isn’t here.</p>
        <div className="a-field-row">
          <button className="a-btn" type="button" onClick={closeWindow}>
            Close
          </button>
        </div>
      </section>
    );
  }
  return (
    <OperationForm
      item={selectedOperation}
      submitLabel="Save changes"
      onCancel={() => go("operation", { operation: selectedOperation.id })}
      onSave={async (next) => {
        await updateOperation(selectedOperation.id, next);
        go("operation", { operation: selectedOperation.id });
      }}
    />
  );
}

function OperationForm({
  item,
  submitLabel,
  onCancel,
  onSave,
}: {
  item?: OperationItem;
  submitLabel: string;
  onCancel: () => void;
  onSave: (item: NewOperation) => Promise<void>;
}) {
  const { hub, operationDate, operationTime, you } = useApp();
  const [kind, setKind] = useState<OperationKind>(item?.kind ?? "task");
  const [category, setCategory] = useState<OperationCategory>(
    item && item.kind === "event" ? item.category : "delivery",
  );
  const [title, setTitle] = useState(item?.title ?? "");
  const [date, setDate] = useState(item?.date ?? (operationDate || todayIso()));
  const [allDay, setAllDay] = useState(
    item ? item.allDay : !operationTime,
  );
  const [time, setTime] = useState(
    item?.time ?? (operationTime || "09:00"),
  );
  const [assignee, setAssignee] = useState(item?.assignee ?? you.name);
  const [repeat, setRepeat] = useState<NewOperation["repeat"]>(
    item?.repeat ?? "none",
  );
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function chooseKind(next: OperationKind) {
    setKind(next);
    if (next === "task" && allDay && !operationTime && !item?.time) {
      setAllDay(false);
    }
  }

  async function save() {
    setAttempted(true);
    if (!title.trim() || !date) return;
    setBusy(true);
    setError("");
    try {
      await onSave({
        kind,
        category: kind === "task" ? "chore" : category,
        title: title.trim(),
        date,
        time: allDay ? undefined : time,
        allDay,
        assignee: kind === "task" ? assignee : undefined,
        repeat: kind === "task" ? repeat : "none",
        notes: notes.trim(),
      });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save item");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="a-window operation-new">
      <p className="a-window-kicker">Operations</p>
      <div className="a-field">
        <label>What are you adding?</label>
        <div className="a-seg" role="group" aria-label="Schedule item type">
          <button
            type="button"
            className={cx(kind === "task" && "is-on")}
            onClick={() => chooseKind("task")}
          >
            Task
          </button>
          <button
            type="button"
            className={cx(kind === "event" && "is-on")}
            onClick={() => chooseKind("event")}
          >
            Event
          </button>
        </div>
        <p className="hint">
          {kind === "task"
            ? "Something with an owner and a finish line."
            : "Something the whole hub should know is happening."}
        </p>
      </div>

      <div className="a-field">
        <label htmlFor="operation-title">
          Title <span className="need">Required</span>
        </label>
        <input
          id="operation-title"
          type="text"
          value={title}
          maxLength={LIMITS.operationTitle}
          aria-invalid={attempted && !title.trim()}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={
            kind === "task" ? "e.g. Put the bins out" : "e.g. Plumber appointment"
          }
        />
        <span className="a-field-limit">{title.length}/{LIMITS.operationTitle}</span>
        {attempted && !title.trim() ? (
          <p className="field-error">Add a title.</p>
        ) : null}
      </div>

      {kind === "event" ? (
        <div className="a-field">
          <label>Event type</label>
          <div className="a-note-types" role="group" aria-label="Event type">
            {OPERATION_CATEGORIES.map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={cx(category === id && "is-on")}
                onClick={() => setCategory(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="a-field half">
        <label htmlFor="operation-date">
          Date <span className="need">Required</span>
        </label>
        <input
          id="operation-date"
          type="date"
          value={date}
          aria-invalid={attempted && !date}
          onChange={(event) => setDate(event.target.value)}
        />
      </div>
      <div className="a-field half">
        <label>Time</label>
        <div className="a-seg" role="group" aria-label="Time">
          <button
            type="button"
            className={cx(allDay && "is-on")}
            onClick={() => setAllDay(true)}
          >
            All day
          </button>
          <button
            type="button"
            className={cx(!allDay && "is-on")}
            onClick={() => setAllDay(false)}
          >
            Set time
          </button>
        </div>
      </div>
      {!allDay ? (
        <div className="a-field half">
          <label htmlFor="operation-time">Starts</label>
          <input
            id="operation-time"
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
          />
        </div>
      ) : null}

      {kind === "task" ? (
        <>
          <div className="a-field half">
            <label htmlFor="operation-assignee">Assigned to</label>
            <select
              id="operation-assignee"
              value={assignee}
              onChange={(event) => setAssignee(event.target.value)}
            >
              {hub.members.map((member) => (
                <option key={member.name} value={member.name}>
                  {member.name === you.name
                    ? `${member.name} · You`
                    : member.name}
                </option>
              ))}
            </select>
          </div>
          <div className="a-field half">
            <label htmlFor="operation-repeat">Repeats</label>
            <select
              id="operation-repeat"
              value={repeat}
              onChange={(event) =>
                setRepeat(event.target.value as NewOperation["repeat"])
              }
            >
              <option value="none">Doesn’t repeat</option>
              <option value="weekly">Every week</option>
              <option value="monthly">Every month</option>
            </select>
          </div>
        </>
      ) : null}

      <div className="a-field">
        <label htmlFor="operation-notes">Details</label>
        <textarea
          id="operation-notes"
          rows={4}
          value={notes}
          maxLength={LIMITS.operationNotes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Access notes, what to bring, or anything the hub should know."
        />
        <p className="hint">Everyone in {hub.name} can see this.</p>
        <span className="a-field-limit">{notes.length}/{LIMITS.operationNotes}</span>
      </div>

      {error ? <p className="a-form-error" role="alert">{error}</p> : null}
      <div className="a-field-row">
        <button className="a-btn" type="button" onClick={() => void save()} disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </button>
        <button className="a-btn ghost" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}

function formatOperationDate(date: string, time?: string): string {
  const formatted = operationDateFormatter.format(dateFromIso(date));
  return time ? `${formatted} · ${time}` : `${formatted} · All day`;
}
