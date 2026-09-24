export const TODAY = "2026-09-01";
export const STORE_KEY = "commune.ops-options2";

export const MEMBERS = [
  { id: "maya", name: "Maya Chen", short: "Maya", ini: "MC", cls: "maya", you: true },
  { id: "jordan", name: "Jordan Hale", short: "Jordan", ini: "JH", cls: "jordan" },
  { id: "alex", name: "Alex Rivera", short: "Alex", ini: "AR", cls: "alex" },
];

export const HOUSE = { id: "house", name: "The house", short: "House", ini: "H", cls: "house" };

const seed = () => [
  {
    id: "bins",
    kind: "task",
    category: "chore",
    title: "Put the bins out",
    date: "2026-08-25",
    time: "20:00",
    allDay: false,
    assignee: "jordan",
    rotation: ["maya", "jordan", "alex"],
    repeat: "weekly",
    status: "open",
    notes: "Black bags Tuesday night. Leave them in the alley behind the kitchen.",
    lastDone: { by: "alex", date: "2026-08-18" },
    escalateAfter: 0,
  },
  {
    id: "kitchen",
    kind: "task",
    category: "chore",
    title: "Kitchen reset",
    date: "2026-09-02",
    time: "19:00",
    allDay: false,
    assignee: "alex",
    rotation: ["maya", "alex", "jordan"],
    repeat: "weekly",
    status: "open",
    notes: "Clear the counters, run the dishwasher, take the food caddy out.",
    checklist: [
      { id: "c1", title: "Clear counters", done: true },
      { id: "c2", title: "Wipe surfaces", done: false },
      { id: "c3", title: "Empty sink", done: false },
    ],
    lastDone: { by: "maya", date: "2026-08-26" },
    escalateAfter: 1,
  },
  {
    id: "admin",
    kind: "task",
    category: "admin",
    title: "House admin check",
    date: "2026-09-05",
    time: "11:00",
    allDay: false,
    assignee: "maya",
    rotation: ["maya", "jordan", "alex"],
    repeat: "weekly",
    status: "open",
    notes: "Bills, notices, anything that needs a reply.",
    lastDone: { by: "maya", date: "2026-08-29" },
    escalateAfter: 2,
  },
  {
    id: "package",
    kind: "event",
    category: "delivery",
    title: "Package delivery",
    date: "2026-09-03",
    allDay: true,
    status: "open",
    notes: "Leave with number 12 if nobody is home.",
  },
  {
    id: "landlord",
    kind: "event",
    category: "visit",
    title: "Landlord visit",
    date: "2026-09-04",
    time: "10:30",
    allDay: false,
    status: "open",
    notes: "Priya is checking the damp patch by the kitchen window.",
  },
  {
    id: "plumber",
    kind: "event",
    category: "appointment",
    title: "Plumber appointment",
    date: "2026-09-07",
    time: "09:00",
    allDay: false,
    status: "open",
    notes: "Boiler pressure and the slow tap in the upstairs bathroom.",
  },
];

function loadItems() {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return seed();
    return parsed;
  } catch {
    return seed();
  }
}

function persist(items) {
  sessionStorage.setItem(STORE_KEY, JSON.stringify(items));
}

export function nextOccurrence(date, repeat) {
  if (!repeat || repeat === "none") return date;
  let next = addRepeat(date, repeat);
  while (next <= TODAY) next = addRepeat(next, repeat);
  return next;
}

