import * as React from 'react';
/** An illustrated, browser-local tour of verified product flows. No account or payment API calls. */
export const WALKTHROUGH_EXAMPLES = {
    Equal: { shares: [15, 15, 15, 15], description: 'Four people, the same £15 share.' },
    Exact: { shares: [20, 20, 10, 10], description: 'Agree exact amounts: £20, £20, £10 and £10.' },
    Percentage: { shares: [24, 18, 12, 6], description: 'An agreed 40%, 30%, 20%, 10% split.' },
    Shares: { shares: [20, 20, 10, 10], description: 'Two shares each for Alex and Jordan; one each for Taylor and Casey.' }
  };

function createWalkthrough() {
  const h = React.createElement;
  const examples = WALKTHROUGH_EXAMPLES;

  return function CommuneWalkthrough() {
    const [step, setStep] = React.useState(0);
    const [mode, setMode] = React.useState<keyof typeof examples>('Equal');
    const [confirmed, setConfirmed] = React.useState(false);
    const example = examples[mode];
    const names = ['Alex (paid the shop)', 'Jordan', 'Taylor', 'Casey'];
    const money = (amount: number) => `£${amount.toFixed(2)}`;
    function restart() { setStep(0); setMode('Equal'); setConfirmed(false); }
    const titles = ['Add the shared cost', 'Choose the split', 'Confirm the repayment'];
    const copy = [
      'Alex paid £60 for the house shop. Add it once and include the four people sharing it.',
      'Try the four supported split methods. These are fixed examples of what your group could agree.',
      confirmed ? 'Alex has confirmed receiving Jordan’s payment. Taylor and Casey still owe their shares.' : 'Jordan has paid Alex outside Commune and reported it. The record stays pending until Alex confirms receipt.'
    ];
    return h('div', { className: 'walkthrough', id: 'walkthrough', 'aria-label': 'Illustrated Commune walkthrough' },
      h('div', { className: 'walkthrough__top' }, h('b', null, 'commune.'), h('span', null, 'ILLUSTRATED WALKTHROUGH')),
      h('ol', { className: 'walkthrough__progress', 'aria-label': 'Walkthrough progress' },
        titles.map((title, i) => h('li', { key: title, className: i === step ? 'is-current' : '', 'aria-current': i === step ? 'step' : undefined }, h('span', null, i + 1), title))),
      h('div', { className: 'walkthrough__body', 'aria-live': 'polite' },
        h('span', { className: 'walkthrough__eyebrow' }, 'MAPLE HOUSE · EXAMPLE DATA'),
        h('h3', null, titles[step]),
        h('p', { className: 'walkthrough__copy' }, copy[step]),
        h('div', { className: 'walkthrough__expense' }, h('span', null, 'House shop', h('small', null, 'Paid by Alex · 4 people')), h('strong', null, '£60.00')),
        step === 1 && h('div', { className: 'walkthrough__modes', role: 'group', 'aria-label': 'Example split method' },
          (Object.keys(examples) as Array<keyof typeof examples>).map(key => h('button', { key, type: 'button', 'aria-pressed': key === mode, onClick: () => setMode(key) }, key))),
        step === 1 && h('p', { className: 'walkthrough__explain' }, example.description),
        step > 0 && h('ul', { className: 'walkthrough__shares' }, names.map((name, i) => h('li', { key: name }, h('span', { className: 'walkthrough__avatar', 'aria-hidden': true }, name[0]), h('span', null, name), h('strong', null, money(example.shares[i])), h('small', { className: i === 1 && confirmed ? 'is-confirmed' : '' }, i === 0 ? 'Own share' : i === 1 && step === 2 ? confirmed ? 'Confirmed' : 'Pending' : 'To repay')))),
        step === 2 && h('div', { className: 'walkthrough__status', role: 'status' }, confirmed ? `Jordan’s ${money(example.shares[1])} repayment is confirmed in this example.` : `Jordan reported paying ${money(example.shares[1])}. Waiting for Alex to confirm.`),
        h('div', { className: 'walkthrough__actions' },
          step === 0 ? h('button', { type: 'button', onClick: () => setStep(1) }, 'Add example expense →') :
          step === 1 ? h('button', { type: 'button', onClick: () => setStep(2) }, 'Record Jordan’s payment →') :
          !confirmed ? h('button', { type: 'button', onClick: () => setConfirmed(true) }, 'Confirm example payment ✓') :
          h('button', { type: 'button', onClick: restart }, 'Try another split ↺'),
          step > 0 && !confirmed && h('button', { type: 'button', className: 'walkthrough__reset', onClick: restart }, 'Start again'))),
      h('p', { className: 'walkthrough__disclaimer' }, 'Illustration, not a live account or an exact app screenshot. Nothing is saved and no money moves.')
    );
  };
}

export const CommuneWalkthrough = createWalkthrough();
