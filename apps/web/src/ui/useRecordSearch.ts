import { useEffect, useState } from "react";
import { api } from "../live/api";
import { parseSearchResponse, type SearchResponse } from "../live/search";

type SearchState = { key: string; result: SearchResponse | null; error: string; pending: boolean };
export function useRecordSearch(query: string, communeId: string | null, limit = 8, enabled = true) {
  const term = query.trim();
  const key = JSON.stringify([term, communeId, limit]);
  const [state, setState] = useState<SearchState>({ key: "", result: null, error: "", pending: false });
  const [attempt, setAttempt] = useState(0);
  const eligible = enabled && term.length >= 2;
  useEffect(() => {
    if (!eligible) return;
    const controller = new AbortController();
    let current = true;
    setState({ key, result: null, error: "", pending: true });
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: term, limit: String(limit) });
        if (communeId) params.set("commune", communeId);
        const result = parseSearchResponse(await api<unknown>(`/search?${params}`, { signal: controller.signal }));
        if (current) setState({ key, result, error: "", pending: false });
      } catch (error) {
        if (current) setState({ key, result: null, error: error instanceof Error ? error.message : "Could not search. Try again.", pending: false });
      }
    }, 180);
    return () => { current = false; window.clearTimeout(timer); controller.abort(); };
  }, [key, term, communeId, limit, eligible, attempt]);
  // Do not display yesterday's query while the next effect/debounce starts.
  const fresh = eligible && state.key === key;
  return {
    result: fresh ? state.result : null,
    error: fresh ? state.error : "",
    pending: eligible && (!fresh || state.pending),
    retry: () => setAttempt(value => value + 1),
  };
}
