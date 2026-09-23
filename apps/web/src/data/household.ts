export type SampleHubId = "park" | "studio" | "lisbon";
// Live communes are UUIDs. The named IDs below are retained only for the
// historical design fixtures, never as authenticated application state.
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
  | "billing"
  | "analytics"
  | "members"
  | "operations"
  | "notes"
  | "activity"
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
  | "operation"
  | "operation-new"
  | "operation-edit";

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

export type Hub = {
  id: HubId;
  currency?: "GBP" | "USD" | "EUR";
  role?: "admin" | "member";
  name: string;
  type: "Household" | "Workspace" | "Trip";
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
  now: Array<{ go: ScreenId | WindowId; pill: string; tag: string; title: string; when: string }>;
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
  }>;
  notes: Array<{ go: "note"; note: string; title: string; when: string }>;
  jumps: Array<{ go: ScreenId | WindowId; kicker: string; title: string; hint: string }>;
};

export const HUBS: Record<SampleHubId, Hub> = {
  park: {
    id: "park",
    name: "14 Park Street",
    type: "Household",
    lede: "Rent, bills, and the Tuesday bins. One kitchen.",
    people: "Maya, Jordan, and Alex · since 2024",
    photo: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1600&q=80",
    switchMeta: "Household · 3 people",
    status: "August · you owe £42 · gas Friday · fund £420",
    youMeta: "Standard · 14 Park Street",
    avatars: [
      ["maya", "MC"],
      ["jordan", "JH"],
      ["alex", "AR"],
    ],
    oweLabel: "You owe",
    oweAmount: "£42.00",
    oweCopy: "Pay Jordan this week. Or net Tesco £18 and send £24.",
    oweCta: "Settle with Jordan",
    credit: false,
    kpis: [
      { go: "funds", tone: "peach", kicker: "House fund", num: "£420", hint: "£180 still from Alex" },
      { go: "analytics", tone: "lilac", kicker: "This month", num: "£2,140", hint: "of £2,400 · on track" },
      { go: "recurring", tone: "sage", kicker: "Open bills", num: "2", hint: "Gas + Virgin Media" },
      { go: "expenses", tone: "ink", kicker: "Next due", num: "Fri", hint: "British Gas · 29 Aug" },
    ],
    now: [
      { go: "expenses", pill: "warn", tag: "Friday", title: "British Gas", when: "£94.20 · Jordan paid · your share open" },
      { go: "operations", pill: "warn", tag: "Overdue", title: "Bins", when: "Still Jordan’s Tuesday" },
      { go: "funds", pill: "open", tag: "Collect", title: "Alex · house fund", when: "£180 still to pay in" },
    ],
    moves: [
      { go: "settle", arrow: "→", names: "You → Jordan", why: "Gas share · or £24 if you net Tesco", amt: "£42", expenseId: "park-british-gas" },
      { go: "settle", arrow: "→", names: "Jordan → You", why: "Tesco extras from Monday", amt: "£18", expenseId: "park-tesco-shop" },
      { go: "members", arrow: "↔", names: "Alex ↔ You", why: "Even on expenses · still £180 for the fund", amt: "£0", even: true },
    ],
    members: [
      { cls: "maya", ini: "MC", name: "Maya Chen", meta: "You · Admin", bal: "Owe £42" },
      { cls: "jordan", ini: "JH", name: "Jordan Hale", meta: "Bins this week", bal: "Owes you £18", nudge: true },
      { cls: "alex", ini: "AR", name: "Alex Rivera", meta: "Fund still due", bal: "Even", muted: true },
    ],
    activity: [
      { go: "expenses", cls: "maya", ini: "MC", title: "Virgin Media", when: "Maya logged it", time: "Yesterday" },
      { go: "expenses", cls: "jordan", ini: "JH", title: "British Gas", when: "Jordan paid the bill", time: "Tue" },
      { go: "expenses", cls: "alex", ini: "AR", title: "Tesco", when: "Alex settled", time: "Mon" },
      { go: "funds", cls: "maya", ini: "MC", title: "August rent", when: "House fund covered it", time: "1 Aug" },
    ],
    notes: [
      { go: "note", note: "wifi", title: "Wi-Fi", when: "ParkStreet_5G · password in notes" },
      { go: "note", note: "bins", title: "Bins", when: "Black bags Tuesday · recycling Friday" },
      { go: "note", note: "landlord", title: "Landlord", when: "Priya Sharma · rent via the fund" },
    ],
    jumps: [
      { go: "expenses", kicker: "Expenses", title: "Virgin still open", hint: "This cycle’s ledger" },
      { go: "recurring", kicker: "Recurring", title: "Gas Friday", hint: "Virgin on the 12th too" },
      { go: "funds", kicker: "Funds", title: "Chase Alex £180", hint: "House fund is £420" },
      { go: "settle", kicker: "Settle", title: "Pay Jordan £42", hint: "Or net Tesco and send £24" },
      { go: "notes", kicker: "Notes", title: "Wi-Fi and landlord", hint: "The old chat pin" },
      { go: "operations", kicker: "Operations", title: "Bins overdue", hint: "Still Jordan’s Tuesday" },
    ],
  },
  studio: {
    id: "studio",
    name: "Studio East",
    type: "Workspace",
    lede: "Desks, the printer, and whoever grabbed the keys.",
    people: "Maya, Priya, and Sam · since 2023",
    photo: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80",
    switchMeta: "Workspace · 3 people",
    status: "August · even · ink Monday · pot £90",
    youMeta: "Standard · Studio East",
    avatars: [
      ["maya", "MC"],
      ["priya", "PS"],
      ["sam", "SO"],
    ],
    oweLabel: "You’re even",
    oweAmount: "£0.00",
    oweCopy: "Printer ink is due Monday. Nobody owes anyone this cycle.",
    oweCta: "Log the ink",
    credit: false,
    kpis: [
      { go: "funds", tone: "peach", kicker: "Studio pot", num: "£90", hint: "Ink run not yet logged" },
      { go: "analytics", tone: "lilac", kicker: "This month", num: "£240", hint: "Wifi + paper + coffee" },
      { go: "recurring", tone: "sage", kicker: "Open bills", num: "1", hint: "Printer ink · Monday" },
      { go: "expenses", tone: "ink", kicker: "Next due", num: "Mon", hint: "Ink · Sam’s run" },
    ],
    now: [
      { go: "recurring", pill: "warn", tag: "Monday", title: "Printer ink", when: "Sam’s run · split three ways" },
      { go: "operations", pill: "open", tag: "Keys", title: "Desk keys", when: "Still with Sam from Thursday" },
      { go: "recurring", pill: "open", tag: "Soon", title: "Guest wifi", when: "Renews 4 Sept" },
    ],
    moves: [
      { go: "members", arrow: "↔", names: "Priya ↔ You", why: "Even this cycle", amt: "£0", even: true },
      { go: "members", arrow: "↔", names: "Sam ↔ You", why: "Even · ink not logged yet", amt: "£0", even: true },
    ],
    members: [
      { cls: "maya", ini: "MC", name: "Maya Chen", meta: "You · Admin", bal: "Even", muted: true },
      { cls: "priya", ini: "PS", name: "Priya Shah", meta: "Desk this week", bal: "Even", muted: true },
      { cls: "sam", ini: "SO", name: "Sam Okonkwo", meta: "Ink run Monday", bal: "Even", muted: true },
    ],
    activity: [
      { go: "expenses", cls: "priya", ini: "PS", title: "A4 paper", when: "Priya logged it", time: "Wed" },
      { go: "operations", cls: "sam", ini: "SO", title: "Keys", when: "Sam took the set", time: "Thu" },
      { go: "expenses", cls: "maya", ini: "MC", title: "Wifi", when: "You marked paid", time: "1 Aug" },
    ],
    notes: [
      { go: "note", note: "door", title: "Door", when: "Code 4821 · last lockup is Sam" },
      { go: "note", note: "printer", title: "Printer", when: "Downstairs · ink due Monday" },
      { go: "note", note: "guest", title: "Guest wifi", when: "StudioEast_Guest · password in notes" },
    ],
    jumps: [
      { go: "expenses", kicker: "Expenses", title: "Paper and wifi", hint: "Studio ledger this month" },
      { go: "recurring", kicker: "Recurring", title: "Ink Monday", hint: "Split three ways" },
      { go: "funds", kicker: "Funds", title: "Studio pot £90", hint: "Ink comes out of here" },
      { go: "settle", kicker: "Settle", title: "Nothing to settle", hint: "You’re even this cycle" },
      { go: "notes", kicker: "Notes", title: "Door code 4821", hint: "Printer and guest wifi" },
      { go: "operations", kicker: "Operations", title: "Keys with Sam", hint: "From Thursday" },
    ],
  },
  lisbon: {
    id: "lisbon",
    name: "Lisbon · Sept",
    type: "Trip",
    lede: "Airbnb in Chiado, dinner splits, and the Thursday hold.",
    people: "Maya, Jordan, and Ness · Sept 2026",
    photo: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=1600&q=80",
    switchMeta: "Trip · 3 people",
    status: "Sept · you’re owed £64 · hold Thursday",
    youMeta: "Standard · Lisbon · Sept",
    avatars: [
      ["maya", "MC"],
      ["jordan", "JH"],
      ["ness", "NC"],
    ],
    oweLabel: "You’re owed",
    oweAmount: "£64.00",
    oweCopy: "Jordan and Ness still owe you for the Airbnb hold.",
    oweCta: "Collect £64",
    credit: true,
    kpis: [
      { go: "funds", tone: "peach", kicker: "Trip pot", num: "£380", hint: "Hold already paid by you" },
      { go: "analytics", tone: "lilac", kicker: "Spent", num: "£210", hint: "Dinners + metro" },
      { go: "recurring", tone: "sage", kicker: "Open", num: "1", hint: "Airbnb hold Thursday" },
      { go: "expenses", tone: "ink", kicker: "Next", num: "Thu", hint: "Hold expires in 4 days" },
    ],
    now: [
      { go: "expenses", pill: "warn", tag: "Thursday", title: "Airbnb hold", when: "Expires in 4 days · you paid" },
      { go: "settle", pill: "open", tag: "Collect", title: "Jordan · Airbnb", when: "£40 still to pay you" },
      { go: "settle", pill: "open", tag: "Collect", title: "Ness · Airbnb", when: "£24 still to pay you" },
    ],
    moves: [
      { go: "settle", arrow: "→", names: "Jordan → You", why: "Share of the Airbnb hold", amt: "£40", expenseId: "lisbon-airbnb-hold" },
      { go: "settle", arrow: "→", names: "Ness → You", why: "Share of the Airbnb hold", amt: "£24", expenseId: "lisbon-airbnb-hold" },
    ],
    members: [
      { cls: "maya", ini: "MC", name: "Maya Chen", meta: "You · booked the flat", bal: "Owed £64" },
      { cls: "jordan", ini: "JH", name: "Jordan Hale", meta: "Airbnb share", bal: "Owes £40", nudge: true },
      { cls: "ness", ini: "NC", name: "Ness Cole", meta: "Dinner tonight", bal: "Owes £24" },
    ],
    activity: [
      { go: "expenses", cls: "maya", ini: "MC", title: "Airbnb hold", when: "You paid the deposit", time: "Sat" },
      { go: "expenses", cls: "jordan", ini: "JH", title: "Metro cards", when: "Jordan logged three", time: "Sun" },
      { go: "expenses", cls: "ness", ini: "NC", title: "Cervejaria", when: "Ness paid dinner", time: "Sun" },
    ],
    notes: [
      { go: "note", note: "airbnb", title: "Airbnb", when: "Chiado · check-in 15:00 · code in notes" },
      { go: "note", note: "dinner", title: "Dinner", when: "Cervejaria Trindade · Ness has the table" },
      { go: "note", note: "airport", title: "Airport", when: "Thursday 09:40 · Uber from the flat" },
    ],
    jumps: [
      { go: "expenses", kicker: "Expenses", title: "Airbnb + dinners", hint: "Trip ledger so far" },
      { go: "recurring", kicker: "Recurring", title: "Hold Thursday", hint: "Expires in 4 days" },
      { go: "funds", kicker: "Funds", title: "Trip pot £380", hint: "Hold already left it" },
      { go: "settle", kicker: "Settle", title: "Collect £64", hint: "Jordan £40 · Ness £24" },
      { go: "notes", kicker: "Notes", title: "Chiado check-in", hint: "Dinner and the airport" },
      { go: "operations", kicker: "Operations", title: "Thursday flight", hint: "Uber from the flat" },
    ],
  },
};

