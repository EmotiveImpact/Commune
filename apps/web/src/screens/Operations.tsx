import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  dateFromIso,
  firstNameOf,
  formatTimeLabel,
  isoFromDate,
  holdsTurn,
  nextPerson,
  overdueDays,
  todayIso,
  type OperationItem,
} from "../data/operations";
import { useApp } from "../state";
import { Icon } from "../ui/Icon";
import { Avatar } from "../ui/widgets";
import { CalendarDate } from "../ui/CalendarDate";
import { cx } from "../ui/cx";

type Cut = "week" | "people" | "month";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CATEGORY_LABEL: Record<OperationItem["category"], string> = {
  chore: "Task",
  delivery: "Delivery",
  visit: "Visit",
  appointment: "Appointment",
  other: "Event",
};

const monthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
});
const dayFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const shortDateFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

export function OperationsScreen() {
  const {
    go,
    hub,
    operations,
    you,
    toggleOperation,
    skipOperation,
    undoOperation,
  } = useApp();
  const today = todayIso();
  const [cut, setCut] = useState<Cut>("week");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(today);
  const [toast, setToast] = useState<{ text: string; undoId?: string; error?: boolean } | null>(null);
  const [undoing, setUndoing] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);
  const toastRef = useRef<HTMLDivElement>(null);
  const toastHeld = useRef(false);

  const ordered = useMemo(
    () =>
      [...operations].sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          (a.time ?? "").localeCompare(b.time ?? ""),
      ),
    [operations],
  );
  const open = ordered.filter((item) => item.status === "open");
  const late = open
    .filter((item) => item.kind === "task" && item.date < today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const weekEnd = addDays(today, 6);
  const weekItems = open.filter(
    (item) =>
      item.id !== late?.id &&
      ((item.date >= today && item.date <= weekEnd) ||
        item.lastDone?.date === today),
  );
  const yoursToday = open.filter(
    (item) => item.kind === "task" && item.assigneeId === you.id && item.date === today,
  );
  const yoursNext = open.find(
    (item) =>
      item.kind === "task" &&
      item.assigneeId === you.id &&
      item.date > today,
  );
  const calendarDays = useMemo(() => buildMonth(month), [month]);
  const selectedItems = open.filter((item) => item.date === selectedDate);
  const peopleHorizon = open.filter(
    (item) => item.date <= weekEnd || item.lastDone?.date === today,
  );

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  // Messages with an Undo, and errors, stay long enough to read and use. The
  // timer pauses while the pointer or keyboard focus is on the toast.
  function scheduleToastClose(ms: number) {
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => {
      if (toastHeld.current) return;
      const hadFocus = toastRef.current?.contains(document.activeElement);
      setToast(null);
      if (hadFocus) document.querySelector<HTMLElement>(".ops-prod-head button")?.focus();
    }, ms);
  }
  function flash(text: string, undoId?: string) {
    setToast({ text, undoId });
    scheduleToastClose(undoId ? 9000 : 2600);
  }
  function flashError(text: string) {
    setToast({ text, error: true });
    scheduleToastClose(8000);
  }
  function holdToast(held: boolean) {
    toastHeld.current = held;
    if (!held && toast) scheduleToastClose(4000);
  }

  async function undo(occurrenceId: string) {
    if (undoing) return;
    setUndoing(true);
    try {
      const result = await undoOperation(occurrenceId);
      flash(`Undone · back with ${firstNameOf(result.assignee ?? undefined) || "the commune"} for ${shortDateFormatter.format(dateFromIso(result.date))}`);
    } catch (error) {
      flashError(error instanceof Error ? error.message : "Could not undo that");
    } finally {
      setUndoing(false);
    }
  }

  function showDate(date: string) {
    setSelectedDate(date);
    setMonth(date.slice(0, 7));
  }

  function moveMonth(delta: number) {
    const date = dateFromIso(`${month}-01`);
    date.setMonth(date.getMonth() + delta);
    showDate(isoFromDate(date));
  }

  async function completeTask(item: OperationItem) {
    try {
      // The server decides the next date and person; report what it saved.
      const result = await toggleOperation(item.id);
      const handed = item.repeat !== "none" && item.rotation?.length ? firstNameOf(result.assignee ?? undefined) : "";
      flash(
        handed
          ? `Handed to ${handed} · ${shortDateFormatter.format(dateFromIso(result.date))}`
          : item.repeat !== "none"
            ? `Done · next ${shortDateFormatter.format(dateFromIso(result.date))}`
            : `Done · ${item.title}`,
        result.occurrenceId,
      );
    } catch (error) {
      flashError(error instanceof Error ? error.message : "Could not update task");
    }
  }

  async function skipTask(item: OperationItem) {
    try {
      const result = await skipOperation(item.id);
      flash(`Moved to ${shortDateFormatter.format(dateFromIso(result.date))}`, result.occurrenceId);
    } catch (error) {
      flashError(error instanceof Error ? error.message : "Could not move task");
    }
  }

  const peopleBuckets = [
    ...hub.members.map((member) => ({
      key: member.userId,
      label: firstNameOf(member.name),
      you: member.userId === you.id,
      tone: member.cls,
      initials: member.ini,
      items: peopleHorizon.filter(
        (item) =>
          item.kind === "task" &&
          item.assigneeId === member.userId &&
          (item.date <= weekEnd || item.lastDone?.date === today),
      ),
    })),
    {
      key: "house",
      label: "House",
      you: false,
      tone: "house",
      initials: "H",
      // Visits and deliveries, and any task nobody holds (for example
      // after the person who had it left).
      items: peopleHorizon.filter(
        (item) =>
          (item.kind === "event" ||
            !hub.members.some((member) => member.userId === item.assigneeId)) &&
          (item.date <= weekEnd || item.lastDone?.date === today),
      ),
    },
  ];
  const weekGroups = groupByDate(weekItems);

  return (
    <div className="ops ops-prod">
      <div className="ops-prod-head">
        <div className="ops-cuts" role="tablist" aria-label="Operations view">
          {(["week", "people", "month"] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={cut === id}
              className={cx(cut === id && "is-on")}
              onClick={() => setCut(id)}
            >
              {id === "week" ? "Week" : id === "people" ? "People" : "Month"}
            </button>
          ))}
        </div>
        <button
          className="a-btn ops-add"
          type="button"
          onClick={() => go("operation-new", { date: selectedDate })}
        >
          <Icon name="plus" size={15} />
          Add item
        </button>
      </div>

      {cut === "week" ? (
        <div className="ops-stack">
          {late ? (
            <LateCard
              item={late}
              today={today}
              onOpen={() => go("operation", { operation: late.id })}
              onSkip={() => skipTask(late)}
              onDone={() => completeTask(late)}
            />
          ) : null}

          <section className="ops-card ops-yours">
            <p className="ops-kicker">Yours</p>
            {yoursToday.length ? (
              yoursToday.map((item) => (
                <button
                  key={item.id}
                  className="ops-yours-row"
                  type="button"
                  onClick={() => go("operation", { operation: item.id })}
                >
                  <h2>{item.title}</h2>
                  <p>{metaLine(item)}</p>
                </button>
              ))
            ) : (
              <>
                <h2>You’re clear today.</h2>
                <p className="ops-note">
                  {yoursNext
                    ? `Next is ${yoursNext.title} · ${shortDateFormatter.format(dateFromIso(yoursNext.date))} · ${yoursNext.allDay ? "All day" : formatTimeLabel(yoursNext.time)}.`
                    : "Nothing of yours on the board this week."}
                </p>
              </>
            )}
          </section>

          <section className="ops-card">
            <div className="ops-board-head">
              <span>This commune this week</span>
              <small>{weekItems.length ? `${weekItems.length} on the board` : "Clear"}</small>
            </div>
            <div className="ops-week-list">
              {weekGroups.map((group) => (
                <div className="ops-week-day" key={group.date}>
                  <CalendarDate className="ops-week-date" date={group.date} today={today} showMonth={false} />
                  <div className="ops-week-items">
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={cx("ops-week-row", item.kind === "event" && "is-event")}
                        onClick={() => go("operation", { operation: item.id })}
                      >
                        <strong>{item.title}</strong>
                        <span>{metaLine(item)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {!weekItems.length ? (
                <p className="ops-note ops-week-empty">Nothing else in this commune this week.</p>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {cut === "people" ? (
        <div className="ops-people">
          {peopleBuckets.map((bucket) => (
            <section className="ops-person" key={bucket.key}>
              <header>
                <Avatar tone={bucket.tone} initials={bucket.initials} />
                <h3>
                  {bucket.label}
                  {bucket.you ? <small>You</small> : null}
                </h3>
              </header>
              {bucket.items.length ? (
                bucket.items.map((item) => (
                  <button
                    key={item.id}
                    className={cx("ops-person-task", item.date < today && "is-late")}
                    type="button"
                    onClick={() => go("operation", { operation: item.id })}
                  >
                    <strong>{item.title}</strong>
                    <small>
                      {item.date < today
                        ? `Late · ${item.rotation?.length ? `then ${firstNameOf(nextPerson(item))}` : "open"}`
                        : `${shortDateFormatter.format(dateFromIso(item.date))} · ${item.allDay ? "All day" : formatTimeLabel(item.time)}${
                            item.rotation?.length
                              ? ` · then ${firstNameOf(nextPerson(item))}`
                              : ""
                          }`}
                    </small>
                  </button>
                ))
              ) : (
                <p className="ops-note">Clear this week.</p>
              )}
            </section>
          ))}
        </div>
      ) : null}

      {cut === "month" ? (
        <section className="ops-month-shell" aria-label={`${monthFormatter.format(dateFromIso(`${month}-01`))} calendar`}>
          <header className="ops-month-toolbar">
            <div>
              <p className="ops-kicker">Full calendar</p>
              <h2>{monthFormatter.format(dateFromIso(`${month}-01`))}</h2>
            </div>
            <div className="ops-month-actions">
              <button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)}>
                ‹
              </button>
              <button type="button" onClick={() => showDate(today)}>
                Today
              </button>
              <button type="button" aria-label="Next month" onClick={() => moveMonth(1)}>
                ›
              </button>
            </div>
          </header>
          <div className="ops-month-dows" aria-hidden="true">
            {WEEKDAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="ops-month-tiles">
            {calendarDays.map(({ date, inMonth }) => {
              const rows = open.filter((item) => item.date === date);
              return (
                <div
                  key={date}
                  className={cx(
                    "ops-tile",
                    !inMonth && "is-out",
                    date === today && "is-today",
                    date === selectedDate && "is-on",
                  )}
                >
                  <button
                    className="ops-tile-num"
                    type="button"
                    aria-label={dayFormatter.format(dateFromIso(date))}
                    onClick={() => showDate(date)}
                  >
                    {Number(date.slice(-2))}
                  </button>
                  {rows.slice(0, 3).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={cx(
                        "ops-tile-item",
                        item.kind === "task" ? "is-task" : "is-event",
                        item.date < today && "is-warn",
                      )}
                      onClick={() => {
                        showDate(date);
                        go("operation", { operation: item.id });
                      }}
                    >
                      {item.title}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
          <div className="ops-month-selected">
            <div>
              <p className="ops-kicker">Selected day</p>
              <h3>{dayFormatter.format(dateFromIso(selectedDate))}</h3>
              <p>
                {selectedItems.length
                  ? `${selectedItems.length} item${selectedItems.length > 1 ? "s" : ""} on this day.`
                  : "Nothing scheduled."}
              </p>
            </div>
            <div className="ops-month-selected-list">
              {selectedItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => go("operation", { operation: item.id })}
                >
                  <strong>{item.title}</strong>
                  <span>{metaLine(item)}</span>
                </button>
              ))}
              {!selectedItems.length ? (
                <p className="ops-note">Nothing on this day.</p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {/* Always present so screen readers announce each new message. */}
      <div
        ref={toastRef}
        className={toast ? "ops-toast" : "sr-only"}
        // Errors are also raised in the app's alert banner; one alert is enough.
        role="status"
        onMouseEnter={() => holdToast(true)}
        onMouseLeave={() => holdToast(false)}
        onFocus={() => holdToast(true)}
        onBlur={() => holdToast(false)}
      >
        {toast ? <span>{toast.text}</span> : null}
        {toast?.undoId ? (
          <button type="button" className="ops-toast-undo" disabled={undoing} onClick={() => void undo(toast.undoId!)}>
            {undoing ? "Undoing…" : "Undo"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function LateCard({
  item,
  today,
  onOpen,
  onSkip,
  onDone,
}: {
  item: OperationItem;
  today: string;
  onOpen: () => void;
  onSkip: () => void;
  onDone: () => void;
}) {
  const next = item.rotation?.length
    ? firstNameOf(nextPerson(item))
    : "";
  const who = firstNameOf(item.assignee) || "Unassigned";
  return (
    <section className="ops-card ops-late">
      <p className="ops-kicker is-late">
        Late · {overdueDays(item.date, today)} days · {who}
      </p>
      <h2>{item.title}</h2>
      {item.notes ? <p className="ops-note">{item.notes}</p> : null}
      {item.rotation?.length ? (
        <div className="ops-rotation">
          {item.rotation.map((name, index) => (
            <span key={index}>
              {index ? <i /> : null}
              <em className={cx(holdsTurn(item, index) && "is-on")}>
                {firstNameOf(name)}
              </em>
            </span>
          ))}
        </div>
      ) : null}
      <p className="ops-note">
        {who} still has this.{next ? ` Next is ${next}.` : ""}
      </p>
      <div className="ops-late-actions">
        <button className="a-btn ghost" type="button" onClick={onOpen}>
          Open
        </button>
        <button className="a-btn ghost" type="button" onClick={onSkip}>
          Skip a week
        </button>
        <button className="a-btn" type="button" onClick={onDone}>
          {next ? `Done · ${next}` : "Mark done"}
        </button>
      </div>
    </section>
  );
}

function metaLine(item: OperationItem): string {
  const when = item.allDay || !item.time ? "All day" : formatTimeLabel(item.time);
  const who =
    item.kind === "task"
      ? firstNameOf(item.assignee) || "Unassigned"
      : CATEGORY_LABEL[item.category];
  const next =
    item.kind === "task" && item.rotation?.length
      ? ` · then ${firstNameOf(nextPerson(item))}`
      : "";
  return `${when} · ${who}${next}`;
}

function groupByDate(items: OperationItem[]) {
  const groups: Array<{ date: string; items: OperationItem[] }> = [];
  for (const item of items) {
    const last = groups.at(-1);
    if (last?.date === item.date) last.items.push(item);
    else groups.push({ date: item.date, items: [item] });
  }
  return groups;
}

function buildMonth(month: string): Array<{ date: string; inMonth: boolean }> {
  const first = dateFromIso(`${month}-01`);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const iso = isoFromDate(date);
    return { date: iso, inMonth: iso.startsWith(month) };
  });
}
