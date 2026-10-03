import { SIGNUP, asset } from "./content";
import { Header, Footer, DesignSwitch } from "./Chrome";

export default function ProductPage() {
  return (
    <div className="surface">
      <Header links={[
        { href: "#hub", label: "The hub" },
        { href: "#spaces", label: "Spaces" },
        { href: "#membership", label: "Membership" },
      ]} />
      <section className="surface__intro wrap">
        <p className="t-label" style={{ color: "var(--sage)", marginBottom: 10 }}>Communal finance + group operations</p>
        <h1 className="t-display">The command centre for a shared space.</h1>
        <p className="t-body">Open the hub. See what you owe, what is paid, and what needs a person. Then switch to the next space.</p>
        <div className="surface__cta">
          <a className="btn btn--sage" href={SIGNUP}>Start 7-day trial</a>
          <a className="btn btn--ghost" href="#membership">View membership</a>
        </div>
        <div className="app" id="hub" aria-hidden="true">
          <aside className="side">
            <div className="t-logo">Commune</div>
            <p className="side__g">Menu</p>
            <span className="lk is-on">Home</span>
            <p className="side__g">Money</p>
            <span className="lk">Expenses</span>
            <span className="lk">Recurring</span>
            <span className="lk">Settle</span>
            <p className="side__g">House</p>
            <span className="lk">Members</span>
            <span className="lk">Operations</span>
            <div className="hubsw">
              <div>
                <strong>14 Park Street</strong>
                <em>Household · switch</em>
              </div>
            </div>
          </aside>
          <div className="main">
            <div className="ah">
              <div>
                <h1>14 Park Street</h1>
                <p>August · you owe £42 · gas Friday · fund £420</p>
              </div>
              <div className="ah__search">Search expenses, people, bills</div>
              <a className="btn btn--ink" href={SIGNUP}>Add expense</a>
            </div>
            <div className="ac">
              <div className="answers">
                <div className="inkcard">
                  <p className="t-label">You owe</p>
                  <p className="num">£42.00</p>
                  <p>Pay Jordan this week. Or net the Tesco £18 and send £24.</p>
                  <a className="btn btn--sage" href={SIGNUP}>Settle with Jordan</a>
                </div>
                <div className="card">
                  <h2>Right now</h2>
                  <p className="sub">What still needs a person this week.</p>
                  <div className="now">
                    <span className="pill warn">Friday</span>
                    <div>
                      <strong>British Gas</strong>
                      <div className="when">£94.20 · Jordan paid · your share open</div>
                    </div>
                  </div>
                  <div className="now">
                    <span className="pill warn">Overdue</span>
                    <div>
                      <strong>Bins</strong>
                      <div className="when">Still Jordan’s Tuesday</div>
                    </div>
                  </div>
                  <div className="now">
                    <span className="pill open">Collect</span>
                    <div>
                      <strong>Alex · house fund</strong>
                      <div className="when">£180 still to pay in</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="card">
                <h2>Who owes whom</h2>
                <p className="sub">This cycle. Settle when you’re ready.</p>
                <div className="move">
                  <span className="move__arr">→</span>
                  <div>
                    <p className="move__n">You → Jordan</p>
                    <p className="move__w">Gas share · or £24 if you net Tesco</p>
                  </div>
                  <span className="move__a">£42</span>
                </div>
                <div className="move">
                  <span className="move__arr">→</span>
                  <div>
                    <p className="move__n">Jordan → You</p>
                    <p className="move__w">Tesco extras from Monday</p>
                  </div>
                  <span className="move__a">£18</span>
                </div>
                <div className="move">
                  <span className="move__arr" style={{ background: "#f0ece4", color: "var(--muted)" }}>↔</span>
                  <div>
                    <p className="move__n">Alex ↔ You</p>
                    <p className="move__w">Even on expenses · still £180 for the fund</p>
                  </div>
                  <span className="move__a" style={{ color: "var(--muted)" }}>£0</span>
                </div>
              </div>
              <div className="kpis">
                <div className="kpi"><span>House fund</span><strong>£420</strong><small>£180 to collect from Alex</small></div>
                <div className="kpi"><span>This month</span><strong>£2,140</strong><small>of £2,400 · on track</small></div>
                <div className="kpi"><span>Open bills</span><strong>2</strong><small>Gas + Virgin Media</small></div>
                <div className="kpi"><span>Next due</span><strong>Fri</strong><small>British Gas · 29 Aug</small></div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section id="spaces" className="wrap">
        <p className="t-label" style={{ color: "var(--sage)" }}>The same model, elsewhere</p>
        <h2 className="t-title" style={{ margin: "10px 0 18px" }}>Studio East. Lisbon. The house.</h2>
        <div className="film">
          <img src={asset("photo/kitchen.jpg")} alt="" />
          <img src={asset("photo/studio.jpg")} alt="" />
          <img src={asset("photo/trip.jpg")} alt="" />
        </div>
      </section>
      <section id="membership" className="rates">
        <div className="wrap">
          <p className="t-label" style={{ color: "var(--sage)" }}>Membership</p>
          <h2 className="t-title" style={{ margin: "10px 0 8px" }}>Simple, transparent pricing.</h2>
          <p className="t-body" style={{ marginBottom: 28 }}>7-day trial on your first space. No card required.</p>
          <div className="rates__row">
            <span className="rates__name">Standard</span>
            <span className="rates__price">£4.99</span>
            <span className="rates__for">1 space · 8 members · finance, responsibilities, hub</span>
            <a className="btn btn--ghost" href={SIGNUP}>Start trial</a>
          </div>
          <div className="rates__row is-feat">
            <span className="rates__name">Pro</span>
            <span className="rates__price">£9.99</span>
            <span className="rates__for">3 spaces · 15 members · exports, analytics, priority</span>
            <a className="btn btn--light" href={SIGNUP}>Start trial</a>
          </div>
          <div className="rates__row">
            <span className="rates__name">Agency</span>
            <span className="rates__price">£29.99</span>
            <span className="rates__for">Unlimited spaces and members · operator path</span>
            <a className="btn btn--ghost" href={SIGNUP}>Start trial</a>
          </div>
        </div>
      </section>
      <Footer />
      <DesignSwitch current="product" />
    </div>
  );
}
