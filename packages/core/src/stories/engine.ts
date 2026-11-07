/**
 * How a story is chosen and how its maths is worked out. Pure functions over
 * the content in stories.ts, so they are tested on their own
 * (packages/core/tests/stories.test.ts) and every app words them alike.
 */
import { formatMoney } from "../format";
import { CAST, GENERAL_LINES, EXTRA, GROUPS, INVITES, LEAVE_OUT, STORIES, type CastId, type GroupKey, type Invite, type InviteKind, type Story } from "./stories";

export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** How someone arrived: from the App Store, an invitation, or a story link in an ad or on the website. */
export type Arrival = "store" | `invite-${InviteKind}` | `link-${string}`;

/** The moment the story is chosen for. */
export type Ctx = { hour: number; day: number; month: number; date: number; arrived: Arrival };

export function ctxFrom(now: Date, arrived: Arrival = "store"): Ctx {
  return { hour: now.getHours(), day: now.getDay(), month: now.getMonth(), date: now.getDate(), arrived };
}

function partOfDay(h: number): string {
  return h < 5 ? "late at night" : h < 12 ? "in the morning" : h < 17 ? "in the afternoon" : h < 21 ? "in the evening" : "at night";
}

/** How well a story fits the moment, and why. A seasonal story out of season scores 0. */
export function scoreStory(s: Story, ctx: Ctx, seen: string[] = []): { sc: number; why: string[] } {
  const w = s.when ?? {};
  const why: string[] = [];
  let sc = 1;
  if (s.season && !(w.months ?? []).includes(ctx.month)) return { sc: 0, why: [`only shows in ${MONTHS[w.months?.[0] ?? 0]}`] };
  if (w.months?.includes(ctx.month)) { sc += s.season ? 9 : 4; why.push(`it's ${MONTHS[ctx.month]}`); }
  if (w.dates?.includes(ctx.date)) { sc += 5; why.push(ctx.date <= 3 ? "it's the start of the month" : "it's the end of the month"); }
  const dayOk = !!w.days?.includes(ctx.day);
  const hourOk = !!w.hours?.includes(ctx.hour);
  if (dayOk && hourOk) { sc += 6; why.push(`it's ${DAYS[ctx.day]} ${partOfDay(ctx.hour)}`); }
  else if (dayOk && !w.hours) { sc += 3; why.push(`it's ${DAYS[ctx.day]}`); }
  else if (hourOk && !w.days) { sc += 2; why.push(`it's ${partOfDay(ctx.hour)}`); }
  else if (dayOk || hourOk) sc += 1;
  if (ctx.arrived.startsWith("invite-") && s.invite === ctx.arrived.slice(7)) {
    sc += 7; why.push(`they were invited to ${({ home: "a home", trip: "a trip", work: "a workspace" } as const)[s.invite]}`);
  }
  if (seen.includes(s.id)) { sc *= 0.05; why.push("already seen"); }
  return { sc, why };
}

type Rand = () => number;

function best(list: Array<{ s: Story; sc: number }>, rand: Rand): Story {
  const top = Math.max(...list.map((x) => x.sc));
  const tied = list.filter((x) => x.sc >= top - 0.001);
  return tied[Math.floor(rand() * tied.length)].s;
}

/** The story that best fits the moment, never one already seen while others are left. */
export function pickStory(ctx: Ctx, seen: string[] = [], rand: Rand = Math.random): Story {
  const scored = STORIES.map((s) => ({ s, ...scoreStory(s, ctx, seen) })).filter((x) => x.sc > 0);
  return best(scored, rand);
}

export const storyById = (id: string): Story | undefined => STORIES.find((s) => s.id === id);
export const groupOf = (id: string): GroupKey | undefined => (Object.keys(GROUPS) as GroupKey[]).find((g) => GROUPS[g].ids.includes(id));

/** The clock decides which answer gets "Right now", never the answer itself. */
export function clockGroup(ctx: Ctx): GroupKey {
  const sc = STORIES.map((s) => ({ s, ...scoreStory(s, ctx) })).filter((x) => x.sc > 0).sort((a, b) => b.sc - a.sc);
  const top = sc[0];
  return top && top.sc > 1 ? groupOf(top.s.id) ?? "home" : "home";
}

