import { useEffect, useRef, useState } from 'react';
import { BrandWordmark } from '../BrandWordmark';
import { SiteMenu, useSiteMenu } from './SiteMenu';
import { StoryJournal } from './StoryNotes';
import './story-notes.css';

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
export const plans = [
  { name: 'Standard', monthly: '4.99', annual: '49.99', detail: 'For your shared everyday.', groups: '1 group', people: 'Up to 8 members', photo: '/unique-standard.jpg', alt: 'Two housemates putting together a side table at home' },
  { name: 'Pro', monthly: '9.99', annual: '99.99', detail: 'For all the parts of your life.', groups: '3 groups', people: 'Up to 15 members per group', photo: '/unique-pro.jpg', alt: 'Three friends setting off on a train trip together' },
  { name: 'Collective', monthly: '29.99', annual: '299.99', detail: 'For everyone and everything you look after.', groups: 'Up to 10 groups', people: 'Up to 20 members per group', photo: '/company-plan-landlord.jpg', alt: 'Neighbours talking together outside their shared homes' },
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
export const questions = [
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

const guides = [
  { cat: 'Home', title: 'A shared home. A little less guesswork.', image: '/unique-journal-home.jpg', alt: 'Housemates sharing the Saturday morning kitchen routine' },
  { cat: 'Work', title: 'Good work starts on the same page.', image: '/unique-journal-work.jpg', alt: 'Two makers tidying their shared workshop' },
  { cat: 'Trips', title: 'A little planning for a better trip.', image: '/unique-journal-trip.jpg', alt: 'Friends looking across the bay from a ferry' },
  { cat: 'Couples', title: 'Moving in together: what to agree first.', image: '/t/g-real-sofa-couple.jpg', alt: 'A couple laughing at a phone on the sofa' },
  { cat: 'Home', title: 'A fair rota for a busy house.', image: '/t/g-real-washing-up.jpg', alt: 'Housemates washing up together', pos: 'center 45%' },
  { cat: 'Landlords', title: 'Bills and details for the homes you look after.', image: '/t/g-new-landlady.jpg', alt: 'A landlady at the door of a shared house' },
];
const guideIndex = [
  { cat: 'Home', title: 'Splitting the energy bill when someone works from home' },
  { cat: 'Trips', title: 'Sharing a holiday cottage without the awkward maths' },
  { cat: 'Couples', title: 'Who pays for what when you earn different amounts' },
  { cat: 'Work', title: 'Running a shared studio: rent, supplies and turns' },
  { cat: 'Home', title: 'Welcoming a new housemate in the first week' },
  { cat: 'Landlords', title: 'Keeping house details in one place for every tenant' },
];
const guideCats = ['All', 'Home', 'Couples', 'Work', 'Trips', 'Landlords'];
export const people = ['Alex', 'Jordan', 'Taylor', 'Casey'];

export function LinkButton({ children, href = signup, variant = '' }: { children: string; href?: string; variant?: string }) {
  return <a className={`l-button ${variant && `l-button--${variant}`}`} href={href}>{children}</a>;
}
export function Avatar({ index, named = false }: { index: number; named?: boolean }) {
  return <img className={`l-avatar l-avatar--${index}`} src={`/avatars/${people[index].toLowerCase()}.jpg`} alt={named ? people[index] : ''} loading="lazy" width="32" height="32" />;
}
function Avatars() {
  return <div className="l-avatars" aria-label="Four group members">{people.map((person, i) => <Avatar key={person} index={i} named />)}</div>;
}

const tourAll = [
  { tab: 'Shared money', title: 'Know where you stand.', body: 'Rent, bills and the food shop, split equally, by percentage or with custom amounts. Everyone sees the same balance.', photo: '/t/g-real-hallway.jpg', alt: 'Two housemates in the hallway, one back from the shops', pos: 'center 50%', glance: 'br', phone: 'money', bg: 'sage' },
  { tab: 'Pay links', title: 'Know where to send it.', body: "Add your Monzo, PayPal, Revolut or bank details. People pay you directly, then tap \"I've paid\". Commune never moves the money.", photo: '/t/g-new-floor-phone.jpg', alt: 'A young man on his bedroom floor smiling at his phone', pos: '62% 40%', glance: 'bl', phone: 'pay', bg: 'clay' },
  { tab: 'Everyday jobs', title: 'Everyone has their part.', body: 'Give each job a name and a next turn. When someone does it, the house sees who, and the turn moves on.', photo: '/cooking.png', alt: 'Three friends cooking together', pos: 'center 40%', glance: 'bl' },
  { tab: 'House details', title: 'Find it without asking.', body: 'The Wi-Fi password, bin day and who has the spare keys, kept where the whole house can open them.', photo: '/t/g-new-kitchen-pair.jpg', alt: 'Two friends laughing over coffee at a kitchen table', pos: '35% 40%', glance: 'tr' },
  { tab: 'Your people', title: 'Everyone on the same page.', body: 'Send one link to invite the house. Everyone sees the same balance, the same jobs and the same details.', photo: '/t/g-real-train.jpg', alt: 'Friends on a train', pos: '70% 50%', glance: 'tl' },
  { tab: 'Recurring bills', title: 'Set the rent once.', body: 'Rent, energy and broadband each have an amount, a payer and a next due date, so the house knows what is coming.', phone: 'recurring', bg: 'sky' },
  { tab: 'Shared funds', title: 'Save up together.', body: 'Start a fund for the new sofa or the deposit, set a target and record what each person puts in. Commune takes no payment.', photo: '/lifestyle-home.jpg', alt: 'Friends passing dishes at a garden lunch', pos: 'center 30%', glance: 'bl' },
  { tab: 'Split templates', title: 'Same split, every time.', body: 'Save how you usually divide things, like the bigger room paying more, and use it again for the next bill.', photo: '/t/g-new-sofa-phone.jpg', alt: 'A woman smiling at her phone on the sofa', pos: '65% center', glance: 'tl' },
  { tab: 'Announcements', title: 'Tell the whole house.', body: 'Post a notice everyone sees, like the boiler service on Thursday, without it getting lost in the group chat.', phone: 'announce', bg: 'sand' },
  { tab: 'Reminders', title: 'A nudge, not a nag.', body: 'Send a short email reminder when a share is due, so nobody has to chase anyone in person.', photo: '/t/g-new-window-phone.jpg', alt: 'A man checking his phone by a tall window', pos: 'center 60%', glance: 'tl' },
  { tab: 'Changes on record', title: 'Every change on record.', body: 'Fix a mistake or cancel an expense and Commune keeps the before and after, who changed it, when and why.', phone: 'history', bg: 'navy' },
  { tab: 'All your groups', title: 'One app, every group.', body: 'Your house, your relationship and the trip away each get their own space, and search finds anything across them.', photo: '/scene-city-friends.jpg', alt: 'Three friends at a cafe table in the sun', pos: 'center 70%', glance: 'tr' },
];
const tourTabs = ['Who owes what', 'Where to pay', 'Whose turn', 'Where things are', 'Who’s in', 'Bills that repeat', 'Saving up', 'Fair splits', 'House news', 'Gentle nudges', 'What changed', 'Every group'];
const tour = tourAll.map((t, n) => ({ ...t, tab: tourTabs[n] }));
export const helps = [
  { photo: '/scene-warm-table.jpg', alt: 'Two housemates sharing a pasta dinner at home', pos: 'center 70%', low: true, group: 'Housemates', title: 'The usual Tuesday dinner', name: 'Nobody keeps a tab', body: 'Add dinner once, split it and get on with the evening.' },
  { photo: '/lifestyle-work.jpg', alt: 'Three makers laughing in a shared pottery studio', low: true, group: 'Studios', title: 'Sharing a studio', name: 'Everyone pays their part', body: 'The rent, the clay and the kiln, split between everyone who uses the space.' },
  { photo: '/groceries.png', alt: 'Two housemates unpacking the food shop', group: 'Housemates', title: 'The big food shop', name: 'Everyone sees their share', body: 'Whoever does the shop adds it once, and the house sees what each person owes.' },
  { photo: '/lifestyle-trip.jpg', alt: 'Four friends walking a coast path', pos: 'center 30%', group: 'Trips away', title: 'A weekend on the coast', name: 'Split as you go', body: 'Fuel, the B&B and the pub lunch, added as they happen.' },
  { photo: '/t/g-real-washing-up.jpg', alt: 'Housemates washing up together', group: 'Housemates', title: 'Whose turn it is', name: 'No one has to ask', body: 'The bins, the plants and the big clean each have a name and a next turn.' },
  { photo: '/unique-agency.jpg', alt: 'A small team looking over work at a studio table', low: true, group: 'Teams', title: 'The office kitty', name: 'Not always the same person', body: 'Tea, coffee and printer ink for a small team, so one person is not always paying.' },
  { photo: '/t/g-real-backstep.jpg', alt: 'A young man with a cup of tea on the back step of a shared house', group: 'Housemates', title: 'Someone new moving in', name: 'Up to speed on day one', body: 'Send one link. They see the bills, the jobs and the Wi-Fi straight away.' },
  { photo: '/t/g-new-landlady.jpg', alt: 'A landlady at the door of a shared house', group: 'Landlords', title: 'Looking after a house', name: 'Details in one place', body: 'Bills and house details for the homes you look after, shared with the people living there.' },
  { photo: '/t/g-real-sofa-couple.jpg', alt: 'A couple laughing at a phone on the sofa', group: 'Couples', title: 'Living as a couple', name: 'Fair, without keeping score', body: 'Rent, bills and the weekly shop, split the way you both agreed.' },
  { photo: '/company-journal-card-work.jpg', alt: 'Three friends packing orders for a small business', group: 'Teams', title: 'A side project', name: 'Costs split fairly', body: 'Materials, postage and the market stall fee, split between the people behind it.' },
  { photo: '/t/new-shop-night.jpg', alt: 'Friends unpacking food for a big dinner', group: 'Friends', title: 'Dinner for ten', name: 'Who bought what', body: 'Everyone brings something for the feast, and the costs are split fairly across the table.' },
  { photo: '/t/new-terrace.jpg', alt: 'Three friends at lunch on a terrace above the sea', pos: '45% center', group: 'Trips away', title: 'The week away', name: 'Clear before you are home', body: 'The villa, the flights and the dinners, split as you go.' },
];
function RailPhone({ kind }: { kind: string }) {
  return <div className="t-rphone" aria-hidden="true"><div className="t-rphone__screen"><div className="t-rphone__bar"><span>9:41</span><i /><span>●●●</span></div>
    {kind === 'recurring' ? <div className="t-rphone__app"><small>Maple House</small><b>Recurring</b>
      <div className="t-rphone__card">{[['Rent', 'Alex pays · 1 Nov', '£1,200.00'], ['Energy', 'Jordan pays · 14 Nov', '£84.00'], ['Broadband', 'Taylor pays · 20 Nov', '£32.00'], ['Council tax', 'Casey pays · 1 Dec', '£142.00']].map(r => <div className="t-rphone__row" key={r[0]}><div><b>{r[0]}</b><small>{r[1]}</small></div><span>{r[2]}</span></div>)}</div></div>
    : kind === 'announce' ? <div className="t-rphone__app"><small>Maple House</small><b>Notes</b>
      <div className="t-rphone__card t-rphone__note"><div className="t-rphone__row"><Avatar index={0} /><div><b>Alex</b><small>Announcement</small></div></div><strong>Boiler service on Thursday</strong><p>Please be in from 8. The engineer needs the airing cupboard clear.</p></div>
      <div className="t-rphone__card t-rphone__note"><div className="t-rphone__row"><Avatar index={1} /><div><b>Jordan</b><small>Pinned note</small></div></div><p>Bin day is Friday morning. Recycling goes out on Thursday night.</p></div></div>
    : kind === 'history' ? <div className="t-rphone__app"><small>Food shop</small><b>History</b>
      <div className="t-rphone__card t-rphone__note"><div className="t-rphone__row"><Avatar index={2} /><div><b>Changed by Taylor</b><small>Tuesday, 14:02</small></div></div><div className="t-rphone__change"><s>£45.20</s><span>£48.20</span></div><p>Reason: forgot to add the milk.</p></div>
      <div className="t-rphone__card t-rphone__note"><div className="t-rphone__row"><Avatar index={2} /><div><b>Added by Taylor</b><small>Tuesday, 13:40</small></div></div><p>£45.20, split equally between four.</p></div></div>
    : kind === 'money' ? <div className="t-rphone__app"><small>Maple House</small><b>Money</b>
      <div className="t-rphone__card"><small>Your share this month</small><strong>£386.50</strong><div className="l-progress"><span style={{ width: '62%' }} /></div></div>
      <div className="t-rphone__card">{[['Rent, October', 'Paid by Alex', '£1,200.00'], ['Energy', 'Paid by Jordan', '£84.00'], ['Food shop', 'Paid by Taylor', '£48.20']].map(r => <div className="t-rphone__row" key={r[0]}><div><b>{r[0]}</b><small>{r[1]}</small></div><span>{r[2]}</span></div>)}</div></div>
    : <div className="t-rphone__app"><small>Energy, October</small><b>Pay Jordan</b>
      <div className="t-rphone__card t-rphone__big"><small>Your share</small><strong>£21.00</strong></div>
      <div className="t-rphone__card">{[['M', 'Jordan\'s Monzo', 'Favourite', 't-pay--m'], ['P', 'PayPal', 'Link', 't-pay--p'], ['£', 'Bank transfer', 'Details', '']].map(r => <div className="t-rphone__row" key={r[1]}><span className={`t-pay ${r[3]}`}>{r[0]}</span><div><b>{r[1]}</b><small>{r[2]}</small></div></div>)}</div>
      <span className="t-paid">I've paid Jordan</span></div>}
  </div></div>;
}
const tourIconsAll = [
  <svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M3 10h18M16 15h2" /></svg>,
  <svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1" /><path d="M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1" /></svg>,
  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5L16 9.5" /></svg>,
  <svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" /></svg>,
  <svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5" /><path d="M3 20a6 6 0 0 1 12 0" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14.5a5 5 0 0 1 5 5.5" /></svg>,
  <svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 1-2.3-5.6M20 4v5h-5" /></svg>,
  <svg viewBox="0 0 24 24"><path d="M5 10h14v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>,
  <svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 4v16M4 12h8" /></svg>,
  <svg viewBox="0 0 24 24"><path d="M4 10v4h3l6 4V6L7 10z" /><path d="M17 9a4 4 0 0 1 0 6" /></svg>,
  <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>,
  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>,
];
const tourIcons = tourIconsAll;
function Toast({ who, title, sub }: { who: number; title: string; sub: string }) {
  return <div className="t-toast"><Avatar index={who} /><div><strong>{title}</strong><small>{sub}</small></div></div>;
}
function TourGlance({ index }: { index: number }) {
  if (index === 0) return <><div className="t-stack__panel"><span className="l-mini-label">YOUR SHARE · OCTOBER</span><b>£300.00</b><div className="l-progress"><span /></div></div><Toast who={2} title="Taylor added the food shop" sub="£48.20 · your share £12.05" /><Toast who={1} title="Jordan paid the rent" sub="2 of 4 shares paid" /></>;
  if (index === 1) return <><div className="t-stack__panel"><span className="l-mini-label">PAY JORDAN</span><b>£21.00</b><div className="t-stack__row"><span className="t-pay t-pay--m">M</span>Jordan's Monzo<small>Favourite</small></div></div><Toast who={0} title="You paid Jordan £21.00" sub="Recorded, and they know" /></>;
  if (index === 2) return <><div className="t-stack__panel"><span className="l-mini-label">THIS WEEK AT HOME</span><b>3 jobs</b><i /><i /></div><Toast who={1} title="Jordan took the recycling out" sub="Taylor is next" /><Toast who={2} title="Water the plants" sub="Taylor · Tomorrow" /></>;
  if (index === 3) return <><div className="t-stack__panel"><span className="l-mini-label">HOUSE ESSENTIALS</span><b>Maple House</b><small className="t-stack__sub">Wi-Fi network</small><i /></div><Toast who={0} title="Alex pinned a note" sub="Spare keys are with Jordan" /></>;
  if (index === 4) return <><div className="t-stack__panel"><span className="l-mini-label">MAPLE HOUSE</span><b>4 people</b><Avatars /></div><Toast who={3} title="Casey joined Maple House" sub="Everyone sees the same balance" /></>;
  if (index === 6) return <><div className="t-stack__panel"><span className="l-mini-label">NEW SOFA FUND</span><b>£640 of £900</b><div className="l-progress"><span style={{ width: '71%' }} /></div></div><Toast who={2} title="Taylor put in £40.00" sub="Contribution recorded" /></>;
  if (index === 7) return <><div className="t-stack__panel"><span className="l-mini-label">SPLIT TEMPLATE</span><b>Rent by room</b><small className="t-stack__sub">Alex 30% · Jordan 25% · Taylor 25% · Casey 20%</small></div><Toast who={0} title="Alex used Rent by room" sub="November rent, split four ways" /></>;
  if (index === 9) return <><div className="t-stack__panel"><span className="l-mini-label">ENERGY, OCTOBER</span><b>£21.00</b><small className="t-stack__sub">Casey's share · due Friday</small></div><Toast who={3} title="Reminder sent to Casey" sub="A short email, nothing more" /></>;
  return <><div className="t-stack__panel t-stack__panel--list"><span className="l-mini-label">YOUR COMMUNES</span>{[['Maple House', '4 people'], ['Lisbon trip', '6 people'], ['The studio', '3 people']].map(r => <div className="t-stack__row" key={r[0]}>{r[0]}<small>{r[1]}</small></div>)}</div></>;
}
function TourPreview({ index }: { index: number }) {
  if (index === 0) return <div className="l-pillar-preview l-money-glance"><span className="l-mini-label">MAPLE HOUSE · THIS MONTH</span><div className="l-money-glance__total"><span>Your share</span><strong>£300.00</strong></div><div className="l-money-glance__person"><Avatar index={0} /><span>Alex <small>(you)</small></span><span className="l-status l-status--paid">Paid</span></div><div className="l-mini-progress"><span>2 of 4 shares paid</span><Avatars /></div><div className="l-progress"><span /></div></div>;
  if (index === 1) return <div className="l-pillar-preview"><span className="l-mini-label">PAY JORDAN · £21.00</span><div className="l-task-row"><span className="t-pay t-pay--m">M</span><div><strong>Jordan's Monzo</strong><small>Favourite</small></div></div><div className="l-task-row"><span className="t-pay t-pay--p">P</span><div><strong>PayPal</strong><small>Link</small></div></div><div className="l-task-row"><span className="t-pay">£</span><div><strong>Bank transfer</strong><small>Details</small></div></div><span className="t-paid">I've paid Jordan</span></div>;
  if (index === 2) return <div className="l-pillar-preview"><div className="l-pillar-preview__heading"><span className="l-mini-label">THIS WEEK AT HOME</span><span className="l-status">3 jobs</span></div>{[{ task: 'Take the recycling out', when: 'Today', member: 1 }, { task: 'Water the plants', when: 'Tomorrow', member: 2 }, { task: 'Clean the kitchen', when: 'Friday', member: 3 }].map(job => <div className="l-task-row" key={job.task}><span className="l-task-ring" aria-hidden="true" /><div><strong>{job.task}</strong><small>{people[job.member]} · {job.when}</small></div><Avatar index={job.member} /></div>)}</div>;
  if (index === 3) return <div className="l-pillar-preview"><span className="l-mini-label">OUR HOUSE ESSENTIALS</span><div className="l-essential-row"><span>Wi-Fi network</span><strong>Maple House</strong></div><div className="l-essential-row"><span>Recycling collection</span><strong>Friday morning</strong></div><div className="l-pinned-note"><Avatar index={0} /><div><span>Pinned by Alex</span><p>Spare keys are with Jordan if you need them.</p></div></div></div>;
  return <div className="l-pillar-preview"><span className="l-mini-label">MAPLE HOUSE · 4 PEOPLE</span>{people.map((p, i) => <div className="l-task-row" key={p}><Avatar index={i} /><div><strong>{p}{i === 0 ? ' (you)' : ''}</strong></div><span className={`l-status ${i < 3 ? 'l-status--paid' : ''}`}>{i < 3 ? 'Joined' : 'Invited'}</span></div>)}</div>;
}
const heroPings = [
  { who: 1, app: 'Maple House', title: 'Jordan confirmed your £21.00', sub: 'Energy, October · all square' },
  { who: 2, app: 'Maple House', title: 'Your turn: water the plants', sub: 'Taylor did the bins this morning' },
  { who: 3, app: 'Lisbon in May', title: 'Casey added flights, £84.00', sub: 'Split four ways · £21.00 each' },
];
function HeroPings() {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setN(v => v + 1), 3800);
    return () => clearInterval(t);
  }, []);
  const shown = [heroPings[n % 3], heroPings[(n + 1) % 3]];
  return <div className="t-pings" aria-hidden="true">{shown.map((p, k) => <div className={`t-ping t-ping--${k}`} key={`${n}-${k}`}>
    <span className="t-ping__app"><b>commune.</b><small>{p.app} · now</small></span>
    <div className="t-ping__body"><Avatar index={p.who} /><div><strong>{p.title}</strong><small>{p.sub}</small></div></div>
  </div>)}</div>;
}
export function Faq({ items }: { items: string[][] }) {
  const [open, setOpen] = useState<number | null>(null);
  const [seen, setSeen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.2 });
    io.observe(el); return () => io.disconnect();
  }, []);
  return <div className={`l-faq__list t-faq ${seen ? 'is-seen' : ''}`} ref={ref}>{items.map(([q, a], i) => {
    const on = open === i;
    return <div className={`t-faq__item ${on ? 'is-open' : ''}`} key={q} style={{ ['--i' as string]: i }}>
      <h3 className="t-faq__q"><button type="button" aria-expanded={on} aria-controls={`faq-a-${i}`} id={`faq-q-${i}`} onClick={() => setOpen(on ? null : i)}><span>{q}</span><span className="t-faq__icon" aria-hidden="true"><i /><i /></span></button></h3>
      <div className="t-faq__a" id={`faq-a-${i}`} role="region" aria-labelledby={`faq-q-${i}`} inert={!on}><div><p>{a}</p></div></div>
    </div>;
  })}</div>;
}
const journalWay = typeof window === 'undefined' ? 'a' : (new URLSearchParams(window.location.search).get('v') ?? 'a');
const ways: Array<[string, string]> = [['a', 'A · Photos play'], ['b', 'B · Stories as articles'], ['c', 'C · On the Journal page']];
function ProtoSwitch() {
  return <nav className="t-proto" aria-label="Journal options"><span>Journal</span>{ways.map(([k, label]) => <a key={k} href={`?v=${k}#journal`} aria-current={journalWay === k}>{label}</a>)}</nav>;
}

