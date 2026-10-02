import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { calculateEqualSplit } from '../../../packages/core/src/splits';
import { Icon } from './MobileIcon';

type Tab = 'today' | 'spaces' | 'money' | 'plans';
type Space = { id: string; name: string; kind: 'Home' | 'Work' | 'Trip'; image: string; members: string[]; essentials: [string, string][]; fund: number };
type Expense = { id: string; space: string; title: string; total: number; paidBy: string; due: string; shares: Record<string, number>; claimed: string[]; confirmed: string[] };
type Job = { id: string; space: string; title: string; owner: string; due: string; recurring: boolean; rotation: string[]; done: boolean };
type Event = { id: string; space: string; title: string; when: string; where: string };
type Note = { id: string; space: string; title: string; body: string };
type Panel = null | 'add' | 'form' | 'expense' | 'event' | 'profile' | 'notifications' | 'invite' | 'fund' | 'inbox';
type CreateType = 'expense' | 'job' | 'event' | 'note' | 'space';

const people: Record<string, string> = { Alex: '/avatars/alex.jpg', Jordan: '/avatars/jordan.jpg', Taylor: '/avatars/taylor.jpg', Casey: '/avatars/casey.jpg' };
const initialSpaces: Space[] = [
  { id: 'home', name: 'Maple House', kind: 'Home', image: '/company-hero-home.jpg', members: ['Alex', 'Jordan', 'Taylor', 'Casey'], essentials: [['Wi-Fi', 'Maple House'], ['Recycling', 'Friday morning'], ['Spare keys', 'Jordan has the extra set']], fund: 186 },
  { id: 'work', name: 'Common Ground', kind: 'Work', image: '/company-hero-work.jpg', members: ['Alex', 'Jordan', 'Taylor', 'Casey'], essentials: [['Access', 'Side entrance after 6pm'], ['Supplier', 'Northside Print Co.']], fund: 320 },
  { id: 'trip', name: 'The Coast Weekend', kind: 'Trip', image: '/company-hero-trip.jpg', members: ['Alex', 'Jordan', 'Taylor', 'Casey'], essentials: [['Stay', 'Harbour House'], ['Check-in', 'Friday, 3pm'], ['Meet', 'Central station, 10:15am']], fund: 144 },
];

function seededExpense(id: string, space: string, title: string, total: number, paidBy: string, due: string, confirmed: string[] = [], claimed: string[] = []): Expense {
  const participants = ['Alex', 'Jordan', 'Taylor', 'Casey'];
  const split = calculateEqualSplit(total, participants.length);
  const shares = Object.fromEntries(participants.map((name, index) => [name, split[index]])) as Record<string, number>;
  return { id, space, title, total, paidBy, due, shares, confirmed: [...new Set([paidBy, ...confirmed])], claimed };
}

const initialExpenses: Expense[] = [
  seededExpense('shop', 'home', 'The big shop', 84.50, 'Jordan', 'Today'),
  seededExpense('print', 'work', 'Print order', 256, 'Casey', 'Today'),
  seededExpense('train', 'trip', 'Train tickets', 148, 'Taylor', 'Today'),
  seededExpense('broadband', 'home', 'Broadband', 48, 'Taylor', 'Friday'),
  seededExpense('rent', 'home', 'September rent', 1200, 'Alex', '1 September', ['Jordan', 'Taylor']),
  seededExpense('studio', 'work', 'Studio rent', 880, 'Alex', '1 September', ['Jordan', 'Taylor', 'Casey']),
  seededExpense('stay', 'trip', 'Weekend stay', 360, 'Jordan', 'Friday', ['Alex']),
];
const initialJobs: Job[] = [
  { id: 'kitchen', space: 'home', title: 'Kitchen reset', owner: 'Alex', due: 'Today', recurring: true, rotation: ['Alex', 'Jordan', 'Taylor', 'Casey'], done: false },
  { id: 'cards', space: 'work', title: 'Collect new key cards', owner: 'Alex', due: 'Today', recurring: false, rotation: [], done: false },
  { id: 'gear', space: 'trip', title: 'Pack the shared gear', owner: 'Alex', due: 'Thursday', recurring: false, rotation: [], done: false },
  { id: 'recycling', space: 'home', title: 'Take the recycling out', owner: 'Jordan', due: 'Thursday', recurring: true, rotation: ['Jordan', 'Taylor', 'Casey', 'Alex'], done: false },
  { id: 'stock', space: 'work', title: 'Restock paper and ink', owner: 'Casey', due: 'Thursday', recurring: true, rotation: ['Casey', 'Alex', 'Jordan', 'Taylor'], done: false },
  { id: 'checkin', space: 'trip', title: 'Confirm check-in time', owner: 'Jordan', due: 'Today', recurring: false, rotation: [], done: false },
];
const initialEvents: Event[] = [
  { id: 'dinner', space: 'home', title: 'Dinner with friends', when: 'Saturday · 18:00', where: 'Maple House' },
  { id: 'review', space: 'work', title: 'Studio review', when: 'Thursday · 14:00', where: 'Meeting table' },
  { id: 'station', space: 'trip', title: 'Meet for the train', when: 'Friday · 10:15', where: 'Central station' },
];
const initialNotes: Note[] = [
  { id: 'home-note', space: 'home', title: 'Saturday at home', body: 'Friends are coming over. Let’s get the house ready together.' },
  { id: 'work-note', space: 'work', title: 'New key cards', body: 'Collect yours from the front desk before Friday.' },
  { id: 'trip-note', space: 'trip', title: 'Check-in details', body: 'Check-in starts at 3pm. The address is in our essentials.' },
];