export type NoteCard = {
  title: string;
  pill: string;
  kicker: string;
  lede: string;
  body: string;
  facts: Array<[string, string]>;
};

export const NOTE_CARDS: Record<string, NoteCard> = {
  wifi: {
    title: "Wi-Fi",
    pill: "Wi-Fi",
    kicker: "Pinned · everyone",
    lede: "ParkStreet_5G",
    body: "The house network. Guest wifi is a separate note if people ask.",
    facts: [
      ["Network", "ParkStreet_5G"],
      ["Password", "park14sage"],
      ["Who can see", "Everyone"],
    ],
  },
  bins: {
    title: "Bins",
    pill: "Bins",
    kicker: "Pinned · everyone",
    lede: "Tuesday and Friday",
    body: "Don’t leave them blocking the kitchen door. Jordan’s week lives on Operations.",
    facts: [
      ["Black bags", "Tuesday night"],
      ["Recycling", "Friday morning"],
      ["Where", "Alley behind the kitchen"],
    ],
  },
  landlord: {
    title: "Landlord",
    pill: "Landlord",
    kicker: "Admins",
    lede: "Priya Sharma",
    body: "Rent leaves the house fund on the 1st. Text Priya if the boiler dies.",
    facts: [
      ["Phone", "07700 900 441"],
      ["Email", "priya@sharma.rent"],
      ["Who can see", "Admins"],
    ],
  },
  door: {
    title: "Door",
    pill: "Keys / door",
    kicker: "Pinned · everyone",
    lede: "Code 4821",
    body: "Last lockup is whoever leaves last. Spare sits with Sam this week.",
    facts: [
      ["Door code", "4821"],
      ["Last lockup", "Sam"],
      ["Who can see", "Everyone"],
    ],
  },
  printer: {
    title: "Printer",
    pill: "Other",
    kicker: "Pinned · everyone",
    lede: "Downstairs",
    body: "Ink is due Monday. It comes out of the studio pot.",
    facts: [
      ["Where", "Downstairs, next to the paper"],
      ["Ink", "Monday · Sam’s run"],
    ],
  },
  guest: {
    title: "Guest wifi",
    pill: "Wi-Fi",
    kicker: "Pinned · everyone",
    lede: "StudioEast_Guest",
    body: "Give this to clients. House wifi stays on the staff note.",
    facts: [
      ["Network", "StudioEast_Guest"],
      ["Password", "eastguest24"],
      ["Who can see", "Everyone"],
    ],
  },
  airbnb: {
    title: "Airbnb",
    pill: "Keys / door",
    kicker: "Pinned · everyone",
    lede: "Chiado · check-in 15:00",
    body: "Key box on the left of the tiled door. Host is Ana.",
    facts: [
      ["Address", "Rua Garrett 22, Chiado"],
      ["Door code", "1590"],
      ["Check-in", "15:00"],
    ],
  },
  dinner: {
    title: "Dinner",
    pill: "Other",
    kicker: "Everyone",
    lede: "Cervejaria Trindade",
    body: "Ness has the table. Split it on the trip ledger after.",
    facts: [
      ["Where", "Cervejaria Trindade"],
      ["Who booked", "Ness"],
    ],
  },
  airport: {
    title: "Airport",
    pill: "Other",
    kicker: "Everyone",
    lede: "Thursday 09:40",
    body: "Uber from the flat at 07:15. Bags in the hall the night before.",
    facts: [
      ["Flight", "Thursday 09:40"],
      ["Pickup", "Uber from the flat · 07:15"],
    ],
  },
};

