import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { STORIES } from '@commune/core/stories';
import { storyImage } from '../stories/images';
import { BrandWordmark } from '../BrandWordmark';
import { SiteMenu, useSiteMenu } from './SiteMenu';
import { StoryNotes, StoryViewer } from './StoryNotes';
import { JournalLayout } from './JournalLayout';
import { End } from './GreenPages';
import guides from './guides.json';
import '../editorial.css';
import './together.css';
import './story-notes.css';
import './pages.css';
import './polish.css';

function GuideArticle({ guide }: { guide: typeof guides[number] }) {
  useEffect(() => {
    document.title = `${guide.title} | Commune Journal`;
  }, [guide]);
  return <article className="g-article" aria-labelledby="guide-title">
    <header className="g-article__heading l-container">
      <a className="g-link" href="/journal.html#journal-guides">Back to the Journal</a>
      <span className="l-eyebrow">{guide.category} / Guide</span>
      <h1 id="guide-title" tabIndex={-1}>{guide.title}</h1>
      <p>{guide.intro}</p>
      <img className="g-article__photo" src={guide.image} alt={guide.alt} fetchPriority="high" />
    </header>
    <div className="g-article__body">
      {guide.paragraphs.map(text => <p key={text}>{text}</p>)}
      {guide.sections.map(section => <section className={section.example ? 'guide-example' : undefined} key={section.title}>
        <h2>{section.title}</h2>
        {section.paragraphs?.map(text => <p key={text}>{text}</p>)}
        {section.bullets && <ul>{section.bullets.map(text => <li key={text}>{text}</li>)}</ul>}
      </section>)}
    </div>
  </article>;
}

export function JournalPage() {
  const [menu, setMenu] = useState(false);
  const phone = useSiteMenu();
  const guide = guides.find(item => item.id === new URLSearchParams(window.location.search).get('guide'));
  return <div className="l-site" id="top">
    <SiteMenu {...phone} current="./journal.html" home="/" />
    <div className="t-jtop"><header className="l-header l-container"><BrandWordmark href="/" />
      <nav id="main-navigation" className={menu ? 'is-open' : ''} aria-label="Main navigation">
        <a href="/how-it-works.html">How it works</a><a href="/life-together.html">Life together</a><a href="/pricing.html">Pricing</a><a href="/journal.html" aria-current="page">Journal</a><a href="/about.html">About</a>
        <a className="l-login" href="https://app.ourcommune.io/login">Log in</a><a className="l-button l-button--white" href="https://app.ourcommune.io/signup">Get started</a>
      </nav>
      <button className="l-menu" aria-expanded={menu} aria-controls="main-navigation" onClick={() => setMenu(!menu)}>{menu ? 'Close' : 'Menu'}</button>
    </header></div>
    <main id="main-content">
      {guide ? <GuideArticle guide={guide} /> : <JournalLayout guides={guides} stories={STORIES} asset={storyImage} StoryViewer={StoryViewer} StoryRail={StoryNotes} />}
    </main>
    <End />
  </div>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><JournalPage /></StrictMode>);
