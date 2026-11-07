import { useRef, useState, type ReactNode } from 'react';
import { BrandWordmark } from '../BrandWordmark';
import { SiteMenu, useSiteMenu } from './SiteMenu';
import { Avatar, Faq, LinkButton, helps, people, plans } from './TogetherMock';

export type GreenPage = 'how' | 'life' | 'pricing' | 'about';

const signup = 'https://app.ourcommune.io/signup';
const nav: Array<[string, string, GreenPage | 'journal']> = [
  ['How it works', '/how-it-works.html', 'how'],
  ['Life together', '/life-together.html', 'life'],
  ['Pricing', '/pricing.html', 'pricing'],
  ['Journal', '/journal.html', 'journal'],
  ['About', '/about.html', 'about'],
];

/** The inset photo card every page opens with, the homepage hero's shape and type. */
function Hero({ page, eyebrow, title, copy, photo, pos = 'center', alt, children }: { page: GreenPage; eyebrow: string; title: ReactNode; copy: string; photo: string; pos?: string; alt: string; children?: ReactNode }) {
  const [menu, setMenu] = useState(false);
  return <section className="l-hero g-hero" aria-labelledby="page-title">
    <div className="l-hero__scenes"><img className="l-hero__image is-active" src={photo} alt={alt} style={{ objectPosition: pos }} fetchPriority="high" /></div>
    <header className="l-header l-container">
      <BrandWordmark href="/" />
      <nav id="main-navigation" className={menu ? 'is-open' : ''} aria-label="Main navigation">
        {nav.map(([label, href, key]) => <a key={href} href={href} aria-current={key === page ? 'page' : undefined} onClick={() => setMenu(false)}>{label}</a>)}
        <a className="l-login" href="https://app.ourcommune.io/login">Log in</a>
        <LinkButton variant="white">Start free trial</LinkButton>
      </nav>
      <button className="l-menu" aria-expanded={menu} aria-controls="main-navigation" onClick={() => setMenu(!menu)}>{menu ? 'Close' : 'Menu'}</button>
    </header>
    <div className="l-hero__body l-container">
      <span className="g-hero__eyebrow">{eyebrow}</span>
      <h1 id="page-title">{title}</h1>
      <p>{copy}</p>
      <div className="l-hero__actions">{children ?? <LinkButton variant="white">Start your free trial</LinkButton>}</div>
    </div>
  </section>;
}

function Head({ eyebrow, title, copy, id }: { eyebrow: string; title: ReactNode; copy?: ReactNode; id: string }) {
  return <div className="g-head"><span className="l-eyebrow">{eyebrow}</span><h2 id={id}>{title}</h2>{copy ? <p>{copy}</p> : null}</div>;
}

/** The closing call and footer, one rounded card as on the homepage. */
function End({ title = 'Make space for the good stuff.', copy = 'The costs, the jobs, the little details. A shared place for it all.' }: { title?: string; copy?: string }) {
  return <div className="t-end"><div className="l-ending t-end__card"><img className="l-ending__photo" src="/unique-footer.jpg" alt="" loading="lazy" />
    <section className="l-final-cta" aria-labelledby="closing-title"><div className="l-container"><span className="l-eyebrow">Less admin. More living.</span><h2 id="closing-title">{title}</h2><p>{copy}{' '}<br />Start with 7 days on Standard.</p><LinkButton variant="white">Start your 7-day free trial</LinkButton></div></section>
    <footer className="l-footer"><div className="l-container l-footer__inner"><div className="l-footer__links"><div><BrandWordmark href="/" /><p>For people who do life together.</p></div><nav aria-label="Explore"><h3>Explore</h3>{nav.map(([label, href]) => <a key={href} href={href}>{label}</a>)}</nav><nav aria-label="Get in touch"><h3>Your Commune</h3><a href="https://app.ourcommune.io/login">Log in</a><a href={signup}>Get started</a><a href="mailto:support@ourcommune.io">Contact us</a></nav></div><div className="l-footer__bottom"><span>© {new Date().getFullYear()} Commune</span><div><a href="https://app.ourcommune.io/privacy">Privacy policy</a><a href="https://app.ourcommune.io/terms">Terms of service</a></div></div></div></footer>
  </div></div>;
}

