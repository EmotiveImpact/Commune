import { useEffect, useRef, useState, type ComponentType } from 'react';
import { Hero, Process, UseCases, Pricing, Faq, Closing } from './CombinedMock';

const signup = 'https://app.ourcommune.io/signup';
const login = 'https://app.ourcommune.io/login';

type SectionId = 'process' | 'benefits' | 'proof' | 'dashboard' | 'story' | 'steps' | 'features' | 'audiences' | 'moments' | 'month' | 'life' | 'pricing' | 'faq' | 'closing';
type Direction = 'all' | 'everyday' | 'product';
const allSections: SectionId[] = ['process', 'benefits', 'proof', 'dashboard', 'story', 'steps', 'features', 'audiences', 'moments', 'month', 'life', 'pricing', 'faq', 'closing'];
const directions: Record<Direction, { label: string; short: string; path: string; note: string; defaults: SectionId[]; order: SectionId[] }> = {
  all: { label: 'Everything together', short: 'Everything', path: '/all-together.html', note: 'All the sections. Make your own shortlist.', defaults: allSections, order: allSections },
  everyday: { label: 'Everyday life', short: 'Everyday life', path: '/everyday.html', note: 'People first, then a clear look at the product.', defaults: ['audiences', 'process', 'story', 'month', 'features', 'pricing', 'faq', 'closing'], order: ['audiences', 'process', 'benefits', 'story', 'proof', 'dashboard', 'steps', 'moments', 'month', 'features', 'life', 'pricing', 'faq', 'closing'] },
  product: { label: 'Product first', short: 'Product first', path: '/clear-view.html', note: 'Show the value quickly. Let the product do the explaining.', defaults: ['proof', 'dashboard', 'process', 'features', 'audiences', 'life', 'pricing', 'faq', 'closing'], order: ['proof', 'dashboard', 'process', 'steps', 'benefits', 'features', 'audiences', 'story', 'moments', 'month', 'life', 'pricing', 'faq', 'closing'] },
};

function Button({ children, href = signup, light = false }: { children: string; href?: string; light?: boolean }) {
  return <a className={`c-button ${light ? 'c-button--white' : 'c-button--navy'}`} href={href}>{children}</a>;
}
function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return <div className="s-heading"><p className="c-kicker">{eyebrow}</p><h2>{title}</h2>{body && <p>{body}</p>}</div>;
}

function Proof() {
  return <section className="s-proof"><div className="c-container"><div className="s-proof__heading"><p className="c-kicker">A CLEARER WAY TO SHARE</p><h2>Less working it out.<br />More getting on with it.</h2></div><div className="s-proof__grid">
    <article><span>01 / FLEXIBLE</span><h3>A fair split.</h3><p>Equal shares, percentages or custom amounts. You choose what works for your group.</p></article>
    <article><span>02 / SHARED</span><h3>The same picture.</h3><p>Everyone can see what they owe, what it covers and when it is due.</p></article>
    <article><span>03 / CLEAR</span><h3>Less chasing.</h3><p>Mark shares paid and confirm them. The latest status stays visible to everyone.</p></article>
  </div></div></section>;
}

const featureItems = [
  ['Groups that fit real life', 'Give your home, studio, project or trip its own shared space.'],
  ['Every expense, with the detail', 'Keep the amount, due date and people involved together.'],
  ['A split that makes sense', 'Share equally, by percentage, or with custom amounts.'],
  ['Know what has been paid', 'See what is settled, confirmed and still outstanding.'],
  ['Your own monthly breakdown', 'See every item behind your share of the month.'],
  ['Recurring costs, remembered', 'Keep regular expenses visible as each new period begins.'],
];
function FeatureGrid() {
  return <section className="s-features" id="features"><div className="c-container"><SectionHeading eyebrow="THE DETAILS THAT HELP" title="One place. A lot less to think about." body="Everything your group needs to stay on top of the costs you share." /><div className="s-features__grid">{featureItems.map(([title, body], i) => <article key={title}><span>{String(i + 1).padStart(2, '0')}</span><h3>{title}</h3><p>{body}</p></article>)}</div></div></section>;
}

