import { SIGNUP, asset } from "./content";
import { Header, Footer, DesignSwitch } from "./Chrome";

export default function PaperPage() {
  return (
    <div>
      <Header links={[
        { href: "#month", label: "This month" },
        { href: "#spaces", label: "Spaces" },
        { href: "#membership", label: "Membership" },
      ]} />
      <section className="mast">
        <div className="mast__copy">
          <p className="t-label mast__issue">The house journal · August</p>
          <h1 className="t-display mast__h">Live clearly, together.</h1>
          <p className="t-body mast__sub">
            One hub for the house, the studio, the trip. What you owe, what needs
            doing, who owns it — without the chase.
          </p>
          <div className="mast__cta">
            <a className="btn btn--sage" href={SIGNUP}>Start 7-day trial</a>
            <a className="btn btn--ghost" href="#month">This month at 14 Park Street</a>
          </div>
        </div>
        <div className="mast__photo">
          <img src={asset("photo/kitchen.jpg")} alt="Housemates at the kitchen table" />
        </div>
      </section>
      <section className="spread">
        <div className="spread__text">
          <p className="t-label" style={{ color: "var(--sage)" }}>About the house</p>
          <h2 className="t-title">A shared space should feel like a place, not a spreadsheet.</h2>
          <p className="t-body">
            At 14 Park Street the month is rent, British Gas, the Tuesday bins, and
            who still owes whom. Commune is the one surface for that — communal
            finance and the practical running of the group, in the same calm room.
          </p>
        </div>
        <div className="spread__photo">
          <img src={asset("photo/house.jpg")} alt="The living room at 14 Park Street" />
        </div>
      </section>
      <section id="month" className="ledger">
        <div className="wrap">
          <div className="ledger__head">
            <div>
              <p className="t-label" style={{ color: "var(--sage)", marginBottom: 6 }}>August cycle</p>
              <h2 className="t-title">14 Park Street</h2>
            </div>
            <p className="t-body">Maya, Jordan, Alex · household since 2024</p>
          </div>
          <div className="ledger__grid">
            <div className="ledger__cell">
              <p className="t-label">You owe</p>
              <p className="ledger__amt">£42.00</p>
              <p className="t-body">Pay Jordan this week. Or net the Tesco £18 and send £24.</p>
            </div>
            <div className="ledger__cell">
              <p className="t-label">Right now</p>
              <p className="ledger__amt" style={{ fontSize: 24, paddingTop: 8 }}>Gas Friday</p>
              <p className="t-body">British Gas £94.20 · Jordan paid · your share open.</p>
            </div>
            <div className="ledger__cell">
              <p className="t-label">House fund</p>
              <p className="ledger__amt">£420</p>
              <p className="t-body">£180 still to collect from Alex.</p>
            </div>
          </div>
          <div className="ledger__moves">
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
        </div>
      </section>
      <section id="spaces" className="wrap">
        <p className="t-label" style={{ color: "var(--sage)", paddingTop: 56 }}>How people share</p>
        <h2 className="t-title" style={{ margin: "10px 0 22px" }}>The same model. Different houses.</h2>
        <div className="essay">
          <figure>
            <img src={asset("photo/kitchen.jpg")} alt="" />
            <figcaption>House shares · rent, bills, the Tuesday bins</figcaption>
          </figure>
          <figure>
            <img src={asset("photo/couple.jpg")} alt="" />
            <figcaption>Couples · one picture of the month</figcaption>
          </figure>
          <figure>
            <img src={asset("photo/trip.jpg")} alt="" />
            <figcaption>Trips · log on the go, settle before you land</figcaption>
          </figure>
        </div>
      </section>
      <section id="membership" className="rates">
        <div className="wrap">
          <p className="t-label" style={{ color: "var(--sage)" }}>Membership</p>
          <h2 className="t-title" style={{ margin: "10px 0 8px" }}>Simple, on the page.</h2>
          <p className="t-body" style={{ marginBottom: 28 }}>7-day trial on your first space. No card.</p>
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
      <section className="close">
        <img src={asset("photo/couple.jpg")} alt="" />
        <div className="close__veil" />
        <div className="close__in wrap">
          <h2 className="t-title">Live clearly, together.</h2>
          <a className="btn btn--light" href={SIGNUP}>Start your space</a>
        </div>
      </section>
      <Footer />
      <DesignSwitch current="paper" />
    </div>
  );
}