/* How it works ------------------------------------------------------------ */

const steps = [
  { n: '01', title: 'Bring your people in.', copy: 'Start a commune for your home, studio or trip. Send one link, show a QR code or stick one on the fridge.', photo: '/t/g-real-backstep.jpg', alt: 'A new housemate with a cup of tea on the back step' },
  { n: '02', title: 'Add it once. Split it fairly.', copy: 'The rent, the food shop or the taxi home. Split equally, by percentage or with your own amounts.', photo: '/t/g-real-hallway.jpg', alt: 'Two housemates in the hallway, one back from the shops' },
  { n: '03', title: 'Pay how you already pay.', copy: 'Monzo, PayPal, Revolut or a bank transfer. Tap "I\'ve paid" and the person you paid confirms it.', photo: '/t/g-new-sofa-phone.jpg', alt: 'A housemate on the sofa paying on their phone' },
  { n: '04', title: 'Share the rest of the admin.', copy: 'Jobs with a name and a next turn, the Wi-Fi password and bin day, and notes the whole house can see.', photo: '/t/g-real-washing-up.jpg', alt: 'Housemates washing up together' },
];
const rent = [{ who: 0, state: 'Paid' }, { who: 1, state: 'Paid' }, { who: 2, state: 'Due Friday' }, { who: 3, state: 'Due Friday' }];

function HowPage() {
  return <>
    <Hero page="how" eyebrow="How Commune works" title={<>The shared stuff,<br />sorted.</>} copy="One place for the money, the jobs and the details of doing life together. Here is how it fits into your week." photo="/t/g-real-hallway.jpg" pos="62% 40%" alt="Housemates in the hallway, one back from the shops">
      <LinkButton variant="white">Start your free trial</LinkButton><a className="l-text-link" href="#steps">See the steps</a>
    </Hero>
    <main>
      <section className="l-section g-card g-card--cream" id="steps" aria-labelledby="steps-title"><div className="l-container">
        <Head id="steps-title" eyebrow="Four simple steps" title="Give your shared life a home." copy="Set it up in a few minutes. Then everyone knows their part." />
        <div className="g-steps">{steps.map(s => <article className="g-step" key={s.n}><div className="g-step__photo"><img src={s.photo} alt={s.alt} loading="lazy" /></div><span className="l-card-number">{s.n}</span><h3>{s.title}</h3><p>{s.copy}</p></article>)}</div>
      </div></section>

      <section className="l-section g-card g-card--navy" aria-labelledby="example-title"><div className="l-container g-split">
        <div className="g-split__copy"><span className="l-eyebrow">A little look inside</span><h2 id="example-title">Clear enough to get on with living.</h2><p>Four housemates share a £1,200 rent. Everyone sees their £300, when it is due and who has paid. Nobody has to chase.</p><p className="g-small">An illustrative group. Your commune chooses who is in each cost and how it is split.</p><div className="g-actions"><LinkButton variant="white" href="/pricing.html">Find your plan</LinkButton></div></div>
        <div className="g-panel" role="img" aria-label="Monthly rent of £1,200 split equally between Alex, Jordan, Taylor and Casey; Alex and Jordan have paid">
          <div className="g-panel__top"><span>MAPLE HOUSE</span><span>RENT · OCTOBER</span></div>
          <strong className="g-panel__total">£1,200.00</strong>
          <div className="g-panel__share"><span>4 people · equal split</span><b>£300.00 each</b></div>
          {rent.map(r => <div className="g-panel__row" key={r.who}><Avatar index={r.who} /><span>{people[r.who]}{r.who === 0 ? ' (you)' : ''}</span><span>£300.00</span><em className={r.state === 'Paid' ? 'is-paid' : ''}>{r.state}</em></div>)}
          <div className="g-panel__bar"><span style={{ width: '50%' }} /></div>
          <small className="g-panel__foot">2 of 4 shares paid</small>
        </div>
      </div></section>

      <section className="l-section g-card g-card--green" aria-labelledby="money-title"><div className="l-container g-split g-split--flip">
        <div className="g-split__copy"><span className="l-eyebrow">Your money stays with you</span><h2 id="money-title">Commune never moves the money.</h2><p>Add your Monzo, PayPal, Revolut or bank details once. Your people pay you the way they already do, then tap "I've paid". You confirm it, and the balance clears for everyone.</p></div>
        <div className="g-pings" aria-hidden="true">
          <div className="t-ping"><span className="t-ping__app"><b>commune.</b><small>Maple House · now</small></span><div className="t-ping__body"><Avatar index={1} /><div><strong>Pay Jordan £21.00</strong><small>Jordan takes Monzo or a bank transfer</small></div></div></div>
          <div className="t-ping"><span className="t-ping__app"><b>commune.</b><small>Maple House · 2 min</small></span><div className="t-ping__body"><Avatar index={0} /><div><strong>Alex paid you £21.00</strong><small>Tap to confirm you received it</small></div></div></div>
          <div className="t-ping"><span className="t-ping__app"><b>commune.</b><small>Maple House · now</small></span><div className="t-ping__body"><Avatar index={1} /><div><strong>Jordan confirmed your £21.00</strong><small>Energy, October · all square</small></div></div></div>
        </div>
      </div></section>


      <section className="l-faq l-section" aria-labelledby="faq-title"><div className="l-container l-faq__layout"><div><span className="l-eyebrow">Good to know</span><h2 id="faq-title">How it works, made clear.</h2></div><Faq items={[
        ['Does everyone need the app?', 'Everyone you invite gets their own login, on the web or on their phone. They see the same balance, jobs and details as you.'],
        ['How do people join?', 'Send a link, show a QR code from your phone, or print a sticker for the fridge. You choose whether new people need approving first.'],
        ['Can we split costs differently?', 'Yes. Split an expense equally, by percentage or with custom amounts, and include only the people involved in it.'],
        ['What if someone pays the wrong amount?', 'Bills can be corrected or voided, and Commune keeps a record of what changed, who changed it and why.'],
      ]} /></div></section>
    </main>
    <End />
  </>;
}

