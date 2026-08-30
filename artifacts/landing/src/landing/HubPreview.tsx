export function HubPreview() {
  return (
    <div className="hub" aria-hidden="true">
      <div className="hub__bar">
        <span className="hub__dot" />
        <span className="hub__dot" />
        <span className="hub__dot" />
        <span>12 Grove House — this month</span>
      </div>
      <div className="hub__body">
        <aside className="hub__side">
          <div className="t-logo">Commune</div>
          <p className="hub__nl">Menu</p>
          <span className="hub__lk is-on">Dashboard</span>
          <span className="hub__lk">My Groups</span>
          <p className="hub__nl">Money</p>
          <span className="hub__lk">Expenses</span>
          <span className="hub__lk">Recurring</span>
          <p className="hub__nl">Insights</p>
          <span className="hub__lk">Command Centre</span>
        </aside>
        <div className="hub__main">
          <div className="hub__ph">
            <p className="hub__pt">Dashboard</p>
            <p className="hub__ps">What you owe, and what needs attention</p>
          </div>
          <div className="hub__stats">
            <div className="hub__stat">
              <p className="t-label">You owe</p>
              <b>£84.50</b>
            </div>
            <div className="hub__stat">
              <p className="t-label">This month</p>
              <b>£1,240</b>
            </div>
          </div>
          <div className="hub__rows">
            <div className="hub__row">
              <strong>Rent — April</strong>
              <span>Due 1 Apr · split 4 ways</span>
            </div>
            <div className="hub__row">
              <strong>Council tax</strong>
              <span>Maya paid · settle £42</span>
            </div>
            <div className="hub__row">
              <strong>Broadband</strong>
              <span>Recurring · you are clear</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
