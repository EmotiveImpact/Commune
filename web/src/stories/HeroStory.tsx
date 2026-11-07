import type { Story } from '@commune/core/stories';
import { storyImage } from './images';
import { storyPage } from './choose';
import { StoryPlayer } from './StoryPlayer';

/**
 * The story in the homepage hero, chosen for the moment. On a wide screen it
 * plays beside the headline; on smaller screens a short card under the
 * buttons opens the story's own page.
 */
export function HeroStory({ story }: { story: Story }) {
  return <>
    <aside className="l-hero__story" aria-label="A Commune story">
      <StoryPlayer story={story} variant="hero" />
      <a className="l-hero__story-link" href={storyPage(story)}>{story.title} · Watch the story</a>
    </aside>
    <a className="l-hero__chip" href={storyPage(story)}>
      <img src={storyImage(story.beats[0].img)} alt="" loading="lazy" />
      <span><small>{story.cat} · A Commune story</small><strong>{story.beats[0].h}</strong><em>Watch the story</em></span>
    </a>
  </>;
}
