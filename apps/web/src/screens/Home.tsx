import type { ReactNode } from "react";
import { useApp } from "../state";
import { Avatar, Pill } from "../ui/widgets";
import { heroClass, type Hub } from "../data/household";
import { dateFromIso, todayIso, type OperationItem } from "../data/operations";
import { cx } from "../ui/cx";

function PhotoFace({
  photo,
  variant,
  className,
  children,
}: {
  photo: string;
  variant: "place" | "focus";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(variant === "focus" ? "a-focus-hero" : "a-place-hero", photo && "has-photo", className)}
      style={photo ? { ["--place-photo" as string]: `url("${photo}")` } : undefined}
    >
      {children}
    </div>
  );
}

const operationDay = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "short",
});

function nextBins(items: OperationItem[]): OperationItem | undefined {
  return items
    .filter((item) => item.title === "Put the bins out" && item.status === "open")
    .sort((a, b) => a.date.localeCompare(b.date))[0];
}

function binsStatus(item: OperationItem | undefined) {
  if (!item) {
    return {
      hero: "Bins are done.",
      short: "bins done",
      title: "Bins done",
      when: "Nothing waiting",
    };
  }
  const overdue = item.date < todayIso();
  const date = operationDay.format(dateFromIso(item.date));
  const firstName = item.assignee?.split(" ")[0] ?? "Unassigned";
  return {
    hero: overdue ? `Bins are still ${firstName}’s.` : `Bins are with ${firstName} on ${date}.`,
    short: overdue ? "bins overdue" : `bins ${date}`,
    title: overdue ? "Bins overdue" : `Bins · ${date}`,
    when: overdue ? `Still ${firstName}’s · ${date}` : `${firstName} · ${date}`,
  };
}

function compactMoney(value: string | undefined): string {
  return (value ?? "£0").replace(/\.00\b/, "");
}

function hasOpenMoves(hub: Hub | undefined): boolean {
  return Boolean(hub?.moves.some((move) => !move.even));
}

function balanceCopy(hub: Hub | undefined): string {
  if (!hub) return "You’re even";
  return hasOpenMoves(hub)
    ? `${hub.oweLabel} ${compactMoney(hub.oweAmount)}`
    : hub.oweLabel;
}

function createdCardMeta(hub: Hub): { total: string; open: string } {
  const total = hub.kpis.find((kpi) => kpi.kicker === "This month")?.num ?? "£0";
  const openCount = hub.kpis.find((kpi) => kpi.kicker === "Open bills")?.num ?? "0";
  const openNumber = Number.parseInt(openCount, 10) || 0;
  return {
    total,
    open:
      hub.status === "No bills yet"
        ? "Just you so far"
        : openNumber > 0
          ? `${openNumber} open`
          : "Ledger settled",
  };
}

export function HomeScreen() {
  const { session } = useApp();
  if (!session?.hasHubs) return <HomeEmptyScreen />;
  if (session.seed === "new") return <HomeFreshScreen />;
  return <HomeWeekScreen />;
}

