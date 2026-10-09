import { useApp } from "../state";
import { ActivityLog } from "../ui/ActivityLog";

export function ActivityScreen() {
  const { hub, go } = useApp();
  if (!hub.activity.length) return <div className="a-empty"><h2>No activity yet.</h2><p>The log starts when something is shared.</p></div>;
  return (
    <ActivityLog rows={hub.activity.map((row, index) => ({
      key: `${row.title}-${row.createdAt ?? row.time}-${index}`,
      item: row,
      onOpen: () => go(row.expenseId ? "expense" : row.go, { expense: row.expenseId }),
    }))} />
  );
}
