export const APP = "https://app.ourcommune.io";
export const SIGNUP = `${APP}/signup`;
export const SUPPORT = "mailto:support@ourcommune.io";

export const NAV = [
  { href: "#why", label: "Why" },
  { href: "#spaces", label: "Spaces" },
  { href: "#pricing", label: "Pricing" },
] as const;

export const WHY = [
  {
    n: "01",
    t: "Communal finance that stays true",
    d: "Recurring bills, fair splits, reimbursements, and one monthly picture every member can trust.",
  },
  {
    n: "02",
    t: "A hub for the house, not a spreadsheet",
    d: "Members, roles, pinned notices, and the practical details that usually live in chat.",
  },
  {
    n: "03",
    t: "Responsibilities with an owner",
    d: "Who does what, what needs approval, and what is overdue — before it becomes awkward.",
  },
  {
    n: "04",
    t: "One command centre, many spaces",
    d: "Home, studio, trip. Switch in a second. See what you owe across all of them.",
  },
] as const;

export const SPACES = [
  { id: "home", label: "House shares", sub: "Rent, bills, chores", img: "photo/kitchen.png" },
  { id: "couple", label: "Couples", sub: "Joint expenses, budgets", img: "photo/couple.png" },
  { id: "studio", label: "Studios & offices", sub: "Shared costs, tools, roles", img: "photo/studio.png" },
  { id: "trip", label: "Group trips", sub: "Log on the go, settle before you land", img: "photo/trip.png" },
] as const;

export const PLANS = [
  {
    name: "Standard",
    price: "£4.99",
    featured: false,
    items: ["1 space", "Up to 8 members", "Communal finance & splits", "Responsibilities & reminders", "Monthly breakdown", "Group hub"],
  },
  {
    name: "Pro",
    price: "£9.99",
    featured: true,
    items: ["Up to 3 spaces", "Up to 15 members", "Everything in Standard", "Advanced analytics", "Exports & templates", "Priority support"],
  },
  {
    name: "Agency",
    price: "£29.99",
    featured: false,
    items: ["Unlimited spaces", "Unlimited members", "Everything in Pro", "Priority workflows", "Dedicated onboarding", "Operator-ready path"],
  },
] as const;

export const STEPS = [
  { n: "1", t: "Create your space", d: "A hub for a home, studio, trip, or project — ready in a minute." },
  { n: "2", t: "Add your people", d: "Invite members, set roles, and give everyone the right view." },
  { n: "3", t: "Track and settle", d: "Log costs, assign work, read the month, settle fairly." },
] as const;

export function asset(path: string): string {
  const base = import.meta.env.BASE_URL ?? "/";
  return `${base}${path.replace(/^\//, "")}`;
}