/** A story from the answer they picked, the one that fits the moment best. */
export function pickInGroup(g: GroupKey, ctx: Ctx, seen: string[] = [], rand: Rand = Math.random): Story {
  const pool = STORIES.filter((s) => GROUPS[g].ids.includes(s.id));
  const scored = pool.map((s) => ({ s, ...scoreStory(s, ctx, seen) })).filter((x) => x.sc > 0);
  return best(scored.length ? scored : pool.map((s) => ({ s, sc: 1 })), rand);
}

/** Where the person came from sets the first screen. */
export function startScreen(arrived: Arrival): "invited" | "intro" | "pick" {
  if (arrived.startsWith("invite-")) return "invited";
  if (arrived.startsWith("link-")) return "intro";
  return "pick";
}

export function inviteOf(arrived: Arrival): Invite | null {
  if (!arrived.startsWith("invite-")) return null;
  return INVITES[arrived.slice(7) as InviteKind] ?? INVITES.home;
}

/** Reads ?from= on a link into an arrival, or "store" for anything else. */
export function arrivalFrom(raw: string | undefined | null): Arrival {
  if (!raw) return "store";
  if (/^invite-(home|trip|work)$/.test(raw)) return raw as Arrival;
  if (raw.startsWith("link-") && storyById(raw.slice(5))) return raw as Arrival;
  return "store";
}

const CODES = { "£": "GBP", "€": "EUR" } as const;
export const currencyOf = (s: Story) => CODES[s.bill.cur ?? "£"];

/** £1,234.56 or €240.00: story money, written the way every screen writes money. */
export function storyMoney(minor: number, cur: "£" | "€" = "£"): string {
  return formatMoney(minor, CODES[cur]);
}

/** Bill names in a sentence: lower case, except Leo stays Leo. */
export const billInSentence = (n: string) => n.toLowerCase().replace("leo's", "Leo's");

/** Who is in the demo split: you, the payer, then up to four of the cast. */
export type Who = CastId | "you";
export function demoPeople(s: Story): Who[] {
  return ["you", s.bill.payer, ...s.cast.filter((k) => k !== s.bill.payer).slice(0, 4)];
}

/** The demo split: each share, and the pennies that don't divide (they stay with the payer). */
export function split(total: number, n: number): { each: number; rem: number } {
  const each = Math.floor(total / n);
  return { each, rem: total - each * n };
}

/** Who starts ticked in the demo split: the first five. */
export const demoSelected = (people: Who[]): boolean[] => people.map((_, i) => i < Math.min(people.length, 5));

/**
 * Tapping someone in the demo split. You and the payer always stay in, and
 * at least two people share the bill. Returns the new ticks, or the same
 * array when the tap changes nothing.
 */
export function toggleDemo(selected: boolean[], i: number): boolean[] {
  if (i <= 1) return selected;
  if (selected[i] && selected.filter(Boolean).length <= 2) return selected;
  return selected.map((on, k) => (k === i ? !on : on));
}

/** The demo split's words, as the prototype writes them. */
export function demoSplit(s: Story, selected: boolean[]): { title: string; lede: string; each: number; rem: number; n: number; line: string } {
  const cur = s.bill.cur ?? "£";
  const payer = CAST[s.bill.payer].n;
  const n = selected.filter(Boolean).length;
  const { each, rem } = split(s.bill.p, n);
  const owe = n - 1;
  const left = rem ? ` The ${cur === "£" ? `${rem}p` : storyMoney(rem, cur)} that doesn't divide stays with ${payer}.` : " It divides exactly.";
  return {
    title: `Split the ${billInSentence(s.bill.n)}.`,
    lede: `Your turn. ${payer} paid. Tap who was there.`,
    each, rem, n,
    line: `${n} people, so ${owe === 1 ? "1 person owes" : `${owe} of you owe`} ${payer} ${storyMoney(each, cur)}.${left}`,
  };
}

/** The card on an empty screen: "From the story you saw / Add your first bill". */
export function firstBillCard(s: Story): { label: string; title: string; line: string } {
  return {
    label: "From the story you saw",
    title: "Add your first bill",
    line: `${CAST[s.bill.payer].n} added ${billInSentence(s.bill.n)} and Commune split it in seconds. Yours works the same way.`,
  };
}

