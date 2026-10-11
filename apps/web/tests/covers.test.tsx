import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "../src/App";
import { preloadAll } from "../src/shell/lazyComponent";
import { AppProvider } from "../src/state";
import { api, loadCommunes, loadSnapshot } from "../src/live/api";
import type { Commune, Snapshot } from "../src/live/model";
import { HUBS, type Hub } from "../src/data/household";
import { coverSource, type CoverPlacement } from "../src/data/covers";
import { CoverImage, coverToneClass } from "../src/ui/CoverImage";

vi.mock("../src/live/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/live/api")>(),
  api: vi.fn(), post: vi.fn(), loadCommunes: vi.fn(), loadSnapshot: vi.fn(),
}));

const widths = (srcSet = "") => srcSet.split(", ").map((candidate) => {
  const [url, width] = candidate.split(" ");
  return { photo: new URL(url).pathname, w: new URL(url).searchParams.get("w"), width };
});
const PLACEMENTS: CoverPlacement[] = ["card", "hero", "preview", "commune", "thumb"];
const CUSTOM = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ";

// The screens and windows a browser loads on first use are loaded up front,
// so each test sees them drawn at once.
beforeAll(preloadAll);
describe("cover sources", () => {
  it.each([
    ["Household", HUBS.park.photo],
    ["Workspace", HUBS.studio.photo],
    ["Trip", HUBS.lisbon.photo],
  ] as const)("offers each placement the %s default in widths that fit it", (type, photo) => {
    const id = new URL(photo).pathname;
    for (const placement of PLACEMENTS) {
      const source = coverSource({ type, photo }, placement);
      expect(widths(source.srcSet)).toEqual([480, 800, 1200, 1600].map((w) => ({ photo: id, w: String(w), width: `${w}w` })));
      expect(source.sizes).toBeTruthy();
      const src = new URL(source.src);
      expect(src.pathname).toBe(id);
      expect(Object.fromEntries(src.searchParams)).toMatchObject({ auto: "format", fit: "crop", q: "80" });
      // A commune still loading has no photo yet and gets the same image.
      expect(coverSource({ type, photo: "" }, placement)).toEqual(source);
    }
  });

  it("never offers a small placement the full-size photo by default", () => {
    const fallback = (placement: CoverPlacement) => new URL(coverSource({ type: "Household", photo: "" }, placement).src).searchParams.get("w");
    expect(fallback("card")).toBe("800");
    expect(fallback("preview")).toBe("480");
    expect(coverSource({ type: "Household", photo: "" }, "card").sizes).toBe("(max-width: 560px) 100vw, (max-width: 850px) 50vw, 33vw");
    expect(coverSource({ type: "Household", photo: "" }, "preview").sizes).toBe("(max-width: 560px) 100vw, (max-width: 1000px) 560px, 240px");
  });

  it("draws a photo chosen in this browser as it is", () => {
    for (const placement of PLACEMENTS) expect(coverSource({ type: "Trip", photo: CUSTOM }, placement)).toEqual({ src: CUSTOM });
  });
});

describe("a cover that cannot load", () => {
  const hub: Pick<Hub, "type" | "photo"> = { type: "Workspace", photo: HUBS.studio.photo };
  function Frame({ photo = hub.photo }: { photo?: string }) {
    return <div data-testid="frame" className={coverToneClass({ ...hub, photo })}><CoverImage hub={{ ...hub, photo }} placement="card" /></div>;
  }

  it("is removed, leaving the commune type's tone instead of a broken image", () => {
    const { rerender } = render(<Frame />);
    const image = document.querySelector("img.c-cover-photo")!;
    expect(image.getAttribute("alt")).toBe("");
    expect(image.getAttribute("srcset")).toBe(coverSource(hub, "card").srcSet);
    expect(image.getAttribute("sizes")).toBe(coverSource(hub, "card").sizes);
    fireEvent.error(image);
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByTestId("frame").className).toBe("c-cover-workspace");
    // A different photo gets its own chance to load.
    rerender(<Frame photo={CUSTOM} />);
    expect(document.querySelector("img.c-cover-photo")?.getAttribute("src")).toBe(CUSTOM);
  });
});

const user = { id: "user-1", name: "Test Person", email: "test@example.test", emailVerified: true };
const communes: Commune[] = [
  { id: "home-1", name: "Our home", kind: "household", currency: "GBP", role: "admin", address: "1 Test Street" },
  { id: "work-1", name: "The studio", kind: "workspace", currency: "GBP", role: "admin", address: "2 Test Yard" },
  { id: "trip-1", name: "Away days", kind: "trip", currency: "GBP", role: "admin", destination: "Lisbon" },
];
const snapshotOf = (commune: Commune): Snapshot => ({
  commune, members: [{ userId: user.id, name: user.name, role: "admin" }], expenses: [], funds: [], notifications: [], reminderTargets: [],
});
function mount(path: string) {
  const location = memoryLocation({ path, record: true });
  render(<Router hook={location.hook}><AppProvider><App /></AppProvider></Router>);
}
const failAll = () => document.querySelectorAll("img.c-cover-photo").forEach((image) => fireEvent.error(image));

