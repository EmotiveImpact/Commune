import { useEffect, useRef, useState } from 'react';
import { CAST, demoPeople, demoSelected, demoSplit, shortFace, storyMoney, toggleDemo, type Story } from '@commune/core/stories';
import { storyImage } from './images';
import { useReducedMotion } from './StoryPlayer';

/** The share counting up or down to its new amount, as the prototype rolls it. */
function useRolling(target: number, reduced: boolean): number {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (reduced || from.current === target) { from.current = target; setShown(target); return; }
    const start = from.current;
    const began = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - began) / 520);
      const eased = 1 - Math.pow(1 - p, 3);
      const value = Math.round(start + (target - start) * eased);
      from.current = value;
      setShown(value);
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, reduced]);
  return shown;
}

/**
 * The demo split from the opening: the story's bill, who was there, and each
 * share. You and whoever paid are always in; tap the others in or out.
 * Wording and maths come from @commune/core/stories, as in the prototype.
 */
export function TrySplit({ story, headingId }: { story: Story; headingId?: string }) {
  const reduced = useReducedMotion();
  const people = demoPeople(story);
  const [selected, setSelected] = useState(() => demoSelected(people));
  useEffect(() => setSelected(demoSelected(demoPeople(story))), [story]);
  const split = demoSplit(story, selected);
  const cur = story.bill.cur ?? '£';
  const each = useRolling(split.each, reduced);
  const payer = CAST[story.bill.payer];
  return <div className="s-try">
    <div className="s-try__card">
      <div className="s-try__receipt">
        <img src={storyImage(story.bill.img)} alt="" loading="lazy" />
        <div><strong>{story.bill.n}</strong><span>Today · {payer.n} paid</span></div>
        <b>{storyMoney(story.bill.p, cur)}</b>
      </div>
      <div className="s-try__who" role="group" aria-labelledby={headingId ? `${headingId}-who` : undefined}>
        <span id={headingId ? `${headingId}-who` : undefined}>Who was there?</span>
        <div style={{ gridTemplateColumns: `repeat(${people.length}, minmax(0, 1fr))` }}>
          {people.map((who, i) => <button key={who} type="button" className="s-pick" aria-pressed={selected[i]} aria-disabled={i <= 1 || undefined}
            aria-label={i === 0 ? 'You, always in' : i === 1 ? `${CAST[who as keyof typeof CAST].n}, who paid` : CAST[who as keyof typeof CAST].n}
            onClick={() => setSelected(current => toggleDemo(current, i))}>
            <span className="s-pick__face">
              {who === 'you' ? <span className="s-pick__you">You</span> : <img src={storyImage(CAST[who].av)} alt="" width={50} height={50} />}
              <span className="s-pick__tick" aria-hidden="true"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
            </span>
            {shortFace(who)}
          </button>)}
        </div>
      </div>
    </div>
    <div className="s-try__each">
      <div className="s-try__amount"><span>{storyMoney(each, cur)}</span><small>each</small></div>
      <p aria-live="polite">{split.line}</p>
    </div>
  </div>;
}
