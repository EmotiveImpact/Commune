import { useState, type CSSProperties, type ReactNode } from "react";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { formatDay } from "@commune/core";
import { useApp } from "../state";
import { Avatar } from "../ui/widgets";
import { CalendarDate } from "../ui/CalendarDate";
import { compareNeeds, money, type CurrencyCode, type LiveHub, type Need } from "../live/model";
import { cx } from "../ui/cx";
import { CoverImage, coverToneClass } from "../ui/CoverImage";
import { activityStamp, activityWord } from "../ui/ActivityLog";
import { useReceiptActions } from "../ui/Receipts";
import { addDays, dateFromIso, todayIso } from "../data/operations";
import "./Home.css";

// Home opens on where you stand, then the one thing to do next, then your
// communes in order of need, then everything that needs you by when. The
// approved direction is "B" in the design panel of 11 October 2026.

type Entry = { hub: LiveHub; item: Need };
type Tone = "late" | "attention" | "plain";

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
/** "two communes", "one person", "12 days": small counts in words, as a sentence says them. */
function count(n: number, one: string, many = `${one}s`): string {
  return `${n < WORDS.length ? WORDS[n] : n} ${n === 1 ? one : many}`;
}
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
/** "A", "A and B", "A, B and C". */
function joined<T extends ReactNode>(parts: T[]): ReactNode[] {
  return parts.flatMap((part, index) => index === 0 ? [part] : [index === parts.length - 1 ? " and " : ", ", part]);
}
/** Whole days from one calendar date to another, whatever the clocks did in between. */
function daysBetween(from: string, to: string): number {
  const [a, b] = [dateFromIso(from), dateFromIso(to)];
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
}
/** One amount per currency, never added across currencies, in the order the communes come. */
function perCurrency(amounts: Array<[CurrencyCode, number]>): string[] {
  const totals = new Map<CurrencyCode, number>();
  for (const [currency, minor] of amounts) if (minor > 0) totals.set(currency, (totals.get(currency) ?? 0) + minor);
  return [...totals].map(([currency, minor]) => money(minor, currency));
}

const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short" });
const longDate = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });

/** When something is due, in words, and how much it matters. Waiting on others is never red. */
function dueState(dueOn: string | undefined, today: string, waiting = false): { text: string; tone: Tone } | null {
  if (!dueOn) return null;
  const days = daysBetween(dueOn, today);
  if (days > 0) return { text: `${days} ${days === 1 ? "day" : "days"} ${waiting ? "past due" : "overdue"}`, tone: waiting ? "attention" : "late" };
  if (days === 0) return { text: "Due today", tone: "attention" };
  if (days === -1) return { text: "Due tomorrow", tone: "plain" };
  if (days > -7) return { text: `Due ${weekday.format(dateFromIso(dueOn))}`, tone: "plain" };
  return { text: `Due ${formatDay(dueOn, today)}`, tone: "plain" };
}

function State({ text, tone }: { text: string; tone: Tone }) {
  return <span className={cx("c-home-state", `is-${tone}`)}>{text}</span>;
}

// A payment someone says they sent waits on the viewer now, whenever the bill was due.
const GROUPS = ["To confirm", "Overdue", "Today", "This week", "Later", "No due date"] as const;
function groupOf({ kind, dueOn }: Need, today: string): (typeof GROUPS)[number] {
  if (kind === "confirm") return "To confirm";
  if (!dueOn) return "No due date";
  if (dueOn < today) return "Overdue";
  if (dueOn === today) return "Today";
  return dueOn <= addDays(today, 6) ? "This week" : "Later";
}

/** Who and what, without the date, which the row shows on its own. */
function detail(item: Need): string {
  return capital(item.when.replace(/ · overdue$/, "").replace(/^Overdue · /, ""));
}
/** Late on the viewer's side: a payment to confirm is waiting on the viewer, not overdue from them. */
const lateForYou = (item: Need) => item.late && item.kind !== "confirm";

function memberOf(hub: LiveHub, userId: string | undefined) {
  return hub.members.find((member) => member.userId === userId);
}
function nameOf(hub: LiveHub, userId: string | undefined, fallback = "a former member"): string {
  return memberOf(hub, userId)?.name ?? fallback;
}