function HomeWeekScreen() {
  const { go, places, operationsByHub } = useApp();
  const park = places.find((hub) => hub.id === "park");
  const studio = places.find((hub) => hub.id === "studio");
  const lisbon = places.find((hub) => hub.id === "lisbon");
  const extra = places.find((hub) => hub.id === "created");
  const bins = nextBins(operationsByHub.park);
  const binsCopy = binsStatus(bins);
  const parkNeedsPay = Boolean(park?.moves.some((move) => move.names.startsWith("You →")));
  const studioNeedsSettlement = hasOpenMoves(studio);
  const lisbonNeedsCollecting = Boolean(lisbon?.moves.length);
  const extraMeta = extra ? createdCardMeta(extra) : null;
  return (
    <>
      <button className="a-place a-focus-lead" type="button" onClick={() => go("hub", { hub: "park" })}>
        <PhotoFace photo={park?.photo ?? ""} variant="focus">
          <span className="type">Needs you · Household</span>
          <h2>14 Park Street</h2>
          <p>{park?.oweCopy} {binsCopy.hero} Alex hasn’t paid into the fund.</p>
          <div className="a-cover-people">
            <div className="avatar-stack">
              <Avatar tone="maya" initials="MC" />
              <Avatar tone="jordan" initials="JH" />
              <Avatar tone="alex" initials="AR" />
            </div>
            Open this hub
          </div>
        </PhotoFace>
        <div className="a-place-foot">
          <span>{parkNeedsPay ? "Gas Friday" : "Gas settled"} · {binsCopy.short}</span>
          <span className={cx("amt", park?.credit && "credit")}>{compactMoney(park?.oweAmount)}</span>
        </div>
      </button>

      <div className="a-focus-pair">
        <button className="a-place" type="button" onClick={() => go("hub", { hub: "studio" })}>
          <PhotoFace photo={studio?.photo ?? ""} variant="place" className="studio">
            <span className="type">{studioNeedsSettlement ? studio?.oweLabel : "Quiet"}</span>
            <h3>Studio East</h3>
            <p>{balanceCopy(studio)}</p>
          </PhotoFace>
          <div className="a-place-foot">
            <span>{studioNeedsSettlement ? "Open shared expenses" : "Printer ink Monday"}</span>
            <span className={cx("amt", studioNeedsSettlement ? studio?.credit && "credit" : "even")}>
              {compactMoney(studio?.oweAmount)}
            </span>
          </div>
        </button>
        <button className="a-place" type="button" onClick={() => go("hub", { hub: "lisbon" })}>
          <PhotoFace photo={lisbon?.photo ?? ""} variant="place" className="lisbon">
            <span className="type">{lisbonNeedsCollecting ? "You’re owed" : "Settled"}</span>
            <h3>Lisbon · Sept</h3>
            <p>{lisbon?.oweLabel} {compactMoney(lisbon?.oweAmount)}</p>
          </PhotoFace>
          <div className="a-place-foot">
            <span>{lisbonNeedsCollecting ? "Airbnb hold Thursday" : "Airbnb settled"}</span>
            <span className={cx("amt", lisbonNeedsCollecting ? "credit" : "even")}>
              {lisbonNeedsCollecting ? "+" : ""}{compactMoney(lisbon?.oweAmount)}
            </span>
          </div>
        </button>
      </div>

      {extra ? (
        <button
          className="a-place"
          type="button"
          onClick={() => go("hub", { hub: "created" })}
          style={{ marginTop: 12 }}
        >
          <PhotoFace photo={extra.photo} variant="place" className={heroClass(extra)}>
            <span className="type">{extra.type}</span>
            <h3>{extra.name}</h3>
            <p>{extra.status}</p>
          </PhotoFace>
          <div className="a-place-foot">
            <span>{extraMeta?.open}</span>
            <span className={cx("amt", extra.status === "No bills yet" && "even")}>
              {extraMeta?.total}
            </span>
          </div>
        </button>
      ) : null}

      <div className="a-home-greet is-after">
        <h1>{parkNeedsPay ? "Park Street needs you this week." : "Park Street’s money is calmer."}</h1>
        <p>{studioNeedsSettlement ? `${balanceCopy(studio)} at Studio.` : "Studio is even."} {lisbonNeedsCollecting ? `Lisbon still owes you ${compactMoney(lisbon?.oweAmount)}.` : "Lisbon is settled."}</p>
      </div>

      <div className="a-week">
        <div className="a-card">
          <h2>Needs you</h2>
          <p className="sub">The three that should happen. Jump in, or open the hub.</p>
          <div className="hub-feed">
            <button
              className="hub-feed-row"
              type="button"
              onClick={() => bins && go("operation", { hub: "park", operation: bins.id })}
            >
              <Pill tone="warn">Park Street</Pill>
              <div>
                <strong>{binsCopy.title}</strong>
                <div className="when">{binsCopy.when}</div>
              </div>
              <span className="hub-feed-go">Operations</span>
            </button>
            {parkNeedsPay ? (
              <>
                <button className="hub-feed-row" type="button" onClick={() => go("settle", { hub: "park" })}>
                  <Pill tone="sage">Park Street</Pill>
                  <div>
                    <strong>Pay Jordan £42</strong>
                    <div className="when">Gas share · or £24 if you net Tesco</div>
                  </div>
                  <span className="hub-feed-go">Settle</span>
                </button>
                <button className="hub-feed-row" type="button" onClick={() => go("expenses", { hub: "park" })}>
                  <Pill tone="warn">Park Street</Pill>
                  <div>
                    <strong>British Gas Friday</strong>
                    <div className="when">£94.20 · Jordan paid · your share open</div>
                  </div>
                  <span className="hub-feed-go">Expenses</span>
                </button>
              </>
            ) : (
              <button className="hub-feed-row" type="button" onClick={() => go("settle", { hub: "park" })}>
                <Pill tone="open">Park Street</Pill>
                <div>
                  <strong>Collect £18 from Jordan</strong>
                  <div className="when">British Gas is paid · Tesco extras remain</div>
                </div>
                <span className="hub-feed-go">Settle</span>
              </button>
            )}
          </div>
        </div>

        <div className="a-card">
          <div className="a-card-head">
            <div>
              <h2>This week</h2>
              <p className="sub">Already happened, across the three.</p>
            </div>
            <button className="a-btn ghost" type="button" onClick={() => go("activity")}>
              Activity
            </button>
          </div>
          <button className="a-item" type="button" onClick={() => go("expenses", { hub: "park" })}>
            <Avatar tone="jordan" initials="JH" />
            <div>
              <strong>British Gas</strong>
              <div className="when">Park Street · Jordan paid the bill</div>
            </div>
            <span className="when">Tue</span>
          </button>
          <button className="a-item" type="button" onClick={() => go("expenses", { hub: "park" })}>
            <Avatar tone="maya" initials="MC" />
            <div>
              <strong>Virgin Media</strong>
              <div className="when">Park Street · Maya logged it</div>
            </div>
            <span className="when">Yesterday</span>
          </button>
          <button className="a-item" type="button" onClick={() => go("hub", { hub: "lisbon" })}>
            <Avatar tone="maya" initials="MC" />
            <div>
              <strong>Airbnb hold</strong>
              <div className="when">Lisbon · {lisbonNeedsCollecting ? "your card, still collecting" : "Airbnb shares settled"}</div>
            </div>
            <span className="when">Thu</span>
          </button>
        </div>
      </div>
    </>
  );
}

