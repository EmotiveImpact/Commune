export type SampleHubId = "park" | "studio" | "lisbon";
// Live communes are UUIDs. The names above only key the default cover photos
// (HUBS), never application state.
export type HubId = string;

export type AvatarTone = "maya" | "jordan" | "alex" | "priya" | "sam" | "ness";

export type ScreenId =
  | "home"
  | "home-empty"
  | "home-inbox"
  | "communes"
  | "hub"
  | "hub-empty"
  | "expenses"
  | "expenses-empty"
  | "settle"
  | "settle-even"
  | "recurring"
  | "funds"
  | "templates"
  | "members"
  | "operations"
  | "notes"
  | "activity"
  | "home-activity"
  | "search"
  | "commune-settings"
  | "settings";

export type WindowId =
  | "notices"
  | "reminder-preview"
  | "add-expense"
  | "expense"
  | "expense-paid"
  | "commune-new"
  | "member-invite"
  | "profile"
  | "breakdown"
  | "pay"
  | "pay-method"
  | "note"
  | "note-new"
  | "note-edit"
  | "operation"
  | "operation-new"
  | "operation-edit"
  | "announcement-new";

export type RouteId = ScreenId | WindowId;

export type SettlementMove = {
  go: ScreenId | WindowId;
  arrow: string;
  names: string;
  why: string;
  amt: string;
  even?: boolean;
  expenseId?: string;
};

/** The kinds of record an activity row can be about (0039 names one for each event). */
export type ActivityType =
  | "expense" | "repayment" | "fund" | "pledge" | "contribution" | "recurring" | "template"
  | "task" | "event" | "note" | "member" | "announcement";

export type Hub = {
  id: HubId;
  currency?: "GBP" | "USD" | "EUR";
  role?: "admin" | "member";
  name: string;
  type: "Household" | "Workspace" | "Trip";
  address?: string;
  destination?: string;
  stayName?: string;
  stayAddress?: string;
  lede: string;
  people: string;
  photo: string;
  switchMeta: string;
  status: string;
  youMeta: string;
  avatars: Array<[AvatarTone, string]>;
  oweLabel: string;
  oweAmount: string;
  oweCopy: string;
  oweCta: string;
  credit: boolean;
  kpis: Array<{ go: ScreenId | WindowId; tone: string; kicker: string; num: string; hint: string }>;
  now: Array<{ go: ScreenId | WindowId; pill: string; tag: string; title: string; when: string; expenseId?: string; operationId?: string; dueOn?: string }>;
  moves: SettlementMove[];
  members: Array<{
    userId?: string;
    cls: AvatarTone;
    ini: string;
    name: string;
    meta: string;
    bal: string;
    nudge?: boolean;
    muted?: boolean;
  }>;
  activity: Array<{
    go: ScreenId | WindowId;
    cls: AvatarTone;
    ini: string;
    title: string;
    when: string;
    time: string;
    createdAt?: string;
    expenseId?: string;
    /** The kind of record the row is about. */
    type?: ActivityType;
  }>;
  notes: Array<{ go: "note"; note: string; title: string; when: string }>;
  jumps: Array<{ go: ScreenId | WindowId; kicker: string; title: string; hint: string }>;
};

