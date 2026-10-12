import { useState } from "react";
import { useApp, type SearchMemory } from "../state";
import { Button, EmptyState } from "../ui/components";
import { ActivityLog } from "../ui/ActivityLog";
import { SEARCH_MAX_QUERY } from "../live/search";
import { SearchResults } from "../ui/SearchResults";
import { useRecordSearch } from "../ui/useRecordSearch";
import { openSearchResult } from "../ui/searchNavigation";

export function AllActivityScreen() {
  const { places, go } = useApp();
  const rows = places
    .flatMap((hub) => hub.activity.map((item) => ({ hub, item })))
    .sort(
      (a, b) =>
        (Date.parse(b.item.createdAt ?? "") || 0) -
        (Date.parse(a.item.createdAt ?? "") || 0),
    );
  const incomplete = places.some((hub) => hub.activityState !== "ready");
  return (
    <>
      <p className="c-scope-label">All your communes</p>
      {rows.length ? (
        <ActivityLog
          rows={rows.map(({ hub, item }, index) => ({
            key: `${hub.id}-${index}`,
            item,
            commune: hub.name,
            onOpen: () =>
              go(item.expenseId ? "expense" : item.go, {
                hub: hub.id,
                expense: item.expenseId,
              }),
          }))}
        />
      ) : (
        !incomplete && (
          <EmptyState
            title="No activity yet."
            description="Saved records from all your communes appear here."
          />
        )
      )}
      {incomplete && (
        <p className="sub" role="status">
          Some commune activity is still unavailable. This list is not complete
          yet.
        </p>
      )}
    </>
  );
}

export function SearchScreen() {
  const { searchOpened } = useApp();
  // Opened again from the finder, Search starts from the finder's words.
  return <FullSearch key={searchOpened} />;
}

function FullSearch() {
  const { recallSearch, rememberSearch, places, go } = useApp();
  // The screen keeps its own text, so typing re-renders only this screen. The
  // app keeps a copy, so going Back to Search finds the same search.
  const [{ query: searchQuery, scope: searchScope }, setSearch] = useState(recallSearch);
  function change(next: SearchMemory) {
    setSearch(next);
    rememberSearch(next);
  }
  const search = useRecordSearch(searchQuery, searchScope, 25);
  return <div className="c-search-full">
    <form className="c-search-form" role="search" onSubmit={event => event.preventDefault()}>
      <label htmlFor="global-search">Search Commune</label>
      <div><input id="global-search" type="search" autoFocus value={searchQuery}
        onChange={event => change({ query: event.target.value, scope: searchScope })} maxLength={SEARCH_MAX_QUERY}
        placeholder="Expense, note, task, fund or person…" />
        {searchQuery && <Button variant="secondary" onClick={() => change({ query: "", scope: searchScope })}>Clear</Button>}
      </div>
    </form>
    <div className="c-search-scope"><label>Search in <select value={searchScope ?? ""} aria-label="Search in"
      onChange={event => change({ query: searchQuery, scope: event.target.value || null })}>
      <option value="">All your communes</option>{places.map(place => <option key={place.id} value={place.id}>{place.name}</option>)}
    </select></label></div>
    {search.result && <p className="c-search-count" role="status">{search.result.total} {search.result.total === 1 ? "match" : "matches"}
      {search.result.hasMore ? " · showing the top 25 in each section. Refine your search to find a specific record." : ""}</p>}
    <SearchResults {...search} query={searchQuery} listId="full-search-results" onOpen={result => openSearchResult(go, result)} />
  </div>;
}
