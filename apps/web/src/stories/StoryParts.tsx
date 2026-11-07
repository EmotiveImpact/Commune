import { useEffect, useState } from "react";
import { CAST, CLOUDS, FOCAL, firstBillCard, loadingLines, shortFace, type Beat, type CastId, type ImageKey, type Story } from "@commune/core/stories";
import { storyImage } from "./images";
import "./stories.css";

/** Where the people in a story photo are, so a crop keeps them in. */
function focus(key: ImageKey): string {
  const [x] = FOCAL[key] ?? [0.5, 0];
  return `${Math.round(x * 100)}% center`;
}

/** A story photo, decorative: the words beside it carry the story. */
function Photo({ image, className }: { image: ImageKey; className: string }) {
  return <img className={className} src={storyImage(image)} alt="" style={{ objectPosition: focus(image) }} loading="lazy" decoding="async" />;
}

/** How long each slide of the sign-in story stays, as on the website. */
const SLIDE_MS = 5500;

function useReducedMotion(): boolean {
  const query = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  const [reduced, setReduced] = useState(() => Boolean(query?.matches));
  useEffect(() => {
    if (!query) return;
    const update = () => setReduced(query.matches);
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, [query]);
  return reduced;
}

function Face({ who, size }: { who: CastId; size: number }) {
  return <img className="c-story-face" src={storyImage(CAST[who].av)} alt="" width={size} height={size} />;
}

/** A slide's notification: the group chat asking, or Commune sorting it. */
function Toast({ beat }: { beat: Beat }) {
  if (beat.chat) {
    return (
      <span className="c-story-note">
        <Face who={beat.chat.who} size={36} />
        <span>
          <span className="c-story-note-top"><span>{beat.chat.from}</span><span>now</span></span>
          <strong>{CAST[beat.chat.who].n}</strong>
          <span>{beat.chat.t}</span>
        </span>
      </span>
    );
  }
  if (beat.note) {
    return (
      <span className="c-story-note">
        <Face who={beat.note.who} size={36} />
        <span>
          <span className="c-story-note-top"><b>commune.</b><span>{beat.note.w ?? "now"}</span></span>
          <strong>{beat.note.t}</strong>
          <span>{beat.note.s}</span>
        </span>
      </span>
    );
  }
  return null;
}

/**
 * The opening story on the sign-in and sign-up pages. On a wide screen it
 * fills the whole brand panel and plays every slide, as the website does:
 * the photo edge to edge, a bar per slide, the line, and the cast or the
 * notification. Hover or the pause button stops it; reduced motion shows one
 * slide at a time and moves on only when asked. On a phone it is a short
 * strip above the form.
 */
export function AuthStory({ story, compact = false }: { story: Story; compact?: boolean }) {
  const beats = story.beats;
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const beat = beats[Math.min(index, beats.length - 1)];
  const photos = [...new Set(beats.map((item) => item.img))];
  const next = () => setIndex((current) => (current + 1) % beats.length);

  if (compact) {
    const [opening] = beats;
    return (
      <figure className="c-story-strip">
        <Photo image={opening.img} className="c-story-strip-photo" />
        <figcaption><span>{opening.e}</span>{opening.h}</figcaption>
      </figure>
    );
  }
  return (
    <figure className="c-story-panel" aria-roledescription="story" aria-label={story.title}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="c-story-panel-photos" aria-hidden="true">
        {photos.map((key) => (
          <img key={key} className={key === beat.img ? "is-on" : ""} src={storyImage(key)} alt=""
            style={{ objectPosition: focus(key) }} loading={key === beats[0].img ? "eager" : "lazy"} decoding="async" />
        ))}
        {CLOUDS[beat.img] ? <img className="c-story-clouds" src={storyImage(CLOUDS[beat.img]!)} alt="" style={{ objectPosition: focus(beat.img) }} decoding="async" /> : null}
      </div>
      <div className="c-story-panel-bars" aria-hidden="true">
        {beats.map((_, i) => (
          <span key={i}>
            <i key={i === index ? `now-${index}` : i} className={i < index ? "is-done" : i === index ? "is-now" : ""}
              style={i === index ? { animationDuration: `${SLIDE_MS}ms`, animationPlayState: paused || hovered || reduced ? "paused" : "running" } : undefined}
              onAnimationEnd={i === index && !reduced ? next : undefined} />
          </span>
        ))}
      </div>
      <figcaption className="c-story-panel-copy">
        <span className="c-story-panel-text" key={index}>
          <span className="c-story-eyebrow">{beat.e}</span>
          <span className="c-story-panel-line">{beat.h}</span>
        </span>
        <span className="c-story-panel-foot" key={`foot-${index}`}>
          {beat.cast
            ? <span className="c-story-cast">{story.cast.map((who) => <span key={who}><Face who={who} size={44} />{shortFace(who)}</span>)}</span>
            : <Toast beat={beat} />}
        </span>
      </figcaption>
      <span className="c-story-panel-controls">
        {reduced ? null : (
          <button type="button" onClick={() => setPaused(!paused)} aria-pressed={paused} aria-label={paused ? "Play the story" : "Pause the story"}>
            {paused
              ? <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z" fill="currentColor" /></svg>
              : <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z" fill="currentColor" /></svg>}
          </button>
        )}
        <button type="button" onClick={next} aria-label="Next slide">
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </span>
    </figure>
  );
}

/**
 * The invitation page's panel. Never the story cast: real names beside cast
 * faces would mix the two, so this shows a people-free photo and only what
 * the invitation itself says (the commune, once it has loaded, and the role).
 */
export function InviteScene({ communeName, role, compact = false }: { communeName?: string; role?: string; compact?: boolean }) {
  const line = communeName ? `There's a place for you in ${communeName}.` : "Someone has kept a place for you.";
  const fact = role ? `You'll join as a ${role.toLowerCase()}.` : "Sign in to see who asked you.";
  if (compact) {
    return (
      <figure className="c-story-strip">
        <Photo image="inv-home" className="c-story-strip-photo" />
        <figcaption><span>You're invited</span>{line}</figcaption>
      </figure>
    );
  }
  return (
    <figure className="c-story-panel is-invite">
      <div className="c-story-panel-photos" aria-hidden="true">
        <img className="is-on" src={storyImage("inv-home")} alt="" style={{ objectPosition: focus("inv-home") }} decoding="async" />
      </div>
      <figcaption className="c-story-panel-copy">
        <span className="c-story-panel-text">
          <span className="c-story-eyebrow">You're invited</span>
          <span className="c-story-panel-line">{line}</span>
        </span>
        <span className="c-story-panel-foot"><span className="c-story-invite-fact">{fact}</span></span>
      </figcaption>
    </figure>
  );
}

/**
 * On an empty screen: the bill from the story they saw, and the way to add
 * their own. `quiet` where the page already has its filled Add button.
 */
export function FirstBillCard({ story, onAdd, quiet = false }: { story: Story; onAdd: () => void; quiet?: boolean }) {
  const card = firstBillCard(story);
  return (
    <article className="c-story-card" aria-labelledby="story-first-bill">
      <Photo image={story.bill.img} className="c-story-card-photo" />
      <div className="c-story-card-copy">
        <p className="c-story-card-label">{card.label}</p>
        <h3 id="story-first-bill">{card.title}</h3>
        <p>{card.line}</p>
        <button className={quiet ? "a-btn ghost" : "a-btn"} type="button" onClick={onAdd}>Add a bill</button>
      </div>
    </article>
  );
}

/**
 * Loading: the story's lines, one after another, each held a moment. The last
 * one stays until the page is ready. Reduced motion keeps the first line.
 */
export function LoadingLines({ story }: { story: Story }) {
  const [lines] = useState(() => loadingLines(story));
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    if (index >= lines.length - 1) return;
    const timer = window.setTimeout(() => setIndex((current) => current + 1), 900);
    return () => window.clearTimeout(timer);
  }, [index, lines.length]);
  return <p className="c-story-loading" key={index}>{lines[index]}</p>;
}
