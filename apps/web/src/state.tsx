import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "wouter";
import {
  HUBS,
  HUB_EXPENSES,
  HOME_STATUS,
  NOTE_CARDS,
  PAGE_LEDES,
  PAGE_TITLES,
  PATH_SCREEN,
  SCREEN_PATH,
  WINDOW_PAGE,
  buildCreatedHub,
  initialsOf,
  isWindowId,
  type CreatedHub,
  type ExpenseRow,
  type Hub,
  type HubId,
  type NoteCard,
  type SampleHubId,
  type ScreenId,
  type WindowId,
} from "./data/household";
import {
  addDays,
  cloneOperationSeed,
  nextInRotation,
  nextOccurrence,
  normalizeOperationStore,
  todayIso,
  type NewOperation,
  type OperationItem,
  type OperationStore,
} from "./data/operations";
import { isStoredImage, readHubPhotos } from "./data/images";
import { isNativeNow, keepSearch, pathOnly } from "./nav";

const SESSION_KEY = "commune.session";
const NAV_KEY = "commune.nav-mode";
const RETURN_KEY = "commune.return-to";
export type Seed = "maya" | "new";

type ExpensesByHub = Partial<Record<HubId, ExpenseRow[]>>;
type NotesByHub = Partial<Record<HubId, Record<string, NoteCard>>>;
export type PendingInvite = { email: string; role: "Member" | "Admin" };
type InvitesByHub = Partial<Record<HubId, PendingInvite[]>>;
export type PayMethod = {
  provider: "Revolut" | "PayPal" | "Monzo" | "Bank transfer";
  value: string;
};
const DEFAULT_PAY_METHODS: PayMethod[] = [
  { provider: "Revolut", value: "@mayachen" },
  { provider: "PayPal", value: "paypal.me/mayachen" },
];
const ROUNDED_GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

export type Session = {
  name: string;
  email: string;
  seed: Seed;
  hasHubs: boolean;
  emptyLedger: boolean;
  createdHub?: CreatedHub;
  activeHubId?: HubId;
  expenses?: ExpensesByHub;
  lastExpenseId?: string;
  notes?: NotesByHub;
  operations?: OperationStore;
  hubPhotos?: Partial<Record<HubId, string>>;
  avatar?: string;
  dark?: boolean;
  noticesOn?: boolean;
  currency?: "£ GBP" | "$ USD" | "€ EUR";
  invites?: InvitesByHub;
  payMethods?: PayMethod[];
};

export type LastExpense = {
  name: string;
  amount: string;
  paidBy: string;
  category?: string;
  due?: string;
  recurring?: boolean;
  split?: string;
};

export type NavMode = "basic" | "advanced";

export type GoTarget =
  | ScreenId
  | WindowId
  | "login"
  | "signup"
  | "forgot"
  | "invite"
  | "onboard";

type GoOpts = {
  hub?: HubId;
  note?: string;
  operation?: string;
  date?: string;
  time?: string;
  window?: WindowId;
  expense?: string;
};

type AppState = {
  session: Session | null;
  screen: ScreenId;
  hubId: HubId;
  hub: Hub;
  places: Hub[];
  emptyHub: boolean;
  window: WindowId | null;
  moreOpen: boolean;
  navMode: NavMode;
  noteKey: string;
  notes: Record<string, NoteCard>;
  operationKey: string;
  operationDate: string;
  operationTime: string;
  operationsByHub: OperationStore;
  operations: OperationItem[];
  selectedOperation: OperationItem | null;
  dark: boolean;
  noticesOn: boolean;
  currency: "£ GBP" | "$ USD" | "€ EUR";
  searchQuery: string;
  invites: PendingInvite[];
  payMethods: PayMethod[];
  native: boolean;
  you: { name: string; email: string; initials: string; photo?: string };
  setHubPhoto: (id: HubId, dataUrl: string | null) => void;
  setAvatar: (dataUrl: string | null) => void;
  lastExpense: LastExpense | null;
  expenses: ExpenseRow[];
  selectedExpense: ExpenseRow | null;
  createdExpenses: ExpenseRow[];
  signIn: (session: Partial<Session> & Pick<Session, "name" | "email">) => void;
  signOut: () => void;
  go: (target: GoTarget, opts?: GoOpts) => void;
  closeWindow: () => void;
  setMoreOpen: (open: boolean) => void;
  setNavMode: (mode: NavMode) => void;
  setDark: (on: boolean) => void;
  setNoticesOn: (on: boolean) => void;
  setCurrency: (currency: "£ GBP" | "$ USD" | "€ EUR") => void;
  setSearchQuery: (query: string) => void;
  addInvite: (invite: PendingInvite) => boolean;
  savePayMethod: (method: PayMethod) => boolean;
  addNote: (card: NoteCard & { id: string }) => void;
  addOperation: (item: NewOperation) => string;
  updateOperation: (id: string, item: NewOperation) => void;
  toggleOperation: (id: string) => void;
  skipOperation: (id: string) => void;
  removeOperation: (id: string) => void;
  createHub: (input: CreatedHub, opts?: { openExpense?: boolean }) => boolean;
  recordExpense: (row: LastExpense) => string;
  markExpensePaid: (id: string) => void;
  pageTitle: string;
  pageLede: string;
};

const Ctx = createContext<AppState | null>(null);

function isCreatedHub(value: unknown): value is CreatedHub {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.name === "string" &&
    (v.type === "Household" || v.type === "Workspace" || v.type === "Trip") &&
    typeof v.currency === "string"
  );
}