function ShareStatement({ compact = false }: { compact?: boolean }) {
  return <div className={'s-statement' + (compact ? ' s-statement--compact' : '')}><div className="s-statement__top"><strong>Maple House</strong><span>October</span></div><p>YOUR SHARE THIS MONTH</p><strong className="s-statement__total">£386.50</strong><div className="s-statement__row"><span>Rent</span><b>£300.00</b></div><div className="s-statement__row"><span>Utilities</span><b>£52.50</b></div><div className="s-statement__row"><span>Internet</span><b>£34.00</b></div><div className="s-statement__status"><span>Paid so far</span><strong>£300.00</strong></div></div>;
}
function Month() {
  return <section className="s-month"><div className="c-container s-month__panel"><div><p className="c-kicker">CLARITY, MONTH AFTER MONTH</p><h2>Know your share.<br />Enjoy the rest.</h2><p>Rent, bills and everything in between. See exactly what makes up your month, with every expense in its place.</p><Button>Start your free trial</Button></div><div className="s-month__visual"><ShareStatement /></div></div></section>;
}

const railItems = [
  { title: 'Every bill, in one place.', body: 'Rent, utilities, internet and the little things. Know what is coming up.', photo: '/cooking.png', alt: 'Friends cooking dinner together' },
  { title: 'Split it your way.', body: 'Different people, different shares. Keep the maths clear for the whole group.', kind: 'split' },
  { title: 'Know what has been paid.', body: 'See who has settled up, without searching through the group chat.', photo: '/groceries.png', alt: 'Housemates putting away groceries' },
  { title: 'A clearer month ahead.', body: 'Each person can see their share, item by item, before it is due.', kind: 'month' },
];
function BenefitRail() {
  const rail = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ start: true, end: false });
  const update = () => { const el = rail.current; if (el) setPosition({ start: el.scrollLeft < 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 }); };
  useEffect(() => { update(); const el = rail.current; if (!el) return; const observer = new ResizeObserver(update); observer.observe(el); return () => observer.disconnect(); }, []);
  const move = (direction: number) => rail.current?.scrollBy({ left: direction * (rail.current.clientWidth * .65), behavior: 'smooth' });
  return <section className="s-benefits"><div className="c-container"><div className="s-section-top"><SectionHeading eyebrow="MORE OUT OF TOGETHER" title="The money part, made simpler." body="Keep the practical stuff clear. Get on with the good stuff." /><div className="s-rail-controls" hidden={position.start && position.end}><button onClick={() => move(-1)} disabled={position.start}>Previous</button><button onClick={() => move(1)} disabled={position.end}>Next</button></div></div><div className="s-benefits__rail" ref={rail} onScroll={update}>{railItems.map(item => <article key={item.title}><div className={'s-benefit__visual s-benefit__visual--' + (item.kind || 'photo')}>{item.photo ? <img src={item.photo} alt={item.alt} loading="lazy" /> : item.kind === 'split' ? <div className="s-split-summary"><span>Monthly rent</span><strong>£1,200.00</strong><div><span>4 people</span><b>£300.00 each</b></div><p>Equal split</p></div> : <ShareStatement compact />}</div><h3>{item.title}</h3><p>{item.body}</p><a className="s-text-link" href={signup}>Try Commune free</a></article>)}</div></div></section>;
}

function Dashboard() {
  const [group, setGroup] = useState('home');
  const data = group === 'home' ? { name: 'Maple House', period: 'OCTOBER OVERVIEW', total: '£386.50', paid: '£300.00', remaining: '£86.50', rows: [['Rent', '1 October', '£300.00', 'Paid'], ['Utilities', '12 October', '£52.50', 'Due'], ['Internet', '18 October', '£34.00', 'Due']] } : group === 'work' ? { name: 'Studio Three', period: 'OCTOBER OVERVIEW', total: '£245.00', paid: '£200.00', remaining: '£45.00', rows: [['Studio rent', '1 October', '£200.00', 'Paid'], ['Materials', '8 October', '£30.00', 'Due'], ['Coffee supplies', '12 October', '£15.00', 'Due']] } : { name: 'Lisbon weekend', period: 'TRIP OVERVIEW', total: '£218.00', paid: '£180.00', remaining: '£38.00', rows: [['Apartment', '15 October', '£180.00', 'Paid'], ['Airport transfer', '16 October', '£18.00', 'Due'], ['Dinner', '16 October', '£20.00', 'Due']] };
  return <section className="s-product" id="overview"><div className="c-container s-product__layout"><div className="s-product__copy"><p className="c-kicker">THE SHARED VIEW</p><h2>Everything going on.<br />All in one place.</h2><p>Your group has enough moving parts. Give the money side a clear home, so everyone knows their part.</p><ul><li>See your share of the month</li><li>Know what is paid and what is due</li><li>Keep recurring costs in sight</li></ul><Button>Try Commune free</Button></div><div className="s-product__visual"><div className="s-demo-tabs" role="group" aria-label="Preview group">{[['home', 'Home'], ['work', 'Work'], ['trip', 'Trip']].map(([value, label]) => <button key={value} onClick={() => setGroup(value)} aria-pressed={group === value}>{label}</button>)}</div><div className="s-dashboard"><aside><strong>commune.</strong><span className="is-current">Overview</span><span>Expenses</span><span>My breakdown</span><span>Members</span><b>{data.name}</b></aside><div className="s-dashboard__main"><div className="s-dashboard__top"><strong>{data.name}</strong><span>Alex</span></div><p className="s-dashboard__eyebrow">{data.period}</p><h3>{group === 'trip' ? 'Your trip, all clear.' : 'Your month, all clear.'}</h3><p className="s-dashboard__subtitle">Everything you need to know about your share.</p><div className="s-dashboard__stats"><div><span>Your share</span><strong>{data.total}</strong></div><div><span>Paid so far</span><strong>{data.paid}</strong></div><div><span>Still to pay</span><strong>{data.remaining}</strong></div></div><div className="s-dashboard__list"><h4>Your expenses</h4>{data.rows.map(([label, date, amount, status]) => <div key={label}><span>{label}<small>{date}</small></span><strong>{amount}</strong><em className={status === 'Paid' ? 'is-paid' : ''}>{status}</em></div>)}</div></div></div><p className="s-demo-note">Illustrative product preview. Try a different group.</p></div></div></section>;
}