// The default cover photo for each type of commune (data/covers.ts): park for
// a household, studio for a workspace, lisbon for a trip. The names are those
// of the design fixtures the photos came from.
export const HUBS: Record<SampleHubId, Pick<Hub, "photo">> = {
  park: { photo: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1600&q=80" },
  studio: { photo: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80" },
  lisbon: { photo: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=1600&q=80" },
};

export type NoteCard = {
  title: string;
  pill: string;
  kicker: string;
  lede: string;
  body: string;
  facts: Array<[string, string]>;
};

export const NOTE_BODY_HINT: Record<string, string> = {
  wifi: "Network name and anything guests need to know.",
  bins: "Which bags, which day, where they go.",
  keys: "Who has the spare, last lockup, anything that bites.",
  contacts: "When to contact them, opening hours, or anything helpful.",
  emergency: "Who to call when the boiler dies at 11pm.",
  rules: "Quiet hours, shoes and guests.",
  other: "Anything this commune needs to remember.",
};

export const PAGE_TITLES: Record<string, string> = {
  home: "Home",
  "home-empty": "Home",
  "home-inbox": "Home",
  communes: "Places",
  "commune-new": "New commune",
  hub: "This Hub",
  "hub-empty": "This Hub",
  expenses: "Expenses",
  "expenses-empty": "Expenses",
  expense: "Expense",
  "expense-paid": "Expense",
  settle: "Settle",
  "settle-even": "Settle",
  recurring: "Recurring",
  funds: "Funds",
  templates: "Templates",
  breakdown: "Breakdown",
  members: "Members",
  operations: "Operations",
  operation: "Schedule item",
  "operation-new": "Add to calendar",
  "operation-edit": "Edit schedule item",
  "announcement-new": "Post an announcement",
  notes: "Notes",
  note: "Note",
  "note-new": "Add note",
  "note-edit": "Edit note",
  activity: "Activity",
  "home-activity": "All activity",
  search: "Search",
  "commune-settings": "Commune settings",
  notices: "Notices",
  "add-expense": "Add expense",
  "member-invite": "Invite",
  pay: "Pay a member",
  "pay-method": "Pay me",
  profile: "Profile",
  settings: "Settings",
};

export const PAGE_LEDES: Record<string, string> = {
  home: "Your shared spaces and what needs attention.",
  "home-empty": "Create a hub, or join one.",
  "home-inbox": "Your latest shared activity.",
  communes: "Switch between your shared spaces.",
  "commune-new": "A home, a studio, or a trip.",
  "hub-empty": "No bills yet.",
  expenses: "Everything the house has shared this cycle.",
  "expenses-empty": "Add the first bill.",
  expense: "A shared expense and its member shares.",
  "expense-paid": "A member share has been confirmed.",
  settle: "Outstanding shares involving you.",
  "settle-even": "Nothing to send this cycle.",
  recurring: "Repeat a bill, check it, then record what was paid.",
  funds: "Pledges and recorded contributions.",
  templates: "Shared split preferences.",
  breakdown: "The ledger view of who owes whom.",
  members: "Balances for this cycle, not personalities.",
  operations: "What’s late, what’s yours, then the week.",
  operation: "The date, owner, and details in one place.",
  "operation-new": "A task to finish, or something everyone should know is happening.",
  "operation-edit": "Change the time, the owner, or take it off the calendar.",
  "announcement-new": "A short notice everyone in the commune sees on This Hub.",
  notes: "Shared details, easy to find.",
  note: "Pinned · everyone",
  "note-new": "Type first. Extras change. The note itself stays so you can keep writing.",
  "note-edit": "Update shared details and pin this note on This Hub.",
  activity: "The log, without the group chat.",
  "home-activity": "Recent records across all your communes.",
  search: "Find an expense, note, task or commune.",
  "commune-settings": "Details and people for this commune.",
  notices: "Updates sent to you in Commune.",
  "add-expense": "Choose the members and check the split.",
  "member-invite": "Send an email invitation or share a secure link.",
  pay: "Choose how to settle outside Commune.",
  "pay-method": "A username they can tap from Settle.",
  profile: "Your account and payment methods.",
  settings: "You, the house, and how this app behaves.",
};

export const WINDOW_IDS: WindowId[] = [
  "notices",
  "reminder-preview",
  "add-expense",
  "expense",
  "expense-paid",
  "commune-new",
  "member-invite",
  "profile",
  "breakdown",
  "pay",
  "pay-method",
  "note",
  "note-new",
  "note-edit",
  "operation",
  "operation-new",
  "operation-edit",
  "announcement-new",
];

export const WINDOW_PAGE: Partial<Record<WindowId, ScreenId>> = {
  expense: "expenses",
  "expense-paid": "expenses",
  "add-expense": "expenses",
  "commune-new": "communes",
  "member-invite": "members",
  breakdown: "settle",
  pay: "settle",
  note: "notes",
  "note-new": "notes",
  "note-edit": "notes",
  operation: "operations",
  "operation-new": "operations",
  "operation-edit": "operations",
  "announcement-new": "hub",
  profile: "settings",
};

export const SCREEN_PATH: Record<ScreenId, string> = {
  home: "/",
  "home-empty": "/home-empty",
  "home-inbox": "/inbox",
  communes: "/places",
  hub: "/hub",
  "hub-empty": "/hub-empty",
  expenses: "/expenses",
  "expenses-empty": "/expenses-empty",
  settle: "/settle",
  "settle-even": "/settle-even",
  recurring: "/recurring",
  funds: "/funds",
  templates: "/templates",
  members: "/members",
  operations: "/operations",
  notes: "/notes",
  activity: "/activity",
  "home-activity": "/activity/all",
  search: "/search",
  "commune-settings": "/commune-settings",
  settings: "/settings",
};

export const PATH_SCREEN: Record<string, ScreenId> = Object.fromEntries(
  Object.entries(SCREEN_PATH).map(([screen, path]) => [path, screen as ScreenId]),
) as Record<string, ScreenId>;

export type ExpenseRow = {
  id: string;
  amountMinor?: number;
  paidByUserId?: string;
  dueOn?: string | null;
  shares?: Array<{
    id: string;
    userId: string;
    amountMinor: number;
    settledMinor: number;
  }>;
  name: string;
  category: string;
  paidBy: string;
  due: string;
  status: "warn" | "open" | "settled";
  statusLabel: string;
  amount: string;
  action: "choose" | "mark-paid" | "none";
  open?: boolean;
  recurring?: boolean;
  split?: string;
};

export function isWindowId(id: string): id is WindowId {
  return (WINDOW_IDS as string[]).includes(id);
}

export type CreatedHub = {
  name: string;
  type: Hub["type"];
  currency: string;
  address?: string;
  destination?: string;
  stayName?: string;
  stayAddress?: string;
};

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  // No name, no letters: a neutral mark rather than someone else's initials.
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
