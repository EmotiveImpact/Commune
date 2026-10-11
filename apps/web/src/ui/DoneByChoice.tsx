import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { firstNameOf, type DoneBy } from "../data/operations";
import { cx } from "./cx";
import "./done-by.css";

/** How long an answer is held before it counts. */
export const HOLD_MS = 900;

/**
 * Asked before marking done a task someone else holds: who did it? Each
 * answer is pressed and held, so nobody marks a task done for someone by a
 * stray tap, and both names go on the task (see needsDoneBy).
 */
export function DoneByChoice({ holder, title, disabled, onChoose, onCancel, className }: {
  /** The holder's name, as the task shows it. */
  holder: string;
  /** The task, for screen readers. */
  title: string;
  disabled?: boolean;
  onChoose: (doneBy: DoneBy) => void;
  onCancel: () => void;
  className?: string;
}) {
  const id = useId();
  const name = firstNameOf(holder) || "They";
  const [hint, setHint] = useState("");
  const group = useRef<HTMLDivElement>(null);
  // The question replaces the Done button, so focus moves to its first answer.
  useEffect(() => { group.current?.querySelector<HTMLButtonElement>("button")?.focus(); }, []);
  return (
    <div ref={group} className={cx("c-doneby", className)} role="group" aria-labelledby={`${id}-ask`} aria-describedby={`${id}-how`}>
      <p className="c-doneby-ask" id={`${id}-ask`}>
        This is {name}’s turn. Who did it?<span className="c-visually-hidden"> ({title})</span>
      </p>
      <p className="c-doneby-how" id={`${id}-how`}>
        Press and hold your answer. Your name goes on it either way.
      </p>
      <div className="c-doneby-actions">
        <HoldButton label="I did it" disabled={disabled} onHeld={() => onChoose("me")} onShort={setHint} />
        <HoldButton label={`${name} did it`} disabled={disabled} onHeld={() => onChoose("assignee")} onShort={setHint} />
        <button className="a-btn ghost c-doneby-cancel" type="button" onClick={onCancel}>Cancel</button>
      </div>
      <p className="c-doneby-hint" role="status">{hint}</p>
    </div>
  );
}

/** A button that acts only once it has been held down for HOLD_MS. */
function HoldButton({ label, disabled, onHeld, onShort }: {
  label: string; disabled?: boolean; onHeld: () => void; onShort: (hint: string) => void;
}) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const done = useRef(false);
  // A press that began here; the click that follows it is not a plain click.
  const pressed = useRef(false);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const start = () => {
    if (disabled || timer.current !== undefined) return;
    done.current = false;
    pressed.current = true;
    setHolding(true);
    onShort("");
    timer.current = window.setTimeout(() => {
      timer.current = undefined;
      done.current = true;
      setHolding(false);
      onHeld();
    }, HOLD_MS);
  };
  const stop = () => {
    if (timer.current === undefined) return;
    window.clearTimeout(timer.current);
    timer.current = undefined;
    setHolding(false);
    if (!done.current) onShort("Keep holding until the bar fills.");
  };
  const isHoldKey = (event: KeyboardEvent) => event.key === " " || event.key === "Enter";
  return (
    <button
      className={cx("a-btn ghost c-doneby-hold", holding && "is-holding")}
      type="button"
      disabled={disabled}
      style={{ "--hold-ms": `${HOLD_MS}ms` } as CSSProperties}
      onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
        if (event.button !== 0) return;
        // Keep receiving the release even if the finger slides a little.
        event.currentTarget.setPointerCapture?.(event.pointerId);
        start();
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onKeyDown={(event) => {
        if (!isHoldKey(event)) return;
        event.preventDefault();
        if (!event.repeat) start();
      }}
      onKeyUp={(event) => { if (isHoldKey(event)) stop(); }}
      onBlur={stop}
      onContextMenu={(event) => event.preventDefault()}
      // A plain click (a screen reader's, say) does nothing but explain.
      onClick={() => {
        if (pressed.current) { pressed.current = false; return; }
        onShort("Press and hold to confirm.");
      }}
    >
      <span>{label}</span>
    </button>
  );
}
