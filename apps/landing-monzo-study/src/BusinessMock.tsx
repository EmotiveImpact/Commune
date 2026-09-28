import { useEffect, useState } from 'react';

const signup = 'https://app.ourcommune.io/signup';
const login = 'https://app.ourcommune.io/login';

const plans = [
  { name: 'Standard', monthly: '£4.99', annual: '£49.99', line: 'One shared space, beautifully in order.', groups: '1 group', members: 'Up to 8 members per group' },
  { name: 'Pro', monthly: '£9.99', annual: '£99.99', line: 'More room for everything you run together.', groups: '3 groups', members: 'Up to 15 members per group' },
  { name: 'Agency', monthly: '£29.99', annual: '£299.99', line: 'For the people looking after many spaces.', groups: 'Unlimited groups', members: 'Unlimited members' },
];

const questions = [
  { question: 'How does Commune handle payments?', answer: 'Your group pays each other using the method you already prefer. In Commune, members mark their share as paid and a group admin can confirm it, so everyone can see where things stand.' },
  { question: 'Can we split an expense unevenly?', answer: 'Yes. Choose an equal split, set percentages, or enter custom amounts for the people included in an expense.' },
  { question: 'What happens after the 7-day trial?', answer: 'Your trial begins on the Standard plan. At the end of the trial, you can choose a paid plan and monthly or annual billing to keep using Commune.' },
  { question: 'Can I invite people after creating a group?', answer: 'Yes. Create your group first, then invite members by email when you are ready.' },
  { question: 'Can I use Commune for more than one group?', answer: 'Yes. Pro supports up to 3 groups, and Agency supports unlimited groups. Standard includes 1 group.' },
];

function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 32);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  return <header className={'bm-header' + (scrolled || open ? ' bm-header--solid' : '')}>
    <div className="bm-header__inner">
      <a href="#top" className="bm-logo" onClick={() => setOpen(false)}>commune<span>.</span></a>
      <nav className={'bm-nav' + (open ? ' bm-nav--open' : '')} aria-label="Main navigation">
        <a href="#how-it-works" onClick={() => setOpen(false)}>How it works</a>
        <a href="#features" onClick={() => setOpen(false)}>Features</a>
        <a href="#pricing" onClick={() => setOpen(false)}>Pricing</a>
        <a href="#questions" onClick={() => setOpen(false)}>FAQs</a>
      </nav>
      <div className="bm-header__actions"><a className="bm-login" href={login}>Log in</a><a className="bm-button bm-button--white" href={signup}>Start free trial <span aria-hidden="true">↗</span></a></div>
      <button className="bm-menu" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen(!open)}><span /><span /></button>
    </div>
  </header>;
}

function Hero() {
  return <section className="bm-hero" id="top" aria-labelledby="bm-hero-title">
    <img src="/hero-life.webp" alt="Housemates sharing dinner together at home" className="bm-hero__image" fetchPriority="high" />
    <div className="bm-hero__shade" />
    <div className="bm-hero__content">
      <p className="bm-kicker bm-kicker--light"><span /> Shared life, clearer</p>
      <h1 id="bm-hero-title">For people who{' '}<em>do life together.</em></h1>
      <p className="bm-hero__description">Split shared costs, see your share, and know what has been paid. More clarity for the life you share.</p>
      <div className="bm-hero__actions"><a className="bm-button bm-button--white" href={signup}>Start your 7-day free trial <span aria-hidden="true">↗</span></a><a className="bm-hero__link" href="#how-it-works">See how it works <span aria-hidden="true">↓</span></a></div>
    </div>
    <div className="bm-hero__caption"><span className="bm-hero__caption-line" /> The everyday is better together.</div>
  </section>;
}

