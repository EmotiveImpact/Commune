import { HUBS, type Hub } from "./household";

/**
 * Commune covers. A photo someone chose in this browser is drawn as it is.
 * The default covers are Unsplash photos, which Unsplash resizes on request,
 * so each placement offers a few widths and says how wide it is drawn; the
 * browser then fetches the one that suits the screen instead of the full
 * photo. Every cover sits on a calm tone for the commune's type (the
 * --cover-* tokens in shared.css), which shows while the photo loads and
 * stays if it cannot load.
 */
export type CoverPlacement = "featured" | "card" | "hero" | "preview";
export type CoverTone = "household" | "workspace" | "trip";
export type CoverHub = Pick<Hub, "type" | "photo">;
export type CoverSource = { src: string; srcSet?: string; sizes?: string };

const WIDTHS = [480, 800, 1200, 1600];

// How wide each placement is drawn, in CSS pixels. The sidebar (248px) goes
// away at 560px. featured: the first card on Home. card: the smaller cards on
// Home and Places (three, then two, then one column). hero: the photo at the
// top of This Hub (at most 1208px). preview: the commune settings preview
// (240px beside the form, full width once the form drops below it at 1000px).
const PLACEMENTS: Record<CoverPlacement, { sizes: string; fallback: number }> = {
  featured: { sizes: "(max-width: 560px) 100vw, calc(100vw - 248px)", fallback: 1200 },
  card: { sizes: "(max-width: 560px) 100vw, (max-width: 850px) 50vw, 33vw", fallback: 800 },
  hero: { sizes: "(max-width: 560px) 100vw, (max-width: 1500px) calc(100vw - 292px), 1208px", fallback: 1200 },
  preview: { sizes: "(max-width: 560px) 100vw, (max-width: 1000px) 560px, 240px", fallback: 480 },
};

export function coverTone(hub: Pick<Hub, "type">): CoverTone {
  return hub.type === "Workspace" ? "workspace" : hub.type === "Trip" ? "trip" : "household";
}

const DEFAULT_COVERS: Record<CoverTone, string> = {
  household: HUBS.park.photo,
  workspace: HUBS.studio.photo,
  trip: HUBS.lisbon.photo,
};

/** The image to draw for a commune's cover in one placement. */
export function coverSource(hub: CoverHub, placement: CoverPlacement): CoverSource {
  // A commune whose records are still loading has no photo yet; it gets the
  // same default it will have once they arrive, so nothing is fetched twice.
  const photo = hub.photo || DEFAULT_COVERS[coverTone(hub)];
  const resize = unsplashResizer(photo);
  if (!resize) return { src: photo };
  const { sizes, fallback } = PLACEMENTS[placement];
  return { src: resize(fallback), srcSet: WIDTHS.map((width) => `${resize(width)} ${width}w`).join(", "), sizes };
}

function unsplashResizer(photo: string): ((width: number) => string) | null {
  let url: URL;
  try {
    url = new URL(photo);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== "images.unsplash.com") return null;
  return (width) => {
    const sized = new URL(url);
    sized.searchParams.set("w", String(width));
    return sized.href;
  };
}