export default function TogetherMock() {
  const plansRef = useRef<HTMLDivElement>(null);
  const [planAt, setPlanAt] = useState(0);
  const planScroll = () => { const r = plansRef.current; if (!r) return; const c = r.children[0] as HTMLElement | undefined; if (!c) return; const step = c.offsetWidth + 12; setPlanAt(Math.max(0, Math.min(2, Math.round(r.scrollLeft / step)))); };
  const planGo = (i: number) => { const r = plansRef.current; if (!r) return; const c = r.children[i] as HTMLElement | undefined; if (!c) return; r.scrollTo({ left: c.offsetLeft - r.offsetLeft - (r.clientWidth - c.offsetWidth) / 2, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); setPlanAt(i); };
  const [pos, setPos] = useState(0);
  const [jump, setJump] = useState(false);
  const N = tour.length;
  const slide = ((pos % N) + N) % N;
  const setSlide = (i: number) => setPos(i);
  const tourStep = (d: number) => setPos(p => p + d);
  useEffect(() => { if (pos >= 0 && pos < N) return; const t = window.setTimeout(() => { setJump(true); setPos(((pos % N) + N) % N); requestAnimationFrame(() => requestAnimationFrame(() => setJump(false))); }, reducedMotion ? 0 : 720); return () => window.clearTimeout(t); }, [pos]);
  const [paused, setPaused] = useState(false);
  const touchX = useRef(0);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState({ left: 0, width: 0 });
  useEffect(() => {
    const place = () => { const tab = tabsRef.current?.querySelectorAll('button')[slide] as HTMLElement | undefined; if (tab) setPill({ left: tab.offsetLeft, width: tab.offsetWidth }); };
    place(); window.addEventListener('resize', place); document.fonts?.ready.then(place);
    return () => window.removeEventListener('resize', place);
  }, [slide]);
  const railRef = useRef<HTMLDivElement>(null);
  const [railAt, setRailAt] = useState(0);
  const railStep = () => { const card = railRef.current?.querySelector('article') as HTMLElement | null; return card ? card.offsetWidth + 16 : 0; };
  const railTimer = useRef<number | undefined>(undefined);
  useEffect(() => { const r = railRef.current; const st = railStep(); if (r && st) r.scrollLeft = helps.length * st; }, []);
  const railSettle = () => { const r = railRef.current; const st = railStep(); if (!r || !st) return; const n = helps.length; const i = Math.round(r.scrollLeft / st); if (i < n) r.scrollLeft += n * st; else if (i >= 2 * n) r.scrollLeft -= n * st; };
  const railOnScroll = () => { const r = railRef.current; const st = railStep(); if (!r || !st) return; setRailAt(((Math.round(r.scrollLeft / st)) % helps.length + helps.length) % helps.length); window.clearTimeout(railTimer.current); railTimer.current = window.setTimeout(railSettle, 140); };
  const railBy = (dir: number) => { const r = railRef.current; const st = railStep(); if (!r || !st) return; r.scrollBy({ left: dir * st, behavior: reducedMotion ? 'auto' : 'smooth' }); };
  useEffect(() => {
    const row = tabsRef.current; const tab = row?.querySelectorAll('button')[slide] as HTMLElement | undefined;
    if (row && tab && row.scrollWidth > row.clientWidth) row.scrollTo({ left: tab.offsetLeft - 20, behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [slide]);
  const [cat, setCat] = useState('All');
  const [life, setLife] = useState(0);
  const [step, setStep] = useState(0);
  const [completedJobs, setCompletedJobs] = useState<string[]>([]);
  const [yearly, setYearly] = useState(false);
  const [menu, setMenu] = useState(false);
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
  useEffect(() => {
    if (reducedMotion || paused) return;
    const t = window.setTimeout(() => tourStep(1), 6500);
    return () => window.clearTimeout(t);
  }, [slide, paused, reducedMotion]);
  const current = lives[life];
  return <div className="l-site" id="top">
    <SiteMenu {...phoneMenu} tone="photo" />
    <section className="l-hero" aria-labelledby="hero-title">
      <div className="l-hero__scenes" aria-hidden="true"><img className="l-hero__image is-active t-hero-photo" src="/t/g-new-sky-woman.jpg" alt="" fetchPriority="high" /></div>
      <HeroPings />
      <header className="l-header l-container">
        <BrandWordmark href="#top" />
        <nav id="main-navigation" className={menu ? 'is-open' : ''} aria-label="Main navigation">
          <a href="/how-it-works.html" onClick={() => setMenu(false)}>How it works</a>
          <a href="/life-together.html" onClick={() => setMenu(false)}>Life together</a>
          <a href="/pricing.html" onClick={() => setMenu(false)}>Pricing</a>
          <a href="./journal.html" onClick={() => setMenu(false)}>Journal</a>
          <a href="/about.html" onClick={() => setMenu(false)}>About</a>
          <a className="l-login" href="https://app.ourcommune.io/login">Log in</a>
          <LinkButton variant="white">Start free trial</LinkButton>
        </nav>
        <button className="l-menu" aria-expanded={menu} aria-controls="main-navigation" onClick={() => setMenu(!menu)}>{menu ? 'Close' : 'Menu'}</button>
      </header>
      <div className="l-hero__body l-container">
        <h1 id="hero-title">For people who<br />do life together.</h1>
        <p>Shared costs, everyday jobs and the details everyone needs. Bring it all together, so no one has to hold it all.</p>
        <div className="l-hero__actions"><LinkButton variant="white">Start your free trial</LinkButton><a className="l-text-link" href="#features">See what's inside</a></div>
      </div>
    </section>

    <main>

      <section className="l-section t-helps" aria-labelledby="helps-title">
        <div className="l-container">
          <div className="t-rail__head"><div><span className="l-eyebrow">For the everyday and the unexpected</span><h2 id="helps-title">Built for your kind of together.</h2><p className="t-rail__lead">One app for the house, the relationship, the studio and the week away.</p></div><div className="t-rail__arrows"><button aria-label="Previous" onClick={() => railBy(-1)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12 4l-6 6 6 6" /></svg></button><button aria-label="Next" onClick={() => railBy(1)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 4l6 6-6 6" /></svg></button></div></div>
        </div>
        <div className="t-rail t-rail--loop" ref={railRef} onScroll={railOnScroll}>{[...helps, ...helps, ...helps].map((h, i) => <article className="t-rcard" key={i} aria-hidden={i < helps.length || i >= 2 * helps.length ? true : undefined}>
          <div className={`t-rcard__media ${h.low ? 't-rcard__media--low' : ''}`}><img src={h.photo} alt={h.alt} style={{ objectPosition: h.pos || 'center' }} /><h3>{h.title}</h3></div>
          <span className="t-rcard__group">{h.group}</span><h4>{h.name}</h4><p>{h.body}</p>
        </article>)}</div>
      </section>

      <section className="l-section t-tour" id="features" aria-labelledby="tour-title">
        <div className="l-container">
          <div className="l-section-heading"><div><span className="l-eyebrow">Inside Commune</span><h2 id="tour-title">Everything you share, kept clear.</h2></div><p>The money, the jobs and the details for the house,{' '}<br />the relationship, the studio or the week away.</p></div>
          <div className="t-car__tabs" ref={tabsRef} role="tablist" aria-label="Inside Commune"><span className="t-car__pill" style={{ left: pill.left, width: pill.width }} aria-hidden="true" />{tour.map((t, i) => <button key={t.tab} role="tab" aria-selected={slide === i} onClick={() => setSlide(i)}>{t.tab}</button>)}</div>
        </div>
        <div className="l-container t-car" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onTouchStart={e => { touchX.current = e.touches[0].clientX; }} onTouchEnd={e => { const d = e.changedTouches[0].clientX - touchX.current; if (Math.abs(d) > 40) tourStep(d < 0 ? 1 : -1); }}>
          <div className="t-car__track" style={{ transform: `translateX(calc(var(--peek) + ${N + pos} * (2 * var(--peek) - var(--gap) - 100%)))`, transition: jump ? 'none' : undefined }}>{[...tour, ...tour, ...tour].map((t, k) => { const i = k % N; const on = k === N + pos; return <article key={k} className={`t-card ${on ? 'is-on' : ''}`} role={k >= N && k < 2 * N ? 'tabpanel' : undefined} aria-label={t.tab} aria-hidden={!on} onClick={() => !on && setPos(pos + (k - (N + pos)))}>
            <div className="t-card__text"><span className="t-card__icon" aria-hidden="true">{tourIcons[i]}</span><div><h3>{t.title}</h3><p>{t.body}</p></div></div>
            {t.phone ? <div className={`t-card__photo t-card__photo--phone t-card__photo--${t.bg}`}><RailPhone kind={t.phone} /></div> : <div className="t-card__photo"><img src={t.photo} alt={t.alt} style={{ objectPosition: t.pos || 'center' }} /><div className={`t-stack t-stack--${t.glance}`}><TourGlance index={i} /></div></div>}
          </article>; })}</div>
        </div>
        <div className="l-container">
          <div className="t-car__nav"><button aria-label="Previous" onClick={() => tourStep(-1)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12 4l-6 6 6 6" /></svg></button><div className="t-car__dots">{tour.map((t, i) => <button key={t.tab} aria-label={t.tab} aria-current={slide === i} onClick={() => setSlide(i)} />)}</div><button aria-label="Next" onClick={() => tourStep(1)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 4l6 6-6 6" /></svg></button></div>
        </div>
      </section>



      <section className="l-moment" aria-labelledby="moment-title"><div className="l-moment__frame l-container"><img src="/scene-blue-day.jpg" alt="Friends enjoying a clear day in the park with their dog" loading="lazy" /><div className="l-moment__content"><div><span className="l-eyebrow">All the ways you share a life.</span><h2 id="moment-title">The best bits are shared.</h2></div><p>When everyone knows their part, there’s more room for this.{' '}<br />The everyday. The unexpected. The time together.</p></div></div></section>

      <div className="t-meet-wrap">
      <section className="l-section t-meet" id="how-it-works" aria-labelledby="meet-title"><div className="l-container">
        <div className="t-meet__head"><span className="l-eyebrow">A home for the everyday</span><h2 id="meet-title">Four people, one home.</h2><p>Alex, Jordan, Taylor and Casey keep the rent, the rota and the house details in Commune. This is what Alex sees on a Tuesday.</p></div>
        <div className="t-meet__stage">
          <div className="t-notes">
            <div className="t-note"><span className="l-card-number">01 / YOUR SHARE</span><h3>Before it's due.</h3><p>Rent, bills and the food shop add up to one number everyone can see.</p></div>
            <div className="t-note"><span className="l-card-number">02 / I'VE PAID</span><h3>Where to send it.</h3><p>Pay the way you already do, then tap "I've paid" so the house knows.</p></div>
          </div>
          <div className="t-phone t-phone--nat" role="img" aria-label="The Commune phone app Home: you owe £33.05 in Maple House, next step Energy for October, I've paid Jordan £21.00, plants to water today">
            <div className="t-phone__screen"><div className="t-nat">
              <div className="t-nat__frame">
                <div className="t-nat__status"><span>9:41</span><i /><span className="t-nat__sig"><b /><b /><b /><b /></span></div>
                <div className="t-nat__top"><b className="t-nat__mark">commune.</b><span className="t-nat__bell"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 004 0" /></svg></span><span className="t-nat__me">AL</span></div>
                <small className="t-nat__date">Tuesday 14 October</small>
                <p className="t-nat__line">You owe <b>£33.05</b> in Maple House.</p>
                <p className="t-nat__sub">You’re owed £8.00, and nothing is overdue. The plants need watering today.</p>
              </div>
              <div className="t-nat__body">
                <div className="t-nat__next">
                  <div className="t-nat__nh"><span>Your next step</span><span>1 of 2</span></div>
                  <div className="t-nat__item"><span className="t-nat__av">JO<img src="/scene-warm-table.jpg" alt="" /></span><div><b>Energy, October</b><small>Maple House · your share</small><em>Due today</em></div><strong>£21.00</strong></div>
                  <span className="t-nat__pay">I’ve paid Jordan £21.00</span>
                  <div className="t-nat__takes">Jordan takes <span>Monzo</span><span>Bank transfer</span></div>
                  <p className="t-nat__note">Pay Jordan however you usually do, then record it here. Jordan confirms it.</p>
                </div>
                <div className="t-nat__sect"><span>Today</span><small>one chore</small></div>
                <div className="t-nat__list"><div className="t-nat__row"><span className="t-nat__av t-nat__av--sm">AL</span><div><b>Water the plants</b><small>Maple House · today</small></div><i className="t-nat__box" /></div></div>
                <div className="t-nat__sect"><span>Still to pay <i>1</i></span><small>£12.05</small></div>
              </div>
              <div className="t-nat__tabs">
                <span className="is-on"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.6" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" /></svg>Home</span>
                <span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.5L12 4l8 6.5V20H4z" /><path d="M10 20v-5.5h4V20" /></svg>Hub</span>
                <span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z" /><path d="M9 8.5h6M9 12h6M9 15.5h4" /></svg>Expenses</span>
                <span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8.5h14l-3.5-3.5M19 15.5H5l3.5 3.5" /></svg>Settle</span>
                <span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="18" cy="12" r="1.3" /></svg>More</span>
              </div>
            </div></div>
          </div>
          <div className="t-notes">
            <div className="t-note"><span className="l-card-number">03 / JOBS</span><h3>Everyone has their part.</h3><p>The bins, the plants and the big clean each have a name and a next turn.</p></div>
            <div className="t-note"><span className="l-card-number">04 / DETAILS</span><h3>Find it without asking.</h3><p>Wi-Fi, bin day and the spare keys, without asking the group chat.</p></div>
          </div>
        </div>
        <div className="t-meet__cta"><LinkButton>Start your free trial</LinkButton><span>Try Standard free for 7 days.</span></div>
      </div></section>
      </div>

      <section className="l-section t-pricing" id="plans" aria-labelledby="plans-title"><div className="l-container">
        <div className="l-section-heading"><div><span className="l-eyebrow">A plan for your people</span><h2 id="plans-title">A little clarity. For every group.</h2></div><div className="l-billing" aria-label="Billing period"><button aria-pressed={!yearly} onClick={() => setYearly(false)}>Monthly</button><button aria-pressed={yearly} onClick={() => setYearly(true)}>Yearly</button></div></div>
        <div className="t-plan-pick" role="tablist" aria-label="Choose a plan">{plans.map((plan, i) => <button key={plan.name} role="tab" aria-selected={planAt === i} onClick={() => planGo(i)}>{plan.name}</button>)}<span className="t-plan-pick__pill" style={{ transform: `translateX(${planAt * 100}%)` }} aria-hidden="true" /></div>
        <div className="t-plans" ref={plansRef} onScroll={planScroll}>{plans.map((plan, i) => <article className={`t-plan ${i === 1 ? 't-plan--navy' : ''} ${planAt === i ? 'is-at' : ''}`} key={plan.name}>
          <div className="t-plan__top"><h3>{plan.name}</h3><p>{plan.detail}</p></div>
          <div className="t-plan__price"><span>£{yearly ? plan.annual : plan.monthly}</span><small>/ {yearly ? 'year' : 'month'}</small></div>
          <span className="t-plan__note">Billed {yearly ? 'yearly' : 'monthly'}</span>
          <ul><li><b>{plan.groups}</b></li><li><b>{plan.people}</b></li><li>Shared costs and who's paid</li><li>Jobs, turns and checklists</li><li>House details and pinned notes</li></ul>
          <LinkButton variant={i === 1 ? 'white' : ''}>Start your free trial</LinkButton>
        </article>)}</div>
        <p className="t-plans__line">Every plan starts with a 7-day free trial. Commune records what you pay each other and never moves your money.</p>
      </div></section>

      <section className="l-journal l-section t-snotes" id="journal" aria-labelledby="journal-title"><div className="l-container"><div className="l-section-heading"><div><span className="l-eyebrow">The shared life journal</span><h2 id="journal-title">Notes on doing life together.</h2></div><p>Ideas for the homes, workspaces{' '}<br />and adventures we share.</p><a className="t-journal-btn" href={journalWay === 'c' ? './journal-g.html' : './journal.html'}>Explore the journal</a></div>{journalWay === 'c' ? <div className="l-journal__grid">{journal.map(article => <article className="l-journal__card" key={article.category}><img src={article.image} alt={article.alt} loading="lazy" /><span className="l-eyebrow">{article.category}</span><h3>{article.title}</h3><p>{article.description}</p><a className="l-journal__guide" href={`./journal.html#${article.category.toLowerCase()}`}>Read the guide</a></article>)}</div> : <StoryJournal still={journalWay === 'b'} />}</div></section>

      <section className="l-faq l-section" aria-labelledby="faq-title"><div className="l-container l-faq__layout"><div><span className="l-eyebrow">Good to know</span><h2 id="faq-title">A few things, made clear.</h2></div><Faq items={questions} /></div></section>
    </main>

    <div className="t-end"><div className="l-ending t-end__card"><img className="l-ending__photo" src="/unique-footer.jpg" alt="" loading="lazy" />
      <section className="l-final-cta" aria-labelledby="closing-title"><div className="l-container"><span className="l-eyebrow">Less admin. More living.</span><h2 id="closing-title">Make space for the good stuff.</h2><p>The costs, the jobs, the little details. A shared place for it all.{' '}<br />Start with 7 days on Standard.</p><LinkButton variant="white">Start your 7-day free trial</LinkButton></div></section>
      <footer className="l-footer"><div className="l-container l-footer__inner"><div className="l-footer__links"><div><BrandWordmark href="/" /><p>For people who do life together.</p></div><nav aria-label="Explore"><h3>Explore</h3><a href="/how-it-works.html">How it works</a><a href="/life-together.html">Life together</a><a href="/pricing.html">Pricing</a><a href="./journal.html">Journal</a><a href="/about.html">About</a></nav><nav aria-label="Get in touch"><h3>Your Commune</h3><a href="https://app.ourcommune.io/login">Log in</a><a href={signup}>Get started</a><a href="mailto:support@ourcommune.io">Contact us</a></nav></div><div className="l-footer__bottom"><span>© {new Date().getFullYear()} Commune</span><div><a href="https://app.ourcommune.io/privacy">Privacy policy</a><a href="https://app.ourcommune.io/terms">Terms of service</a></div></div></div></footer>
      </div></div>
    <ProtoSwitch />
  </div>;
}