export const NOTE_BODY_HINT: Record<string, string> = {
  wifi: "Network name and anything guests need to know.",
  bins: "Which bags, which day, where they go.",
  keys: "Who has the spare, last lockup, anything that bites.",
  landlord: "How rent leaves, what to say when something breaks.",
  emergency: "Who to call when the boiler dies at 11pm.",
  rules: "Quiet hours, shoes, guests — the old chat pin.",
  other: "Whatever the house needs to remember.",
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
  billing: "Billing",
  analytics: "Analytics",
  breakdown: "Breakdown",
  members: "Members",
  operations: "Operations",
  operation: "Schedule item",
  "operation-new": "Add to calendar",
  "operation-edit": "Edit schedule item",
  notes: "Notes",
  note: "Note",
  "note-new": "Add note",
  activity: "Activity",
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
  recurring: "Expenses that repeat.",
  funds: "Pledges and recorded contributions.",
  templates: "Shared split preferences.",
  billing: "Plan and billing details.",
  analytics: "Activity from your shared ledger.",
  breakdown: "The ledger view of who owes whom.",
  members: "Balances for this cycle, not personalities.",
  operations: "What’s late, what’s yours, then the week.",
  operation: "The date, owner, and details in one place.",
  "operation-new": "A task to finish, or something everyone should know is happening.",
  "operation-edit": "Change the time, the owner, or take it off the calendar.",
  notes: "Wi-Fi, bin day, landlord. Add what the house keeps forgetting.",
  note: "Pinned · everyone",
  "note-new": "Type first. Extras change. The note itself stays so you can keep writing.",
  activity: "The log, without the group chat.",
  notices: "Updates sent to you in Commune.",
  "add-expense": "Choose the members and check the split.",
  "member-invite": "Create a secure link for this commune.",
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
  "operation",
  "operation-new",
  "operation-edit",
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
  operation: "operations",
  "operation-new": "operations",
  "operation-edit": "operations",
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
  billing: "/billing",
  analytics: "/analytics",
  members: "/members",
  operations: "/operations",
  notes: "/notes",
  activity: "/activity",
  settings: "/settings",
};

