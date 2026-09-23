import { useState } from "react";
import { useApp } from "../state";
import { Avatar, Pill } from "../ui/widgets";
import { cx } from "../ui/cx";

export function NotesScreen() {
  const { go, hub, notes } = useApp();
  const [filter, setFilter] = useState<"All" | "Pinned">("All");
  const rows = hub.notes.filter((row) => filter === "All" || notes[row.note]?.kicker.toLowerCase().includes("pinned"));
  return (
    <>
      <div className="a-toolbar">
        <div className="a-filters">
          {(["All", "Pinned"] as const).map((chip) => (
            <button key={chip} className={cx("a-chip", filter === chip && "is-on")} type="button" onClick={() => setFilter(chip)}>{chip}</button>
          ))}
        </div>
        <button className="a-btn" type="button" onClick={() => go("note-new")}>Add note</button>
      </div>
      <div className="a-panel">
        {rows.map((row) => (
          <button key={row.note} className="a-item a-item-plain" type="button" onClick={() => go("note", { note: row.note })}>
            <div><strong>{row.title}</strong><div className="when">{row.when}</div></div>
          </button>
        ))}
        {!rows.length ? <div className="a-empty" style={{ padding: 24 }}><h2>No notes yet.</h2><p>Keep Wi-Fi, bin day or other shared details here.</p></div> : null}
      </div>
    </>
  );
}

export function MembersScreen() {
  const { hub, go, invites, revokeInvite } = useApp();
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function onRevoke(id: string) {
    setError("");
    setRevoking(id);
    try {
      await revokeInvite(id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not revoke the invite.");
    } finally {
      setRevoking(null);
    }
  }
  return (
    <>
      <div className="a-toolbar"><button className="a-btn" type="button" onClick={() => go("member-invite")}>Invite</button></div>
      <div className="a-panel">
        {hub.members.map((member) => (
          <div key={member.userId ?? member.name} className="a-member-row">
            <Avatar tone={member.cls} initials={member.ini} />
            <div className="who"><strong>{member.name}</strong><span>{member.meta}</span></div>
            <div className="bal" style={member.muted ? { color: "var(--ink-soft)" } : undefined}>{member.bal}</div>
          </div>
        ))}
        {invites.map((invite) => (
          <div key={invite.id} className="a-member-row">
            <Avatar tone="house" initials={invite.email.slice(0, 2).toUpperCase()} />
            <div className="who"><strong>{invite.email}</strong><span>{invite.role} invitation · pending acceptance</span></div>
            <Pill tone="open">Pending</Pill>
            <button className="a-btn ghost" type="button" disabled={revoking === invite.id}
              aria-label={`Revoke invitation for ${invite.email}`} onClick={() => void onRevoke(invite.id)}>
              {revoking === invite.id ? "Revoking…" : "Revoke"}
            </button>
          </div>
        ))}
      </div>
      {error ? <p className="a-form-error" role="alert">{error}</p> : null}
    </>
  );
}

export function ActivityScreen() {
  const { hub, go } = useApp();
  if (!hub.activity.length) return <div className="a-empty"><h2>No activity yet.</h2><p>The log starts when something is shared.</p></div>;
  return (
    <div className="a-panel">
      {hub.activity.map((row, index) => (
        <button key={`${row.title}-${row.time}-${index}`} className="a-settle-row" type="button" onClick={() => go(row.go)} style={{ width: "100%", background: "transparent", border: 0, cursor: "pointer", textAlign: "left" }}>
          <Avatar tone={row.cls} initials={row.ini} />
          <div><strong>{row.title}</strong><div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{row.when}</div></div>
          <span className="amt" style={{ color: "var(--ink-soft)", fontWeight: 500, fontSize: 13 }}>{row.time}</span>
        </button>
      ))}
    </div>
  );
}

export function TemplatesScreen() {
  const { hub } = useApp();
  const count = hub.members.length;
  return (
    <div className="a-panel">
      <div className="a-settle-row">
        <div>
          <strong>Equal split · {count} {count === 1 ? "person" : "people"}</strong>
          <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>New expenses split exactly to the penny among selected members.</div>
        </div>
        <Pill tone="sage">Available</Pill>
      </div>
      <p className="sub" style={{ padding: "0 20px 20px" }}>Saved split templates are not available yet. Choose participants each time you add an expense.</p>
    </div>
  );
}

export function BillingScreen() {
  return (
    <div className="a-empty">
      <h2>Billing is not connected yet.</h2>
      <p>You can use the local app to test shared expenses. No subscription is active and no payment will be taken.</p>
    </div>
  );
}

export function AnalyticsScreen() {
  const { hub, emptyHub } = useApp();
  if (emptyHub) return <div className="a-empty"><h2>Nothing to chart yet.</h2><p>Spend shows here after the first expense.</p></div>;
  return (
    <>
      <div className="a-kpis">
        {hub.kpis.map((item) => <div className={`a-kpi ${item.tone}`} key={item.kicker}><span>{item.kicker}</span><strong>{item.num}</strong><small>{item.hint}</small></div>)}
      </div>
      <div className="a-panel">
        <h2>Recorded activity</h2>
        <p className="sub">Derived from this commune’s saved records. Forecasting and budgets are not connected yet.</p>
        {hub.activity.length ? hub.activity.map((row, index) => (
          <div className="a-settle-row" key={`${row.title}-${index}`}>
            <Avatar tone={row.cls} initials={row.ini} />
            <div><strong>{row.title}</strong><div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{row.when}</div></div>
            <span className="amt" style={{ color: "var(--ink-soft)", fontSize: 13 }}>{row.time}</span>
          </div>
        )) : <p className="sub">No activity yet.</p>}
      </div>
    </>
  );
}