const HUB_IDS = new Set<HubId>(["park", "studio", "lisbon", "created"]);
const EXPENSE_STATUSES = new Set<ExpenseRow["status"]>([
  "warn",
  "open",
  "settled",
]);
const EXPENSE_ACTIONS = new Set<ExpenseRow["action"]>([
  "choose",
  "mark-paid",
  "none",
]);

function isHubId(value: unknown): value is HubId {
  return typeof value === "string" && HUB_IDS.has(value as HubId);
}

function isExpenseRow(value: unknown): value is ExpenseRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.name === "string" &&
    typeof row.category === "string" &&
    typeof row.paidBy === "string" &&
    typeof row.due === "string" &&
    typeof row.status === "string" &&
    EXPENSE_STATUSES.has(row.status as ExpenseRow["status"]) &&
    typeof row.statusLabel === "string" &&
    typeof row.amount === "string" &&
    typeof row.action === "string" &&
    EXPENSE_ACTIONS.has(row.action as ExpenseRow["action"]) &&
    (row.open === undefined || typeof row.open === "boolean") &&
    (row.recurring === undefined || typeof row.recurring === "boolean") &&
    (row.split === undefined || typeof row.split === "string")
  );
}

function readExpenses(value: unknown): ExpensesByHub | undefined {
  if (!value || typeof value !== "object") return undefined;
  const input = value as Record<string, unknown>;
  const output: ExpensesByHub = {};
  for (const id of HUB_IDS) {
    const rows = input[id];
    if (rows === undefined) continue;
    if (!Array.isArray(rows) || !rows.every(isExpenseRow)) continue;
    output[id] = rows;
  }
  return Object.keys(output).length ? output : undefined;
}

function isNoteCard(value: unknown): value is NoteCard {
  if (!value || typeof value !== "object") return false;
  const card = value as Record<string, unknown>;
  return (
    typeof card.title === "string" &&
    typeof card.pill === "string" &&
    typeof card.kicker === "string" &&
    typeof card.lede === "string" &&
    typeof card.body === "string" &&
    Array.isArray(card.facts) &&
    card.facts.every(
      (fact) =>
        Array.isArray(fact) &&
        fact.length === 2 &&
        fact.every((part) => typeof part === "string"),
    )
  );
}

function readNotes(value: unknown): NotesByHub | undefined {
  if (!value || typeof value !== "object") return undefined;
  const input = value as Record<string, unknown>;
  const output: NotesByHub = {};
  for (const id of HUB_IDS) {
    const cards = input[id];
    if (!cards || typeof cards !== "object") continue;
    const entries = Object.entries(cards as Record<string, unknown>).filter(
      (entry): entry is [string, NoteCard] => isNoteCard(entry[1]),
    );
    if (entries.length) output[id] = Object.fromEntries(entries);
  }
  return Object.keys(output).length ? output : undefined;
}

function readInvites(value: unknown): InvitesByHub | undefined {
  if (!value || typeof value !== "object") return undefined;
  const input = value as Record<string, unknown>;
  const output: InvitesByHub = {};
  for (const id of HUB_IDS) {
    const invites = input[id];
    if (!Array.isArray(invites)) continue;
    output[id] = invites.filter(
      (invite): invite is PendingInvite =>
        Boolean(invite) &&
        typeof invite === "object" &&
        typeof (invite as Record<string, unknown>).email === "string" &&
        ((invite as Record<string, unknown>).role === "Member" ||
          (invite as Record<string, unknown>).role === "Admin"),
    );
  }
  return Object.keys(output).length ? output : undefined;
}

function readPayMethods(value: unknown): PayMethod[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const providers = new Set<PayMethod["provider"]>([
    "Revolut",
    "PayPal",
    "Monzo",
    "Bank transfer",
  ]);
  const methods = value.filter(
    (method): method is PayMethod =>
      Boolean(method) &&
      typeof method === "object" &&
      providers.has((method as Record<string, unknown>).provider as PayMethod["provider"]) &&
      typeof (method as Record<string, unknown>).value === "string",
  );
  return methods.length ? methods : undefined;
}

function normalizeSession(raw: unknown): Session | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.email !== "string" || typeof p.name !== "string") return null;
  const seed: Seed = p.seed === "new" ? "new" : "maya";
  return {
    name: p.name,
    email: p.email,
    seed,
    hasHubs: seed === "new" ? Boolean(p.hasHubs) : p.hasHubs !== false,
    emptyLedger: Boolean(p.emptyLedger),
    createdHub: isCreatedHub(p.createdHub) ? p.createdHub : undefined,
    activeHubId: isHubId(p.activeHubId) ? p.activeHubId : undefined,
    expenses: readExpenses(p.expenses),
    lastExpenseId:
      typeof p.lastExpenseId === "string" ? p.lastExpenseId : undefined,
    notes: readNotes(p.notes),
    operations: normalizeOperationStore(p.operations),
    hubPhotos: readHubPhotos(p.hubPhotos),
    avatar: isStoredImage(p.avatar) ? p.avatar : undefined,
    dark: p.dark === true,
    noticesOn: p.noticesOn !== false,
    currency:
      p.currency === "$ USD" || p.currency === "€ EUR" ? p.currency : "£ GBP",
    invites: readInvites(p.invites),
    payMethods: readPayMethods(p.payMethods),
  };
}

function readSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return normalizeSession(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function writeSession(next: Session) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
}

function authPath(target: string): string {
  if (target === "login") return "/login";
  if (target === "signup") return "/signup";
  if (target === "forgot") return "/forgot-password";
  if (target === "invite") return "/invite";
  if (target === "onboard") return "/onboard";
  return "/";
}

