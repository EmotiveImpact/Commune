import { useEffect, useRef, useState } from 'react';
import { FOCAL, STORIES, type ImageKey } from '@commune/core/stories';
import { storyImage } from '../stories/images';
import { StoryPlayer } from '../stories/StoryPlayer';
import '../stories/stories.css';

const focus = (key: ImageKey) => `${Math.round((FOCAL[key]?.[0] ?? 0.5) * 100)}% center`;
const signup = 'https://app.ourcommune.io/signup';

/** A story played over the page, full height, until closed. */
export function StoryViewer({ at, setAt }: { at: number; setAt: (i: number | null) => void }) {
  const story = STORIES[at];
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAt(null);
      if (e.key === 'ArrowRight') setAt((at + 1) % STORIES.length);
      if (e.key === 'ArrowLeft') setAt((at - 1 + STORIES.length) % STORIES.length);
    };
    document.addEventListener('keydown', key);
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', key); document.documentElement.style.overflow = overflow; before?.focus(); };
  }, [at, setAt]);
  return <div className="t-sv" role="dialog" aria-modal="true" aria-label={story.title} onClick={e => { if (e.target === e.currentTarget) setAt(null); }}>
    <button ref={close} className="t-sv__close" type="button" aria-label="Close the story" onClick={() => setAt(null)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
    <button className="t-sv__step is-back" type="button" aria-label="Previous story" onClick={() => setAt((at - 1 + STORIES.length) % STORIES.length)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12 4l-6 6 6 6" /></svg></button>
    <div className="t-sv__stage">
      <StoryPlayer key={story.id} story={story} variant="page" onEnd={() => setAt((at + 1) % STORIES.length)} />
      <div className="t-sv__below"><span><b>{story.title}</b> · {story.cat}</span><a className="l-button l-button--white" href={`${signup}?from=link-${story.id}`}>Get started</a></div>
    </div>
    <button className="t-sv__step is-next" type="button" aria-label="Next story" onClick={() => setAt((at + 1) % STORIES.length)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 4l6 6-6 6" /></svg></button>
  </div>;
}

/**
 * Notes on doing life together, told as the Commune stories: a row of tall
 * story covers, each opening the story over the page.
 */
export function StoryNotes() {
  const [open, setOpen] = useState<number | null>(null);
  const rail = useRef<HTMLDivElement>(null);
  const by = (dir: number) => {
    const r = rail.current; const card = r?.querySelector('button') as HTMLElement | null;
    if (r && card) r.scrollBy({ left: dir * (card.offsetWidth + 16) * 2, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  return <>
    <div className="t-notes-rail" ref={rail}>
      {STORIES.map((s, i) => <button className="t-snote" key={s.id} type="button" onClick={() => setOpen(i)} aria-label={`Watch ${s.title}`}>
        <span className="t-snote__cover">
          <img src={storyImage(s.beats[0].img)} alt="" loading="lazy" style={{ objectPosition: focus(s.beats[0].img) }} />
          <span className="t-snote__bars" aria-hidden="true">{s.beats.map((_, n) => <i key={n} />)}</span>
          <span className="t-snote__play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" /></svg></span>
          <span className="t-snote__line">{s.beats[0].h}</span>
        </span>
        <span className="l-eyebrow">{s.cat}</span>
        <span className="t-snote__title">{s.title}</span>
        <span className="t-snote__more">Watch the story</span>
      </button>)}
    </div>
    <div className="t-notes-nav"><button aria-label="Previous stories" onClick={() => by(-1)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12 4l-6 6 6 6" /></svg></button><button aria-label="More stories" onClick={() => by(1)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 4l6 6-6 6" /></svg></button></div>
    {open === null ? null : <StoryViewer at={open} setAt={setOpen} />}
  </>;
}

const JOURNAL_STORIES = ['crisps', 'lunch', 'villa'];
/** Journal-style headlines for the stories, when they sit as articles. */
const ARTICLE: Record<string, string> = {
  crisps: 'Six friends, one house and a lot of shared crisps.',
  lunch: 'Four people, one coffee machine and the team lunch.',
  villa: 'Five friends, one villa and a lot of euros.',
};

/** One story's photos, crossfading slide by slide while the card is on screen. */
function MiniStory({ at }: { at: number }) {
  const story = STORIES[at];
  const [n, setN] = useState(0);
  const [seen, setSeen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const photos = [...new Set(story.beats.map(b => b.img))];
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { threshold: 0.3 });
    io.observe(el); return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!seen || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = window.setInterval(() => setN(v => (v + 1) % story.beats.length), 3600);
    return () => window.clearInterval(t);
  }, [seen, story.beats.length]);
  const img = story.beats[n].img;
  return <span className="t-sj__photo" ref={ref}>
    {photos.map(k => <img key={k} className={k === img ? 'is-on' : ''} src={storyImage(k)} alt="" loading="lazy" style={{ objectPosition: `${Math.round((FOCAL[k]?.[0] ?? 0.5) * 100)}% 30%` }} />)}
    <span className="t-sj__bars" aria-hidden="true">{story.beats.map((_, i) => <i key={i} className={i < n ? 'is-done' : i === n && seen ? 'is-now' : ''} />)}</span>
    <span className="t-snote__play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" /></svg></span>
  </span>;
}

/** The journal's three cards, each one a story that plays in its photo and opens full screen. */
export function StoryJournal({ still = false }: { still?: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const picks = JOURNAL_STORIES.map(id => STORIES.findIndex(s => s.id === id)).filter(i => i >= 0);
  return <>
    <div className="l-journal__grid">{picks.map(i => {
      const s = STORIES[i];
      return <article className="l-journal__card t-sj" key={s.id}>
        <button type="button" className="t-sj__open" onClick={() => setOpen(i)} aria-label={`Watch ${s.title}`}>{still ? <span className="t-sj__photo"><img className="is-on" src={storyImage(s.beats[0].img)} alt="" loading="lazy" style={{ objectPosition: `${Math.round((FOCAL[s.beats[0].img]?.[0] ?? 0.5) * 100)}% 30%` }} /><span className="t-sj__badge">A Commune story · {s.beats.length} slides</span></span> : <MiniStory at={i} />}</button>
        <span className="l-eyebrow">{s.cat}{still ? '' : ' · A Commune story'}</span>
        <h3>{still ? ARTICLE[s.id] ?? s.title : s.title}</h3>
        <p>{still ? `${s.beats[1].h} ${s.beats[2].h}` : s.beats[0].h}</p>
        <button type="button" className="l-journal__guide t-sj__link" onClick={() => setOpen(i)}>{still ? 'Read the story' : 'Watch the story'}</button>
      </article>;
    })}</div>
    {open === null ? null : <StoryViewer at={open} setAt={setOpen} />}
  </>;
}