/** Under the sign-up form after the demo split. */
export const keepLine = (s: Story) =>
  `Keep the ${billInSentence(s.bill.n)} you just split. About a minute to set up, and your free week starts when you pick a plan.`;

/**
 * The four loading lines: one of the story's, one any commune could show,
 * another of the story's, then its signature line.
 */
export function loadingLines(s: Story, rand: Rand = Math.random): string[] {
  const own = shuffled(s.lines, rand);
  const general = shuffled(GENERAL_LINES, rand);
  return [own[0], general[0], own[1], s.sig];
}

export type WeekBill = { n: string; p: number; payer: Who; who: Who[]; mine?: boolean; each: number; rem: number; ious: Array<{ from: Who; to: Who; amt: number }> };
export type Week = {
  bills: WeekBill[]; keys: Who[];
  paid: Record<string, number>; share: Record<string, number>; net: Record<string, number>;
  pays: Array<{ from: Who; to: Who; amt: number }>;
  /** Every share paid bill by bill, before anything cancels out. */
  ious: number;
  mine: Array<{ from: Who; to: Who; amt: number }>;
};

/**
 * The story's whole week: the bill you split plus two more, each share as
 * its own payment, then paid minus shares per person and the fewest
 * payments that settle everything.
 */
export function computeWeek(s: Story, people: Who[], selected: boolean[]): Week {
  const first = { n: s.bill.n, p: s.bill.p, payer: s.bill.payer as Who, who: people.filter((_, i) => selected[i]), mine: true };
  const lo = LEAVE_OUT[s.id] ?? [];
  const extras = (EXTRA[s.id] ?? []).map((x) => ({ ...x, payer: x.payer as Who, who: people.filter((k) => !lo.includes(k as CastId)) }));
  const bills: WeekBill[] = [first, ...extras].map((x) => {
    const { each, rem } = split(x.p, x.who.length);
    return { ...x, each, rem, ious: x.who.filter((k) => k !== x.payer).map((k) => ({ from: k, to: x.payer, amt: each })) };
  });
  const paid: Record<string, number> = {};
  const share: Record<string, number> = {};
  people.forEach((k) => { paid[k] = 0; share[k] = 0; });
  bills.forEach((x) => {
    paid[x.payer] += x.p;
    x.who.forEach((k) => { share[k] += x.each + (k === x.payer ? x.rem : 0); });
  });
  const net: Record<string, number> = {};
  people.forEach((k) => { net[k] = paid[k] - share[k]; });
  // As few payments as possible: the biggest debt pays the biggest credit, You first on a tie.
  const debt = people.filter((k) => net[k] < 0).map((k) => ({ k, v: -net[k] }))
    .sort((a, c) => c.v - a.v || (a.k === "you" ? -1 : c.k === "you" ? 1 : 0));
  const cred = people.filter((k) => net[k] > 0).map((k) => ({ k, v: net[k] }))
    .sort((a, c) => c.v - a.v || (a.k === s.bill.payer ? -1 : c.k === s.bill.payer ? 1 : 0));
  const pays: Week["pays"] = [];
  let i = 0;
  let j = 0;
  while (i < debt.length && j < cred.length) {
    const m = Math.min(debt[i].v, cred[j].v);
    if (m > 0) pays.push({ from: debt[i].k, to: cred[j].k, amt: m });
    debt[i].v -= m; cred[j].v -= m;
    if (!debt[i].v) i++;
    if (!cred[j].v) j++;
  }
  const ious = bills.reduce((sum, x) => sum + x.ious.length, 0);
  return { bills, keys: people, paid, share, net, pays, ious, mine: pays.filter((p) => p.from === "you") };
}

export const nameOf = (k: Who) => (k === "you" ? "You" : CAST[k].n);
/** The name under a face: first names, except Jean Phil is "Jean P". */
export const shortFace = (k: Who) => (k === "you" ? "You" : CAST[k].n.split(" ")[0] + (k === "jp" ? " P" : ""));

/** Shuffles a copy, for loading lines. */
export function shuffled<T>(list: T[], rand: Rand = Math.random): T[] {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}

/** "7 Nov" and "14 November". */
export const shortDate = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
export const longDate = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
export const dayLine = (d: Date) => `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