function ProofStrip() {
  return <section className="bm-proof" aria-labelledby="bm-proof-title">
    <div className="bm-container">
      <div className="bm-proof__intro"><span className="bm-section-label">A clearer way to share</span><h2 id="bm-proof-title">Less working it out.<br />More getting on with it.</h2></div>
      <div className="bm-proof__grid">
        <article><div className="bm-proof__symbol bm-proof__symbol--one"><span>£</span><span>÷</span><span>4</span></div><h3>Fair, flexible splits</h3><p>Share a cost equally, by percentage, or with your own amounts.</p></article>
        <article><div className="bm-proof__symbol bm-proof__symbol--two"><span>✓</span><span>✓</span><span>✓</span></div><h3>Everyone sees the same picture</h3><p>Each person can see their share and what is still outstanding.</p></article>
        <article><div className="bm-proof__symbol bm-proof__symbol--three"><span>↗</span></div><h3>Payments stay visible</h3><p>Members mark shares paid. Group admins can confirm them.</p></article>
      </div>
    </div>
  </section>;
}

function DashboardPreview() {
  return <div className="bm-dashboard" role="img" aria-label="Illustrative Commune dashboard showing a monthly share of £386.50, £300 paid, and £86.50 remaining">
    <div className="bm-dashboard__side"><b>commune<span>.</span></b><div className="bm-dashboard__home">⌂ <span>Overview</span></div><div>▤ <span>Expenses</span></div><div>◷ <span>My breakdown</span></div><div>♙ <span>Members</span></div><div className="bm-dashboard__side-bottom">M <span>Maple House</span></div></div>
    <div className="bm-dashboard__main"><div className="bm-dashboard__top"><span>Maple House <span className="bm-dashboard__chevron">⌄</span></span><div className="bm-dashboard__avatar">A</div></div><p className="bm-dashboard__eyebrow">OCTOBER OVERVIEW</p><h3>Your month, all clear.</h3><p className="bm-dashboard__sub">Everything you need to know about your share.</p>
      <div className="bm-dashboard__stats"><div className="bm-dashboard__stat bm-dashboard__stat--main"><span>Your share this month</span><strong>£386.50</strong><small>Across 3 shared expenses</small></div><div className="bm-dashboard__stat"><span>Paid so far</span><strong>£300.00</strong><small><i /> Looking good</small></div><div className="bm-dashboard__stat"><span>Still to pay</span><strong>£86.50</strong><small>2 expenses remaining</small></div></div>
      <div className="bm-dashboard__list"><div className="bm-dashboard__listhead"><strong>Your expenses</strong><span>View all →</span></div><div><span className="bm-expense-icon">⌂</span><span>Rent<small>1 October</small></span><b>£300.00</b><i>Paid</i></div><div><span className="bm-expense-icon">ϟ</span><span>Utilities<small>12 October</small></span><b>£52.50</b><i className="bm-dashboard__due">Due</i></div><div><span className="bm-expense-icon">⌁</span><span>Internet<small>18 October</small></span><b>£34.00</b><i className="bm-dashboard__due">Due</i></div></div>
    </div>
  </div>;
}

function ProductIntro() {
  return <section className="bm-product" id="how-it-works"><div className="bm-container bm-product__layout">
    <div className="bm-product__copy"><span className="bm-section-label">THE SHARED VIEW</span><h2>Everything going on.<br /><span>All in one place.</span></h2><p>Your home has a lot of moving parts. Commune gives the money side a clear home, so no one has to search a chat to know what they owe.</p><ul><li><span>01</span> See your share of the month</li><li><span>02</span> Know what is paid and what is due</li><li><span>03</span> Keep recurring costs in sight</li></ul><a className="bm-button bm-button--navy" href="#steps">See how it works <span aria-hidden="true">↗</span></a></div>
    <div className="bm-product__visual"><span className="bm-product__visual-label">A month in Commune</span><DashboardPreview /><span className="bm-product__visual-note">Illustrative product preview</span></div>
  </div></section>;
}

