import { useApp } from "../state";
import { Avatar } from "../ui/widgets";
export { NotesScreen } from "./Notes";

export { MembersScreen } from "./Members";

export function ActivityScreen() {
  const { hub, go } = useApp();
  if (!hub.activity.length) return <div className="a-empty"><h2>No activity yet.</h2><p>The log starts when something is shared.</p></div>;
  return (
    <div className="a-panel">
      {hub.activity.map((row, index) => (
        <button key={`${row.title}-${row.time}-${index}`} className="a-settle-row" type="button" onClick={() => go(row.expenseId ? "expense" : row.go, {expense:row.expenseId})} style={{ width: "100%", background: "transparent", border: 0, cursor: "pointer", textAlign: "left" }}>
          <Avatar tone={row.cls} initials={row.ini} />
          <div><strong>{row.title}</strong><div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{row.when}</div></div>
          <span className="amt" style={{ color: "var(--ink-soft)", fontWeight: 500, fontSize: 13 }}>{row.time}</span>
        </button>
      ))}
    </div>
  );
}

export { TemplatesScreen } from "./Templates";

export function BillingScreen() {
  return (
    <div className="a-empty">
      <h2>Billing is not connected yet.</h2>
      <p>You can track shared expenses here. No subscription is active and Commune will not take a payment.</p>
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
