import { useState, type ReactNode } from 'react';

type Screen = 'home' | 'money' | 'tasks' | 'info';
type IconName = 'home' | 'money' | 'tasks' | 'info' | 'chevron' | 'arrow' | 'plus' | 'close' | 'check' | 'pin';

const members = [
  { name: 'Alex', image: '/avatars/alex.jpg' },
  { name: 'Jordan', image: '/avatars/jordan.jpg' },
  { name: 'Taylor', image: '/avatars/taylor.jpg' },
  { name: 'Casey', image: '/avatars/casey.jpg' },
];

const initialTasks = [
  { id: 'kitchen', title: 'Kitchen reset', owner: 0, due: 'Your turn · Today' },
  { id: 'recycling', title: 'Take the recycling out', owner: 1, due: 'Jordan · Thursday' },
  { id: 'plants', title: 'Water the plants', owner: 2, due: 'Taylor · Friday' },
];

const expenses = [
  { id: 'rent', title: 'September rent', category: 'Home', total: '£1,200.00', share: '£300.00', due: 'Paid', paid: true },
  { id: 'groceries', title: 'The big shop', category: 'Everyday', total: '£84.50', share: '£21.13', due: 'Due now', paid: false },
];

const navigation: { screen: Screen; label: string; icon: IconName }[] = [
  { screen: 'home', label: 'Home', icon: 'home' },
  { screen: 'money', label: 'Money', icon: 'money' },
  { screen: 'tasks', label: 'Tasks', icon: 'tasks' },
  { screen: 'info', label: 'Info', icon: 'info' },
];

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const paths: Record<IconName, ReactNode> = {
    home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /><path d="M9 21v-7h6v7" /></>,
    money: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M16.5 12h.01M7 9h5M7 13h3" /></>,
    tasks: <><path d="M9 5h12M9 12h12M9 19h12" /><path d="m3 5 1.4 1.4L7 3.8M3 12l1.4 1.4L7 10.8M3 19l1.4 1.4L7 17.8" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
    chevron: <path d="m6 9 6 6 6-6" />,
    arrow: <><path d="M4 12h16m-6-6 6 6-6 6" /></>,
    plus: <path d="M12 4v16M4 12h16" />,
    close: <path d="M5 5 19 19M19 5 5 19" />,
    check: <path d="m4 12 5 5L20 6" />,
    pin: <><path d="m8 3 8 8M14 3l7 7-3 1-3 3-2 7-2-7-3-3-3 1 3-9z" /></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" {...common}>{paths[name]}</svg>;
}

function Avatar({ index, size = 34 }: { index: number; size?: number }) {
  const member = members[index];
  return <img className="m-avatar" src={member.image} alt={member.name} width={size} height={size} style={{ width: size, height: size }} />;
}

function MemberStack() {
  return <div className="m-members" aria-label="Alex, Jordan, Taylor and Casey">{members.map((member, index) => <Avatar key={member.name} index={index} size={28} />)}</div>;
}

function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return <div className="m-section-title"><h2>{title}</h2>{action && <button type="button" onClick={onAction}>{action}<Icon name="arrow" size={15} /></button>}</div>;
}

