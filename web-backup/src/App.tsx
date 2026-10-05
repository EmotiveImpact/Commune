import { useEffect, useState } from 'react';

const signupUrl = 'https://app.ourcommune.io/signup';
const loginUrl = 'https://app.ourcommune.io/login';

const plans = [
  {
    name: 'Standard',
    price: '£4.99',
    description: 'For one shared space finding its rhythm.',
    details: ['1 group', 'Up to 8 members', 'Expenses, splits and payment tracking'],
  },
  {
    name: 'Pro',
    price: '£9.99',
    description: 'For the spaces and people you bring together.',
    details: ['Up to 3 groups', 'Up to 15 members per group', 'Advanced analytics and exports'],
  },
  {
    name: 'Agency',
    price: '£29.99',
    description: 'For bigger communities and operators.',
    details: ['Unlimited groups', 'Unlimited members', 'Priority support'],
  },
];

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 24);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  return (
    <header className={'site-header' + (scrolled || menuOpen ? ' site-header--solid' : '')}>
      <div className="site-header__inner shell">
        <a className="wordmark" href="#top" aria-label="Commune home" onClick={() => setMenuOpen(false)}>
          commune<span aria-hidden="true">.</span>
        </a>
        <nav className={'site-nav' + (menuOpen ? ' site-nav--open' : '')} aria-label="Main navigation">
          <a href="#platform" onClick={() => setMenuOpen(false)}>The platform</a>
          <a href="#spaces" onClick={() => setMenuOpen(false)}>Who it’s for</a>
          <a href="#pricing" onClick={() => setMenuOpen(false)}>Pricing</a>
          <a className="site-nav__login" href={loginUrl}>Sign in</a>
          <a className="site-nav__mobile-cta" href={signupUrl}>Start your space</a>
        </nav>
        <div className="site-header__actions">
          <a className="site-header__login" href={loginUrl}>Sign in</a>
          <a className="header-cta" href={signupUrl}>Start your space <span aria-hidden="true">↗</span></a>
          <button
            className="menu-toggle"
            type="button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            <span />
            <span />
          </button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <img className="hero__image" src="/hero-life.webp" alt="Friends sharing dinner in a lived-in home at dusk" fetchPriority="high" />
      <div className="hero__shade" aria-hidden="true" />
      <div className="hero__content shell">
        <p className="eyebrow eyebrow--light">A better way to share space</p>
        <h1 id="hero-title">For the life<br />you <em>share.</em></h1>
        <p className="hero__description">
          One clear place for shared money, responsibilities, and the everyday details that make a space work.
        </p>
        <div className="hero__actions">
          <a className="button button--cream" href={signupUrl}>Start your space <span aria-hidden="true">↗</span></a>
          <a className="text-link text-link--light" href="#platform">Explore Commune <span aria-hidden="true">↓</span></a>
        </div>
      </div>
      <div className="hero__footer shell" aria-hidden="true">
        <span>Shared life, clearer.</span>
        <span>Scroll to explore <span className="hero__down">↓</span></span>
      </div>
    </section>
  );
}

function Intro() {
  return (
    <section className="intro section-pad" aria-labelledby="intro-title">
      <div className="shell intro__grid">
        <p className="eyebrow">01 / Why Commune</p>
        <div>
          <h2 id="intro-title">A shared space should feel like <em>everyone’s.</em></h2>
          <div className="intro__bottom">
            <p>
              Bills in one chat. Chores in another. The important stuff somewhere no one can find. Commune brings the moving parts together so everyone knows where things stand.
            </p>
            <a className="text-link" href="#platform">See how it works <span aria-hidden="true">↗</span></a>
          </div>
        </div>
      </div>
    </section>
  );
}

type PreviewTab = 'money' | 'responsibilities';

