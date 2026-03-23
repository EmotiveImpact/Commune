'use client';

import Image from 'next/image';
import { useState, useEffect, useRef, useCallback } from 'react';

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
          <Image src="/logo.png" alt="Commune" width={32} height={32} />
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
              For people who do life, together
            </div>
          </Reveal>

          <Reveal delay={1}>
            <h1>
              Shared money,
              <br />
              without the <em>friction</em>
            </h1>
          </Reveal>

          <Reveal delay={2}>
            <p className="hero-subtitle">
              Track every bill. Split fairly. Settle up instantly. Commune keeps
              shared finances clear so you can focus on what matters.
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
                <strong>2,400+ households</strong> managing money together
              </p>
            </div>
          </Reveal>
        </div>
      </div>

      <Reveal delay={2}>
        <div className="hero-visual">
          <div className="hero-visual-inner">
            <Image
              src="/light-dash.png"
              alt="Commune dashboard showing expense tracking"
              fill
              priority
              style={{ objectFit: 'cover' }}
            />
          </div>
          <div className="hero-visual-float hero-float-left">
            <Image
              src="/hero-phone.png"
              alt="Commune mobile app"
              fill
              style={{ objectFit: 'cover' }}
            />
          </div>
          <div className="hero-visual-float hero-float-right">
            <Image
              src="/ui-cards.png"
              alt="Expense split cards"
              fill
              style={{ objectFit: 'cover' }}
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
    title: 'Smart splitting',
    desc: 'Split equally, by percentage, by shares, or by exact amounts. Commune handles the maths so you never have to.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 10h18" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 14h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    title: 'Payment tracking',
    desc: 'See who paid what in real time. Mark payments as settled and keep a full history of every transaction.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    title: 'Multi-group',
    desc: 'One account, many groups. Manage flat expenses, trip costs, and family budgets — each with their own space.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M18 20V10M12 20V4M6 20v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    title: 'Analytics',
    desc: 'Monthly breakdowns show where money goes. Spot trends, track budgets, and understand spending patterns.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M22 17H2a3 3 0 003 3h14a3 3 0 003-3zM6 17V3a1 1 0 011-1h10a1 1 0 011 1v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 7h4M10 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    title: 'Smart reminders',
    desc: 'Gentle nudges when payments are due. No more awkward chasing — Commune does it for you.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Bank-level security',
    desc: 'Your data is encrypted end-to-end. We never store payment credentials or touch your bank accounts directly.',
  },
];

function Features() {
  return (
    <section id="features" className="section">
      <div className="section-inner">
        <Reveal>
          <p className="section-label">Features</p>
          <h2 className="section-title">
            Everything you need to<br />manage shared money
          </h2>
          <p className="section-subtitle">
            Built for the way people actually live. No spreadsheets, no group
            chat maths, no arguments.
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
    title: 'Create your group',
    desc: 'Set up a group in seconds. Invite housemates, friends, or family by email or link.',
  },
  {
    number: '02',
    title: 'Log expenses',
    desc: 'Add bills as they come. Snap a photo, enter the amount, and choose who\'s involved.',
  },
  {
    number: '03',
    title: 'Settle up',
    desc: 'Commune calculates who owes whom. Settle with a tap and keep your books clear.',
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
              <Image
                src="/light-app.png"
                alt="Commune app interface showing expense management"
                fill
                style={{ objectFit: 'cover' }}
              />
            </div>
          </Reveal>

          <div className="showcase-text">
            <Reveal>
              <p className="section-label">Built for shared living</p>
              <h2 className="section-title">
                Designed around the way households actually work
              </h2>
              <p className="section-subtitle">
                Rent, groceries, utilities, subscriptions — everything in one
                place. No more screenshots of bank transfers or spreadsheets
                that nobody updates.
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
            &ldquo;Commune removed every awkward conversation about money in our
            flat. We set up expenses once and the app handles
            everything&nbsp;else.&rdquo;
          </blockquote>
        </Reveal>
        <Reveal delay={1}>
          <div className="testimonial-author">
            <div className="testimonial-author-avatar">PM</div>
            <div className="testimonial-author-info">
              <p className="testimonial-author-name">Priya M.</p>
              <p className="testimonial-author-role">
                4-person household, London
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
      '1 group',
      'Up to 8 members',
      'Expense tracking & splitting',
      'Payment tracking',
      'Monthly breakdown',
    ],
    featured: false,
  },
  {
    name: 'Pro',
    price: '£9.99',
    period: 'per month',
    features: [
      'Up to 3 groups',
      'Up to 15 members',
      'Everything in Standard',
      'Advanced analytics',
      'Export support',
      'Priority email support',
    ],
    featured: true,
  },
  {
    name: 'Pro Max',
    price: '£99.99',
    period: 'per month',
    features: [
      'Unlimited groups',
      'Unlimited members',
      'Everything in Pro',
      'Dedicated support',
      'Custom integrations',
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
              Start with a 7-day free trial. No credit card required.
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
        <h2>Ready to simplify shared&nbsp;money?</h2>
        <p>
          Join thousands of households who stopped arguing about bills and
          started living better, together.
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
            <Image src="/logo.png" alt="Commune" width={28} height={28} />
            Commune
          </div>
          <p className="footer-tagline">
            For people who do life, together. Track group spending, split costs
            fairly, and keep shared money clear.
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