function Faces({ hub, ids, size, max = 4 }: { hub: LiveHub; ids: string[]; size?: "sm"; max?: number }) {
  const people = ids.map((id) => memberOf(hub, id)).filter((member) => member !== undefined).slice(0, max);
  if (!people.length) return null;
  return (
    <span className={cx("c-home-faces", size === "sm" && "is-sm")} aria-hidden="true">
      {people.map((member) => <Avatar key={member.userId} tone={member.cls} initials={member.ini} decorative />)}
    </span>
  );
}

function Place({ hub }: { hub: LiveHub }) {
  return (
    <span className="c-home-place">
      <i className={coverToneClass(hub)}><CoverImage hub={hub} placement="thumb" /></i>
      {hub.name}
    </span>
  );
}

function useOpen() {
  const { go } = useApp();
  return ({ hub, item }: Entry) => item.go === "funds"
    ? go("funds", { hub: hub.id, record: item.fundId ? { kind: "fund", id: item.fundId } : undefined })
    : go(item.go, { hub: hub.id, expense: item.expenseId, operation: item.operationId });
}

/** The opening sentence: what you owe and are owed, per currency, never summed. */
function Standing({ places, needs, waiting, today, name }: {
  places: LiveHub[]; needs: Entry[]; waiting: Entry[]; today: string; name: string;
}) {
  const ready = places.filter((hub) => hub.activityState === "ready").sort((a, b) => needRank(a) - needRank(b));
  const owe = perCurrency(ready.map((hub) => [hub.currency, hub.youOweMinor]));
  const owed = perCurrency(ready.map((hub) => [hub.currency, hub.owedToYouMinor]));
  const owing = ready.filter((hub) => hub.youOweMinor > 0);
  const owedIn = ready.filter((hub) => hub.owedToYouMinor > 0);
  const people = new Set(ready.flatMap((hub) => hub.owingYou)).size;
  const late = needs.filter(({ item }) => lateForYou(item) && item.dueOn);
  const oldest = late.reduce((most, { item }) => Math.max(most, daysBetween(item.dueOn!, today)), 0);
  const lateLine = late.length === 1
    ? `${late[0].item.title} is ${count(oldest, "day")} overdue.`
    : late.length > 1 ? `${capital(count(late.length, "thing"))} are overdue, the oldest ${count(oldest, "day")}.` : "";
  const where = (list: LiveHub[]) => list.length === 1 ? `in ${list[0].name}` : `across ${count(list.length, "commune")}`;
  const amounts = (list: string[]) => joined(list.map((amount) => <em key={amount}>{amount}</em>));
  const loading = places.length - ready.length;
  const unavailable = places.some((hub) => hub.activityState === "error");
  const partial = !loading ? "" : unavailable
    ? "Some communes could not be loaded. Open one to try again."
    : `Still loading ${count(loading, "commune")}.`;

  let sentence: ReactNode;
  let lines: string[];
  if (!ready.length) {
    sentence = null;
    lines = [];
  } else if (owe.length) {
    sentence = <>You owe {amounts(owe)} {where(owing)}.</>;
    lines = [owed.length ? `You’re owed ${owed.join(" and ")}.` : "", lateLine];
  } else if (owed.length) {
    sentence = <>You’re owed {amounts(owed)}.</>;
    lines = [`You owe nothing. ${capital(count(people, "person", "people"))} still ${people === 1 ? "owes" : "owe"} you ${where(owedIn)}.`, lateLine];
  } else {
    sentence = <>You’re all square{name ? `, ${name}` : ""}.</>;
    const communes = places.length === 1 ? places[0].name : `your ${count(places.length, "commune")}`;
    lines = [needs.length || waiting.length ? `Nothing owed either way in ${communes}.` : `Nothing owed and nothing waiting in ${communes}.`, lateLine];
  }
  const sub = [...lines, partial].filter(Boolean).join(" ");
  return (
    <div className="c-home-standing">
      <p className="c-home-over">{longDate.format(dateFromIso(today))}</p>
      {sentence ? <h2 className="c-home-display">{sentence}</h2> : <h2 className="c-visually-hidden">Where you stand</h2>}
      {sub || !ready.length ? <p className="c-home-sub" role={ready.length ? undefined : "status"}>{sub || "Loading your communes…"}</p> : null}
    </div>
  );
}

