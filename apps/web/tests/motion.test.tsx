import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "../src/ui/components";
import { leaveGhost, motionMs, stillMotion } from "../src/ui/motion";
import { currentToast, hideToast, namesInWords, showToast, ToastHost, TOAST_MS, TOAST_UNDO_MS } from "../src/ui/Toast";

// The design panel's medium direction (11 October 2026): three durations from
// shared.css, one rule that stops them all, a dialog that leaves as a copy,
// and one toast for every recording act.

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); } });
});
afterEach(() => {
  cleanup();
  hideToast();
  vi.useRealTimers();
  document.documentElement.style.removeProperty("--motion-short");
  document.documentElement.style.removeProperty("--motion-medium");
});

describe("motion tokens", () => {
  const shared = readFileSync(resolve(process.cwd(), "src/styles/shared.css"), "utf8");

  it("are three durations and one curve, and one reduced-motion rule sets all three to 0ms", () => {
    expect(shared).toMatch(/--motion-short:\s*150ms/);
    expect(shared).toMatch(/--motion-medium:\s*250ms/);
    expect(shared).toMatch(/--motion-long:\s*400ms/);
    expect(shared).toMatch(/--ease-standard:\s*cubic-bezier\(0\.2, 0, 0, 1\)/);
    const reduced = shared.match(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*:root\s*\{([^}]*)\}/);
    expect(reduced?.[1]).toMatch(/--motion-short:\s*0ms/);
    expect(reduced?.[1]).toMatch(/--motion-medium:\s*0ms/);
    expect(reduced?.[1]).toMatch(/--motion-long:\s*0ms/);
  });

  it("stop the spinner's turning under reduced motion, and nothing else in the app sets its own duration", () => {
    const motion = readFileSync(resolve(process.cwd(), "src/styles/motion.css"), "utf8");
    const reduced = motion.slice(motion.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toContain("c-spin-show");
    expect(reduced.slice(0, reduced.indexOf("}\n}"))).not.toContain("c-spin 0.8s");
    for (const path of ["src/styles/app.css", "src/styles/design-system.css", "src/screens/Home.css"]) {
      const css = readFileSync(resolve(process.cwd(), path), "utf8");
      expect(css, path).not.toMatch(/(transition|animation):[^;]*\b\d+ms/);
    }
  });

  it("read as 0 where they are 0, so every helper stands still", () => {
    document.documentElement.style.setProperty("--motion-short", "0ms");
    document.documentElement.style.setProperty("--motion-medium", "0ms");
    expect(motionMs("short")).toBe(0);
    expect(stillMotion()).toBe(true);
    document.documentElement.style.setProperty("--motion-short", "150ms");
    expect(motionMs("short")).toBe(150);
  });
});

function DialogHarness() {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)}>Open it</button>
    {open ? <Dialog title="Record a repayment" onClose={() => setOpen(false)}>
      <button type="button" onClick={() => setOpen(false)}>Done here</button>
    </Dialog> : null}
  </>;
}

describe("a dialog's closing state", () => {
  it("leaves at once, with focus back on its opener, while a copy plays the exit over the short time", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    document.documentElement.style.setProperty("--motion-short", "150ms");
    render(<DialogHarness />);
    const opener = screen.getByRole("button", { name: "Open it" });
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByRole("dialog", { name: "Record a repayment" })).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Done here" })); });
    // The real dialog has gone, and focus is back where it started.
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
    // Its copy is inert and hidden from assistive technology while it leaves.
    const layer = document.querySelector<HTMLElement>(".c-leave-layer");
    expect(layer).not.toBeNull();
    expect(layer?.getAttribute("aria-hidden")).toBe("true");
    expect(layer?.inert).toBe(true);
    expect(layer?.querySelector("[id]")).toBeNull();
    act(() => { vi.advanceTimersByTime(250); });
    expect(document.querySelector(".c-leave-layer")).toBeNull();
  });

  it("plays no copy when motion is reduced", async () => {
    document.documentElement.style.setProperty("--motion-short", "0ms");
    render(<DialogHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Open it" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Done here" })); });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelector(".c-leave-layer")).toBeNull();
  });

  it("keeps no copy of something that is still on the page", async () => {
    document.documentElement.style.setProperty("--motion-short", "150ms");
    const box = document.createElement("div");
    box.setAttribute("data-leave", "surface");
    document.body.append(box);
    leaveGhost(box);
    await Promise.resolve();
    expect(document.querySelector(".c-leave-layer")).toBeNull();
    box.remove();
  });

  it("still asks before closing over typed text", () => {
    render(<DialogHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Open it" }));
    const dialog = screen.getByRole("dialog", { name: "Record a repayment" });
    const field = document.createElement("input");
    dialog.append(field);
    fireEvent.input(field, { target: { value: "25.00" } });
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(screen.getByRole("dialog", { name: "Discard your changes?" })).toBeTruthy();
  });
});