/* Life together ----------------------------------------------------------- */

const lives = [
  { tone: 'cream', eyebrow: 'At home', title: 'A home for the everyday.', copy: 'Rent and bills, the cleaning rota and the Wi-Fi details. Everyone sees their costs, their jobs and the house details, so home feels easier for everyone.', photo: '/lifestyle-home.jpg', alt: 'Four friends sharing lunch in a sunny garden', tags: ['Rent and bills', 'Chores and rotas', 'House details'], story: ['/s/crisps', 'Watch The missing crisps'] },
  { tone: 'navy', eyebrow: 'Couples', title: 'Fair, without keeping score.', copy: 'Moving in together brings rent, bills and a weekly shop. Split them the way you both agreed, by halves or by what each of you earns, and get back to the good bits.', photo: '/t/g-real-sofa-couple.jpg', alt: 'A couple laughing at a phone on the sofa', tags: ['Shared bills', 'Custom splits', 'Saving up'], story: ['/s/movein', 'Watch Moving day'] },
  { tone: 'green', eyebrow: 'At work', title: 'Room to make things together.', copy: 'A studio, a workshop, a side project. Share the rent and the supplies, give the regular jobs an owner and keep the space details where everyone can find them.', photo: '/lifestyle-work.jpg', alt: 'Three makers laughing in a shared pottery studio', tags: ['Shared costs', 'Team jobs', 'Space details'], story: ['/s/lunch', 'Watch The team lunch'] },
  { tone: 'sky', eyebrow: 'On a trip', title: 'More of the trip. Less of the tally.', copy: 'The villa, the train and the dinners, added as they happen. Everyone sees their share before you go and while you are away, so the last night is not spent doing maths.', photo: '/lifestyle-trip.jpg', alt: 'Four friends walking a coast path above a blue sea', tags: ['Travel costs', 'Shared checklists', 'Stay details'], story: ['/s/villa', 'Watch The villa'] },
  { tone: 'white', eyebrow: 'Homes you look after', title: 'Every house, its own commune.', copy: 'For landlords and anyone looking after several shared homes. Keep each house, its people and its details separate. The Collective plan covers up to 10 communes with 20 people in each.', photo: '/t/g-new-landlady.jpg', alt: 'A landlady at the door of a shared house', tags: ['Up to 10 communes', 'House details', 'Bills for each home'], story: ['/pricing.html', 'See the Collective plan'] },
];