export default function MobileAppConcept() {
  const [screen, setScreen] = useState<Screen>('home');
  const [completed, setCompleted] = useState<string[]>([]);
  const [groceriesPaid, setGroceriesPaid] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<string | null>(null);
  const [showGroups, setShowGroups] = useState(false);
  const [notice, setNotice] = useState('');
  const today = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const dueAmount = groceriesPaid ? '£0.00' : '£21.13';

  function toggleTask(id: string) {
    setCompleted(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  }

  function switchScreen(next: Screen) {
    setScreen(next);
    setSelectedExpense(null);
    setShowGroups(false);
    setNotice('');
  }

  return <div className="m-stage">
    <div className="m-stage__context"><a href="/editorial.html">commune.</a><span>Mobile app concept · Explore the screens below</span></div>
    <div className="m-app">
      <header className="m-header">
        <div><span className="m-wordmark">commune.</span><span className="m-header__label">YOUR SHARED SPACE</span></div>
        <Avatar index={0} size={36} />
      </header>

      <main className="m-content" id="mobile-main">
        <button className="m-group-switch" type="button" aria-expanded={showGroups} onClick={() => setShowGroups(value => !value)}><span>Maple House</span><Icon name="chevron" size={17} /></button>
        {showGroups && <div className="m-group-menu"><strong>Your groups</strong><button onClick={() => setShowGroups(false)}><span>Maple House</span><Icon name="check" size={17} /></button><p>More groups appear here when you create them.</p></div>}

        {screen === 'home' && <>
          <div className="m-page-intro"><p className="m-eyebrow">{today}</p><h1>Hello, Alex.</h1><p>Here’s what’s happening at home.</p></div>

          <section className="m-group-hero" aria-label="Maple House group">
            <img src="/company-life-home.jpg" alt="Two housemates hanging washing together outside their home" />
            <div className="m-group-hero__shade" />
            <div className="m-group-hero__copy"><span>THE PLACE YOU SHARE</span><h2>Maple House</h2><div><MemberStack /><span>4 people, one home</span></div></div>
          </section>

          <div className="m-overview" aria-label="Your group overview">
            <button onClick={() => switchScreen('money')}><span>Your money</span><strong>{dueAmount}</strong><small>{groceriesPaid ? 'All clear for now' : 'One share to settle'}</small></button>
            <button onClick={() => switchScreen('tasks')}><span>Your tasks</span><strong>{completed.includes('kitchen') ? 'Done' : '1 today'}</strong><small>{completed.includes('kitchen') ? 'Nice work, Alex' : 'Kitchen reset is yours'}</small></button>
          </div>

          <SectionTitle title="For your attention" />
          <div className="m-list">
            {!completed.includes('kitchen') && <button className="m-list-row" onClick={() => switchScreen('tasks')}><span className="m-list-row__icon m-list-row__icon--sage"><Icon name="tasks" size={20} /></span><span className="m-list-row__copy"><strong>Kitchen reset</strong><small>Your turn today</small></span><Icon name="arrow" size={18} /></button>}
            {!groceriesPaid && <button className="m-list-row" onClick={() => { switchScreen('money'); setSelectedExpense('groceries'); }}><span className="m-list-row__icon m-list-row__icon--cream"><Icon name="money" size={20} /></span><span className="m-list-row__copy"><strong>The big shop</strong><small>Your share · £21.13 due</small></span><Icon name="arrow" size={18} /></button>}
            {completed.includes('kitchen') && groceriesPaid && <p className="m-all-clear">Everything needing you is done. Enjoy the breathing room.</p>}
          </div>

          <SectionTitle title="Around the house" action="Open info" onAction={() => switchScreen('info')} />
          <div className="m-update"><span className="m-update__pin"><Icon name="pin" size={17} /> PINNED BY ALEX</span><p>Friends coming over on Saturday. Let’s get the house ready together.</p></div>
          <div className="m-activity"><Avatar index={1} size={30} /><p><strong>Jordan added the big shop</strong><span>Shared with the whole house</span></p></div>
        </>}

        {screen === 'money' && <>
          <div className="m-page-intro"><p className="m-eyebrow">SHARED MONEY</p><h1>Know where you stand.</h1><p>Your share, their share, and what’s paid.</p></div>
          <section className="m-balance"><span>YOUR SHARE TO SETTLE</span><strong>{dueAmount}</strong><p>{groceriesPaid ? 'You’re all caught up on your shares.' : 'From one shared expense. Pay Jordan your usual way, then mark it paid here.'}</p><div className="m-balance__bottom"><span>September at Maple House</span><span>£300.00 already paid</span></div></section>
          <SectionTitle title="Shared expenses" />
          <div className="m-expense-list">{expenses.map(expense => <button key={expense.id} className="m-expense-row" onClick={() => setSelectedExpense(expense.id)}><span className="m-expense-row__icon"><Icon name="money" size={19} /></span><span className="m-expense-row__text"><strong>{expense.title}</strong><small>{expense.category} · Your share {expense.share}</small></span><span className={`m-status ${expense.paid || groceriesPaid ? 'm-status--paid' : ''}`}>{expense.paid || groceriesPaid ? 'Paid' : 'Due'}</span></button>)}</div>
          <p className="m-explainer">Commune tracks the record. Your group pays each other using the method you already prefer.</p>
        </>}

        {screen === 'tasks' && <>
          <div className="m-page-intro"><p className="m-eyebrow">SHARED RESPONSIBILITIES</p><h1>Many hands, lighter work.</h1><p>Everyone knows what’s theirs this week.</p></div>
          <section className="m-task-progress"><div><span>THIS WEEK</span><strong>{completed.length} of {initialTasks.length} done</strong></div><div className="m-progress-track"><span style={{ width: `${completed.length / initialTasks.length * 100}%` }} /></div></section>
          <SectionTitle title="Your household jobs" />
          <div className="m-tasks">{initialTasks.map(task => <label key={task.id} className={`m-task ${completed.includes(task.id) ? 'm-task--done' : ''}`}><input type="checkbox" checked={completed.includes(task.id)} onChange={() => toggleTask(task.id)} /><span className="m-task__copy"><strong>{task.title}</strong><small>{task.due}</small></span><Avatar index={task.owner} size={32} /></label>)}</div>
          <div className="m-task-tip"><span>THE EVERYDAY, TOGETHER</span><p>Make the recurring jobs visible so no one person has to remember them all.</p></div>
        </>}

        {screen === 'info' && <>
          <div className="m-page-intro"><p className="m-eyebrow">HOUSE INFORMATION</p><h1>Find it without asking.</h1><p>The useful details live here for everyone.</p></div>
          <section className="m-info-note"><span><Icon name="pin" size={16} /> PINNED UPDATE</span><p>Friends coming over on Saturday. Let’s get the house ready together.</p><small>Alex · Maple House</small></section>
          <SectionTitle title="House essentials" />
          <div className="m-essentials">
            <details open><summary><span>Wi-Fi & access</span><Icon name="plus" size={17} /></summary><div><small>Network</small><strong>Maple House</strong><p>Spare keys are with Jordan. Let them know before you pop round.</p></div></details>
            <details><summary><span>Recycling & bins</span><Icon name="plus" size={17} /></summary><div><small>Collection</small><strong>Friday morning</strong><p>Put the recycling out on Thursday evening. The bins are beside the garden gate.</p></div></details>
            <details><summary><span>Living together</span><Icon name="plus" size={17} /></summary><div><p>Leave the kitchen ready for the next person, and give the house a heads-up when friends are staying.</p></div></details>
          </div>
          <div className="m-people"><SectionTitle title="Your people" /><div><MemberStack /><span>Alex, Jordan, Taylor and Casey</span></div></div>
        </>}
      </main>

      <nav className="m-tabbar" aria-label="App navigation">{navigation.map(item => <button key={item.screen} type="button" aria-current={screen === item.screen ? 'page' : undefined} onClick={() => switchScreen(item.screen)}><Icon name={item.icon} size={22} /><span>{item.label}</span></button>)}</nav>

      {selectedExpense && <div className="m-sheet-scrim" onClick={() => setSelectedExpense(null)}><section className="m-sheet" role="dialog" aria-modal="true" aria-labelledby="expense-title" onClick={event => event.stopPropagation()}><button className="m-sheet__close" aria-label="Close expense details" onClick={() => setSelectedExpense(null)}><Icon name="close" /></button><span className="m-eyebrow">MAPLE HOUSE / EXPENSE</span><h2 id="expense-title">{selectedExpense === 'rent' ? 'September rent' : 'The big shop'}</h2><div className="m-sheet__amount"><span>Total shared cost</span><strong>{selectedExpense === 'rent' ? '£1,200.00' : '£84.50'}</strong></div><div className="m-sheet__row"><span>Your share</span><strong>{selectedExpense === 'rent' ? '£300.00' : '£21.13'}</strong></div><div className="m-sheet__row"><span>Status</span><strong>{selectedExpense === 'rent' || groceriesPaid ? 'Marked paid' : 'Due'}</strong></div><div className="m-sheet__row"><span>Shared with</span><MemberStack /></div>{selectedExpense === 'groceries' && !groceriesPaid && <button className="m-primary-action" onClick={() => { setGroceriesPaid(true); setSelectedExpense(null); setNotice('Your share is marked paid.'); }}>I’ve paid Jordan</button>}<p className="m-sheet__footnote">Illustrative expense. Commune records payment status; money is sent separately.</p></section></div>}
      {notice && <div className="m-toast" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss message"><Icon name="close" size={15} /></button></div>}
    </div>
    <p className="m-stage__note">Interactive design concept · Illustrative data · <a href="/editorial.html">Back to the website</a></p>
  </div>;
}
