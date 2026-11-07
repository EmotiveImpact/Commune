import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CAST_NAMES, IMAGE_KEYS, STORIES, storyById } from "@commune/core/stories";
import { forgetVisitStory, seenStory, visitStory } from "../src/stories/choose";
import { storyImage } from "../src/stories/images";
import { AuthStory, FirstBillCard, InviteScene, LoadingLines } from "../src/stories/StoryParts";
import { PendingShell } from "../src/shell/PendingShell";

afterEach(() => {
  cleanup();
  forgetVisitStory();
  window.history.replaceState(null, "", "/");
  vi.useRealTimers();
});
beforeEach(() => forgetVisitStory());

describe("opening stories in the web app", () => {
  it("has a URL on this origin for every story photo", () => {
    for (const key of IMAGE_KEYS) expect(storyImage(key), key).toMatch(/\.webp$|^data:image\/webp/);
  });

  it("opens on the story a website link named, and remembers it for empty screens", () => {
    window.history.replaceState(null, "", "/signup?from=link-villa");
    expect(visitStory().id).toBe("villa");
    forgetVisitStory();
    expect(seenStory().id).toBe("villa");
    expect(JSON.parse(localStorage.getItem("commune.stories.seen") ?? "[]")).toEqual(["villa"]);
  });

  it("chooses one story per page load, and another on the next visit", () => {
    const friday = new Date("2026-11-06T23:30:00");
    const first = visitStory(friday);
    expect(first.id).toBe("taxi");
    expect(visitStory(friday)).toBe(first);
    forgetVisitStory();
    expect(visitStory(friday).id).not.toBe("taxi");
  });

  it("plays every slide of the story across the sign-in panel", () => {
    const story = storyById("taxi")!;
    const { container } = render(<AuthStory story={story} />);
    expect(screen.getByText("Friday, 11:52pm")).toBeTruthy();
    expect(screen.getByText("Friday night. Nobody is thinking about money.")).toBeTruthy();
    expect(container.querySelectorAll(".c-story-panel-bars span")).toHaveLength(story.beats.length);
    for (const img of container.querySelectorAll("img")) expect(img.getAttribute("alt")).toBe("");
    const note = story.beats.find((beat) => beat.note)!.note!;
    const to = story.beats.findIndex((beat) => beat.note);
    for (let i = 0; i < to; i++) fireEvent.click(screen.getByRole("button", { name: "Next slide" }));
    expect(screen.getByText(note.t)).toBeTruthy();
    expect(screen.getByText(note.s)).toBeTruthy();
  });

  it("lays the drifting clouds over the crisps story's last photo", () => {
    const story = storyById("crisps")!;
    const { container } = render(<AuthStory story={story} />);
    for (let i = 0; i < story.beats.length - 1; i++) fireEvent.click(screen.getByRole("button", { name: "Next slide" }));
    expect(container.querySelector(".c-story-clouds")).toBeTruthy();
  });

  it("offers the story's bill on an empty screen", () => {
    const add = vi.fn();
    render(<FirstBillCard story={storyById("roast")!} onAdd={add} />);
    expect(screen.getByText("From the story you saw")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Add your first bill" })).toBeTruthy();
    expect(screen.getByText("Ama added food shop and Commune split it in seconds. Yours works the same way.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add a bill" }));
    expect(add).toHaveBeenCalledOnce();
  });

  it("loads with the story's lines, ending on its signature", () => {
    vi.useFakeTimers();
    const story = storyById("football")!;
    const { container } = render(<LoadingLines story={story} />);
    expect(story.lines).toContain(container.textContent);
    for (let i = 0; i < 3; i++) act(() => { vi.advanceTimersByTime(900); });
    expect(container.textContent).toBe("Finding the other shin pad");
  });

  it("keeps the loading page free of actions, with a story line under the placeholders", () => {
    localStorage.setItem("commune.story", "rent");
    const { container } = render(<PendingShell />);
    expect(storyById("rent")!.lines).toContain(container.querySelector(".c-story-loading")?.textContent);
    expect(container.querySelectorAll("button, a, input").length).toBe(0);
  });

  it("has twelve stories", () => {
    expect(STORIES).toHaveLength(12);
  });
});

describe("the invitation panel", () => {
  it("shows the commune and role, never a cast name", () => {
    const { container } = render(<InviteScene communeName="Flat 4" role="Member" />);
    expect(screen.getByText("There's a place for you in Flat 4.")).toBeTruthy();
    expect(screen.getByText("You'll join as a member.")).toBeTruthy();
    for (const name of CAST_NAMES) expect(container.textContent).not.toContain(name);
  });
});