/** The first thing that needs you, with the only filled button on the page. */
function NextStep({ entry, total, onAct, busy }: { entry: Entry; total: number; onAct: (entry: Entry, decline?: boolean) => void; busy: boolean }) {
  const { hub, item } = entry;
  const today = todayIso();
  // The bill's due date says nothing about a payment waiting to be confirmed.
  const state = item.kind === "confirm" ? null : dueState(item.dueOn, today);
  const person = memberOf(hub, item.person);
  const first = firstName(nameOf(hub, item.person, "them"));
  const action = item.kind === "pay" ? `I’ve paid ${first} ${item.amount}`
    : item.kind === "confirm" ? `Confirm ${item.amount} received`
      : item.kind === "task" ? "Open the task" : "Open the fund";
  const note = item.kind === "pay" ? `Pay ${first} however you usually do, then record it here. ${first} confirms it.`
    : item.kind === "confirm" ? `Only once it has reached you. ${first} is told either way.` : "";
  return (
    <article className="c-home-next" aria-labelledby="home-next-title">
      <div className="c-home-next-top"><span>Your next step</span>{total > 1 ? <span>1 of {total}</span> : null}</div>
      <div className="c-home-next-body">
        <span className="c-home-who">
          {person
            ? <Avatar tone={person.cls} initials={person.ini} decorative />
            : <i className={cx("c-home-who-place", coverToneClass(hub))}><CoverImage hub={hub} placement="thumb" /></i>}
          {person ? <i className={cx("c-home-who-badge", coverToneClass(hub))}><CoverImage hub={hub} placement="thumb" /></i> : null}
        </span>
        <div className="c-home-next-copy">
          <h3 id="home-next-title">{item.title}</h3>
          <p>{hub.name} · {detail(item)}</p>
          {state ? <State {...state} /> : null}
        </div>
        {item.amount ? <strong className="c-home-next-amount">{item.amount}</strong> : null}
      </div>
      <div className="c-home-next-foot">
        <button className="c-home-btn is-primary is-large" type="button" disabled={busy} onClick={() => onAct(entry)}>{action}</button>
        {item.kind === "confirm"
          ? <button className="c-home-btn is-secondary is-large" type="button" disabled={busy} onClick={() => onAct(entry, true)}>Not received</button>
          : null}
        {note ? <span className="c-home-note">{note}</span> : null}
      </div>
    </article>
  );
}

/** Nothing needs you: say so, and point at anything others are late with. */
function Calm({ waiting, today }: { waiting: Entry[]; today: string }) {
  const open = useOpen();
  const late = waiting.find(({ item }) => item.kind === "owed" && item.late);
  const people = late ? joined((late.item.people ?? []).map((id) => firstName(nameOf(late.hub, id, "a former member")))) : [];
  const days = late?.item.dueOn ? daysBetween(late.item.dueOn, today) : 0;
  return (
    <article className="c-home-next is-calm" aria-labelledby="home-calm-title">
      <div className="c-home-next-body">
        <span className="c-home-calm" aria-hidden="true"><Check size={20} strokeWidth={1.8} /></span>
        <div className="c-home-next-copy">
          <h3 id="home-calm-title">Nothing needs you</h3>
          <p>{late
            ? <>{late.item.title} is {count(days, "day")} past due. {people} can see it, and you can nudge them from the expense.</>
            : "You’re up to date in every commune."}</p>
        </div>
      </div>
      {late ? (
        <div className="c-home-next-foot">
          <button className="c-home-btn is-secondary" type="button" onClick={() => open(late)}>Open {late.item.title}</button>
        </div>
      ) : null}
    </article>
  );
}

/** How a commune stands for the viewer, in a line and a state. */
function communeLine(hub: LiveHub): { line: ReactNode; extra?: ReactNode; state?: { text: string; tone: Tone }; square?: boolean } {
  if (hub.activityState !== "ready") return { line: hub.status };
  const late = hub.now.filter(lateForYou).length;
  const earliest = (items: Need[]) => items.map((item) => item.dueOn).filter((day): day is string => Boolean(day)).sort()[0];
  if (hub.youOweMinor > 0) {
    const due = earliest(hub.now.filter((item) => item.kind === "pay"));
    return {
      line: <b>You owe {money(hub.youOweMinor, hub.currency)}</b>,
      extra: hub.owedToYouMinor > 0 ? <> · owed {money(hub.owedToYouMinor, hub.currency)}</> : null,
      state: late ? { text: late === 1 ? "Overdue" : `${late} overdue`, tone: "late" } : due ? dueState(due, todayIso()) ?? undefined : undefined,
    };
  }
  const pastDue = hub.waiting.filter((item) => item.kind === "owed" && item.late).length;
  if (hub.owedToYouMinor > 0) {
    const due = earliest(hub.waiting.filter((item) => item.kind === "owed"));
    return {
      line: <b>Owed {money(hub.owedToYouMinor, hub.currency)}</b>,
      extra: <> by {count(hub.owingYou.length, "person", "people")}</>,
      state: late ? { text: late === 1 ? "Overdue" : `${late} overdue`, tone: "late" }
        : pastDue ? { text: pastDue === 1 ? "Past due" : `${pastDue} past due`, tone: "attention" }
          : due ? dueState(due, todayIso(), true) ?? undefined : undefined,
    };
  }
  if (hub.now.length) {
    return { line: "Nothing owed either way", state: late ? { text: late === 1 ? "Overdue" : `${late} overdue`, tone: "late" } : { text: `${hub.now.length} to do`, tone: "attention" } };
  }
  return { line: "Nothing owed either way", square: true };
}