function Steps() {
  return <section className="bm-steps" id="steps"><div className="bm-container"><div className="bm-section-heading"><span className="bm-section-label">HOW IT WORKS</span><h2>A shared bill.<br />A clear way forward.</h2><p>From adding an expense to seeing it settled, everyone knows where they stand.</p></div><div className="bm-steps__grid">
    <article className="bm-step"><div className="bm-step__visual bm-step__visual--bill"><div className="bm-mini-bill"><div className="bm-mini-bill__top"><span>New expense</span><span>✕</span></div><span className="bm-mini-label">WHAT IS IT FOR?</span><strong>Monthly rent</strong><span className="bm-mini-label">AMOUNT</span><b>£1,200.00</b><div className="bm-mini-bill__pill">+ Add to Maple House</div></div></div><span className="bm-step__number">01 / ADD IT</span><h3>Give every cost a place.</h3><p>Rent, bills, groceries or the one-off things. Add the detail once for the group.</p></article>
    <article className="bm-step"><div className="bm-step__visual bm-step__visual--split"><div className="bm-mini-split"><div className="bm-mini-split__title">Split this expense <span>Equal split</span></div><div className="bm-mini-split__people"><span>M</span><span>J</span><span>A</span><span>S</span></div><strong>£300.00 <small>each</small></strong><div className="bm-mini-split__line"><span>4 people included</span><b>£1,200 total</b></div></div></div><span className="bm-step__number">02 / SPLIT IT</span><h3>Make the split fit.</h3><p>Choose who is included and split equally, by percentage, or with custom amounts.</p></article>
    <article className="bm-step"><div className="bm-step__visual bm-step__visual--track"><div className="bm-mini-track"><span>Monthly rent</span><strong>Payment progress</strong><div className="bm-mini-track__bar"><i /></div><div><span className="bm-mini-track__avatar">M</span><span>Maya paid</span><b>✓</b></div><div><span className="bm-mini-track__avatar">J</span><span>Jonas paid</span><b>✓</b></div><div><span className="bm-mini-track__avatar bm-mini-track__avatar--muted">A</span><span>Alex to pay</span><b>·</b></div></div></div><span className="bm-step__number">03 / STAY CLEAR</span><h3>See where things stand.</h3><p>Members mark their shares paid. Admins can confirm them, with the status visible to the group.</p></article>
  </div></div></section>;
}

function FeatureBand() {
  return <section className="bm-features" id="features"><div className="bm-container"><div className="bm-features__heading"><span className="bm-section-label">BUILT FOR THE EVERYDAY</span><h2>The little details make<br />a big difference.</h2><p>Useful tools for the costs that keep coming around.</p></div><div className="bm-features__grid">
    <article><span className="bm-feature-icon">↻</span><h3>Recurring costs</h3><p>Keep regular expenses visible when a new month begins.</p></article>
    <article><span className="bm-feature-icon">≋</span><h3>Your own breakdown</h3><p>See each item behind your monthly share and what remains.</p></article>
    <article><span className="bm-feature-icon">▣</span><h3>Group spaces</h3><p>Give your home, studio or project a shared place of its own.</p></article>
    <article><span className="bm-feature-icon">◎</span><h3>The right people</h3><p>Include only the members who share a particular expense.</p></article>
    <article><span className="bm-feature-icon">✓</span><h3>Payment history</h3><p>See when a share was marked paid and confirmed.</p></article>
    <article><span className="bm-feature-icon">↗</span><h3>Clearer follow-up</h3><p>Know what is overdue and what is coming up next.</p></article>
  </div></div></section>;
}

function LifePanel() {
  return <section className="bm-life"><div className="bm-life__photo"><img src="/groceries.png" alt="Housemates unpacking groceries together at home" loading="lazy" /></div><div className="bm-life__copy"><span className="bm-section-label">FOR REAL LIFE</span><h2>Good things happen when the money is clear.</h2><p>Plans change. People come and go. Some costs are equal and others are not. Commune helps the group keep up without making shared life feel like admin.</p><a className="bm-button bm-button--white" href={signup}>Start your free trial <span aria-hidden="true">↗</span></a></div></section>;
}

