// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const html = readFileSync(resolve(process.cwd(), "reference/design-language/index.html"), "utf8");
let dom: JSDOM;
const find = (selector: string) => dom.window.document.querySelector(selector) as HTMLElement;
const click = (selector: string) => find(selector).click();
const mode = (value: string) => {
  (find("#nudge-mode") as HTMLSelectElement).value = value;
  find("#nudge-mode").dispatchEvent(new dom.window.Event("change", { bubbles: true }));
};
beforeEach(() => {
  vi.useFakeTimers();
  dom = new JSDOM(html, {
    url: "http://localhost:3000/reference/design-language/index.html#states",
    runScripts: "dangerously",
    beforeParse(window) {
      window.setTimeout = setTimeout as unknown as typeof window.setTimeout;
      window.clearTimeout = clearTimeout as unknown as typeof window.clearTimeout;
      window.scrollTo = vi.fn();
      window.HTMLElement.prototype.scrollIntoView = vi.fn();
      window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
      window.HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
    },
  });
});
afterEach(() => { dom.window.close(); vi.useRealTimers(); });

describe("design language reference", () => {
  it("restores States as a third standalone panel and deep-links directly to it", () => {
    expect([...dom.window.document.querySelectorAll('[role="tab"]')].map(tab => tab.textContent!.trim())).toEqual(["In context", "Components", "States"]);
    expect(find("#states").hidden).toBe(false);
    expect(find("#hub").hidden).toBe(true);
    expect(find("#states").parentElement).toBe(find("#kit").parentElement);
    expect(find("#tab-states").getAttribute("aria-selected")).toBe("true");
  });
  it("supports three-tab roving focus, wraparound, Home and End", () => {
    const key = (id: string, key: string) => find(id).dispatchEvent(new dom.window.KeyboardEvent("keydown", { key, bubbles: true }));
    key("#tab-states", "ArrowRight");
    expect(dom.window.document.activeElement).toBe(find("#tab-hub"));
    key("#tab-hub", "ArrowLeft");
    expect(dom.window.document.activeElement).toBe(find("#tab-states"));
    key("#tab-states", "Home");
    key("#tab-hub", "ArrowRight");
    expect(dom.window.document.activeElement).toBe(find("#tab-kit"));
    key("#tab-kit", "End");
    expect([...dom.window.document.querySelectorAll('[role="tab"]')].filter(tab => (tab as HTMLElement).tabIndex === 0)).toEqual([find("#tab-states")]);
  });
  it("shows validation, a pending guard and local-only success while preserving input", () => {
    click("#sample-save");
    expect(find("#sample-error").hidden).toBe(false);
    const input = find("#sample-title") as HTMLInputElement;
    input.value = "Weekly shop";
    input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    expect(find("#sample-count").textContent).toBe("11 / 80");
    expect(input.maxLength).toBe(80);
    click("#sample-save");
    expect((find("#sample-save") as HTMLButtonElement).disabled).toBe(true);
    expect(find("#sample-form").getAttribute("aria-busy")).toBe("true");
    vi.advanceTimersByTime(800);
    expect(find("#sample-success").hidden).toBe(false);
    expect(find("#sample-success").textContent).toContain("No expense was created");
    expect(input.value).toBe("Weekly shop");
  });
  it.each(["cooldown", "limit", "pending", "success"])("disables reminder submission in the %s state", state => {
    mode(state);
    expect(find("#nudge-panel").hidden).toBe(false);
    expect((find("#send-nudge") as HTMLButtonElement).disabled).toBe(true);
    if (state === "pending") {
      click("#cancel-nudge");
      expect(find("#nudge-panel").hidden).toBe(false);
    }
  });
  it("does not reduce allowance on failure and preserves the reminder subject", () => {
    mode("error");
    expect(find("#nudge-error").hidden).toBe(false);
    expect(find("#nudge-allowance").textContent).toContain("58 of 60");
    expect(find("#nudge-panel").textContent).toContain("Household supplies · £18.00");
    expect((find("#send-nudge") as HTMLButtonElement).disabled).toBe(false);
  });
  it("blocks duplicate sends, updates allowance only on acceptance and restores focus on close", () => {
    click("#open-nudge");
    click("#send-nudge");
    expect(find("#nudge-allowance").textContent).toContain("58 of 60");
    expect((find("#close-nudge") as HTMLButtonElement).disabled).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(find("#nudge-allowance").textContent).toContain("57 of 60");
    expect(find("#nudge-result").textContent).toContain("No real reminder or email was sent");
    click("#close-nudge");
    expect(find("#nudge-panel").hidden).toBe(true);
    // jsdom has no rendered offsetParent: use the accessible tab fallback.
    expect(dom.window.document.activeElement).toBe(find("#tab-states"));
  });
  it("labels unimplemented targets and makes no API or storage writes", () => {
    expect(find("#state-settle").textContent).toContain("not yet implemented app screens");
    expect(find("#state-coverage").textContent).toContain("not a claim that every example here is shipped");
    const script = dom.window.document.querySelector("script")!.textContent!;
    expect(script).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage/);
    expect(html).not.toContain("typography.css");
    expect(html).toContain("font-weight: 450;");
    expect(html).toContain("font-weight: 550;");
    expect(find(".account small").textContent).toBe("Admin");
  });
});