/** Communes that need you most come first; the order is otherwise yours. */
function needRank(hub: LiveHub): number {
  if (hub.activityState !== "ready") return 5;
  if (hub.now.some(lateForYou)) return 0;
  if (hub.now.length) return 1;
  if (hub.waiting.some((item) => item.kind === "owed" && item.late)) return 2;
  return hub.owedToYouMinor > 0 ? 3 : 4;
}

/** A commune's card. Its name is a heading holding the button, which covers the whole card. */
function CommuneCard({ hub, current }: { hub: LiveHub; current: boolean }) {
  const { go } = useApp();
  const { line, extra, state, square } = communeLine(hub);
  const ids = hub.members.map((member) => member.userId);
  return (
    <li className="c-home-commune">
      <span className={cx("c-home-commune-photo", coverToneClass(hub))}>
        <CoverImage hub={hub} placement="commune" />
        {current ? <span className="c-home-tag">Current</span> : null}
      </span>
      <span className="c-home-commune-copy">
        <h3 className="c-home-commune-name"><button type="button" onClick={() => go("hub", { hub: hub.id })}>{hub.name}</button></h3>
        <span className="c-home-commune-line">{line}{extra ? <span className="c-home-commune-extra">{extra}</span> : null}</span>
        <span className="c-home-commune-state">
          <Faces hub={hub} ids={ids} size="sm" />
          {state ? <State {...state} /> : null}
          {square ? <span className="c-home-badge"><Check size={13} strokeWidth={2.2} aria-hidden="true" />All square</span> : null}
        </span>
      </span>
      <span className="c-home-commune-go" aria-hidden="true"><ChevronRight size={16} strokeWidth={1.6} /></span>
    </li>
  );
}

/** A row in Needs you or Waiting on others. The title opens the record; the button acts on it. */
function Row({ entry, today, waiting = false, onAct, busy, className }: {
  entry: Entry; today: string; waiting?: boolean; onAct?: (entry: Entry) => void; busy?: boolean; className?: string;
}) {
  const open = useOpen();
  const { hub, item } = entry;
  const state = item.kind === "confirm" ? null : dueState(item.dueOn, today, waiting);
  const who = item.kind === "owed" ? item.people ?? [] : item.person ? [item.person] : [];
  const verb = item.kind === "pay" ? "I’ve paid" : item.kind === "confirm" ? "Confirm" : "Open";
  const context = item.kind === "pay" ? `${nameOf(hub, item.person)} for ${item.title}` : item.kind === "confirm" ? `${item.amount} from ${nameOf(hub, item.person)}` : item.title;
  return (
    <li className={cx("c-home-row", waiting && "is-waiting", className)}>
      <span className="c-home-row-lead">
        {(waiting || item.kind === "confirm") && who.length
          ? <Faces hub={hub} ids={who} max={3} />
          : item.dueOn ? <CalendarDate date={item.dueOn} today={today} label="Due" /> : <span className="c-home-nodate">No date</span>}
      </span>
      <span className="c-home-row-main">
        <button className="c-home-row-title" type="button" onClick={() => open(entry)}>{item.title}</button>
        <span className="c-home-row-meta"><Place hub={hub} /><span aria-hidden="true">·</span><span>{detail(item)}</span></span>
      </span>
      <span className="c-home-row-fig">
        {item.amount ? <strong>{item.amount}</strong> : null}
        {state ? <State {...state} /> : null}
      </span>
      {onAct ? (
        <span className="c-home-row-act">
          <button className="c-home-btn is-secondary is-small" type="button" disabled={busy}
            onClick={() => item.kind === "pay" || item.kind === "confirm" ? onAct(entry) : open(entry)}>
            {verb} <span className="c-visually-hidden">{context}</span>
          </button>
        </span>
      ) : null}
    </li>
  );
}

