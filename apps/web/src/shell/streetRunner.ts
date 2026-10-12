// Street runner: the small game on the connection and missing-page screens.
// Everything here runs without a network. Sizes and positions are in scene
// units; one unit is UNIT CSS pixels, drawn as a solid block.

export const UNIT = 3;
/** The houses, front walls and pavement at the bottom of the scene, in units. */
export const STREET_UNITS = 78;
/** The run's best distance on this device. Nothing else is stored. */
export const BEST_KEY = "commune.streetRunnerBest";

export type Obstacle = { type: "bin" | "bins" | "puddle" | "box" | "bird"; x: number; w: number; h: number; extra: number };
export type Run = {
  distance: number;
  speed: number;
  /** Height of the runner's feet above the pavement. */
  lift: number;
  rise: number;
  obstacles: Obstacle[];
  gap: number;
  time: number;
};
export type Layout = { width: number; height: number; ground: number; row: number; runnerX: number };

const SIZES: Record<Obstacle["type"], [number, number]> = { bin: [9, 14], bins: [19, 14], box: [12, 12], puddle: [16, 0], bird: [11, 6] };
export const CAUSES: Record<Obstacle["type"], string> = {
  bin: "Walked into a wheelie bin",
  bins: "Two bins was one too many",
  puddle: "Splashed through a puddle",
  box: "Tripped on the recycling",
  bird: "Bumped into a pigeon",
};
const JUMP = 158, HOP = 70, GRAVITY = 560;

export const metres = (distance: number) => Math.floor(distance / 10);

export function layoutFor(widthPx: number, heightPx: number): Layout {
  const width = Math.ceil(widthPx / UNIT), height = Math.ceil(heightPx / UNIT);
  const ground = height - 14;
  return { width, height, ground, row: ground - 20, runnerX: Math.max(22, Math.min(48, Math.round(width * 0.1))) };
}

export function newRun(): Run {
  return { distance: 0, speed: 70, lift: 0, rise: 0, obstacles: [], gap: 110, time: 0 };
}

export function jump(run: Run) {
  if (run.lift === 0 && run.rise === 0) run.rise = JUMP;
}

/** Letting go early cuts the jump short, for a small hop. */
export function release(run: Run) {
  if (run.rise > HOP) run.rise = HOP;
}

function spawn(run: Run, layout: Layout, random: () => number) {
  const pool: Obstacle["type"][] = ["bin", "bin", "puddle", "box"];
  if (run.speed > 92) pool.push("bins");
  if (metres(run.distance) > 220) pool.push("bird", "bird");
  const type = pool[Math.floor(random() * pool.length)];
  const [w, h] = SIZES[type];
  run.obstacles.push({ type, w, h, x: layout.width + 6, extra: type === "bird" ? 22 : 0 });
  // Always room to react at the current speed, plus a little more after two bins.
  run.gap = run.speed * 0.62 + w + 26 + random() * 70 + (type === "bins" ? 24 : 0);
}

export function hits(run: Run, layout: Layout, o: Obstacle): boolean {
  const left = layout.runnerX + 2, right = layout.runnerX + 8;
  const top = layout.ground - 15 - run.lift, bottom = layout.ground - run.lift;
  if (o.x + o.w < left || o.x > right) return false;
  if (o.type === "puddle") return run.lift < 0.5 && o.x + 3 < right && o.x + o.w - 3 > left;
  // Pigeons fly just above head height: running under them is safe, jumping is not.
  if (o.type === "bird") { const y = layout.ground - 24; return top < y + 6 && bottom > y + 1; }
  return bottom > layout.ground - o.h + 1;
}

/** Moves the run on by dt seconds. Returns what the runner hit, if anything. */
export function advance(run: Run, layout: Layout, dt: number, random: () => number = Math.random): Obstacle["type"] | null {
  run.time += dt;
  run.speed = Math.min(170, 70 + run.distance * 0.012);
  const dx = run.speed * dt;
  run.distance += dx;
  run.gap -= dx;
  if (run.lift > 0 || run.rise > 0) {
    run.lift += run.rise * dt;
    run.rise -= GRAVITY * dt;
    if (run.lift <= 0) { run.lift = 0; run.rise = 0; }
  }
  for (const o of run.obstacles) o.x -= dx + o.extra * dt;
  run.obstacles = run.obstacles.filter((o) => o.x + o.w > -10);
  if (run.gap <= 0) spawn(run, layout, random);
  return run.obstacles.find((o) => hits(run, layout, o))?.type ?? null;
}

