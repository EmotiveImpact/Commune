import { useEffect, useState } from "react";
import { CAST, FOCAL, firstBillCard, loadingLines, type ImageKey, type Story } from "@commune/core/stories";
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

/**
 * The opening story on the sign-in, sign-up and invitation pages: its first
 * photo and line, and the moment Commune sorted it, as the notification it
 * sent. Beside the form on a wide screen; a short strip above it on a phone.
 */
export function AuthStory({ story, compact = false }: { story: Story; compact?: boolean }) {
  const [opening] = story.beats;
  const sorted = story.beats.find((beat) => beat.note && !beat.cast)?.note;
  if (compact) {
    return (
      <figure className="c-story-strip">
        <Photo image={opening.img} className="c-story-strip-photo" />
        <figcaption><span>{opening.e}</span>{opening.h}</figcaption>
      </figure>
    );
  }
  return (
    <figure className="c-story-auth">
      <Photo image={opening.img} className="c-story-auth-photo" />
      <figcaption className="c-story-auth-copy">
        <span className="c-story-eyebrow">{opening.e}</span>
        <span className="c-story-line">{opening.h}</span>
        {sorted ? (
          <span className="c-story-note">
            <img src={storyImage(CAST[sorted.who].av)} alt="" width={36} height={36} />
            <span>
              <span className="c-story-note-top"><b>commune.</b><span>{sorted.w ?? "now"}</span></span>
              <strong>{sorted.t}</strong>
              <span>{sorted.s}</span>
            </span>
          </span>
        ) : null}
      </figcaption>
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
    <figure className="c-story-auth">
      <Photo image="inv-home" className="c-story-auth-photo" />
      <figcaption className="c-story-auth-copy">
        <span className="c-story-eyebrow">You're invited</span>
        <span className="c-story-line">{line}</span>
        <span className="c-story-invite-fact">{fact}</span>
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
