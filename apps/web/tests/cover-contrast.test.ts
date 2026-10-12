// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Text over commune photos, on the communes' cards, Home's all-square photo and
// the Hub hero, measured over a
// bright stand-in photo: pure white, the worst a photo can be behind light text. Small text needs 4.5:1; large text (24px, or 19px bold) and buttons 3:1.
const readStyle = (path: string) => readFileSync(resolve(process.cwd(), "src", path), "utf8");
const styles = { app: readStyle("styles/app.css"), home: readStyle("screens/Home.css"), hub: readStyle("screens/Hub.css") };

function declarations(sheet: keyof typeof styles, selector: string) {
  const source = `\n${styles[sheet]}`;
  const start = source.indexOf(`\n${selector} {`);
  if (start < 0) throw new Error(`Missing ${selector} in ${sheet}`);
  return source.slice(source.indexOf("{", start) + 1, source.indexOf("}", start));
}
function property(sheet: keyof typeof styles, selector: string, name: string) {
  const match = declarations(sheet, selector).match(new RegExp(`(?:^|[;\\s])${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`Missing ${name} for ${selector}`);
  return match[1].trim();
}

type Colour = { rgb: [number, number, number]; alpha: number };
function colour(value: string): Colour {
  if (value === "transparent") return { rgb: [0, 0, 0], alpha: 0 };
  const short = value.match(/^#([0-9a-f]{3,4})$/i);
  if (short) return colour(`#${[...short[1]].map((digit) => digit + digit).join("")}`);
  const hex = value.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (hex) {
    const [r, g, b] = [0, 2, 4].map((at) => parseInt(hex[1].slice(at, at + 2), 16));
    return { rgb: [r, g, b], alpha: hex[2] ? parseInt(hex[2], 16) / 255 : 1 };
  }
  const rgba = value.match(/^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)$/);
  if (!rgba) throw new Error(`Not a colour: ${value}`);
  return { rgb: [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])], alpha: rgba[4] === undefined ? 1 : Number(rgba[4]) };
}
const white: Colour["rgb"] = [255, 255, 255];
const over = (top: Colour, below: Colour["rgb"]) =>
  below.map((channel, index) => top.alpha * top.rgb[index] + (1 - top.alpha) * channel) as Colour["rgb"];
const luminance = (rgb: Colour["rgb"]) => {
  const [r, g, b] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: Colour["rgb"], b: Colour["rgb"]) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};