// A long list shows its first five, and a phone its first two; a short one
// shows everything. Every row is drawn, so the limit is the screen's.
const SHOWN = 5;
const COLLAPSE_OVER = 7;
const PHONE_SHOWN = 2;
const PHONE_COLLAPSE_OVER = 3;

function NeedsList({ needs, today, onAct, busy }: { needs: Entry[]; today: string; onAct: (entry: Entry) => void; busy: boolean }) {
  const [all, setAll] = useState(false);
  const collapsible = needs.length > COLLAPSE_OVER;
  const phoneCollapsible = needs.length > PHONE_COLLAPSE_OVER;
  const limit = collapsible ? SHOWN : Infinity;
  const phoneLimit = phoneCollapsible ? PHONE_SHOWN : Infinity;
  let shown = 0;
  const groups = GROUPS.map((name) => {
    const first = shown;
    const rows = needs.filter(({ item }) => groupOf(item, today) === name);
    shown += rows.length;
    return { name, first, rows };
  }).filter((group) => group.rows.length);
  // Past the limit on every screen, past it on a phone, or never.
  const extra = (index: number) => cx(index >= limit && "is-extra", index >= phoneLimit && "is-extra-phone");
  return (
    <section className={cx("c-home-panel", "c-home-needs", all && "is-all")} aria-labelledby="home-needs">
      <div className="c-home-head"><h2 id="home-needs">Needs you</h2><span className="c-home-count">{needs.length}</span></div>
      {groups.map((group) => (
        <div key={group.name} className={cx("c-home-group", extra(group.first))}>
          <h3 className={cx(group.name === "Overdue" && "is-late")}>{group.name} <span>{group.rows.length}</span></h3>
          <ul>{group.rows.map((entry, index) => (
            <Row key={`${entry.hub.id}-${entry.item.kind}-${entry.item.title}-${index}`} entry={entry} today={today} onAct={onAct} busy={busy}
              className={extra(group.first + index) || undefined} />
          ))}</ul>
        </div>
      ))}
      {phoneCollapsible ? (
        <button className={cx("c-home-more", !collapsible && "is-phone")} type="button" aria-expanded={all} onClick={() => setAll((value) => !value)}>
          {all ? "Show fewer" : <>
            {collapsible ? <span className="c-home-more-wide">Show {needs.length - SHOWN} more</span> : null}
            <span className="c-home-more-phone">Show {needs.length - PHONE_SHOWN} more</span>
          </>}
          <ChevronDown size={15} strokeWidth={1.6} aria-hidden="true" className={cx(all && "is-open")} />
        </button>
      ) : null}
    </section>
  );
}

function WaitingList({ waiting, today }: { waiting: Entry[]; today: string }) {
  const total = perCurrency(waiting.filter(({ item }) => item.kind === "owed").map(({ hub, item }) => [hub.currency, item.minor ?? 0]));
  return (
    <section className="c-home-panel" aria-labelledby="home-waiting">
      <div className="c-home-head">
        <h2 id="home-waiting">Waiting on others</h2><span className="c-home-count">{waiting.length}</span>
        {total.length ? <span className="c-home-head-note">{total.join(" · ")}</span> : null}
      </div>
      <ul>{waiting.map((entry, index) => <Row key={`${entry.hub.id}-${entry.item.kind}-${entry.item.title}-${index}`} entry={entry} today={today} waiting />)}</ul>
    </section>
  );
}

