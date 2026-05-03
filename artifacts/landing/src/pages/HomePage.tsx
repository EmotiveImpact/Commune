import { useState, useEffect, useRef, useCallback } from 'react';

/* ═══════════════════════════════════════════════════════════
   REVEAL
   ═══════════════════════════════════════════════════════════ */

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('visible'); observer.unobserve(el); } },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useReveal();
  return <div ref={ref} className={`reveal ${delay ? `reveal-delay-${delay}` : ''} ${className}`}>{children}</div>;
}

/* ═══════════════════════════════════════════════════════════
   HEADER
   ═══════════════════════════════════════════════════════════ */

function Header() {
  return (
    <header className="site-header">
      <div className="header-inner">
        <a href="#" className="header-logo">
          <img src="/logo.png" alt="Commune" width={30} height={30} />
          <span>Commune</span>
        </a>

        <nav className="header-nav">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#pricing">Pricing</a>
        </nav>

        <div className="header-actions">
          <a href="https://app.ourcommune.io" className="header-signin">Sign in</a>
          <a href="https://app.ourcommune.io/signup" className="header-cta">
            Get started
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      </div>
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════
   HERO SLIDESHOW
   ═══════════════════════════════════════════════════════════ */

const slides = [
  {
    id: 'home',
    label: 'House shares',
    index: '01',
    image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1920&q=90&auto=format&fit=crop',
    headline: 'Your home,\nrun smoothly.',
    sub: 'Split rent, track bills, keep everyone on the same page.',
  },
  {
    id: 'couple',
    label: 'Couples',
    index: '02',
    image: 'https://images.unsplash.com/photo-1576502200916-3808e07386a5?w=1920&q=90&auto=format&fit=crop',
    headline: 'Money together,\nno awkwardness.',
    sub: 'Share expenses, set budgets, and settle up fairly.',
  },
  {
    id: 'workspace',
    label: 'Studios & workspaces',
    index: '03',
    image: 'https://images.unsplash.com/photo-1497366858526-0766f6d2769a?w=1920&q=90&auto=format&fit=crop',
    headline: 'Your workspace,\none hub.',
    sub: 'Shared costs, pooled subscriptions, and who owns what.',
  },
  {
    id: 'trip',
    label: 'Group trips',
    index: '04',
    image: 'https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=1920&q=90&auto=format&fit=crop',
    headline: 'Every trip,\nfully settled.',
    sub: 'Log on the go, split instantly, settle before you land.',
  },
  {
    id: 'project',
    label: 'Creative projects',
    index: '05',
    image: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1920&q=90&auto=format&fit=crop',
    headline: 'Projects that\ndon\'t fall apart.',
    sub: 'Budget visibility, task ownership, nothing lost between sessions.',
  },
];

const AVATARS = [
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&h=80&q=80&auto=format&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&q=80&auto=format&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&q=80&auto=format&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&q=80&auto=format&fit=crop&crop=face',
];

const SLIDE_MS = 5500;

function HeroSlideshow() {
  const [current, setCurrent] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const startRef = useRef(Date.now());

  const goTo = useCallback((idx: number) => {
    setPrev(current);
    setCurrent(idx);
    setProgress(0);
    startRef.current = Date.now();
  }, [current]);

  const next = useCallback(() => goTo((current + 1) % slides.length), [current, goTo]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(next, SLIDE_MS);
    return () => clearInterval(id);
  }, [paused, next]);

  useEffect(() => {
    setProgress(0);
    startRef.current = Date.now();
    if (paused) return;
    const id = setInterval(() => {
      setProgress(Math.min(((Date.now() - startRef.current) / SLIDE_MS) * 100, 100));
    }, 40);
    return () => clearInterval(id);
  }, [current, paused]);

  const s = slides[current]!;

  return (
    <section
      className="hero"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Slides */}
      {slides.map((slide, i) => (
        <div key={slide.id} className={`hero-slide ${i === current ? 'active' : ''} ${i === prev ? 'exit' : ''}`}>
          <img src={slide.image} alt={slide.label} className="hero-img" loading={i === 0 ? 'eager' : 'lazy'} />
        </div>
      ))}

      {/* Overlay */}
      <div className="hero-overlay" />

      {/* Content */}
      <div className="hero-body">
        <div className="hero-meta">
          <span className="hero-index">{s.index} / 0{slides.length}</span>
          <span className="hero-divider" />
          <span className="hero-label">{s.label}</span>
        </div>

        <div className="hero-text">
          {slides.map((slide, i) => (
            <div key={slide.id} className={`hero-text-slide ${i === current ? 'in' : ''}`}>
              <h1 className="hero-h1">
                {slide.headline.split('\n').map((l, li) => <span key={li}>{l}<br /></span>)}
              </h1>
              <p className="hero-sub">{slide.sub}</p>
            </div>
          ))}
        </div>

        <div className="hero-bottom">
          <div className="hero-proof">
            <div className="hero-avatars">
              {AVATARS.map((src, i) => (
                <img key={i} src={src} alt="Member" className="hero-avatar" />
              ))}
            </div>
            <span className="hero-proof-text"><strong>2,400+</strong> groups doing life together</span>
          </div>

          <a href="https://app.ourcommune.io/signup" className="btn-hero">
            Start for free
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      </div>

      {/* Progress track */}
      <div className="hero-track">
        {slides.map((slide, i) => (
          <button
            key={slide.id}
            className={`hero-track-item ${i === current ? 'active' : ''}`}
            onClick={() => goTo(i)}
            aria-label={slide.label}
          >
            <span
              className="hero-track-fill"
              style={i === current ? { width: `${progress}%` } : i < current ? { width: '100%' } : { width: '0%' }}
            />
          </button>
        ))}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   FEATURES
   ═══════════════════════════════════════════════════════════ */

const features = [
  {
    icon: '⟳',
    title: 'Communal finance',
    desc: 'Track recurring bills, split fairly, reimburse cleanly, and keep one financial truth across the whole group.',
  },
  {
    icon: '◫',
    title: 'Space hubs',
    desc: 'Every space has its own hub — members, roles, pinned notices, essentials, and shared identity.',
  },
  {
    icon: '◎',
    title: 'Responsibilities & roles',
    desc: 'Track who owns what, what needs doing, and which approvals or follow-ups are blocking the group.',
  },
  {
    icon: '⌖',
    title: 'Command centre',
    desc: 'See what is owed, overdue, or needs attention across one or many spaces — from a single view.',
  },
  {
    icon: '⊞',
    title: 'Multi-space by design',
    desc: 'One account can run a house, studio, workspace, trip, or project — each with its own rules.',
  },
  {
    icon: '◈',
    title: 'Trust & controls',
    desc: 'Approvals, member roles, payment methods, and audit-friendly history — shared admin, dependable.',
  },
];

function Features() {
  return (
    <section id="features" className="section features-section">
      <div className="section-inner">
        <Reveal className="section-header">
          <p className="eyebrow">Features</p>
          <h2 className="section-h2">Everything to run a shared space</h2>
          <p className="section-body">Built for how groups actually operate — no spreadsheets, no scattered admin.</p>
        </Reveal>
        <div className="features-grid">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={Math.min(i + 1, 5) as 1 | 2 | 3 | 4 | 5}>
              <div className="feature-card">
                <div className="feature-glyph">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   HOW IT WORKS
   ═══════════════════════════════════════════════════════════ */

const steps = [
  { n: '01', title: 'Create your space', desc: 'Set up a home, studio, workspace, project, or trip in seconds. Invite by email or link.' },
  { n: '02', title: 'Set rules & context', desc: 'Add expenses, assign responsibilities, save key details, and define how the group runs.' },
  { n: '03', title: 'Run the group', desc: 'See what is owed, what is due, and what needs attention — from one clear hub.' },
];

function HowItWorks() {
  return (
    <section id="how" className="section dark-section">
      <div className="section-inner">
        <Reveal className="section-header">
          <p className="eyebrow eyebrow-light">How it works</p>
          <h2 className="section-h2 light">Three steps to clarity</h2>
          <p className="section-body light">From first sign-up to settled balances in under two minutes.</p>
        </Reveal>
        <div className="steps-grid">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={Math.min(i + 1, 3) as 1 | 2 | 3}>
              <div className="step-card">
                <p className="step-n">{s.n}</p>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   SHOWCASE
   ═══════════════════════════════════════════════════════════ */

function Showcase() {
  return (
    <section className="section showcase-section">
      <div className="section-inner">
        <div className="showcase-grid">
          <Reveal>
            <div className="showcase-img-wrap">
              <img src="/light-app.png" alt="Commune app" />
            </div>
          </Reveal>
          <div className="showcase-copy">
            <Reveal>
              <p className="eyebrow">Built for shared spaces</p>
              <h2 className="section-h2">One hub for homes, studios, workspaces & groups</h2>
              <p className="section-body">Bills, responsibilities, notices, and priorities all in one place. No more screenshots, group chats, or spreadsheets nobody keeps up.</p>
            </Reveal>
            <Reveal delay={1}>
              <div className="stats-row">
                <div className="stat"><p className="stat-val">∞</p><p className="stat-lbl">Groups per account</p></div>
                <div className="stat"><p className="stat-val">2m</p><p className="stat-lbl">Average setup time</p></div>
                <div className="stat"><p className="stat-val">£4.2M</p><p className="stat-lbl">Expenses tracked</p></div>
                <div className="stat"><p className="stat-val">4.9★</p><p className="stat-lbl">Average rating</p></div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   TESTIMONIALS
   ═══════════════════════════════════════════════════════════ */

const testimonials = [
  {
    quote: 'Commune gave our collective one place for money, roles, and the small stuff that usually gets lost in chat. The whole group got calmer.',
    name: 'Priya M.',
    role: 'Creative collective, London',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&h=80&q=80&auto=format&fit=crop&crop=face',
  },
  {
    quote: 'We used to have arguments about who paid what. Now we just open Commune. It takes ten seconds. No drama.',
    name: 'Marcus T.',
    role: 'House share, Manchester',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&q=80&auto=format&fit=crop&crop=face',
  },
  {
    quote: 'Running a shared studio across five freelancers was chaos until Commune. Now every cost, tool, and task has a home.',
    name: 'Aisha K.',
    role: 'Freelancer studio, Bristol',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&q=80&auto=format&fit=crop&crop=face',
  },
];

function Testimonials() {
  return (
    <section className="section testimonials-section">
      <div className="section-inner">
        <Reveal className="section-header">
          <p className="eyebrow">What people say</p>
          <h2 className="section-h2">People doing life, together</h2>
        </Reveal>
        <div className="testimonials-grid">
          {testimonials.map((t, i) => (
            <Reveal key={t.name} delay={Math.min(i + 1, 3) as 1 | 2 | 3}>
              <div className="t-card">
                <p className="t-quote">"{t.quote}"</p>
                <div className="t-author">
                  <img src={t.avatar} alt={t.name} className="t-avatar" />
                  <div>
                    <p className="t-name">{t.name}</p>
                    <p className="t-role">{t.role}</p>
                  </div>
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
   PRICING
   ═══════════════════════════════════════════════════════════ */

const plans = [
  {
    name: 'Standard',
    price: '£4.99',
    period: '/month',
    featured: false,
    features: ['1 space', 'Up to 8 members', 'Communal finance & splits', 'Responsibilities & reminders', 'Monthly breakdown', 'Group hub'],
  },
  {
    name: 'Pro',
    price: '£9.99',
    period: '/month',
    featured: true,
    features: ['Up to 3 spaces', 'Up to 15 members', 'Everything in Standard', 'Advanced analytics', 'Exports & templates', 'Priority support'],
  },
  {
    name: 'Agency',
    price: '£29.99',
    period: '/month',
    featured: false,
    features: ['Unlimited spaces', 'Unlimited members', 'Everything in Pro', 'Priority workflows', 'Operator-ready growth', 'Dedicated onboarding'],
  },
];

function Pricing() {
  return (
    <section id="pricing" className="section pricing-section">
      <div className="section-inner">
        <Reveal className="section-header pricing-header">
          <p className="eyebrow">Pricing</p>
          <h2 className="section-h2">Simple, transparent pricing</h2>
          <p className="section-body">7-day free trial on your first space. No card required.</p>
        </Reveal>
        <div className="pricing-grid">
          {plans.map((p, i) => (
            <Reveal key={p.name} delay={Math.min(i + 1, 3) as 1 | 2 | 3}>
              <div className={`plan ${p.featured ? 'plan-featured' : ''}`}>
                {p.featured && <span className="plan-badge">Most popular</span>}
                <p className="plan-name">{p.name}</p>
                <div className="plan-price-row">
                  <span className="plan-price">{p.price}</span>
                  <span className="plan-period">{p.period}</span>
                </div>
                <hr className="plan-rule" />
                <ul className="plan-list">
                  {p.features.map((f) => (
                    <li key={f}>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8l3.5 3.5L13 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <a href="https://app.ourcommune.io/signup" className={`plan-cta ${p.featured ? 'plan-cta-featured' : ''}`}>
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
   CTA BANNER
   ═══════════════════════════════════════════════════════════ */

function CtaBanner() {
  return (
    <section className="cta-band">
      <div className="cta-band-inner">
        <Reveal>
          <h2>For people who do life, together.</h2>
          <p>Join thousands of groups who replaced scattered admin with one clear, shared hub.</p>
          <a href="https://app.ourcommune.io/signup" className="btn-band">
            Get started free
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </Reveal>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════════════════════════ */

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <div className="footer-logo">
            <img src="/logo.png" alt="Commune" width={26} height={26} />
            <span>Commune</span>
          </div>
          <p>For people who share space, money, and responsibility.</p>
        </div>
        {[
          { title: 'Product', links: [['Features', '#features'], ['How it works', '#how'], ['Pricing', '#pricing'], ['Sign in', 'https://app.ourcommune.io']] },
          { title: 'Company', links: [['About', '#'], ['Blog', '#'], ['Careers', '#'], ['Contact', 'mailto:support@ourcommune.io']] },
          { title: 'Legal', links: [['Privacy', '#'], ['Terms', '#'], ['Cookies', '#']] },
        ].map((col) => (
          <div key={col.title} className="footer-col">
            <h4>{col.title}</h4>
            <ul>{col.links.map(([label, href]) => <li key={label}><a href={href}>{label}</a></li>)}</ul>
          </div>
        ))}
      </div>
      <div className="footer-bar">
        <p>© {new Date().getFullYear()} Commune. All rights reserved.</p>
        <div className="footer-socials">
          <a href="#">Twitter / X</a>
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
        <HeroSlideshow />
        <Features />
        <HowItWorks />
        <Showcase />
        <Testimonials />
        <Pricing />
        <CtaBanner />
      </main>
      <Footer />
    </>
  );
}