describe("covers across the app", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessionStorage.clear();
    vi.mocked(api).mockImplementation(async (path) => {
      if (path === "/auth/me") return { user };
      if (path === "/reminders/usage") return { totalUsed: 0, totalLimit: 60, recipientLimit: 6, recipientUsage: {}, nextSlotAt: null };
      if (path.endsWith("/invites")) return { invites: [] };
      throw new Error(`Unexpected API request ${path}`);
    });
    vi.mocked(loadCommunes).mockResolvedValue({ communes });
    vi.mocked(loadSnapshot).mockImplementation(async (commune) => snapshotOf(commune));
  });
  afterEach(cleanup);

  it("sizes Home's covers for where they sit and falls back to each type's tone", async () => {
    mount("/");
    await screen.findByRole("heading", { name: "Our home" });
    // Nothing is owed in any of them, so the current commune's photo leads.
    const band = document.querySelector(".c-home-square")!;
    const photos = [...document.querySelectorAll(".c-home-commune-photo")];
    expect(band.classList.contains("c-cover-household")).toBe(true);
    expect(photos.map((photo) => [...photo.classList].find((name) => name.startsWith("c-cover-")))).toEqual(["c-cover-household", "c-cover-workspace", "c-cover-trip"]);
    expect(band.querySelector("img")?.getAttribute("sizes")).toBe(coverSource({ type: "Household", photo: "" }, "hero").sizes);
    for (const photo of photos) expect(photo.querySelector("img")?.getAttribute("sizes")).toBe(coverSource({ type: "Trip", photo: "" }, "commune").sizes);
    expect(photos[2].querySelector("img")?.getAttribute("src")).toBe(coverSource({ type: "Trip", photo: "" }, "commune").src);
    failAll();
    expect(document.querySelector("img.c-cover-photo")).toBeNull();
    expect(screen.getByRole("heading", { name: "Our home" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Away days" })).toBeTruthy();
  });

  it("keeps This Hub's loading placeholder plain, then sizes the hero and keeps the tone if it fails", async () => {
    let release!: () => void;
    vi.mocked(loadSnapshot).mockImplementation((commune) => new Promise((resolve) => { release = () => resolve(snapshotOf(commune)); }));
    mount("/hub");
    await screen.findByRole("status", { name: "Loading shared records" });
    // Plain sage while the records load: no default cover that a photo chosen
    // in this browser would then replace.
    const placeholder = document.querySelector<HTMLElement>(".c-skeleton-identity")!;
    expect(placeholder.className).toBe("c-skeleton-identity");
    expect(placeholder.querySelector("img")).toBeNull();
    expect(placeholder.style.backgroundImage).toBe("");
    await act(async () => release());
    const identity = await screen.findByRole("region", { name: "Commune identity" });
    const hero = coverSource({ type: "Household", photo: HUBS.park.photo }, "hero");
    const cover = identity.querySelector("img.c-hub-cover")!;
    expect([cover.getAttribute("src"), cover.getAttribute("srcset"), cover.getAttribute("sizes")]).toEqual([hero.src, hero.srcSet, hero.sizes]);
    fireEvent.error(cover);
    expect(identity.querySelector("img")).toBeNull();
    expect(identity.className).toBe("c-hub-identity has-photo c-cover-household");
    expect(screen.getByRole("heading", { name: "Our home" })).toBeTruthy();
  });

  it("shows a photo chosen in this browser in This Hub's loading placeholder, as before", async () => {
    sessionStorage.setItem(`commune.local.${user.id}`, JSON.stringify({ hubPhotos: { "home-1": CUSTOM } }));
    vi.mocked(loadSnapshot).mockImplementation(() => new Promise(() => undefined));
    mount("/hub");
    await screen.findByRole("status", { name: "Loading shared records" });
    const placeholder = document.querySelector<HTMLElement>(".c-skeleton-identity")!;
    expect(placeholder.style.backgroundImage).toContain(CUSTOM);
    expect(placeholder.querySelector("img")).toBeNull();
  });

  it("previews the cover in commune settings at its small size", async () => {
    mount("/commune-settings");
    const preview = await screen.findByRole("img", { name: "Our home cover photo" });
    expect(preview.classList.contains("c-cover-household")).toBe(true);
    expect(preview.querySelector("img")?.getAttribute("sizes")).toBe(coverSource({ type: "Household", photo: "" }, "preview").sizes);
    failAll();
    expect(preview.querySelector("img")).toBeNull();
  });
});
