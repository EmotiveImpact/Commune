import { useEffect, useRef, useState } from 'react';

const signup = 'https://app.ourcommune.io/signup';
const login = 'https://app.ourcommune.io/login';

const stories = [
  { title: 'Every bill, in one place', body: 'Rent, utilities, internet and the little things. Everyone can see what is coming up.', visual: 'photo', image: '/cooking.png', alt: 'Housemates cooking together' },
  { title: 'Split it your way', body: 'Equal shares, percentages or custom amounts. Keep the maths clear for the whole group.', visual: 'split' },
  { title: 'Know what has been paid', body: 'See who has settled up and what is still outstanding, without asking the group chat.', visual: 'photo', image: '/groceries.png', alt: 'Housemates unpacking groceries' },
  { title: 'A clearer month ahead', body: 'Each person can see their share before it is due.', visual: 'month' },
];
const moments = [
  { title: 'A home with housemates', body: 'Shared costs are easier when everyone sees the same picture.', visual: 'photo', image: '/groceries.png', alt: 'Housemates at home' },
  { title: 'A studio you run together', body: 'Keep recurring space costs and one-off purchases organised.', visual: 'split' },
  { title: 'A group making plans', body: 'Give every contribution a place, from first expense to final payment.', visual: 'photo', image: '/cooking.png', alt: 'Friends preparing a meal' },
  { title: 'The everyday in between', body: 'Little shared expenses add up. Keep them easy to understand.', visual: 'month' },
];
type Story = typeof stories[number];
const benefits = [
  ['01', 'Groups that fit real life', 'Give your home, studio or group its own clear space.'],
  ['02', 'Expenses with the detail', 'Add what it was for, when it is due and who is included.'],
  ['03', 'Flexible splits', 'Share equally, by percentage or with custom amounts.'],
  ['04', 'Payment tracking', 'See what has been paid and what still needs settling.'],
  ['05', 'Monthly breakdowns', 'A view of each person’s share across the month.'],
  ['06', 'Recurring expenses', 'Keep regular costs on the radar as each month begins.'],
];
const plans = [
  ['Standard', '£4.99', 'One shared space, simply sorted.', '1 group · up to 8 members'],
  ['Pro', '£9.99', 'More room for the groups you run.', '3 groups · up to 15 members each'],
  ['Agency', '£29.99', 'For spaces and communities at scale.', 'Unlimited groups and members'],
];
function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 36);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  return <header className={'header' + (scrolled || open ? ' header--solid' : '')}><div className="header__inner">
    <button className="menu-button" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen(!open)}><span /><span /><span /></button>
    <a className="logo" href="#top" onClick={() => setOpen(false)}>commune<span>.</span></a>
    <nav className={'nav-pill' + (open ? ' nav-pill--open' : '')} aria-label="Main navigation">
      <a href="#how-it-works" onClick={() => setOpen(false)}>How it works</a><a href="#features" onClick={() => setOpen(false)}>Features</a><a href="#pricing" onClick={() => setOpen(false)}>Pricing</a><a className="nav-pill__login" href={login}>Log in</a>
    </nav>
    <a className="button button--dark header__cta" href={signup}>Start free trial</a>
  </div></header>;
}
function Hero() {
  return <section className="hero" id="top" aria-labelledby="hero-title">
    <img className="hero__image" src="/hero-life.webp" alt="Housemates sharing dinner in their home" fetchPriority="high" /><div className="hero__overlay" />
    <div className="hero__content"><p className="hero__eyebrow">Shared life, clearer.</p><h1 id="hero-title">For people who <span>do life together.</span></h1><p className="hero__body">One clear place for shared expenses, splits and payments. Less chasing, more of the good stuff.</p><a className="button button--white" href={signup}>Start your 7-day free trial</a></div>
    <div className="hero__tags"><span>Rent</span><span>Bills</span><span>Everyday costs</span></div>
  </section>;
}
function StoryVisual({ story }: { story: Story }) {
  if (story.visual === 'photo') return <img src={story.image} alt={story.alt} loading="lazy" />;
  if (story.visual === 'split') return <div className="story-visual story-visual--navy"><div className="split-card"><span>Shared this month</span><strong>£1,250.00</strong><div><span>4 people</span><b>£312.50 each</b></div></div></div>;
  return <div className="story-visual story-visual--blue"><div className="month-card"><span>October</span><strong>All clear.</strong><i>One place for every share.</i></div></div>;
}
function CardRail({ items, title, subtitle, cta }: { items: Story[]; title: string; subtitle: string; cta?: boolean }) {
  const rail = useRef<HTMLDivElement>(null);
  const move = (direction: number) => rail.current?.scrollBy({ left: direction * 350, behavior: 'smooth' });
  return <section className="rail-section"><div className="section-top"><div><h2>{title}</h2><p>{subtitle}</p>{cta && <a className="button button--dark" href={signup}>Start your free trial</a>}</div><div className="rail-controls"><button onClick={() => move(-1)} aria-label="Previous cards">←</button><button onClick={() => move(1)} aria-label="Next cards">→</button></div></div><div className="story-rail" ref={rail}>{items.map((item) => <article className="story-card" key={item.title}><div className="story-card__visual"><StoryVisual story={item} /></div><h3>{item.title}</h3><p>{item.body}</p><a className="button button--outline" href="#features">Learn more</a></article>)}</div></section>;
}
const slides = [
  ['One shared view', 'Everything together, at last.', 'A single space for the costs behind your shared life. See the full picture without searching through messages.', '/groceries.png', 'Housemates unpacking groceries'],
  ['Made for your group', 'The right split for everyone.', 'Include the right people and choose equal, percentage or custom shares. The detail stays visible to the group.', '/cooking.png', 'Housemates making dinner'],
  ['Less chasing', 'Know where things stand.', 'Track what is due and what has been paid, so the conversation can move on to better things.', '/hero-life.webp', 'Friends eating dinner'],
];
function Showcase() {
  const [active, setActive] = useState(0);
  const slide = slides[active];
  return <section className="showcase" id="how-it-works"><div className="showcase__heading"><h2>Quit the money juggling act.</h2><p>One shared space for the people, payments and plans that make a place work.</p><a className="button button--dark" href={signup}>Start your free trial</a></div><div className="showcase__panel" key={active}><div className="showcase__copy"><span className="mini-label">{slide[0]}</span><h3>{slide[1]}</h3><p>{slide[2]}</p><a className="button button--outline" href="#features">Explore the features</a></div><div className="showcase__photo"><img src={slide[3]} alt={slide[4]} loading="lazy" /></div></div><div className="showcase__controls"><span>{String(active + 1).padStart(2, '0')} / 03</span><div className="showcase__dots">{slides.map((item, index) => <button key={item[0]} className={'dot' + (index === active ? ' dot--active' : '')} onClick={() => setActive(index)} aria-label={'Show ' + item[0]} aria-pressed={index === active} />)}</div><div><button onClick={() => setActive((active + 2) % 3)} aria-label="Previous feature">←</button><button onClick={() => setActive((active + 1) % 3)} aria-label="Next feature">→</button></div></div></section>;
}
function Features() {
  return <section className="features" id="features"><div className="features__heading"><h2>It starts with one clear place.</h2><p>The useful tools you need to make shared money feel simple.</p></div><div className="features__grid">{benefits.map(([number, title, body]) => <article className="feature-card" key={number}><div className="feature-card__top"><span>{number}</span><span className="feature-card__arrow">↗</span></div><div><h3>{title}</h3><p>{body}</p></div></article>)}</div><a className="button button--outline features__all" href={signup}>See what Commune can do</a></section>;
}
function Month() {
  return <section className="month"><div className="month__copy"><span className="mini-label">Clarity, month after month</span><h2>Know your share. Enjoy the rest.</h2><p>Give every expense a place and let each person see what belongs to them. The numbers stay clear, even when life gets busy.</p><a className="button button--dark" href={signup}>Start your free trial</a></div><div className="month__visual"><div className="month__paper"><div className="month__paper-top"><span>Maple House</span><span>October</span></div><span className="month__small">YOUR SHARE THIS MONTH</span><strong>£386.50</strong><div className="month__line"><span>Rent</span><b>£300.00</b></div><div className="month__line"><span>Utilities</span><b>£52.50</b></div><div className="month__line"><span>Internet</span><b>£34.00</b></div><div className="month__paid">Everything in one place <span>✓</span></div></div></div></section>;
}
function Pricing() {
  return <section className="pricing" id="pricing"><div className="pricing__heading"><h2>Find your fit.</h2><p>Try Commune free for 7 days. Then pick the plan that works for your group.</p></div><div className="pricing__grid">{plans.map(([name, price, description, detail]) => <article className="price-card" key={name}><h3>{name}</h3><p>{description}</p><div><strong>{price}</strong><span>/month</span></div><small>{detail}</small><a className="button button--outline" href={signup}>Start free trial</a></article>)}</div></section>;
}
function Closing() {
  return <section className="closing"><div className="closing__inner"><span className="mini-label">Less admin. More living.</span><h2>Make space for the good stuff.</h2><p>Shared life feels lighter when the money is clear.</p><a className="button button--white" href={signup}>Start your 7-day free trial</a></div></section>;
}
function Footer() {
  return <footer className="footer"><div className="footer__top"><div><a className="logo logo--white" href="#top">commune<span>.</span></a><p>For the life you share.</p></div><nav aria-label="Footer navigation"><div><strong>Explore</strong><a href="#how-it-works">How it works</a><a href="#features">Features</a><a href="#pricing">Pricing</a></div><div><strong>Get started</strong><a href={signup}>Start free trial</a><a href={login}>Log in</a><a href="mailto:support@ourcommune.io">Contact</a></div><div><strong>Information</strong><a href="https://app.ourcommune.io/privacy">Privacy</a><a href="https://app.ourcommune.io/terms">Terms</a></div></nav></div><div className="footer__bottom"><span>© {new Date().getFullYear()} Commune</span><span>Shared life, clearer.</span></div></footer>;
}
export default function App() { return <><Header /><main><Hero /><CardRail items={stories} title="Get more out of living together." subtitle="Whatever your group looks like, keep the money side beautifully clear." cta /><Showcase /><Features /><CardRail items={moments} title="Made for the way you share." subtitle="Different people. Different spaces. One easier way to stay on top of it." /><Month /><Pricing /><Closing /></main><Footer /></>; }