function LifePage() {
  return <>
    <Hero page="life" eyebrow="Life together" title={<>For all the ways<br />you share.</>} copy="Housemates, couples, studios, trips and the homes you look after. Wherever people share, Commune keeps it clear." photo="/scene-city-friends.jpg" pos="center 45%" alt="Friends together in the city">
      <LinkButton variant="white">Start your free trial</LinkButton><a className="l-text-link" href="#ways">Explore the ways</a>
    </Hero>
    <main id="ways">
      {lives.map((l, i) => <section className={`l-section g-card g-card--${l.tone}`} key={l.eyebrow} aria-labelledby={`life-${i}`}><div className={`l-container g-life ${i % 2 ? 'g-life--flip' : ''}`}>
        <div className="g-life__photo"><img src={l.photo} alt={l.alt} loading={i ? 'lazy' : 'eager'} /></div>
        <div className="g-life__copy"><span className="l-card-number">0{i + 1} / {l.eyebrow.toUpperCase()}</span><h2 id={`life-${i}`}>{l.title}</h2><p>{l.copy}</p><ul className="g-tags">{l.tags.map(t => <li key={t}>{t}</li>)}</ul><a className="g-link" href={l.story[0]}>{l.story[1]}</a></div>
      </div></section>)}

      <section className="l-section g-card g-card--cream" aria-labelledby="more-title"><div className="l-container">
        <Head id="more-title" eyebrow="And everything in between" title="However you do life together." copy="A few more of the ways people use Commune." />
        <div className="g-grid">{helps.slice(0, 8).map(h => <article className="g-tile" key={h.title}><div className="g-tile__photo"><img src={h.photo} alt={h.alt} loading="lazy" style={{ objectPosition: h.pos || 'center' }} /></div><span className="l-card-number">{h.group.toUpperCase()}</span><h3>{h.title}</h3><p>{h.body}</p></article>)}</div>
      </div></section>
    </main>
    <End title="Wherever life takes your people." copy="Bring the practical things together, and make more room for the moments themselves." />
  </>;
}

/* Pricing ----------------------------------------------------------------- */

const compare: Array<[string, string, string, string]> = [
  ['Communes', '1', '3', 'Up to 10'],
  ['People in each', 'Up to 8', 'Up to 15', 'Up to 20'],
  ['Shared costs and splits', 'yes', 'yes', 'yes'],
  ['Pay links and "I\'ve paid"', 'yes', 'yes', 'yes'],
  ['Jobs, turns and reminders', 'yes', 'yes', 'yes'],
  ['House details and pinned notes', 'yes', 'yes', 'yes'],
  ['Join by link or QR code', 'yes', 'yes', 'yes'],
  ['Phone app and web', 'yes', 'yes', 'yes'],
];

