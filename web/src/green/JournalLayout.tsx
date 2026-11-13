import * as React from 'react';
import type { STORIES } from '@commune/core/stories';
import type { storyImage } from '../stories/images';
import type guideData from './guides.json';
type JournalLayoutProps = {
 guides: typeof guideData;
 stories: typeof STORIES;
 asset: typeof storyImage;
 StoryViewer: React.ComponentType<{at: number; setAt: (index: number | null) => void}>;
 StoryRail: React.ComponentType;
};
/* Journal-only editorial layout. Existing guides, story data and player stay intact. */
function createJournalLayout() {
  const h = React.createElement;
  const arrow = () => h('svg', { className: 'j-arrow', viewBox: '0 0 20 20', 'aria-hidden': true }, h('path', { d: 'M5 15 15 5M5 5h10v10', fill: 'none', stroke: 'currentColor', strokeWidth: '1.5' }));
  const play = () => h('svg', { viewBox: '0 0 24 24', 'aria-hidden': true },
    h('path', { d: 'M8 5.5v13l10.5-6.5z', fill: 'currentColor' }));
  return function JournalLayout({ guides, stories, asset, StoryViewer, StoryRail }: JournalLayoutProps) {
    const [category, setCategory] = React.useState('All');
    const [activeStory, setActiveStory] = React.useState<number | null>(null);
    const featuredIndex = stories.findIndex(story => story.id === 'roast');
    const featured = stories[featuredIndex];
    const visibleGuides = guides.filter(guide => category === 'All' || guide.category === category);
    return h('div', { className: 'j-editorial', id: 'journal' },
      h('header', { className: 'j-masthead l-container', 'aria-labelledby': 'journal-title' },
        h('div', null,
          h('span', { className: 'j-kicker' }, 'The shared-life edit'),
          h('h1', { id: 'journal-title' }, 'Journal', h('span', { 'aria-hidden': true }, '.'))),
        h('div', { className: 'j-masthead__note' },
          h('p', null, 'Notes on doing life together. Stories and ideas for the homes, workspaces and adventures we share.'),
          h('nav', { className: 'j-index', 'aria-label': 'In this journal' },
            h('a', { href: '#journal-guides' }, 'Practical guides', arrow()),
            h('a', { href: '#journal-stories' }, 'Housemate stories', arrow())))),
      h('section', { className: 'j-feature l-container', 'aria-labelledby': 'featured-title' },
        h('button', { type: 'button', className: 'j-feature__image', onClick: () => setActiveStory(featuredIndex), 'aria-label': `Watch featured story: ${featured.title}` },
          h('img', { src: asset(featured.beats[1].img), alt: 'Housemates preparing Sunday dinner together', fetchPriority: 'high' }),
          h('span', { className: 'j-feature__image-label', 'aria-hidden': true }, featured.commune),
          h('span', { className: 'j-feature__play', 'aria-hidden': true }, play())),
        h('div', { className: 'j-feature__copy' },
          h('div', { className: 'j-feature__meta' }, h('span', { className: 'j-kicker' }, 'Featured story'), h('span', null, featured.cat)),
          h('div', null,
            h('p', { className: 'j-feature__overline' }, featured.beats[0].h),
            h('h2', { id: 'featured-title' }, featured.title, h('span', { 'aria-hidden': true }, '.')),
            h('p', { className: 'j-feature__dek' }, featured.beats[1].h)),
          h('button', { type: 'button', className: 'j-text-link', onClick: () => setActiveStory(featuredIndex) }, 'Watch the story', arrow()))),
      h('section', { className: 'j-guides', id: 'journal-guides', 'aria-labelledby': 'guides-title' },
        h('div', { className: 'l-container' },
          h('header', { className: 'j-section-head' },
            h('div', null, h('span', { className: 'j-kicker' }, 'A little less guesswork'), h('h2', { id: 'guides-title' }, 'Practical guides')),
            h('p', null, 'Clear agreements, worked examples and small routines for the everyday.')),
          h('div', { className: 'j-guide-tools' },
            h('div', { className: 'j-filters', role: 'group', 'aria-label': 'Filter practical guides' },
              ['All', 'Home', 'Work', 'Trips'].map(name => h('button', { type: 'button', key: name, 'aria-pressed': category === name, onClick: () => setCategory(name) }, name))),
            h('span', { className: 'j-guide-count', 'aria-live': 'polite', 'aria-atomic': true }, `${visibleGuides.length} ${visibleGuides.length === 1 ? 'guide' : 'guides'}`)),
          h('div', { className: `j-guide-grid${category !== 'All' ? ' is-filtered' : ''}` },
            visibleGuides.map((guide, index) => h('a', { key: guide.id, className: `j-guide-card${index === 0 ? ' j-guide-card--lead' : ''}`, href: `/journal.html?guide=${guide.id}` },
              h('div', { className: 'j-guide-card__image' }, h('img', { src: guide.image, alt: guide.alt, loading: 'lazy' })),
              h('div', { className: 'j-guide-card__copy' },
                h('span', { className: 'j-kicker' }, `${guide.category} / Guide`),
                h('h3', null, guide.title),
                h('p', null, guide.intro),
                h('span', { className: 'j-text-link' }, 'Read the guide', arrow()))))))),
      h('section', { className: 'j-stories t-jstories', id: 'journal-stories', 'aria-labelledby': 'stories-title' },
        h('header', { className: 'j-section-head l-container' },
          h('div', null, h('span', { className: 'j-kicker' }, 'Housemates & beyond'), h('h2', { id: 'stories-title' }, 'Life between the admin.')),
          h('p', null, 'From Sunday dinner to moving day. Illustrated stories about the things we share.')),
        h(StoryRail)),
      activeStory === null ? null : h(StoryViewer, { at: activeStory, setAt: setActiveStory }));
  };
}

export const JournalLayout = createJournalLayout();
