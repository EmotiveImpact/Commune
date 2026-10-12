import { useEffect } from "react";

// "Expenses · Flat 4 · Commune": short, most specific first.
export function usePageTitle(...parts: Array<string | undefined>) {
  const title = [...parts.filter(Boolean), "Commune"].join(" · ");
  useEffect(() => { document.title = title; }, [title]);
}
