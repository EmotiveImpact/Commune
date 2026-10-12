import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { advance, hits, jump, layoutFor, metres, newRun, type Obstacle } from "../src/shell/streetRunner";
import { StreetScene } from "../src/shell/StreetScene";
import { ConnectionRecovery } from "../src/shell/ConnectionRecovery";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const layout = layoutFor(720, 480);
const obstacle = (type: Obstacle["type"], x: number): Obstacle => ({ type, x, w: type === "puddle" ? 16 : type === "bird" ? 11 : 9, h: type === "bird" ? 6 : type === "puddle" ? 0 : 14, extra: 0 });

describe("street runner", () => {
  it("ends a run that never jumps at the first bin", () => {
    const run = newRun();
    let hit = null;
    for (let i = 0; i < 600 && !hit; i++) hit = advance(run, layout, 1 / 60, () => 0);
    expect(hit).toBe("bin");
    expect(metres(run.distance)).toBeGreaterThan(5);
  });

  it("clears bin after bin with well-timed jumps", () => {
    const run = newRun();
    let hit = null;
    for (let i = 0; i < 60 * 20 && !hit; i++) {
      const next = run.obstacles.find((o) => o.x + o.w > layout.runnerX);
      if (next && next.x - (layout.runnerX + 8) < run.speed * 0.1) jump(run);
      hit = advance(run, layout, 1 / 60, () => 0);
    }
    expect(hit).toBeNull();
    expect(metres(run.distance)).toBeGreaterThan(150);
  });

  it("is safe under a low pigeon but not when jumping into it", () => {
    const run = newRun();
    const bird = obstacle("bird", layout.runnerX + 2);
    expect(hits(run, layout, bird)).toBe(false);
    run.lift = 12;
    expect(hits(run, layout, bird)).toBe(true);
  });

  it("splashes through a puddle only on the ground", () => {
    const run = newRun();
    const puddle = obstacle("puddle", layout.runnerX - 4);
    expect(hits(run, layout, puddle)).toBe(true);
    run.lift = 2;
    expect(hits(run, layout, puddle)).toBe(false);
  });

  it("always leaves room to react before the next obstacle", () => {
    const run = newRun();
    let previous: Obstacle | undefined;
    for (let i = 0; i < 60 * 30; i++) {
      run.lift = 50; // flying over everything, to see every gap
      advance(run, layout, 1 / 60, Math.random);
      const latest = run.obstacles[run.obstacles.length - 1];
      if (latest && latest !== previous && previous) {
        expect(latest.x - (previous.x + previous.w)).toBeGreaterThanOrEqual(run.speed * 0.6);
      }
      previous = latest;
    }
  });
});

describe("street scene", () => {
  it("starts with Space, pauses with Escape and when the page is hidden", () => {
    render(<StreetScene label="Street runner"><h1>We couldn’t connect</h1></StreetScene>);
    expect(screen.getByText("Press Space or tap the street to run")).toBeTruthy();
    expect(screen.getByText("Best 0 m")).toBeTruthy();
    fireEvent.keyDown(document.body, { key: " " });
    expect(screen.queryByText("Press Space or tap the street to run")).toBeNull();
    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.getByText("Paused. Space or tap to carry on.")).toBeTruthy();
    fireEvent.keyDown(document.body, { key: " " });
    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    fireEvent(document, new Event("visibilitychange"));
    expect(screen.getByRole("button", { name: "Resume" })).toBeTruthy();
  });

  it("leaves Space to a focused button", () => {
    render(<StreetScene label="Street runner"><button type="button">Try again</button></StreetScene>);
    const button = screen.getByRole("button", { name: "Try again" });
    button.focus();
    fireEvent.keyDown(button, { key: " " });
    expect(screen.getByText("Press Space or tap the street to run")).toBeTruthy();
  });

  it("keeps a run going when the connection returns, and opens Commune when asked", async () => {
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const retry = vi.fn().mockResolvedValue(undefined);
    render(<ConnectionRecovery retry={retry} signOut={vi.fn()} />);
    fireEvent.keyDown(document.body, { key: " " });
    online.mockReturnValue(true);
    fireEvent(window, new Event("online"));
    expect(screen.getByRole("heading", { name: "You’re back online" })).toBeTruthy();
    expect(retry).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Open Commune" })); });
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
