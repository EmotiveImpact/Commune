import { useRef, useState } from "react";
import {
  dateFromIso,
  firstNameOf,
  holdsEdit,
  holdsTurn,
  needsDoneBy,
  nextPerson,
  nextOccurrence,
  todayIso,
  type NewOperation,
  type OperationOccurrence,
  type OperationCategory,
  type OperationItem,
  type OperationKind,
} from "../data/operations";
import { formatDay } from "@commune/core";
import { useApp } from "../state";
import { Avatar, Pill } from "../ui/widgets";
import { cx } from "../ui/cx";
import { LIMITS } from "../data/limits";
import { commandFailure, UNCERTAIN_RETRY_SAFE } from "../data/commands";
import { newRequestId } from "../data/requestId";
import { useFormError } from "../ui/components";
import { DoneByChoice } from "../ui/DoneByChoice";

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
    handOverOperation,
    undoOperation,
    removeOperation,
    go,
    closeWindow,
    hub,
    mutationPending,
    you,
    personName,
  } = useApp();
  const [confirmDelete, setConfirmDelete] = useState(false);
  // One small panel at a time: skip with a reason, hand over the turn, or
  // say who did someone else's task.
  const [panel, setPanel] = useState<"" | "skip" | "handover" | "doneby">("");
  const [reason, setReason] = useState("");
  const [handTo, setHandTo] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const run = (action: () => Promise<unknown>, success: string) => {
    setError(""); setMessage("");
    void action().then(() => { setMessage(success); setPanel(""); setReason(""); setHandTo(""); })
      .catch((failure) => setError(failure instanceof Error ? failure.message : "Could not update item"));
  };
  const openPanel = (next: "skip" | "handover" | "doneby") => {
    setError(""); setMessage(""); setReason(""); setHandTo(""); setPanel(next);
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
  const nextName = item.rotation?.length
    ? firstNameOf(nextPerson(item))
    : "";
  const nextDate =
    item.repeat !== "none"
      ? nextOccurrence(item.date, item.repeat, todayIso(), item.anchorDay)
      : "";
  // Anyone active in the hub except the person who has it now.
  const handTargets = hub.members.filter((member) => member.userId !== item.assigneeId);
  const turnTaking = Boolean(item.rotation?.length) && item.repeat !== "none";
  const handoverLead = turnTaking
    ? `Someone else does this turn. Afterwards it carries on from ${firstNameOf(item.turnOwner ?? item.assignee) || "the rotation"}.`
    : "Someone else takes this task on.";
  // The database lets the person who added it, or an admin, remove it.
  const canRemove = hub.role === "admin" || (Boolean(item.createdBy) && item.createdBy === you.id);

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
            {item.kind === "task" && item.turnOwner ? ` · covering for ${firstNameOf(item.turnOwner)}` : ""}
          </strong>
        </div>
        {item.kind === "task" ? (
          <div className="a-note-fact">
            <span>Repeats</span>
            <strong>{repeat}</strong>
          </div>
        ) : null}
        {item.kind === "task" && item.status === "open" && (nextName || nextDate) ? (
          <div className="a-note-fact">
            <span>Next</span>
            <strong>
              {nextName || "Same person"}
              {nextDate ? ` · ${operationDateFormatter.format(dateFromIso(nextDate))}` : ""}
            </strong>
          </div>
        ) : null}
        {item.kind === "task" && item.lastDone ? (
          <div className="a-note-fact">
            <span>Last done</span>
            <strong>{lastDoneLine(item.lastDone)}</strong>
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
            <span key={index}>
              {index ? <i /> : null}
              <em className={holdsTurn(item, index) ? "is-on" : undefined}>
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
        nameOf={(userId) => personName(userId, "A former member")}
        disabled={mutationPending}
        onUndo={(occurrenceId) => run(() => undoOperation(occurrenceId), "Undone. The task is back as it was.")}
      />
      {panel === "doneby" ? (
        <DoneByChoice
          className="operation-panel"
          holder={item.assignee ?? ""}
          title={item.title}
          disabled={mutationPending}
          onChoose={(doneBy) => {
            const holder = firstNameOf(item.assignee) || "them";
            run(() => toggleOperation(item.id, doneBy),
              `${doneBy === "assignee" ? `Marked done for ${holder}` : `Marked done, covering ${holder}`}. You can undo this in History.`);
          }}
          onCancel={() => setPanel("")}
        />
      ) : null}
      {panel === "skip" ? (
        <div className="operation-delete operation-panel">
          <p>Move this on a week? {firstNameOf(item.assignee) || "Whoever has it"} keeps it.</p>
          <div className="a-field">
            <label htmlFor="operation-skip-reason">Reason (optional)</label>
            <input
              id="operation-skip-reason"
              value={reason}
              maxLength={OCCURRENCE_REASON_MAX}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Bins not collected this week"
            />
          </div>
          <div className="a-field-row">
            <button
              className="a-btn"
              type="button"
              disabled={mutationPending}
              onClick={() => run(() => skipOperation(item.id, reason), "Moved on a week. You can undo this in History.")}
            >
              Skip a week
            </button>
            <button className="a-btn ghost" type="button" onClick={() => setPanel("")}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {panel === "handover" ? (
        <div className="operation-delete operation-panel">
          <p>
            {handoverLead}
          </p>
          <div className="a-field">
            <label htmlFor="operation-hand-to">Hand to</label>
            <select id="operation-hand-to" value={handTo} onChange={(event) => setHandTo(event.target.value)}>
              <option value="">Choose someone</option>
              {handTargets.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.userId === you.id ? `${member.name} · You` : member.name}
                  {member.userId === item.turnOwnerId ? " · their turn" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="a-field">
            <label htmlFor="operation-handover-reason">Reason (optional)</label>
            <input
              id="operation-handover-reason"
              value={reason}
              maxLength={OCCURRENCE_REASON_MAX}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Away this weekend"
            />
          </div>
          <div className="a-field-row">
            <button
              className="a-btn"
              type="button"
              disabled={mutationPending || !handTo}
              onClick={() => {
                const name = firstNameOf(hub.members.find((member) => member.userId === handTo)?.name) || "them";
                run(() => handOverOperation(item.id, handTo, reason), `Handed to ${name}. You can undo this in History.`);
              }}
            >
              Hand over
            </button>
            <button className="a-btn ghost" type="button" onClick={() => setPanel("")}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {confirmDelete ? (
        <div className="operation-delete">
          <p>Remove this from the calendar? It won’t come back.</p>
          <div className="a-field-row">
            <button
              className="a-btn danger"
              type="button"
              disabled={mutationPending}
              onClick={() => void removeOperation(item.id).catch((failure) => {
                const result = commandFailure(failure, "Could not remove item");
                // Removing twice is harmless, so trying again is safe.
                setError(result.rejected ? result.message : "We could not confirm whether this was removed. Check your connection and try again.");
              })}
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
        <div className="a-field-row operation-actions">
          {item.kind === "task" ? (
            <button
              className="a-btn"
              type="button"
              disabled={mutationPending}
              aria-expanded={needsDoneBy(item, you.id) ? panel === "doneby" : undefined}
              onClick={() => needsDoneBy(item, you.id)
                ? openPanel("doneby")
                : run(() => toggleOperation(item.id), item.status === "done" ? "Reopened." : "Marked done. You can undo this in History.")}
            >
              {item.status === "done" ? "Mark open" : "Done"}
            </button>
          ) : null}
          {item.kind === "task" && item.status === "open" && item.repeat !== "none" ? (
            <button
              className="a-btn ghost"
              type="button"
              disabled={mutationPending}
              aria-label="Skip a week"
              aria-expanded={panel === "skip"}
              onClick={() => openPanel("skip")}
            >
              <span className="operation-label-long">Skip a week</span>
              <span className="operation-label-short">Skip</span>
            </button>
          ) : null}
          {item.kind === "task" && item.status === "open" && handTargets.length ? (
            <button
              className="a-btn ghost"
              type="button"
              disabled={mutationPending}
              aria-expanded={panel === "handover"}
              onClick={() => openPanel("handover")}
            >
              Hand over
            </button>
          ) : null}
          <button
            className={cx("a-btn", item.kind === "task" && "ghost")}
            type="button"
            onClick={() => go("operation-edit", { operation: item.id })}
          >
            Edit
          </button>
          {canRemove ? (
            <button
              className="operation-remove"
              type="button"
              onClick={() => setConfirmDelete(true)}
            >
              Remove
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}

const OCCURRENCE_VERB: Record<OperationOccurrence["action"], string> = {
  completed: "Completed", skipped: "Skipped", reopened: "Reopened", handed_over: "Handed over",
};
/** The database keeps a reason to 200 characters. */
const OCCURRENCE_REASON_MAX = 200;

/**
 * Who did it, and who marked it when that was someone else: "Ama, marked by
 * Ben", or "Ben, covering Ama". Entries before 0041 name who pressed it.
 */
function doneByLine(entry: OperationOccurrence, nameOf: (userId: string) => string): string {
  const actor = nameOf(entry.actorId);
  if (entry.action !== "completed" || !entry.doneById) return actor;
  if (entry.doneById !== entry.actorId) return `${nameOf(entry.doneById)}, marked by ${actor}`;
  return entry.assigneeId && entry.assigneeId !== entry.actorId && entry.assignee
    ? `${actor}, covering ${firstNameOf(entry.assignee)}` : actor;
}

/** "Ama Owusu · 4 Oct · marked by Ben", "Ben · 4 Oct · covering Ama". */
function lastDoneLine(lastDone: NonNullable<OperationItem["lastDone"]>): string {
  return [lastDone.by, formatDay(lastDone.date),
    lastDone.markedBy ? `marked by ${firstNameOf(lastDone.markedBy)}` : "",
    lastDone.covering ? `covering ${firstNameOf(lastDone.covering)}` : ""].filter(Boolean).join(" · ");
}

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
            <strong>{OCCURRENCE_VERB[entry.action]}</strong> by {doneByLine(entry, nameOf)} on {formatDay(entry.actedOn)}
            {entry.action === "completed" || entry.action === "skipped" ? ` · was due ${formatDay(entry.dueOn)}${entry.assignee ? ` with ${firstNameOf(entry.assignee)}` : ""}` : ""}
            {entry.action === "completed" && entry.nextDate !== entry.dueOn
              ? ` · next ${formatDay(entry.nextDate)}${entry.nextAssignee ? ` with ${firstNameOf(entry.nextAssignee)}` : ""}` : ""}
            {entry.action === "skipped" ? ` · moved to ${formatDay(entry.nextDate)}` : ""}
            {entry.action === "handed_over" && entry.nextAssignee ? ` · to ${firstNameOf(entry.nextAssignee)}` : ""}
            {entry.reason ? ` · “${entry.reason}”` : ""}
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
  // One id for this form: an add retried after an unconfirmed save returns
  // what it already added rather than a second copy.
  const requestId = useRef(newRequestId());
  return (
    <OperationForm
      submitLabel="Add to calendar"
      onCancel={closeWindow}
      onSave={async (item) => {
        const id = await addOperation(item, requestId.current);
        go("operation", { operation: id });
      }}
    />
  );
}

export function OperationEdit() {
  const { closeWindow, go, selectedOperation, updateOperation } = useApp();
  // The version this edit builds on. A completion, skip or handover since
  // makes it stale, so it cannot put back an older date or person.
  const [baseVersion, setBaseVersion] = useState(selectedOperation?.version);
  // What this form last sent. A save whose reply was lost still arrives with
  // a later refresh as the next version, and that is this person's own change.
  const [submitted, setSubmitted] = useState<NewOperation | null>(null);
  // Loading the latest starts the form again from what is saved now.
  const [reloads, setReloads] = useState(0);
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
  const changed = baseVersion !== undefined && selectedOperation.version !== baseVersion;
  const ownSave = changed && submitted !== null && holdsEdit(selectedOperation, submitted);
  return (
    <OperationForm
      key={reloads}
      item={selectedOperation}
      submitLabel="Save changes"
      stale={changed && !ownSave}
      saved={ownSave}
      onReload={() => {
        setBaseVersion(selectedOperation.version);
        setSubmitted(null);
        setReloads((count) => count + 1);
      }}
      onCancel={() => go("operation", { operation: selectedOperation.id })}
      onSave={async (next) => {
        // After this person's own save went through, the next one builds on it.
        const expected = ownSave ? selectedOperation.version : baseVersion;
        setBaseVersion(expected);
        setSubmitted(next);
        await updateOperation(selectedOperation.id, next, expected);
        go("operation", { operation: selectedOperation.id });
      }}
    />
  );
}

function OperationForm({
  item,
  submitLabel,
  stale = false,
  saved = false,
  onReload,
  onCancel,
  onSave,
}: {
  item?: OperationItem;
  submitLabel: string;
  /** Changed since this form opened, by someone else. */
  stale?: boolean;
  /** The latest saved version is this form's own last save. */
  saved?: boolean;
  onReload?: () => void;
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
  // People are chosen by member id, so two members with one name stay apart.
  const [assigneeId, setAssigneeId] = useState(
    item ? item.assigneeId ?? "" : you.id,
  );
  const [rotationIds, setRotationIds] = useState<string[]>(() => {
    if (item?.rotationIds?.length) return item.rotationIds;
    // A task saved before ids existed: keep names that match one member.
    return (item?.rotation ?? []).flatMap((name) => {
      const matches = hub.members.filter((member) => member.name === name);
      return matches.length === 1 ? [matches[0].userId] : [];
    });
  });
  // While someone covers a turn, the person whose turn it is stays fixed in
  // the rotation and the cover does not join it. Choosing someone else ends
  // the cover.
  const coveredFor = item?.turnOwnerId && assigneeId === item.assigneeId ? item.turnOwnerId : "";
  const turnHolder = coveredFor || assigneeId;
  // The person whose turn it is always takes a turn; list order is turn order.
  const turns = hub.members
    .map((member) => member.userId)
    .filter((id) => id === turnHolder || rotationIds.includes(id));
  const [repeat, setRepeat] = useState<NewOperation["repeat"]>(
    item?.repeat ?? "none",
  );
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const { setError, message } = useFormError();
  const titleMissing = attempted && !title.trim();
  const dateMissing = attempted && !date;

  function chooseKind(next: OperationKind) {
    setKind(next);
    if (next === "task" && allDay && !operationTime && !item?.time) {
      setAllDay(false);
    }
  }

  async function save() {
    setAttempted(true);
    if (!title.trim() || !date) {
      // The first field to fix takes focus.
      document.getElementById(!title.trim() ? "operation-title" : "operation-date")?.focus();
      return;
    }
    if (stale) return;
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
        assigneeId: kind === "task" ? assigneeId || null : null,
        rotationIds:
          kind === "task" && repeat !== "none" && assigneeId && turns.length > 1
            ? turns
            : null,
        repeat: kind === "task" ? repeat : "none",
        notes: notes.trim(),
      });
    } catch (failure) {
      const result = commandFailure(failure, "Could not save item");
      setError(!result.rejected ? UNCERTAIN_RETRY_SAFE
        : /already used for a different/i.test(result.message)
          ? "An earlier attempt may already have been saved. Close this and check the calendar before trying again."
          : result.message);
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
          aria-invalid={titleMissing}
          aria-describedby={titleMissing ? "operation-title-error" : undefined}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={
            kind === "task" ? "e.g. Put the bins out" : "e.g. Plumber appointment"
          }
        />
        <span className="a-field-limit">{title.length}/{LIMITS.operationTitle}</span>
        {titleMissing ? (
          <p className="field-error" id="operation-title-error">Add a title.</p>
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
          aria-invalid={dateMissing}
          aria-describedby={dateMissing ? "operation-date-error" : undefined}
          onChange={(event) => setDate(event.target.value)}
        />
        {dateMissing ? <p className="field-error" id="operation-date-error">Choose a date.</p> : null}
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
              value={assigneeId}
              onChange={(event) => setAssigneeId(event.target.value)}
            >
              <option value="">Unassigned</option>
              {hub.members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.userId === you.id
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
          {repeat !== "none" && assigneeId && hub.members.length > 1 ? (
            <fieldset className="a-field operation-turns">
              <legend>Takes turns</legend>
              {hub.members.map((member) => {
                const holder = member.userId === turnHolder;
                const position = turns.indexOf(member.userId);
                return (
                  <label className="a-settle-row operation-turn" key={member.userId}>
                    <input
                      type="checkbox"
                      checked={position >= 0}
                      disabled={holder}
                      onChange={(event) =>
                        setRotationIds(
                          event.target.checked
                            ? [...rotationIds, member.userId]
                            : rotationIds.filter((id) => id !== member.userId),
                        )
                      }
                    />
                    <Avatar tone={member.cls} initials={member.ini} />
                    <span className="operation-turn-name">
                      {member.userId === you.id ? `${member.name} · You` : member.name}
                    </span>
                    <span className="operation-turn-note">
                      {holder ? (coveredFor ? "Their turn now, covered" : "Has it now") : position >= 0 ? `Turn ${position + 1}` : ""}
                    </span>
                  </label>
                );
              })}
              <p className="hint">
                {turns.length > 1
                  ? "When it is done, it passes to the next person in this order."
                  : "Tick others to take turns. Otherwise it stays with one person."}
              </p>
            </fieldset>
          ) : null}
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

      {stale && !busy ? (
        <div className="operation-delete operation-panel" role="alert">
          <p>
            This {item?.kind === "event" ? "event" : "task"} changed while you were editing, and nothing here has been saved.
            Load the latest details, then make your change again.
          </p>
          <div className="a-field-row">
            <button className="a-btn" type="button" onClick={onReload}>
              Load the latest details
            </button>
          </div>
        </div>
      ) : saved && !busy ? (
        // It settles the doubt an unconfirmed save left behind.
        <p className="a-window-note" role="status">Your last save went through.</p>
      ) : message()}
      <div className="a-field-row">
        <button className="a-btn" type="button" onClick={() => void save()} disabled={busy || stale}>
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
