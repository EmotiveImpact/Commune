import { useEffect, useState } from 'react';
import { BrandWordmark } from './BrandWordmark';
import { SiteMenu, useSiteMenu } from './SiteMenu';

const heroScenes = [
  { image: '/company-hero-home.jpg', label: 'Home' },
  { image: '/company-hero-trip.jpg', label: 'Trips' },
  { image: '/company-hero-work.jpg', label: 'Work' },
  { image: '/hero-life.webp', label: 'Together' },
];

const signup = 'https://app.ourcommune.io/signup';
const lives = [
  { label: 'At home', title: 'A place to call ours.', body: 'The rent, the rota, the Wi-Fi details. Keep the everyday things together, so home feels easier for everyone.', photo: '/lifestyle-home-muted.jpg', alt: 'Four friends sharing a colourful lunch in their sunny garden', caption: 'The everyday. Made better.', costs: ['Rent & bills', 'Chores & rotas', 'House essentials'] },
  { label: 'At work', title: 'Good things take a team.', body: 'A studio, a workspace, a project in the making. Share the costs, divide the jobs and keep the practical details close.', photo: '/lifestyle-work-muted.jpg', alt: 'Friends working together in a sunny pottery and design studio', caption: 'A little space to create.', costs: ['Shared costs', 'Team responsibilities', 'Space information'] },
  { label: 'On a trip', title: 'More of the adventure.', body: 'The booking details, the shared budget, who’s sorting what. Give your trip one home before you even leave.', photo: '/lifestyle-trip-muted.jpg', alt: 'Four friends enjoying a walk above a bright blue sea', caption: 'Go somewhere. Together.', costs: ['Travel costs', 'Shared checklists', 'Stay details'] },
];
const plans = [
  { name: 'Standard', monthly: '4.99', annual: '49.99', detail: 'For your shared everyday.', groups: '1 group', people: 'Up to 8 members', photo: '/unique-standard.jpg', alt: 'Two housemates putting together a side table at home' },
  { name: 'Pro', monthly: '9.99', annual: '99.99', detail: 'For all the parts of your life.', groups: '3 groups', people: 'Up to 15 members per group', photo: '/unique-pro.jpg', alt: 'Three friends setting off on a train trip together' },
  { name: 'Landlord', monthly: '29.99', annual: '299.99', detail: 'For the shared spaces you look after.', groups: 'Up to 10 groups', people: 'Up to 20 members per group', photo: '/company-plan-landlord.jpg', alt: 'Neighbours talking together outside their shared homes' },
];
const steps = [
  { title: 'See your group at a glance.', body: 'Your people, pinned updates and recent activity. A shared starting point for the day.' },
  { title: 'Give the jobs a home.', body: 'Recurring chores and shared checklists, with a person responsible. Try ticking off a job in the preview.' },
  { title: 'Keep the useful details close.', body: 'Wi-Fi, access instructions and house information. Open a detail in the preview to see how it fits together.' },
];
const demoJobs = [
  { title: 'Take the recycling out', person: 1, schedule: 'Every Thursday' },
  { title: 'Water the plants', person: 2, schedule: 'Every Monday' },
  { title: 'Clean the kitchen', person: 3, schedule: 'Every Friday' },
];
const questions = [
  ['Is Commune just for shared expenses?', 'Money is one part of it. Your group also has a place for chores and responsibilities, shared information and pinned updates, so everyone knows what needs doing and where to find the details.'],
  ['Does Commune move our money?', 'You pay each other using the method you already prefer. Commune keeps track: members mark their shares as paid, and a group admin can confirm them.'],
  ['Can we split costs differently?', 'Yes. Split an expense equally, by percentage, or with custom amounts. Include the people involved in that expense.'],
  ['How does the free trial work?', 'You get 7 days to try Commune on the Standard plan. After the trial, choose a paid plan that fits your group. There is no free tier.'],
];
const journal = [
  { category: 'Home', title: 'A shared home. A little less guesswork.', description: 'Simple agreements that make everyday costs easier to share.', image: '/unique-journal-home.jpg', alt: 'Housemates sharing the Saturday morning kitchen routine', paragraphs: ['Start with a quick conversation about what belongs to the household. Rent and utilities might be shared by everyone; groceries and subscriptions might not be. Agree on the people involved before adding a cost.', 'Choose the split together. Equal shares can suit some expenses, while percentages or custom amounts may fit others. Make the amount and due date visible so nobody has to piece things together from messages.', 'Check in when things change. A new housemate, a different bill or a few weeks away can be a good reason to revisit your arrangement.'] },
  { category: 'Work', title: 'Good work starts on the same page.', description: 'Keep shared studio costs clear, from supplies to the space itself.', image: '/unique-journal-work.jpg', alt: 'Two makers cleaning up their shared workshop', paragraphs: ['Separate the costs of the space from the costs of a project. Everyone might contribute to studio rent, but only a few people may need the materials for a particular job.', 'Add a short description to each expense and include the people using it. Agree on how to share the cost before someone makes the purchase.', 'Keep payment records up to date. When someone has paid, mark and confirm their share so the group can spend less time checking and more time creating.'] },
  { category: 'Trips', title: 'A little planning for a better trip.', description: 'Keep bookings, meals and little extras clear for everyone.', image: '/unique-journal-trip.jpg', alt: 'Friends looking across the bay from a ferry', paragraphs: ['Before you go, talk through the costs you expect to share: accommodation, transport and group activities. Leave room for people to opt into the things they actually want to do.', 'Keep a record as you go. A meal or booking is easier to understand while everyone remembers who was involved. Choose a split that reflects the people sharing that expense.', 'Make time for a final check after the trip. Review the remaining shares together, pay each other using your usual method and update the record when those payments are confirmed.'] },
];
const people = ['Alex', 'Jordan', 'Taylor', 'Casey'];

