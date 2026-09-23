import type { ReactNode } from "react";
import { useApp } from "../state";
import { Avatar, Pill } from "../ui/widgets";
import { heroClass, type Hub } from "../data/household";
import { cx } from "../ui/cx";

function PhotoFace({ photo, focus, className, children }: { photo: string; focus?: boolean; className?: string; children: ReactNode }) {
  return (
    <div
      className={cx(focus ? "a-focus-hero" : "a-place-hero", photo && "has-photo", className)}
      style={photo ? { ["--place-photo" as string]: `url("${photo}")` } : undefined}
    >
      {children}
    </div>
  );
}

function PlaceCard({ hub, focus = false }: { hub: Hub; focus?: boolean }) {
  const { go } = useApp();
  const balance = hub.oweAmount.replace(/\.00\b/, "");
  const hasBalance = hub.moves.some((move) => !move.even);
  return (
    <button className={cx("a-place", focus && "a-focus-lead")} type="button" onClick={() => go("hub", { hub: hub.id })}>
      <PhotoFace photo={hub.photo} focus={focus} className={heroClass(hub)}>
        <span className="type">{hub.type} · {hub.members.length} {hub.members.length === 1 ? "person" : "people"}</span>
        {focus ? <h2>{hub.name}</h2> : <h3>{hub.name}</h3>}
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
        <span>{hasBalance ? hub.oweLabel : "Even"}</span>
        <span className={cx("amt", hub.credit && "credit", !hasBalance && "even")}>{balance}</span>
      </div>
    </button>
  );
}

export function HomeScreen() {
  const { go, places, you } = useApp();
  if (!places.length) return <HomeEmptyScreen />;
  const [first, ...others] = places;
  const needs = places.flatMap((hub) => hub.now.map((item) => ({ hub, item }))).slice(0, 6);
  const activity = places.flatMap((hub) => hub.activity.map((item) => ({ hub, item }))).slice(0, 6);
  return (
    <>
      <PlaceCard hub={first} focus />
      {others.length ? <div className="a-place-grid" style={{ marginTop: 12 }}>{others.map((hub) => <PlaceCard key={hub.id} hub={hub} />)}</div> : null}
      <div className="a-home-greet is-after">
        <h1>Your communes, {you.name.split(" ")[0]}.</h1>
        <p>{places.length} {places.length === 1 ? "space" : "spaces"} · shared details that stay in sync for everyone.</p>
      </div>
      <div className="a-week">
        <div className="a-card">
          <h2>Needs you</h2>
          <p className="sub">Open items across your communes.</p>
          {needs.length ? (
            <div className="hub-feed">
              {needs.map(({ hub, item }, index) => (
                <button key={`${hub.id}-${item.title}-${index}`} className="hub-feed-row" type="button" onClick={() => go(item.go, { hub: hub.id })}>
                  <Pill tone={item.pill === "warn" ? "warn" : "open"}>{hub.name}</Pill>
                  <div><strong>{item.title}</strong><div className="when">{item.when}</div></div>
                  <span className="hub-feed-go">Open</span>
                </button>
              ))}
            </div>
          ) : <p className="sub">Nothing waiting right now.</p>}
        </div>
        <div className="a-card">
          <div className="a-card-head">
            <div><h2>Recent activity</h2><p className="sub">What has been recorded.</p></div>
            <button className="a-btn ghost" type="button" onClick={() => go("activity")}>Activity</button>
          </div>
          {activity.length ? activity.map(({ hub, item }, index) => (
            <button className="a-item" type="button" key={`${hub.id}-${item.title}-${index}`} onClick={() => go(item.go, { hub: hub.id })}>
              <Avatar tone={item.cls} initials={item.ini} />
              <div><strong>{item.title}</strong><div className="when">{hub.name} · {item.when}</div></div>
              <span className="when">{item.time}</span>
            </button>
          )) : <p className="sub">Activity will appear after something is shared.</p>}
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
