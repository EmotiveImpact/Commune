import { useState } from "react";
import {
  dateFromIso,
  todayIso,
  type NewOperation,
  type OperationCategory,
  type OperationKind,
} from "../data/operations";
import { useApp } from "../state";
import { Pill } from "../ui/widgets";
import { cx } from "../ui/cx";

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
  const { selectedOperation: item, toggleOperation, go, closeWindow } = useApp();
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
      : OPERATION_CATEGORIES.find(([id]) => id === item.category)?.[1] ?? "Event";
  const when = formatOperationDate(item.date, item.allDay ? undefined : item.time);
  const repeat =
    item.repeat === "weekly"
      ? "Every week"
      : item.repeat === "monthly"
        ? "Every month"
        : "Doesn’t repeat";

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
        <Pill tone={item.status === "done" ? "settled" : item.kind === "task" ? "sage" : "open"}>
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
          <strong>{item.kind === "task" ? item.assignee ?? "Unassigned" : category}</strong>
        </div>
        {item.kind === "task" ? (
          <div className="a-note-fact">
            <span>Repeats</span>
            <strong>{repeat}</strong>
          </div>
        ) : null}
        <div className="a-note-fact">
          <span>Visible to</span>
          <strong>Everyone in this hub</strong>
        </div>
      </div>
      {item.notes ? <p className="a-window-note operation-notes">{item.notes}</p> : null}
      <div className="a-field-row">
        {item.kind === "task" ? (
          <button className="a-btn" type="button" onClick={() => toggleOperation(item.id)}>
            {item.status === "done" ? "Mark open" : "Mark done"}
          </button>
        ) : null}
        <button
          className={cx("a-btn", item.kind === "task" && "ghost")}
          type="button"
          onClick={() => go("operation-new", { date: item.date })}
        >
          Add another
        </button>
        <button className="a-btn ghost" type="button" onClick={closeWindow}>
          Close
        </button>
      </div>
    </section>
  );
}

export function OperationNew() {
  const { addOperation, closeWindow, go, hub, operationDate, you } = useApp();
  const [kind, setKind] = useState<OperationKind>("task");
  const [category, setCategory] = useState<OperationCategory>("delivery");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(operationDate || todayIso());
  const [allDay, setAllDay] = useState(true);
  const [time, setTime] = useState("09:00");
  const [assignee, setAssignee] = useState(you.name);
  const [repeat, setRepeat] = useState<NewOperation["repeat"]>("none");
  const [notes, setNotes] = useState("");
  const [attempted, setAttempted] = useState(false);

  function chooseKind(next: OperationKind) {
    setKind(next);
    if (next === "task") setAllDay(false);
  }

  function save() {
    setAttempted(true);
    if (!title.trim() || !date) return;
    const id = addOperation({
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
    go("operation", { operation: id });
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
          aria-invalid={attempted && !title.trim()}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={kind === "task" ? "e.g. Put the bins out" : "e.g. Plumber appointment"}
        />
        {attempted && !title.trim() ? <p className="field-error">Add a title.</p> : null}
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
                  {member.name === you.name ? `${member.name} · You` : member.name}
                </option>
              ))}
            </select>
          </div>
          <div className="a-field half">
            <label htmlFor="operation-repeat">Repeats</label>
            <select
              id="operation-repeat"
              value={repeat}
              onChange={(event) => setRepeat(event.target.value as NewOperation["repeat"])}
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
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Access notes, what to bring, or anything the hub should know."
        />
        <p className="hint">Everyone in {hub.name} can see this.</p>
      </div>

      <div className="a-field-row">
        <button className="a-btn" type="button" onClick={save}>
          Add to calendar
        </button>
        <button className="a-btn ghost" type="button" onClick={closeWindow}>
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
