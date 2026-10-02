import { useEffect, useRef, useState } from "react";
import { useApp, type SearchTarget } from "../state";

/** List-only records receive keyboard focus, not an automatic edit/action. */
export function useSearchRecord(kind: SearchTarget["kind"], ids: string[], onOpen?: (id: string) => void) {
  const { searchTarget, clearSearchTarget, contentLoading, contentError, hubId } = useApp();
  const [highlightedId, setHighlightedId] = useState("");
  const [error, setError] = useState("");
  const openRef = useRef(onOpen); openRef.current = onOpen;
  const recordIds = ids.join("|");
  useEffect(() => {
    if (!highlightedId || document.querySelector("dialog[open]")) return;
    const card = document.getElementById(`search-record-${kind}-${highlightedId}`);
    card?.scrollIntoView({ block: "center" }); card?.focus();
  }, [highlightedId, kind, hubId]);
  useEffect(() => {
    if (!searchTarget || searchTarget.kind !== kind || searchTarget.communeId !== hubId || contentLoading || contentError) return;
    const id = searchTarget.id;
    if (!recordIds.split("|").includes(id)) {
      setError("This search result is no longer available. It may have been archived or removed.");
    } else {
      setError(""); setHighlightedId(id);
      const card = document.getElementById(`search-record-${kind}-${id}`);
      card?.scrollIntoView({ block: "center" }); card?.focus();
      openRef.current?.(id);
    }
    clearSearchTarget();
  }, [searchTarget, kind, recordIds, hubId, contentLoading, contentError, clearSearchTarget]);
  return { highlightedId, error };
}
