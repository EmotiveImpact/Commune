import { useState } from "react";
import { useApp } from "../state";
import { Avatar, Pill } from "../ui/widgets";
import { cx } from "../ui/cx";

export function NotesScreen() {
  const { go, hub, notes } = useApp();
  const [filter, setFilter] = useState<"All" | "Pinned">("All");
  const rows = hub.notes.filter((row) => {
    if (row.note.startsWith("added-")) return false;
    if (filter === "All") return true;
    return notes[row.note]?.kicker.toLowerCase().includes("pinned");
  });
  const extras = Object.entries(notes)
    .filter(([id]) => id.startsWith("added-"))
    .filter(([, card]) => filter === "All" || card.kicker.toLowerCase().includes("pinned"))
    .map(([id, card]) => ({ note: id, title: card.title, when: card.lede }));

  return (
    <>
      <div className="a-toolbar">
        <div className="a-filters">
          {(["All", "Pinned"] as const).map((chip) => (
            <button
              key={chip}
              className={cx("a-chip", filter === chip && "is-on")}
              type="button"
              onClick={() => setFilter(chip)}
            >
              {chip}
            </button>
          ))}
        </div>
        <button className="a-btn" type="button" onClick={() => go("note-new")}>
          Add note
        </button>
      </div>
      <div className="a-panel">
        {extras.map((row) => (
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
        {rows.map((row) => (
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
        {!extras.length && !rows.length ? (
          <div className="a-empty" style={{ padding: 24 }}>
            <h2>No notes yet.</h2>
            <p>Wi-Fi, bins, the door code. Add what the house keeps forgetting.</p>
          </div>
        ) : null}
      </div>
    </>
  );
}

export function MembersScreen() {
  const { hub, go, invites } = useApp();
  return (
    <>
      <div className="a-toolbar">
        <button className="a-btn" type="button" onClick={() => go("member-invite")}>
          Invite
        </button>
      </div>
      <div className="a-panel">
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
          </div>
        ))}
        {invites.map((invite) => (
          <div key={invite.email} className="a-member-row">
            <Avatar tone="house" initials={invite.email.slice(0, 2).toUpperCase()} />
            <div className="who">
              <strong>{invite.email}</strong>
              <span>{invite.role} invite · saved in this session</span>
            </div>
            <Pill tone="open">Pending</Pill>
          </div>
        ))}
      </div>
    </>
  );
}

export function ActivityScreen() {
  const { hub, go } = useApp();
  if (!hub.activity.length) {
    return (
      <div className="a-empty">
        <h2>No activity yet.</h2>
        <p>The log starts when something is shared.</p>
      </div>
    );
  }
  return (
    <div className="a-panel">
      {hub.activity.map((row) => (
        <button
          key={`${row.title}-${row.time}`}
          className="a-settle-row"
          type="button"
          onClick={() => go(row.go)}
          style={{ width: "100%", background: "transparent", border: 0, cursor: "pointer", textAlign: "left" }}
        >
          <Avatar tone={row.cls} initials={row.ini} />
          <div>
            <strong>{row.title}</strong>
            <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{row.when}</div>
          </div>
          <span className="amt" style={{ color: "var(--ink-soft)", fontWeight: 500, fontSize: 13 }}>
            {row.time}
          </span>
        </button>
      ))}
    </div>
  );
}

export function TemplatesScreen() {
  const { hub, emptyHub } = useApp();
  if (emptyHub || hub.id === "created") {
    return (
      <div className="a-panel">
        <div className="a-settle-row">
          <div>
            <strong>Equal · you</strong>
            <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>Just you until someone joins</div>
          </div>
          <Pill tone="sage">Default</Pill>
        </div>
      </div>
    );
  }
  const memberNames = hub.members.map((member) => member.name.split(" ")[0]).join(", ");
  return (
    <div className="a-panel">
      <div className="a-settle-row">
        <div>
          <strong>Equal · three ways</strong>
          <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{memberNames} · 33.3% each</div>
        </div>
        <Pill tone="sage">Default</Pill>
      </div>
      {hub.id === "park" ? (
        <>
          <div className="a-settle-row">
            <div>
              <strong>Rent from fund</strong>
              <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>House fund pays · nobody is owed</div>
            </div>
            <Pill>Rent</Pill>
          </div>
          <div className="a-settle-row">
            <div>
              <strong>Maya + Jordan only</strong>
              <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>For the upstairs cleaner</div>
            </div>
            <Pill>Custom</Pill>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function BillingScreen() {
  const { hub } = useApp();
  return (
    <div className="a-panel">
      <div className="a-settle-row">
        <div>
          <strong>Standard</strong>
          <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>8 members · 1 hub · renews 12 Sep</div>
        </div>
        <span className="amt">£4.99/mo</span>
      </div>
      <div className="a-settle-row">
        <div>
          <strong>{hub.name}</strong>
          <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>This hub is on the plan</div>
        </div>
        <Pill tone="sage">Active</Pill>
      </div>
    </div>
  );
}

export function AnalyticsScreen() {
  const { emptyHub, hub } = useApp();
  if (emptyHub) {
    return (
      <div className="a-empty">
        <h2>Nothing to chart yet.</h2>
        <p>Spend shows up here once the ledger has a bill.</p>
      </div>
    );
  }
  if (hub.id !== "park") {
    return (
      <>
        <div className="a-kpis">
          {hub.kpis.map((item) => (
            <div className={`a-kpi ${item.tone}`} key={item.kicker}>
              <span>{item.kicker}</span>
              <strong>{item.num}</strong>
              <small>{item.hint}</small>
            </div>
          ))}
        </div>
        <div className="a-panel">
          <h2>Cycle activity</h2>
          <p className="sub">What has already happened in {hub.name}.</p>
          {hub.activity.length ? (
            hub.activity.map((row) => (
              <div className="a-settle-row" key={`${row.title}-${row.time}`}>
                <Avatar tone={row.cls} initials={row.ini} />
                <div>
                  <strong>{row.title}</strong>
                  <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{row.when}</div>
                </div>
                <span className="amt" style={{ color: "var(--ink-soft)", fontSize: 13 }}>
                  {row.time}
                </span>
              </div>
            ))
          ) : (
            <p className="sub">The first ledger item is ready. More history will collect here.</p>
          )}
        </div>
      </>
    );
  }
  return (
    <>
      <div className="a-kpis">
        <div className="a-kpi sage">
          <span>You’re owed</span>
          <strong>£18</strong>
          <small>Jordan · Tesco</small>
        </div>
        <div className="a-kpi peach">
          <span>House fund</span>
          <strong>£420</strong>
          <small>£180 to collect</small>
        </div>
        <div className="a-kpi lilac">
          <span>This month</span>
          <strong>£2,140</strong>
          <small>of £2,400</small>
        </div>
        <div className="a-kpi ink">
          <span>Members</span>
          <strong>3</strong>
          <small>Park Street</small>
        </div>
      </div>
      <div className="a-grid">
        <div className="a-panel">
          <h2>Spending this cycle</h2>
          <p className="sub">Last six months.</p>
          <div className="a-bars" aria-hidden="true">
            <i style={{ height: "42%" }} />
            <i style={{ height: "55%" }} />
            <i style={{ height: "48%" }} />
            <i style={{ height: "70%" }} />
            <i style={{ height: "62%" }} />
            <i style={{ height: "88%" }} />
          </div>
          <div className="a-bars lbl">
            <span>Mar</span>
            <span>Apr</span>
            <span>May</span>
            <span>Jun</span>
            <span>Jul</span>
            <span>Aug</span>
          </div>
        </div>
        <div className="a-panel">
          <h2>Where it went</h2>
          <p className="sub">This month, by category.</p>
          <div className="a-cats">
            <div className="a-cat">
              <span>Rent</span>
              <strong>£1,800</strong>
              <div className="track">
                <i style={{ width: "84%" }} />
              </div>
            </div>
            <div className="a-cat">
              <span>Utilities</span>
              <strong>£126.20</strong>
              <div className="track">
                <i style={{ width: "18%" }} />
              </div>
            </div>
            <div className="a-cat">
              <span>Groceries</span>
              <strong>£67.40</strong>
              <div className="track">
                <i style={{ width: "10%" }} />
              </div>
            </div>
            <div className="a-cat">
              <span>Internet</span>
              <strong>£32.00</strong>
              <div className="track">
                <i style={{ width: "6%" }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
