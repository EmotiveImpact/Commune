import { useRef, useState, type FormEvent } from 'react';
import { Icon } from './MobileIcon';

type Tab = 'today' | 'money' | 'operations' | 'space';
type SpaceId = 'home' | 'work' | 'trip';
type Panel = 'create' | 'expense' | 'settle' | 'activity' | 'notifications' | 'fund' | 'notes' | 'event' | 'invite' | 'settings' | null;
type CreateType = 'expense' | 'task' | 'event' | 'note';

type Expense = { id: string; space: SpaceId; title: string; category: string; amount: number; share: number; paidBy: string; due: string; recurring?: boolean; paid?: boolean };
type Task = { id: string; space: SpaceId; title: string; owner: string; due: string; kind: 'Recurring' | 'One-off' | 'Checklist'; rotation?: string[]; done?: boolean };
type Note = { id: string; space: SpaceId; title: string; body: string; pinned: boolean };
type Event = { id: string; space: SpaceId; title: string; when: string; where: string; createdBy: string };

const spaces: Record<SpaceId, {
  name: string; type: string; image: string; description: string; people: number; essentials: [string, string][];
  fund: number; fundName: string;
}> = {
  home: { name: 'Maple House', type: 'Home', image: '/company-hero-home.jpg', description: 'Four people, one place to feel at home.', people: 4, essentials: [['Wi-Fi', 'Maple House'], ['Recycling', 'Friday morning'], ['Spare keys', 'Jordan has the extra set']], fund: 186, fundName: 'Household pot' },
  work: { name: 'Common Ground', type: 'Workspace', image: '/company-hero-work.jpg', description: 'A shared studio, running smoothly.', people: 4, essentials: [['Access', 'Side entrance after 6pm'], ['Supplier', 'Northside Print Co.'], ['Studio rule', 'Leave the meeting table clear']], fund: 320, fundName: 'Studio fund' },
  trip: { name: 'The Coast Weekend', type: 'Trip', image: '/company-hero-trip.jpg', description: 'Good plans, good people, somewhere new.', people: 4, essentials: [['Stay', 'Harbour House'], ['Check-in', 'Friday, 3pm'], ['Meet', 'Central station, 10:15am']], fund: 144, fundName: 'Trip pot' },
};

const initialExpenses: Expense[] = [
  { id: 'rent', space: 'home', title: 'September rent', category: 'Home', amount: 1200, share: 300, paidBy: 'Alex', due: '1 September', recurring: true, paid: true },
  { id: 'shop', space: 'home', title: 'The big shop', category: 'Groceries', amount: 84.5, share: 21.13, paidBy: 'Jordan', due: 'Today' },
  { id: 'internet', space: 'home', title: 'Broadband', category: 'Utilities', amount: 48, share: 12, paidBy: 'Taylor', due: '12 October', recurring: true },
  { id: 'printing', space: 'work', title: 'Print order', category: 'Supplies', amount: 256, share: 64, paidBy: 'Casey', due: 'Today' },
  { id: 'studio', space: 'work', title: 'Studio rent', category: 'Workspace', amount: 880, share: 220, paidBy: 'Alex', due: '1 September', recurring: true, paid: true },
  { id: 'train', space: 'trip', title: 'Train tickets', category: 'Transport', amount: 148, share: 37, paidBy: 'Taylor', due: 'Today' },
  { id: 'stay', space: 'trip', title: 'Weekend stay', category: 'Accommodation', amount: 360, share: 90, paidBy: 'Jordan', due: 'Friday', paid: true },
];

const initialTasks: Task[] = [
  { id: 'kitchen', space: 'home', title: 'Kitchen reset', owner: 'Alex', due: 'Today', kind: 'Recurring', rotation: ['Alex', 'Jordan', 'Taylor', 'Casey'] },
  { id: 'recycling', space: 'home', title: 'Take the recycling out', owner: 'Jordan', due: 'Thursday', kind: 'Recurring', rotation: ['Jordan', 'Taylor', 'Casey', 'Alex'] },
  { id: 'groceries-list', space: 'home', title: 'Check the shopping list', owner: 'Taylor', due: 'Friday', kind: 'Checklist' },
  { id: 'keys', space: 'work', title: 'Collect new key cards', owner: 'Alex', due: 'Today', kind: 'One-off' },
  { id: 'stock', space: 'work', title: 'Restock paper and ink', owner: 'Casey', due: 'Thursday', kind: 'Recurring', rotation: ['Casey', 'Alex', 'Jordan', 'Taylor'] },
  { id: 'bags', space: 'trip', title: 'Pack the shared gear', owner: 'Alex', due: 'Thursday', kind: 'Checklist' },
  { id: 'checkin', space: 'trip', title: 'Confirm check-in time', owner: 'Jordan', due: 'Today', kind: 'One-off' },
];

const initialNotes: Note[] = [
  { id: 'home-saturday', space: 'home', title: 'Saturday at home', body: 'Friends are coming over on Saturday. Let’s get the house ready together.', pinned: true },
  { id: 'home-keys', space: 'home', title: 'Spare keys', body: 'Jordan has the extra set if you need them.', pinned: false },
  { id: 'work-cards', space: 'work', title: 'New key cards', body: 'The new key cards are ready at the front desk.', pinned: true },
  { id: 'trip-checkin', space: 'trip', title: 'Check-in details', body: 'Check-in starts at 3pm. I’ve pinned the address here.', pinned: true },
];