function Pricing() {
  const [annual, setAnnual] = useState(false);
  return <section className="bm-pricing" id="pricing"><div className="bm-container"><div className="bm-pricing__top"><div><span className="bm-section-label">SIMPLE PLANS</span><h2>Room for your kind<br />of together.</h2><p>Try Commune free for 7 days. Choose a plan when your trial ends.</p></div><div className="bm-billing" role="group" aria-label="Billing frequency"><button type="button" className={!annual ? 'bm-billing--active' : ''} onClick={() => setAnnual(false)} aria-pressed={!annual}>Monthly</button><button type="button" className={annual ? 'bm-billing--active' : ''} onClick={() => setAnnual(true)} aria-pressed={annual}>Yearly</button></div></div><div className="bm-pricing__grid">{plans.map((plan, index) => <article className={'bm-plan' + (index === 1 ? ' bm-plan--featured' : '')} key={plan.name}><div className="bm-plan__top"><span>{plan.name}</span>{index === 1 && <small>MORE ROOM TO GROW</small>}</div><p>{plan.line}</p><div className="bm-plan__price"><strong>{annual ? plan.annual : plan.monthly}</strong><span>/{annual ? 'year' : 'month'}</span></div><div className="bm-plan__details"><div><span>✓</span>{plan.groups}</div><div><span>✓</span>{plan.members}</div><div><span>✓</span>7-day free trial</div></div><a href={signup} className={'bm-button ' + (index === 1 ? 'bm-button--white' : 'bm-button--navy')}>Start free trial <span aria-hidden="true">↗</span></a></article>)}</div><p className="bm-pricing__note">The trial starts on Standard. Plans are selected at the end of the trial.</p></div></section>;
}

function Faq() {
  return <section className="bm-faq" id="questions"><div className="bm-container bm-faq__layout"><div className="bm-faq__heading"><span className="bm-section-label">GOOD TO KNOW</span><h2>Questions before<br />you get started?</h2><p>Here are the things people usually want to know.</p></div><div className="bm-faq__list">{questions.map(({ question, answer }) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></div></section>;
}

function Closing() {
  return <section className="bm-closing"><div className="bm-closing__inner"><span className="bm-section-label">MORE LIVING. LESS CHASING.</span><h2>Make room for<br /><em>the good stuff.</em></h2><p>Shared life feels lighter when everyone can see the same picture.</p><a className="bm-button bm-button--white" href={signup}>Start your 7-day free trial <span aria-hidden="true">↗</span></a></div><span className="bm-closing__shape bm-closing__shape--one" /><span className="bm-closing__shape bm-closing__shape--two" /></section>;
}

function Footer() {
  return <footer className="bm-footer"><div className="bm-container"><div className="bm-footer__main"><div><a href="#top" className="bm-logo">commune<span>.</span></a><p>For people who do life together.</p></div><nav aria-label="Footer navigation"><div><strong>Explore</strong><a href="#how-it-works">How it works</a><a href="#features">Features</a><a href="#pricing">Pricing</a></div><div><strong>Get started</strong><a href={signup}>Start free trial</a><a href={login}>Log in</a><a href="mailto:support@ourcommune.io">Contact</a></div><div><strong>Information</strong><a href="#questions">FAQs</a><a href="https://app.ourcommune.io/privacy">Privacy</a><a href="https://app.ourcommune.io/terms">Terms</a></div></nav></div><div className="bm-footer__bottom"><span>© {new Date().getFullYear()} Commune</span><span>Shared life, clearer.</span></div></div></footer>;
}

export default function BusinessMock() {
  return <><Header /><main><Hero /><ProofStrip /><ProductIntro /><Steps /><FeatureBand /><LifePanel /><Pricing /><Faq /><Closing /></main><Footer /></>;
}