function withHubPhoto(hub: Hub, session: Session | null): Hub {
  const photo = session?.hubPhotos?.[hub.id];
  return photo ? { ...hub, photo } : hub;
}

function expensesFor(session: Session | null, id: HubId): ExpenseRow[] {
  const stored = session?.expenses?.[id];
  if (stored) return stored;
  if (id === "created") return [];
  return HUB_EXPENSES[id].map((row) => ({ ...row }));
}

function shortMoney(value: string): string {
  return value.replace(/\.00\b/, "");
}

function deriveHubFromLedger(base: Hub, rows: ExpenseRow[]): Hub {
  if (base.id === "created") return base;

  const seededIds = new Set(HUB_EXPENSES[base.id].map((row) => row.id));
  const added = rows.filter((row) => !seededIds.has(row.id));
  const open = rows.filter((row) => row.open === true);
  const firstOpen = open[0];
  const valueOf = (row: ExpenseRow) => {
    const value = Number.parseFloat(row.amount.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(value) ? value : 0;
  };
  const financialTotal =
    base.id === "park"
      ? rows.reduce((sum, row) => sum + valueOf(row), 0)
      : (base.id === "studio" ? 240 : 210) +
        added.reduce((sum, row) => sum + valueOf(row), 0);
  const addedNow = added
    .filter((row) => row.open === true)
    .map((row) => ({
      go: "expenses" as const,
      pill: "open",
      tag: row.due,
      title: row.name,
      when: `${row.amount} · ${row.paidBy} paid · open`,
    }));
  const addedActivity = added.map((row) => ({
    go: "expenses" as const,
    cls: "maya" as const,
    ini: initialsOf(row.paidBy),
    title: row.name,
    when: `${row.paidBy.split(" ")[0]} logged it`,
    time: "Today",
  }));
  const kpis = base.kpis.map((kpi) => {
    if (base.id === "studio" && added.length === 0) return kpi;
    if (kpi.kicker === "Open bills" || kpi.kicker === "Open") {
      return {
        ...kpi,
        num: String(open.length),
        hint: firstOpen ? `${firstOpen.name} · ${firstOpen.due}` : "Nothing waiting",
      };
    }
    if (kpi.kicker === "Next due" || kpi.kicker === "Next") {
      return {
        ...kpi,
        num: firstOpen?.due === "Today" ? "Today" : firstOpen?.due.split(" ")[0] ?? "—",
        hint: firstOpen ? `${firstOpen.name} · ${firstOpen.due}` : "Nothing waiting",
      };
    }
    if (kpi.kicker === "This month" || kpi.kicker === "Spent") {
      return {
        ...kpi,
        num: ROUNDED_GBP.format(financialTotal),
      };
    }
    return kpi;
  });

  if (base.id === "park") {
    const gasOpen = rows.some(
      (row) => row.name.toLocaleLowerCase() === "british gas" && row.open === true,
    );
    const addedNames = new Set(added.map((item) => item.name));
    const financialNow = base.now.filter(
      (item) =>
        !addedNames.has(item.title) &&
        (item.title !== "British Gas" || gasOpen),
    );
    return {
      ...base,
      status: gasOpen
        ? `August · you owe £42 · ${open.length} open bills · fund £420`
        : `August · you’re owed £18 · ${open.length} open bill${open.length === 1 ? "" : "s"} · fund £420`,
      oweLabel: gasOpen ? "You owe" : "You’re owed",
      oweAmount: gasOpen ? "£42.00" : "£18.00",
      oweCopy: gasOpen
        ? base.oweCopy
        : "British Gas is paid. Jordan still owes you £18 for Tesco extras.",
      oweCta: gasOpen ? "Settle with Jordan" : "Collect £18",
      credit: !gasOpen,
      kpis,
      now: [...addedNow, ...financialNow],
      moves: gasOpen
        ? base.moves
        : base.moves.filter((move) => !move.names.startsWith("You →")),
      members: base.members.map((member) =>
        member.name === "Maya Chen"
          ? { ...member, bal: gasOpen ? "Owe £42" : "Owed £18" }
          : member,
      ),
      activity: [...addedActivity, ...base.activity],
      jumps: base.jumps.map((jump) =>
        jump.kicker === "Settle" && !gasOpen
          ? { ...jump, title: "Collect £18", hint: "British Gas is paid" }
          : jump,
      ),
    };
  }

  if (base.id === "lisbon") {
    const holdOpen = rows.some(
      (row) => row.name.toLocaleLowerCase() === "airbnb hold" && row.open === true,
    );
    const addedNames = new Set(added.map((item) => item.name));
    const baseNow = base.now.filter((item) => !addedNames.has(item.title));
    return {
      ...base,
      status: holdOpen ? base.status : "Sept · even · Airbnb settled",
      oweLabel: holdOpen ? base.oweLabel : "You’re even",
      oweAmount: holdOpen ? base.oweAmount : "£0.00",
      oweCopy: holdOpen
        ? base.oweCopy
        : "Jordan and Ness have settled their Airbnb shares.",
      oweCta: holdOpen ? base.oweCta : "View settlement",
      credit: holdOpen,
      kpis,
      now: holdOpen
        ? [...addedNow, ...baseNow]
        : addedNow,
      moves: holdOpen ? base.moves : [],
      members: base.members.map((member) => ({
        ...member,
        bal: "Even",
        muted: !holdOpen,
        nudge: holdOpen ? member.nudge : undefined,
      })),
      activity: [...addedActivity, ...base.activity],
      jumps: base.jumps.map((jump) =>
        jump.kicker === "Settle" && !holdOpen
          ? { ...jump, title: "Everyone is even", hint: "Airbnb shares settled" }
          : jump,
      ),
    };
  }

  const addedNames = new Set(added.map((item) => item.name));
  const studioNow = base.now.filter((item) => !addedNames.has(item.title));
  const settlementMoves = added
    .filter((row) => row.open === true)
    .flatMap((row) => {
      const amount = valueOf(row);
      if (!amount || base.members.length < 2) return [];
      const share = amount / base.members.length;
      const payerFirst = row.paidBy.split(" ")[0];
      if (row.paidBy === "Maya Chen") {
        return base.members
          .filter((member) => member.name !== "Maya Chen")
          .map((member) => ({
            go: "settle" as const,
            arrow: "→",
            names: `${member.name.split(" ")[0]} → You`,
            why: `${row.name} · equal split`,
            amt: `£${share.toFixed(2)}`,
            expenseId: row.id,
          }));
      }
      return [
        {
          go: "settle" as const,
          arrow: "→",
          names: `You → ${payerFirst}`,
          why: `${row.name} · equal split`,
          amt: `£${share.toFixed(2)}`,
          expenseId: row.id,
        },
        ...base.members
          .filter(
            (member) =>
              member.name !== "Maya Chen" && member.name !== row.paidBy,
          )
          .map((member) => ({
            go: "settle" as const,
            arrow: "→",
            names: `${member.name.split(" ")[0]} → ${payerFirst}`,
            why: `${row.name} · equal split`,
            amt: `£${share.toFixed(2)}`,
            expenseId: row.id,
          })),
      ];
    });
  const youOwe = settlementMoves
    .filter((move) => move.names.startsWith("You →"))
    .reduce((sum, move) => sum + Number.parseFloat(move.amt.slice(1)), 0);
  const youAreOwed = settlementMoves
    .filter((move) => move.names.endsWith("→ You"))
    .reduce((sum, move) => sum + Number.parseFloat(move.amt.slice(1)), 0);
  return {
    ...base,
    status: settlementMoves.length
      ? `August · ${youOwe ? `you owe £${youOwe.toFixed(2)}` : ""}${youOwe && youAreOwed ? " · " : ""}${youAreOwed ? `you’re owed £${youAreOwed.toFixed(2)}` : ""} · ${open.length} open expense${open.length === 1 ? "" : "s"} · pot £90`
      : added.length
        ? `August · even · ${open.length} open expense${open.length === 1 ? "" : "s"} · pot £90`
        : base.status,
    kpis,
    oweLabel: youOwe ? "You owe" : youAreOwed ? "You’re owed" : base.oweLabel,
    oweAmount: youOwe
      ? `£${youOwe.toFixed(2)}`
      : youAreOwed
        ? `£${youAreOwed.toFixed(2)}`
        : base.oweAmount,
    oweCopy: settlementMoves.length
      ? `${open.length} open expense${open.length === 1 ? "" : "s"}. Settle the equal shares when ready.`
      : added.length
        ? `${added[0].name} is settled. Nobody owes anyone this cycle.`
        : base.oweCopy,
    oweCta: settlementMoves.length
      ? "Open settlement"
      : added.length
        ? "Add expense"
        : base.oweCta,
    credit: !youOwe && Boolean(youAreOwed),
    now: [...addedNow, ...studioNow],
    moves: settlementMoves.length ? settlementMoves : base.moves,
    members: base.members.map((member) =>
      member.name === "Maya Chen" && settlementMoves.length
        ? {
            ...member,
            bal: youOwe ? `Owe £${youOwe.toFixed(2)}` : `Owed £${youAreOwed.toFixed(2)}`,
            muted: false,
          }
        : member,
    ),
    activity: [...addedActivity, ...base.activity],
    jumps: base.jumps.map((jump) =>
      jump.kicker === "Settle" && settlementMoves.length
        ? { ...jump, title: `${youOwe ? "Pay" : "Collect"} ${youOwe ? `£${youOwe.toFixed(2)}` : `£${youAreOwed.toFixed(2)}`}`, hint: "Open shared expenses" }
        : jump,
    ),
  };
}

function homeStatusFor(places: Hub[]): string {
  const park = places.find((place) => place.id === "park");
  const lisbon = places.find((place) => place.id === "lisbon");
  if (
    places.length === 3 &&
    park?.oweAmount === "£42.00" &&
    lisbon?.oweAmount === "£64.00"
  ) {
    return HOME_STATUS;
  }
  const parts = [
    park ? `Park ${park.oweLabel.toLowerCase()} ${shortMoney(park.oweAmount)}` : null,
    lisbon ? `Lisbon ${lisbon.oweLabel.toLowerCase()} ${shortMoney(lisbon.oweAmount)}` : null,
  ].filter(Boolean);
  return `${places.length} spaces${parts.length ? ` · ${parts.join(" · ")}` : ""}`;
}

function notesFor(session: Session | null, id: HubId): Record<string, NoteCard> {
  return { ...NOTE_CARDS, ...(session?.notes?.[id] ?? {}) };
}

function resolveHub(id: HubId, session: Session | null): Hub {
  const base =
    id === "created"
      ? buildCreatedHub({
          name: session?.createdHub?.name ?? "New commune",
          type: session?.createdHub?.type ?? "Household",
          ownerName: session?.name ?? "Maya Chen",
          currency: session?.createdHub?.currency,
          expenses: expensesFor(session, "created"),
        })
      : deriveHubFromLedger(HUBS[id], expensesFor(session, id));
  const pinnedNotes = Object.entries(session?.notes?.[id] ?? {})
    .filter(([, note]) => note.kicker.toLocaleLowerCase().includes("pinned"))
    .map(([note, card]) => ({
      go: "note" as const,
      note,
      title: card.title,
      when: card.lede,
    }));
  const hub = pinnedNotes.length
    ? { ...base, notes: [...pinnedNotes, ...base.notes] }
    : base;
  return withHubPhoto(hub, session);
}

function placesFor(session: Session | null): Hub[] {
  if (!session?.hasHubs) return [];
  const created = session.createdHub
    ? buildCreatedHub({
        name: session.createdHub.name,
        type: session.createdHub.type,
        ownerName: session.name,
        currency: session.createdHub.currency,
        expenses: expensesFor(session, "created"),
      })
    : null;
  if (session.seed === "new") return created ? [withHubPhoto(created, session)] : [];
  const list: Hub[] = [
    deriveHubFromLedger(HUBS.park, expensesFor(session, "park")),
    deriveHubFromLedger(HUBS.studio, expensesFor(session, "studio")),
    deriveHubFromLedger(HUBS.lisbon, expensesFor(session, "lisbon")),
  ];
  if (created) list.push(created);
  return list.map((hub) => withHubPhoto(hub, session));
}

function isEmptyHub(id: HubId, session: Session | null): boolean {
  return id === "created" && expensesFor(session, id).length === 0;
}

function hasSettlement(id: HubId, session: Session | null): boolean {
  return resolveHub(id, session).moves.some((move) => !move.even);
}

function operationsFor(session: Session | null): OperationStore {
  const stored = session?.operations;
  if (stored) return stored;
  return cloneOperationSeed();
}

function ledeForHub(screen: ScreenId, hub: Hub): string {
  switch (screen) {
    case "hub":
    case "hub-empty":
      return hub.status;
    case "expenses":
    case "expenses-empty":
      return `Everything ${hub.name} has shared this cycle.`;
    case "settle":
    case "settle-even":
      return hub.oweCopy;
    case "recurring":
      return `What comes back, or is already scheduled, in ${hub.name}.`;
    case "funds":
      return `${hub.kpis[0].kicker} ${hub.kpis[0].num} · ${hub.kpis[0].hint}`;
    case "templates":
      return `Split defaults for ${hub.name}. Override them on any expense.`;
    case "analytics":
      return `This cycle in ${hub.name}.`;
    case "members":
      return `${hub.members.length} ${hub.members.length === 1 ? "person" : "people"} · balances for this cycle.`;
    case "notes":
      return `What ${hub.name} keeps needing to remember.`;
    case "activity":
      return `The ${hub.name} log, without the group chat.`;
    default:
      return PAGE_LEDES[screen] ?? hub.status;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const screen: ScreenId = PATH_SCREEN[pathOnly(location)] ?? "home";
  const [session, setSession] = useState<Session | null>(() =>
    typeof window === "undefined" ? null : readSession(),
  );
  const [hubId, setHubId] = useState<HubId>(() => {
    if (typeof window === "undefined") return "park";
    const existing = readSession();
    if (
      existing?.activeHubId &&
      placesFor(existing).some((place) => place.id === existing.activeHubId)
    ) {
      return existing.activeHubId;
    }
    return existing?.seed === "new" ? "created" : "park";
  });
  const [windowId, setWindowId] = useState<WindowId | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [navMode, setNavModeState] = useState<NavMode>(() => {
    if (typeof window === "undefined") return "basic";
    return sessionStorage.getItem(NAV_KEY) === "advanced"
      ? "advanced"
      : "basic";
  });
  const [noteKey, setNoteKey] = useState("wifi");
  const [selectedExpenseId, setSelectedExpenseId] = useState(() => {
    if (typeof window === "undefined") return "park-british-gas";
    return readSession()?.lastExpenseId ?? "park-british-gas";
  });
  const [operationKey, setOperationKey] = useState("park-bins");
  const [operationDate, setOperationDate] = useState("2026-09-01");
  const [operationTime, setOperationTime] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const native = isNativeNow();

  const persist = useCallback((next: Session) => {
    writeSession(next);
    setSession(next);
  }, []);

  const hub = resolveHub(hubId, session);
  const places = placesFor(session);
  const emptyHub = isEmptyHub(hubId, session);
  const expenses = expensesFor(session, hubId);
  const selectedExpense =
    expenses.find((row) => row.id === selectedExpenseId) ?? expenses[0] ?? null;
  const lastExpense = selectedExpense
    ? {
        name: selectedExpense.name,
        amount: selectedExpense.amount,
        paidBy: selectedExpense.paidBy,
      }
    : null;
  const createdExpenses = expensesFor(session, "created");
  const notes = notesFor(session, hubId);
  const operationStore = operationsFor(session);
  const dark = session?.dark ?? false;
  const noticesOn = session?.noticesOn ?? true;
  const currency = session?.currency ?? "£ GBP";
  const invites = session?.invites?.[hubId] ?? [];
  const payMethods = session?.payMethods ?? DEFAULT_PAY_METHODS;

  useEffect(() => {
    if (!session || session.seed !== "maya") return;
    if (session.operations) return;
    persist({ ...session, operations: cloneOperationSeed() });
  }, [persist, session]);
  const operations = operationStore[hubId];
  const selectedOperation =
    operations.find((item) => item.id === operationKey) ?? null;
  const you = {
    name: session?.name ?? "Maya Chen",
    email: session?.email ?? "maya@14park.st",
    initials: initialsOf(session?.name ?? "Maya Chen"),
    photo: session?.avatar,
  };

  const signIn = useCallback(
    (next: Partial<Session> & Pick<Session, "name" | "email">) => {
      const prior = readSession();
      const keepPictures =
        prior != null && prior.email.toLowerCase() === next.email.trim().toLowerCase();
      const full: Session = {
        seed: "maya",
        hasHubs: true,
        emptyLedger: false,
        activeHubId: keepPictures ? prior.activeHubId : undefined,
        expenses: keepPictures ? prior.expenses : undefined,
        lastExpenseId: keepPictures ? prior.lastExpenseId : undefined,
        notes: keepPictures ? prior.notes : undefined,
        operations: keepPictures ? prior.operations : undefined,
        dark: keepPictures ? prior.dark : false,
        noticesOn: keepPictures ? prior.noticesOn : true,
        currency: keepPictures ? prior.currency : "£ GBP",
        invites: keepPictures ? prior.invites : undefined,
        payMethods: keepPictures ? prior.payMethods : undefined,
        ...next,
        name: next.name,
        email: next.email,
        hubPhotos: keepPictures ? prior.hubPhotos : undefined,
        avatar: keepPictures ? prior.avatar : undefined,
      };
      persist(full);
      const nextHub = full.activeHubId ?? (full.seed === "new" ? "created" : "park");
      setHubId(nextHub);
      setSelectedExpenseId(
        full.lastExpenseId ?? expensesFor(full, nextHub)[0]?.id ?? "park-british-gas",
      );
      const returnTo = sessionStorage.getItem(RETURN_KEY);
      if (returnTo) {
        sessionStorage.removeItem(RETURN_KEY);
        setLocation(keepSearch(returnTo));
      }
    },
    [persist, setLocation],
  );

  const signOut = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(NAV_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    setSession(null);
    setWindowId(null);
    setHubId("park");
    setSelectedExpenseId("park-british-gas");
    setNavModeState("basic");
    setSearchQuery("");
    setLocation(keepSearch("/login"));
  }, [setLocation]);

  const closeWindow = useCallback(() => setWindowId(null), []);

  const setNavMode = useCallback((mode: NavMode) => {
    sessionStorage.setItem(NAV_KEY, mode);
    setNavModeState(mode);
  }, []);

  const setDark = useCallback(
    (on: boolean) => {
      if (session) persist({ ...session, dark: on });
    },
    [persist, session],
  );

  const setNoticesOn = useCallback(
    (on: boolean) => {
      if (session) persist({ ...session, noticesOn: on });
    },
    [persist, session],
  );

  const setCurrency = useCallback(
    (nextCurrency: "£ GBP" | "$ USD" | "€ EUR") => {
      if (session) persist({ ...session, currency: nextCurrency });
    },
    [persist, session],
  );

  const addInvite = useCallback(
    (invite: PendingInvite) => {
      if (!session) return false;
      const email = invite.email.trim().toLocaleLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) return false;
      const current = session.invites?.[hubId] ?? [];
      if (current.some((item) => item.email.toLocaleLowerCase() === email)) {
        return false;
      }
      persist({
        ...session,
        invites: {
          ...(session.invites ?? {}),
          [hubId]: [...current, { ...invite, email }],
        },
      });
      return true;
    },
    [hubId, persist, session],
  );

  const savePayMethod = useCallback(
    (method: PayMethod) => {
      if (!session || !method.value.trim()) return false;
      const current = session.payMethods ?? payMethods;
      persist({
        ...session,
        payMethods: [
          { ...method, value: method.value.trim() },
          ...current.filter((item) => item.provider !== method.provider),
        ],
      });
      return true;
    },
    [payMethods, persist, session],
  );

  const savePicture = useCallback(
    (patch: Pick<Session, "hubPhotos" | "avatar">) => {
      if (!session) return;
      const next = { ...session, ...patch };
      try {
        writeSession(next);
      } catch {
        throw new Error("This browser can’t store another photo. Remove one first.");
      }
      setSession(next);
    },
    [session],
  );

  const setHubPhoto = useCallback(
    (id: HubId, dataUrl: string | null) => {
      const photos = { ...(session?.hubPhotos ?? {}) };
      if (dataUrl) photos[id] = dataUrl;
      else delete photos[id];
      savePicture({ hubPhotos: Object.keys(photos).length ? photos : undefined });
    },
    [savePicture, session?.hubPhotos],
  );

  const setAvatar = useCallback(
    (dataUrl: string | null) => {
      savePicture({ avatar: dataUrl ?? undefined });
    },
    [savePicture],
  );

  const addNote = useCallback(
    (card: NoteCard & { id: string }) => {
      if (!session) return;
      const { id, ...note } = card;
      persist({
        ...session,
        notes: {
          ...(session.notes ?? {}),
          [hubId]: {
            ...(session.notes?.[hubId] ?? {}),
            [id]: note,
          },
        },
      });
      setNoteKey(id);
    },
    [hubId, persist, session],
  );

  const addOperation = useCallback(
    (item: NewOperation) => {
      const id = `operation-${Date.now()}`;
      const nextItem: OperationItem = {
        ...item,
        id,
        hubId,
        status: "open",
        rotation:
          item.rotation ??
          (item.kind === "task" && item.repeat !== "none"
            ? resolveHub(hubId, session).members.map((member) => member.name)
            : undefined),
      };
      const current = operationsFor(session);
      if (session) {
        persist({
          ...session,
          operations: {
            ...current,
            [hubId]: [nextItem, ...current[hubId]],
          },
        });
      }
      setOperationKey(id);
      setOperationDate(item.date);
      return id;
    },
    [hubId, persist, session],
  );

  const updateOperation = useCallback(
    (id: string, item: NewOperation) => {
      if (!session) return;
      const current = operationsFor(session);
      persist({
        ...session,
        operations: {
          ...current,
          [hubId]: current[hubId].map((row) =>
            row.id === id
              ? {
                  ...row,
                  ...item,
                  id: row.id,
                  hubId: row.hubId,
                  status: row.status,
                  rotation: item.rotation ?? row.rotation,
                  lastDone: row.lastDone,
                }
              : row,
          ),
        },
      });
      setOperationDate(item.date);
      if (item.time) setOperationTime(item.time);
    },
    [hubId, persist, session],
  );

  const toggleOperation = useCallback(
    (id: string) => {
      if (!session) return;
      const current = operationsFor(session);
      const item = current[hubId].find((row) => row.id === id);
      if (!item) return;
      const completing = item.status === "open";
      const today = todayIso();
      const rows = current[hubId].map((row) => {
        if (row.id !== id) return row;
        if (!completing) {
          return { ...row, status: "open" as const };
        }
        if (row.repeat !== "none") {
          return {
            ...row,
            status: "open" as const,
            date: nextOccurrence(row.date, row.repeat, today),
            assignee: row.rotation?.length
              ? nextInRotation(row.rotation, row.assignee)
              : row.assignee,
            lastDone: row.assignee
              ? { by: row.assignee, date: today }
              : row.lastDone,
          };
        }
        return { ...row, status: "done" as const };
      });
      persist({
        ...session,
        operations: {
          ...current,
          [hubId]: rows,
        },
      });
    },
    [hubId, persist, session],
  );

  const skipOperation = useCallback(
    (id: string) => {
      if (!session) return;
      const current = operationsFor(session);
      const item = current[hubId].find((row) => row.id === id);
      if (!item) return;
      const today = todayIso();
      const from = item.date < today ? today : item.date;
      persist({
        ...session,
        operations: {
          ...current,
          [hubId]: current[hubId].map((row) =>
            row.id === id ? { ...row, date: addDays(from, 7) } : row,
          ),
        },
      });
    },
    [hubId, persist, session],
  );

  const removeOperation = useCallback(
    (id: string) => {
      if (!session) return;
      const current = operationsFor(session);
      persist({
        ...session,
        operations: {
          ...current,
          [hubId]: current[hubId].filter((row) => row.id !== id),
        },
      });
      setWindowId(null);
    },
    [hubId, persist, session],
  );

  const createHub = useCallback(
    (input: CreatedHub, opts?: { openExpense?: boolean }) => {
      if (session?.createdHub) return false;
      const base: Session = session ?? {
        name: "Maya Chen",
        email: "maya@14park.st",
        seed: "new",
        hasHubs: false,
        emptyLedger: true,
      };
      const next: Session = {
        ...base,
        hasHubs: true,
        emptyLedger: true,
        createdHub: input,
        activeHubId: "created",
        lastExpenseId: undefined,
        expenses: {
          ...(base.expenses ?? {}),
          created: [],
        },
      };
      persist(next);
      setHubId("created");
      setMoreOpen(false);
      setLocation(keepSearch(SCREEN_PATH["hub-empty"]));
      setWindowId(opts?.openExpense ? "add-expense" : null);
      return true;
    },
    [persist, session, setLocation],
  );

  const recordExpense = useCallback(
    (row: LastExpense) => {
      const current = expensesFor(session, hubId);
      const existing = current.find(
        (item) =>
          item.open !== false &&
          item.name.trim().toLocaleLowerCase() === row.name.trim().toLocaleLowerCase(),
      );
      const id = existing?.id ?? `${hubId}-expense-${Date.now()}`;
      const expense: ExpenseRow = {
        ...existing,
        id,
        name: row.name,
        category: row.category ?? existing?.category ?? "Other",
        paidBy: row.paidBy,
        due: row.due ?? existing?.due ?? "Today",
        status: existing?.status === "warn" ? "warn" : "open",
        statusLabel: existing?.statusLabel ?? "Open",
        amount: row.amount,
        action: hub.members.length > 1 ? "choose" : "none",
        open: true,
        recurring: row.recurring ?? existing?.recurring,
        split: row.split ?? existing?.split,
      };
      if (session) {
        persist({
          ...session,
          activeHubId: hubId,
          emptyLedger: hubId === "created" ? false : session.emptyLedger,
          lastExpenseId: id,
          expenses: {
            ...(session.expenses ?? {}),
            [hubId]: [
              expense,
              ...current.filter((item) => item.id !== expense.id),
            ],
          },
        });
      }
      setSelectedExpenseId(id);
      return id;
    },
    [hub.members.length, hubId, persist, session],
  );

  const markExpensePaid = useCallback(
    (id: string) => {
      if (!session) return;
      const current = expensesFor(session, hubId);
      persist({
        ...session,
        lastExpenseId: id,
        expenses: {
          ...(session.expenses ?? {}),
          [hubId]: current.map((row) =>
            row.id === id
              ? {
                  ...row,
                  status: "settled" as const,
                  statusLabel: "Settled",
                  action: "none" as const,
                  open: false,
                }
              : row,
          ),
        },
      });
      setSelectedExpenseId(id);
    },
    [hubId, persist, session],
  );

  const go = useCallback(
    (target: GoTarget, opts?: GoOpts) => {
      const nextHub = opts?.hub ?? hubId;
      if (opts?.hub) {
        setHubId(opts.hub);
        if (session && session.activeHubId !== opts.hub) {
          persist({ ...session, activeHubId: opts.hub });
        }
      }
      if (opts?.expense) setSelectedExpenseId(opts.expense);
      if (opts?.note) setNoteKey(opts.note);
      if (opts?.operation) setOperationKey(opts.operation);
      if (opts?.date) setOperationDate(opts.date);
      if (opts?.time) setOperationTime(opts.time);
      else if (target === "operation-new") setOperationTime("");
      setMoreOpen(false);

      if (
        target === "login" ||
        target === "signup" ||
        target === "forgot" ||
        target === "invite" ||
        target === "onboard"
      ) {
        setWindowId(null);
        setLocation(keepSearch(authPath(target)));
        return;
      }

      const empty = isEmptyHub(nextHub, session);

      if (isWindowId(target)) {
        const stay =
          target === "add-expense" &&
          (screen === "hub-empty" ||
            screen === "home-empty" ||
            screen === "expenses-empty");
        if (!stay) {
          const page = WINDOW_PAGE[target];
          if (page) {
            let dest: ScreenId = page;
            if (page === "expenses" && empty && target === "add-expense")
              dest = "expenses-empty";
            if (
              page === "settle" &&
              !hasSettlement(nextHub, session)
            )
              dest = "settle-even";
            if (dest !== screen) setLocation(keepSearch(SCREEN_PATH[dest]));
          }
        }
        setWindowId(target);
        return;
      }

      let next: ScreenId = target;
      if (target === "home" && !session?.hasHubs) next = "home-empty";
      if (target === "hub" && (empty || !session?.hasHubs)) next = "hub-empty";
      if (target === "expenses" && (empty || !session?.hasHubs))
        next = "expenses-empty";
      if (
        target === "settle" &&
        (!hasSettlement(nextHub, session) || !session?.hasHubs)
      ) {
        next = "settle-even";
      }
      setWindowId(opts?.window ?? null);
      setLocation(keepSearch(SCREEN_PATH[next]));
      if (opts?.window) setWindowId(opts.window);
    },
    [hubId, persist, screen, session, setLocation],
  );

  const pageTitle = windowId
    ? windowId === "expense" || windowId === "expense-paid"
      ? (selectedExpense?.name ?? "Expense")
      : windowId === "note"
      ? (notes[noteKey]?.title ?? "Note")
      : windowId === "operation" || windowId === "operation-edit"
        ? (selectedOperation?.title ?? "Schedule item")
        : (PAGE_TITLES[windowId] ?? PAGE_TITLES[screen])
    : (PAGE_TITLES[screen] ?? "Home");

  const pageLede = windowId
    ? windowId === "expense" || windowId === "expense-paid"
      ? selectedExpense
        ? `${selectedExpense.paidBy} paid ${selectedExpense.amount}. ${selectedExpense.open ? "This expense is open." : "This expense is settled."}`
        : "Expense"
      : windowId === "add-expense"
        ? hub.members.length === 1
          ? "Just you for now. Add the amount and details to start the ledger."
          : `Split ${hub.members.length} ways unless you pick a template.`
      : windowId === "profile"
        ? `You · Admin at ${hub.name}.`
      : (PAGE_LEDES[windowId] ?? "")
      : screen === "home" || screen === "communes"
      ? session?.seed === "new"
        ? session.hasHubs
          ? createdExpenses.length
            ? `1 space · ${createdExpenses.length} shared ${createdExpenses.length === 1 ? "item" : "items"}`
            : "1 space · nothing shared yet"
          : PAGE_LEDES["home-empty"]
        : homeStatusFor(places)
      : ledeForHub(screen, hub);

  const value = useMemo<AppState>(
    () => ({
      session,
      screen,
      hubId,
      hub,
      places,
      emptyHub,
      window: windowId,
      moreOpen,
      navMode,
      noteKey,
      notes,
      operationKey,
      operationDate,
      operationTime,
      operationsByHub: operationStore,
      operations,
      selectedOperation,
      dark,
      noticesOn,
      currency,
      searchQuery,
      invites,
      payMethods,
      native,
      you,
      lastExpense,
      expenses,
      selectedExpense,
      createdExpenses,
      signIn,
      signOut,
      go,
      closeWindow,
      setMoreOpen,
      setNavMode,
      setDark,
      setNoticesOn,
      setCurrency,
      setSearchQuery,
      addInvite,
      savePayMethod,
      addNote,
      addOperation,
      updateOperation,
      toggleOperation,
      skipOperation,
      removeOperation,
      createHub,
      recordExpense,
      markExpensePaid,
      setHubPhoto,
      setAvatar,
      pageTitle,
      pageLede,
    }),
    [
      session,
      screen,
      hubId,
      hub,
      places,
      emptyHub,
      windowId,
      moreOpen,
      navMode,
      noteKey,
      notes,
      operationKey,
      operationDate,
      operationTime,
      operationStore,
      operations,
      selectedOperation,
      dark,
      noticesOn,
      currency,
      searchQuery,
      invites,
      payMethods,
      native,
      you,
      lastExpense,
      expenses,
      selectedExpense,
      createdExpenses,
      signIn,
      signOut,
      go,
      closeWindow,
      setNavMode,
      setDark,
      setNoticesOn,
      setCurrency,
      addInvite,
      savePayMethod,
      addNote,
      addOperation,
      updateOperation,
      toggleOperation,
      skipOperation,
      removeOperation,
      createHub,
      recordExpense,
      markExpensePaid,
      setHubPhoto,
      setAvatar,
      pageTitle,
      pageLede,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

export type { SampleHubId };
