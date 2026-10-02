import { useApp } from "../state";
import { Button, EmptyState, Panel } from "../ui/components";
import { Avatar } from "../ui/widgets";
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
        <Panel>
          {rows.map(({ hub, item }, index) => (
            <button
              className="c-result-row"
              type="button"
              key={`${hub.id}-${index}`}
              onClick={() =>
                go(item.expenseId ? "expense" : item.go, {
                  hub: hub.id,
                  expense: item.expenseId,
                })
              }
            >
              <Avatar tone={item.cls} initials={item.ini} />
              <span>
                <strong>{item.title}</strong>
                <small>
                  {hub.name} · {item.when}
                </small>
              </span>
              <time dateTime={item.createdAt}>{item.time}</time>
            </button>
          ))}
        </Panel>
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
  const { searchQuery, setSearchQuery, searchScope, setSearchScope, places, go } = useApp();
  const search = useRecordSearch(searchQuery, searchScope, 25);
  return <div className="c-search-full">
    <form className="c-search-form" role="search" onSubmit={event => event.preventDefault()}>
      <label htmlFor="global-search">Search Commune</label>
      <div><input id="global-search" type="search" autoFocus value={searchQuery}
        onChange={event => setSearchQuery(event.target.value)} maxLength={SEARCH_MAX_QUERY}
        placeholder="Expense, note, task, fund or person…" />
        {searchQuery && <Button variant="secondary" onClick={() => setSearchQuery("")}>Clear</Button>}
      </div>
    </form>
    <div className="c-search-scope"><label>Search in <select value={searchScope ?? ""} aria-label="Search in"
      onChange={event => setSearchScope(event.target.value || null)}>
      <option value="">All your communes</option>{places.map(place => <option key={place.id} value={place.id}>{place.name}</option>)}
    </select></label></div>
    {search.result && <p className="c-search-count" role="status">{search.result.total} {search.result.total === 1 ? "match" : "matches"}
      {search.result.hasMore ? " · showing the top 25 in each section. Refine your search to find a specific record." : ""}</p>}
    <SearchResults {...search} query={searchQuery} listId="full-search-results" onOpen={result => openSearchResult(go, result)} />
  </div>;
}
