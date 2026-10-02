import { useEffect, useId, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useApp } from "../state";
import { SEARCH_MAX_QUERY } from "../live/search";
import { Dialog } from "./components";
import { useRecordSearch } from "./useRecordSearch";
import { orderedSearchResults, SearchResults } from "./SearchResults";
import { openSearchResult } from "./searchNavigation";
import "./QuickSearch.css";

export function QuickSearch({ onClose, initialScope }: { onClose: () => void; initialScope: string | null }) {
  const { hub, places, go, setSearchQuery, setSearchScope } = useApp();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState(initialScope);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const search = useRecordSearch(query, scope);
  const results = orderedSearchResults(search.result);
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" }); }, [active, listId]);
  function fullSearch() {
    setSearchQuery(query); setSearchScope(scope); onClose(); go("search");
  }
  return <Dialog title="Search Commune" onClose={onClose} className="c-quick-search">
    <div className="c-quick-search-input"><Search size={20} strokeWidth={1.5} aria-hidden="true" />
      <input ref={inputRef} type="search" aria-label="Search Commune" role="combobox"
        aria-autocomplete="list" aria-expanded={results.length > 0} aria-controls={results.length ? listId : undefined}
        aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
        placeholder="Expense, note, task, fund or person…" value={query} maxLength={SEARCH_MAX_QUERY}
        onChange={event => { setQuery(event.target.value); setActive(0); }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Escape") {
            // A native search field otherwise consumes Escape to clear its text first.
            // The finder always closes in one press, like the rest of our dialogs.
            event.preventDefault(); event.stopPropagation(); onClose();
          } else if ((event.key === "ArrowDown" || event.key === "ArrowUp") && results.length) {
            event.preventDefault(); setActive(index => (index + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length);
          } else if (event.key === "Enter" && results[active]) {
            event.preventDefault(); onClose(); openSearchResult(go, results[active]);
          }
        }} />
    </div>
    <div className="c-search-scope" aria-label="Search scope">
      {places.length > 0 && <button type="button" aria-pressed={scope !== null} onClick={() => { setScope(hub.id); setActive(0); }}
        title={`Search ${hub.name}`}>This commune</button>}
      <button type="button" aria-pressed={scope === null} onClick={() => { setScope(null); setActive(0); }}>All communes</button>
      {scope && <span>{places.find(place => place.id === scope)?.name ?? "This commune"}</span>}
    </div>
    <div className="c-quick-search-body" aria-busy={search.pending}>
      <SearchResults {...search} query={query} listId={listId} quick activeIndex={active} onActive={setActive}
        onOpen={item => { onClose(); openSearchResult(go, item); }} />
    </div>
    <footer className="c-quick-search-footer"><span className="c-search-key-hint"><kbd>↑</kbd><kbd>↓</kbd> navigate <kbd>↵</kbd> open <kbd>esc</kbd> close</span>
      {search.result ? <button type="button" onClick={fullSearch}>{search.result.hasMore ? `More results (${search.result.total})` : "Open full search"}</button> : <span>Only your communes</span>}
    </footer>
    <span className="c-search-announcement" role="status" aria-live="polite">{search.result ? `${search.result.total} ${search.result.total === 1 ? "match" : "matches"}${search.result.hasMore ? ", showing the top results in each section" : ""}.` : ""}</span>
  </Dialog>;
}