function LinkButton({ children, href = signup, variant = '' }: { children: string; href?: string; variant?: string }) {
  return <a className={`l-button ${variant && `l-button--${variant}`}`} href={href}>{children}</a>;
}
function Avatar({ index, named = false }: { index: number; named?: boolean }) {
  return <img className={`l-avatar l-avatar--${index}`} src={`/avatars/${people[index].toLowerCase()}.jpg`} alt={named ? people[index] : ''} loading="lazy" width="32" height="32" />;
}
function Avatars() {
  return <div className="l-avatars" aria-label="Four group members">{people.map((person, i) => <Avatar key={person} index={i} named />)}</div>;
}
export default function EditorialMock() {
  const [life, setLife] = useState(0);
  const [step, setStep] = useState(0);
  const [completedJobs, setCompletedJobs] = useState<string[]>([]);
  const [yearly, setYearly] = useState(false);
  const phoneMenu = useSiteMenu();
  const [heroScene, setHeroScene] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(preference.matches);
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (reducedMotion) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setHeroScene(current => (current + 1) % heroScenes.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [reducedMotion]);
  const current = lives[life];
  return <div className="l-site" id="top">
    <SiteMenu {...phoneMenu} tone="photo" />
    <section className="l-hero" aria-labelledby="hero-title">
      <div className="l-hero__scenes" aria-hidden="true">{heroScenes.map((scene, i) => <img key={scene.image} className={`l-hero__image l-hero__image--${scene.label.toLowerCase()} ${heroScene === i ? 'is-active' : ''}`} src={scene.image} alt="" fetchPriority={i === 0 ? 'high' : undefined} loading={i < 2 ? 'eager' : 'lazy'} />)}</div>
      <header className="l-header l-container">
        <BrandWordmark href="#top" />
        <nav aria-label="Main navigation">
          <a href="/how-it-works.html">How it works</a>
          <a href="/life-together.html">Life together</a>
          <a href="/pricing.html">Pricing</a>
          <a href="/journal.html">Journal</a>
          <a href="/about.html">About</a>
          <a className="l-login" href="https://app.ourcommune.io/login">Log in</a>
          <LinkButton variant="white">Start free trial</LinkButton>
        </nav>
      </header>
      <div className="l-hero__body l-container">
        <h1 id="hero-title">For people who<br />do life together.</h1>
        <p>Shared costs, everyday jobs and the details everyone needs. Bring it all together, so no one has to hold it all.</p>
        <div className="l-hero__actions"><LinkButton variant="white">Start your free trial</LinkButton><a className="l-text-link" href="#features">See how it works</a></div>
      </div>
    </section>

    <main>
      <section className="l-features l-section" id="features" aria-labelledby="features-title">
        <div className="l-container">
          <div className="l-section-heading"><div><span className="l-eyebrow">Meet your shared headspace</span><h2 id="features-title">All the shared stuff.<br />In <mark>one clear place.</mark></h2></div><p>Less working it out.<br />More getting on with living.</p></div>
          <div className="l-feature-grid l-feature-grid--pillars">
            <article className="l-feature"><span className="l-card-number">01 / SHARED MONEY</span><h3>Know where you stand.</h3><div className="l-pillar-preview l-money-glance"><span className="l-mini-label">MAPLE HOUSE · THIS MONTH</span><div className="l-money-glance__total"><span>Your share</span><strong>£300.00</strong></div><div className="l-money-glance__person"><Avatar index={0} /><span>Alex <small>(you)</small></span><span className="l-status l-status--paid">Paid</span></div><div className="l-mini-progress"><span>2 of 4 shares paid</span><Avatars /></div><div className="l-progress"><span /></div></div><p>Split fairly. See what’s due and what’s paid.</p></article>
            <article className="l-feature"><span className="l-card-number">02 / SHARED RESPONSIBILITY</span><h3>Everyone has their part.</h3><div className="l-pillar-preview"><div className="l-pillar-preview__heading"><span className="l-mini-label">THIS WEEK AT HOME</span><span className="l-status">3 jobs</span></div>{[{ task: 'Take the recycling out', when: 'Today', member: 1 }, { task: 'Water the plants', when: 'Tomorrow', member: 2 }, { task: 'Clean the kitchen', when: 'Friday', member: 3 }].map(job => <div className="l-task-row" key={job.task}><span className="l-task-ring" aria-hidden="true" /><div><strong>{job.task}</strong><small>{people[job.member]} · {job.when}</small></div><Avatar index={job.member} /></div>)}</div><p>Give the everyday jobs a name and a next turn.</p></article>
            <article className="l-feature"><span className="l-card-number">03 / SHARED DETAILS</span><h3>Find it without asking.</h3><div className="l-pillar-preview"><span className="l-mini-label">OUR HOUSE ESSENTIALS</span><div className="l-essential-row"><span>Wi-Fi network</span><strong>Maple House</strong></div><div className="l-essential-row"><span>Recycling collection</span><strong>Friday morning</strong></div><div className="l-pinned-note"><Avatar index={0} /><div><span>Pinned by Alex</span><p>Spare keys are with Jordan if you need them.</p></div></div></div><p>Keep useful information and group updates close.</p></article>
          </div>
          <p className="l-preview-note">A little look inside Commune. Illustrative group, tasks and expenses.</p>
        </div>
      </section>

      <section className="l-real-life l-section" aria-labelledby="real-life-title">
        <div className="l-container">
          <div className="l-section-heading"><div><span className="l-eyebrow">For the everyday and the unexpected</span><h2 id="real-life-title">More of the moments<br />you share.</h2></div><p>From the usual Tuesday dinner<br />to plans somewhere new.</p></div>
          <div className="l-real-life__grid">
            <figure><img src="/scene-warm-table.jpg" alt="Two friends making dinner together at home" loading="lazy" /><figcaption><h3>At the table.</h3><p>Who’s cooking, what’s needed, how you share the shop.</p></figcaption></figure>
            <figure><img src="/work-together.png" alt="People working together around a table" loading="lazy" /><figcaption><h3>Making things happen.</h3><p>The space, the supplies and everyone doing their part.</p></figcaption></figure>
          </div>
        </div>
      </section>

      <section className="l-product l-section" id="how-it-works" aria-labelledby="product-title">
        <div className="l-container l-product__layout">
          <div className="l-product__copy"><span className="l-eyebrow">A home for the everyday</span><h2 id="product-title">Your people.<br />Your place.<br /><span>All together.</span></h2><p>Who’s doing what, what’s changed and where to find it. The little things that help your group run smoothly.</p>
            <div className="l-step-list" aria-label="Explore how Commune works">{steps.map((item, i) => <button key={item.title} className={step === i ? 'is-active' : ''} aria-pressed={step === i} aria-controls="group-preview" onClick={() => setStep(i)}><span className="l-step-number">0{i + 1}</span><span><strong>{item.title}</strong><span>{item.body}</span></span></button>)}</div>
            <div className="l-product__action"><LinkButton variant="white">Start your free trial</LinkButton><span>Try Standard for 7 days.</span></div>
          </div>
          <div className="l-product__visual"><div className="l-app-window l-hub-demo" id="group-preview" role="region" aria-label={steps[step].title}>
            <div className="l-app-window__nav"><span className="l-wordmark">commune.</span><Avatar index={0} named /></div>
            <div className="l-demo-tabs" aria-label="Preview screens">{['Group hub', 'Responsibilities', 'Essentials'].map((label, i) => <button key={label} aria-pressed={step === i} aria-controls="group-preview" onClick={() => setStep(i)}>{label}</button>)}</div>
            <div className="l-hub-demo__body">
              {step === 0 && <>
                <div className="l-hub-cover"><img src="/unique-feature.jpg" alt="Housemates preparing food together in their kitchen" loading="lazy" /><div><span>YOUR SHARED HOME</span><h3>Maple House</h3></div></div>
                <div className="l-hub-members"><Avatars /><span>Alex, Jordan, Taylor & Casey</span></div>
                <div className="l-hub-update"><span className="l-mini-label">PINNED BY ALEX</span><p>Friends coming over on Saturday. Let’s get the house ready together.</p></div>
                <div className="l-hub-section-title"><h4>Around the house</h4><span>Latest activity</span></div>
                <div className="l-hub-activity"><Avatar index={1} /><p><strong>Jordan joined Maple House</strong><span>Your people, all in one place.</span></p></div>
                <div className="l-hub-activity"><Avatar index={0} /><p><strong>Alex updated the house information</strong><span>The spare key details are saved.</span></p></div>
              </>}
              {step === 1 && <>
                <span className="l-mini-label">MAPLE HOUSE / RESPONSIBILITIES</span><h3 className="l-demo-title">A little team effort.</h3><p className="l-demo-description">The regular jobs, shared between your people.</p>
                <div className="l-demo-progress"><span aria-live="polite">{completedJobs.length} of {demoJobs.length} done this week</span><div className="l-progress"><span style={{width: `${completedJobs.length / demoJobs.length * 100}%`}} /></div></div>
                <div className="l-demo-checklist">{demoJobs.map(job => <label className={`l-demo-job ${completedJobs.includes(job.title) ? 'is-done' : ''}`} key={job.title}><input type="checkbox" checked={completedJobs.includes(job.title)} onChange={event => setCompletedJobs(current => event.target.checked ? [...current, job.title] : current.filter(title => title !== job.title))} /><span><strong>{job.title}</strong><small>{people[job.person]} · {job.schedule}</small></span><Avatar index={job.person} /></label>)}</div>
                <div className="l-hub-update"><span className="l-mini-label">SHARED CHECKLISTS, TOO</span><p>Moving in, getting ready for a trip or closing up the studio. Keep each step with the people doing it.</p></div>
              </>}
              {step === 2 && <>
                <span className="l-mini-label">MAPLE HOUSE / ESSENTIALS</span><h3 className="l-demo-title">Saved for everyone.</h3><p className="l-demo-description">The answers you shouldn’t have to ask for twice.</p>
                <div className="l-demo-essentials">
                  <details open><summary>Wi-Fi & access<span aria-hidden="true">+</span></summary><div><span>Network</span><strong>Maple House</strong><p>Spare keys are with Jordan. Let them know before you pop round.</p></div></details>
                  <details><summary>House information<span aria-hidden="true">+</span></summary><div><span>Recycling collection</span><strong>Friday morning</strong><p>Put the recycling out on Thursday evening. The bins live beside the garden gate.</p></div></details>
                  <details><summary>Our shared agreements<span aria-hidden="true">+</span></summary><div><p>Leave the kitchen ready for the next person. Give everyone a heads-up when friends are staying.</p></div></details>
                </div>
                <div className="l-hub-members"><Avatars /><span>One place for the whole house.</span></div>
              </>}
            </div>
          </div><p className="l-product__caption">Interactive design preview · Illustrative group and activity.</p></div>
        </div>
      </section>

      <section className="l-lives l-section" id="shared-life" aria-labelledby="lives-title"><div className="l-container">
        <div className="l-section-heading"><div><span className="l-eyebrow">However you do life</span><h2 id="lives-title">Built for your kind<br />of <mark>together.</mark></h2></div><LinkButton href="#plans" variant="white">Find your fit</LinkButton></div>
        <div className="l-life-grid" id="life-panel">
          <figure className={`l-life-photo l-life-photo--${life}`}><img src={current.photo} alt={current.alt} loading="lazy" /><figcaption><span>{current.label}</span><strong>{current.caption}</strong></figcaption></figure>
          <article className="l-life-story" aria-live="polite"><span className="l-mini-label">LIFE, WITH YOUR PEOPLE</span><h3>{current.title}</h3><p>{current.body}</p><div className="l-life-costs">{current.costs.map(cost => <span key={cost}>{cost}</span>)}</div><a className="l-text-link" href="#how-it-works">See how Commune works</a></article>
          <div className="l-life-side"><div className="l-life-fact"><span className="l-mini-label">YOUR GROUP, AT A GLANCE</span><strong>What’s due.<br />Who’s doing it.</strong><p>Money, responsibilities and the details that keep everyone on the same page.</p></div><div className="l-life-selector"><h3>Where’s your together?</h3><div aria-label="Choose a way to use Commune">{lives.map((item, i) => <button key={item.label} aria-pressed={life === i} aria-controls="life-panel" onClick={() => setLife(i)}>{item.label}</button>)}</div><p>One app for all of it.</p></div></div>
        </div>
      </div></section>

      <section className="l-moment" aria-labelledby="moment-title"><div className="l-moment__frame l-container"><img src="/scene-blue-day.jpg" alt="Friends enjoying a clear day in the park with their dog" loading="lazy" /><div className="l-moment__content"><div><span className="l-eyebrow">All the ways you share a life.</span><h2 id="moment-title">The best bits are shared.</h2></div><p>When everyone knows their part, there’s more room for this.<br />The everyday. The unexpected. The time together.</p></div></div></section>

      <section className="l-pricing l-section" id="plans" aria-labelledby="plans-title"><div className="l-container">
        <div className="l-section-heading"><div><span className="l-eyebrow">A plan for your people</span><h2 id="plans-title">A little clarity.<br />For every <mark>group.</mark></h2></div><div className="l-billing" aria-label="Billing period"><button aria-pressed={!yearly} onClick={() => setYearly(false)}>Monthly</button><button aria-pressed={yearly} onClick={() => setYearly(true)}>Yearly</button></div></div>
        <div className="l-plan-includes"><strong>Every plan brings it together.</strong><p>Shared expenses & payment tracking · Chores & responsibilities · Group essentials & updates</p><span>Choose by the number of groups and people. Use Commune at home, at work or away.</span></div>
        <div className="l-pricing-grid">{plans.map((plan, i) => <article className="l-plan" key={plan.name}>
          <div className="l-plan__image"><img src={plan.photo} alt={plan.alt} loading="lazy" /><div><span>0{i + 1}</span><h3>{plan.name}</h3></div></div>
          <div className="l-plan__body"><p>{plan.detail}</p><div className="l-price"><span>£{yearly ? plan.annual : plan.monthly}</span><small>/ {yearly ? 'year' : 'month'}</small></div><span className="l-billing-note">Billed {yearly ? 'annually' : 'monthly'}</span><ul><li>{plan.groups}</li><li>{plan.people}</li></ul><LinkButton>Start your free trial</LinkButton></div>
        </article>)}</div>
        <p className="l-pricing-note">Start with a 7-day free trial on Standard. Then choose the plan that fits.</p>
      </div></section>

      <section className="l-journal l-section" id="journal" aria-labelledby="journal-title"><div className="l-container"><div className="l-section-heading"><div><span className="l-eyebrow">The shared life journal</span><h2 id="journal-title">Notes on doing<br />life together.</h2></div><p>Ideas for the homes, workspaces<br />and adventures we share.<br /><a className="l-text-link" href="/journal.html">Explore the journal</a></p></div><div className="l-journal__grid">{journal.map(article => <article className="l-journal__card" key={article.category}><img src={article.image} alt={article.alt} loading="lazy" /><span className="l-eyebrow">{article.category}</span><h3>{article.title}</h3><p>{article.description}</p><a className="l-journal__guide" href={`/journal.html#${article.category.toLowerCase()}`}>Read the guide</a></article>)}</div></div></section>

      <section className="l-faq l-section" aria-labelledby="faq-title"><div className="l-container l-faq__layout"><div><span className="l-eyebrow">Good to know</span><h2 id="faq-title">A few things,<br />made clear.</h2></div><div className="l-faq__list">{questions.map(([question, answer]) => <details key={question}><summary>{question}<span className="l-faq__indicator" aria-hidden="true" /></summary><p>{answer}</p></details>)}</div></div></section>
    </main>

    <div className="l-ending"><img className="l-ending__photo" src="/unique-footer.jpg" alt="" loading="lazy" />
      <section className="l-final-cta" aria-labelledby="closing-title"><div className="l-container"><span className="l-eyebrow">Less admin. More living.</span><h2 id="closing-title">Make space for the good stuff.</h2><p>The costs, the jobs, the little details. A shared place for it all.<br />Start with 7 days on Standard.</p><LinkButton variant="white">Start your 7-day free trial</LinkButton></div></section>
      <footer className="l-footer"><div className="l-container l-footer__inner"><div className="l-footer__links"><div><BrandWordmark /><p>For people who do life together.</p></div><nav aria-label="Explore"><h3>Explore</h3><a href="/how-it-works.html">How it works</a><a href="/life-together.html">Life together</a><a href="/pricing.html">Pricing</a><a href="/journal.html">Journal</a><a href="/about.html">About</a></nav><nav aria-label="Get in touch"><h3>Your Commune</h3><a href="https://app.ourcommune.io/login">Log in</a><a href={signup}>Get started</a><a href="mailto:support@ourcommune.io">Contact us</a></nav></div><div className="l-footer__bottom"><span>© {new Date().getFullYear()} Commune</span><div><a href="https://app.ourcommune.io/privacy">Privacy policy</a><a href="https://app.ourcommune.io/terms">Terms of service</a></div></div></div></footer>
    </div>
  </div>;
}
