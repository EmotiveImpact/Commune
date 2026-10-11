import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { advance, BEST_KEY, CAUSES, drawStreet, jump, layoutFor, metres, newRun, readPalette, release, STREET_UNITS, UNIT, type Hole, type Layout, type Pose } from "./streetRunner";
import "./street-scene.css";

const readBest = () => { try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; } };
const saveBest = (best: number) => { try { localStorage.setItem(BEST_KEY, String(best)); } catch { /* private window */ } };
const JUMP_KEYS = [" ", "ArrowUp", "w", "W"];
// Room between the message and the roofs for the hint.
const HINT_ROOM = 64;

/**
 * A street that runs edge to edge across the top of a recovery screen, with
 * its message (children) in the sky. Tapping the street, Space or the up arrow
 * plays Street runner; it needs no network and plays no sound. A run pauses
 * whenever the page is hidden or loses focus.
 */
export function StreetScene({ label, children, onPlayingChange }: { label: string; children: ReactNode; onPlayingChange?: (playing: boolean) => void }) {
  const sceneRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const run = useRef(newRun());
  const pose = useRef<Pose>("ready");
  const layout = useRef<Layout>(layoutFor(720, 480));
  const hole = useRef<Hole | null>(null);
  const frame = useRef(0);
  const last = useRef(0);
  const endedAt = useRef(0);
  const [shown, setShown] = useState<Pose>("ready");
  const [distance, setDistance] = useState(0);
  const [best, setBest] = useState(readBest);
  const [hint, setHint] = useState("Press Space or tap the street to run");
  const [announcement, setAnnouncement] = useState("");
  const playingChange = useRef(onPlayingChange);
  playingChange.current = onPlayingChange;

  const draw = useCallback(() => {
    const scene = sceneRef.current, ctx = canvasRef.current?.getContext("2d");
    if (!scene || !ctx) return;
    drawStreet(ctx, layout.current, run.current, pose.current, readPalette(scene), hole.current);
  }, []);

  const setPose = useCallback((next: Pose) => {
    const wasPlaying = pose.current === "running" || pose.current === "paused";
    pose.current = next;
    setShown(next);
    const playing = next === "running" || next === "paused";
    if (playing !== wasPlaying) playingChange.current?.(playing);
  }, []);

  // Size the canvas to the scene, keeping clear sky under the message.
  const fit = useCallback(() => {
    const scene = sceneRef.current, canvas = canvasRef.current, message = messageRef.current;
    if (!scene || !canvas || !message) return;
    const s = scene.getBoundingClientRect(), m = message.getBoundingClientRect();
    const need = Math.ceil(m.bottom - s.top + HINT_ROOM + STREET_UNITS * UNIT);
    if (scene.style.minHeight !== `${need}px`) scene.style.minHeight = `${need}px`;
    const next = layoutFor(scene.clientWidth, scene.clientHeight);
    layout.current = next;
    hole.current = { x: Math.floor((m.left - s.left - 8) / UNIT), y: Math.floor((m.top - s.top - 8) / UNIT), w: Math.ceil((m.width + 16) / UNIT), h: Math.ceil((m.height + 16) / UNIT) };
    canvas.width = next.width * UNIT;
    canvas.height = next.height * UNIT;
    canvas.style.width = `${next.width * UNIT}px`;
    canvas.style.height = `${next.height * UNIT}px`;
    const hintEl = hintRef.current;
    if (hintEl) hintEl.style.top = `${Math.max(0, (next.row - 46) * UNIT - hintEl.offsetHeight - 10)}px`;
    draw();
  }, [draw]);

  const step = useCallback((time: number) => {
    if (pose.current !== "running") return;
    const dt = Math.min((time - last.current) / 1000, 0.05);
    last.current = time;
    const hit = advance(run.current, layout.current, dt);
    const m = metres(run.current.distance);
    setDistance(m);
    if (hit) {
      endedAt.current = performance.now();
      setPose("over");
      const record = m > readBest();
      if (record) { saveBest(m); setBest(m); }
      const said = `${CAUSES[hit]} at ${m} m.${record && m > 0 ? " A new best." : ""}`;
      setHint(`${said} Space or tap to run again.`);
      setAnnouncement(said);
      draw();
      return;
    }
    draw();
    frame.current = requestAnimationFrame(step);
  }, [draw, setPose]);

  const start = useCallback(() => {
    cancelAnimationFrame(frame.current);
    run.current = newRun();
    last.current = performance.now();
    setDistance(0);
    setHint("");
    setAnnouncement("Running. Press Space to jump.");
    setPose("running");
    frame.current = requestAnimationFrame(step);
  }, [setPose, step]);

  const pause = useCallback(() => {
    if (pose.current !== "running") return;
    cancelAnimationFrame(frame.current);
    setPose("paused");
    setHint("Paused. Space or tap to carry on.");
    setAnnouncement("Paused.");
    draw();
  }, [draw, setPose]);

  const resume = useCallback(() => {
    if (pose.current !== "paused") return;
    last.current = performance.now();
    setHint("");
    setPose("running");
    frame.current = requestAnimationFrame(step);
  }, [setPose, step]);

  const press = useCallback(() => {
    const now = pose.current;
    if (now === "ready" || (now === "over" && performance.now() - endedAt.current > 450)) start();
    else if (now === "paused") resume();
    else if (now === "running") jump(run.current);
  }, [resume, start]);

  useLayoutEffect(() => {
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => fit());
    if (sceneRef.current) observer.observe(sceneRef.current);
    if (messageRef.current) observer.observe(messageRef.current);
    return () => observer.disconnect();
  }, [fit]);

  // The hint moves with the roofs when its text changes length.
  useLayoutEffect(() => { fit(); }, [hint, fit]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const onControl = event.target instanceof Element && event.target.closest("button, a, input, textarea, select");
      if (JUMP_KEYS.includes(event.key) && !onControl) {
        event.preventDefault();
        if (!event.repeat) press();
      } else if (["Escape", "p", "P"].includes(event.key)) {
        if (pose.current === "running") pause(); else if (pose.current === "paused") resume();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => { if (JUMP_KEYS.includes(event.key)) release(run.current); };
    const onHidden = () => { if (document.hidden) pause(); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("blur", pause);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("blur", pause);
      cancelAnimationFrame(frame.current);
    };
  }, [press, pause, resume]);

  const playing = shown === "running" || shown === "paused";
  return <main className="a-body c-street">
    <section
      ref={sceneRef}
      className="c-street-scene"
      aria-label={label}
      onPointerDown={(event) => {
        if ((event.target as Element).closest("button, a, .c-street-message")) return;
        event.preventDefault();
        press();
      }}
      onPointerUp={() => release(run.current)}
    >
      <canvas ref={canvasRef} className="c-street-canvas" aria-hidden="true" />
      <div className="c-street-top">
        <span className="a-wordmark">commune.</span>
        <div className="c-street-score">
          {shown !== "ready" && <span><b>{distance}</b> m</span>}
          <span>Best {best} m</span>
          {playing && <button type="button" className="c-street-pause" onClick={() => shown === "paused" ? resume() : pause()}>{shown === "paused" ? "Resume" : "Pause"}</button>}
        </div>
      </div>
      <div ref={messageRef} className="c-street-message">{children}</div>
      <p ref={hintRef} className="c-street-hint" hidden={!hint}>{hint}</p>
    </section>
    <div className="c-street-help">
      <p>Space, ↑ or a tap to jump. Let go early for a small hop. Stay low when a pigeon swoops.</p>
      <p>No sound. Playing uses no data and doesn’t touch your account.</p>
    </div>
    <p className="sr-only" role="status">{announcement}</p>
  </main>;
}
