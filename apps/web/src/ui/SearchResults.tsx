import { CircleAlert, FileText, House, ReceiptText, Repeat2, ShoppingBag, SquareCheck, UsersRound, Files } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SEARCH_KINDS, SEARCH_LABELS, type SearchKind, type SearchResponse, type SearchResult } from "../live/search";
import { Button } from "./components";
const ICONS: Record<SearchKind, LucideIcon> = {
  commune: House, expense: ReceiptText, note: FileText, operation: SquareCheck,
  fund: ShoppingBag, recurring: Repeat2, member: UsersRound, template: Files,
};
export function orderedSearchResults(result: SearchResponse | null): SearchResult[] {
  return SEARCH_KINDS.flatMap(kind => result?.items.filter(item => item.kind === kind) ?? []);
}
export function SearchResults({ result, pending, error, query, retry, onOpen, listId,
  activeIndex = -1, onActive, quick = false,
}: {
  result: SearchResponse | null; pending: boolean; error: string; query: string;
  retry: () => void; onOpen: (item: SearchResult) => void; listId: string;
  activeIndex?: number; onActive?: (index: number) => void; quick?: boolean;
}) {
  const ordered = orderedSearchResults(result);
  if (query.trim().length < 2) return <div className="c-search-state">
    <p>Find something in Commune.</p><span>Search expenses, notes, tasks, funds and people. Type at least two characters.</span>
  </div>;
  if (pending) return <div className="c-search-state" role="status"><p>Searching…</p></div>;
  if (error) return <div className="c-search-state" role="alert"><CircleAlert size={20} aria-hidden="true" />
    <p>Could not search.</p><span>{error}</span><Button variant="secondary" onClick={retry}>Try again</Button>
  </div>;
  if (!ordered.length) return <div className="c-search-state" role="status"><p>No matches for “{query.trim()}”.</p>
    <span>Try another word or search all your communes.</span></div>;
  let offset = 0;
  return <div className="c-search-results" id={listId} role={quick ? "listbox" : undefined} aria-label="Search results">
    {SEARCH_KINDS.map(kind => {
      const items = ordered.filter(item => item.kind === kind);
      if (!items.length) return null;
      const start = offset; offset += items.length;
      const Glyph = ICONS[kind];
      return <div className="c-search-group" key={kind} role={quick ? "group" : undefined} aria-label={SEARCH_LABELS[kind]}>
        {/* In the quick finder the group's label names it; a heading inside the
            options list would break the list for screen readers. */}
        <h3 aria-hidden={quick || undefined}>{SEARCH_LABELS[kind]}</h3>
        {items.map((item, index) => {
          const position = start + index;
          const amount = item.amountMinor === null ? null : new Intl.NumberFormat("en-GB", { style: "currency", currency: item.currency }).format(item.amountMinor / 100);
          return <button className={`c-search-result${position === activeIndex ? " is-active" : ""}`} type="button"
            id={`${listId}-${position}`} role={quick ? "option" : undefined}
            aria-selected={quick ? position === activeIndex : undefined} tabIndex={quick ? -1 : undefined}
            key={`${item.communeId}-${item.kind}-${item.id}`} onClick={() => onOpen(item)}
            onMouseEnter={() => onActive?.(position)}>
            <span className="c-search-result-icon"><Glyph size={18} strokeWidth={1.5} aria-hidden="true" /></span>
            <span className="c-search-result-copy"><strong>{item.title}</strong><small>{item.kind === "commune" ? item.subtitle : `${item.communeName} · ${item.subtitle}`}</small></span>
            <span className="c-search-result-meta">{amount && <strong>{amount}</strong>}<small>{item.meta}</small></span>
          </button>;
        })}
      </div>;
    })}
  </div>;
}
