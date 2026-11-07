import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrandWordmark } from '../BrandWordmark';
import { SiteMenu, useSiteMenu } from './SiteMenu';
import { StoryNotes } from './StoryNotes';
import '../editorial.css';
import './together.css';
import './story-notes.css';

// Rebuilt from the published Green Third journal page, with the stories added at the top.
const signup = 'https://app.ourcommune.io/signup';
const guides = [
  { cat: 'Home', title: 'A shared home. A little less guesswork.', image: '/unique-journal-home.jpg', alt: 'Housemates sharing the Saturday morning kitchen routine' },
  { cat: 'Work', title: 'Good work starts on the same page.', image: '/unique-journal-work.jpg', alt: 'Two makers tidying their shared workshop' },
  { cat: 'Trips', title: 'A little planning for a better trip.', image: '/unique-journal-trip.jpg', alt: 'Friends looking across the bay from a ferry' },
  { cat: 'Couples', title: 'Moving in together: what to agree first.', image: '/t/g-real-sofa-couple.jpg', alt: 'A couple laughing at a phone on the sofa' },
  { cat: 'Home', title: 'A fair rota for a busy house.', image: '/t/g-real-washing-up.jpg', alt: 'Housemates washing up together' },
  { cat: 'Landlords', title: 'Bills and details for the homes you look after.', image: '/t/g-new-landlady.jpg', alt: 'A landlady at the door of a shared house' },
];
const index = [
  { cat: 'Home', title: 'Splitting the energy bill when someone works from home' },
  { cat: 'Trips', title: 'Sharing a holiday cottage without the awkward maths' },
  { cat: 'Couples', title: 'Who pays for what when you earn different amounts' },
  { cat: 'Work', title: 'Running a shared studio: rent, supplies and turns' },
  { cat: 'Home', title: 'Welcoming a new housemate in the first week' },
  { cat: 'Landlords', title: 'Keeping house details in one place for every tenant' },
];
const cats = ['All', 'Home', 'Couples', 'Work', 'Trips', 'Landlords'];
const LinkButton = ({ children, href = signup, variant = '' }: { children: string; href?: string; variant?: string }) => <a className={`l-button ${variant && `l-button--${variant}`}`} href={href}>{children}</a>;

function JournalPage() {
  const [menu, setMenu] = useState(false);
  const phone = useSiteMenu();
  const [cat, setCat] = useState('All');
  return <div className="l-site" id="top">
    <SiteMenu {...phone} current="./journal.html" home="./index.html" />
    <div className="t-jtop"><header className="l-header l-container"><BrandWordmark href="./index.html" />
      <nav id="main-navigation" className={menu ? 'is-open' : ''} aria-label="Main navigation">
        <a href="/how-it-works.html">How it works</a><a href="/life-together.html">Life together</a><a href="/pricing.html">Pricing</a><a href="./journal.html">Journal</a><a href="/about.html">About</a>
        <a className="l-login" href="https://app.ourcommune.io/login">Log in</a><LinkButton variant="white">Start free trial</LinkButton>
      </nav>
      <button className="l-menu" aria-expanded={menu} aria-controls="main-navigation" onClick={() => setMenu(!menu)}>{menu ? 'Close' : 'Menu'}</button>
    </header></div>
    <main>
      <section className="t-journal t-journal--page" id="journal" aria-labelledby="journal-title"><div className="l-container">
        <div className="t-journal__head"><h1 id="journal-title">Journal</h1><p>Notes on doing life together. Stories and ideas for the homes, workspaces and adventures we share.</p></div>
      </div>
        <div className="t-jstories"><div className="l-container"><span className="l-eyebrow">Commune stories</span><h2>Real life, sorted.</h2></div><StoryNotes /></div>
        <div className="l-container">
        <div className="t-journal__cats" role="group" aria-label="Filter the journal">{cats.map(c => <button key={c} aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}</div>
        <div className="t-journal__grid">{guides.filter(g => cat === 'All' || g.cat === cat).map(g => <a className="t-guide" href="/journal.html" key={g.title}><div className="t-guide__img"><img src={g.image} alt={g.alt} loading="lazy" /><span>{g.cat}</span></div><h3>{g.title}</h3><span className="t-guide__more">Read the guide</span></a>)}</div>
        <div className="t-journal__index">{index.filter(g => cat === 'All' || g.cat === cat).map(g => <a href="/journal.html" key={g.title}><span className="t-ji__cat">{g.cat}</span><span className="t-ji__title">{g.title}</span><span className="t-ji__more">Read the guide</span></a>)}</div>
      </div></section>
    </main>
    <div className="l-ending"><img className="l-ending__photo" src="/unique-footer.jpg" alt="" loading="lazy" />
      <section className="l-final-cta" aria-labelledby="closing-title"><div className="l-container"><span className="l-eyebrow">Less admin. More living.</span><h2 id="closing-title">Make space for the good stuff.</h2><p>The costs, the jobs, the little details. A shared place for it all.<br />Start with 7 days on Standard.</p><LinkButton variant="white">Start your 7-day free trial</LinkButton></div></section>
    </div>
  </div>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><JournalPage /></StrictMode>);
