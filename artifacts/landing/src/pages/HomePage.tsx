import { useState, useEffect, useRef } from 'react';

/* ═══════════════════════════════════════════════════════════
   INTERSECTION OBSERVER HOOK
   ═══════════════════════════════════════════════════════════ */

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('visible');
          observer.unobserve(el);
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}

function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useReveal();
  return (
    <div
      ref={ref}
      className={`reveal ${delay ? `reveal-delay-${delay}` : ''} ${className}`}
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   HEADER
   ═══════════════════════════════════════════════════════════ */

function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn, { passive: true });
    fn();
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <header className={`site-header ${scrolled ? 'scrolled' : ''}`}>
      <div className="header-inner">
        <a href="#" className="header-logo">
          <img src="/logo.png" alt="Commune" width={32} height={32} />
          <span>Commune</span>
        </a>

        <nav className="header-nav">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#pricing">Pricing</a>
        </nav>

        <div className="header-actions">
          <a href="https://app.ourcommune.io" className="btn-ghost">
            Sign in
          </a>
          <a href="https://app.ourcommune.io/signup" className="btn-primary">
            Get started
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      </div>
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════
   HERO
   ═══════════════════════════════════════════════════════════ */

function Hero() {
  return (
    <section className="hero">
      <div className="hero-content">
        <div className="hero-text">
          <Reveal>
            <div className="hero-badge">
              <span className="hero-badge-dot" />
              For shared spaces and recurring groups
            </div>
          </Reveal>

          <Reveal delay={1}>
            <h1>
              Shared spaces,
              <br />
              run with <em>clarity</em>
            </h1>
          </Reveal>

          <Reveal delay={2}>
            <p className="hero-subtitle">
              Commune combines communal finance, responsibilities, group
              context, and clear priorities so homes, studios, workspaces,
              projects, and trips can run from one hub.
            </p>
          </Reveal>

          <Reveal delay={3}>
            <div className="hero-ctas">
              <a href="https://app.ourcommune.io/signup" className="btn-primary btn-primary-lg">
                Start free trial
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
              <a href="#features" className="btn-outline">
                See how it works
              </a>
            </div>
          </Reveal>

          <Reveal delay={4}>
            <div className="hero-social-proof">
              <div className="hero-avatars">
                {['PM', 'AK', 'JL', 'SR'].map((initials) => (
                  <div key={initials} className="hero-avatar">{initials}</div>
                ))}
              </div>
              <p className="hero-social-text">
                <strong>2,400+ groups</strong> managing shared spaces together
              </p>
            </div>
          </Reveal>
        </div>
      </div>

      <Reveal delay={2}>
        <div className="hero-visual">
          <div className="hero-visual-inner">
            <img
              src="/light-dash.png"
              alt="Commune dashboard showing expense tracking"
              style={{ objectFit: 'cover', width: '100%', height: '100%' }}
            />
          </div>
          <div className="hero-visual-float hero-float-left">
            <img
              src="/hero-phone.png"
              alt="Commune mobile app"
              style={{ objectFit: 'cover', width: '100%', height: '100%' }}
            />
          </div>
          <div className="hero-visual-float hero-float-right">
            <img
              src="/ui-cards.png"
              alt="Expense split cards"
              style={{ objectFit: 'cover', width: '100%', height: '100%' }}
            />
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   FEATURES
   ═══════════════════════════════════════════════════════════ */

const features = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    title: 'Flexible communal finance',
    desc: 'Track recurring bills, split fairly, reimburse cleanly, and keep one financial truth across the whole group.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 10h18" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 14h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    title: 'Space hubs',
    desc: 'Give every space its own hub with members, roles, pinned notices, essentials, and group identity.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    title: 'Responsibilities & roles',
    desc: 'Track who owns what, what needs doing, and which approvals or follow-ups are blocking the group.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M18 20V10M12 20V4M6 20v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    title: 'Command centre',
    desc: 'See what is owed, what is overdue, and what needs attention across one or many spaces from a single overview.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M22 17H2a3 3 0 003 3h14a3 3 0 003-3zM6 17V3a1 1 0 011-1h10a1 1 0 011 1v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 7h4M10 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    title: 'Multi-space by design',
    desc: 'One account can run a house, studio, workspace, trip, or project, each with its own rules and context.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Trust & controls',
    desc: 'Use approvals, member roles, payment methods, and audit-friendly history to keep shared admin dependable.',
  },
];