const cash = (value: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
const isOpenForAlex = (expense: Expense) => expense.paidBy !== 'Alex' && 'Alex' in expense.shares && !expense.confirmed.includes('Alex');
const pendingToAlex = (expense: Expense) => expense.paidBy === 'Alex' ? Object.entries(expense.shares).filter(([name]) => name !== 'Alex' && !expense.confirmed.includes(name)) : [];

function Face({ name, size = 34 }: { name: string; size?: number }) {
  return people[name]
    ? <img className="m3-face" src={people[name]} alt={name} width={size} height={size} style={{ width: size, height: size }} />
    : <span className="m3-face m3-face--initial" style={{ width: size, height: size }} aria-label={name}>{name.slice(0, 1).toUpperCase()}</span>;
}
function Faces({ names }: { names: string[] }) { return <span className="m3-faces">{names.map(name => <Face key={name} name={name} size={28} />)}</span>; }
function HeaderLabel({ eyebrow, title, copy }: { eyebrow?: string; title: string; copy?: string }) {
  return <div className="m3-page-heading">{eyebrow && <p className="m3-eyebrow">{eyebrow}</p>}<h1>{title}</h1>{copy && <p>{copy}</p>}</div>;
}

export default function MobileAppV3() {
  const scroll = useRef<HTMLElement>(null);
  const filterScroll = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<Tab>('today');
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [panel, setPanel] = useState<Panel>(null);
  const [createType, setCreateType] = useState<CreateType>('expense');
  const [formSpace, setFormSpace] = useState('home');
  const [formTitle, setFormTitle] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formPayer, setFormPayer] = useState('Alex');
  const [formOwner, setFormOwner] = useState('Alex');
  const [formWhen, setFormWhen] = useState('');
  const [formWhere, setFormWhere] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formKind, setFormKind] = useState<Space['kind']>('Home');
  const [formRecurring, setFormRecurring] = useState(false);
  const [included, setIncluded] = useState<string[]>(['Alex', 'Jordan', 'Taylor', 'Casey']);
  const [formError, setFormError] = useState('');
  const [selectedExpense, setSelectedExpense] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [spaces, setSpaces] = useState(initialSpaces);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [jobs, setJobs] = useState(initialJobs);
  const [events, setEvents] = useState(initialEvents);
  const [notes, setNotes] = useState(initialNotes);
  const [invites, setInvites] = useState<{ space: string; email: string }[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [pledgeAmount, setPledgeAmount] = useState('');
  const [pledges, setPledges] = useState<Record<string, number>>({});
  const [noticesOn, setNoticesOn] = useState(true);
  const [toast, setToast] = useState('');

  const activeSpace = spaces.find(item => item.id === spaceId);
  const selectedExpenseData = expenses.find(item => item.id === selectedExpense);
  const selectedEventData = events.find(item => item.id === selectedEvent);
  const visibleExpenses = expenses.filter(item => filter === 'all' || item.space === filter);
  const visibleJobs = jobs.filter(item => filter === 'all' || item.space === filter);
  const visibleEvents = events.filter(item => filter === 'all' || item.space === filter);
  const owe = visibleExpenses.filter(isOpenForAlex).reduce((total, item) => total + item.shares.Alex!, 0);
  const owed = visibleExpenses.reduce((total, item) => total + pendingToAlex(item).reduce((sum, [, amount]) => sum + amount, 0), 0);
  const myJobs = visibleJobs.filter(item => item.owner === 'Alex' && !item.done);
  const othersJobs = visibleJobs.filter(item => item.owner !== 'Alex' && !item.done);
  const costNeeds = expenses.filter(item => item.due === 'Today' && isOpenForAlex(item) && !item.claimed.includes('Alex')).map(item => ({ id: item.id, space: item.space, title: item.title, detail: `${cash(item.shares.Alex!)} to settle`, icon: 'receipt' as const, type: 'expense' as const }));
  const jobNeeds = jobs.filter(item => item.due === 'Today' && item.owner === 'Alex' && !item.done).map(item => ({ id: item.id, space: item.space, title: item.title, detail: 'Your turn today', icon: 'checklist' as const, type: 'job' as const }));
  const needs = [jobNeeds[0], costNeeds[0], jobNeeds[1], ...costNeeds.slice(1), ...jobNeeds.slice(2)].filter((item): item is NonNullable<typeof item> => Boolean(item));

  useEffect(() => {
    const container = filterScroll.current;
    const selected = container?.querySelector<HTMLButtonElement>('button.active');
    if (!container || !selected) return;
    const left = selected.getBoundingClientRect().left - container.getBoundingClientRect().left;
    container.scrollTo({ left: filter === 'all' ? 0 : container.scrollLeft + left - 20, behavior: 'auto' });
  }, [filter, tab]);

  function top() { scroll.current?.scrollTo({ top: 0 }); }
  function changeTab(next: Tab, nextFilter = 'all') { setTab(next); setSpaceId(null); setFilter(nextFilter); setPanel(null); setToast(''); top(); }
  function showSpace(id: string) { setTab('spaces'); setSpaceId(id); setPanel(null); top(); }
  function flash(message: string) { setToast(message); window.setTimeout(() => setToast(current => current === message ? '' : current), 4200); }
  function openCreate(type: CreateType, id?: string) {
    const nextSpace = id ?? spaceId ?? (filter === 'all' ? spaces[0]?.id : filter) ?? 'home';
    setCreateType(type); setFormSpace(nextSpace); setFormTitle(''); setFormAmount(''); setFormPayer('Alex'); setFormOwner('Alex');
    setFormWhen(''); setFormWhere(''); setFormBody(''); setFormKind('Home'); setFormRecurring(false);
    setIncluded(spaces.find(item => item.id === nextSpace)?.members ?? ['Alex']); setFormError(''); setPanel('form');
  }
  function openExpense(id: string) { setSelectedExpense(id); setPanel('expense'); }
  function openEvent(id: string) { setSelectedEvent(id); setPanel('event'); }
  function completeJob(id: string) {
    const job = jobs.find(item => item.id === id);
    if (!job || job.owner !== 'Alex') return;
    if (job.recurring) {
      const nextOwner = job.rotation[(job.rotation.indexOf('Alex') + 1) % job.rotation.length] ?? 'Alex';
      setJobs(current => current.map(item => item.id === id ? { ...item, owner: nextOwner, due: 'Next week' } : item));
      flash(`Done. ${nextOwner} has the next turn.`);
    } else {
      setJobs(current => current.map(item => item.id === id ? { ...item, done: true } : item));
      flash('Done. Your group can see the update.');
    }
  }
  function claimShare(id: string) {
    setExpenses(current => current.map(item => item.id === id && !item.claimed.includes('Alex') ? { ...item, claimed: [...item.claimed, 'Alex'] } : item));
    flash('Marked as sent. The payer will confirm receipt.');
  }
  function confirmShare(id: string, name: string) {
    const item = expenses.find(expense => expense.id === id);
    if (!item || item.paidBy !== 'Alex' || item.confirmed.includes(name)) return;
    setExpenses(current => current.map(expense => expense.id === id ? { ...expense, confirmed: [...expense.confirmed, name] } : expense));
    flash(`${name}'s share confirmed as received.`);
  }
  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = formTitle.trim();
    if (!title) { setFormError('Add a name to continue.'); return; }
    if (createType === 'space') {
      const id = `space-${Date.now()}`;
      setSpaces(current => [...current, { id, name: title, kind: formKind, image: '', members: ['Alex'], essentials: [], fund: 0 }]);
      setPanel(null); showSpace(id); flash(`${title} is ready. Invite your people next.`); return;
    }
    if (createType === 'expense') {
      const total = Number(formAmount);
      if (!Number.isFinite(total) || total <= 0) { setFormError('Enter a valid amount.'); return; }
      if (!included.length) { setFormError('Choose at least one person.'); return; }
      if (!included.includes(formPayer)) { setFormError('Include the person who paid.'); return; }
      const amounts = calculateEqualSplit(total, included.length);
      const shares = Object.fromEntries(included.map((name, index) => [name, amounts[index]])) as Record<string, number>;
      setExpenses(current => [{ id: `expense-${Date.now()}`, space: formSpace, title, total, paidBy: formPayer, due: 'Today', shares, claimed: [], confirmed: [formPayer] }, ...current]);
      changeTab('money', formSpace); flash('Shared cost added. Everyone can see their part.'); return;
    }
    if (createType === 'job') {
      const rotation = (spaces.find(item => item.id === formSpace)?.members ?? ['Alex']);
      const due = formWhen ? new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(new Date(`${formWhen}T12:00:00`)) : 'Today';
      setJobs(current => [{ id: `job-${Date.now()}`, space: formSpace, title, owner: formOwner, due, recurring: formRecurring, rotation, done: false }, ...current]);
      changeTab('plans', formSpace); flash('Job added to your shared plan.'); return;
    }
    if (createType === 'event') {
      if (!formWhen || !formWhere.trim()) { setFormError('Add a time and place.'); return; }
      const when = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(formWhen));
      setEvents(current => [{ id: `event-${Date.now()}`, space: formSpace, title, when, where: formWhere.trim() }, ...current]);
      changeTab('plans', formSpace); flash('Event added to the plan.'); return;
    }
    if (!formBody.trim()) { setFormError('Add a little detail to your note.'); return; }
    setNotes(current => [{ id: `note-${Date.now()}`, space: formSpace, title, body: formBody.trim() }, ...current]);
    setPanel(null); showSpace(formSpace); flash('Note pinned for your group.');
  }

  function sectionHead(title: string, action?: ReactNode) { return <div className="m3-section-head"><h2>{title}</h2>{action}</div>; }
  function spaceName(id: string) { return spaces.find(item => item.id === id)?.name ?? 'Your space'; }
  function filterControl() { return <div className="m3-filter" ref={filterScroll} role="group" aria-label="Filter by space"><button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All spaces</button>{spaces.map(item => <button type="button" key={item.id} className={filter === item.id ? 'active' : ''} onClick={() => setFilter(item.id)}>{item.name}</button>)}</div>; }
  function costRow(item: Expense, detail = false) {
    const waiting = pendingToAlex(item);
    const value = item.paidBy === 'Alex' ? waiting.reduce((sum, [, amount]) => sum + amount, 0) : item.shares.Alex ?? 0;
    return <button className="m3-list-row" key={item.id} type="button" onClick={() => openExpense(item.id)}>
      <span className={`m3-list-icon ${item.paidBy === 'Alex' ? 'is-sage' : ''}`}><Icon name="receipt" size={20} /></span>
      <span className="m3-list-copy"><strong>{item.title}</strong><small>{detail ? spaceName(item.space) + ' · ' : ''}{item.paidBy === 'Alex' ? 'You paid' : `${item.paidBy} paid`}</small></span>
      <span className="m3-list-value"><b>{cash(value)}</b><small>{item.due}</small></span>
    </button>;
  }
  function jobRow(item: Job, yours: boolean) { return <div className="m3-job-row" key={item.id}>
    {yours ? <button className="m3-job-check" type="button" aria-label={`Mark ${item.title} complete`} onClick={() => completeJob(item.id)}><Icon name="check" size={17} /></button> : <Face name={item.owner} size={34} />}
    <span><strong>{item.title}</strong><small>{spaceName(item.space)} · {item.due}{item.recurring ? ' · Repeats' : ''}</small></span>
    {yours ? <span className="m3-job-you">Your turn</span> : <span className="m3-job-owner">{item.owner}</span>}
  </div>; }

  return <div className="m3-stage">
    <div className="m3-stagebar"><a href="/editorial.html" className="m3-stagebrand">commune.</a><nav aria-label="Compare concepts"><a href="/mobile-app.html">1.0</a><a href="/mobile-app-v2.html">2.0</a><span aria-current="page">3.0</span></nav></div>
    <div className="m3-phone">
      <header className="m3-topbar"><strong>commune.</strong><div><button type="button" aria-label="Notifications" className="m3-icon-button" onClick={() => setPanel('notifications')}><Icon name="bell" size={20} /><i /></button><button type="button" aria-label="Profile and settings" className="m3-profile" onClick={() => setPanel('profile')}><Face name="Alex" size={38} /></button></div></header>
      <main className="m3-main" ref={scroll}>
        {tab === 'today' && <>
          <HeaderLabel eyebrow="YOUR DAY, TOGETHER" title="Morning, Alex." copy="The shared stuff, without the chasing." />
          {sectionHead('Needs you', <span className="m3-count">{needs.length}</span>)}
          <div className="m3-card m3-needs">{needs.slice(0, 3).map(item => <button key={item.id} type="button" className="m3-list-row" onClick={() => item.type === 'expense' ? openExpense(item.id) : changeTab('plans', item.space)}><span className="m3-list-icon"><Icon name={item.icon} size={20} /></span><span className="m3-list-copy"><strong>{item.title}</strong><small>{spaceName(item.space)} · {item.detail}</small></span><Icon name="arrow" size={17} /></button>)}{!needs.length && <p className="m3-empty">You're all caught up. Enjoy the room to breathe.</p>}</div>
          {needs.length > 3 && <button className="m3-text-link" type="button" onClick={() => setPanel('inbox')}>See all {needs.length} things <Icon name="arrow" size={16} /></button>}
          {sectionHead('Coming up', <button className="m3-quiet-link" type="button" onClick={() => changeTab('plans')}>View plans <Icon name="arrow" size={16} /></button>)}
          <button className="m3-next-event" type="button" onClick={() => openEvent('station')}><span className="m3-event-date"><b>FRI</b><strong>02</strong></span><span><strong>Meet for the train</strong><small>The Coast Weekend · 10:15 at Central station</small></span><Icon name="arrow" size={18} /></button>
          {sectionHead('Your spaces', <button className="m3-quiet-link" type="button" onClick={() => changeTab('spaces')}>See all <Icon name="arrow" size={16} /></button>)}
          <div className="m3-space-peek">{spaces.map(item => <button type="button" key={item.id} onClick={() => showSpace(item.id)}><span className={`m3-peek-image ${!item.image ? 'is-empty' : ''}`}>{item.image && <img src={item.image} alt="" />}</span><span><small>{item.kind}</small><strong>{item.name}</strong></span><Icon name="arrow" size={17} /></button>)}</div>
        </>}

        {tab === 'spaces' && !activeSpace && <>
          <HeaderLabel eyebrow="THE PEOPLE AND PLACES" title="Your spaces." copy="Home, work and everywhere life happens together." />
          <div className="m3-space-list">{spaces.map(item => {
            const openCount = jobs.filter(job => job.space === item.id && !job.done).length + expenses.filter(expense => expense.space === item.id && isOpenForAlex(expense)).length;
            return <button className="m3-space-card" type="button" key={item.id} onClick={() => showSpace(item.id)}><span className={`m3-space-photo ${!item.image ? 'is-empty' : ''}`}>{item.image && <img src={item.image} alt="" />}</span><span className="m3-space-meta"><span><small>{item.kind.toUpperCase()} · {item.members.length} {item.members.length === 1 ? 'PERSON' : 'PEOPLE'}</small><strong>{item.name}</strong></span><Icon name="arrow" size={19} /></span><span className="m3-space-foot"><Faces names={item.members} /><small>{openCount ? `${openCount} things in motion` : 'All clear today'}</small></span></button>;
          })}</div>
          <button type="button" className="m3-new-space" onClick={() => openCreate('space')}><Icon name="plus" size={19} /> Create a space</button>
        </>}

        {tab === 'spaces' && activeSpace && <>
          <button className="m3-back" type="button" onClick={() => { setSpaceId(null); top(); }}><Icon name="arrow" size={17} /> All spaces</button>
          <div className={`m3-hub-cover ${!activeSpace.image ? 'is-empty' : ''}`}>{activeSpace.image && <img src={activeSpace.image} alt="" />}<span>{activeSpace.kind.toUpperCase()}</span></div>
          <div className="m3-hub-heading"><h1>{activeSpace.name}</h1><p>A place for the people, plans and details you share.</p></div>
          <button className="m3-people-strip" type="button" onClick={() => setPanel('invite')}><Faces names={activeSpace.members} /><span>{activeSpace.members.length} {activeSpace.members.length === 1 ? 'person' : 'people'}</span><strong>Invite <Icon name="arrow" size={15} /></strong></button>
          {sectionHead('Pinned for everyone', <button className="m3-quiet-link" type="button" onClick={() => openCreate('note', activeSpace.id)}>Add note <Icon name="plus" size={15} /></button>)}
          <div className="m3-note-list">{notes.filter(item => item.space === activeSpace.id).map(item => <article key={item.id}><span><Icon name="pin" size={16} /> {item.title}</span><p>{item.body}</p></article>)}{!notes.some(item => item.space === activeSpace.id) && <p className="m3-empty">Keep the details everyone asks for in one place.</p>}</div>
          {sectionHead('Your group at a glance')}
          <div className="m3-hub-links"><button type="button" onClick={() => changeTab('money', activeSpace.id)}><span className="m3-list-icon"><Icon name="money" size={20} /></span><span><strong>Shared money</strong><small>Costs, shares and what’s been paid</small></span><Icon name="arrow" size={17} /></button><button type="button" onClick={() => changeTab('plans', activeSpace.id)}><span className="m3-list-icon is-sage"><Icon name="calendar" size={20} /></span><span><strong>Jobs and plans</strong><small>Who’s doing what and what’s next</small></span><Icon name="arrow" size={17} /></button></div>
          {sectionHead('Useful details')}
          <div className="m3-detail-list">{activeSpace.essentials.map(([key, value]) => <div key={key}><span>{key}</span><strong>{value}</strong></div>)}{!activeSpace.essentials.length && <p className="m3-empty">Add a note to give your group its first useful detail.</p>}</div>
          <button className="m3-fund-link" type="button" onClick={() => { setFormSpace(activeSpace.id); setPanel('fund'); }}><span><small>GROUP FUND</small><strong>{cash(activeSpace.fund + (pledges[activeSpace.id] ?? 0))}</strong></span><span>See fund <Icon name="arrow" size={17} /></span></button>
        </>}

        {tab === 'money' && <>
          <HeaderLabel eyebrow="SHARED MONEY" title="Know where you stand." copy="Every cost and every share, in one clear view." />
          {filterControl()}
          <div className="m3-balance"><div><small>YOUR OPEN SHARES</small><strong>{cash(owe)}</strong><span>Until the payer confirms</span></div><div><small>OTHERS OWE YOU</small><strong>{cash(owed)}</strong><span>Waiting to be confirmed</span></div></div>
          {sectionHead('To settle', <span className="m3-count">{visibleExpenses.filter(item => isOpenForAlex(item) && !item.claimed.includes('Alex')).length}</span>)}
          <div className="m3-card">{visibleExpenses.filter(item => isOpenForAlex(item) && !item.claimed.includes('Alex')).map(item => costRow(item, filter === 'all'))}{!visibleExpenses.some(item => isOpenForAlex(item) && !item.claimed.includes('Alex')) && <p className="m3-empty">No shares need settling here.</p>}</div>
          {visibleExpenses.some(item => isOpenForAlex(item) && item.claimed.includes('Alex')) && <>{sectionHead('Awaiting confirmation')}<div className="m3-card">{visibleExpenses.filter(item => isOpenForAlex(item) && item.claimed.includes('Alex')).map(item => costRow(item, filter === 'all'))}</div></>}
          {sectionHead('Waiting on others')}
          <div className="m3-card">{visibleExpenses.filter(item => pendingToAlex(item).length > 0).map(item => costRow(item, filter === 'all'))}{!visibleExpenses.some(item => pendingToAlex(item).length > 0) && <p className="m3-empty">Nothing to confirm right now.</p>}</div>
          {sectionHead('Settled')}
          <div className="m3-card">{visibleExpenses.filter(item => item.paidBy !== 'Alex' && item.confirmed.includes('Alex')).map(item => costRow(item, filter === 'all'))}{!visibleExpenses.some(item => item.paidBy !== 'Alex' && item.confirmed.includes('Alex')) && <p className="m3-empty">Past costs will appear here.</p>}</div>
          <button className="m3-under-action" type="button" onClick={() => { setFormSpace(filter === 'all' ? spaces[0]!.id : filter); setPanel('fund'); }}><Icon name="wallet" size={19} /><span>Group funds and contributions</span><Icon name="arrow" size={16} /></button>
        </>}

        {tab === 'plans' && <>
          <HeaderLabel eyebrow="JOBS AND MOMENTS" title="Keep life moving." copy="The next turn, the next plan, and who’s on it." />
          {filterControl()}
          {sectionHead('Your jobs', <span className="m3-count">{myJobs.length}</span>)}
          <div className="m3-card">{myJobs.map(item => jobRow(item, true))}{!myJobs.length && <p className="m3-empty">Your part is done for now.</p>}</div>
          {sectionHead('The group’s jobs')}
          <div className="m3-card">{othersJobs.map(item => jobRow(item, false))}{!othersJobs.length && <p className="m3-empty">No other jobs in motion.</p>}</div>
          {sectionHead('Coming up', <button type="button" className="m3-quiet-link" onClick={() => openCreate('event')}>Add event <Icon name="plus" size={15} /></button>)}
          <div className="m3-card">{visibleEvents.map(item => <button className="m3-list-row" key={item.id} type="button" onClick={() => openEvent(item.id)}><span className="m3-list-icon is-warm"><Icon name="calendar" size={20} /></span><span className="m3-list-copy"><strong>{item.title}</strong><small>{spaceName(item.space)} · {item.when}</small></span><Icon name="arrow" size={17} /></button>)}{!visibleEvents.length && <p className="m3-empty">Nothing planned yet. Make the first plan.</p>}</div>
        </>}
      </main>

      <nav className="m3-nav" aria-label="Main navigation"><button type="button" className={tab === 'today' ? 'active' : ''} onClick={() => changeTab('today')}><Icon name="home" size={22} /><span>Today</span></button><button type="button" className={tab === 'spaces' ? 'active' : ''} onClick={() => changeTab('spaces')}><Icon name="grid" size={22} /><span>Spaces</span></button><button type="button" className="m3-add-tab" aria-label="Add to Commune" onClick={() => setPanel('add')}><span><Icon name="plus" size={24} /></span><small>Add</small></button><button type="button" className={tab === 'money' ? 'active' : ''} onClick={() => changeTab('money')}><Icon name="money" size={22} /><span>Money</span></button><button type="button" className={tab === 'plans' ? 'active' : ''} onClick={() => changeTab('plans')}><Icon name="checklist" size={22} /><span>Plans</span></button></nav>
      {toast && <div className="m3-toast" role="status">{toast}</div>}

      {panel && <><div className="m3-scrim" onClick={() => setPanel(null)} /><section className={`m3-sheet ${panel === 'form' ? 'm3-sheet--form' : ''}`} role="dialog" aria-modal="true" aria-label={panel === 'form' ? `Add ${createType}` : panel}>
        <div className="m3-sheet-head"><span className="m3-sheet-handle" /><button type="button" aria-label="Close" onClick={() => setPanel(null)}><Icon name="close" size={21} /></button></div>
        {panel === 'add' && <><div className="m3-sheet-intro"><p className="m3-eyebrow">MAKE IT HAPPEN</p><h2>What are we adding?</h2><p>Choose what your people need in the picture.</p></div><div className="m3-create-menu">{([['expense', 'Shared cost', 'Give every person a clear share.', 'receipt'], ['job', 'Job', 'Put a name and next turn to it.', 'checklist'], ['event', 'Event', 'Make the next plan easy to find.', 'calendar'], ['note', 'Note', 'Keep the useful details close.', 'pin']] as const).map(([type, title, copy, icon]) => <button type="button" key={type} onClick={() => openCreate(type)}><span className="m3-list-icon"><Icon name={icon} size={21} /></span><span><strong>{title}</strong><small>{copy}</small></span><Icon name="arrow" size={17} /></button>)}</div><button className="m3-sheet-muted" type="button" onClick={() => openCreate('space')}>Create a new space <Icon name="arrow" size={15} /></button></>}

        {panel === 'inbox' && <div className="m3-detail"><p className="m3-eyebrow">YOUR DAY, TOGETHER</p><h2>Needs you</h2><p>Money and jobs across all your spaces.</p><div className="m3-card">{needs.map(item => <button className="m3-list-row" type="button" key={item.id} onClick={() => item.type === 'expense' ? openExpense(item.id) : changeTab('plans', item.space)}><span className="m3-list-icon"><Icon name={item.icon} size={20} /></span><span className="m3-list-copy"><strong>{item.title}</strong><small>{spaceName(item.space)} · {item.detail}</small></span><Icon name="arrow" size={17} /></button>)}</div></div>}

        {panel === 'form' && <form className="m3-form" onSubmit={submitCreate}><div className="m3-sheet-intro"><p className="m3-eyebrow">ADD TO COMMUNE</p><h2>{createType === 'expense' ? 'A shared cost' : createType === 'job' ? 'A job for the group' : createType === 'event' ? 'A plan together' : createType === 'note' ? 'A useful note' : 'A new space'}</h2><p>{createType === 'space' ? 'Make a place for the people you do life with.' : 'Everyone will see the same details.'}</p></div>
          <label className="m3-field">{createType === 'space' ? 'Space name' : createType === 'expense' ? 'What was this for?' : createType === 'job' ? 'What needs doing?' : createType === 'event' ? 'What’s the plan?' : 'Note title'}<input value={formTitle} onChange={event => setFormTitle(event.target.value)} placeholder={createType === 'space' ? 'e.g. Our new place' : createType === 'expense' ? 'e.g. The big shop' : createType === 'job' ? 'e.g. Take the recycling out' : createType === 'event' ? 'e.g. Dinner together' : 'e.g. Spare keys'} /></label>
          {createType === 'space' ? <label className="m3-field">What kind of space?<select value={formKind} onChange={event => setFormKind(event.target.value as Space['kind'])}><option>Home</option><option>Work</option><option>Trip</option></select></label> : <label className="m3-field">Space<select value={formSpace} onChange={event => { setFormSpace(event.target.value); setIncluded(spaces.find(item => item.id === event.target.value)?.members ?? ['Alex']); setFormPayer('Alex'); setFormOwner('Alex'); }}>{spaces.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}
          {createType === 'expense' && <><div className="m3-form-grid"><label className="m3-field">Total amount<span className="m3-input-prefix"><b>£</b><input type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="0.00" value={formAmount} onChange={event => setFormAmount(event.target.value)} /></span></label><label className="m3-field">Paid by<select value={formPayer} onChange={event => setFormPayer(event.target.value)}>{spaces.find(item => item.id === formSpace)?.members.map(name => <option key={name}>{name}</option>)}</select></label></div><div className="m3-participants"><strong>Split equally with</strong><div>{spaces.find(item => item.id === formSpace)?.members.map(name => <label key={name}><input type="checkbox" checked={included.includes(name)} onChange={() => setIncluded(current => current.includes(name) ? current.filter(item => item !== name) : [...current, name])} /><Face name={name} size={28} />{name}</label>)}</div><small>{Number(formAmount) > 0 && included.length ? `${cash(calculateEqualSplit(Number(formAmount), included.length)[0]!)} each${Number(formAmount) * 100 % included.length ? ' (one share may differ by 1p)' : ''}` : 'Choose who shares this cost.'}</small></div><p className="m3-form-note">Commune records the split and confirmations. Payments happen outside the app.</p></>}
          {createType === 'job' && <><label className="m3-field">Who’s up?<select value={formOwner} onChange={event => setFormOwner(event.target.value)}>{spaces.find(item => item.id === formSpace)?.members.map(name => <option key={name}>{name}</option>)}</select></label><label className="m3-field">Due date<input type="date" value={formWhen} onChange={event => setFormWhen(event.target.value)} /></label><label className="m3-switch-field"><span><strong>Repeat this job</strong><small>Pass the next turn to another member.</small></span><input type="checkbox" checked={formRecurring} onChange={event => setFormRecurring(event.target.checked)} /></label><p className="m3-form-note">Only the assigned person can mark their job done.</p></>}
          {createType === 'event' && <><label className="m3-field">When?<input type="datetime-local" value={formWhen} onChange={event => setFormWhen(event.target.value)} /></label><label className="m3-field">Where?<input value={formWhere} onChange={event => setFormWhere(event.target.value)} placeholder="e.g. Central station" /></label></>}
          {createType === 'note' && <label className="m3-field">Details<textarea rows={5} value={formBody} onChange={event => setFormBody(event.target.value)} placeholder="What should everyone know?" /></label>}
          {formError && <p className="m3-error" role="alert">{formError}</p>}
          <button className="m3-primary" type="submit">{createType === 'space' ? 'Create space' : createType === 'expense' ? 'Add shared cost' : createType === 'job' ? 'Add job' : createType === 'event' ? 'Add event' : 'Pin note'}</button>
        </form>}

        {panel === 'expense' && selectedExpenseData && <div className="m3-detail"><p className="m3-eyebrow">{spaceName(selectedExpenseData.space).toUpperCase()} · SHARED MONEY</p><h2>{selectedExpenseData.title}</h2><p>Paid by {selectedExpenseData.paidBy} · {selectedExpenseData.due}</p><div className="m3-detail-total"><small>TOTAL COST</small><strong>{cash(selectedExpenseData.total)}</strong></div><div className="m3-detail-share-head"><strong>Everyone’s part</strong><span>Equal split</span></div><div className="m3-share-list">{Object.entries(selectedExpenseData.shares).map(([name, amount]) => <div key={name}><Face name={name} size={34} /><span><strong>{name}{name === 'Alex' ? ' (you)' : ''}</strong><small>{selectedExpenseData.confirmed.includes(name) ? 'Confirmed' : selectedExpenseData.claimed.includes(name) ? 'Sent · awaiting confirmation' : 'Still open'}</small></span><b>{cash(amount)}</b>{selectedExpenseData.paidBy === 'Alex' && name !== 'Alex' && !selectedExpenseData.confirmed.includes(name) && <button type="button" onClick={() => confirmShare(selectedExpenseData.id, name)}>Confirm</button>}</div>)}</div>{selectedExpenseData.paidBy !== 'Alex' && 'Alex' in selectedExpenseData.shares && !selectedExpenseData.confirmed.includes('Alex') && <button type="button" className="m3-primary" disabled={selectedExpenseData.claimed.includes('Alex')} onClick={() => claimShare(selectedExpenseData.id)}>{selectedExpenseData.claimed.includes('Alex') ? 'Waiting for payer confirmation' : `I’ve sent ${cash(selectedExpenseData.shares.Alex!)}`}</button>}<p className="m3-form-note">The person who paid confirms received shares. Commune does not move money.</p></div>}

        {panel === 'event' && selectedEventData && <div className="m3-detail"><p className="m3-eyebrow">{spaceName(selectedEventData.space).toUpperCase()} · UPCOMING EVENT</p><h2>{selectedEventData.title}</h2><div className="m3-event-details"><p><Icon name="calendar" size={20} />{selectedEventData.when}</p><p><Icon name="pin" size={20} />{selectedEventData.where}</p></div><button className="m3-primary" type="button" onClick={() => { changeTab('plans', selectedEventData.space); }}>See all plans</button></div>}

        {panel === 'notifications' && <div className="m3-detail"><p className="m3-eyebrow">YOUR UPDATES</p><h2>Notifications</h2><div className="m3-card"><button className="m3-list-row" type="button" onClick={() => { setPanel(null); changeTab('plans', 'home'); }}><span className="m3-list-icon"><Icon name="checklist" size={20} /></span><span className="m3-list-copy"><strong>Kitchen reset is your turn</strong><small>Maple House · Today</small></span></button><button className="m3-list-row" type="button" onClick={() => openExpense('shop')}><span className="m3-list-icon"><Icon name="receipt" size={20} /></span><span className="m3-list-copy"><strong>Jordan added The big shop</strong><small>Your share is {cash(initialExpenses[0]!.shares.Alex!)}</small></span></button></div></div>}

        {panel === 'profile' && <div className="m3-detail"><div className="m3-profile-top"><Face name="Alex" size={56} /><span><h2>Alex Morgan</h2><small>Your Commune account</small></span></div><div className="m3-detail-list"><div><span>Spaces</span><strong>{spaces.length} shared spaces</strong></div><div><span>Notifications</span><button className="m3-inline-toggle" type="button" aria-pressed={noticesOn} onClick={() => setNoticesOn(value => !value)}>{noticesOn ? 'On' : 'Off'}</button></div><div><span>Plan</span><strong>Standard preview</strong></div></div><p className="m3-form-note">This concept stores changes in this browser session only.</p></div>}

        {panel === 'invite' && activeSpace && <form className="m3-detail" onSubmit={event => { event.preventDefault(); if (!inviteEmail.includes('@')) return; setInvites(current => [...current, { space: activeSpace.id, email: inviteEmail }]); setInviteEmail(''); flash('Invite saved in this preview.'); }}><p className="m3-eyebrow">{activeSpace.name.toUpperCase()}</p><h2>Bring your people in.</h2><p>Everyone gets the same place to see what’s happening.</p><label className="m3-field">Email address<input type="email" required value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} placeholder="name@example.com" /></label><button className="m3-primary" type="submit">Add invite</button>{invites.filter(item => item.space === activeSpace.id).map(item => <p className="m3-pending-invite" key={item.email}>{item.email} · pending in this preview</p>)}</form>}

        {panel === 'fund' && <div className="m3-detail"><p className="m3-eyebrow">GROUP FUNDS</p><h2>Put something aside.</h2><p>A shared record of what your group is saving toward.</p><label className="m3-field">Space<select value={formSpace} onChange={event => setFormSpace(event.target.value)}>{spaces.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><div className="m3-detail-total"><small>RECORDED FOR THIS GROUP</small><strong>{cash((spaces.find(item => item.id === formSpace)?.fund ?? 0) + (pledges[formSpace] ?? 0))}</strong></div><label className="m3-field">Record a contribution<span className="m3-input-prefix"><b>£</b><input type="number" inputMode="decimal" min="0.01" step="0.01" value={pledgeAmount} onChange={event => setPledgeAmount(event.target.value)} placeholder="0.00" /></span></label><button className="m3-primary" type="button" onClick={() => { const amount = Number(pledgeAmount); if (!Number.isFinite(amount) || amount <= 0) return; setPledges(current => ({ ...current, [formSpace]: (current[formSpace] ?? 0) + amount })); setPledgeAmount(''); flash('Contribution recorded in this preview.'); }}>Record contribution</button><p className="m3-form-note">This is a record for the group. No money is held or transferred here.</p></div>}
      </section></>}
    </div>
    <p className="m3-stagefoot">Interactive product concept · Illustrative people and figures · No account changes</p>
  </div>;
}
