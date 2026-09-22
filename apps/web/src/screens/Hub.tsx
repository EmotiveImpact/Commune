import type { ReactNode } from "react";
import { useApp } from "../state";
import { Avatar, Pill } from "../ui/widgets";
import { ImagePick } from "../ui/photos";
import { cx } from "../ui/cx";

function primaryCtaTarget(label: string): "add-expense" | "expenses" | "settle" {
  const action = label.toLowerCase();
  if (action.includes("open expenses")) return "expenses";
  if (action.includes("add") || action.includes("log")) return "add-expense";
  return "settle";
}

function Cover({ children }: { children: ReactNode }) {
  const { hub, session, setHubPhoto } = useApp();
  const custom = Boolean(session?.hubPhotos?.[hub.id]);
  return (
    <div className="a-cover" style={{ ["--hub-photo" as string]: `url("${hub.photo}")` }}>
      <ImagePick
        tone="on-photo"
        label="Change photo"
        clearLabel="Original"
        hasCustom={custom}
        maxEdge={1280}
        inputLabel={`Photo for ${hub.name}`}
        onPhoto={(dataUrl) => setHubPhoto(hub.id, dataUrl)}
        onClear={() => setHubPhoto(hub.id, null)}
      />
      {children}
    </div>
  );
}

export function HubScreen() {
  const { hub, go } = useApp();
  return (
    <>
      <Cover>
        <span className="type">{hub.type}</span>
        <h1>{hub.name}</h1>
        <p className="lede">{hub.lede}</p>
        <div className="a-cover-people">
          <div className="avatar-stack">
            {hub.avatars.map(([tone, ini]) => (
              <Avatar key={ini} tone={tone} initials={ini} />
            ))}
          </div>
          <span>{hub.people}</span>
        </div>
      </Cover>

      <div className="a-kpis">
        {hub.kpis.map((kpi) => (
          <button key={kpi.kicker} className={cx("a-kpi", kpi.tone)} type="button" onClick={() => go(kpi.go)}>
            <span>{kpi.kicker}</span>
            <strong>{kpi.num}</strong>
            <small>{kpi.hint}</small>
          </button>
        ))}
      </div>

      <div className="a-answers">
        <div className={cx("a-card a-owe-card", hub.credit && "is-credit")}>
          <span>{hub.oweLabel}</span>
          <div className="num">{hub.oweAmount}</div>
          <p>{hub.oweCopy}</p>
          <div className="a-ink-actions">
            <button
              className="a-btn"
              type="button"
              onClick={() => go(primaryCtaTarget(hub.oweCta))}
            >
              {hub.oweCta}
            </button>
          </div>
        </div>
        <div className="a-card">
          <h2>Right now</h2>
          <p className="sub">What still needs a person in this house.</p>
          {hub.now.map((row) => (
            <button key={row.title} className="a-now-row" type="button" onClick={() => go(row.go)}>
              <Pill tone={row.pill}>{row.tag}</Pill>
              <div>
                <strong>{row.title}</strong>
                <div className="when">{row.when}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="a-card a-owes" style={{ marginTop: 16 }}>
        <h2>Who owes whom</h2>
        <p className="sub">This cycle. Settle when you’re ready.</p>
        {hub.moves.map((move) => (
          <button
            key={move.names}
            className={cx("a-move", move.even && "is-even")}
            type="button"
            onClick={() => go(move.go)}
          >
            <div className="a-arrow" style={move.even ? { background: "#f0ece4" } : undefined}>
              {move.arrow}
            </div>
            <div>
              <div className="names">{move.names}</div>
              <div className="why">{move.why}</div>
            </div>
            <div className="amt" style={move.even ? { color: "var(--ink-soft)" } : undefined}>
              {move.amt}
            </div>
          </button>
        ))}
      </div>

      <div className="jump-grid">
        {hub.jumps.map((jump) => (
          <button key={jump.kicker} className="jump-tile" type="button" onClick={() => go(jump.go)}>
            <span>{jump.kicker}</span>
            <strong>{jump.title}</strong>
            <small>{jump.hint}</small>
          </button>
        ))}
      </div>

      <div className="a-week">
        <div className="a-card">
          <div className="a-card-head">
            <div>
              <h2>This week</h2>
              <p className="sub">Activity in this house. Open the ledger from here.</p>
            </div>
            <button className="a-btn ghost" type="button" onClick={() => go("activity")}>
              Activity
            </button>
          </div>
          {hub.activity.map((row) => (
            <button key={`${row.title}-${row.time}`} className="a-item" type="button" onClick={() => go(row.go)}>
              <Avatar tone={row.cls} initials={row.ini} />
              <div>
                <strong>{row.title}</strong>
                <div className="when">{row.when}</div>
              </div>
              <span className="when">{row.time}</span>
            </button>
          ))}
        </div>
        <div className="a-card">
          <div className="a-card-head">
            <div>
              <h2>The house, in writing</h2>
              <p className="sub">The stuff that used to live in a chat pin.</p>
            </div>
            <button className="a-btn ghost" type="button" onClick={() => go("notes")}>
              Notes
            </button>
          </div>
          {hub.notes.map((row) => (
            <button
              key={row.note}
              className="a-item a-item-plain"
              type="button"
              onClick={() => go("note", { note: row.note })}
            >
              <div>
                <strong>{row.title}</strong>
                <div className="when">{row.when}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="a-card" style={{ marginTop: 16 }}>
        <div className="a-card-head">
          <div>
            <h2>Who’s here</h2>
            <p className="sub">This cycle, not personalities.</p>
          </div>
          <button className="a-btn ghost" type="button" onClick={() => go("members")}>
            Members
          </button>
        </div>
        {hub.members.map((member) => (
          <div key={member.name} className="a-member-row">
            <Avatar tone={member.cls} initials={member.ini} />
            <div className="who">
              <strong>{member.name}</strong>
              <span>{member.meta}</span>
            </div>
            <div className="bal" style={member.muted ? { color: "var(--ink-soft)" } : undefined}>
              {member.bal}
            </div>
            {member.nudge ? (
              <button className="a-btn nudge" type="button" onClick={() => go("notices")} style={{ height: 32, flexShrink: 0 }}>
                Nudge
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </>
  );
}

export function HubEmptyScreen() {
  const { hub, go } = useApp();
  return (
    <>
      <Cover>
        <span className="type">{hub.type}</span>
        <h1>{hub.name}</h1>
        <p className="lede">No bills yet. Add the first one so the house has a truth.</p>
      </Cover>
      <div className="a-empty a-cover-empty">
        <p>Rent, gas, Tesco — once something is shared, Home and Settle will have something to say.</p>
        <button className="a-btn" type="button" onClick={() => go("add-expense")}>
          Add expense
        </button>
      </div>
    </>
  );
}