const stories = [
  { title: 'Everything together, at last.', eyebrow: 'ONE SHARED VIEW', body: 'A single space for the costs behind your shared life. See the full picture without searching through messages.', photo: '/groceries.png', alt: 'Housemates unpacking shopping together' },
  { title: 'The right split for everyone.', eyebrow: 'MADE FOR YOUR GROUP', body: 'Include the right people and choose equal, percentage or custom shares. The detail stays visible to your group.', photo: '/work-together.png', alt: 'Colleagues sharing a table in a creative studio' },
  { title: 'Less admin. More adventure.', eyebrow: 'ROOM FOR THE PLANS', body: 'Keep the apartment, travel and meals together, so your group can spend more time enjoying the trip.', photo: '/trip-together.png', alt: 'Friends planning their journey on a train platform' },
];
function StoryShowcase() {
  const [active, setActive] = useState(0);
  const story = stories[active];
  return <section className="s-story"><div className="c-container"><SectionHeading eyebrow="LIFE HAS ENOUGH MOVING PARTS" title="Quit the money juggling act." /><div className="s-story__panel"><div className="s-story__copy"><p className="c-kicker">{story.eyebrow}</p><h3>{story.title}</h3><p>{story.body}</p><Button>Start your free trial</Button></div><div className="s-story__image"><img src={story.photo} alt={story.alt} loading="lazy" /></div></div><div className="s-story__controls"><span>{String(active + 1).padStart(2, '0')} / 03</span><div role="group" aria-label="Life stories">{['At home', 'At work', 'Away'].map((label, index) => <button key={label} aria-pressed={active === index} onClick={() => setActive(index)}>{label}</button>)}</div></div></div></section>;
}

function Steps() {
  return <section className="s-steps" id="steps"><div className="c-container"><SectionHeading eyebrow="HOW IT WORKS" title="A shared bill. A clear way forward." body="From adding an expense to seeing it settled, everyone knows where they stand." /><div className="s-steps__grid"><article><div className="s-step__visual"><div className="s-mini-expense"><span>New expense</span><label>What is it for?</label><strong>Monthly rent</strong><label>Amount</label><b>£1,200.00</b><p>Maple House · October</p></div></div><small>01 / ADD IT</small><h3>Give every cost a place.</h3><p>Add the detail once: what it was for, who is involved and when it is due.</p></article><article><div className="s-step__visual s-step__visual--green"><div className="s-mini-expense"><span>Split this expense</span><label>Equal split · 4 people</label><b>£300.00</b><strong>per person</strong><div className="s-mini-names">Alex · Jordan · Taylor · Casey</div><p>£1,200.00 total</p></div></div><small>02 / SPLIT IT</small><h3>Make the split fit.</h3><p>Include the right people and choose equal, percentage or custom shares.</p></article><article><div className="s-step__visual"><div className="s-mini-expense"><span>Payment progress</span><label>Monthly rent</label><div className="s-mini-person"><span>Alex</span><b>Paid</b></div><div className="s-mini-person"><span>Jordan</span><b>Paid</b></div><div className="s-mini-person"><span>Taylor</span><em>Due</em></div><div className="s-mini-person"><span>Casey</span><em>Due</em></div><p>2 of 4 shares paid</p></div></div><small>03 / STAY CLEAR</small><h3>See where things stand.</h3><p>Members mark shares paid. Admins confirm them, with the status visible to all.</p></article></div></div></section>;
}

