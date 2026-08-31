import { useState } from "react";
import { useApp } from "../state";
import { Avatar, Choose, Pill } from "../ui/widgets";
import { cx } from "../ui/cx";

export function NotesScreen() {
  const { go, hub, notes } = useApp();
  const [filter, setFilter] = useState<"All" | "Pinned">("All");
  const rows = hub.notes.filter((row) => {
    if (filter === "All") return true;
    return notes[row.note]?.kicker.toLowerCase().includes("pinned");
  });
  const extras = Object.entries(notes)
    .filter(([id]) => id.startsWith("added-"))
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
      </div>
    </>
  );
}

export function OperationsScreen() {
  const { go } = useApp();
  return (
    <div className="a-panel">
      <div className="a-settle-row">
        <Avatar tone="jordan" initials="JH" />
        <div>
          <strong>Bins</strong>
          <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>Tuesday nights · this week</div>
        </div>
        <Pill tone="warn">Overdue</Pill>
        <Choose
          items={[
            { label: "Mark done", onSelect: () => go("operations") },
            { label: "Nudge", onSelect: () => go("notices") },
          ]}
        />
      </div>
      <div className="a-settle-row">
        <Avatar tone="alex" initials="AR" />
        <div>
          <strong>Kitchen</strong>
          <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>This week</div>
        </div>
        <Pill>Open</Pill>
      </div>
      <div className="a-settle-row">
        <Avatar tone="maya" initials="MC" />
        <div>
          <strong>House fund chase</strong>
          <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>Alex’s £180</div>
        </div>
        <Pill tone="open">Yours</Pill>
      </div>
    </div>
  );
}

export function MembersScreen() {
  const { hub, go } = useApp();
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
      </div>
    </>
  );
}

export function ActivityScreen() {
  const { hub, go } = useApp();
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
  return (
    <div className="a-panel">
      <div className="a-settle-row">
        <div>
          <strong>Equal · three ways</strong>
          <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>Maya, Jordan, Alex · 33.3% each</div>
        </div>
        <Pill tone="sage">Default</Pill>
      </div>
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
    </div>
  );
}

export function BillingScreen() {
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
          <strong>14 Park Street</strong>
          <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>This hub is on the plan</div>
        </div>
        <Pill tone="sage">Active</Pill>
      </div>
    </div>
  );
}

export function AnalyticsScreen() {
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
