import { useMemo, useState } from "react";
import {
  dateFromIso,
  isoFromDate,
  todayIso,
  type OperationItem,
} from "../data/operations";
import { initialsOf } from "../data/household";
import { useApp } from "../state";
import { Icon } from "../ui/Icon";
import { cx } from "../ui/cx";

type View = "calendar" | "agenda";
type Filter = "all" | "task" | "event";

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
const shortDayFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

export function OperationsScreen() {
  const { go, hub, native, operations, toggleOperation } = useApp();
  const today = todayIso();
  const ordered = useMemo(
    () =>
      [...operations].sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          (a.time ?? "").localeCompare(b.time ?? ""),
      ),
    [operations],
  );
  const firstUpcoming = ordered.find(
    (item) => item.status === "open" && item.date >= today,
  );
  const initialDate = firstUpcoming?.date ?? ordered.at(-1)?.date ?? today;
  const [view, setView] = useState<View>(() =>
    native ? "agenda" : "calendar",
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [month, setMonth] = useState(initialDate.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(initialDate);

  const visible = useMemo(
    () => ordered.filter((item) => filter === "all" || item.kind === filter),
    [filter, ordered],
  );
  const calendarDays = useMemo(() => buildMonth(month), [month]);
  const selectedItems = visible.filter((item) => item.date === selectedDate);
  const overdue = operations.filter(
    (item) =>
      item.kind === "task" && item.status === "open" && item.date < today,
  );
  const weekEnd = addDays(today, 7);
  const thisWeek = operations.filter(
    (item) =>
      item.status === "open" && item.date >= today && item.date <= weekEnd,
  );

  function moveMonth(delta: number) {
    const date = dateFromIso(`${month}-01`);
    date.setMonth(date.getMonth() + delta);
    const next = isoFromDate(date);
    setMonth(next.slice(0, 7));
    setSelectedDate(next);
  }

  function showDate(date: string) {
    setSelectedDate(date);
    setMonth(date.slice(0, 7));
  }

  return (
    <div className="ops">
      <section className="ops-overview" aria-label="Schedule summary">
        <div className="ops-overview-copy">
          <span className="ops-eyebrow">{hub.name}</span>
          <h2>The shared rhythm, in one place.</h2>
          <p>
            Chores have owners. Deliveries, visits, and appointments stay
            visible to everyone.
          </p>
        </div>
        <button
          className="a-btn ops-add"
          type="button"
          onClick={() => go("operation-new", { date: selectedDate })}
        >
          <Icon name="plus" size={15} />
          Add item
        </button>
        <div className="ops-metrics">
          <button
            type="button"
            className={cx("ops-metric", overdue.length > 0 && "is-warn")}
            onClick={() => {
              setView("agenda");
              setFilter("task");
            }}
          >
            <span>Overdue</span>
            <strong>{overdue.length}</strong>
            <small>
              {overdue.length ? overdue[0].title : "Nothing waiting"}
            </small>
          </button>
          <button
            type="button"
            className="ops-metric"
            onClick={() => {
              setView("agenda");
              setFilter("all");
            }}
          >
            <span>Next 7 days</span>
            <strong>{thisWeek.length}</strong>
            <small>{thisWeek[0]?.title ?? "The week is clear"}</small>
          </button>
          <button
            type="button"
            className="ops-metric is-sage"
            onClick={() => firstUpcoming && showDate(firstUpcoming.date)}
          >
            <span>Up next</span>
            <strong>
              {firstUpcoming ? shortDay(firstUpcoming.date) : "—"}
            </strong>
            <small>{firstUpcoming?.title ?? "Add the first item"}</small>
          </button>
        </div>
      </section>

      <div className="ops-controls">
        <div
          className="a-seg ops-view"
          role="group"
          aria-label="Operations view"
        >
          <button
            type="button"
            className={cx(view === "calendar" && "is-on")}
            onClick={() => setView("calendar")}
          >
            Calendar
          </button>
          <button
            type="button"
            className={cx(view === "agenda" && "is-on")}
            onClick={() => setView("agenda")}
          >
            Agenda
          </button>
        </div>
        <div className="ops-filters" role="group" aria-label="Filter schedule">
          {(["all", "task", "event"] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={cx(filter === value && "is-on")}
              onClick={() => setFilter(value)}
            >
              {value === "all" ? "All" : value === "task" ? "Tasks" : "Events"}
            </button>
          ))}
        </div>
      </div>

      {view === "calendar" ? (
        <div className="ops-calendar-layout">
          <section
            className="ops-calendar"
            aria-label={`${monthFormatter.format(dateFromIso(`${month}-01`))} calendar`}
          >
            <header className="ops-calendar-head">
              <div>
                <span className="ops-eyebrow">Calendar</span>
                <h3>{monthFormatter.format(dateFromIso(`${month}-01`))}</h3>
              </div>
              <div className="ops-month-actions">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() => moveMonth(-1)}
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMonth(today.slice(0, 7));
                    setSelectedDate(today);
                  }}
                >
                  Today
                </button>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => moveMonth(1)}
                >
                  ›
                </button>
              </div>
            </header>
            <div className="ops-weekdays" aria-hidden="true">
              {WEEKDAYS.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="ops-month-grid">
              {calendarDays.map(({ date, inMonth }) => {
                const rows = visible.filter((item) => item.date === date);
                return (
                  <div
                    key={date}
                    className={cx(
                      "ops-day",
                      !inMonth && "is-outside",
                      date === today && "is-today",
                      date === selectedDate && "is-selected",
                    )}
                  >
                    <button
                      className="ops-day-number"
                      type="button"
                      aria-label={`Show ${dayFormatter.format(dateFromIso(date))}`}
                      onClick={() => setSelectedDate(date)}
                    >
                      {Number(date.slice(-2))}
                    </button>
                    <div className="ops-day-items">
                      {rows.slice(0, 3).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={cx(
                            "ops-calendar-item",
                            `is-${item.category}`,
                            item.status === "done" && "is-done",
                          )}
                          onClick={() =>
                            go("operation", { operation: item.id })
                          }
                        >
                          {item.time && !item.allDay ? (
                            <span>{item.time}</span>
                          ) : null}
                          {item.title}
                        </button>
                      ))}
                      {rows.length > 3 ? (
                        <span className="ops-more-count">
                          +{rows.length - 3} more
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <DayPanel
            date={selectedDate}
            items={selectedItems}
            onAdd={() => go("operation-new", { date: selectedDate })}
            onOpen={(id) => go("operation", { operation: id })}
            onToggle={toggleOperation}
          />
        </div>
      ) : (
        <Agenda
          items={visible}
          today={today}
          onAdd={() => go("operation-new", { date: selectedDate })}
          onOpen={(id) => go("operation", { operation: id })}
          onToggle={toggleOperation}
        />
      )}
    </div>
  );
}

function DayPanel({
  date,
  items,
  onAdd,
  onOpen,
  onToggle,
}: {
  date: string;
  items: OperationItem[];
  onAdd: () => void;
  onOpen: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  return (
    <aside className="ops-day-panel">
      <div className="ops-day-panel-head">
        <span className="ops-eyebrow">Selected day</span>
        <h3>{dayFormatter.format(dateFromIso(date))}</h3>
      </div>
      <div className="ops-day-list">
        {items.map((item) => (
          <OperationRow
            key={item.id}
            item={item}
            onOpen={onOpen}
            onToggle={onToggle}
            compact
          />
        ))}
        {!items.length ? (
          <div className="ops-day-empty">
            <span>Nothing scheduled.</span>
            <p>Leave the day open, or add something the hub should know.</p>
          </div>
        ) : null}
      </div>
      <button className="a-btn ghost ops-day-add" type="button" onClick={onAdd}>
        <Icon name="plus" size={14} />
        Add to this day
      </button>
    </aside>
  );
}

function Agenda({
  items,
  today,
  onAdd,
  onOpen,
  onToggle,
}: {
  items: OperationItem[];
  today: string;
  onAdd: () => void;
  onOpen: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const groups = useMemo(() => groupAgenda(items, today), [items, today]);
  return (
    <section className="ops-agenda">
      <header className="ops-agenda-head">
        <div>
          <span className="ops-eyebrow">Agenda</span>
          <h3>What’s happening next</h3>
        </div>
        <button className="a-btn" type="button" onClick={onAdd}>
          <Icon name="plus" size={14} />
          Add item
        </button>
      </header>
      {groups.map((group) => (
        <div className="ops-agenda-group" key={group.key}>
          <div className={cx("ops-date-block", group.overdue && "is-overdue")}>
            <strong>{group.overdue ? "Overdue" : shortDay(group.key)}</strong>
            <span>
              {group.overdue
                ? `${group.items.length} waiting`
                : shortDayFormatter.format(dateFromIso(group.key))}
            </span>
          </div>
          <div className="ops-agenda-rows">
            {group.items.map((item) => (
              <OperationRow
                key={item.id}
                item={item}
                onOpen={onOpen}
                onToggle={onToggle}
              />
            ))}
          </div>
        </div>
      ))}
      {!groups.length ? (
        <div className="ops-agenda-empty">
          <h3>Nothing here yet.</h3>
          <p>Add a task, delivery, visit, or appointment.</p>
          <button className="a-btn" type="button" onClick={onAdd}>
            Add the first item
          </button>
        </div>
      ) : null}
    </section>
  );
}

function OperationRow({
  item,
  compact = false,
  onOpen,
  onToggle,
}: {
  item: OperationItem;
  compact?: boolean;
  onOpen: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const { hub } = useApp();
  const member = item.assignee
    ? hub.members.find((row) => row.name === item.assignee)
    : undefined;
  return (
    <div
      className={cx(
        "ops-row",
        compact && "is-compact",
        item.status === "done" && "is-done",
      )}
    >
      {item.kind === "task" ? (
        <button
          className="ops-check"
          type="button"
          aria-label={
            item.status === "done"
              ? `Mark ${item.title} open`
              : `Mark ${item.title} done`
          }
          aria-pressed={item.status === "done"}
          onClick={() => onToggle(item.id)}
        >
          {item.status === "done" ? "✓" : ""}
        </button>
      ) : (
        <span
          className={cx("ops-event-mark", `is-${item.category}`)}
          aria-hidden="true"
        />
      )}
      <button
        className="ops-row-main"
        type="button"
        onClick={() => onOpen(item.id)}
      >
        <span className="ops-row-topline">
          <strong>{item.title}</strong>
          <span className="ops-row-time">
            {item.allDay ? "All day" : (item.time ?? "Time open")}
          </span>
        </span>
        <span className="ops-row-meta">
          {item.kind === "task"
            ? `${item.assignee ?? "Unassigned"}${item.repeat !== "none" ? ` · ${repeatLabel(item.repeat)}` : ""}`
            : CATEGORY_LABEL[item.category]}
        </span>
      </button>
      {member ? (
        <span
          className={cx("avatar ops-row-avatar", member.cls)}
          aria-label={member.name}
        >
          {member.ini || initialsOf(member.name)}
        </span>
      ) : null}
    </div>
  );
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

function addDays(date: string, days: number): string {
  const next = dateFromIso(date);
  next.setDate(next.getDate() + days);
  return isoFromDate(next);
}

function shortDay(date: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(dateFromIso(date));
}

function repeatLabel(repeat: Exclude<OperationItem["repeat"], "none">): string {
  return repeat === "weekly" ? "Every week" : "Every month";
}

function groupAgenda(items: OperationItem[], today: string) {
  const ordered = [...items].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? "").localeCompare(b.time ?? ""),
  );
  const overdue = ordered.filter(
    (item) =>
      item.status === "open" && item.kind === "task" && item.date < today,
  );
  const rest = ordered.filter((item) => !overdue.includes(item));
  const groups: Array<{
    key: string;
    overdue: boolean;
    items: OperationItem[];
  }> = [];
  if (overdue.length)
    groups.push({ key: "overdue", overdue: true, items: overdue });
  for (const item of rest) {
    const last = groups.at(-1);
    if (last && !last.overdue && last.key === item.date) {
      last.items.push(item);
    } else {
      groups.push({ key: item.date, overdue: false, items: [item] });
    }
  }
  return groups;
}