function Moments() {
  return <section className="s-moments"><div className="c-container"><SectionHeading eyebrow="WHATEVER TOGETHER LOOKS LIKE" title="For the everyday in between." body="Big plans, little purchases and all the things that add up." /><div className="s-moments__grid">{[{title:'Dinner with friends.',photo:'/cooking.png',alt:'Friends making dinner',body:'Groceries, the shared shop and the last-minute extras.'},{title:'A project in the making.',photo:'/work-together.png',alt:'A team collaborating in their studio',body:'Materials, space and the costs behind a shared idea.'},{title:'Somewhere new.',photo:'/trip-together.png',alt:'Friends heading away on a trip',body:'A weekend away, a group stay or the next adventure.'}].map(item => <article key={item.title}><img src={item.photo} alt={item.alt} loading="lazy"/><div><h3>{item.title}</h3><p>{item.body}</p></div></article>)}</div></div></section>;
}
function LifePanel() {
  return <section className="s-life"><div className="c-container s-life__panel"><img src="/groceries.png" alt="Housemates laughing as they put groceries away" loading="lazy"/><div><p className="c-kicker">FOR REAL LIFE</p><h2>Good things happen when the money is clear.</h2><p>Plans change. People come and go. Some costs are equal and others are not. Keep up with the group, without making shared life feel like admin.</p><Button light>Start your free trial</Button></div></div></section>;
}

const library: Record<SectionId, { title: string; source: string; component: ComponentType }> = {
  process: { title: 'Interactive process + changing screen', source: 'Combined', component: Process },
  benefits: { title: 'Benefits card rail', source: 'Original', component: BenefitRail },
  proof: { title: 'Three reasons to use Commune', source: 'Business', component: Proof },
  dashboard: { title: 'Full product dashboard', source: 'Business', component: Dashboard },
  story: { title: 'Large photo story carousel', source: 'Original', component: StoryShowcase },
  steps: { title: 'Three process cards', source: 'Business', component: Steps },
  features: { title: 'Complete feature grid', source: 'Original + Business', component: FeatureGrid },
  audiences: { title: 'Home, Work and Trips photography', source: 'Combined', component: UseCases },
  moments: { title: 'Everyday moments', source: 'Original', component: Moments },
  month: { title: 'Your monthly breakdown', source: 'Original', component: Month },
  life: { title: 'Photography + navy story panel', source: 'Business', component: LifePanel },
  pricing: { title: 'Plans + billing switch', source: 'Business', component: Pricing },
  faq: { title: 'Frequently asked questions', source: 'Business', component: Faq },
  closing: { title: 'Final call to action', source: 'Original + Combined', component: Closing },
};

function useSectionSelection(direction: Direction) {
  const key = 'commune-homepage-review-v1-' + direction;
  const [selected, setSelected] = useState<SectionId[]>(() => {
    try { const saved: unknown = JSON.parse(localStorage.getItem(key) || 'null'); if (Array.isArray(saved)) return saved.filter((id): id is SectionId => typeof id === 'string' && allSections.includes(id as SectionId)); } catch { /* Start from the chosen direction if storage is unavailable. */ }
    return directions[direction].defaults;
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(selected)); } catch { /* The review still works when storage is unavailable. */ } }, [key, selected]);
  return { selected, toggle: (id: SectionId) => setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]), reset: () => setSelected(directions[direction].defaults) };
}