describe("the toast", () => {
  it("says one line in a status region that is always there, with no action unless given one", () => {
    render(<ToastHost />);
    const region = screen.getByRole("status");
    expect(region.textContent).toBe("");
    act(() => showToast({ text: "Recorded. Sam will confirm your £16.00." }));
    expect(region.textContent).toBe("Recorded. Sam will confirm your £16.00.");
    expect(region.querySelector("button")).toBeNull();
  });

  it("stays six seconds, or nine with Undo", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    render(<><button type="button">Elsewhere</button><ToastHost /></>);
    // Focus is still somewhere useful, so Undo does not take it.
    screen.getByRole("button", { name: "Elsewhere" }).focus();
    act(() => showToast({ text: "Milk and bread added." }));
    act(() => { vi.advanceTimersByTime(TOAST_MS - 10); });
    expect(currentToast()).not.toBeNull();
    act(() => { vi.advanceTimersByTime(20); });
    expect(currentToast()).toBeNull();
    act(() => showToast({ text: "Put the bins out marked done.", action: { label: "Undo", undo: true, run: () => undefined } }));
    act(() => { vi.advanceTimersByTime(TOAST_MS + 10); });
    expect(currentToast()).not.toBeNull();
    act(() => { vi.advanceTimersByTime(TOAST_UNDO_MS - TOAST_MS); });
    expect(currentToast()).toBeNull();
  });

  it("hands Undo the focus when the act took away the control that had it", () => {
    render(<ToastHost />);
    (document.activeElement as HTMLElement | null)?.blur();
    act(() => showToast({ text: "Put the bins out marked done.", action: { label: "Undo", undo: true, run: () => undefined } }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Undo" }));
  });

  it("pauses while the pointer or focus is on it", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    render(<ToastHost />);
    act(() => showToast({ text: "Confirmed. Jordan’s £21.60 is recorded as received.", action: { label: "View", run: () => undefined } }));
    const toast = document.querySelector<HTMLElement>(".c-toast")!;
    fireEvent.pointerEnter(toast);
    act(() => { vi.advanceTimersByTime(20_000); });
    expect(currentToast()).not.toBeNull();
    fireEvent.pointerLeave(toast);
    const view = screen.getByRole("button", { name: "View" });
    act(() => view.focus());
    act(() => { vi.advanceTimersByTime(20_000); });
    expect(currentToast()).not.toBeNull();
    act(() => view.blur());
    act(() => { vi.advanceTimersByTime(TOAST_MS + 10); });
    expect(currentToast()).toBeNull();
  });

  it("runs its action once, saying what it is doing, then gives way to what the action says", async () => {
    let finish!: () => void;
    const run = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<ToastHost />);
    act(() => showToast({ text: "Put the bins out marked done.", action: { label: "Undo", busyLabel: "Undoing…", undo: true, run } }));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    const busy = screen.getByRole("button", { name: "Undoing…" }) as HTMLButtonElement;
    expect([busy.disabled, busy.getAttribute("aria-busy")]).toEqual([true, "true"]);
    fireEvent.click(busy);
    expect(run).toHaveBeenCalledTimes(1);
    await act(async () => { showToast({ text: "Undone. The task is back as it was." }); finish(); });
    expect(screen.getByRole("status").textContent).toBe("Undone. The task is back as it was.");
  });

  it("names people as a sentence does", () => {
    expect(namesInWords(["Sam"])).toBe("Sam");
    expect(namesInWords(["Sam", "Alex"])).toBe("Sam and Alex");
    expect(namesInWords(["Sam", "Alex", "Jordan"])).toBe("Sam, Alex and Jordan");
    expect(namesInWords(["Sam", "Alex", "Jordan", "Priya", "Lee"])).toBe("Sam, Alex, Jordan and 2 others");
  });
});
