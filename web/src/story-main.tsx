import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { storyById } from '@commune/core/stories';
import StoryPage from './stories/StoryPage';
import { siteStory } from './stories/choose';
import './editorial.css';
import './stories/stories.css';

// /s/<id>: the build writes the id into each story's copy of this page, and
// the dev server serves this page for /s/<id>, so the address carries it too.
const root = document.getElementById('root')!;
const id = root.dataset.story || /^\/s\/([a-z]+)/.exec(window.location.pathname)?.[1] || new URLSearchParams(window.location.search).get('story') || '';
const story = storyById(id) ?? siteStory();
document.title = `${story.title} | Commune`;

createRoot(root).render(<StrictMode><StoryPage story={story} /></StrictMode>);
