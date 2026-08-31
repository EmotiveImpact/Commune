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
  repeat: OperationRepeat;
  status: OperationStatus;
  notes: string;
};

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
      repeat: "weekly",
      status: "open",
      notes:
        "Clear the counters, run the dishwasher, and take the food caddy out.",
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

export function cloneOperationSeed(): OperationStore {
  return {
    park: OPERATIONS_SEED.park.map((item) => ({ ...item })),
    studio: OPERATIONS_SEED.studio.map((item) => ({ ...item })),
    lisbon: OPERATIONS_SEED.lisbon.map((item) => ({ ...item })),
    created: [],
  };
}

export function addRepeat(date: string, repeat: OperationRepeat): string {
  const next = dateFromIso(date);
  if (repeat === "weekly") next.setDate(next.getDate() + 7);
  if (repeat === "monthly") next.setMonth(next.getMonth() + 1);
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
  return isoFromDate(new Date());
}