export function createStore() {
  let items = loadItems();
  let undoStack = null;
  const listeners = new Set();

  function emit() {
    persist(items);
    listeners.forEach((fn) => fn(items));
  }

  function snapshot() {
    undoStack = structuredClone(items);
  }

  return {
    today: TODAY,
    get: () => items,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    complete(id) {
      const item = items.find((row) => row.id === id);
      if (!item || item.kind !== "task") return null;
      snapshot();
      const nextDate =
        item.repeat && item.repeat !== "none" ? nextOccurrence(item.date, item.repeat) : item.date;
      const nextAssignee = item.rotation?.length
        ? nextInRotation(item.rotation, item.assignee)
        : item.assignee;
      const result = {
        id,
        title: item.title,
        from: item.assignee,
        to: nextAssignee,
        date: nextDate,
        repeating: Boolean(item.repeat && item.repeat !== "none"),
      };
      items = items.map((row) =>
        row.id === id
          ? {
              ...row,
              status: row.repeat && row.repeat !== "none" ? "open" : "done",
              date: nextDate,
              assignee: nextAssignee,
              lastDone: { by: row.assignee, date: TODAY },
              checklist: row.checklist?.map((step) => ({ ...step, done: false })),
            }
          : row,
      );
      emit();
      return result;
    },
    skip(id) {
      const item = items.find((row) => row.id === id);
      if (!item) return null;
      snapshot();
      const from = item.date < TODAY ? TODAY : item.date;
      const nextDate = addDays(from, 7);
      items = items.map((row) => (row.id === id ? { ...row, date: nextDate } : row));
      emit();
      return { id, title: item.title, date: nextDate };
    },
    reassign(id, assignee) {
      const item = items.find((row) => row.id === id);
      if (!item || item.kind !== "task") return;
      snapshot();
      items = items.map((row) => (row.id === id ? { ...row, assignee } : row));
      emit();
    },
    toggleCheck(id, checkId) {
      items = items.map((row) =>
        row.id === id
          ? {
              ...row,
              checklist: row.checklist?.map((step) =>
                step.id === checkId ? { ...step, done: !step.done } : step,
              ),
            }
          : row,
      );
      emit();
    },
    add(input) {
      snapshot();
      const id = `op-${Date.now()}`;
      items = [
        {
          id,
          kind: input.kind,
          category: input.kind === "task" ? input.category || "chore" : input.category || "other",
          title: input.title,
          date: input.date,
          time: input.allDay ? undefined : input.time,
          allDay: Boolean(input.allDay),
          assignee: input.kind === "task" ? input.assignee : undefined,
          rotation: input.kind === "task" ? input.rotation : undefined,
          repeat: input.kind === "task" ? input.repeat : "none",
          status: "open",
          notes: input.notes ?? "",
        },
        ...items,
      ];
      emit();
      return id;
    },
    remove(id) {
      snapshot();
      items = items.filter((row) => row.id !== id);
      emit();
    },
    undo() {
      if (!undoStack) return false;
      items = undoStack;
      undoStack = null;
      emit();
      return true;
    },
    reset() {
      sessionStorage.removeItem(STORE_KEY);
      items = seed();
      undoStack = null;
      emit();
    },
    canUndo: () => Boolean(undoStack),
  };
}

export function memberOf(id) {
  if (!id || id === "house") return HOUSE;
  return MEMBERS.find((row) => row.id === id) ?? HOUSE;
}

export function nextInRotation(order, current) {
  const index = order.indexOf(current);
  if (index === -1) return order[0];
  return order[(index + 1) % order.length];
}

export function addDays(date, days) {
  const value = fromIso(date);
  value.setDate(value.getDate() + days);
  return toIso(value);
}

export function addMonths(date, months) {
  const value = fromIso(date);
  const day = value.getDate();
  value.setDate(1);
  value.setMonth(value.getMonth() + months);
  const last = new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate();
  value.setDate(Math.min(day, last));
  return toIso(value);
}

export function addRepeat(date, repeat) {
  if (repeat === "weekly") return addDays(date, 7);
  if (repeat === "monthly") {
    const value = fromIso(date);
    const day = value.getDate();
    value.setDate(1);
    value.setMonth(value.getMonth() + 1);
    const last = new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate();
    value.setDate(Math.min(day, last));
    return toIso(value);
  }
  return date;
}

export function fromIso(value) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toIso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function startOfWeek(date) {
  const value = fromIso(date);
  const offset = (value.getDay() + 6) % 7;
  value.setDate(value.getDate() - offset);
  return toIso(value);
}

export function weekDates(date) {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function monthCells(month) {
  const start = fromIso(startOfWeek(`${month}-01`));
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const iso = toIso(date);
    return { date: iso, inMonth: iso.startsWith(month) };
  });
}

export function overdueDays(item) {
  if (item.status !== "open" || item.date >= TODAY) return 0;
  return Math.round((fromIso(TODAY) - fromIso(item.date)) / 86400000);
}

export function isOverdue(item) {
  return item.kind === "task" && item.status === "open" && item.date < TODAY;
}

export function isEscalated(item) {
  if (!isOverdue(item) || item.escalateAfter == null) return false;
  return overdueDays(item) >= item.escalateAfter;
}

export function formatDay(date, style = "long") {
  return fromIso(date).toLocaleDateString("en-GB", {
    weekday: style === "long" ? "long" : "short",
    day: "numeric",
    month: style === "tiny" ? undefined : "short",
  });
}

export function formatHour(time) {
  if (!time) return "All day";
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 || 12;
  return m ? `${hour}:${String(m).padStart(2, "0")}${suffix}` : `${hour}${suffix}`;
}

export function sortItems(rows) {
  return [...rows].sort(
    (a, b) =>
      Number(isOverdue(b)) - Number(isOverdue(a)) ||
      a.date.localeCompare(b.date) ||
      (a.time ?? "99").localeCompare(b.time ?? "99"),
  );
}

export function weekLabel(date) {
  const days = weekDates(date);
  const a = fromIso(days[0]);
  const b = fromIso(days[6]);
  const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
  return `${fmt.format(a)} – ${fmt.format(b)}`;
}

export const CATEGORY_LABEL = {
  chore: "Task",
  admin: "Admin",
  delivery: "Delivery",
  visit: "Visit",
  appointment: "Appointment",
  other: "Event",
};

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
