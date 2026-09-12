import type { HubId } from "./household";

export type OperationKind = "task" | "event";
export type OperationCategory =
  | "chore"
  | "delivery"
  | "visit"
  | "appointment"
  | "other";
export type OperationRepeat = "none" | "weekly" | "monthly";
export type OperationStatus = "open" | "done";

export type OperationItem = {
  id: string;
  hubId: HubId;
  kind: OperationKind;
  category: OperationCategory;
  title: string;
  date: string;
  time?: string;
  allDay: boolean;
  assignee?: string;
  rotation?: string[];
  lastDone?: { by: string; date: string };
  repeat: OperationRepeat;
  status: OperationStatus;
  notes: string;
};

/** Maya’s household clock. The Park Street week is built around this Tuesday. */
export const HOUSE_TODAY = "2026-09-01";

export type NewOperation = Omit<OperationItem, "id" | "hubId" | "status">;
export type OperationStore = Record<HubId, OperationItem[]>;

export const OPERATIONS_SEED: OperationStore = {
  park: [
    {
      id: "park-bins",
      hubId: "park",
      kind: "task",
      category: "chore",
      title: "Put the bins out",
      date: "2026-08-25",
      time: "20:00",
      allDay: false,
      assignee: "Jordan Hale",
      rotation: ["Maya Chen", "Jordan Hale", "Alex Rivera"],
      lastDone: { by: "Alex Rivera", date: "2026-08-18" },
      repeat: "weekly",
      status: "open",
      notes:
        "Black bags Tuesday night. Leave them in the alley behind the kitchen.",
    },
    {
      id: "park-kitchen",
      hubId: "park",
      kind: "task",
      category: "chore",
      title: "Kitchen reset",
      date: "2026-09-02",
      time: "19:00",
      allDay: false,
      assignee: "Alex Rivera",
      rotation: ["Maya Chen", "Alex Rivera", "Jordan Hale"],
      lastDone: { by: "Maya Chen", date: "2026-08-26" },
      repeat: "weekly",
      status: "open",
      notes:
        "Clear the counters, run the dishwasher, and take the food caddy out.",
    },
    {
      id: "park-admin",
      hubId: "park",
      kind: "task",
      category: "chore",
      title: "House admin check",
      date: "2026-09-05",
      time: "11:00",
      allDay: false,
      assignee: "Maya Chen",
      rotation: ["Maya Chen", "Jordan Hale", "Alex Rivera"],
      lastDone: { by: "Maya Chen", date: "2026-08-29" },
      repeat: "weekly",
      status: "open",
      notes: "Bills, notices, anything that needs a reply.",
    },
    {
      id: "park-package",
      hubId: "park",
      kind: "event",
      category: "delivery",
      title: "Package delivery",
      date: "2026-09-03",
      allDay: true,
      repeat: "none",
      status: "open",
      notes: "Leave with number 12 if nobody is home.",
    },
    {
      id: "park-landlord",
      hubId: "park",
      kind: "event",
      category: "visit",
      title: "Landlord visit",
      date: "2026-09-04",
      time: "10:30",
      allDay: false,
      repeat: "none",
      status: "open",
      notes: "Priya is checking the damp patch by the kitchen window.",
    },
    {
      id: "park-plumber",
      hubId: "park",
      kind: "event",
      category: "appointment",
      title: "Plumber appointment",
      date: "2026-09-07",
      time: "09:00",
      allDay: false,
      repeat: "none",
      status: "open",
      notes: "Boiler pressure and the slow tap in the upstairs bathroom.",
    },
  ],
  studio: [
    {
      id: "studio-keys",
      hubId: "studio",
      kind: "task",
      category: "chore",
      title: "Return the desk keys",
      date: "2026-09-01",
      time: "17:30",
      allDay: false,
      assignee: "Sam Okonkwo",
      repeat: "none",
      status: "open",
      notes: "Put the set back in the lockbox before close.",
    },
    {
      id: "studio-ink",
      hubId: "studio",
      kind: "task",
      category: "chore",
      title: "Pick up printer ink",
      date: "2026-09-07",
      time: "09:30",
      allDay: false,
      assignee: "Sam Okonkwo",
      repeat: "monthly",
      status: "open",
      notes: "Use the studio pot and log the receipt in Expenses.",
    },
  ],
  lisbon: [
    {
      id: "lisbon-airport",
      hubId: "lisbon",
      kind: "event",
      category: "appointment",
      title: "Airport pickup",
      date: "2026-09-03",
      time: "07:15",
      allDay: false,
      repeat: "none",
      status: "open",
      notes: "Uber from the flat. Flight is at 09:40.",
    },
    {
      id: "lisbon-dinner",
      hubId: "lisbon",
      kind: "event",
      category: "other",
      title: "Dinner booking",
      date: "2026-09-05",
      time: "20:00",
      allDay: false,
      repeat: "none",
      status: "open",
      notes: "Cervejaria Trindade. Ness has the table.",
    },
  ],
  created: [],
};