function HomeFreshScreen() {
  const { go, places, you, createdExpenses } = useApp();
  const hub = places[0];
  const hasExpenses = createdExpenses.length > 0;
  const expenseCount = `${createdExpenses.length} shared ${createdExpenses.length === 1 ? "item" : "items"}`;
  if (!hub) return <HomeEmptyScreen />;
  const hubMeta = createdCardMeta(hub);
  return (
    <>
      <button className="a-place a-focus-lead" type="button" onClick={() => go("hub", { hub: "created" })}>
        <PhotoFace photo={hub.photo} variant="focus" className={heroClass(hub)}>
          <span className="type">New · {hub.type}</span>
          <h2>{hub.name}</h2>
          <p>
            {hasExpenses
              ? hub.status
              : "No bills yet. Add the first one so the house has a truth."}
          </p>
          <div className="a-cover-people">
            <div className="avatar-stack">
              <Avatar tone="maya" initials={you.initials} />
            </div>
            Open this hub
          </div>
        </PhotoFace>
        <div className="a-place-foot">
          <span>{hubMeta.open}</span>
          <span className={cx("amt", !hasExpenses && "even")}>{hubMeta.total}</span>
        </div>
      </button>
      <div className="a-home-greet is-after">
        <h1>{hub.name} is ready.</h1>
        <p>{hasExpenses ? `${expenseCount} in the ledger.` : "Home stays quiet until something is shared."}</p>
      </div>
      <div className="a-card">
        <h2>Needs you</h2>
        <p className="sub">
          {hasExpenses
            ? `${expenseCount} will still be here after a refresh.`
            : "Nothing yet. The first bill is how the house starts telling the truth."}
        </p>
        <div className="a-field-row">
          <button
            className="a-btn"
            type="button"
            onClick={() =>
              hasExpenses
                ? go("expenses", { hub: "created" })
                : go("add-expense", { hub: "created" })
            }
          >
            {hasExpenses ? "Open expenses" : "Add expense"}
          </button>
        </div>
      </div>
    </>
  );
}