function StudioHeader({ selected }: { selected: SectionId[] }) {
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(window.scrollY > 40);
  useEffect(() => { const update = () => setScrolled(window.scrollY > 40); window.addEventListener('scroll', update, {passive:true}); return () => window.removeEventListener('scroll', update); }, []);
  const nav = [
    selected.includes('process') ? ['How it works', '#how-it-works'] : selected.includes('steps') ? ['How it works', '#steps'] : null,
    selected.includes('audiences') ? ['Who it is for', '#use-cases'] : null,
    selected.includes('features') ? ['Features', '#features'] : null,
    selected.includes('pricing') ? ['Pricing', '#pricing'] : null,
  ].filter((item): item is string[] => item !== null);
  return <header className={'s-header' + (scrolled || menu ? ' s-header--solid' : '')}><div className="c-container"><a className="c-logo" href="#top" onClick={() => setMenu(false)}>commune<span>.</span></a><nav id="studio-navigation" className={menu ? 'is-open' : ''} aria-label="Main navigation">{nav.map(([label,href]) => <a key={label} href={href} onClick={() => setMenu(false)}>{label}</a>)}<a href={login}>Log in</a></nav><Button light>Start free trial</Button><button className="s-menu" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-controls="studio-navigation">{menu ? 'Close' : 'Menu'}</button></div></header>;
}
function StudioFooter({ selected }: { selected: SectionId[] }) {
  return <footer className="s-footer"><div className="c-container"><div><a className="c-logo" href="#top">commune<span>.</span></a><p>For people who do life together.</p></div><nav aria-label="Footer navigation">{selected.includes('process') && <a href="#how-it-works">How it works</a>}{selected.includes('pricing') && <a href="#pricing">Pricing</a>}{selected.includes('faq') && <a href="#questions">FAQs</a>}<a href={login}>Log in</a><a href="mailto:support@ourcommune.io">Contact</a></nav></div><div className="c-container s-footer__bottom"><span>© {new Date().getFullYear()} Commune</span><div><a href="https://app.ourcommune.io/privacy">Privacy</a><a href="https://app.ourcommune.io/terms">Terms</a></div></div></footer>;
}

export default function HomepageStudio() {
  const direction: Direction = window.location.pathname.includes('everyday') ? 'everyday' : window.location.pathname.includes('clear-view') ? 'product' : 'all';
  const config = directions[direction];
  const { selected, toggle, reset } = useSectionSelection(direction);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const [drawer, setDrawer] = useState(false);
  useEffect(() => { if (drawer) dialog.current?.showModal(); else dialog.current?.close(); }, [drawer]);
  useEffect(() => { document.title = `Commune — ${config.label}`; }, [config.label]);
  const toggleSection = (id: SectionId) => { setNotice(`${library[id].title} ${selected.includes(id) ? 'hidden' : 'restored'}.`); toggle(id); };
  return <div className={'studio-page studio-page--' + direction}>
    <div className="s-reviewbar"><a className="s-reviewbar__title" href="/all-together.html">Homepage directions</a><nav aria-label="Homepage versions">{(Object.keys(directions) as Direction[]).map((key,i) => <a key={key} href={directions[key].path} aria-current={key === direction ? 'page' : undefined}><span>0{i+1}</span>{directions[key].short}</a>)}</nav><button className="s-reviewbar__edit" onClick={() => setDrawer(true)}>Choose sections <span>{selected.length}</span></button></div>
    <StudioHeader selected={selected}/>
    <main><Hero />{config.order.filter(id => selected.includes(id)).map(id => { const Component = library[id].component; return <div className={'s-review-section' + (editing ? ' s-review-section--editing' : '')} data-section={id} key={id}>{editing && <div className="s-section-label"><span><b>{library[id].title}</b><small>{library[id].source}</small></span><button onClick={() => toggleSection(id)}>Hide section</button></div>}<Component /></div>; })}</main>
    <StudioFooter selected={selected}/>
    {editing && <div className="s-edit-dock"><span>{selected.length} sections showing</span><button onClick={() => setDrawer(true)}>Restore sections</button><button onClick={() => setEditing(false)}>Finish editing</button></div>}
    <div className="c-sr-only" role="status" aria-live="polite">{notice}</div>
    <dialog className="s-section-dialog" ref={dialog} onClose={() => setDrawer(false)} onCancel={() => setDrawer(false)} aria-labelledby="section-dialog-title"><div className="s-section-dialog__header"><div><p>YOUR HOMEPAGE SHORTLIST</p><h2 id="section-dialog-title">Choose what stays.</h2></div><button onClick={() => setDrawer(false)} aria-label="Close section chooser">Close</button></div><p className="s-section-dialog__intro">{config.note} Your choices are saved in this browser for each version.</p><div className="s-section-dialog__mode"><label><input type="checkbox" checked={editing} onChange={e => setEditing(e.target.checked)}/><span>Show section labels on the page</span></label></div><div className="s-section-options">{config.order.map((id,i) => <label key={id}><input type="checkbox" checked={selected.includes(id)} onChange={() => toggleSection(id)}/><span><b>{String(i+1).padStart(2,'0')} · {library[id].title}</b><small>From {library[id].source.toLowerCase()}</small></span></label>)}</div><div className="s-section-dialog__footer"><button onClick={() => {reset();setNotice('Default sections restored.');}}>Reset this version</button><button className="c-button c-button--navy" onClick={() => setDrawer(false)}>View my page</button></div></dialog>
  </div>;
}
