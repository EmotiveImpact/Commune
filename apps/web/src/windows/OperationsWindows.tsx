import { useState } from "react";
import {
  dateFromIso,
  firstNameOf,
  holdsTurn,
  nextPerson,
  nextOccurrence,
  todayIso,
  type NewOperation,
  type OperationOccurrence,
  type OperationCategory,
  type OperationItem,
  type OperationKind,
} from "../data/operations";
import { useApp } from "../state";
import { Avatar, Pill } from "../ui/widgets";
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
    handOverOperation,
    undoOperation,
    removeOperation,
    go,
    closeWindow,
    hub,
    mutationPending,
    you,
  } = useApp();
  const [confirmDelete, setConfirmDelete] = useState(false);
  // One small panel at a time: skip with a reason, or hand over the turn.
  const [panel, setPanel] = useState<"" | "skip" | "handover">("");
  const [reason, setReason] = useState("");
  const [handTo, setHandTo] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const run = (action: () => Promise<unknown>, success: string) => {
    setError(""); setMessage("");
    void action().then(() => { setMessage(success); setPanel(""); setReason(""); setHandTo(""); })
      .catch((failure) => setError(failure instanceof Error ? failure.message : "Could not update item"));
  };
  const openPanel = (next: "skip" | "handover") => {
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
        nameOf={(userId) => hub.members.find((member) => member.userId === userId)?.name ?? "A former member"}
        disabled={mutationPending}
        onUndo={(occurrenceId) => run(() => undoOperation(occurrenceId), "Undone. The task is back as it was.")}
      />
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
        <div className="a-field-row operation-actions">
          {item.kind === "task" ? (
            <button
              className="a-btn"
              type="button"
              disabled={mutationPending}
              onClick={() => run(() => toggleOperation(item.id), item.status === "done" ? "Reopened." : "Marked done. You can undo this in History.")}
            >
              {item.status === "done"
                ? "Mark open"
                : nextName
                  ? `Done · ${nextName}`
                  : "Mark done"}
            </button>
          ) : null}
          {item.kind === "task" && item.status === "open" && item.repeat !== "none" ? (
            <button
              className="a-btn ghost"
              type="button"
              disabled={mutationPending}
              aria-expanded={panel === "skip"}
              onClick={() => openPanel("skip")}
            >
              Skip a week
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
          <button
            className="operation-remove"
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
const OCCURRENCE_VERB: Record<OperationOccurrence["action"], string> = {
  completed: "Completed", skipped: "Skipped", reopened: "Reopened", handed_over: "Handed over",
};
/** The database keeps a reason to 200 characters. */
const OCCURRENCE_REASON_MAX = 200;

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
            {entry.action === "completed" || entry.action === "skipped" ? ` · was due ${occurrenceDay.format(dateFromIso(entry.dueOn))}${entry.assignee ? ` with ${firstNameOf(entry.assignee)}` : ""}` : ""}
            {entry.action === "completed" && entry.nextDate !== entry.dueOn
              ? ` · next ${occurrenceDay.format(dateFromIso(entry.nextDate))}${entry.nextAssignee ? ` with ${firstNameOf(entry.nextAssignee)}` : ""}` : ""}
            {entry.action === "skipped" ? ` · moved to ${occurrenceDay.format(dateFromIso(entry.nextDate))}` : ""}
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
        assigneeId: kind === "task" ? assigneeId || null : null,
        rotationIds:
          kind === "task" && repeat !== "none" && assigneeId && turns.length > 1
            ? turns
            : null,
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
