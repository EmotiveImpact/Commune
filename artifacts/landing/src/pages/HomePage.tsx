import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/* ─── ANIMATION HELPERS ─── */
function FadeUp({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

function StaggerGrid({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
    >
      {children}
    </motion.div>
  );
}

function StaggerItem({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      variants={{
        hidden:  { opacity: 0, y: 28 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
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
    <motion.header
      className={`hdr ${solid ? 'hdr--solid' : ''}`}
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="hdr__inner">
        <a href="#" className="hdr__logo">
          <img src="/logo.png" alt="Commune" />
          <span>COMMUNE</span>
        </a>
        <nav className="hdr__nav">
          <a href="#why">Why Commune</a>
          <a href="#usecases">Use cases</a>
          <a href="#pricing">Pricing</a>
          <a href="https://app.ourcommune.io">Sign in</a>
        </nav>
        <div className="hdr__actions">
          <a href="https://app.ourcommune.io/signup" className="hdr__cta">Get started</a>
        </div>
      </div>
    </motion.header>
  );
}

/* ═══════════════════════════════════════════════════════════
   HERO SLIDESHOW
   ═══════════════════════════════════════════════════════════ */
const SLIDES = [
  {
    id: 'home',
    label: 'House shares',
    img: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1920&q=85&auto=format&fit=crop',
    pan: 'tl',
    h: 'Your home,\nrun smoothly.',
    sub: 'Split rent, track bills, keep everyone on the same page.',
  },
  {
    id: 'couple',
    label: 'Couples',
    img: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=1920&q=85&auto=format&fit=crop',
    pan: 'tr',
    h: 'Money, together.\nNo awkwardness.',
    sub: 'Share expenses, set budgets, and settle up fairly.',
  },
  {
    id: 'workspace',
    label: 'Studios & workspaces',
    img: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&q=85&auto=format&fit=crop',
    pan: 'bl',
    h: 'Your workspace,\none hub.',
    sub: 'Shared costs, pooled tools, and clear ownership.',
  },
  {
    id: 'trip',
    label: 'Group trips',
    img: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1920&q=85&auto=format&fit=crop',
    pan: 'br',
    h: 'Every trip,\nfully settled.',
    sub: 'Log on the go, split instantly, settle before you land.',
  },
  {
    id: 'project',
    label: 'Creative projects',
    img: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1920&q=85&auto=format&fit=crop',
    pan: 'c',
    h: "Projects that\ndon't fall apart.",
    sub: 'Budget visibility and shared ownership, from start to finish.',
  },
];

const AVATARS = [
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&h=80&q=80&auto=format&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&q=80&auto=format&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&q=80&auto=format&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&q=80&auto=format&fit=crop&crop=face',
];

const SLIDE_MS = 3500;

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

  return (
    <section className="hero" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {/* Background slides */}
      {SLIDES.map((sl, i) => (
        <div key={sl.id} className={`hero__slide ${i === cur ? 'is-active' : ''} ${i === prev ? 'is-exit' : ''}`}>
          <img
            src={sl.img}
            alt={sl.label}
            className="hero__img"
            data-pan={sl.pan}
            loading={i === 0 ? 'eager' : 'lazy'}
          />
        </div>
      ))}
      <div className="hero__overlay" />

      {/* Content */}
      <div className="hero__body">
        <div className="hero__txt-wrap">
          <AnimatePresence mode="wait">
            <motion.div
              key={cur}
              initial={{ opacity: 0, y: 40, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -24, filter: 'blur(4px)' }}
              transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            >
              <h1 className="hero__h1">
                {SLIDES[cur]!.h.split('\n').map((l, j) => <span key={j}>{l}<br /></span>)}
              </h1>
              <p className="hero__sub">{SLIDES[cur]!.sub}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        <motion.div
          className="hero__foot"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="hero__proof">
            <div className="hero__avs">
              {AVATARS.map((src, i) => (
                <motion.img
                  key={i}
                  src={src}
                  alt=""
                  className="hero__av"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.06, duration: 0.5 }}
                />
              ))}
            </div>
            <span className="hero__proof-txt"><strong>2,400+</strong> groups doing life together</span>
          </div>
          <motion.a
            href="https://app.ourcommune.io/signup"
            className="btn-hero"
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            Start for free →
          </motion.a>
        </motion.div>
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
   STATEMENT — full-width cinematic
   ═══════════════════════════════════════════════════════════ */
function Statement() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });
  return (
    <section className="stmt" ref={ref}>
      <div className="stmt__bg">
        <img
          src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1800&q=85&auto=format&fit=crop"
          alt="People sharing life together"
        />
      </div>
      <div className="stmt__overlay" />
      <div className="stmt__body">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.9, ease: EASE }}
        >
          <p className="eyebrow stmt__eyebrow">About Commune</p>
          <h2 className="stmt__h2">
            Simplifying shared<br />life, together.
          </h2>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.18, ease: EASE }}
        >
          <p className="stmt__sub">
            Whether you share a home, run a studio, travel in groups, or manage a
            creative project — Commune gives you one clear place for every cost,
            every responsibility, and every person involved.
          </p>
          <a href="#usecases" className="btn-outline-white">Explore use cases →</a>
        </motion.div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   STEPS
   ═══════════════════════════════════════════════════════════ */