const initialEvents: Event[] = [
  { id: 'home-dinner', space: 'home', title: 'Dinner with friends', when: 'Saturday · 18:00', where: 'Maple House', createdBy: 'Jordan' },
  { id: 'work-review', space: 'work', title: 'Studio review', when: 'Thursday · 14:00', where: 'Meeting table', createdBy: 'Casey' },
  { id: 'trip-train', space: 'trip', title: 'Meet for the train', when: 'Friday · 10:15', where: 'Central station', createdBy: 'Taylor' },
];

const members = [
  { name: 'Alex', image: '/avatars/alex.jpg' }, { name: 'Jordan', image: '/avatars/jordan.jpg' },
  { name: 'Taylor', image: '/avatars/taylor.jpg' }, { name: 'Casey', image: '/avatars/casey.jpg' },
];

function Avatar({ name, size = 30 }: { name: string; size?: number }) {
  const person = members.find(member => member.name === name) ?? members[0];
  return <img className="v2-avatar" src={person.image} alt={person.name} width={size} height={size} style={{ width: size, height: size }} />;
}

function Avatars() { return <div className="v2-avatars" aria-label="Alex, Jordan, Taylor and Casey">{members.map(member => <Avatar name={member.name} key={member.name} size={27} />)}</div>; }
function money(value: number) { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value); }

function TaskRow({ task, done, onToggle }: { task: Task; done: boolean; onToggle: () => void }) {
  const isYours = task.owner === 'Alex';
  return <div className={`v2-task-row ${done ? 'is-done' : ''}`}>
    <label className="v2-task-control">
      <input type="checkbox" checked={done} disabled={!isYours} onChange={onToggle} aria-label={`${done ? 'Reopen' : 'Complete'} ${task.title}`} />
    </label>
    <span><strong>{task.title}</strong><small>{task.kind} · {task.due} · {isYours ? 'Your turn' : `${task.owner}'s turn`}</small></span>
    <Avatar name={task.owner} size={30} />
  </div>;
}

