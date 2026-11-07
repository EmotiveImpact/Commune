import { useState } from 'react';
import { CAST, demoSplit, demoSelected, demoPeople, type Story } from '@commune/core/stories';
import { BrandWordmark } from '../BrandWordmark';
import { appLink } from './choose';
import { StoryPlayer } from './StoryPlayer';
import { TrySplit } from './TrySplit';

/**
 * A story's own page, for ads: the slides, then the demo split, with a way
 * into the app on every slide.
 */
export default function StoryPage({ story }: { story: Story }) {
  const [ended, setEnded] = useState(false);
  const [round, setRound] = useState(0);
  const split = demoSplit(story, demoSelected(demoPeople(story)));
  const [, , sorted, last] = story.beats;
  const start = appLink(story);
  return <div className="l-site s-page">
    <header className="s-page__head">
      <BrandWordmark />
      <a className="l-button l-button--white" href={start}>Get started</a>
    </header>
    <main>
      <section className="s-page__main" aria-labelledby="story-title">
        <div className="s-page__stage">
          <StoryPlayer key={round} story={story} variant="page" onEnd={() => setEnded(true)}>
            {ended ? <div className="s-player__end">
              <span className="s-player__eyebrow">Try it. No account needed</span>
              <p className="s-player__line">{split.title}</p>
              <p className="s-player__end-lede">Your turn. {CAST[story.bill.payer].n} paid. Tap who was there.</p>
              <div className="s-player__end-actions">
                <a className="l-button l-button--white" href="#try">Try it</a>
                <a className="l-button s-button--ghost" href={start}>Get started</a>
              </div>
              <button className="s-player__again" type="button" onClick={() => { setEnded(false); setRound(round + 1); }}>Watch again</button>
            </div> : null}
          </StoryPlayer>
        </div>
        <div className="s-page__side">
          <span className="l-eyebrow">{story.cat} · {story.commune}</span>
          <h1 id="story-title">{story.title}</h1>
          <p>{sorted.h} {last.h}</p>
          <div className="s-page__actions"><a className="l-button l-button--white" href={start}>Get started</a><a className="l-text-link" href="#try">Try the split</a></div>
          <small>Tap the right of the photo to go on, the left to go back. Press and hold to pause.</small>
        </div>
      </section>
      <section className="s-page__try l-section" id="try" aria-labelledby="try-title">
        <div className="l-container">
          <div className="l-section-heading"><div><span className="l-eyebrow">Try it. No account needed</span><h2 id="try-title">{split.title}</h2></div><p>Your turn. {CAST[story.bill.payer].n} paid.<br />Tap who was there.</p></div>
          <TrySplit story={story} headingId="try-title" />
          <div className="s-try__action"><a className="l-button" href={start}>Get started</a><span>Start with 7 days on Standard.</span></div>
        </div>
      </section>
    </main>
    <footer className="s-page__foot l-container"><span>© {new Date().getFullYear()} Commune</span><span><a href="/editorial.html">Commune home</a><a href="https://app.ourcommune.io/privacy">Privacy policy</a><a href="https://app.ourcommune.io/terms">Terms of service</a></span></footer>
  </div>;
}
