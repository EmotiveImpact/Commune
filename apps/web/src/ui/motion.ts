import { useLayoutEffect } from "react";

/**
 * Motion for the medium direction of the design panel (11 October 2026):
 * "Recorded, and they know". Three durations and one curve, read from the
 * tokens in styles/shared.css, so the one reduced-motion rule there stops
 * everything here as well. Nothing waits on motion: every helper starts
 * after the change it shows has already happened, and runs beside it.
 */

export type MotionToken = "short" | "medium" | "long";

const FALLBACK_EASE = "cubic-bezier(0.2, 0, 0, 1)";

/** A token's duration in milliseconds; 0 under reduced motion, or where no stylesheet applies. */
export function motionMs(token: MotionToken): number {
  if (typeof document === "undefined" || typeof getComputedStyle !== "function") return 0;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--motion-${token}`).trim();
  if (!raw) return 0;
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return 0;
  return raw.endsWith("ms") ? value : raw.endsWith("s") ? value * 1000 : value;
}

export function motionEase(): string {
  if (typeof document === "undefined" || typeof getComputedStyle !== "function") return FALLBACK_EASE;
  return getComputedStyle(document.documentElement).getPropertyValue("--ease-standard").trim() || FALLBACK_EASE;
}

/** True when nothing should move: the person asked for less motion, or there is no stylesheet. */
export function stillMotion(): boolean {
  return motionMs("medium") === 0;
}

/** Whether the person asked their device for less motion, whatever the tokens say. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function canAnimate(element: Element | null | undefined): element is HTMLElement {
  return element instanceof HTMLElement && typeof element.animate === "function";
}

/** One movement on the shared curve. Returns null when nothing should move. */
export function animate(element: Element | null | undefined, frames: Keyframe[], token: MotionToken | number,
  extra: KeyframeAnimationOptions = {}): Animation | null {
  const duration = typeof token === "number" ? token : motionMs(token);
  if (!duration || !canAnimate(element)) return null;
  return element.animate(frames, { duration, easing: motionEase(), ...extra });
}

const GHOST = "data-motion-ghost";

function markGhost(element: HTMLElement) {
  element.setAttribute(GHOST, "");
  element.setAttribute("aria-hidden", "true");
  element.inert = true;
  for (const named of element.querySelectorAll("[id]")) named.removeAttribute("id");
  if (element.id) element.removeAttribute("id");
}

function translateOf(element: Element): { x: number; y: number } {
  const transform = getComputedStyle(element).transform;
  if (!transform || transform === "none") return { x: 0, y: 0 };
  const match = transform.match(/matrix(3d)?\(([^)]+)\)/);
  if (!match) return { x: 0, y: 0 };
  const values = match[2].split(",").map(Number);
  return match[1] ? { x: values[12] || 0, y: values[13] || 0 } : { x: values[4] || 0, y: values[5] || 0 };
}

/**
 * Keeps a copy of something that is about to leave the page, exactly where it
 * is, and plays its exit over the short time once it has gone. The real
 * element goes at once, so focus and the page behind are free straight away.
 * Call it while the element is still on the page (a layout effect's cleanup);
 * nothing plays if it is still there afterwards, as when React's development
 * checks mount a component twice.
 *
 * Parts marked data-leave say how they go: "scrim" fades; "surface" drops
 * back to the bottom edge when it is a sheet there, and otherwise falls 8px
 * as it fades; "drawer" slides back the way it came. Each starts from where
 * it is now, so closing during an entry reverses it.
 */
export function leaveGhost(root: HTMLElement, options: { backdrop?: boolean } = {}): void {
  const duration = motionMs("short");
  if (!duration || !root.isConnected || typeof document === "undefined") return;
  const parts = [root, ...root.querySelectorAll<HTMLElement>("[data-leave]")].filter((element) => element.hasAttribute("data-leave"));
  if (!parts.length) return;
  const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
  const states = parts.map((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const own = translateOf(element);
    return {
      kind: element.getAttribute("data-leave"),
      // Where it is laid out; its own transform is carried separately.
      top: rect.top - own.y, left: rect.left - own.x, width: rect.width, height: rect.height,
      opacity: style.opacity,
      transform: style.transform,
      scrollTop: element.scrollTop,
      // A sheet sits on the bottom edge, across the whole width.
      sheet: rect.bottom - own.y >= viewportHeight - 2 && rect.width >= viewportWidth - 2,
    };
  });
  const backdrop = options.backdrop ? getComputedStyle(root, "::backdrop") : null;
  const layer = document.createElement("div");
  layer.className = "c-leave-layer";
  markGhost(layer);
  if (backdrop && backdrop.backgroundColor && backdrop.backgroundColor !== "rgba(0, 0, 0, 0)") {
    const scrim = document.createElement("div");
    scrim.className = "c-leave-scrim";
    scrim.setAttribute("data-leave", "scrim");
    scrim.style.background = backdrop.backgroundColor;
    layer.append(scrim);
    states.unshift({ kind: "scrim", top: 0, left: 0, width: viewportWidth, height: viewportHeight,
      opacity: backdrop.opacity || "1", transform: "none", scrollTop: 0, sheet: false });
  }
  const copy = root.cloneNode(true) as HTMLElement;
  markGhost(copy);
  layer.append(copy);
  const parent = root.parentElement;
  queueMicrotask(() => {
    if (root.isConnected) return;
    const host = parent?.isConnected ? parent : document.querySelector(".a-body") ?? document.body;
    host.append(layer);
    const copies = [...layer.querySelectorAll<HTMLElement>("[data-leave]")];
    copies.forEach((element, index) => {
      const state = states[index];
      if (!state) return;
      Object.assign(element.style, {
        position: "fixed", boxSizing: "border-box", margin: "0", inset: "auto",
        top: `${state.top}px`, left: `${state.left}px`, width: `${state.width}px`, height: `${state.height}px`,
        maxWidth: "none", maxHeight: "none", minHeight: "0",
        opacity: state.opacity, transform: state.transform === "none" ? "none" : state.transform,
        transition: "none", animation: "none", pointerEvents: "none",
      });
      if (element.tagName === "DIALOG") element.setAttribute("open", "");
      if (getComputedStyle(element).display === "none") element.style.display = "block";
    });
    // A transformed ancestor moves fixed boxes: put each copy back where the original was.
    copies.forEach((element, index) => {
      const state = states[index];
      if (!state) return;
      const at = element.getBoundingClientRect();
      const own = translateOf(element);
      const dx = state.left - (at.left - own.x);
      const dy = state.top - (at.top - own.y);
      if (Math.abs(dx) > 0.5) element.style.left = `${state.left + dx}px`;
      if (Math.abs(dy) > 0.5) element.style.top = `${state.top + dy}px`;
      element.scrollTop = state.scrollTop;
    });
    void layer.offsetHeight;
    const ease = motionEase();
    copies.forEach((element, index) => {
      const state = states[index];
      if (!state) return;
      element.style.transition = `opacity ${duration}ms ${ease}, transform ${duration}ms ${ease}`;
      if (state.kind === "scrim") element.style.opacity = "0";
      else if (state.kind === "drawer") element.style.transform = "translateX(-100%)";
      else if (state.sheet) element.style.transform = "translateY(100%)";
      else { element.style.opacity = "0"; element.style.transform = "translateY(8px)"; }
    });
    window.setTimeout(() => layer.remove(), duration + 60);
  });
}

/** Plays an element's exit when the component holding it unmounts. */
export function useLeaveGhost(ref: { current: HTMLElement | null }, options: { backdrop?: boolean } = {}): void {
  const backdrop = Boolean(options.backdrop);
  useLayoutEffect(() => {
    const element = ref.current;
    return () => { if (element) leaveGhost(element, { backdrop }); };
  }, [ref, backdrop]);
}

/**
 * Switching commune: what is on screen now fades out over the medium time
 * while the next commune's content fades in under it. Call it just before
 * the switch; the new content's fade starts on the next frame.
 */
export function crossFadeContent(selector = "#main-content"): void {
  const duration = motionMs("medium");
  const main = typeof document === "undefined" ? null : document.querySelector<HTMLElement>(selector);
  if (!duration || !main || !main.parentElement) return;
  const rect = main.getBoundingClientRect();
  const copy = main.cloneNode(true) as HTMLElement;
  markGhost(copy);
  Object.assign(copy.style, {
    position: "fixed", boxSizing: "border-box", margin: "0", top: `${rect.top}px`, left: `${rect.left}px`,
    width: `${rect.width}px`, height: `${Math.min(rect.height, window.innerHeight - rect.top)}px`, overflow: "hidden",
    pointerEvents: "none", zIndex: "2", background: getComputedStyle(main).backgroundColor,
  });
  main.parentElement.append(copy);
  const out = animate(copy, [{ opacity: 1 }, { opacity: 0 }], duration, { fill: "forwards" });
  if (out) out.finished.then(() => copy.remove(), () => copy.remove()); else copy.remove();
  requestAnimationFrame(() => {
    const fresh = document.querySelector<HTMLElement>(selector);
    animate(fresh, [{ opacity: 0 }, { opacity: 1 }], duration);
  });
}

/* ---------- The row answers in place, and rows that leave fold away ---------- */

type Box = { top: number; left: number; width: number; height: number };
type Answer = { text: string; copy: HTMLElement; height: number };

// Rows say so with data-flip; a screen's own blocks, three levels down, are
// followed too, so whatever sits below a change makes room instead of jumping.
const FLIP = "[data-flip], .screen > *, .screen > * > *, .screen > * > * > *";
const ANSWER = "[data-answer]";
const BOX = "[data-flip-box]";
// Motion follows a person's own act. Changes that arrive on their own
// (a background refresh, a photo loading) settle without moving.
const AFTER_INPUT_MS = 12000;

function ownText(element: Element): string {
  let text = "";
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => node instanceof Element && node.hasAttribute(GHOST) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  for (let node = walker.nextNode(); node; node = walker.nextNode()) if (node.nodeType === Node.TEXT_NODE) text += node.nodeValue;
  return text.replace(/\s+/g, " ").trim();
}

function visible(box: Box | undefined): box is Box {
  return Boolean(box && (box.width > 0 || box.height > 0));
}

/**
 * Watches one part of the page and, after something the person did, lets
 * what changed move instead of jump: what moved slides from where it was
 * (with transforms, so nothing shifts under the finger), what arrived fades
 * in over the short time, what left folds away over the medium time, and a
 * row whose words changed cross-fades them under a sage layer that fades
 * from 10 per cent to nothing over the long time.
 */
export class LayoutMotion {
  private boxes = new Map<Element, Box>();
  private answers = new Map<Element, Answer>();
  private flips = new Map<Element, Animation>();
  private scroll = 0;
  private baseScroll = 0;
  private lastInput = -Infinity;
  private observer: MutationObserver | null = null;
  private frame = 0;
  private cleanups: Array<() => void> = [];

  constructor(private root: HTMLElement) {}

  start(): () => void {
    if (typeof MutationObserver === "undefined" || typeof window === "undefined") return () => {};
    this.scroll = window.scrollY;
    this.measure();
    this.observer = new MutationObserver((records) => this.changed(records));
    this.observer.observe(this.root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class", "hidden"] });
    const input = () => { this.lastInput = performance.now(); };
    const onScroll = () => {
      this.scroll = window.scrollY;
      if (this.frame) return;
      this.frame = requestAnimationFrame(() => { this.frame = 0; this.measure(false); });
    };
    const onResize = () => this.measure(false);
    document.addEventListener("pointerdown", input, true);
    document.addEventListener("keydown", input, true);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    this.cleanups.push(() => {
      document.removeEventListener("pointerdown", input, true);
      document.removeEventListener("keydown", input, true);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    });
    return () => this.stop();
  }

  stop() {
    this.observer?.disconnect();
    this.observer = null;
    if (this.frame) cancelAnimationFrame(this.frame);
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups = [];
  }

  /** Where each tracked element sits without the movement this class added. */
  private layoutBox(element: Element): Box {
    const rect = element.getBoundingClientRect();
    let x = 0, y = 0;
    for (let node: Element | null = element; node && node !== this.root; node = node.parentElement) {
      if (this.flips.has(node)) { const t = translateOf(node); x += t.x; y += t.y; }
    }
    return { top: rect.top - y, left: rect.left - x, width: rect.width, height: rect.height };
  }

  private visualBox(element: Element, box: Box): Box {
    let x = 0, y = 0;
    for (let node: Element | null = element; node && node !== this.root; node = node.parentElement) {
      if (this.flips.has(node)) { const t = translateOf(node); x += t.x; y += t.y; }
    }
    return { ...box, top: box.top + y, left: box.left + x };
  }

  private measure(texts = true) {
    this.boxes = new Map();
    for (const element of this.root.querySelectorAll(FLIP)) {
      if (element.closest(`[${GHOST}]`)) continue;
      this.boxes.set(element, this.layoutBox(element));
    }
    this.baseScroll = this.scroll;
    if (!texts) return;
    this.answers = new Map();
    for (const element of this.root.querySelectorAll<HTMLElement>(ANSWER)) {
      if (element.closest(`[${GHOST}]`)) continue;
      this.answers.set(element, { text: ownText(element), copy: element.cloneNode(true) as HTMLElement, height: element.offsetHeight });
    }
  }

  private changed(records: MutationRecord[]) {
    const ours = (node: Node) => node instanceof Element && (node.hasAttribute(GHOST) || Boolean(node.closest?.(`[${GHOST}]`)));
    const relevant = records.filter((record) => !ours(record.target)
      && !([...record.addedNodes, ...record.removedNodes].length > 0 && [...record.addedNodes, ...record.removedNodes].every(ours)));
    if (!relevant.length) return;
    const recent = performance.now() - this.lastInput < AFTER_INPUT_MS;
    if (!recent || stillMotion()) { this.measure(); return; }
    // Where things were, as they were last painted, in today's scroll position.
    const scrolled = this.scroll - this.baseScroll;
    const before = new Map<Element, Box>();
    for (const [element, box] of this.boxes) {
      const seen = this.visualBox(element, box);
      before.set(element, { ...seen, top: seen.top - scrolled });
    }
    const answersBefore = this.answers;
    const removed: Array<{ element: HTMLElement; parent: Node; next: Node | null }> = [];
    for (const record of relevant) {
      for (const node of record.removedNodes) {
        if (node instanceof HTMLElement && before.has(node) && !node.isConnected) removed.push({ element: node, parent: record.target, next: record.nextSibling });
      }
    }
    for (const animation of this.flips.values()) animation.cancel();
    this.flips.clear();
    this.measure();
    const now = this.boxes;
    const gone = [...before.keys()].filter((element) => !element.isConnected).length;
    // A whole screen or commune swapped: nothing to follow from one to the other.
    if (gone >= 4 && gone >= before.size / 2) return;
    this.fold(removed, before);
    this.slide(before, now);
    this.answer(answersBefore);
  }

  private slide(before: Map<Element, Box>, now: Map<Element, Box>) {
    const medium = motionMs("medium");
    const short = motionMs("short");
    const ease = motionEase();
    const applied = new Map<Element, { x: number; y: number }>();
    const entering = new Set<Element>();
    for (const [element, box] of now) {
      if (!visible(box)) continue;
      const old = before.get(element);
      let parent = element.parentElement?.closest(FLIP) ?? null;
      while (parent && !this.root.contains(parent)) parent = null;
      if (!visible(old)) {
        if (parent && entering.has(parent)) continue;
        entering.add(element);
        animate(element, [{ opacity: 0 }, { opacity: 1 }], short);
        continue;
      }
      const inherited = parent ? applied.get(parent) ?? { x: 0, y: 0 } : { x: 0, y: 0 };
      const x = old.left - box.left - inherited.x;
      const y = old.top - box.top - inherited.y;
      applied.set(element, { x: x + inherited.x, y: y + inherited.y });
      if (Math.abs(x) < 1 && Math.abs(y) < 1) continue;
      if (!canAnimate(element)) continue;
      const animation = element.animate([{ transform: `translate(${x}px, ${y}px)` }, { transform: "none" }], { duration: medium, easing: ease });
      this.flips.set(element, animation);
      animation.finished.then(() => { if (this.flips.get(element) === animation) this.flips.delete(element); }, () => {});
    }
    for (const [element, box] of now) {
      if (!element.matches(BOX) || !visible(box)) continue;
      const old = before.get(element);
      if (!visible(old) || Math.abs(old.height - box.height) < 1) continue;
      if (box.height > old.height) this.grow(element as HTMLElement, old.height, box.height);
      else this.shrink(element as HTMLElement, old.height, box.height);
    }
  }

  /** A box that grew is revealed downwards over the medium time. */
  private grow(element: HTMLElement, from: number, to: number) {
    const radius = getComputedStyle(element).borderRadius || "0";
    animate(element, [{ clipPath: `inset(0 0 ${to - from}px 0 round ${radius})` }, { clipPath: `inset(0 0 0 0 round ${radius})` }], "medium");
  }

  /** A box that shrank keeps a plate of its surface, which closes up over the medium time. */
  private shrink(element: HTMLElement, from: number, to: number) {
    const duration = motionMs("medium");
    if (!duration) return;
    const style = getComputedStyle(element);
    const plate = document.createElement("i");
    plate.className = "c-flip-plate";
    markGhost(plate);
    Object.assign(plate.style, {
      height: `${from}px`, background: style.background, backgroundColor: style.backgroundColor,
      boxShadow: style.boxShadow, borderRadius: style.borderRadius, border: style.border,
    });
    const keep = {
      position: element.style.position, isolation: element.style.isolation, overflow: element.style.overflow,
      background: element.style.background, boxShadow: element.style.boxShadow, borderColor: element.style.borderColor,
    };
    if (style.position === "static") element.style.position = "relative";
    Object.assign(element.style, { isolation: "isolate", overflow: "visible", background: "transparent", boxShadow: "none", borderColor: "transparent" });
    element.prepend(plate);
    const done = () => { plate.remove(); Object.assign(element.style, keep); };
    const animation = animate(plate, [{ height: `${from}px` }, { height: `${to}px` }], duration);
    if (animation) animation.finished.then(done, done); else done();
  }

  /** Rows that left fold away where they were while the rest closes up. */
  private fold(removed: Array<{ element: HTMLElement; parent: Node; next: Node | null }>, before: Map<Element, Box>) {
    const duration = motionMs("medium");
    if (!duration) return;
    // Only the outermost of what left; its rows go with it.
    const outer = removed.filter(({ element }) => !removed.some((other) => other.element !== element && other.element.contains(element)));
    for (const { element, parent, next } of outer) {
      const box = before.get(element);
      if (!visible(box) || !(parent instanceof Element) || !parent.isConnected) continue;
      const ghost = element.cloneNode(true) as HTMLElement;
      markGhost(ghost);
      Object.assign(ghost.style, {
        position: "fixed", boxSizing: "border-box", margin: "0", top: `${box.top}px`, left: `${box.left}px`,
        width: `${box.width}px`, height: `${box.height}px`, pointerEvents: "none", zIndex: "0",
      });
      parent.insertBefore(ghost, next && next.parentNode === parent ? next : null);
      const at = ghost.getBoundingClientRect();
      if (Math.abs(at.top - box.top) > 0.5) ghost.style.top = `${box.top * 2 - at.top}px`;
      if (Math.abs(at.left - box.left) > 0.5) ghost.style.left = `${box.left * 2 - at.left}px`;
      const animation = animate(ghost, [
        { opacity: 1, clipPath: "inset(0 0 0 0)" },
        { opacity: 0, clipPath: "inset(0 0 100% 0)" },
      ], duration, { fill: "forwards" });
      if (animation) animation.finished.then(() => ghost.remove(), () => ghost.remove());
      else ghost.remove();
    }
  }

  /** A row that stayed but whose words changed: old words fade out over new, under a passing sage layer. */
  private answer(before: Map<Element, Answer>) {
    const short = motionMs("short");
    if (!short) return;
    for (const [element, old] of before) {
      if (!element.isConnected || !(element instanceof HTMLElement)) continue;
      const fresh = this.answers.get(element);
      if (!fresh || fresh.text === old.text) continue;
      const overlay = old.copy;
      markGhost(overlay);
      overlay.classList.add("c-answer-old");
      overlay.removeAttribute("data-flip");
      overlay.removeAttribute("data-answer");
      for (const inner of overlay.querySelectorAll("[data-flip], [data-answer]")) { inner.removeAttribute("data-flip"); inner.removeAttribute("data-answer"); }
      if (getComputedStyle(element).position === "static") element.style.position = "relative";
      for (const child of element.children) if (!child.hasAttribute(GHOST)) animate(child, [{ opacity: 0 }, { opacity: 1 }], short);
      element.append(overlay);
      const out = animate(overlay, [{ opacity: 1 }, { opacity: 0 }], short, { fill: "forwards" });
      if (out) out.finished.then(() => overlay.remove(), () => overlay.remove()); else overlay.remove();
      if (element.getAttribute("data-answer") === "wash") {
        const wash = document.createElement("i");
        wash.className = "c-answer-wash";
        markGhost(wash);
        element.append(wash);
        const fade = animate(wash, [{ opacity: 1 }, { opacity: 0 }], "long", { fill: "forwards" });
        if (fade) fade.finished.then(() => wash.remove(), () => wash.remove()); else wash.remove();
      }
    }
  }
}

/** Lets one part of the page answer in place for as long as it is shown. */
export function useLayoutMotion(ref: { current: HTMLElement | null }): void {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    return new LayoutMotion(element).start();
  }, [ref]);
}