const STEPS = [
  { n: '01', t: 'Create your space',       d: 'Name it, describe it, pick a type. Up and running in 60 seconds.' },
  { n: '02', t: 'Invite your people',      d: 'Share a link — members join instantly, no app download required.' },
  { n: '03', t: 'Add your costs & bills',  d: 'Connect recurring bills, one-off expenses, and shared subscriptions.' },
  { n: '04', t: 'Assign responsibilities', d: 'Set who owns what, add reminders, and track every task to completion.' },
  { n: '05', t: 'Stay in the loop',        d: 'Everyone sees the same live picture — balances, tasks, and updates.' },
];

function Steps() {
  return (
    <section className="steps">
      <div className="steps__inner">
        <FadeUp className="steps__left">
          <p className="eyebrow">How it works</p>
          <h2 className="steps__h2">Up and running<br />in minutes.</h2>
          <p className="steps__lead">
            No spreadsheets. No group chats. Just one place for everyone who shares your life.
          </p>
          <a href="https://app.ourcommune.io/signup" className="btn-dark">Start for free →</a>
        </FadeUp>

        <StaggerGrid className="steps__list">
          {STEPS.map((s) => (
            <StaggerItem key={s.n}>
              <div className="step">
                <span className="step__n">{s.n}</span>
                <div className="step__body">
                  <h3 className="step__t">{s.t}</h3>
                  <p className="step__d">{s.d}</p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerGrid>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   STATS
   ═══════════════════════════════════════════════════════════ */
const STATS = [
  { n: '2,400+', l: 'Active groups' },
  { n: '£4.2M',  l: 'Tracked & split' },
  { n: '5',      l: 'Shared-life use cases' },
  { n: '7 days', l: 'Free to try' },
];

function Stats() {
  return (
    <section className="stats">
      <div className="stats__inner">
        {STATS.map((s, i) => (
          <FadeUp key={s.l} delay={i * 0.08}>
            <div className="stats__item">
              <span className="stats__n">{s.n}</span>
              <span className="stats__l">{s.l}</span>
            </div>
          </FadeUp>
        ))}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   WHY COMMUNE — BENTO GRID
   ═══════════════════════════════════════════════════════════ */
const FEATURES = [
  {
    id: 'finance',
    tag: 'Finance',
    title: 'Communal finance that actually works',
    desc: 'Track recurring bills, split costs fairly, automate reimbursements, and maintain one financial truth across every member.',
    img: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800&q=80&auto=format&fit=crop',
  },
  {
    id: 'spaces',
    tag: 'Spaces',
    title: 'Space hubs with full context',
    desc: 'Every space gets its own hub — members, roles, pinned notices, essentials, and shared identity in one place.',
    img: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1200&q=80&auto=format&fit=crop',
  },
  {
    id: 'ownership',
    tag: 'Ownership',
    title: 'Clear responsibilities & ownership',
    desc: 'Assign tasks, track who owns what, set reminders, and know what needs attention before it becomes a problem.',
    img: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=1200&q=80&auto=format&fit=crop',
  },
  {
    id: 'command',
    tag: 'Command',
    title: 'One centre, many spaces',
    desc: 'Switch between a home, studio, and trip in seconds. See what is owed across all your spaces at once.',
    img: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&q=80&auto=format&fit=crop',
  },
];

function Why() {
  return (
    <section id="why" className="why">
      <div className="why__inner">
        <FadeUp className="why__head">
          <p className="eyebrow why__eyebrow">Why Commune</p>
          <h2 className="why__big">Built for<br />shared life.</h2>
          <p className="why__lead">Everything a group needs — finance, spaces, and responsibilities — in one clear place.</p>
        </FadeUp>

        <StaggerGrid className="why__bento">
          {FEATURES.map((f) => (
            <StaggerItem key={f.id}>
              <motion.div
                className="why__card"
                whileHover={{ y: -5 }}
                transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              >
                <div className="why__card-img">
                  <img src={f.img} alt={f.title} loading="lazy" />
                </div>
                <div className="why__card-copy">
                  <span className="why__card-tag">{f.tag}</span>
                  <h3 className="why__card-title">{f.title}</h3>
                  <p className="why__card-desc">{f.desc}</p>
                </div>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerGrid>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   USE CASES
   ═══════════════════════════════════════════════════════════ */
const CASES = [
  { id: 'home',      label: 'House shares',     sub: 'Rent · Bills · Chores',           img: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=700&q=80&auto=format&fit=crop' },
  { id: 'couple',    label: 'Couples',           sub: 'Budgets · Joint expenses',        img: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=700&q=80&auto=format&fit=crop' },
  { id: 'workspace', label: 'Studios & offices', sub: 'Shared costs · Tools · Roles',   img: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=700&q=80&auto=format&fit=crop' },
  { id: 'trip',      label: 'Group trips',       sub: 'Expenses on the go · Settle up', img: 'https://images.unsplash.com/photo-1527631746610-bca00a040d60?w=700&q=80&auto=format&fit=crop' },
  { id: 'project',   label: 'Creative projects', sub: 'Budget · Ownership · Handover',  img: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=700&q=80&auto=format&fit=crop' },
];

function UseCases() {
  return (
    <section id="usecases" className="cases">
      <div className="cases__inner">
        <FadeUp className="cases__hdr">
          <p className="eyebrow">Use cases</p>
          <h2 className="cases__h2">Built for every way<br />people share space</h2>
        </FadeUp>
        <StaggerGrid className="cases__grid">
          {CASES.map((c) => (
            <StaggerItem key={c.id}>
              <motion.div
                className="case-card"
                whileHover={{ y: -6, transition: { type: 'spring', stiffness: 300, damping: 22 } }}
              >
                <div className="case-card__img">
                  <img src={c.img} alt={c.label} />
                </div>
                <div className="case-card__copy">
                  <p className="case-card__label">{c.label}</p>
                  <p className="case-card__sub">{c.sub}</p>
                </div>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerGrid>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   PHOTO CTA
   ═══════════════════════════════════════════════════════════ */
function PhotoCta() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });
  return (
    <section className="photo-cta" ref={ref}>
      <img
        src="https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1920&q=85&auto=format&fit=crop"
        alt="Modern shared living"
        className="photo-cta__img"
      />
      <div className="photo-cta__overlay" />
      <div className="photo-cta__body">
        <motion.h2
          className="photo-cta__h2"
          initial={{ opacity: 0, y: 48 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          Live Clearly,<br />Together.
        </motion.h2>
        <motion.a
          href="https://app.ourcommune.io/signup"
          className="btn-outline-white"
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ scale: 1.04, backgroundColor: 'rgba(255,255,255,1)', color: '#0a0a0a' }}
          whileTap={{ scale: 0.97 }}
        >
          Start your space →
        </motion.a>
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
        <FadeUp className="pricing__hdr">
          <p className="eyebrow">Membership</p>
          <h2 className="pricing__h2">Simple,<br />transparent pricing.</h2>
          <p className="pricing__sub">7-day free trial on your first space. No card required.</p>
        </FadeUp>
        <StaggerGrid className="pricing__grid">
          {PLANS.map((p) => (
            <StaggerItem key={p.name}>
              <motion.div
                className={`plan ${p.featured ? 'plan--feat' : ''}`}
                whileHover={{ y: p.featured ? -6 : -4, transition: { type: 'spring', stiffness: 300, damping: 22 } }}
              >
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
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerGrid>
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
            { title: 'Legal',   links: [['Privacy', '#'], ['Terms', '#'], ['Cookies', '#']] },
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
          <span>COMMUNE</span>
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
        <Stats />
        <Why />
        <UseCases />
        <Steps />
        <PhotoCta />
        <Pricing />
      </main>
      <Footer />
    </>
  );
}
