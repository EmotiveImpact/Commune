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