const KINDS = new Set<OperationKind>(["task", "event"]);
const CATEGORIES = new Set<OperationCategory>([
  "chore",
  "delivery",
  "visit",
  "appointment",
  "other",
]);
const REPEATS = new Set<OperationRepeat>(["none", "weekly", "monthly"]);
const STATUSES = new Set<OperationStatus>(["open", "done"]);
const HUB_IDS = new Set<HubId>(["park", "studio", "lisbon", "created"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

export function isOperationItem(value: unknown): value is OperationItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.hubId === "string" &&
    HUB_IDS.has(item.hubId as HubId) &&
    typeof item.kind === "string" &&
    KINDS.has(item.kind as OperationKind) &&
    typeof item.category === "string" &&
    CATEGORIES.has(item.category as OperationCategory) &&
    typeof item.title === "string" &&
    typeof item.date === "string" &&
    ISO_DATE.test(item.date) &&
    (item.time === undefined ||
      (typeof item.time === "string" && TIME.test(item.time))) &&
    typeof item.allDay === "boolean" &&
    (item.assignee === undefined || typeof item.assignee === "string") &&
    (item.rotation === undefined ||
      (Array.isArray(item.rotation) &&
        item.rotation.every((name) => typeof name === "string"))) &&
    (item.lastDone === undefined || isLastDone(item.lastDone)) &&
    typeof item.repeat === "string" &&
    REPEATS.has(item.repeat as OperationRepeat) &&
    typeof item.status === "string" &&
    STATUSES.has(item.status as OperationStatus) &&
    typeof item.notes === "string"
  );
}

export function normalizeOperationStore(
  value: unknown,
): OperationStore | undefined {
  if (!value || typeof value !== "object") return undefined;
  const input = value as Record<string, unknown>;
  const store = {} as OperationStore;
  for (const hubId of HUB_IDS) {
    const rows = input[hubId];
    if (!Array.isArray(rows) || !rows.every(isOperationItem)) return undefined;
    store[hubId] = rows;
  }
  return store;
}

function isLastDone(value: unknown): value is { by: string; date: string } {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.by === "string" && typeof row.date === "string";
}

export function hasProductionSeed(store: OperationStore): boolean {
  const bins = store.park.find((item) => item.id === "park-bins");
  return Boolean(
    bins?.rotation?.length &&
      store.park.some((item) => item.id === "park-admin"),
  );
}

function cloneItem(item: OperationItem): OperationItem {
  return {
    ...item,
    rotation: item.rotation ? [...item.rotation] : undefined,
    lastDone: item.lastDone ? { ...item.lastDone } : undefined,
  };
}

export function cloneOperationSeed(): OperationStore {
  return {
    park: OPERATIONS_SEED.park.map(cloneItem),
    studio: OPERATIONS_SEED.studio.map(cloneItem),
    lisbon: OPERATIONS_SEED.lisbon.map(cloneItem),
    created: [],
  };
}

export function nextInRotation(rotation: string[], current?: string): string {
  if (!rotation.length) return current ?? "";
  const index = current ? rotation.indexOf(current) : -1;
  return rotation[(index + 1) % rotation.length];
}

export function nextOccurrence(
  date: string,
  repeat: OperationRepeat,
  today = HOUSE_TODAY,
): string {
  if (repeat === "none") return date;
  let next = addRepeat(date, repeat);
  while (next <= today) next = addRepeat(next, repeat);
  return next;
}

export function firstNameOf(name?: string): string {
  return name?.split(" ")[0] ?? "";
}

export function formatTimeLabel(time?: string): string {
  if (!time) return "All day";
  const [hours, minutes] = time.split(":").map(Number);
  const suffix = hours >= 12 ? "pm" : "am";
  const hour = hours % 12 || 12;
  return minutes
    ? `${hour}:${String(minutes).padStart(2, "0")}${suffix}`
    : `${hour}${suffix}`;
}

export function overdueDays(date: string, today = HOUSE_TODAY): number {
  const start = dateFromIso(date).getTime();
  const end = dateFromIso(today).getTime();
  return Math.max(0, Math.round((end - start) / 86400000));
}

export function addRepeat(date: string, repeat: OperationRepeat): string {
  const next = dateFromIso(date);
  if (repeat === "weekly") next.setDate(next.getDate() + 7);
  if (repeat === "monthly") {
    const day = next.getDate();
    next.setDate(1);
    next.setMonth(next.getMonth() + 1);
    const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(day, lastDay));
  }
  return isoFromDate(next);
}

export function dateFromIso(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function isoFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayIso(): string {
  return HOUSE_TODAY;
}

export function addDays(date: string, days: number): string {
  const next = dateFromIso(date);
  next.setDate(next.getDate() + days);
  return isoFromDate(next);
}

export function startOfWeek(date: string): string {
  const value = dateFromIso(date);
  const mondayOffset = (value.getDay() + 6) % 7;
  value.setDate(value.getDate() - mondayOffset);
  return isoFromDate(value);
}

export function weekDates(date: string): string[] {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export const WEEK_START_MINUTES = 7 * 60;
export const WEEK_END_MINUTES = 21 * 60;
export const WEEK_HOUR_PX = 52;

export function weekHourRange(items: OperationItem[]): {
  start: number;
  end: number;
} {
  let start = WEEK_START_MINUTES;
  let end = WEEK_END_MINUTES;
  for (const item of items) {
    if (item.allDay || !item.time) continue;
    const minutes = timeToMinutes(item.time);
    start = Math.min(start, Math.floor(minutes / 60) * 60);
    end = Math.max(end, Math.ceil((minutes + 60) / 60) * 60);
  }
  return {
    start: Math.max(0, start),
    end: Math.min(24 * 60, end),
  };
}
