import { useMemo, useState, type CSSProperties } from "react";
import {
  addDays,
  dateFromIso,
  isoFromDate,
  minutesToTime,
  startOfWeek,
  timeToMinutes,
  todayIso,
  weekDates,
  weekHourRange,
  WEEK_HOUR_PX,
  type OperationItem,
} from "../data/operations";
import { initialsOf } from "../data/household";
import { useApp } from "../state";
import { Icon } from "../ui/Icon";
import { cx } from "../ui/cx";

type View = "week" | "month" | "agenda";
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
const weekRangeFormatter = new Intl.DateTimeFormat("en-GB", {
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
  const [view, setView] = useState<View>(() => (native ? "agenda" : "week"));
  const [filter, setFilter] = useState<Filter>("all");
  const [month, setMonth] = useState(initialDate.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(initialDate);

  const visible = useMemo(
    () => ordered.filter((item) => filter === "all" || item.kind === filter),
    [filter, ordered],
  );
  const calendarDays = useMemo(() => buildMonth(month), [month]);
  const days = useMemo(() => weekDates(selectedDate), [selectedDate]);
  const selectedItems = visible.filter((item) => item.date === selectedDate);
  const overdue = operations.filter(
    (item) =>
      item.kind === "task" && item.status === "open" && item.date < today,
  );
  const weekEnd = addDays(today, 6);
  const thisWeek = operations.filter(
    (item) =>
      item.status === "open" && item.date >= today && item.date <= weekEnd,
  );
  const weekItems = visible.filter(
    (item) => item.date >= days[0] && item.date <= days[6],
  );

  function showDate(date: string) {
    setSelectedDate(date);
    setMonth(date.slice(0, 7));
  }

  function moveMonth(delta: number) {
    const date = dateFromIso(`${month}-01`);
    date.setMonth(date.getMonth() + delta);
    showDate(isoFromDate(date));
  }

  function moveWeek(delta: number) {
    showDate(addDays(startOfWeek(selectedDate), delta * 7));
  }

  return (
    <div className="ops">
      <section className="ops-overview" aria-label="Schedule summary">
        <div className="ops-overview-copy">
          <span className="ops-eyebrow">{hub.name}</span>
          <h2>This week at the house.</h2>
          <p>
            Hours, owners, and the things everyone should know is happening.
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
              setView("week");
              setFilter("all");
              showDate(today);
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
          {([
            ["week", "Week"],
            ["month", "Month"],
            ["agenda", "Agenda"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={cx(view === id && "is-on")}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
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

      {view === "week" ? (
        <div className="ops-calendar-layout is-week">
          <WeekBoard
            days={days}
            items={weekItems}
            today={today}
            selectedDate={selectedDate}
            onSelect={showDate}
            onMove={moveWeek}
            onOpen={(id) => go("operation", { operation: id })}
            onAdd={(date, time) =>
              go("operation-new", time ? { date, time } : { date })
            }
          />
          <DayPanel
            date={selectedDate}
            items={selectedItems}
            onAdd={() => go("operation-new", { date: selectedDate })}
            onOpen={(id) => go("operation", { operation: id })}
            onToggle={toggleOperation}
          />
        </div>
      ) : view === "month" ? (
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
                  onClick={() => showDate(today)}
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

function WeekBoard({
  days,
  items,
  today,
  selectedDate,
  onSelect,
  onMove,
  onOpen,
  onAdd,
}: {
  days: string[];
  items: OperationItem[];
  today: string;
  selectedDate: string;
  onSelect: (date: string) => void;
  onMove: (delta: number) => void;
  onOpen: (id: string) => void;
  onAdd: (date: string, time?: string) => void;
}) {
  const hours = weekHourRange(items);
  const hourCount = (hours.end - hours.start) / 60;
  const timedHeight = hourCount * WEEK_HOUR_PX;
  const hourMarks = Array.from({ length: hourCount }, (_, index) =>
    hours.start + index * 60,
  );

  return (
    <section className="ops-week" aria-label={`Week of ${weekLabel(days[0])}`}>
      <header className="ops-calendar-head">
        <div>
          <span className="ops-eyebrow">This week</span>
          <h3>{weekLabel(days[0])}</h3>
        </div>
        <div className="ops-month-actions">
          <button
            type="button"
            aria-label="Previous week"
            onClick={() => onMove(-1)}
          >
            ‹
          </button>
          <button type="button" onClick={() => onSelect(today)}>
            Today
          </button>
          <button
            type="button"
            aria-label="Next week"
            onClick={() => onMove(1)}
          >
            ›
          </button>
        </div>
      </header>
      <div className="ops-week-scroll">
        <div className="ops-week-inner">
          <div className="ops-week-corner" aria-hidden="true" />
          {days.map((date, index) => (
            <button
              key={date}
              type="button"
              className={cx(
                "ops-week-dayhead",
                date === today && "is-today",
                date === selectedDate && "is-selected",
              )}
              onClick={() => onSelect(date)}
            >
              <span>{WEEKDAYS[index]}</span>
              <strong>{Number(date.slice(-2))}</strong>
            </button>
          ))}
          <div className="ops-week-allday-label">All day</div>
          {days.map((date) => {
            const allDay = items.filter(
              (item) => item.date === date && (item.allDay || !item.time),
            );
            return (
              <div
                key={`all-${date}`}
                className={cx(
                  "ops-week-allday",
                  date === today && "is-today",
                  date === selectedDate && "is-selected",
                )}
              >
                {allDay.map((item) => (
                  <WeekCard
                    key={item.id}
                    item={item}
                    onOpen={onOpen}
                  />
                ))}
              </div>
            );
          })}
          <div className="ops-week-hours" style={{ height: timedHeight }}>
            {hourMarks.map((minutes) => (
              <span
                key={minutes}
                style={{ top: ((minutes - hours.start) / 60) * WEEK_HOUR_PX }}
              >
                {formatHourLabel(minutes)}
              </span>
            ))}
          </div>
          {days.map((date) => {
            const placed = layoutTimed(
              items.filter((item) => item.date === date),
            );
            return (
              <div
                key={`grid-${date}`}
                className={cx(
                  "ops-week-col",
                  date === today && "is-today",
                  date === selectedDate && "is-selected",
                )}
                style={{ height: timedHeight }}
              >
                {hourMarks.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    className="ops-week-slot"
                    style={{
                      top: ((minutes - hours.start) / 60) * WEEK_HOUR_PX,
                      height: WEEK_HOUR_PX,
                    }}
                    aria-label={`Add at ${minutesToTime(minutes)} on ${dayFormatter.format(dateFromIso(date))}`}
                    onClick={() => {
                      onSelect(date);
                      onAdd(date, minutesToTime(minutes));
                    }}
                  />
                ))}
                {placed.map((entry) => {
                  const top =
                    ((entry.start - hours.start) / 60) * WEEK_HOUR_PX + 2;
                  const height = Math.max(WEEK_HOUR_PX - 6, 46);
                  const width = `calc((100% - 8px) / ${entry.colCount})`;
                  const left = `calc(4px + ${entry.col} * ${width})`;
                  return (
                    <WeekCard
                      key={entry.item.id}
                      item={entry.item}
                      onOpen={onOpen}
                      style={{ top, height, left, width }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function WeekCard({
  item,
  onOpen,
  style,
}: {
  item: OperationItem;
  onOpen: (id: string) => void;
  style?: CSSProperties;
}) {
  const who =
    item.kind === "task"
      ? firstName(item.assignee) ?? "Unassigned"
      : CATEGORY_LABEL[item.category];
  return (
    <button
      type="button"
      className={cx(
        "ops-week-card",
        `is-${item.category}`,
        item.status === "done" && "is-done",
        !style && "is-allday",
      )}
      style={style}
      onClick={() => onOpen(item.id)}
    >
      <strong>{item.title}</strong>
      <span>
        {item.allDay || !item.time ? "All day" : item.time}
        {" · "}
        {who}
      </span>
    </button>
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

function layoutTimed(items: OperationItem[]) {
  const timed = items
    .filter((item) => !item.allDay && item.time)
    .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
  const placed = timed.map((item) => {
    const start = timeToMinutes(item.time!);
    return { item, start, end: start + 60, col: 0, colCount: 1 };
  });
  for (let i = 0; i < placed.length; i += 1) {
    const used = new Set<number>();
    for (let j = 0; j < i; j += 1) {
      if (placed[j].start < placed[i].end && placed[i].start < placed[j].end) {
        used.add(placed[j].col);
      }
    }
    let col = 0;
    while (used.has(col)) col += 1;
    placed[i].col = col;
  }
  for (const row of placed) {
    const group = placed.filter(
      (other) => other.start < row.end && row.start < other.end,
    );
    row.colCount = Math.max(1, ...group.map((other) => other.col + 1));
  }
  return placed;
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

function shortDay(date: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(dateFromIso(date));
}

function weekLabel(start: string): string {
  const end = addDays(start, 6);
  return `${weekRangeFormatter.format(dateFromIso(start))} – ${weekRangeFormatter.format(dateFromIso(end))}`;
}

function formatHourLabel(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  if (hour === 0) return "12am";
  if (hour < 12) return `${hour}am`;
  if (hour === 12) return "12pm";
  return `${hour - 12}pm`;
}

function firstName(name?: string) {
  return name?.split(" ")[0];
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