function PricingPage() {
  const [yearly, setYearly] = useState(false);
  const plansRef = useRef<HTMLDivElement>(null);
  const [planAt, setPlanAt] = useState(0);
  const planScroll = () => { const r = plansRef.current; const c = r?.children[0] as HTMLElement | undefined; if (!r || !c) return; setPlanAt(Math.max(0, Math.min(2, Math.round(r.scrollLeft / (c.offsetWidth + 12))))); };
  const planGo = (i: number) => { const r = plansRef.current; const c = r?.children[i] as HTMLElement | undefined; if (!r || !c) return; r.scrollTo({ left: c.offsetLeft - r.offsetLeft - (r.clientWidth - c.offsetWidth) / 2, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); setPlanAt(i); };
  return <>
    <Hero page="pricing" eyebrow="A plan for your people" title={<>Clarity that fits<br />your group.</>} copy="Start with 7 days on Standard. Then choose the plan for the people and places you share. There is no free plan, and no catch." photo="/t/g-real-train.jpg" pos="center 45%" alt="Friends on a train">
      <LinkButton variant="white">Start your free trial</LinkButton><a className="l-text-link" href="#plans">Compare plans</a>
    </Hero>
    <main>
      <section className="l-section t-pricing g-pricing" id="plans" aria-labelledby="plans-title"><div className="l-container">
        <div className="l-section-heading"><div><span className="l-eyebrow">Simple, clear plans</span><h2 id="plans-title">Find your fit.</h2></div><div className="l-billing" aria-label="Billing period"><button aria-pressed={!yearly} onClick={() => setYearly(false)}>Monthly</button><button aria-pressed={yearly} onClick={() => setYearly(true)}>Yearly</button></div></div>
        <div className="t-plan-pick" role="tablist" aria-label="Choose a plan">{plans.map((plan, i) => <button key={plan.name} role="tab" aria-selected={planAt === i} onClick={() => planGo(i)}>{plan.name}</button>)}<span className="t-plan-pick__pill" style={{ transform: `translateX(${planAt * 100}%)` }} aria-hidden="true" /></div>
        <div className="t-plans g-plans" ref={plansRef} onScroll={planScroll}>{plans.map((plan, i) => <article className={`t-plan ${i === 1 ? 't-plan--navy' : ''} ${planAt === i ? 'is-at' : ''}`} key={plan.name}>
          <div className="t-plan__top"><h3>{plan.name}</h3><p>{plan.detail}</p></div>
          <div className="t-plan__price"><span>£{yearly ? plan.annual : plan.monthly}</span><small>/ {yearly ? 'year' : 'month'}</small></div>
          <span className="t-plan__note">Billed {yearly ? 'yearly' : 'monthly'}</span>
          <ul><li><b>{plan.groups}</b></li><li><b>{plan.people}</b></li><li>Shared costs and who's paid</li><li>Jobs, turns and checklists</li><li>House details and pinned notes</li></ul>
          <LinkButton variant={i === 1 ? 'white' : ''}>Start your free trial</LinkButton>
        </article>)}</div>
        <p className="t-plans__line">Every plan starts with a 7-day free trial. Commune records what you pay each other and never moves your money.</p>
      </div></section>

      <section className="l-section g-card g-card--white" aria-labelledby="compare-title"><div className="l-container">
        <Head id="compare-title" eyebrow="Every plan, side by side" title="The same Commune. More room." copy="Every plan has everything. You choose by how many communes and people you need." />
        <div className="g-table" role="table" aria-label="Compare plans">
          <div className="g-table__row g-table__head" role="row"><span role="columnheader" />{plans.map(p => <span role="columnheader" key={p.name}>{p.name}<small>£{yearly ? p.annual : p.monthly} / {yearly ? 'year' : 'month'}</small></span>)}</div>
          {compare.map(([label, ...cells]) => <div className="g-table__row" role="row" key={label}><span role="rowheader">{label}</span>{cells.map((c, i) => <span role="cell" key={i}>{c === 'yes' ? <i className="g-tick" aria-label="Included" /> : c}</span>)}</div>)}
        </div>
      </div></section>

      <section className="l-faq l-section" aria-labelledby="faq-title"><div className="l-container l-faq__layout"><div><span className="l-eyebrow">Good to know</span><h2 id="faq-title">Questions, answered.</h2></div><Faq items={[
        ['What happens after the 7 days?', 'You choose the plan that fits your group. If you do nothing, nothing is charged and your commune waits for you.'],
        ['Does everyone in the group pay?', 'No. One person holds the plan for the commune, and everyone they invite joins free.'],
        ['Can we change plans later?', 'Yes. Move up when you add another commune, or down when you need less. The change applies from your next bill.'],
        ['Does Commune handle our payments?', 'No. You pay each other the way you already do, mark your share as paid, and the person you paid confirms it.'],
        ['What does Collective include?', 'Up to 10 communes with up to 20 people in each, with every feature of the other plans. It suits landlords and people looking after several homes.'],
      ]} /></div></section>
    </main>
    <End />
  </>;
}

/* About ------------------------------------------------------------------- */

const values = [
  { n: '01', title: 'Clarity first.', copy: 'Amounts, due dates and shares that everyone understands at a glance.' },
  { n: '02', title: 'Fair is flexible.', copy: 'Different groups need different splits. Everyone gets a way to choose what fits.' },
  { n: '03', title: 'Life comes first.', copy: 'The app should make more room for the time together, never become the main event.' },
  { n: '04', title: 'Your money is yours.', copy: 'Commune keeps the record. It never holds, moves or touches your money.' },
];

function AboutPage() {
  return <>
    <Hero page="about" eyebrow="About Commune" title={<>The life we share<br />deserves clarity.</>} copy="We make the practical side of doing life together easier to see, understand and sort out." photo="/scene-warm-table.jpg" pos="center 60%" alt="Two housemates sharing a pasta dinner at home">
      <LinkButton variant="white">Start your free trial</LinkButton><a className="l-text-link" href="#purpose">Our purpose</a>
    </Hero>
    <main>
      <section className="l-section g-card g-card--navy" id="purpose" aria-labelledby="purpose-title"><div className="l-container g-about">
        <span className="l-eyebrow">Why we exist</span>
        <h2 id="purpose-title">More room for the people. Less time untangling who paid.</h2>
        <div className="g-about__cols"><p>Homes, projects and trips are built together. But the details of who paid, who owes and what comes next end up scattered across group chats, notes and memory.</p><p>Commune brings them into one calm place. Your group chooses the split, sees each person's share and keeps a record of what has been paid. That small piece of clarity gets everyone back to the life they share.</p></div>
      </div></section>

      <section className="l-section g-card g-card--cream" aria-labelledby="values-title"><div className="l-container">
        <Head id="values-title" eyebrow="The way we think" title="Calm, useful, human." />
        <div className="g-values">{values.map(v => <article className="t-note" key={v.n}><span className="l-card-number">{v.n}</span><h3>{v.title}</h3><p>{v.copy}</p></article>)}</div>
      </div></section>

      <section className="l-moment" aria-labelledby="moment-title"><div className="l-moment__frame l-container"><img src="/scene-blue-day.jpg" alt="Friends enjoying a clear day in the park with their dog" loading="lazy" /><div className="l-moment__content"><div><span className="l-eyebrow">Wherever your together happens</span><h2 id="moment-title">For people who do life together.</h2></div><p>At home, at work or somewhere new.{' '}<br />Commune keeps the shared stuff clear.</p></div></div></section>

      <section className="l-section g-card g-card--green" aria-labelledby="contact-title"><div className="l-container g-split">
        <div className="g-split__copy"><span className="l-eyebrow">Say hello</span><h2 id="contact-title">We'd love to hear from you.</h2><p>Questions, ideas or a story about your own commune. Write to us and a real person will reply.</p><div className="g-actions"><LinkButton href="mailto:support@ourcommune.io">support@ourcommune.io</LinkButton><a className="g-link" href="/how-it-works.html">See how Commune works</a></div></div>
        <div className="g-life__photo g-contact"><img src="/t/g-new-kitchen-pair.jpg" alt="Two friends laughing over coffee at a kitchen table" loading="lazy" /></div>
      </div></section>
    </main>
    <End />
  </>;
}

export default function GreenPages({ page }: { page: GreenPage }) {
  const phoneMenu = useSiteMenu();
  return <div className="l-site g-site" id="top">
    <SiteMenu {...phoneMenu} tone="photo" home="/" current={nav.find(n => n[2] === page)?.[1]} />
    {page === 'how' ? <HowPage /> : page === 'life' ? <LifePage /> : page === 'pricing' ? <PricingPage /> : <AboutPage />}
  </div>;
}