export const PATH_SCREEN: Record<string, ScreenId> = Object.fromEntries(
  Object.entries(SCREEN_PATH).map(([screen, path]) => [path, screen as ScreenId]),
) as Record<string, ScreenId>;

export const HOME_STATUS = "3 spaces · you owe £42 · you’re owed £64";

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

export const PARK_EXPENSES: ExpenseRow[] = [
  {
    id: "park-british-gas",
    name: "British Gas",
    category: "Utilities",
    paidBy: "Jordan Hale",
    due: "29 Aug",
    status: "warn",
    statusLabel: "Due Friday",
    amount: "£94.20",
    action: "choose",
    open: true,
    recurring: true,
  },
  {
    id: "park-virgin-media",
    name: "Virgin Media",
    category: "Internet",
    paidBy: "Maya Chen",
    due: "12 Aug",
    status: "open",
    statusLabel: "Open",
    amount: "£32.00",
    action: "mark-paid",
    open: true,
    recurring: true,
  },
  {
    id: "park-tesco-shop",
    name: "Tesco shop",
    category: "Groceries",
    paidBy: "Alex Rivera",
    due: "18 Aug",
    status: "settled",
    statusLabel: "Settled",
    amount: "£67.40",
    action: "none",
  },
  {
    id: "park-rent-august",
    name: "Rent · August",
    category: "Rent",
    paidBy: "House fund",
    due: "1 Aug",
    status: "settled",
    statusLabel: "Settled",
    amount: "£1,800.00",
    action: "none",
    recurring: true,
  },
  {
    id: "park-council-tax",
    name: "Council tax",
    category: "Bills",
    paidBy: "Maya Chen",
    due: "1 Aug",
    status: "settled",
    statusLabel: "Settled",
    amount: "£146.00",
    action: "none",
    recurring: true,
  },
];

