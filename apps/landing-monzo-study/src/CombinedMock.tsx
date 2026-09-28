import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

const signup = 'https://app.ourcommune.io/signup';
const login = 'https://app.ourcommune.io/login';

const steps = [
  {
    label: 'Add a cost',
    heading: 'Every cost has a clear place.',
    body: 'Add rent, bills, groceries or one-off purchases once. The right people can see the detail without searching through messages.',
  },
  {
    label: 'Split it your way',
    heading: 'A clear split for everyone.',
    body: 'Split costs however makes sense for your home, workspace or trip. Add people, choose how to split, and keep everyone on the same page.',
  },
  {
    label: 'Know what is paid',
    heading: 'Know where things stand.',
    body: 'Members can mark their shares paid and group admins can confirm them. See what is settled and what still needs attention.',
  },
] as const;

const useCases = [
  { title: 'Home', body: 'For housemates, partners and families sharing a space.', image: '/groceries.png', alt: 'Housemates unpacking groceries in their kitchen' },
  { title: 'Work', body: 'For studios, workspaces and project teams with shared costs.', image: '/work-together.png', alt: 'Creative team working together around a studio table' },
  { title: 'Trips', body: 'For friends, crews and groups making plans on the move.', image: '/trip-together.png', alt: 'Friends coordinating a trip together at a station' },
];

const benefits = [
  { number: '01', title: 'Recurring expenses', body: 'Keep regular costs in view as each new period begins.' },
  { number: '02', title: 'Your monthly breakdown', body: 'See the expenses behind your own share, item by item.' },
  { number: '03', title: 'Payment history', body: 'A clear record of shares marked paid and confirmed.' },
];

const plans = [
  { name: 'Standard', monthly: '£4.99', annual: '£49.99', description: 'One shared space, simply sorted.', groups: '1 group', members: 'Up to 8 members per group' },
  { name: 'Pro', monthly: '£9.99', annual: '£99.99', description: 'More room for the groups you run.', groups: '3 groups', members: 'Up to 15 members per group' },
  { name: 'Agency', monthly: '£29.99', annual: '£299.99', description: 'For spaces and communities at scale.', groups: 'Unlimited groups', members: 'Unlimited members' },
];

const questions = [
  { question: 'How does Commune handle payments?', answer: 'Your group pays each other using the method you already prefer. Members mark their shares as paid in Commune, and a group admin can confirm them.' },
  { question: 'Can we split an expense unevenly?', answer: 'Yes. You can split a cost equally, by percentage, or with custom amounts for the people included.' },
  { question: 'What happens after the 7-day trial?', answer: 'The trial begins on Standard. When it ends, you can choose a paid plan and monthly or annual billing to continue.' },
  { question: 'Can I invite people later?', answer: 'Yes. Create your group first and invite members by email whenever you are ready.' },
  { question: 'Can I use Commune for more than one group?', answer: 'Yes. Pro includes up to 3 groups, and Agency supports unlimited groups. Standard includes 1 group.' },
];

function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 30);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  return <header className={'c-header' + (scrolled || open ? ' c-header--solid' : '')}>
    <div className="c-header__inner">
      <a className="c-logo" href="#top" onClick={() => setOpen(false)}>commune<span>.</span></a>
      <nav id="combined-main-nav" className={'c-nav' + (open ? ' c-nav--open' : '')} aria-label="Main navigation">
        <a href="#how-it-works" onClick={() => setOpen(false)}>How it works</a>
        <a href="#use-cases" onClick={() => setOpen(false)}>Who it is for</a>
        <a href="#features" onClick={() => setOpen(false)}>Features</a>
        <a href="#pricing" onClick={() => setOpen(false)}>Pricing</a>
        <a className="c-nav__login" href={login}>Log in</a>
      </nav>
      <a className="c-button c-button--header c-header__cta" href={signup}>Start free trial</a>
      <button className="c-menu" type="button" aria-expanded={open} aria-controls="combined-main-nav" onClick={() => setOpen(!open)}>{open ? 'Close' : 'Menu'}</button>
    </div>
  </header>;
}

function Hero() {
  return <section className="c-hero" id="top" aria-labelledby="combined-hero-title">
    <img className="c-hero__image" src="/hero-life.webp" alt="Housemates sharing dinner around a table at home" fetchPriority="high" />
    <div className="c-hero__overlay" />
    <div className="c-hero__inner"><p className="c-hero__eyebrow">Shared life, clearer.</p><h1 id="combined-hero-title">For people who<br />do life together.</h1><p className="c-hero__body">One clear place for shared expenses, splits and payments.</p><a className="c-button c-button--white" href={signup}>Start your 7-day free trial</a></div>
  </section>;
}