function Activity({ places }: { places: LiveHub[] }) {
  const { go } = useApp();
  const activity = places.flatMap((hub) => hub.activity.map((item) => ({ hub, item })))
    .sort((a, b) => (Date.parse(b.item.createdAt ?? "") || 0) - (Date.parse(a.item.createdAt ?? "") || 0)).slice(0, 5);
  const incomplete = places.some((hub) => hub.activityState !== "ready");
  return (
    <section className="c-home-panel" aria-labelledby="home-activity">
      <div className="c-home-head">
        <h2 id="home-activity">Recent activity</h2>
        <button className="c-home-link" type="button" onClick={() => go("home-activity")}>All activity</button>
      </div>
      {activity.length ? (
        <ul className="c-home-feed">
          {activity.map(({ hub, item }, index) => (
            <li key={`${hub.id}-${item.title}-${index}`}>
              <Avatar tone={item.cls} initials={item.ini} decorative />
              <button type="button" onClick={() => go(item.expenseId ? "expense" : item.go, { hub: hub.id, expense: item.expenseId })}>
                <b>{item.title}</b>
                {/* "Joined the commune · Maya Chen" under "Maya Chen" names her once. */}
                <span>{[hub.name, activityWord(item.type), item.when.endsWith(` · ${item.title}`) ? item.when.slice(0, -` · ${item.title}`.length) : item.when].filter(Boolean).join(" · ")}</span>
              </button>
              <time>{activityStamp(item)}</time>
            </li>
          ))}
        </ul>
      ) : <p className="c-home-empty">{incomplete ? "Still loading activity from your communes…" : "Activity will appear after something is shared."}</p>}
    </section>
  );
}

/** All square and nothing to do: the current commune's photo, as a reward. */
function SquareBand({ hub, places, name, today }: { hub: LiveHub; places: LiveHub[]; name: string; today: string }) {
  const { you } = useApp();
  const people = new Map<string, LiveHub["members"][number]>();
  for (const place of places) for (const member of place.members) if (!people.has(member.userId)) people.set(member.userId, member);
  const others = [...people.values()].filter((member) => member.userId !== you.id);
  const names = joined(["You", ...others.slice(0, 3).map((member) => firstName(member.name))]);
  const communes = places.length === 1 ? places[0].name : `your ${count(places.length, "commune")}`;
  return (
    <section className={cx("c-home-square", coverToneClass(hub))} aria-labelledby="home-square">
      <CoverImage hub={hub} placement="hero" />
      <div className="c-home-square-copy">
        <p className="c-home-over">{longDate.format(dateFromIso(today))}</p>
        <h2 id="home-square" className="c-home-display">You’re all square{name ? `, ${name}` : ""}.</h2>
        <p className="c-home-sub">Nothing owed and nothing waiting in {communes}.</p>
        <p className="c-home-square-people">
          <span className="c-home-faces" aria-hidden="true">
            {[...people.values()].slice(0, 4).map((member) => <Avatar key={member.userId} tone={member.cls} initials={member.ini} decorative />)}
          </span>
          <span>{names}{others.length > 3 ? ` and ${count(others.length - 3, "other")}` : ""}</span>
        </p>
      </div>
    </section>
  );
}