export const STUDIO_EXPENSES: ExpenseRow[] = [
  {
    id: "studio-a4-paper",
    name: "A4 paper",
    category: "Supplies",
    paidBy: "Priya Shah",
    due: "Wednesday",
    status: "settled",
    statusLabel: "Settled",
    amount: "—",
    action: "none",
  },
  {
    id: "studio-wifi",
    name: "Wifi",
    category: "Internet",
    paidBy: "Maya Chen",
    due: "1 Aug",
    status: "settled",
    statusLabel: "Settled",
    amount: "—",
    action: "none",
    recurring: true,
  },
];

export const LISBON_EXPENSES: ExpenseRow[] = [
  {
    id: "lisbon-airbnb-hold",
    name: "Airbnb hold",
    category: "Stay",
    paidBy: "Maya Chen",
    due: "Thursday",
    status: "open",
    statusLabel: "Collect £64",
    amount: "£64 owed",
    action: "choose",
    open: true,
  },
  {
    id: "lisbon-metro-cards",
    name: "Metro cards",
    category: "Travel",
    paidBy: "Jordan Hale",
    due: "Sunday",
    status: "settled",
    statusLabel: "Settled",
    amount: "—",
    action: "none",
  },
  {
    id: "lisbon-cervejaria",
    name: "Cervejaria",
    category: "Dinner",
    paidBy: "Ness Cole",
    due: "Sunday",
    status: "settled",
    statusLabel: "Settled",
    amount: "—",
    action: "none",
  },
];

export const HUB_EXPENSES: Record<SampleHubId, ExpenseRow[]> = {
  park: PARK_EXPENSES,
  studio: STUDIO_EXPENSES,
  lisbon: LISBON_EXPENSES,
};

export function isWindowId(id: string): id is WindowId {
  return (WINDOW_IDS as string[]).includes(id);
}