function Features() {
  return (
    <section id="features" className="section">
      <div className="section-inner">
        <Reveal>
          <p className="section-label">Features</p>
          <h2 className="section-title">
            Everything you need to<br />run a shared space
          </h2>
          <p className="section-subtitle">
            Built for the way recurring groups actually operate. No spreadsheets,
            no scattered admin, no guesswork about what is owed or what is due.
          </p>
        </Reveal>

        <div className="features-grid">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={Math.min(i + 1, 5) as 1 | 2 | 3 | 4 | 5}>
              <div className="feature-card">
                <div className="feature-icon">{f.icon}</div>
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
  {
    number: '01',
    title: 'Create your space',
    desc: 'Set up a home, studio, workspace, project, or trip in seconds. Invite members by email or link.',
  },
  {
    number: '02',
    title: 'Set the rules and context',
    desc: 'Add expenses, assign responsibilities, save key details, and define how the group should run.',
  },
  {
    number: '03',
    title: 'Run the group',
    desc: 'See what is owed, what is due, and what needs attention from one clear operational hub.',
  },
];

function HowItWorks() {
  return (
    <section id="how" className="section how-section">
      <div className="section-inner">
        <Reveal>
          <p className="section-label">How it works</p>
          <h2 className="section-title">Three steps to clarity</h2>
          <p className="section-subtitle">
            From first download to settled balances in under two minutes.
          </p>
        </Reveal>

        <div className="how-grid">
          {steps.map((s, i) => (
            <Reveal key={s.number} delay={Math.min(i + 1, 3) as 1 | 2 | 3}>
              <div className="how-step">
                <div className="how-step-number">{s.number}</div>
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
    <section className="section showcase">
      <div className="section-inner">
        <div className="showcase-grid">
          <Reveal>
            <div className="showcase-image">
              <img
                src="/light-app.png"
                alt="Commune app interface showing expense management"
                style={{ objectFit: 'cover', width: '100%', height: '100%' }}
              />
            </div>
          </Reveal>

          <div className="showcase-text">
            <Reveal>
              <p className="section-label">Built for shared spaces</p>
              <h2 className="section-title">
                Designed for homes, studios, workspaces, and recurring groups
              </h2>
              <p className="section-subtitle">
                Bills, responsibilities, member context, notices, and priorities
                all live in one place. No more screenshots of transfers,
                spreadsheets nobody updates, or key details buried in chat.
              </p>
            </Reveal>

            <Reveal delay={1}>
              <div className="showcase-stats">
                <div>
                  <p className="stat-value">&infin;</p>
                  <p className="stat-label">Groups per account</p>
                </div>
                <div>
                  <p className="stat-value">2m</p>
                  <p className="stat-label">Average setup time</p>
                </div>
                <div>
                  <p className="stat-value">&pound;4.2M</p>
                  <p className="stat-label">Expenses tracked</p>
                </div>
                <div>
                  <p className="stat-value">4.9</p>
                  <p className="stat-label">Average rating</p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   TESTIMONIAL
   ═══════════════════════════════════════════════════════════ */

function Testimonial() {
  return (
    <section className="section testimonial-section">
      <div className="section-inner">
        <Reveal>
          <blockquote className="testimonial-quote">
            &ldquo;Commune gave our collective one place for money, roles, and the
            small operational stuff that usually gets lost in chat. It made the
            whole group calmer.&rdquo;
          </blockquote>
        </Reveal>
        <Reveal delay={1}>
          <div className="testimonial-author">
            <div className="testimonial-author-avatar">PM</div>
            <div className="testimonial-author-info">
              <p className="testimonial-author-name">Priya M.</p>
              <p className="testimonial-author-role">
                Creative collective, London
              </p>
            </div>
          </div>
        </Reveal>
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
    period: 'per month',
    features: [
      '1 space',
      'Up to 8 members',
      'Communal finance & splits',
      'Responsibilities & reminders',
      'Monthly breakdown',
      'Group hub',
    ],
    featured: false,
  },
  {
    name: 'Pro',
    price: '£9.99',
    period: 'per month',
    features: [
      'Up to 3 spaces',
      'Up to 15 members',
      'Everything in Standard',
      'Advanced analytics',
      'Exports and templates',
      'Priority email support',
    ],
    featured: true,
  },
  {
    name: 'Agency',
    price: '£29.99',
    period: 'per month',
    features: [
      'Unlimited spaces',
      'Unlimited members',
      'Everything in Pro',
      'Priority workflows',
      'Operator-ready growth path',
      'For larger operations',
    ],
    featured: false,
  },
];

function Pricing() {
  return (
    <section id="pricing" className="section">
      <div className="section-inner">
        <Reveal>
          <div className="pricing-header">
            <p className="section-label">Pricing</p>
            <h2 className="section-title">Simple, transparent pricing</h2>
            <p className="section-subtitle" style={{ margin: '0 auto' }}>
              Start with a 7-day free trial for your first shared space.
            </p>
          </div>
        </Reveal>

        <div className="pricing-grid">
          {plans.map((p, i) => (
            <Reveal key={p.name} delay={Math.min(i + 1, 3) as 1 | 2 | 3}>
              <div className={`plan-card${p.featured ? ' featured' : ''}`}>
                {p.featured && <span className="plan-popular">Most popular</span>}
                <p className="plan-name">{p.name}</p>
                <p className="plan-price">{p.price}</p>
                <p className="plan-period">{p.period}</p>
                <div className="plan-divider" />
                <ul className="plan-features">
                  {p.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <a
                  href="https://app.ourcommune.io/signup"
                  className="plan-cta"
                >
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
    <section className="cta-banner">
      <Reveal>
        <h2>Ready to run your shared space more clearly?</h2>
        <p>
          Join thousands of groups who replaced scattered admin with one place
          for money, responsibilities, and what needs attention.
        </p>
        <a href="https://app.ourcommune.io/signup" className="btn-white">
          Get started free
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </Reveal>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════════════════════════ */

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div>
          <div className="footer-brand-name">
            <img src="/logo.png" alt="Commune" width={28} height={28} />
            Commune
          </div>
          <p className="footer-tagline">
            For people who share space, money, and responsibility. Run homes,
            studios, workspaces, trips, and recurring groups from one hub.
          </p>
        </div>

        {[
          {
            title: 'Product',
            links: [
              ['Features', '#features'],
              ['How it works', '#how'],
              ['Pricing', '#pricing'],
              ['Sign in', 'https://app.ourcommune.io'],
            ],
          },
          {
            title: 'Company',
            links: [
              ['About', '#'],
              ['Blog', '#'],
              ['Careers', '#'],
              ['Contact', 'mailto:support@ourcommune.io'],
            ],
          },
          {
            title: 'Legal',
            links: [
              ['Privacy', '#'],
              ['Terms', '#'],
              ['Cookies', '#'],
            ],
          },
        ].map((col) => (
          <div key={col.title} className="footer-col">
            <h4>{col.title}</h4>
            <ul>
              {col.links.map(([label, href]) => (
                <li key={label}>
                  <a href={href}>{label}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="footer-bottom">
        <p className="footer-copy">
          &copy; {new Date().getFullYear()} Commune. All rights reserved.
        </p>
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
        <Hero />
        <Features />
        <HowItWorks />
        <Showcase />
        <Testimonial />
        <Pricing />
        <CtaBanner />
      </main>
      <Footer />
    </>
  );
}
