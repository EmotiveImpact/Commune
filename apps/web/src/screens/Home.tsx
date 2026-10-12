import type { ReactNode } from "react";
import { useApp } from "../state";
import { Avatar, Pill } from "../ui/widgets";
import { CalendarDate } from "../ui/CalendarDate";
import type { LiveHub } from "../live/model";
import { cx } from "../ui/cx";
import { CoverImage, coverToneClass } from "../ui/CoverImage";

function PhotoFace({ hub, focus, children }: { hub: LiveHub; focus?: boolean; children: ReactNode }) {
  return (
    <div className={cx(focus ? "a-focus-hero" : "a-place-hero", coverToneClass(hub))}>
      <CoverImage hub={hub} placement={focus ? "featured" : "card"} />
      {children}
    </div>
  );
}

function PlaceCard({ hub, focus = false, level = 3 }: { hub: LiveHub; focus?: boolean; level?: 2 | 3 }) {
  const { go } = useApp();
  const balance = hub.oweAmount.replace(/\.00\b/, "");
  const hasBalance = hub.moves.some((move) => !move.even);
  const ready = hub.activityState === "ready";
  const memberCount = ready ? hub.members.length : hub.memberCount;
  return (
    <button className={cx("a-place", focus && "a-focus-lead")} type="button" onClick={() => go("hub", { hub: hub.id })}>
      <PhotoFace hub={hub} focus={focus}>
        <span className="type">{hub.type}{memberCount == null ? "" : ` · ${memberCount} ${memberCount === 1 ? "person" : "people"}`}</span>
        {focus || level === 2 ? <h2>{hub.name}</h2> : <h3>{hub.name}</h3>}
        {(hub.type === "Trip" ? hub.destination : hub.address) ? <p className="a-place-location">{hub.type === "Trip" ? hub.destination : hub.address}</p> : null}
        <p>{hub.status}</p>
        {focus ? (
          <div className="a-cover-people">
            <div className="avatar-stack">
              {hub.members.slice(0, 4).map((member) => <Avatar key={member.name} tone={member.cls} initials={member.ini} />)}
            </div>
            Open this commune
          </div>
        ) : null}
      </PhotoFace>
      <div className="a-place-foot">
        <span>{ready ? hasBalance ? hub.oweLabel : "Even" : hub.activityState === "error" ? "Balance unavailable" : "Loading balance…"}</span>
        <span className={cx("amt", hub.credit && "credit", !hasBalance && "even")}>{ready ? balance : "-"}</span>
      </div>
    </button>
  );
}

export function HomeScreen() {
  const { go, places, hubId } = useApp();
  if (!places.length) return <HomeEmptyScreen />;
  const first = places.find(place => place.id === hubId) ?? places[0];
  const others = places.filter(place => place.id !== first.id);
  const needs = places.flatMap((hub) => hub.now.map((item) => ({ hub, item })))
    .sort((a, b) => (a.item.dueOn ?? "9999").localeCompare(b.item.dueOn ?? "9999")).slice(0, 6);
  const activity = places.flatMap((hub) => hub.activity.map((item) => ({ hub, item })))
    .sort((a, b) => (Date.parse(b.item.createdAt ?? "") || 0) - (Date.parse(a.item.createdAt ?? "") || 0)).slice(0, 6);
  const incomplete = places.some((hub) => hub.activityState !== "ready");
  const unavailable = places.some((hub) => hub.activityState === "error");
  const partialMessage = unavailable ? "Some commune activity could not be loaded. Open that commune to retry." : "Still loading activity from your communes…";
  return (
    <>
      <div className="a-home-featured"><PlaceCard hub={first} focus /></div>
      {others.length ? <div className="a-home-places">{others.map((hub) => <PlaceCard key={hub.id} hub={hub} />)}</div> : null}
      <div className="a-week">
        <div className="a-card">
          <h2>Needs you</h2>
          <p className="sub">Open items across your communes.</p>
          {needs.length ? (
            <div className="hub-feed">
              {needs.map(({ hub, item }, index) => (
                <button key={`${hub.id}-${item.title}-${index}`} className="hub-feed-row" type="button" onClick={() => go(item.go, { hub: hub.id, expense: item.expenseId, operation: item.operationId })}>
                  <Pill tone={item.pill === "warn" ? "warn" : "open"}>{hub.name}</Pill>
                  {item.dueOn && <CalendarDate date={item.dueOn} label="Due" />}
                  <div><strong>{item.title}</strong><div className="when">{item.when}</div></div>
                  <span className="hub-feed-go">Open</span>
                </button>
              ))}
            </div>
          ) : !incomplete ? <p className="sub">Nothing waiting right now.</p> : null}
          {incomplete ? <p className="sub">{partialMessage}</p> : null}
        </div>
        <div className="a-card">
          <div className="a-card-head">
            <div><h2>Recent activity</h2><p className="sub">What has been recorded.</p></div>
            <button className="a-btn ghost" type="button" onClick={() => go("home-activity")}>All activity</button>
          </div>
          {activity.length ? activity.map(({ hub, item }, index) => (
            <button className="a-item" type="button" key={`${hub.id}-${item.title}-${index}`} onClick={() => go(item.expenseId ? "expense" : item.go, { hub: hub.id, expense: item.expenseId })}>
              <Avatar tone={item.cls} initials={item.ini} />
              <div><strong>{item.title}</strong><div className="when">{hub.name} · {item.when}</div></div>
              <span className="when">{item.time}</span>
            </button>
          )) : !incomplete ? <p className="sub">Activity will appear after something is shared.</p> : null}
          {incomplete ? <p className="sub">{partialMessage}</p> : null}
        </div>
      </div>
    </>
  );
}

export function PlacesScreen() {
  const { go, places } = useApp();
  if (!places.length) return <HomeEmptyScreen />;
  return (
    <>
      <div className="a-toolbar"><button className="a-btn" type="button" onClick={() => go("commune-new")}>New commune</button></div>
      {/* The cards sit straight under the page title, so each name is an h2. */}
      <div className="a-place-grid">{places.map((hub) => <PlaceCard key={hub.id} hub={hub} level={2} />)}</div>
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