export default function MobileAppV2() {
  const scrollRef = useRef<HTMLElement>(null);
  const [spaceId, setSpaceId] = useState<SpaceId>('home');
  const [allSpaces, setAllSpaces] = useState(false);
  const [tab, setTab] = useState<Tab>('today');
  const [panel, setPanel] = useState<Panel>(null);
  const [spaceMenu, setSpaceMenu] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [confirmedShares, setConfirmedShares] = useState<Record<string, string[]>>({ rent: ['Taylor'], studio: ['Jordan', 'Taylor'] });
  const [doneIds, setDoneIds] = useState<string[]>([]);
  const [completedThisWeek, setCompletedThisWeek] = useState<Record<SpaceId, number>>({ home: 0, work: 0, trip: 0 });
  const [expenses, setExpenses] = useState(initialExpenses);
  const [tasks, setTasks] = useState(initialTasks);
  const [notes, setNotes] = useState(initialNotes);
  const [events, setEvents] = useState(initialEvents);
  const [pledges, setPledges] = useState<Partial<Record<SpaceId, { amount: number; due: string }>>>({});
  const [pledgeAmount, setPledgeAmount] = useState('');
  const [pledgeDue, setPledgeDue] = useState('');
  const [filter, setFilter] = useState<'All' | 'Due' | 'Paid'>('All');
  const [operationFilter, setOperationFilter] = useState<'All' | 'Recurring' | 'One-off' | 'Checklist'>('All');
  const [operationView, setOperationView] = useState<'Week' | 'People' | 'Month'>('Week');
  const [createType, setCreateType] = useState<CreateType>('expense');
  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formPayer, setFormPayer] = useState('Alex');
  const [taskOwner, setTaskOwner] = useState('Alex');
  const [formWhen, setFormWhen] = useState('');
  const [formWhere, setFormWhere] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'Member' | 'Admin'>('Member');
  const [draftInvites, setDraftInvites] = useState<{ space: SpaceId; email: string; role: 'Member' | 'Admin' }[]>([]);
  const [split, setSplit] = useState<'Equal' | 'By percent' | 'Exact amounts'>('Equal');
  const [allocations, setAllocations] = useState<Record<string, string>>({ Alex: '25', Jordan: '25', Taylor: '25', Casey: '25' });
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState('');
  const [noticesOn, setNoticesOn] = useState(true);
  const space = spaces[spaceId];
  const spaceExpenses = expenses.filter(expense => expense.space === spaceId);
  const spaceTasks = tasks.filter(task => task.space === spaceId);
  const spaceNotes = notes.filter(note => note.space === spaceId);
  const spaceEvents = events.filter(event => event.space === spaceId);
  const pinnedNote = spaceNotes.find(note => note.pinned);
  const isPaid = (expense: Expense) => Boolean(expense.paid || expense.paidBy === 'Alex');
  const dueNow = spaceExpenses.filter(expense => !isPaid(expense) && expense.due === 'Today').reduce((sum, expense) => sum + expense.share, 0);
  const toDo = spaceTasks.filter(task => !task.done && !doneIds.includes(task.id));
  const unpaidCount = spaceExpenses.filter(expense => !isPaid(expense)).length;
  const totalShare = spaceExpenses.reduce((sum, expense) => sum + expense.share, 0);
  const paidShare = spaceExpenses.filter(isPaid).reduce((sum, expense) => sum + expense.share, 0);
  const owedToYou = spaceExpenses.filter(expense => expense.paidBy === 'Alex').reduce((sum, expense) => sum + members.filter(member => member.name !== 'Alex' && !confirmedShares[expense.id]?.includes(member.name)).length * Math.round(expense.amount / space.people * 100) / 100, 0);
  const needsAcrossSpaces = [
    ...expenses.filter(expense => expense.due === 'Today' && !expense.paid && expense.paidBy !== 'Alex').map(expense => ({ id: expense.id, space: expense.space, title: expense.title, detail: `${money(expense.share)} to settle`, kind: 'expense' as const })),
    ...tasks.filter(task => task.owner === 'Alex' && task.due === 'Today' && !task.done && !doneIds.includes(task.id)).map(task => ({ id: task.id, space: task.space, title: task.title, detail: 'Your turn today', kind: 'task' as const })),
  ];

  function navigate(next: Tab) { setTab(next); if (next !== 'today') setAllSpaces(false); setPanel(null); setSpaceMenu(false); setToast(''); scrollRef.current?.scrollTo(0, 0); }
  function selectSpace(next: SpaceId) { setSpaceId(next); setAllSpaces(false); setTab('today'); setSpaceMenu(false); setPanel(null); setFilter('All'); scrollRef.current?.scrollTo(0, 0); }
  function showEverySpace() { setAllSpaces(true); setTab('today'); setSpaceMenu(false); setPanel(null); scrollRef.current?.scrollTo(0, 0); }
  function openExpense(expense: Expense) { setSelectedExpense(expense); setPanel('expense'); }
  function toggleTask(task: Task) {
    if (task.owner !== 'Alex') { setToast(`Only ${task.owner} can complete this job.`); return; }
    if (task.kind === 'Recurring') {
      const rotation = task.rotation?.length ? task.rotation : members.map(member => member.name);
      const nextOwner = rotation[(rotation.indexOf(task.owner) + 1) % rotation.length] ?? task.owner;
      setTasks(current => current.map(item => item.id === task.id ? { ...item, owner: nextOwner, due: 'Next week' } : item));
      setCompletedThisWeek(current => ({ ...current, [task.space]: current[task.space] + 1 }));
      setToast(`Done. The next turn belongs to ${nextOwner}.`);
      return;
    }
    setDoneIds(current => current.includes(task.id) ? current.filter(item => item !== task.id) : [...current, task.id]);
    setToast(doneIds.includes(task.id) ? 'Job reopened.' : 'Done. Your group can see the update.');
  }
  function confirmReceived(expense: Expense, memberName: string) {
    if (expense.paidBy !== 'Alex' || memberName === 'Alex') return;
    setConfirmedShares(current => ({ ...current, [expense.id]: [...(current[expense.id] ?? []), memberName] }));
    setToast(`${memberName}'s share confirmed as received. No money moved in Commune.`);
  }
  function openCreate(type: CreateType = 'expense') { setCreateType(type); setFormTitle(''); setFormBody(''); setFormAmount(''); setFormPayer('Alex'); setTaskOwner('Alex'); setFormWhen(''); setFormWhere(''); setSplit('Equal'); setAllocations({ Alex: '25', Jordan: '25', Taylor: '25', Casey: '25' }); setFormError(''); setPanel('create'); }
  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = formTitle.trim();
    if (!title) return;
    if (createType === 'expense') {
      const amount = Number(formAmount);
      if (!Number.isFinite(amount) || amount <= 0) return;
      const allocated = members.map(member => Number(allocations[member.name]));
      if (split !== 'Equal' && allocated.some(value => !Number.isFinite(value) || value < 0)) { setFormError('Enter a valid amount for every person.'); return; }
      const allocatedTotal = allocated.reduce((sum, value) => sum + value, 0);
      if (split === 'By percent' && Math.abs(allocatedTotal - 100) > .001) { setFormError('Percentages need to add up to 100%.'); return; }
      if (split === 'Exact amounts' && Math.abs(allocatedTotal - amount) > .005) { setFormError(`Exact shares need to add up to ${money(amount)}.`); return; }
      const share = split === 'Equal' ? Math.round(amount / space.people * 100) / 100 : split === 'By percent' ? Math.round(amount * allocated[0]!) / 100 : allocated[0]!;
      setExpenses(current => [{ id: `new-${Date.now()}`, space: spaceId, title, category: 'Other', amount, share, paidBy: formPayer, due: 'Today', paid: formPayer === 'Alex' }, ...current]);
      setTab('money'); setToast('Expense added to the preview.');
    } else if (createType === 'task') {
      setTasks(current => [{ id: `new-${Date.now()}`, space: spaceId, title, owner: taskOwner, due: 'Today', kind: 'One-off' }, ...current]);
      setTab('operations'); setToast('Task added to the preview.');
    } else if (createType === 'event') {
      if (!formWhen.trim() || !formWhere.trim()) return;
      const when = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(formWhen));
      setEvents(current => [{ id: `new-${Date.now()}`, space: spaceId, title, when, where: formWhere.trim(), createdBy: 'Alex' }, ...current]);
      setTab('operations'); setToast('Event added to the preview.');
    } else {
      if (!formBody.trim()) return;
      setNotes(current => [{ id: `new-${Date.now()}`, space: spaceId, title, body: formBody.trim(), pinned: true }, ...current]); setTab('space'); setToast('Note pinned to this space.');
    }
    setPanel(null); setFormTitle(''); setFormBody(''); setFormAmount(''); scrollRef.current?.scrollTo(0, 0);
  }

  return <div className="v2-stage">
    <div className="v2-stage-bar"><a className="v2-stage-logo" href="/editorial.html">commune.</a><div><a href="/mobile-app.html">Version 1</a><span aria-current="page">Version 2.0</span></div></div>
    <div className="v2-phone">
      <header className="v2-topbar"><div><strong>commune.</strong><span>For people who do life together.</span></div><div className="v2-header-actions"><button className="v2-bell" type="button" aria-label="Notifications" onClick={() => setPanel('notifications')}><Icon name="bell" size={20} />{noticesOn && <i />}</button><button className="v2-profile-button" type="button" aria-label="Profile and settings" onClick={() => setPanel('settings')}><Avatar name="Alex" size={36} /></button></div></header>
      <main className="v2-scroll" ref={scrollRef}>
        <div className="v2-space-control"><button type="button" aria-expanded={spaceMenu} onClick={() => setSpaceMenu(value => !value)}><span className="v2-space-dot" />{allSpaces ? 'All spaces' : space.name}<Icon name="chevron" size={16} /></button><span>{allSpaces ? 'OVERVIEW' : space.type.toUpperCase()}</span></div>
        {spaceMenu && <div className="v2-space-menu" role="menu"><button type="button" role="menuitem" onClick={showEverySpace}><span className="v2-all-spaces-icon"><Icon name="grid" size={20} /></span><span><strong>All spaces</strong><small>Your shared life in one view</small></span>{allSpaces && <Icon name="check" size={18} />}</button>{(Object.keys(spaces) as SpaceId[]).map(id => <button type="button" role="menuitem" key={id} onClick={() => selectSpace(id)}><img src={spaces[id].image} alt="" /><span><strong>{spaces[id].name}</strong><small>{spaces[id].type}</small></span>{!allSpaces && id === spaceId && <Icon name="check" size={18} />}</button>)}</div>}

        {tab === 'today' && (allSpaces ? <>
          <div className="v2-title"><p>YOUR PLACES, TOGETHER</p><h1>Morning, Alex.</h1><span>{needsAcrossSpaces.length} things need you across {Object.keys(spaces).length} spaces.</span></div>
          <div className="v2-section-heading"><h2>Needs you</h2></div>
          <div className="v2-rows">{needsAcrossSpaces.map(item => <button className="v2-action-row" key={item.id} onClick={() => { selectSpace(item.space); if (item.kind === 'expense') { setTab('money'); const expense = expenses.find(row => row.id === item.id); if (expense) openExpense(expense); } else navigate('operations'); }}><span className="v2-row-icon"><Icon name={item.kind === 'expense' ? 'receipt' : 'checklist'} size={18} /></span><span className="v2-row-copy"><strong>{item.title}</strong><small>{spaces[item.space].name} · {item.detail}</small></span><Icon name="arrow" size={17} /></button>)}{needsAcrossSpaces.length === 0 && <p className="v2-empty-inline">Nothing needs you right now.</p>}</div>
          <div className="v2-section-heading"><h2>Your spaces</h2></div>
          <div className="v2-all-spaces">{(Object.keys(spaces) as SpaceId[]).map(id => <button type="button" key={id} onClick={() => selectSpace(id)}><img src={spaces[id].image} alt="" /><span><small>{spaces[id].type.toUpperCase()} · {spaces[id].people} PEOPLE</small><strong>{spaces[id].name}</strong><em>Open space <Icon name="arrow" size={15} /></em></span></button>)}</div>
        </> : <>
          <div className="v2-title"><p>YOUR DAY, TOGETHER</p><h1>Morning, Alex.</h1><span>{space.description}</span></div>
          <div className="v2-cover"><img src={space.image} alt={`${space.type} shared by the group`} /><div><span>{space.type} space</span><strong>{space.name}</strong><p><Avatars /> {space.people} people</p></div></div>
          <div className="v2-priority"><div><span>NEEDS YOUR ATTENTION</span><strong>{(dueNow > 0 ? 1 : 0) + (toDo.some(task => task.owner === 'Alex' && task.due === 'Today') ? 1 : 0)}</strong></div><p>One place to see what’s yours today.</p></div>
          <div className="v2-section-heading"><h2>Up next</h2><button onClick={() => setPanel('activity')}>Activity <Icon name="arrow" size={15} /></button></div>
          <div className="v2-rows">
            {spaceExpenses.filter(expense => !isPaid(expense) && expense.due === 'Today').slice(0, 1).map(expense => <button className="v2-action-row" key={expense.id} onClick={() => openExpense(expense)}><span className="v2-row-icon"><Icon name="receipt" size={18} /></span><span className="v2-row-copy"><strong>{expense.title}</strong><small>Your share is due · paid by {expense.paidBy}</small></span><b>{money(expense.share)}</b></button>)}
            {toDo.filter(task => task.owner === 'Alex' && task.due === 'Today').slice(0, 1).map(task => <button className="v2-action-row" key={task.id} onClick={() => navigate('operations')}><span className="v2-row-icon v2-row-icon--sage"><Icon name="checklist" size={18} /></span><span className="v2-row-copy"><strong>{task.title}</strong><small>Your turn today · {task.kind.toLowerCase()}</small></span><Icon name="arrow" size={17} /></button>)}
            {dueNow === 0 && !toDo.some(task => task.owner === 'Alex' && task.due === 'Today') && <p className="v2-empty-inline">You’re all caught up here. Enjoy the breathing room.</p>}
          </div>
          <div className="v2-section-heading"><h2>This space</h2><button onClick={() => navigate('space')}>See space <Icon name="arrow" size={15} /></button></div>
          <div className="v2-overview"><button onClick={() => navigate('money')}><span><Icon name="money" size={17} /> Money</span><strong>{money(totalShare - paidShare)}</strong><small>{unpaidCount} open {unpaidCount === 1 ? 'share' : 'shares'}</small></button><button onClick={() => navigate('operations')}><span><Icon name="checklist" size={17} /> Operations</span><strong>{toDo.length}</strong><small>jobs in motion</small></button></div>
          <button className="v2-pinned" onClick={() => setPanel('notes')}><span><Icon name="pin" size={14} /> PINNED NOTE</span><strong>{pinnedNote?.body ?? 'Keep the details your group needs close.'}</strong><Icon name="arrow" size={17} /></button>
        </>)}

        {tab === 'money' && <>
          <div className="v2-title"><p>SHARED MONEY</p><h1>The money picture.</h1><span>What’s paid, what’s due, and who paid for it.</span></div>
          <div className="v2-money-card"><div><span>YOUR SHARE · THIS SPACE</span><strong>{money(totalShare)}</strong></div><div className="v2-money-bar"><span style={{ width: `${totalShare ? paidShare / totalShare * 100 : 0}%` }} /></div><p><b>{money(paidShare)}</b> confirmed <span>·</span> <b>{money(totalShare - paidShare)}</b> to settle</p><button onClick={() => setPanel('settle')}>See settlement <Icon name="arrow" size={15} /></button></div>
          {owedToYou > 0 && <button className="v2-owed-card" onClick={() => setPanel('settle')}><span>YOU ARE OWED</span><strong>{money(owedToYou)}</strong><small>Confirm each share when you receive it <Icon name="arrow" size={15} /></small></button>}
          <div className="v2-section-heading"><h2>Expenses</h2><button onClick={() => openCreate('expense')}>Add expense <Icon name="plus" size={16} /></button></div>
          <div className="v2-chips" aria-label="Filter expenses">{(['All', 'Due', 'Paid'] as const).map(value => <button aria-pressed={filter === value} key={value} onClick={() => setFilter(value)}>{value}</button>)}</div>
          <div className="v2-rows v2-expenses">{spaceExpenses.filter(expense => filter === 'All' || (filter === 'Paid' ? isPaid(expense) : !isPaid(expense))).map(expense => <button key={expense.id} className="v2-expense-row" onClick={() => openExpense(expense)}><span className="v2-row-icon"><Icon name={expense.recurring ? 'calendar' : 'receipt'} size={18} /></span><span className="v2-row-copy"><strong>{expense.title}</strong><small>{expense.category} · {expense.recurring ? 'Repeats monthly' : `Paid by ${expense.paidBy}`}</small></span><span className="v2-expense-end"><b>{money(expense.share)}</b><em className={isPaid(expense) ? 'is-paid' : ''}>{isPaid(expense) ? 'Paid' : 'Due'}</em></span></button>)}</div>
          <button className="v2-money-footer" onClick={() => setPanel('fund')}><Icon name="wallet" size={18} /><span>Shared fund: <strong>{money(space.fund)}</strong> in {space.fundName}</span><Icon name="arrow" size={15} /></button>
        </>}

        {tab === 'operations' && <>
          <div className="v2-title"><p>SHARED OPERATIONS</p><h1>Everyone has their part.</h1><span>Jobs, events and the plans you make together.</span></div>
          <div className="v2-operations-summary"><div><span>YOUR RESPONSIBILITIES</span><strong>{toDo.filter(task => task.owner === 'Alex').length} open · {completedThisWeek[spaceId]} completed</strong></div><div className="v2-money-bar"><span style={{ width: `${spaceTasks.length ? completedThisWeek[spaceId] / (spaceTasks.length + completedThisWeek[spaceId]) * 100 : 0}%` }} /></div></div>
          <div className="v2-section-heading"><h2>Board</h2><button onClick={() => openCreate('task')}>Add job <Icon name="plus" size={16} /></button></div>
          <div className="v2-chips" aria-label="Operations view">{(['Week', 'People', 'Month'] as const).map(value => <button aria-pressed={operationView === value} key={value} onClick={() => setOperationView(value)}>{value}</button>)}</div>
          <div className="v2-chips v2-chips--scroll" aria-label="Filter operations">{(['All', 'Recurring', 'One-off', 'Checklist'] as const).map(value => <button aria-pressed={operationFilter === value} key={value} onClick={() => setOperationFilter(value)}>{value}</button>)}</div>
          {operationView === 'Week' && <div className="v2-rows v2-task-list">{spaceTasks.filter(task => operationFilter === 'All' || task.kind === operationFilter).map(task => <TaskRow key={task.id} task={task} done={Boolean(task.done || doneIds.includes(task.id))} onToggle={() => toggleTask(task)} />)}</div>}
          {operationView === 'People' && <div className="v2-people-board">{members.map(member => { const personTasks = spaceTasks.filter(task => task.owner === member.name && (operationFilter === 'All' || task.kind === operationFilter)); return <section key={member.name}><div><Avatar name={member.name} size={30} /><strong>{member.name}{member.name === 'Alex' ? ' (you)' : ''}</strong><small>{personTasks.length} {personTasks.length === 1 ? 'job' : 'jobs'}</small></div>{personTasks.length ? <div className="v2-rows">{personTasks.map(task => <TaskRow key={task.id} task={task} done={Boolean(task.done || doneIds.includes(task.id))} onToggle={() => toggleTask(task)} />)}</div> : <p>Nothing assigned.</p>}</section>; })}</div>}
          {operationView === 'Month' && <div className="v2-month-board">{['Today', 'Thursday', 'Friday', 'Next week'].map(due => { const dayTasks = spaceTasks.filter(task => task.due === due && (operationFilter === 'All' || task.kind === operationFilter)); return dayTasks.length ? <section key={due}><h3>{due}</h3><div className="v2-rows">{dayTasks.map(task => <TaskRow key={task.id} task={task} done={Boolean(task.done || doneIds.includes(task.id))} onToggle={() => toggleTask(task)} />)}</div></section> : null; })}</div>}
          <div className="v2-board-note"><Icon name="spark" size={18} /><p>Only the assigned person can complete a job. Recurring jobs move to the next person when their turn is done.</p></div>
          <div className="v2-section-heading"><h2>Coming up together</h2><button onClick={() => openCreate('event')}>Add event <Icon name="plus" size={16} /></button></div>
          <div className="v2-rows">{spaceEvents.map(event => <button className="v2-action-row" key={event.id} onClick={() => { setSelectedEvent(event); setPanel('event'); }}><span className="v2-row-icon v2-row-icon--sage"><Icon name="calendar" size={18} /></span><span className="v2-row-copy"><strong>{event.title}</strong><small>{event.when} · {event.where}</small></span><Icon name="arrow" size={17} /></button>)}</div>
        </>}

        {tab === 'space' && <>
          <div className="v2-title"><p>YOUR SHARED SPACE</p><h1>{space.name}.</h1><span>{space.description}</span></div>
          <div className="v2-space-image"><img src={space.image} alt={`${space.type} shared by the group`} /><span>{space.type} · {space.people} members</span></div>
          <div className="v2-section-heading"><h2>Pinned for everyone</h2><button onClick={() => setPanel('notes')}>All notes <Icon name="arrow" size={16} /></button></div>
          <button className="v2-space-note" onClick={() => setPanel('notes')}><Icon name="pin" size={16} /><p>{pinnedNote?.body ?? 'No pinned note yet.'}</p><small>{spaceNotes.length} shared {spaceNotes.length === 1 ? 'note' : 'notes'}</small></button>
          <div className="v2-section-heading"><h2>Essentials</h2></div>
          <div className="v2-essentials">{space.essentials.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
          <div className="v2-section-heading"><h2>Your people</h2><button onClick={() => { setInviteEmail(''); setInviteRole('Member'); setPanel('invite'); }}>Invite <Icon name="plus" size={16} /></button></div>
          <div className="v2-member-list">{members.map(member => <div key={member.name}><Avatar name={member.name} size={34} /><span>{member.name}{member.name === 'Alex' ? ' (you)' : ''}</span><small>{member.name === 'Alex' ? 'Admin' : 'Member'}</small></div>)}</div>
          {draftInvites.filter(invite => invite.space === spaceId).map(invite => <p className="v2-invite-draft" key={invite.email}>Draft invite · {invite.email} · {invite.role}</p>)}
          <div className="v2-section-heading"><h2>Shared records</h2></div>
          <div className="v2-space-links"><button onClick={() => setPanel('fund')}><Icon name="wallet" size={18} /><span>{space.fundName}<small>Contributions and pledges</small></span><Icon name="arrow" size={16} /></button><button onClick={() => setPanel('settle')}><Icon name="money" size={18} /><span>Settlement<small>What’s owed and confirmed</small></span><Icon name="arrow" size={16} /></button><button onClick={() => setPanel('activity')}><Icon name="clock" size={18} /><span>Activity<small>What your group has changed</small></span><Icon name="arrow" size={16} /></button></div>
        </>}
      </main>
      <nav className="v2-nav" aria-label="App navigation">
        <button aria-current={tab === 'today' ? 'page' : undefined} onClick={() => navigate('today')}><Icon name="home" size={21} /><span>Today</span></button>
        <button aria-current={tab === 'money' ? 'page' : undefined} onClick={() => navigate('money')}><Icon name="money" size={21} /><span>Money</span></button>
        <button className="v2-nav-create" type="button" aria-label="Create expense, job, event or note" onClick={() => openCreate()}><span className="v2-nav-create-icon"><Icon name="plus" size={23} /></span><span>Add</span></button>
        <button aria-current={tab === 'operations' ? 'page' : undefined} onClick={() => navigate('operations')}><Icon name="checklist" size={21} /><span>Jobs</span></button>
        <button aria-current={tab === 'space' ? 'page' : undefined} onClick={() => navigate('space')}><Icon name="grid" size={21} /><span>Space</span></button>
      </nav>

      {panel && <div className="v2-scrim" onClick={() => setPanel(null)}><section className="v2-sheet" role="dialog" aria-modal="true" aria-label={`${panel} details`} onClick={event => event.stopPropagation()}><button type="button" className="v2-sheet-close" aria-label="Close" onClick={() => setPanel(null)}><Icon name="close" size={18} /></button>
        {panel === 'create' && <>
          <span className="v2-sheet-kicker">ADD TO {space.name.toUpperCase()}</span>
          <h2>What shall we add?</h2>
          <div className="v2-chips">{(['expense', 'task', 'event', 'note'] as CreateType[]).map(value =>
            <button aria-pressed={createType === value} key={value} onClick={() => { setCreateType(value); setFormError(''); }}>
              {value === 'task' ? 'Job' : value === 'event' ? 'Event' : value === 'note' ? 'Pinned note' : 'Expense'}
            </button>)}</div>
          <form className="v2-form" onSubmit={submitCreate}>
            <label>Title
              <input autoFocus value={formTitle} onChange={event => setFormTitle(event.target.value)}
                placeholder={createType === 'expense' ? 'e.g. Dinner supplies' : createType === 'task' ? 'e.g. Pick up the keys' : createType === 'event' ? 'e.g. Group dinner' : 'What should everyone know?'} required />
            </label>
            {createType === 'note' && <label>Details<textarea value={formBody} onChange={event => setFormBody(event.target.value)} placeholder="Write the details your group needs" rows={4} required /></label>}
            {createType === 'expense' && <>
              <label>Amount (£)<input type="number" inputMode="decimal" min="0.01" step="0.01" value={formAmount} onChange={event => setFormAmount(event.target.value)} placeholder="0.00" required /></label>
              <label>Paid by<select value={formPayer} onChange={event => setFormPayer(event.target.value)}>{members.map(member => <option key={member.name}>{member.name}</option>)}</select></label>
              <label>Split method<select value={split} onChange={event => {
                const next = event.target.value as typeof split;
                setSplit(next); setFormError('');
                const cents = Math.round(Number(formAmount || 0) * 100);
                const base = Math.floor(cents / space.people);
                setAllocations(Object.fromEntries(members.map((member, index) => [member.name, next === 'Exact amounts' ? ((base + (index < cents % space.people ? 1 : 0)) / 100).toFixed(2) : '25'])));
              }}><option>Equal</option><option>By percent</option><option>Exact amounts</option></select></label>
              {split === 'Equal' ? <p className="v2-form-hint">{money(Number(formAmount || 0) / space.people)} per person across {space.people} members.</p> :
                <div className="v2-allocation"><span>{split === 'By percent' ? 'Assign percentages' : 'Assign exact shares'}</span>
                  {members.map(member => <label key={member.name}><Avatar name={member.name} size={26} />{member.name}
                    <input type="number" inputMode="decimal" min="0" step="0.01" value={allocations[member.name] ?? ''}
                      onChange={event => { setAllocations(current => ({ ...current, [member.name]: event.target.value })); setFormError(''); }} />
                    <small>{split === 'By percent' ? '%' : '£'}</small>
                  </label>)}
                </div>}
              {formError && <p className="v2-form-error" role="alert">{formError}</p>}
            </>}
            {createType === 'task' && <label>Assigned to<select value={taskOwner} onChange={event => setTaskOwner(event.target.value)}>{members.map(member => <option key={member.name}>{member.name}</option>)}</select><small className="v2-form-secondary">Only this person can mark the job complete.</small></label>}
            {createType === 'event' && <><label>When<input type="datetime-local" value={formWhen} onChange={event => setFormWhen(event.target.value)} required /></label><label>Where<input value={formWhere} onChange={event => setFormWhere(event.target.value)} placeholder="e.g. The studio" required /></label></>}
            <button className="v2-primary" type="submit">{createType === 'expense' ? 'Add expense' : createType === 'task' ? 'Add job' : createType === 'event' ? 'Add event' : 'Pin note'}</button>
          </form>
        </>}
        {panel === 'expense' && selectedExpense && <>
          <span className="v2-sheet-kicker">{space.name.toUpperCase()} / EXPENSE</span><h2>{selectedExpense.title}</h2>
          <div className="v2-detail-amount"><span>Total cost</span><strong>{money(selectedExpense.amount)}</strong><small>{selectedExpense.category} · {selectedExpense.recurring ? 'Recurring monthly' : `Due ${selectedExpense.due.toLowerCase()}`}</small></div>
          <div className="v2-detail-line"><span>Your part</span><strong>{money(selectedExpense.share)}</strong></div>
          <div className="v2-detail-line"><span>Paid by</span><strong>{selectedExpense.paidBy}</strong></div>
          <div className="v2-detail-line"><span>Shared with</span><Avatars /></div>
          <div className="v2-detail-line"><span>Your status</span><em className={isPaid(selectedExpense) ? 'is-paid' : ''}>{selectedExpense.paidBy === 'Alex' ? 'You paid the bill' : isPaid(selectedExpense) ? 'Confirmed by payer' : 'Awaiting payer confirmation'}</em></div>
          <button className="v2-primary" onClick={() => setPanel('settle')}>{selectedExpense.paidBy === 'Alex' ? 'Review shares owed to you' : 'View settlement'}</button>
          <p className="v2-quiet">Arrange payment outside Commune. Only the person who paid the bill can confirm receiving a share.</p>
        </>}
        {panel === 'settle' && <>
          <span className="v2-sheet-kicker">SETTLEMENT</span><h2>Know where everyone stands.</h2>
          <div className="v2-settle-hero"><span>You owe in {space.name}</span><strong>{money(totalShare - paidShare)}</strong></div>
          {spaceExpenses.filter(expense => !isPaid(expense)).map(expense => <button className="v2-settle-row" key={expense.id} onClick={() => openExpense(expense)}><Avatar name={expense.paidBy} size={34} /><span><strong>Pay {expense.paidBy}</strong><small>{expense.title}</small></span><b>{money(expense.share)}</b></button>)}
          {!spaceExpenses.some(expense => !isPaid(expense)) && <p className="v2-empty-inline">You have no open shares here.</p>}
          <div className="v2-section-heading"><h2>You are owed {money(owedToYou)}</h2></div>
          {spaceExpenses.filter(expense => expense.paidBy === 'Alex').flatMap(expense => members.filter(member => member.name !== 'Alex' && !confirmedShares[expense.id]?.includes(member.name)).map(member => <div className="v2-receivable" key={`${expense.id}-${member.name}`}><Avatar name={member.name} size={32} /><span><strong>{member.name}</strong><small>{expense.title} · {money(Math.round(expense.amount / space.people * 100) / 100)}</small></span><button type="button" onClick={() => confirmReceived(expense, member.name)}>Confirm received</button></div>))}
          {owedToYou === 0 && <p className="v2-empty-inline">Nothing outstanding to you.</p>}
          <p className="v2-quiet">These are records of shares. Commune does not send or hold money.</p>
        </>}
        {panel === 'activity' && <><span className="v2-sheet-kicker">RECENT ACTIVITY</span><h2>What’s been happening.</h2><div className="v2-activity"><div><Avatar name="Jordan" /><p><strong>Jordan added an expense</strong><small>The big shop · {space.name}</small></p></div><div><Avatar name="Taylor" /><p><strong>Taylor updated a task</strong><small>Your group can see the latest changes</small></p></div><div><Avatar name="Alex" /><p><strong>Alex pinned a note</strong><small>Useful details stay close</small></p></div></div></>}
        {panel === 'notifications' && <><span className="v2-sheet-kicker">NOTIFICATIONS</span><h2>For your attention.</h2><div className="v2-activity"><div><span className="v2-row-icon"><Icon name="receipt" /></span><p><strong>A share is due</strong><small>Open Money to see your part</small></p></div><div><span className="v2-row-icon"><Icon name="checklist" /></span><p><strong>It’s your turn today</strong><small>Open Jobs to see what’s next</small></p></div></div></>}
        {panel === 'fund' && <><span className="v2-sheet-kicker">SHARED FUND</span><h2>{space.fundName}.</h2><div className="v2-settle-hero"><span>Contributions recorded</span><strong>{money(space.fund)}</strong></div><div className="v2-detail-line"><span>Space</span><strong>{space.name}</strong></div><div className="v2-detail-line"><span>Purpose</span><strong>Shared costs</strong></div>{pledges[spaceId] ? <div className="v2-detail-line"><span>Your pledge · due {pledges[spaceId].due}</span><strong>{money(pledges[spaceId].amount)}</strong></div> : <form className="v2-form" onSubmit={event => { event.preventDefault(); const amount = Number(pledgeAmount); if (!Number.isFinite(amount) || amount <= 0 || !pledgeDue) return; setPledges(current => ({ ...current, [spaceId]: { amount, due: pledgeDue } })); setPledgeAmount(''); setPledgeDue(''); setToast('Pledge recorded in this preview.'); }}><label>Your pledge (£)<input type="number" min="0.01" step="0.01" inputMode="decimal" value={pledgeAmount} onChange={event => setPledgeAmount(event.target.value)} required /></label><label>Due date<input type="date" value={pledgeDue} onChange={event => setPledgeDue(event.target.value)} required /></label><button className="v2-primary" type="submit">Record pledge</button></form>}<p className="v2-quiet">A pledge does not increase the recorded contribution total. Commune does not hold this money.</p></>}
        {panel === 'notes' && <><span className="v2-sheet-kicker">SHARED NOTES</span><h2>Details everyone can find.</h2><div className="v2-notes-list">{spaceNotes.map(note => <div key={note.id}><span><strong>{note.title}</strong><small>{note.body}</small></span><button type="button" aria-label={`${note.pinned ? 'Unpin' : 'Pin'} ${note.title}`} onClick={() => setNotes(current => current.map(item => item.id === note.id ? { ...item, pinned: !item.pinned } : item))}>{note.pinned ? 'Pinned' : 'Pin'}</button></div>)}</div><button className="v2-primary" onClick={() => openCreate('note')}>Add a note</button></>}
        {panel === 'event' && selectedEvent && <><span className="v2-sheet-kicker">GROUP EVENT</span><h2>{selectedEvent.title}.</h2><div className="v2-detail-line"><span>When</span><strong>{selectedEvent.when}</strong></div><div className="v2-detail-line"><span>Where</span><strong>{selectedEvent.where}</strong></div><div className="v2-detail-line"><span>Added by</span><strong>{selectedEvent.createdBy}</strong></div><div className="v2-detail-line"><span>Shared with</span><Avatars /></div></>}
        {panel === 'invite' && <><span className="v2-sheet-kicker">INVITE TO {space.name.toUpperCase()}</span><h2>Bring someone in.</h2><form className="v2-form" onSubmit={event => { event.preventDefault(); const email = inviteEmail.trim().toLowerCase(); if (!email) return; setDraftInvites(current => [...current.filter(item => !(item.space === spaceId && item.email === email)), { space: spaceId, email, role: inviteRole }]); setPanel(null); setToast('Invite drafted in this preview. No email was sent.'); }}><label>Email address<input type="email" value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} placeholder="name@example.com" required /></label><label>Role<select value={inviteRole} onChange={event => setInviteRole(event.target.value as 'Member' | 'Admin')}><option>Member</option><option>Admin</option></select></label><p className="v2-form-hint">An admin can manage this space. This preview saves a draft only; it does not send email.</p><button className="v2-primary" type="submit">Preview invitation</button></form></>}
        {panel === 'settings' && <><span className="v2-sheet-kicker">YOUR ACCOUNT</span><h2>Profile & settings.</h2><div className="v2-settings-person"><Avatar name="Alex" size={50} /><div><strong>Alex</strong><small>Member of {space.name} and 2 other spaces</small></div></div><div className="v2-settings-list"><button onClick={() => { setPanel(null); navigate('space'); }}><span>Current space</span><strong>{space.name}</strong><Icon name="arrow" size={16} /></button><label><span>Notifications</span><small>Updates about your spaces</small><input type="checkbox" checked={noticesOn} onChange={event => setNoticesOn(event.target.checked)} /></label><button onClick={() => setPanel('notifications')}><span>Recent notifications</span><Icon name="arrow" size={16} /></button></div></>}
      </section></div>}
      {toast && <div className="v2-toast" role="status">{toast}<button aria-label="Dismiss" onClick={() => setToast('')}><Icon name="close" size={15} /></button></div>}
    </div>
    <p className="v2-stage-foot">Interactive product concept · Illustrative data, no account changes</p>
  </div>;
}
