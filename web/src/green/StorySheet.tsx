import { useEffect, useRef, useState } from 'react';
import { CAST, CLOUDS, FOCAL, STORIES, shortFace, type Beat, type CastId, type ImageKey } from '@commune/core/stories';
import { storyImage } from '../stories/images';
import { siteStory, storyPage } from '../stories/choose';

/** How long each slide stays, as everywhere else the stories play. */
const SLIDE_MS = 5500;
const signup = 'https://app.ourcommune.io/signup';
const focus = (key: ImageKey) => `${Math.round((FOCAL[key]?.[0] ?? 0.5) * 100)}% center`;

function Face({ who }: { who: CastId }) {
  return <img className="t-st-face" src={storyImage(CAST[who].av)} alt="" width={30} height={30} />;
}

/** The slide's notification, in the hero's notification card style. */
function Ping({ beat, commune }: { beat: Beat; commune: string }) {
  if (beat.chat) return <div className="t-ping t-st-ping">
    <span className="t-ping__app"><b>{beat.chat.from}</b><small>now</small></span>
    <div className="t-ping__body"><Face who={beat.chat.who} /><div><strong>{CAST[beat.chat.who].n}</strong><small className="t-st-said">{beat.chat.t}</small></div></div>
  </div>;
  if (beat.note) return <div className="t-ping t-st-ping">
    <span className="t-ping__app"><b>commune.</b><small>{commune} · {beat.note.w ?? 'now'}</small></span>
    <div className="t-ping__body"><Face who={beat.note.who} /><div><strong>{beat.note.t}</strong><small>{beat.note.s}</small></div></div>
  </div>;
  return null;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(q.matches);
    q.addEventListener('change', update);
    return () => q.removeEventListener('change', update);
  }, []);
  return reduced;
}

/**
 * The stories as a full card of the homepage, the same size as the hero: the
 * story's photo fills one side, its line is set as large as a headline on the
 * other, and the other stories wait underneath. Plays only while on screen;
 * tap the photo to go on, hover or the pause button to stop.
 */
export function StorySheet() {
  const reduced = useReducedMotion();
  const [storyAt, setStoryAt] = useState(() => Math.max(0, STORIES.findIndex(s => s.id === siteStory().id)));
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [seen, setSeen] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const chips = useRef<HTMLDivElement>(null);
  const story = STORIES[storyAt];
  const beats = story.beats;
  const beat = beats[Math.min(index, beats.length - 1)];
  const photos = [...new Set(beats.map(b => b.img))];

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    const row = chips.current; const chip = row?.children[storyAt] as HTMLElement | undefined;
    if (row && chip) row.scrollTo({ left: chip.offsetLeft - row.clientWidth / 2 + chip.offsetWidth / 2, behavior: reduced ? 'auto' : 'smooth' });
  }, [storyAt, reduced]);

  const pick = (i: number) => { setStoryAt(i); setIndex(0); };
  const next = () => (index < beats.length - 1 ? setIndex(index + 1) : pick((storyAt + 1) % STORIES.length));
  const back = () => (index > 0 ? setIndex(index - 1) : null);
  const [held, setHeld] = useState(false);
  const hold = useRef(0);
  const running = seen && !paused && !held && !reduced;
  const press = {
    onPointerDown: () => { hold.current = window.setTimeout(() => setHeld(true), 260); },
    onPointerUp: () => window.clearTimeout(hold.current),
    onPointerLeave: () => { window.clearTimeout(hold.current); setHeld(false); },
  };
  const tapTo = (go: () => void) => ({ ...press, onClick: () => { if (held) { setHeld(false); return; } go(); } });

  return <section className="t-stories" ref={ref} aria-labelledby="stories-title" aria-roledescription="story">
    <div className="t-st-stage">
      <div className="t-st-photos" aria-hidden="true">
        {photos.map(key => <img key={`${story.id}-${key}`} className={key === beat.img ? 'is-on' : ''} src={storyImage(key)} alt="" style={{ objectPosition: focus(key) }} loading="lazy" decoding="async" />)}
        {CLOUDS[beat.img] ? <img className="t-st-clouds" src={storyImage(CLOUDS[beat.img]!)} alt="" style={{ objectPosition: focus(beat.img) }} decoding="async" /> : null}
      </div>
      <div className="t-st-bars" aria-hidden="true">
        {beats.map((_, i) => <span key={`${story.id}-${i}`}><i key={i === index ? `now-${story.id}-${index}` : i}
          className={i < index ? 'is-done' : i === index ? (reduced ? 'is-done' : 'is-now') : ''}
          style={i === index ? { animationDuration: `${SLIDE_MS}ms`, animationPlayState: running ? 'running' : 'paused' } : undefined}
          onAnimationEnd={i === index ? next : undefined} /></span>)}
      </div>
      <div className="t-st-over" key={`${story.id}-${index}`}>
        {beat.cast
          ? <div className="t-st-cast">{story.cast.map(who => <span key={who}><Face who={who} />{shortFace(who)}</span>)}</div>
          : <Ping beat={beat} commune={story.commune} />}
      </div>
      <button className="t-st-tap is-back" type="button" aria-label="Previous slide" {...tapTo(back)} />
      <button className="t-st-tap is-next" type="button" aria-label="Next slide" {...tapTo(next)} />
    </div>

    <div className="t-st-copy">
      <div className="t-st-top">
        <span className="l-eyebrow">Commune stories</span>
        <h2 id="stories-title" className="t-st-title">{story.title}<span> · {story.cat}</span></h2>
      </div>
      <div className="t-st-line" key={`${story.id}-${index}`} aria-live="polite">
        <span className="t-st-kicker">{beat.e}</span>
        <p>{beat.h}</p>
      </div>
      <div className="t-st-foot">
        <div className="t-st-actions">
          <a className="l-button l-button--white" href={`${signup}?from=link-${story.id}`}>Get started</a>
          <a className="t-st-watch" href={storyPage(story)}>Watch full screen</a>
          {reduced ? null : <button className="t-st-pause" type="button" aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? 'Play' : 'Pause'}</button>}
        </div>
        <div className="t-st-chips" ref={chips} role="tablist" aria-label="More stories">
          {STORIES.map((s, i) => <button key={s.id} role="tab" aria-selected={i === storyAt} onClick={() => pick(i)}>
            <img src={storyImage(s.beats[0].img)} alt="" loading="lazy" style={{ objectPosition: focus(s.beats[0].img) }} />
            <span><small>{s.cat}</small>{s.title}</span>
          </button>)}
        </div>
      </div>
    </div>
  </section>;
}
