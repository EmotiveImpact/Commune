import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CAST, FOCAL, shortFace, type Beat, type ImageKey, type Story } from '@commune/core/stories';
import { storyImage } from './images';

/** How long each slide stays, as in the prototype. */
const SLIDE_MS = 5500;

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

const focus = (key: ImageKey) => `${Math.round((FOCAL[key]?.[0] ?? 0.5) * 100)}% center`;

function Face({ who, size }: { who: keyof typeof CAST; size: number }) {
  return <img className="s-face" src={storyImage(CAST[who].av)} alt="" width={size} height={size} />;
}

/** The notification on a slide: the group chat asking, or Commune sorting it. */
function Toast({ beat }: { beat: Beat }) {
  if (beat.chat) {
    return <div className="s-toast is-chat"><Face who={beat.chat.who} size={38} /><div><div className="s-toast__top"><span>{beat.chat.from}</span><span>now</span></div><div className="s-toast__who">{CAST[beat.chat.who].n}</div><div className="s-toast__text">{beat.chat.t}</div></div></div>;
  }
  if (beat.note) {
    return <div className="s-toast"><Face who={beat.note.who} size={38} /><div><div className="s-toast__top"><b>commune.</b><span>{beat.note.w ?? 'now'}</span></div><div className="s-toast__title">{beat.note.t}</div><div className="s-toast__text">{beat.note.s}</div></div></div>;
  }
  return null;
}

/**
 * A story's slides, as the prototype plays them: a bar per slide, the photo,
 * the line and the cast or a notification. Tap the right to go on, the left
 * to go back, press and hold (or the pause button) to stop. Reduced motion
 * shows one slide at a time without moving on by itself.
 */
export function StoryPlayer({ story, variant, onEnd, children }: {
  story: Story;
  variant: 'hero' | 'page';
  /** After the last slide; without it the story starts again. */
  onEnd?: () => void;
  /** Laid over the slides, such as the closing card. */
  children?: ReactNode;
}) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const held = useRef<{ timer: number; held: boolean }>({ timer: 0, held: false });
  const beats = story.beats;
  const beat = beats[Math.min(index, beats.length - 1)];
  const photos = [...new Set(beats.map(item => item.img))];
  const stopped = paused || hovered || Boolean(children);
  useEffect(() => setIndex(0), [story.id]);

  const next = () => {
    if (index < beats.length - 1) setIndex(index + 1);
    else if (onEnd) onEnd();
    else setIndex(0);
  };
  const back = () => setIndex(Math.max(0, index - 1));
  const tap = (go: () => void) => ({
    onPointerDown: () => { held.current.held = false; held.current.timer = window.setTimeout(() => { held.current.held = true; setPaused(true); }, 260); },
    onPointerUp: () => { window.clearTimeout(held.current.timer); if (held.current.held) setPaused(false); },
    onPointerLeave: () => { window.clearTimeout(held.current.timer); if (held.current.held) { held.current.held = false; setPaused(false); } },
    onClick: () => { if (held.current.held) { held.current.held = false; return; } go(); },
  });
  const Line = variant === 'page' ? 'h2' : 'p';

  return <div className={`s-player s-player--${variant}${reduced ? ' is-still' : ''}`} role="group" aria-roledescription="story" aria-label={story.title}
    onMouseEnter={variant === 'hero' ? () => setHovered(true) : undefined} onMouseLeave={variant === 'hero' ? () => setHovered(false) : undefined}>
    <div className="s-player__photos" aria-hidden="true">
      {photos.map(key => <img key={key} className={key === beat.img ? 'is-on' : ''} src={storyImage(key)} alt="" style={{ objectPosition: focus(key) }} loading={key === beats[0].img ? 'eager' : 'lazy'} decoding="async" />)}
    </div>
    <div className="s-player__bars" aria-hidden="true">
      {beats.map((_, i) => <span key={i}><i key={i === index ? `now-${index}` : i}
        className={i < index ? 'is-done' : i === index ? 'is-now' : ''}
        style={i === index ? { animationDuration: `${SLIDE_MS}ms`, animationPlayState: stopped ? 'paused' : 'running' } : undefined}
        onAnimationEnd={i === index && !reduced ? next : undefined} /></span>)}
    </div>
    <button className="s-player__pause" type="button" aria-label={paused ? 'Play the story' : 'Pause the story'} aria-pressed={paused} onClick={() => setPaused(!paused)} hidden={reduced}>
      {paused
        ? <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z" fill="currentColor" /></svg>
        : <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z" fill="currentColor" /></svg>}
    </button>
    {children ? null : <>
      <div className="s-player__copy" key={index}>
        <span className="s-player__eyebrow">{beat.e}</span>
        <Line className="s-player__line">{beat.h}</Line>
      </div>
      {beat.cast
        ? <div className="s-player__cast" style={{ gridTemplateColumns: `repeat(${story.cast.length}, 1fr)` }}>{story.cast.map(who => <span key={who}><Face who={who} size={variant === 'page' ? 44 : 34} />{shortFace(who)}</span>)}</div>
        : <div className="s-player__toast" key={`toast-${index}`}><Toast beat={beat} /></div>}
    </>}
    <button className="s-player__tap is-back" type="button" aria-label="Previous slide" {...tap(back)} />
    <button className="s-player__tap is-next" type="button" aria-label="Next slide" {...tap(next)} />
    <span className="s-sr">Slide {index + 1} of {beats.length}</span>
    {children}
  </div>;
}