/** A shade's colour and its opacity at a height above the cover's bottom edge. */
function shade(value: string) {
  const parts = value.replace(/^linear-gradient\(/, "").replace(/\)$/, "").split(/,\s*(?![^(]*\))/);
  const direction = parts.shift()?.trim();
  expect(["0deg", "180deg"]).toContain(direction);
  const stops = parts.map((part, index) => {
    const [, paint, at] = part.trim().match(/^(.*?\)|#[0-9a-f]+|transparent)(?:\s+(\S+))?$/i)!;
    // Without a position, the first stop is at the start and the last at the end.
    return { paint: colour(paint), at: at ?? (index === 0 ? "0" : "100%") };
  });
  const tone = stops.find((stop) => stop.paint.alpha > 0)!.paint.rgb;
  // Every stop is the same colour, or clear: only the opacity changes.
  expect(stops.every((stop) => stop.paint.alpha === 0 || stop.paint.rgb.join() === tone.join())).toBe(true);
  return (height: number, cover: number) => {
    const from = direction === "0deg" ? height : cover - height;
    const points = stops.map(({ paint, at }) => ({
      alpha: paint.alpha,
      at: at.endsWith("%") ? cover * Number(at.slice(0, -1)) / 100 : Number(at.replace(/px$/, "")),
    }));
    let alpha = points[0].alpha;
    for (let index = 1; index < points.length; index += 1) {
      const [a, b] = [points[index - 1], points[index]];
      if (from >= b.at) alpha = b.alpha;
      else if (from > a.at) alpha = a.alpha + (b.alpha - a.alpha) * (from - a.at) / (b.at - a.at);
    }
    return { rgb: tone, alpha };
  };
}

type Line = { name: string; from: number; to: number; text: Colour; target: number };
/** The weakest contrast along each line of text, over the shade and a white photo. */
function weakest(lines: Line[], cover: number, shadeAt: ReturnType<typeof shade>) {
  return Object.fromEntries(lines.map(({ name, from, to, text, target }) => {
    let lowest = Infinity;
    for (let step = 0; step <= 20; step += 1) {
      const background = over(shadeAt(from + (to - from) * step / 20, cover), white);
      lowest = Math.min(lowest, ratio(over(text, background), background));
    }
    return [name, { contrast: Number(lowest.toFixed(2)), target }];
  }));
}
const failures = (result: Record<string, { contrast: number; target: number }>) =>
  Object.entries(result).filter(([, { contrast, target }]) => contrast < target);

/**
 * Lines of text stacked up from the cover's bottom padding: each line's height
 * (font size times a normal line height of 1.2, or the stated line height) and
 * the gap below it, from the rules for each element.
 */
function stack(padding: number, items: Array<{ name: string; line: number; gap: number; text: Colour; target: number; lines?: number }>) {
  let at = padding;
  return items.map(({ name, line, gap, text, target, lines = 1 }) => {
    at += gap;
    const row = { name, from: at, to: at + line * lines, text, target };
    at = row.to;
    return row;
  });
}

const light = colour("#f8f5f0");
const withOpacity = (value: Colour, opacity: number) => ({ ...value, alpha: value.alpha * opacity });

describe("text over the commune cards' photos", () => {
  const status = () => colour(property("app", ".a-place-hero p", "color"));
  const location = () => colour(property("app", ".a-place-hero .a-place-location", "color"));

  it.each([
    ["with an address", true, 1],
    ["with a status that wraps", true, 2],
    ["without an address", false, 1],
  ] as const)("keeps a card's title, address and status readable %s", (_case, address, statusLines) => {
    // A 208px card with 16px bottom padding (.a-place-hero): status 14px,
    // address 12px 4px above it, title 20px 4px above that, held to 4.5:1.
    const lines = stack(16, [
      { name: "status", line: 14 * 1.2, gap: 0, text: status(), target: 4.5, lines: statusLines },
      ...(address ? [{ name: "address", line: 12 * 1.2, gap: 4, text: location(), target: 4.5 }] : []),
      { name: "title", line: 20 * 1.2, gap: 4, text: light, target: 4.5 },
    ]);
    const result = weakest(lines, 208, shade(property("app", ".a-place-hero::after", "background")));
    expect(failures(result), JSON.stringify(result)).toEqual([]);
  });

  it("gives the type label its own backdrop, wherever it sits", () => {
    // The label can sit high on a card with a long name, so it does not rely on the shade.
    const backdrop = over(colour(property("app", ".a-place-hero .type", "background")), white);
    expect(ratio(light.rgb, backdrop)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("text over Home's all-square photo", () => {
  const soft = () => colour(property("home", ".c-home-square .c-home-over,\n.c-home-square .c-home-sub", "color"));
  const people = () => colour(property("home", ".c-home-square-people", "color"));

  it.each([
    ["on a computer", 420, 40, 58, 1, 24, 1],
    ["on a tablet, with the sentence on two lines", 420, 32, 48, 2, 24, 2],
    ["on a phone", 470, 26, 39, 2, 21, 2],
  ] as const)("keeps the date, sentence and people readable %s", (_case, cover, padding, display, displayLines, sub, subLines) => {
    // .c-home-square-copy, from the bottom: the names (14px) centred on 32px
    // avatars, then the line under the sentence, the sentence (large text) and
    // the date, each the grid's gap apart (12px, 10px on a phone).
    const gap = cover === 470 ? 10 : 12;
    const lines = [
      { name: "people", from: padding + (32 - 14 * 1.2) / 2, to: padding + (32 + 14 * 1.2) / 2, text: people(), target: 4.5 },
      ...stack(padding + 32, [
        { name: "sub", line: sub, gap, text: soft(), target: 4.5, lines: subLines },
        { name: "sentence", line: display, gap, text: colour("#ffffff"), target: 3, lines: displayLines },
        { name: "date", line: 18, gap, text: soft(), target: 4.5 },
      ]),
    ];
    const result = weakest(lines, cover, shade(property("home", ".c-home-square::before", "background")));
    expect(failures(result), JSON.stringify(result)).toEqual([]);
  });
});

describe("text over the Hub's commune photo", () => {
  const hubWhite = colour("#ffffff");

  it.each([
    ["on a computer", 300, 27, 35, 1],
    ["on a computer, with no address", 300, 27, 35, 0],
    ["on a computer, for a trip's area and stay", 300, 27, 35, 2],
    ["on a phone", 280, 22, 29, 1],
    ["on a phone, for a trip's area and stay", 280, 22, 29, 2],
  ] as const)("keeps the title, address and people readable %s", (_case, cover, padding, title, addressLines) => {
    // .c-hub-identity: the people link's 12px text centred on 28px avatars, 17px
    // below the address (14px, line height 1.5), then the title (line height 1.2).
    const people = { name: "people", from: padding + 5, to: padding + 23, text: hubWhite, target: 4.5 };
    const above = stack(padding + 28, [
      ...(addressLines ? [{ name: "address", line: 21, gap: 17, text: hubWhite, target: 4.5, lines: addressLines }] : []),
      { name: "title", line: title * 1.2, gap: addressLines ? 6 : 17, text: hubWhite, target: 3 },
    ]);
    // A trip's "Area" and "Stay" are softer than the address after them.
    const labels = withOpacity(hubWhite, Number(property("hub", ".c-hub-location span", "opacity")));
    const softer = addressLines === 2 ? [{ ...above[0], name: "area and stay", text: labels }] : [];
    const result = weakest([people, ...above, ...softer], cover, shade(property("hub", ".c-hub-identity.has-photo::after", "background")));
    expect(failures(result), JSON.stringify(result)).toEqual([]);
  });

  it("gives the type and the buttons their own backdrop, which also stands out from the photo", () => {
    const type = over(colour(property("hub", ".c-hub-identity.has-photo .c-hub-type", "background")), white);
    expect(ratio(white, type)).toBeGreaterThanOrEqual(4.5);
    const button = over(colour(property("hub", ".c-hub-settings", "background")), white);
    // The 12px label in the button, and the button against the photo around it.
    expect(ratio(colour(property("hub", ".c-hub-settings", "color")).rgb, button)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(button, white)).toBeGreaterThanOrEqual(3);
  });
});

describe("the measurement", () => {
  it("finds what the finding found before the change: under 3:1 for the labels and titles", () => {
    const before = weakest(stack(18, [
      { name: "status", line: 14 * 1.2, gap: 0, text: colour("rgba(248, 245, 240, 0.82)"), target: 4.5 },
      { name: "title", line: 21 * 1.2, gap: 4, text: light, target: 4.5 },
    ]), 208, shade("linear-gradient(180deg, rgba(26, 30, 46, 0.08) 0%, rgba(26, 30, 46, 0.72) 100%)"));
    expect(before.title.contrast).toBeLessThan(3.5);
    expect(ratio(light.rgb, over(colour("rgba(245, 241, 234, 0.16)"), over(colour("rgba(26, 30, 46, 0.4)"), white)))).toBeLessThan(3);
    const hubBefore = weakest(stack(27 + 28, [{ name: "title", line: 42, gap: 17, text: colour("#ffffff"), target: 3 }]), 300,
      shade("linear-gradient(0deg, #14251acc 0, transparent 90%)"));
    expect(hubBefore.title.contrast).toBeLessThan(3);
    expect(ratio(white, over(colour("#15221c66"), white))).toBeLessThan(3);
  });
});