function PreviewShell({ children }: { children: ReactNode }) {
  return <div className="c-preview" aria-label="Illustrative Commune product preview"><aside className="c-preview__sidebar"><strong className="c-preview__brand">commune<span>.</span></strong><div className="c-preview__sidebar-links"><span className="c-preview__sidebar-active">Overview</span><span>Expenses</span><span>My breakdown</span><span>Members</span></div><div className="c-preview__space">Maple House</div></aside><div className="c-preview__main"><div className="c-preview__top"><span>Maple House</span><span className="c-preview__avatar">A</span></div>{children}</div></div>;
}

function AddScreen({ onNext }: { onNext: () => void }) {
  return <PreviewShell><div className="c-preview__crumb">EXPENSES / NEW EXPENSE</div><div className="c-preview__heading"><div><h3>New shared expense</h3><p>Add the details once for everyone involved.</p></div><span className="c-preview__state">Draft</span></div><div className="c-expense-summary"><div><span>EXPENSE</span><strong>Monthly rent</strong></div><div><span>AMOUNT</span><strong>£1,200.00</strong></div><div><span>DUE DATE</span><strong>1 October</strong></div><div><span>REPEATS</span><strong>Monthly</strong></div></div><div className="c-preview__selection"><span>Included in this expense</span><strong>Alex · Jordan · Taylor · Casey</strong></div><button className="c-preview__action" type="button" onClick={onNext}>Continue to split</button></PreviewShell>;
}

function SplitScreen({ onNext }: { onNext: () => void }) {
  return <PreviewShell><div className="c-preview__crumb">EXPENSES / RENT</div><div className="c-preview__heading"><div><h3>Rent</h3><p>1 October · Monthly · Shared home</p></div><span className="c-preview__state c-preview__state--green">In progress</span></div><div className="c-preview__amount">£1,200.00</div><div className="c-preview__summaryline"><span>Split between 4 people</span><strong>Equal split · £300 each</strong></div><div className="c-preview__people"><div><i>A</i><span>Alex</span><strong>£300.00</strong><em className="c-preview__paid">Paid</em></div><div><i>J</i><span>Jordan</span><strong>£300.00</strong><em className="c-preview__paid">Paid</em></div><div><i>T</i><span>Taylor</span><strong>£300.00</strong><em>Due</em></div><div><i>C</i><span>Casey</span><strong>£300.00</strong><em>Due</em></div></div><button className="c-preview__action" type="button" onClick={onNext}>See payment status</button></PreviewShell>;
}

function PaidScreen() {
  return <PreviewShell><div className="c-preview__crumb">MAPLE HOUSE / OCTOBER</div><div className="c-preview__heading"><div><h3>Payment progress</h3><p>Monthly rent · £1,200.00</p></div><span className="c-preview__state c-preview__state--green">2 of 4 paid</span></div><div className="c-progress"><div className="c-progress__labels"><strong>£600.00 paid</strong><span>£600.00 remaining</span></div><div className="c-progress__bar"><span /></div></div><div className="c-preview__people c-preview__people--track"><div><i>A</i><span>Alex</span><strong>1 October</strong><em className="c-preview__paid">Confirmed</em></div><div><i>J</i><span>Jordan</span><strong>2 October</strong><em className="c-preview__paid">Paid</em></div><div><i>T</i><span>Taylor</span><strong>£300.00</strong><em>Due</em></div><div><i>C</i><span>Casey</span><strong>£300.00</strong><em>Due</em></div></div><p className="c-preview__note">Everyone in the group can see the latest status.</p></PreviewShell>;
}

function Process() {
  const [active, setActive] = useState(1);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const moveWithKeyboard = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % steps.length;
    else if (event.key === 'ArrowLeft') next = (index + steps.length - 1) % steps.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = steps.length - 1;
    else return;
    event.preventDefault();
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  return <section className="c-process" id="how-it-works" aria-labelledby="process-heading"><div className="c-container"><h2 className="c-sr-only" id="process-heading">How Commune works</h2><div className="c-process__tabs" role="tablist" aria-label="How Commune works">{steps.map((step, index) => <button key={step.label} id={'process-tab-' + index} ref={element => { tabRefs.current[index] = element; }} type="button" role="tab" aria-controls="process-panel" aria-selected={active === index} tabIndex={active === index ? 0 : -1} className={'c-process__tab' + (active === index ? ' c-process__tab--active' : '')} onClick={() => setActive(index)} onKeyDown={event => moveWithKeyboard(event, index)}><span>{String(index + 1).padStart(2, '0')}</span>{step.label}</button>)}</div><div className="c-process__content" id="process-panel" role="tabpanel" aria-labelledby={'process-tab-' + active}><div className="c-process__copy" key={'copy-' + active}><p className="c-kicker">THE SHARED VIEW</p><h2>{steps[active].heading}</h2><p>{steps[active].body}</p><a className="c-button c-button--navy" href={signup}>Start your 7-day free trial</a></div><div className="c-process__screen" key={'screen-' + active}>{active === 0 ? <AddScreen onNext={() => setActive(1)} /> : active === 1 ? <SplitScreen onNext={() => setActive(2)} /> : <PaidScreen />}<span className="c-process__caption">Illustrative product preview</span></div></div></div></section>;
}