export function PlacesScreen() {
  const { go, places, session, operationsByHub, createdExpenses } = useApp();
  if (!session?.hasHubs) {
    return (
      <div className="a-empty">
        <h2>No communes yet.</h2>
        <p>Create one, or join from an invite.</p>
        <div className="a-field-row">
          <button className="a-btn" type="button" onClick={() => go("onboard")}>
            Create a hub
          </button>
          <button className="a-btn ghost" type="button" onClick={() => go("invite")}>
            I have an invite
          </button>
        </div>
      </div>
    );
  }

  if (session.seed === "new") {
    const hub = places[0];
    const hubMeta = hub ? createdCardMeta(hub) : null;
    return (
      <>
        <div className="a-toolbar">
          <button className="a-btn" type="button" onClick={() => go("commune-new")}>
            New commune
          </button>
        </div>
        {hub ? (
          <div className="a-place-grid">
            <button className="a-place" type="button" onClick={() => go("hub", { hub: "created" })}>
              <PhotoFace photo={hub.photo} variant="place" className={heroClass(hub)}>
                <span className="type">{hub.type}</span>
                <h3>{hub.name}</h3>
                <p>{createdExpenses.length ? hub.status : "No bills yet"}</p>
              </PhotoFace>
              <div className="a-place-foot">
                <span>{hubMeta?.open}</span>
                <span className={cx("amt", !createdExpenses.length && "even")}>
                  {hubMeta?.total}
                </span>
              </div>
            </button>
          </div>
        ) : null}
      </>
    );
  }

  const park = places.find((hub) => hub.id === "park");
  const studio = places.find((hub) => hub.id === "studio");
  const lisbon = places.find((hub) => hub.id === "lisbon");
  const extra = places.find((hub) => hub.id === "created");
  const bins = nextBins(operationsByHub.park);
  const binsCopy = binsStatus(bins);
  const parkNeedsPay = Boolean(park?.moves.some((move) => move.names.startsWith("You →")));
  const studioNeedsSettlement = hasOpenMoves(studio);
  const lisbonNeedsCollecting = Boolean(lisbon?.moves.length);
  const extraMeta = extra ? createdCardMeta(extra) : null;

  return (
    <>
      <div className="a-toolbar">
        <button className="a-btn" type="button" onClick={() => go("commune-new")}>
          New commune
        </button>
      </div>
      <div className="a-place-grid">
        <button className="a-place" type="button" onClick={() => go("hub", { hub: "park" })}>
          <PhotoFace photo={park?.photo ?? ""} variant="place" className="park">
            <span className="type">Household</span>
            <h3>14 Park Street</h3>
            <p>{park?.oweLabel} {compactMoney(park?.oweAmount)}</p>
          </PhotoFace>
          <div className="a-place-foot">
            <span>{parkNeedsPay ? "Gas Friday" : "Gas settled"} · {binsCopy.short}</span>
            <span className={cx("amt", park?.credit && "credit")}>{compactMoney(park?.oweAmount)}</span>
          </div>
        </button>
        <button className="a-place" type="button" onClick={() => go("hub", { hub: "studio" })}>
          <PhotoFace photo={studio?.photo ?? ""} variant="place" className="studio">
            <span className="type">{studioNeedsSettlement ? studio?.oweLabel : "Workspace"}</span>
            <h3>Studio East</h3>
            <p>{balanceCopy(studio)}</p>
          </PhotoFace>
          <div className="a-place-foot">
            <span>{studioNeedsSettlement ? "Open shared expenses" : "Printer ink Monday"}</span>
            <span className={cx("amt", studioNeedsSettlement ? studio?.credit && "credit" : "even")}>
              {compactMoney(studio?.oweAmount)}
            </span>
          </div>
        </button>
        <button className="a-place" type="button" onClick={() => go("hub", { hub: "lisbon" })}>
          <PhotoFace photo={lisbon?.photo ?? ""} variant="place" className="lisbon">
            <span className="type">Trip</span>
            <h3>Lisbon · Sept</h3>
            <p>{lisbon?.oweLabel} {compactMoney(lisbon?.oweAmount)}</p>
          </PhotoFace>
          <div className="a-place-foot">
            <span>{lisbonNeedsCollecting ? "Airbnb hold Thursday" : "Airbnb settled"}</span>
            <span className={cx("amt", lisbonNeedsCollecting ? "credit" : "even")}>
              {lisbonNeedsCollecting ? "+" : ""}{compactMoney(lisbon?.oweAmount)}
            </span>
          </div>
        </button>
        {extra ? (
          <button className="a-place" type="button" onClick={() => go("hub", { hub: "created" })}>
            <PhotoFace photo={extra.photo} variant="place" className={heroClass(extra)}>
              <span className="type">{extra.type}</span>
              <h3>{extra.name}</h3>
              <p>{extra.status}</p>
            </PhotoFace>
            <div className="a-place-foot">
              <span>{extraMeta?.open}</span>
              <span className={cx("amt", extra.status === "No bills yet" && "even")}>
                {extraMeta?.total}
              </span>
            </div>
          </button>
        ) : null}
      </div>

      <div className="a-card" style={{ marginTop: 18 }}>
        <h2>Needs you</h2>
        <p className="sub">Across every space. Open the hub, or jump straight in.</p>
        <div className="hub-feed">
          {parkNeedsPay ? (
            <>
              <button className="hub-feed-row" type="button" onClick={() => go("settle", { hub: "park" })}>
                <Pill tone="sage">Park Street</Pill>
                <div>
                  <strong>Pay Jordan £42</strong>
                  <div className="when">Gas share · or £24 if you net Tesco</div>
                </div>
                <span className="hub-feed-go">Settle</span>
              </button>
              <button className="hub-feed-row" type="button" onClick={() => go("expenses", { hub: "park" })}>
                <Pill tone="warn">Park Street</Pill>
                <div>
                  <strong>British Gas Friday</strong>
                  <div className="when">£94.20 · Jordan paid · your share open</div>
                </div>
                <span className="hub-feed-go">Expenses</span>
              </button>
            </>
          ) : (
            <button className="hub-feed-row" type="button" onClick={() => go("settle", { hub: "park" })}>
              <Pill tone="open">Park Street</Pill>
              <div>
                <strong>Collect £18 from Jordan</strong>
                <div className="when">British Gas is paid · Tesco extras remain</div>
              </div>
              <span className="hub-feed-go">Settle</span>
            </button>
          )}
          <button
            className="hub-feed-row"
            type="button"
            onClick={() => bins && go("operation", { hub: "park", operation: bins.id })}
          >
            <Pill tone="warn">Park Street</Pill>
            <div>
              <strong>{binsCopy.title}</strong>
              <div className="when">{binsCopy.when}</div>
            </div>
            <span className="hub-feed-go">Operations</span>
          </button>
          {lisbonNeedsCollecting ? (
            <button className="hub-feed-row" type="button" onClick={() => go("hub", { hub: "lisbon" })}>
              <Pill tone="open">Lisbon</Pill>
              <div>
                <strong>Airbnb hold · 4 days</strong>
                <div className="when">Collect £40 from Jordan, £24 from Ness</div>
              </div>
              <span className="hub-feed-go">Open hub</span>
            </button>
          ) : null}
          <button className="hub-feed-row" type="button" onClick={() => go("hub", { hub: "studio" })}>
            <Pill>Studio East</Pill>
            <div>
              <strong>Printer ink Monday</strong>
              <div className="when">Sam’s run · split three ways</div>
            </div>
            <span className="hub-feed-go">Open hub</span>
          </button>
        </div>
      </div>
    </>
  );
}

export function HomeEmptyScreen() {
  const { go } = useApp();
  return (
    <div className="a-empty">
      <h2>No communes yet.</h2>
      <p>A hub is a house, a studio, or a trip. Create one, or join from an invite.</p>
      <div className="a-field-row">
        <button className="a-btn" type="button" onClick={() => go("onboard")}>
          Create a hub
        </button>
        <button className="a-btn ghost" type="button" onClick={() => go("invite")}>
          I have an invite
        </button>
      </div>
    </div>
  );
}