export function HomeScreen() {
  const { places, hubId, you } = useApp();
  const [message, setMessage] = useState("");
  const receipts = useReceiptActions(setMessage);
  const open = useOpen();
  if (!places.length) return <HomeEmptyScreen />;
  const today = todayIso();
  const name = firstName(you.name);
  // The same rule as This Hub, across every commune: actions in their order, then what others owe.
  const needs = places.flatMap((hub) => hub.now.map((item) => ({ hub, item }))).sort((a, b) => compareNeeds(a.item, b.item));
  const waiting = places.flatMap((hub) => hub.waiting.map((item) => ({ hub, item }))).sort((a, b) => compareNeeds(a.item, b.item));
  const [next, ...rest] = needs;
  const current = places.find((place) => place.id === hubId) ?? places[0];
  const communes = places.map((hub, index) => ({ hub, index })).sort((a, b) => needRank(a.hub) - needRank(b.hub) || a.index - b.index).map(({ hub }) => hub);
  const ready = places.every((hub) => hub.activityState === "ready");
  const square = ready && !needs.length && !waiting.length && places.every((hub) => !hub.youOweMinor && !hub.owedToYouMinor);

  function act(entry: Entry, decline = false) {
    const { hub, item } = entry;
    setMessage("");
    if (item.kind === "pay" && item.shareId && item.minor) {
      receipts.report({ shareId: item.shareId, payerName: nameOf(hub, item.person, "the bill payer"), expenseName: item.title,
        outstandingMinor: item.minor, currency: hub.currency, communeId: hub.id });
    } else if (item.kind === "confirm" && item.report) {
      receipts.answer({ report: item.report, debtorName: nameOf(hub, item.person, "a former member"), expenseName: item.title,
        currency: hub.currency, decision: decline ? "decline" : "confirm", communeId: hub.id });
    } else {
      open(entry);
    }
  }

  const communeList = (
    <section className="c-home-communes" aria-labelledby="home-communes">
      <div className="c-home-head">
        <h2 id="home-communes">Your communes</h2><span className="c-home-count">{places.length}</span>
      </div>
      <ul className={cx("c-home-commune-list", places.length > 1 && "is-tiles")} style={{ "--home-tiles": Math.min(places.length, 3) } as CSSProperties}>
        {communes.map((hub) => <CommuneCard key={hub.id} hub={hub} current={places.length > 1 && hub.id === current.id} />)}
      </ul>
    </section>
  );
  const status = message ? <p className="c-home-message" role="status">{message}</p> : null;

  if (square) {
    return (
      <div className="c-home is-square">
        <SquareBand hub={current} places={places} name={name} today={today} />
        {status}
        <div className="c-home-split">
          <div className="c-home-col"><Activity places={places} /></div>
          <div className="c-home-col">{communeList}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="c-home">
      <div className="c-home-split c-home-lead">
        <div className="c-home-col c-home-top">
          <Standing places={places} needs={needs} waiting={waiting} today={today} name={name} />
          {next ? <NextStep entry={next} total={needs.length} onAct={act} busy={receipts.busy} /> : ready ? <Calm waiting={waiting} today={today} /> : null}
          {status}
        </div>
        <div className="c-home-col">{communeList}</div>
      </div>
      <div className="c-home-split">
        <div className="c-home-col">
          {rest.length ? <NeedsList needs={rest} today={today} onAct={act} busy={receipts.busy} /> : null}
          {!rest.length && waiting.length ? <WaitingList waiting={waiting} today={today} /> : null}
          {!rest.length && !waiting.length ? <Activity places={places} /> : null}
        </div>
        <div className="c-home-col">
          {rest.length && waiting.length ? <WaitingList waiting={waiting} today={today} /> : null}
          {rest.length || waiting.length ? <Activity places={places} /> : null}
        </div>
      </div>
      {receipts.dialogs}
    </div>
  );
}

function PhotoFace({ hub, children }: { hub: LiveHub; children: ReactNode }) {
  return (
    <div className={cx("a-place-hero", coverToneClass(hub))}>
      <CoverImage hub={hub} placement="card" />
      {children}
    </div>
  );
}

function PlaceCard({ hub }: { hub: LiveHub }) {
  const { go } = useApp();
  const balance = hub.oweAmount.replace(/\.00\b/, "");
  const hasBalance = hub.moves.some((move) => !move.even);
  const ready = hub.activityState === "ready";
  const memberCount = ready ? hub.members.length : hub.memberCount;
  return (
    <button className="a-place" type="button" onClick={() => go("hub", { hub: hub.id })}>
      <PhotoFace hub={hub}>
        <span className="type">{hub.type}{memberCount == null ? "" : ` · ${memberCount} ${memberCount === 1 ? "person" : "people"}`}</span>
        {/* The cards sit straight under the page title, so each name is an h2. */}
        <h2>{hub.name}</h2>
        {(hub.type === "Trip" ? hub.destination : hub.address) ? <p className="a-place-location">{hub.type === "Trip" ? hub.destination : hub.address}</p> : null}
        <p>{hub.status}</p>
      </PhotoFace>
      <div className="a-place-foot">
        <span>{ready ? hasBalance ? hub.oweLabel : "Even" : hub.activityState === "error" ? "Balance unavailable" : "Loading balance…"}</span>
        <span className={cx("amt", hub.credit && "credit", !hasBalance && "even")}>{ready ? balance : "-"}</span>
      </div>
    </button>
  );
}

export function PlacesScreen() {
  const { go, places } = useApp();
  if (!places.length) return <HomeEmptyScreen />;
  return (
    <>
      <div className="a-toolbar"><button className="a-btn" type="button" onClick={() => go("commune-new")}>New commune</button></div>
      <div className="a-place-grid">{places.map((hub) => <PlaceCard key={hub.id} hub={hub} />)}</div>
    </>
  );
}

export function HomeEmptyScreen() {
  const { go } = useApp();
  return (
    <div className="a-empty">
      <h2>No communes yet.</h2>
      <p>Create a household, workspace or trip, or open an invitation link from someone else.</p>
      <div className="a-field-row">
        <button className="a-btn" type="button" onClick={() => go("onboard")}>Create a commune</button>
      </div>
    </div>
  );
}
