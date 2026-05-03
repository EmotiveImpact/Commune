import { useState, useEffect, useRef, useCallback } from 'react';

/* ─── REVEAL ─── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add('visible'); obs.unobserve(el); } },
      { threshold: 0.1, rootMargin: '0px 0px -48px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}
function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useReveal();
  return <div ref={ref} className={`reveal ${delay ? `d${delay}` : ''} ${className}`}>{children}</div>;
}

/* ═══════════════════════════════════════════════════════════
   HEADER
   ═══════════════════════════════════════════════════════════ */
function Header() {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const fn = () => setSolid(window.scrollY > 60);
    window.addEventListener('scroll', fn, { passive: true });
    fn();
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <header className={`hdr ${solid ? 'hdr--solid' : ''}`}>
      <div className="hdr__inner">
        <a href="#" className="hdr__logo">
          <img src="/logo.png" alt="Commune" />
          <span>Commune</span>
        </a>
        <nav className="hdr__nav">
          <a href="#why">Why Commune</a>
          <a href="#usecases">Use cases</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <div className="hdr__actions">
          <a href="https://app.ourcommune.io" className="hdr__signin">Sign in</a>
          <a href="https://app.ourcommune.io/signup" className="hdr__cta">Get started</a>
        </div>
      </div>
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════
   HERO SLIDESHOW
   ═══════════════════════════════════════════════════════════ */
const SLIDES = [
  {
    id: 'home',
    label: 'House shares',
    idx: '01',
    img: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1920&q=85&auto=format&fit=crop',
    h: 'Your home,\nrun smoothly.',
    sub: 'Split rent, track bills, keep everyone on the same page.',
  },
  {
    id: 'couple',
    label: 'Couples',
    idx: '02',
    img: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=1920&q=85&auto=format&fit=crop',
    h: 'Money, together.\nNo awkwardness.',
    sub: 'Share expenses, set budgets, and settle up fairly.',
  },
  {
    id: 'workspace',
    label: 'Studios & workspaces',
    idx: '03',
    img: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&q=85&auto=format&fit=crop',
    h: 'Your workspace,\none hub.',
    sub: 'Shared costs, pooled tools, and clear ownership.',
  },
  {
    id: 'trip',
    label: 'Group trips',
    idx: '04',
    img: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1920&q=85&auto=format&fit=crop',
    h: 'Every trip,\nfully settled.',
    sub: 'Log on the go, split instantly, settle before you land.',
  },
  {
    id: 'project',
    label: 'Creative projects',
    idx: '05',
    img: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1920&q=85&auto=format&fit=crop',
    h: 'Projects that\ndon\'t fall apart.',
    sub: 'Budget visibility and shared ownership, from start to finish.',
  },
];

const AVATARS = [
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&h=80&q=80&auto=format&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&q=80&auto=format&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&q=80&auto=format&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&q=80&auto=format&fit=crop&crop=face',
];

const SLIDE_MS = 5500;

function Hero() {
  const [cur, setCur] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const t0 = useRef(Date.now());

  const goTo = useCallback((i: number) => {
    setPrev(cur); setCur(i); setProgress(0); t0.current = Date.now();
  }, [cur]);
  const next = useCallback(() => goTo((cur + 1) % SLIDES.length), [cur, goTo]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(next, SLIDE_MS);
    return () => clearInterval(id);
  }, [paused, next]);

  useEffect(() => {
    setProgress(0); t0.current = Date.now();
    if (paused) return;
    const id = setInterval(() => setProgress(Math.min(((Date.now() - t0.current) / SLIDE_MS) * 100, 100)), 40);
    return () => clearInterval(id);
  }, [cur, paused]);

  const s = SLIDES[cur]!;

  return (
    <section className="hero" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {SLIDES.map((sl, i) => (
        <div key={sl.id} className={`hero__slide ${i === cur ? 'is-active' : ''} ${i === prev ? 'is-exit' : ''}`}>
          <img src={sl.img} alt={sl.label} className="hero__img" loading={i === 0 ? 'eager' : 'lazy'} />
        </div>
      ))}

      <div className="hero__overlay" />

      <div className="hero__body">
        <div className="hero__txt-wrap">
          {SLIDES.map((sl, i) => (
            <div key={sl.id} className={`hero__txt ${i === cur ? 'is-in' : ''}`}>
              <h1 className="hero__h1">
                {sl.h.split('\n').map((l, j) => <span key={j}>{l}<br /></span>)}
              </h1>
              <p className="hero__sub">{sl.sub}</p>
            </div>
          ))}
        </div>

        <div className="hero__foot">
          <div className="hero__proof">
            <div className="hero__avs">
              {AVATARS.map((src, i) => <img key={i} src={src} alt="" className="hero__av" />)}
            </div>
            <span className="hero__proof-txt"><strong>2,400+</strong> groups doing life together</span>
          </div>
          <a href="https://app.ourcommune.io/signup" className="btn-hero">Start for free →</a>
        </div>
      </div>

      {/* Progress track */}
      <div className="hero__track">
        {SLIDES.map((sl, i) => (
          <button key={sl.id} className={`hero__seg ${i === cur ? 'is-cur' : ''}`} onClick={() => goTo(i)} aria-label={sl.label}>
            <span className="hero__fill" style={{ width: i === cur ? `${progress}%` : i < cur ? '100%' : '0%' }} />
          </button>
        ))}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   STATEMENT — big editorial block
   ═══════════════════════════════════════════════════════════ */
const USE_CASE_PHOTOS = [
  { label: 'House shares', img: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&q=80&auto=format&fit=crop' },
  { label: 'Studios', img: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&q=80&auto=format&fit=crop' },
  { label: 'Group trips', img: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80&auto=format&fit=crop' },
];

function Statement() {
  return (
    <section className="stmt">
      <div className="stmt__inner">
        <div className="stmt__left">
          <Reveal>
            <p className="eyebrow">About Commune</p>
            <h2 className="stmt__h2">
              Managing shared money and shared spaces shouldn't be complicated.
            </h2>
          </Reveal>
          <Reveal delay={1}>
            <p className="stmt__body">
              Whether you share a home, run a studio, travel in groups, or manage a
              creative project — Commune gives you one clear place for every cost,
              every responsibility, and every person involved.
            </p>
            <a href="#usecases" className="link-arrow">Explore use cases →</a>
          </Reveal>
        </div>
        <div className="stmt__photos">
          {USE_CASE_PHOTOS.map((p, i) => (
            <Reveal key={p.label} delay={Math.min(i + 1, 3) as 1 | 2 | 3}>
              <div className="stmt__photo">
                <img src={p.img} alt={p.label} />
                <span>{p.label}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   WHY COMMUNE — bold + accordion
   ═══════════════════════════════════════════════════════════ */
const WHY = [
  { n: '01', t: 'Communal finance that actually works', d: 'Track recurring bills, split costs fairly, automate reimbursements, and maintain one financial truth across every member.' },
  { n: '02', t: 'Space hubs with full context', d: 'Every space gets its own hub — members, roles, pinned notices, essentials, and shared identity in one place.' },
  { n: '03', t: 'Clear responsibilities & ownership', d: 'Assign tasks, track who owns what, set reminders, and know what needs approval before it becomes a problem.' },
  { n: '04', t: 'One command centre, many spaces', d: 'Switch between a home, studio, and trip in seconds. See what is owed and what needs attention across all your spaces at once.' },
];

function Why() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="why" className="why">
      <div className="why__inner">
        <Reveal>
          <h2 className="why__big">WHY<br />COMMUNE?</h2>
        </Reveal>
        <div className="why__items">
          {WHY.map((w, i) => (
            <Reveal key={w.n} delay={Math.min(i + 1, 4) as 1 | 2 | 3 | 4}>
              <div className={`why__item ${open === i ? 'is-open' : ''}`}>
                <button className="why__q" onClick={() => setOpen(open === i ? null : i)}>
                  <span className="why__n">{w.n}</span>
                  <span className="why__title">{w.t}</span>
                  <span className="why__chevron">{open === i ? '−' : '+'}</span>
                </button>
                {open === i && <p className="why__ans">{w.d}</p>}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   USE CASES — photo grid
   ═══════════════════════════════════════════════════════════ */
const CASES = [
  { id: 'home',      label: 'House shares',       sub: 'Rent · Bills · Chores',          img: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=700&q=80&auto=format&fit=crop' },
  { id: 'couple',    label: 'Couples',             sub: 'Budgets · Joint expenses',       img: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=700&q=80&auto=format&fit=crop' },
  { id: 'workspace', label: 'Studios & offices',   sub: 'Shared costs · Tools · Roles',  img: 'https://images.unsplash.com/photo-1497366858526-0766f6d2769a?w=700&q=80&auto=format&fit=crop' },
  { id: 'trip',      label: 'Group trips',         sub: 'Expenses on the go · Settle up', img: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=700&q=80&auto=format&fit=crop' },
  { id: 'project',   label: 'Creative projects',   sub: 'Budget · Ownership · Handover', img: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=700&q=80&auto=format&fit=crop' },
];

function UseCases() {
  return (
    <section id="usecases" className="cases">
      <div className="cases__inner">
        <Reveal className="cases__hdr">
          <p className="eyebrow">Use cases</p>
          <h2 className="cases__h2">Built for every way<br />people share space</h2>
        </Reveal>
        <div className="cases__grid">
          {CASES.map((c, i) => (
            <Reveal key={c.id} delay={Math.min(i + 1, 5) as 1 | 2 | 3 | 4 | 5}>
              <div className="case-card">
                <div className="case-card__img">
                  <img src={c.img} alt={c.label} />
                </div>
                <div className="case-card__copy">
                  <p className="case-card__label">{c.label}</p>
                  <p className="case-card__sub">{c.sub}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   FULL-BLEED CTA PHOTO
   ═══════════════════════════════════════════════════════════ */
function PhotoCta() {
  return (
    <section className="photo-cta">
      <img
        src="https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1920&q=85&auto=format&fit=crop"
        alt="Modern shared living"
        className="photo-cta__img"
      />
      <div className="photo-cta__overlay" />
      <div className="photo-cta__body">
        <Reveal>
          <h2 className="photo-cta__h2">Live Clearly,<br />Together.</h2>
          <a href="https://app.ourcommune.io/signup" className="btn-outline-white">Start your space →</a>
        </Reveal>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   PRICING
   ═══════════════════════════════════════════════════════════ */
const PLANS = [
  {
    name: 'Standard', price: '£4.99', mo: '/mo', featured: false,
    items: ['1 space', 'Up to 8 members', 'Communal finance & splits', 'Responsibilities & reminders', 'Monthly breakdown', 'Group hub'],
  },
  {
    name: 'Pro', price: '£9.99', mo: '/mo', featured: true,
    items: ['Up to 3 spaces', 'Up to 15 members', 'Everything in Standard', 'Advanced analytics', 'Exports & templates', 'Priority support'],
  },
  {
    name: 'Agency', price: '£29.99', mo: '/mo', featured: false,
    items: ['Unlimited spaces', 'Unlimited members', 'Everything in Pro', 'Priority workflows', 'Dedicated onboarding', 'Operator-ready path'],
  },
];

function Pricing() {
  return (
    <section id="pricing" className="pricing">
      <div className="pricing__inner">
        <Reveal className="pricing__hdr">
          <p className="eyebrow">Membership</p>
          <h2 className="pricing__h2">Simple,<br />transparent pricing.</h2>
          <p className="pricing__sub">7-day free trial on your first space. No card required.</p>
        </Reveal>
        <div className="pricing__grid">
          {PLANS.map((p, i) => (
            <Reveal key={p.name} delay={Math.min(i + 1, 3) as 1 | 2 | 3}>
              <div className={`plan ${p.featured ? 'plan--feat' : ''}`}>
                {p.featured && <span className="plan__badge">Most popular</span>}
                <p className="plan__name">{p.name}</p>
                <div className="plan__price-row">
                  <span className="plan__price">{p.price}</span>
                  <span className="plan__mo">{p.mo}</span>
                </div>
                <hr className="plan__rule" />
                <ul className="plan__list">
                  {p.items.map((it) => (
                    <li key={it}>
                      <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                        <path d="M2 7l3.5 3.5L12 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {it}
                    </li>
                  ))}
                </ul>
                <a href="https://app.ourcommune.io/signup" className={`plan__cta ${p.featured ? 'plan__cta--feat' : ''}`}>
                  Start 7-day trial
                </a>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════════════════════════ */
function Footer() {
  return (
    <footer className="footer">
      <div className="footer__top">
        <div className="footer__connected">
          <h3>STAY CONNECTED</h3>
          <p>Get updates on new features and spaces.</p>
          <form className="footer__form" onSubmit={(e) => e.preventDefault()}>
            <input type="email" placeholder="Your email address" />
            <button type="submit">Subscribe</button>
          </form>
        </div>
        <div className="footer__links">
          {[
            { title: 'Product', links: [['Features', '#why'], ['Use cases', '#usecases'], ['Pricing', '#pricing'], ['Sign in', 'https://app.ourcommune.io']] },
            { title: 'Company', links: [['About', '#'], ['Blog', '#'], ['Careers', '#'], ['Contact', 'mailto:support@ourcommune.io']] },
            { title: 'Legal', links: [['Privacy', '#'], ['Terms', '#'], ['Cookies', '#']] },
          ].map((col) => (
            <div key={col.title} className="footer__col">
              <h4>{col.title}</h4>
              <ul>{col.links.map(([l, h]) => <li key={l}><a href={h}>{l}</a></li>)}</ul>
            </div>
          ))}
        </div>
      </div>
      <div className="footer__bar">
        <div className="footer__logo">
          <img src="/logo.png" alt="Commune" width={22} height={22} />
          <span>Commune</span>
        </div>
        <p className="footer__copy">© {new Date().getFullYear()} Commune. All rights reserved.</p>
        <div className="footer__socials">
          <a href="#">Twitter</a>
          <a href="#">Instagram</a>
          <a href="#">LinkedIn</a>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════ */
export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Statement />
        <Why />
        <UseCases />
        <PhotoCta />
        <Pricing />
      </main>
      <Footer />
    </>
  );
}
