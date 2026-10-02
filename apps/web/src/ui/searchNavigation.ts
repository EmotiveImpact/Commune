import type { AppState } from "../state";
import type { SearchResult } from "../live/search";

export function openSearchResult(go: AppState["go"], result: SearchResult) {
  const hub = result.communeId;
  switch (result.kind) {
    case "commune": return go("hub", { hub });
    case "expense": return go("expense", { hub, expense: result.id });
    case "note": return go("note", { hub, note: result.id });
    case "operation": return go("operation", { hub, operation: result.id });
    case "fund": return go("funds", { hub, record: { kind: result.kind, id: result.id } });
    case "recurring": return go("recurring", { hub, record: { kind: result.kind, id: result.id } });
    case "member": return go("members", { hub, record: { kind: result.kind, id: result.id } });
    case "template": return go("templates", { hub, record: { kind: result.kind, id: result.id } });
  }
}