function UseCases() {
  return <section className="c-cases" id="use-cases"><div className="c-container"><div className="c-cases__intro"><div><p className="c-kicker">FOR THE LIFE YOU SHARE</p><h2>For the ways we do life together.</h2></div><p>From home to work to away, give every group one clear place for the money they share.</p></div><div className="c-cases__grid">{useCases.map(item => <article className="c-case" key={item.title}><div className="c-case__image"><img src={item.image} alt={item.alt} loading="lazy" /></div><h3>{item.title}</h3><p>{item.body}</p></article>)}</div><p className="c-cases__more">Shared homes, studios, projects, trips and the groups in between.</p></div></section>;
}

function Features() {
  return <section className="c-features" id="features"><div className="c-container"><div className="c-features__intro"><p className="c-kicker">THE DETAILS THAT HELP</p><h2>Small things that make<br />the month easier.</h2><p>Commune keeps the practical details close, so each person knows their part.</p></div><div className="c-features__grid">{benefits.map(item => <article key={item.number}><span>{item.number}</span><h3>{item.title}</h3><p>{item.body}</p></article>)}</div></div></section>;
}

function Pricing() {
  const [annual, setAnnual] = useState(false);
  return <section className="c-pricing" id="pricing"><div className="c-container"><div className="c-pricing__intro"><div><p className="c-kicker">PLANS</p><h2>Find your fit.</h2><p>Try Commune free for 7 days. Then choose the plan that works for your groups.</p></div><div className="c-billing" role="group" aria-label="Billing frequency"><button type="button" aria-pressed={!annual} className={!annual ? 'c-billing--active' : ''} onClick={() => setAnnual(false)}>Monthly</button><button type="button" aria-pressed={annual} className={annual ? 'c-billing--active' : ''} onClick={() => setAnnual(true)}>Yearly</button></div></div><div className="c-pricing__grid">{plans.map((plan, index) => <article className={'c-plan' + (index === 1 ? ' c-plan--featured' : '')} key={plan.name}><h3>{plan.name}</h3><p>{plan.description}</p><div className="c-plan__price"><strong>{annual ? plan.annual : plan.monthly}</strong><span>/{annual ? 'year' : 'month'}</span></div><div className="c-plan__details"><span>{plan.groups}</span><span>{plan.members}</span><span>7-day free trial</span></div><a className={'c-button ' + (index === 1 ? 'c-button--white' : 'c-button--outline')} href={signup}>Start free trial</a></article>)}</div><p className="c-pricing__footnote">Your trial begins on Standard. Choose monthly or annual billing when your trial ends.</p></div></section>;
}

function Faq() {
  return <section className="c-faq" id="questions"><div className="c-container c-faq__layout"><div><p className="c-kicker">GOOD TO KNOW</p><h2>Questions before<br />you get started?</h2><p>Here are the things people usually ask.</p></div><div className="c-faq__list">{questions.map(item => <details key={item.question}><summary>{item.question}<span>Read answer</span></summary><p>{item.answer}</p></details>)}</div></div></section>;
}

function Closing() {
  return <section className="c-closing"><div className="c-container"><p className="c-kicker">LESS ADMIN. MORE LIVING.</p><h2>Make space for the good stuff.</h2><p>Shared life feels lighter when the money is clear.</p><a className="c-button c-button--white" href={signup}>Start your 7-day free trial</a></div></section>;
}

function Footer() {
  return <footer className="c-footer"><div className="c-container"><div className="c-footer__main"><div><a className="c-logo" href="#top">commune<span>.</span></a><p>For people who do life together.</p></div><nav aria-label="Footer navigation"><div><strong>Explore</strong><a href="#how-it-works">How it works</a><a href="#use-cases">Who it is for</a><a href="#features">Features</a><a href="#pricing">Pricing</a></div><div><strong>Get started</strong><a href={signup}>Start free trial</a><a href={login}>Log in</a><a href="mailto:support@ourcommune.io">Contact</a></div><div><strong>Information</strong><a href="#questions">FAQs</a><a href="https://app.ourcommune.io/privacy">Privacy</a><a href="https://app.ourcommune.io/terms">Terms</a></div></nav></div><div className="c-footer__bottom"><span>© {new Date().getFullYear()} Commune</span><span>Shared life, clearer.</span></div></div></footer>;
}

export default function CombinedMock() {
  return <><Header /><main><Hero /><Process /><UseCases /><Features /><Pricing /><Faq /><Closing /></main><Footer /></>;
}

export { Hero, Process, UseCases, Pricing, Faq, Footer, Closing };
