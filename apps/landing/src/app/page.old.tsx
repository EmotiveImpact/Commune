'use client';

import Image from 'next/image';
import { useState, useEffect, useRef, useCallback } from 'react';

/* ═══════════════════════════════════════════════════════════
   SCROLL REVEAL TEXT  (exact from reference: technology-section)
   ═══════════════════════════════════════════════════════════ */

function ScrollRevealText({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handle = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const start = window.innerHeight * 0.9;
      const end = window.innerHeight * 0.1;
      const pos = start - rect.top;
      setProgress(Math.max(0, Math.min(1, pos / (start - end))));
    };
    window.addEventListener('scroll', handle, { passive: true });
    handle();
    return () => window.removeEventListener('scroll', handle);
  }, []);

  const words = text.split(' ');
  return (
    <p ref={ref} className="reveal-text">
      {words.map((w, i) => (
        <span key={i} className={progress > i / words.length ? 'word-lit' : 'word-dim'}>
          {w}{i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </p>
  );
}

/* ═══════════════════════════════════════════════════════════
   HEADER  (exact from reference: header.tsx)
   ═══════════════════════════════════════════════════════════ */

function Header() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <header className={scrolled ? 'scrolled' : ''}>
      <div className="header-inner">
        <a href="#" className="header-logo">
          <Image src="/logo.png" alt="Commune" width={28} height={28} />
          <span>Commune</span>
        </a>
        <nav className="header-nav">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#pricing">Pricing</a>
          <a href="#">About</a>
        </nav>
        <div className="nav-ctas">
          <a href="https://app.ourcommune.io" className="btn-nav-ghost">Sign in</a>
          <a href="https://app.ourcommune.io/register" className="btn-nav-primary">Get started</a>
        </div>
      </div>
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════
   HERO SECTION  (exact from reference: hero-section.tsx)
   Sticky bento scroll with COMMUNE text, side images animate in
   ═══════════════════════════════════════════════════════════ */

const heroWord = 'COMMUNE';

const heroSideImages = [
  { src: '/light-dash.png', alt: 'Dashboard analytics', position: 'left' },
  { src: '/light-app.png', alt: 'Expense splitting', position: 'left' },
  { src: '/hero-phone.png', alt: 'Smart reminders', position: 'right' },
  { src: '/ui-cards.png', alt: 'Split payments', position: 'right' },
];

function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handle = () => {
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      const scrollable = window.innerHeight * 0.75;
      const scrolled = -rect.top;
      setScrollProgress(Math.max(0, Math.min(1, scrolled / scrollable)));
    };
    window.addEventListener('scroll', handle, { passive: true });
    handle();
    return () => window.removeEventListener('scroll', handle);
  }, []);

  const textOpacity = Math.max(0, 1 - scrollProgress / 0.2);
  const ip = Math.max(0, Math.min(1, (scrollProgress - 0.2) / 0.8));
  const centerW = 100 - ip * 58;
  const centerH = 100 - ip * 30;
  const sideW = ip * 22;
  const sideOp = ip;
  const sideL = -100 + ip * 100;
  const sideR = 100 - ip * 100;
  const br = ip * 24;
  const gap = ip * 16;
  const sideY = -(ip * 15);

  return (
    <section ref={sectionRef} className="hero-section">
      <div className="hero-sticky">
        <div className="hero-sticky-inner">
          <div
            className="hero-bento"
            style={{ gap: `${gap}px`, padding: `${ip * 16}px`, paddingBottom: `${60 + ip * 40}px` }}
          >
            {/* Left column */}
            <div
              className="hero-side-col"
              style={{ width: `${sideW}%`, gap: `${gap}px`, transform: `translateX(${sideL}%) translateY(${sideY}%)`, opacity: sideOp }}
            >
              {heroSideImages.filter(i => i.position === 'left').map((img, idx) => (
                <div key={idx} className="hero-side-img" style={{ flex: 1, borderRadius: `${br}px` }}>
                  <Image src={img.src} alt={img.alt} fill style={{ objectFit: 'cover' }} />
                </div>
              ))}
            </div>

            {/* Center hero image */}
            <div
              className="hero-center"
              style={{ width: `${centerW}%`, height: `${centerH}%`, borderRadius: `${br}px` }}
            >
              <Image src="/light-life.png" alt="Housemates" fill className="hero-main-img" style={{ objectFit: 'cover' }} priority />
              <div className="hero-text-overlay" style={{ opacity: textOpacity }}>
                <h1 className="hero-word">
                  {heroWord.split('').map((letter, i) => (
                    <span key={i} style={{ animationDelay: `${i * 0.08}s` }}>{letter}</span>
                  ))}
                </h1>
              </div>
            </div>

            {/* Right column */}
            <div
              className="hero-side-col"
              style={{ width: `${sideW}%`, gap: `${gap}px`, transform: `translateX(${sideR}%) translateY(${sideY}%)`, opacity: sideOp }}
            >
              {heroSideImages.filter(i => i.position === 'right').map((img, idx) => (
                <div key={idx} className="hero-side-img" style={{ flex: 1, borderRadius: `${br}px` }}>
                  <Image src={img.src} alt={img.alt} fill style={{ objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="hero-scroll-space" />

      <div className="hero-tagline">
        <p>Shared money, without the friction.<br />Track every bill. Split fairly. Stay clear.</p>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   PHILOSOPHY SECTION (exact from reference: philosophy-section.tsx)
   Two images slide in from left/right as you scroll
   ═══════════════════════════════════════════════════════════ */

function PhilosophySection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [alpineX, setAlpineX] = useState(-100);
  const [forestX, setForestX] = useState(100);
  const [titleOp, setTitleOp] = useState(1);
  const rafRef = useRef<number | null>(null);

  const update = useCallback(() => {
    if (!sectionRef.current) return;
    const rect = sectionRef.current.getBoundingClientRect();
    const scrollable = sectionRef.current.offsetHeight - window.innerHeight;
    const scrolled = -rect.top;
    const p = Math.max(0, Math.min(1, scrolled / scrollable));
    setAlpineX((1 - p) * -100);
    setForestX((1 - p) * 100);
    setTitleOp(1 - p);
  }, []);

  useEffect(() => {
    const handle = () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); rafRef.current = requestAnimationFrame(update); };
    window.addEventListener('scroll', handle, { passive: true });
    update();
    return () => { window.removeEventListener('scroll', handle); if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [update]);

  return (
    <section id="how" className="philosophy-section">
      <div ref={sectionRef} className="philosophy-scroll-wrapper">
        <div className="philosophy-sticky">
          <div style={{ position: 'relative', width: '100%' }}>
            <div className="philosophy-title-bg" style={{ opacity: titleOp }}>
              <h2>Standard &amp; Pro.</h2>
            </div>
            <div className="philosophy-grid">
              <div
                className="philosophy-card"
                style={{ transform: `translate3d(${alpineX}%, 0, 0)`, backfaceVisibility: 'hidden' }}
              >
                <Image src="/receipt.png" alt="Commune Standard plan" fill style={{ objectFit: 'cover' }} />
                <span className="philosophy-label">Standard £4.99/mo</span>
              </div>
              <div
                className="philosophy-card"
                style={{ transform: `translate3d(${forestX}%, 0, 0)`, backfaceVisibility: 'hidden' }}
              >
                <Image src="/graphs.png" alt="Commune Pro plan" fill style={{ objectFit: 'cover' }} />
                <span className="philosophy-label">Pro £9.99/mo</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="philosophy-desc">
        <p className="philosophy-desc-label">Built for shared households</p>
        <p className="philosophy-desc-text">
          Standard &amp; Pro give you everything needed to track expenses, split bills, and manage
          shared finances. Lightweight setup, powerful insights, and zero arguments.
        </p>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   FEATURED PRODUCTS (exact from reference: featured-products-section.tsx)
   6-item grid with image + label + title
   ═══════════════════════════════════════════════════════════ */

const features = [
  { img: '/light-app.png', label: 'Splitting', title: 'Smart expense splitting' },
  { img: '/light-dash.png', label: 'Tracking', title: 'Real-time payment tracking' },
  { img: '/light-app.png', label: 'Analytics', title: 'Monthly spending breakdown' },
  { img: '/light-life.png', label: 'Groups', title: 'Multi-group workspaces' },
  { img: '/hero-phone.png', label: 'Reminders', title: 'Smart payment reminders' },
  { img: '/ui-cards.png', label: 'Collaboration', title: 'Built for shared living' },
];

function FeaturedSection() {
  return (
    <section id="features" className="featured-section">
      <div className="featured-title">
        <h2>Built for the way people actually live.</h2>
      </div>
      <div className="featured-grid">
        {features.map((f) => (
          <div key={f.title} className="featured-item">
            <div className="featured-item-image">
              <Image src={f.img} alt={f.title} fill style={{ objectFit: 'cover' }} />
            </div>
            <div className="featured-item-body">
              <p className="featured-item-label">{f.label}</p>
              <h3 className="featured-item-name">{f.title}</h3>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   TECHNOLOGY SECTION (exact from reference: technology-section.tsx)
   Dark sticky scroll with word-blur title + scroll reveal text
   ═══════════════════════════════════════════════════════════ */

function TechnologySection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handle = () => {
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      const scrollable = window.innerHeight * 0.75;
      const scrolled = -rect.top;
      setScrollProgress(Math.max(0, Math.min(1, scrolled / scrollable)));
    };
    window.addEventListener('scroll', handle, { passive: true });
    handle();
    return () => window.removeEventListener('scroll', handle);
  }, []);

  const titleOpacity = Math.max(0, 1 - scrollProgress / 0.2);
  const ip = Math.max(0, Math.min(1, (scrollProgress - 0.2) / 0.8));
  const centerW = 100 - ip * 58;
  const sideW = ip * 22;
  const sideOp = ip;
  const sideL = -100 + ip * 100;
  const sideR = 100 - ip * 100;
  const br = ip * 24;
  const gap = ip * 16;

  const techSideImages = [
    { src: '/light-life.png', alt: 'Living room', pos: 'left' },
    { src: '/light-dash.png', alt: 'Analytics', pos: 'left' },
    { src: '/light-app.png', alt: 'Notifications', pos: 'right' },
    { src: '/ui-cards.png', alt: 'Finance cards', pos: 'right' },
  ];

  const titleWords = ['Transparency', 'Meets', 'Simplicity.'];

  return (
    <section ref={sectionRef} className="tech-section">
      <div className="tech-sticky">
        <div className="tech-sticky-inner">
          <div className="tech-bento" style={{ gap: `${gap}px`, padding: `${ip * 16}px` }}>
            {/* Left col */}
            <div className="hero-side-col" style={{ width: `${sideW}%`, gap: `${gap}px`, transform: `translateX(${sideL}%)`, opacity: sideOp }}>
              {techSideImages.filter(i => i.pos === 'left').map((img, idx) => (
                <div key={idx} className="hero-side-img" style={{ flex: 1, borderRadius: `${br}px` }}>
                  <Image src={img.src} alt={img.alt} fill style={{ objectFit: 'cover' }} />
                </div>
              ))}
            </div>

            {/* Center */}
            <div className="tech-center" style={{ width: `${centerW}%`, borderRadius: `${br}px` }}>
              <Image
                src="/team.png"
                alt="People collaborating on shared finances"
                fill
                style={{ objectFit: 'cover' }}
              />
              <div className="tech-center-overlay" />
              <div className="tech-title-overlay">
                <h2>
                  {titleWords.map((word, i) => {
                    const fadeStart = i * 0.07;
                    const fadeEnd = fadeStart + 0.07;
                    const wp = Math.max(0, Math.min(1, (scrollProgress - fadeStart) / (fadeEnd - fadeStart)));
                    return (
                      <span
                        key={i}
                        className="tech-title-word"
                        style={{
                          opacity: 1 - wp,
                          filter: `blur(${wp * 10}px)`,
                          marginRight: i < titleWords.length - 1 ? '0.3em' : 0,
                        }}
                      >
                        {word}
                        {i === 0 && <br />}
                      </span>
                    );
                  })}
                </h2>
              </div>
            </div>

            {/* Right col */}
            <div className="hero-side-col" style={{ width: `${sideW}%`, gap: `${gap}px`, transform: `translateX(${sideR}%)`, opacity: sideOp }}>
              {techSideImages.filter(i => i.pos === 'right').map((img, idx) => (
                <div key={idx} className="hero-side-img" style={{ flex: 1, borderRadius: `${br}px` }}>
                  <Image src={img.src} alt={img.alt} fill style={{ objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="tech-scroll-space" />

      <div className="reveal-text-section">
        <div className="reveal-text-inner">
          <ScrollRevealText text="Managing shared expenses shouldn't require spreadsheets, group chats, or a finance degree. Commune gives every household a single source of truth — who paid, what's owed, and what's coming up next." />
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   PEOPLE IMAGE (reference: full-width image with gradient)
   ═══════════════════════════════════════════════════════════ */

function PeopleSection() {
  return (
    <div className="people-section">
      <Image src="/team.png" alt="People sharing finances" fill style={{ objectFit: 'cover' }} />
      <div className="people-gradient" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SPECS (reference: editorial-section.tsx)
   ═══════════════════════════════════════════════════════════ */

const specs = [
  { label: 'Groups', value: '∞' },
  { label: 'Members', value: '∞' },
  { label: 'Setup', value: '2 min' },
  { label: 'Tracked', value: '£4.2M' },
];

function SpecsSection() {
  return (
    <div className="specs-grid">
      {specs.map((s) => (
        <div key={s.label} className="specs-item">
          <p className="specs-item-label">{s.label}</p>
          <p className="specs-item-value">{s.value}</p>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PRICING
   ═══════════════════════════════════════════════════════════ */

const plans = [
  { label: 'Standard', price: '£4.99', note: 'per month', features: ['1 group', 'Up to 8 members', 'Expense tracking & splits', 'Payment tracking', 'Monthly breakdown'], featured: false },
  { label: 'Pro', price: '£9.99', note: 'per month', features: ['Up to 3 groups', 'Up to 15 members', 'Everything in Standard', 'Advanced analytics', 'Export support'], featured: true },
  { label: 'Pro Max', price: '£99.99', note: 'per month', features: ['Unlimited groups', 'Unlimited members', 'Everything in Pro', 'Priority support', 'Larger operations'], featured: false },
];

function PricingSection() {
  return (
    <section id="pricing" className="pricing-section">
      <div className="pricing-header">
        <h2>Simple, transparent pricing.</h2>
      </div>
      <div className="pricing-grid">
        {plans.map((p) => (
          <div key={p.label} className={`plan-card${p.featured ? ' featured' : ''}`}>
            <p className="plan-label">{p.label}</p>
            <div>
              <p className="plan-price">{p.price}</p>
              <p className="plan-note">{p.note}</p>
            </div>
            <div className="plan-divider" />
            <ul className="plan-features">
              {p.features.map((f) => <li key={f}>{f}</li>)}
            </ul>
            <a href="https://app.ourcommune.io/register" className="plan-cta">Start 7-day trial</a>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   TESTIMONIAL  (exact from reference: testimonials-section.tsx)
   ═══════════════════════════════════════════════════════════ */

function TestimonialSection() {
  return (
    <section className="testimonial-section">
      <div className="testimonial-inner">
        <blockquote className="testimonial-quote">
          &ldquo;Commune removed every awkward conversation about money in our flat. We set up the
          expenses once, and the app just handles everything else — including reminding people
          when they&apos;re due.&rdquo;
        </blockquote>
        <p className="testimonial-cite">— Priya M., London · 4-person household</p>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   FOOTER  (exact from reference: footer-section.tsx — dark bg)
   ═══════════════════════════════════════════════════════════ */

function Footer() {
  return (
    <footer>
      <div className="footer-top">
        <div>
          <div className="footer-brand-name">
            <Image src="/logo.png" alt="Commune" width={24} height={24} />
            Commune
          </div>
          <p className="footer-brand-desc">Split bills fairly with your housemates, family, and friends. No spreadsheets. No arguments. Just clarity.</p>
        </div>
        {[
          { title: 'Product', links: [['Features','#features'],['How it works','#how'],['Pricing','#pricing'],['Sign in','https://app.ourcommune.io']] },
          { title: 'Company', links: [['About','#'],['Blog','#'],['Careers','#'],['Contact','mailto:support@ourcommune.io']] },
          { title: 'Legal', links: [['Privacy','#'],['Terms','#'],['Cookies','#']] },
        ].map((col) => (
          <div key={col.title} className="footer-col">
            <h4>{col.title}</h4>
            <ul>{col.links.map(([l,h]) => <li key={l}><a href={h}>{l}</a></li>)}</ul>
          </div>
        ))}
      </div>
      <div className="footer-bottom">
        <p>© 2026 Commune. All rights reserved.</p>
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
   PAGE  (exact order from reference: page.tsx)
   ═══════════════════════════════════════════════════════════ */

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <PhilosophySection />
        <FeaturedSection />
        <TechnologySection />
        <PeopleSection />
        <SpecsSection />
        <PricingSection />
        <TestimonialSection />
      </main>
      <Footer />
    </>
  );
}