export function isScreenId(id: string): id is ScreenId {
  return id in SCREEN_PATH;
}

export type CreatedHub = {
  name: string;
  type: Hub["type"];
  currency: string;
};

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "MC";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function heroClass(hub: Hub): "park" | "studio" | "lisbon" {
  if (hub.id === "studio" || hub.type === "Workspace") return "studio";
  if (hub.id === "lisbon" || hub.type === "Trip") return "lisbon";
  return "park";
}

export function buildCreatedHub(opts: {
  name: string;
  type: Hub["type"];
  ownerName: string;
  currency?: string;
  expenses?: ExpenseRow[];
}): Hub {
  const ini = initialsOf(opts.ownerName);
  const name = opts.name.trim() || "New commune";
  const expenses = opts.expenses ?? [];
  const firstExpense = expenses[0];
  const openExpenses = expenses.filter((expense) => expense.open === true);
  const currency =
    firstExpense?.amount.match(/[£$€]/)?.[0] ??
    opts.currency?.match(/[£$€]/)?.[0] ??
    "£";
  const total = expenses.reduce((sum, expense) => {
    const value = Number.parseFloat(expense.amount.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
  const totalLabel = expenses.length ? `${currency}${total.toFixed(2)}` : `${currency}0`;
  const countLabel = `${expenses.length} shared ${expenses.length === 1 ? "item" : "items"}`;
  const photo =
    opts.type === "Workspace" ? HUBS.studio.photo : opts.type === "Trip" ? HUBS.lisbon.photo : HUBS.park.photo;
  return {
    id: "created",
    name,
    type: opts.type,
    lede: firstExpense
      ? `${countLabel} ${expenses.length === 1 ? "is" : "are"} on the ledger.`
      : "No bills yet. Add the first one so the house has a truth.",
    people: `${opts.ownerName} · just you so far`,
    photo,
    switchMeta: `${opts.type} · 1 person`,
    status: firstExpense
      ? `${countLabel} · ${totalLabel} · ${openExpenses.length} open`
      : "No bills yet",
    youMeta: `Standard · ${name}`,
    avatars: [["maya", ini]],
    oweLabel: "You’re even",
    oweAmount: `${currency}0.00`,
    oweCopy: firstExpense
      ? `${countLabel}. Nobody else is on this hub yet, so there is nothing to settle.`
      : "Nothing shared this cycle.",
    oweCta: firstExpense ? "Open expenses" : "Add expense",
    credit: false,
    kpis: [
      { go: "funds", tone: "peach", kicker: "Fund", num: `${currency}0`, hint: "Nothing in yet" },
      {
        go: "analytics",
        tone: "lilac",
        kicker: "This month",
        num: totalLabel,
        hint: firstExpense ? countLabel : "No spend yet",
      },
      {
        go: "recurring",
        tone: "sage",
        kicker: "Open bills",
        num: String(openExpenses.length),
        hint: openExpenses[0]?.name ?? (firstExpense ? "Everything settled" : "Add the first"),
      },
      {
        go: "expenses",
        tone: "ink",
        kicker: "Next due",
        num: openExpenses[0]?.due ?? "—",
        hint: openExpenses[0]?.name ?? "Ledger is clear",
      },
    ],
    now: openExpenses.slice(0, 4).map((expense) => ({
      go: "expenses",
      pill: "open",
      tag: "Open",
      title: expense.name,
      when: `${expense.amount} · ${expense.paidBy}`,
    })),
    moves: [],
    members: [{ cls: "maya", ini, name: opts.ownerName, meta: "You · Admin", bal: "Even", muted: true }],
    activity: expenses.map((expense) => ({
      go: "expenses",
      cls: "maya",
      ini,
      title: expense.name,
      when: `${expense.paidBy} logged it`,
      time: "This session",
    })),
    notes: [],
    jumps: [
      firstExpense
        ? { go: "expenses", kicker: "Expenses", title: countLabel, hint: `${totalLabel} total` }
        : { go: "add-expense", kicker: "Expenses", title: "Add the first bill", hint: "Start the ledger" },
      { go: "notes", kicker: "Notes", title: "Wi-Fi, bins, keys", hint: "Write it down" },
      { go: "members", kicker: "Members", title: "Invite someone", hint: "A house needs people" },
      { go: "settle", kicker: "Settle", title: "Nothing to settle", hint: "You’re even" },
    ],
  };
}