export const PALETTE = [
  "sky", "cloud", "sun", "house", "house-alt", "roof", "window", "frame", "door", "wood", "leaf",
  "pave", "kerb", "joint", "bin", "bin-lid", "puddle", "skin", "hair", "top", "legs", "bird", "brick", "lamp", "light", "box", "glass",
] as const;
export type Palette = Record<(typeof PALETTE)[number], string>;

/** The scene's colours, from the --street-* tokens on its element. */
export function readPalette(element: Element): Palette {
  const style = getComputedStyle(element);
  return Object.fromEntries(PALETTE.map((name) => [name, style.getPropertyValue(`--street-${name}`).trim()])) as Palette;
}

/** A rectangle in units that nothing in the sky is drawn behind (the message). */
export type Hole = { x: number; y: number; w: number; h: number };
export type Pose = "ready" | "running" | "paused" | "over";

export function drawStreet(ctx: CanvasRenderingContext2D, layout: Layout, run: Run, pose: Pose, P: Palette, hole: Hole | null) {
  const { width: W, height: H, ground: G, row: ROW, runnerX: X } = layout;
  const d = run.distance;
  const r = (x: number, y: number, w: number, h: number, colour: string) => {
    ctx.fillStyle = colour;
    ctx.fillRect(Math.round(x * UNIT), Math.round(y * UNIT), Math.round(w * UNIT), Math.round(h * UNIT));
  };

  // Sky, with the sun and clouds kept clear of the message.
  r(0, 0, W, ROW, P.sky);
  ctx.save();
  if (hole) {
    ctx.beginPath();
    ctx.rect(0, 0, W * UNIT, H * UNIT);
    ctx.rect(hole.x * UNIT, hole.y * UNIT, hole.w * UNIT, hole.h * UNIT);
    ctx.clip("evenodd");
  }
  const sx = W - 34;
  let sy = 26;
  if (hole && sx < hole.x + hole.w && sy < hole.y + hole.h) sy = hole.y + hole.h + 6;
  r(sx + 2, sy, 6, 10, P.sun); r(sx, sy + 2, 10, 6, P.sun);
  const span = W + 60, drift = (d * 0.08) % span;
  for (let i = 0; i < Math.ceil(W / 70) + 1; i++) {
    const x = ((i * 83 + 20 - drift) % span + span) % span - 30, y = 14 + (i * 29) % Math.max(20, ROW - 70);
    r(x, y, 16, 3, P.cloud); r(x + 3, y - 2, 9, 2, P.cloud);
  }
  ctx.restore();

  // A terrace of houses with lamp posts, slower than the pavement.
  const mod = 44, off = (d * 0.35) % (mod * 3), top = ROW - 30;
  for (let i = -1; i < Math.ceil(W / mod) + 3; i++) {
    const x = i * mod - off, k = ((i % 3) + 3) % 3;
    r(x, top, mod, 30, k === 1 ? P["house-alt"] : P.house);
    for (let s = 0; s < 4; s++) r(x + s * 2, top - 2 - s * 2, mod - s * 4, 2, P.roof);
    r(x + 30, top - 12, 5, 6, P.roof); r(x + 29, top - 13, 7, 2, P.legs);
    for (const wx of [6, 26]) { r(x + wx, top + 4, 10, 9, P.roof); r(x + wx + 1, top + 5, 8, 7, P.window); r(x + wx + 4, top + 5, 1, 7, P.frame); }
    r(x + 6, top + 17, 10, 9, P.roof); r(x + 7, top + 18, 8, 7, P.window);
    r(x + 26, top + 15, 9, 15, P.door); r(x + 33, top + 22, 1, 1, P.sun);
    if (k === 2) { r(x + 18, top + 22, 6, 8, P.wood); r(x + 17, top + 17, 8, 6, P.leaf); }
  }
  const lamps = (d * 0.35) % 132;
  for (let i = 0; i < Math.ceil(W / 132) + 2; i++) {
    const x = 66 + i * 132 - lamps;
    r(x, ROW - 30, 2, 36, P.lamp); r(x - 2, ROW - 32, 6, 3, P.lamp); r(x - 1, ROW - 29, 4, 2, P.light);
  }

  // Front walls with hedges, then the pavement.
  const hedges = (d * 0.6) % 44;
  r(0, ROW, W, 5, P.kerb);
  for (let x = -hedges; x < W; x += 44) r(x + 4, ROW - 2, 22, 4, P.leaf);
  r(0, ROW + 5, W, H - ROW - 5, P.pave);
  for (let x = -(d % 16); x < W; x += 16) r(x, ROW + 5, 1, H - ROW - 5, P.joint);
  r(0, ROW + 13, W, 1, P.joint); r(0, H - 3, W, 3, P.kerb);

  for (const o of run.obstacles) {
    const x = o.x;
    if (o.type === "bin" || o.type === "bins") {
      for (let i = 0; i < (o.type === "bins" ? 2 : 1); i++) {
        const bx = x + i * 10;
        r(bx, G - 13, 9, 12, P.bin); r(bx - 1, G - 14, 11, 2, P["bin-lid"]); r(bx + 1, G - 1, 3, 1, P.legs); r(bx + 6, G - 1, 2, 1, P.legs); r(bx + 3, G - 10, 3, 1, P["bin-lid"]);
      }
    } else if (o.type === "puddle") {
      r(x, G + 2, 16, 2, P.puddle); r(x + 3, G + 1, 10, 1, P.puddle); r(x + 5, G + 2, 3, 1, P.cloud);
    } else if (o.type === "box") {
      r(x, G - 7, 12, 7, P.box); r(x + 1, G - 11, 2, 5, P.glass); r(x + 5, G - 10, 2, 4, P.brick); r(x + 8, G - 12, 2, 6, P.glass); r(x, G - 7, 12, 1, P["bin-lid"]);
    } else {
      const y = G - 24;
      r(x + 2, y + 2, 7, 3, P.bird); r(x, y + 2, 3, 2, P.bird); r(x + 9, y + 1, 2, 2, P.bird); r(x + 10, y + 2, 1, 1, P.sun);
      if (Math.floor(run.time * 8) % 2) r(x + 3, y - 1, 4, 3, P.bird); else r(x + 3, y + 5, 4, 2, P.bird);
    }
  }

  // The runner, with a bag of shopping.
  if (pose === "over") {
    const y = G - 6;
    r(X - 2, y, 5, 5, P.skin); r(X - 2, y, 5, 2, P.hair); r(X + 3, y + 1, 7, 4, P.top); r(X + 10, y + 2, 6, 3, P.legs); r(X + 5, y - 2, 3, 3, P.wood);
    return;
  }
  const t = G - 16 - run.lift;
  r(X + 3, t, 5, 5, P.skin); r(X + 3, t, 5, 2, P.hair); r(X + 7, t + 2, 1, 1, P.legs);
  r(X + 2, t + 5, 6, 6, P.top);
  if (run.lift > 0) { r(X + 1, t + 6, 2, 3, P.top); r(X + 8, t + 5, 2, 3, P.top); r(X + 2, t + 11, 6, 3, P.legs); r(X + 6, t + 13, 3, 2, P.legs); }
  else if (pose !== "running") { r(X + 3, t + 11, 2, 5, P.legs); r(X + 6, t + 11, 2, 5, P.legs); r(X + 8, t + 7, 3, 4, P.wood); }
  else if (Math.floor(run.time * 10) % 2) { r(X + 1, t + 6, 2, 4, P.top); r(X + 2, t + 11, 2, 5, P.legs); r(X + 6, t + 11, 3, 3, P.legs); r(X + 8, t + 13, 2, 2, P.legs); r(X + 8, t + 7, 3, 4, P.wood); }
  else { r(X + 7, t + 6, 2, 4, P.top); r(X + 6, t + 11, 2, 5, P.legs); r(X + 2, t + 11, 3, 3, P.legs); r(X, t + 13, 2, 2, P.legs); r(X - 1, t + 7, 3, 4, P.wood); }
}