function ProductPreview() {
  const [activeTab, setActiveTab] = useState<PreviewTab>('money');
  return (
    <div className="preview" aria-label="Illustrative preview of Commune">
      <div className="preview__rail">
        <span className="preview__brand">commune<span>.</span></span>
        <span className="preview__rail-label">YOUR SPACE</span>
        <span className="preview__rail-space">Maple House <span aria-hidden="true">⌄</span></span>
        <span className="preview__rail-bottom">A place for everyone.</span>
      </div>
      <div className="preview__main">
        <div className="preview__topline"><span>Maple House</span><span>4 members</span></div>
        <h3>Good morning, Alex.</h3>
        <p className="preview__subhead">Here’s what’s happening in your space.</p>
        <div className="preview__tabs" role="tablist" aria-label="Preview section">
          <button type="button" role="tab" aria-selected={activeTab === 'money'} className={'preview__tab' + (activeTab === 'money' ? ' preview__tab--active' : '')} onClick={() => setActiveTab('money')}>Shared money</button>
          <button type="button" role="tab" aria-selected={activeTab === 'responsibilities'} className={'preview__tab' + (activeTab === 'responsibilities' ? ' preview__tab--active' : '')} onClick={() => setActiveTab('responsibilities')}>Responsibilities</button>
        </div>
        {activeTab === 'money' ? (
          <div className="preview__panel" role="tabpanel">
            <div className="preview__summary">
              <div><span className="preview__kicker">YOUR SHARE THIS MONTH</span><strong>£386.50</strong><span className="preview__summary-note">Across 3 shared expenses</span></div>
              <span className="preview__status">Everything is up to date</span>
            </div>
            <div className="preview__list-head"><span>Shared expenses</span><span>Your share</span></div>
            <div className="preview__row"><span><b>Rent</b><small>Due 1 October · Split 4 ways</small></span><strong>£300.00</strong></div>
            <div className="preview__row"><span><b>Utilities</b><small>Due 5 October · Split 4 ways</small></span><strong>£52.50</strong></div>
            <div className="preview__row"><span><b>Internet</b><small>Due 12 October · Split 4 ways</small></span><strong>£34.00</strong></div>
          </div>
        ) : (
          <div className="preview__panel" role="tabpanel">
            <div className="preview__summary">
              <div><span className="preview__kicker">YOUR SPACE THIS WEEK</span><strong>3 things to do</strong><span className="preview__summary-note">The little things, clearly owned</span></div>
              <span className="preview__status">1 finished</span>
            </div>
            <div className="preview__list-head"><span>Responsibilities</span><span>Owner</span></div>
            <div className="preview__row"><span><b>Take the recycling out</b><small>Today</small></span><strong>Alex</strong></div>
            <div className="preview__row"><span><b>Clean the kitchen</b><small>Tomorrow</small></span><strong>Sam</strong></div>
            <div className="preview__row"><span><b>Water the plants</b><small>Friday</small></span><strong>Jordan</strong></div>
          </div>
        )}
      </div>
    </div>
  );
}

function Platform() {
  return (
    <section className="platform section-pad" id="platform" aria-labelledby="platform-title">
      <div className="shell">
        <div className="platform__heading">
          <div><p className="eyebrow eyebrow--light">02 / The platform</p><h2 id="platform-title">The whole picture.<br /><em>At a glance.</em></h2></div>
          <p>See what you owe, what’s been paid, and what needs doing. Every person gets clarity. The group keeps moving.</p>
        </div>
        <ProductPreview />
        <p className="platform__note">An illustrative look at a Commune space</p>
      </div>
    </section>
  );
}

function Spaces() {
  return (
    <section className="spaces section-pad" id="spaces" aria-labelledby="spaces-title">
      <div className="shell">
        <div className="spaces__top"><p className="eyebrow">03 / Made for your kind of together</p><h2 id="spaces-title">One platform.<br /><em>So many ways to share.</em></h2></div>
        <div className="spaces__list">
          <div className="spaces__item"><span>01</span><h3>Homes</h3><p>Keep rent, bills and household jobs clear for every housemate.</p></div>
          <div className="spaces__item"><span>02</span><h3>Studios</h3><p>Run a shared workspace with costs and responsibilities in one place.</p></div>
          <div className="spaces__item"><span>03</span><h3>Groups</h3><p>Make the moving parts of a trip or ongoing project easier to manage.</p></div>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section className="pricing section-pad" id="pricing" aria-labelledby="pricing-title">
      <div className="shell">
        <div className="pricing__heading">
          <div><p className="eyebrow">04 / Pricing</p><h2 id="pricing-title">Good things are <em>better shared.</em></h2></div>
          <p>Choose the space that fits. Start with a free trial, then pick a plan that works for your group.</p>
        </div>
        <div className="pricing__grid">
          {plans.map((plan) => (
            <article className="plan" key={plan.name}>
              <div className="plan__top"><h3>{plan.name}</h3><p>{plan.description}</p></div>
              <div className="plan__price"><strong>{plan.price}</strong><span>/ month</span></div>
              <ul>{plan.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
              <a href={signupUrl}>Start free trial <span aria-hidden="true">↗</span></a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="final-cta" aria-labelledby="final-title">
      <div className="shell final-cta__inner">
        <p className="eyebrow eyebrow--light">Make space for more</p>
        <h2 id="final-title">Let’s make sharing<br /><em>feel effortless.</em></h2>
        <a className="button button--cream" href={signupUrl}>Start your space <span aria-hidden="true">↗</span></a>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="shell footer__inner">
        <div><a className="wordmark wordmark--dark" href="#top">commune<span aria-hidden="true">.</span></a><p>Shared life, clearer.</p></div>
        <nav aria-label="Footer navigation">
          <a href="#platform">The platform</a>
          <a href="#spaces">Who it’s for</a>
          <a href="#pricing">Pricing</a>
          <a href="https://app.ourcommune.io/privacy">Privacy</a>
          <a href="mailto:support@ourcommune.io">Contact</a>
        </nav>
      </div>
      <div className="shell footer__bottom"><span>© {new Date().getFullYear()} Commune</span><span>For the life you share.</span></div>
    </footer>
  );
}

export default function App() {
  return (
    <>
      <Header />
      <main><Hero /><Intro /><Platform /><Spaces /><Pricing /><FinalCta /></main>
      <Footer />
    </>
  );
}
