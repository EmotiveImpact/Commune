/** Preserve ?native=1 across client navigations. */

export function keepSearch(path: string): string {
  if (typeof window === "undefined") return path;
  const native = new URLSearchParams(window.location.search).get("native");
  if (native !== "1") return path;
  const [pathname, extra] = path.split("?");
  const params = new URLSearchParams(extra ?? "");
  params.set("native", "1");
  return `${pathname}?${params.toString()}`;
}

export function pathOnly(location: string): string {
  return location.split("?")[0];
}

export function isNativeNow(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("native") === "1" || window.matchMedia("(max-width: 560px)").matches;
}
