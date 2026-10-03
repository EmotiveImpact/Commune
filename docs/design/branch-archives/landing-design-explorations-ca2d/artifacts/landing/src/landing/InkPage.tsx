import { SIGNUP, asset } from "./content";
import { Header, Footer, DesignSwitch } from "./Chrome";

export default function InkPage() {
  return (
    <div style={{ background: "#0f1118" }}>
      <section className="night">
        <img className="night__img" src={asset("photo/night.jpg")} alt="" />
        <div className="night__veil" />
        <Header
          theme="clear"
          links={[
            { href: "#desk", label: "The desk" },
            { href: "#spaces", label: "Spaces" },
            { href: "#membership", label: "Membership" },
          ]}
        />
        <div className="night__in wrap">
          <p className="night__status"><i /> August · you owe £42 · gas Friday · fund £420</p>
          <h1 className="t-display night__h">Know what you owe. Know what needs doing.</h1>
          <p className="t-body night__sub">
            Communal finance and house operations on one calm surface — opened at the end of the day.
          </p>
          <div className="night__cta">
            <a className="btn btn--sage" href={SIGNUP}>Start 7-day trial</a>
            <a className="btn btn--ghost-light" href="#desk">Open the desk</a>
          </div>
        </div>
      </section>
      <section id="desk" className="desk">
        <div className="wrap">
          <p className="t-label" style={{ color: "#8fbfa4", marginBottom: 10 }}>14 Park Street · this cycle</p>
          <h2 className="t-title" style={{ marginBottom: 28 }}>The desk, after dinner.</h2>
          <div className="desk__grid">
            <div className="owebox">
              <p className="t-label">You owe</p>
              <p className="owebox__n">£42.00</p>
              <p>Pay Jordan this week. Or net the Tesco £18 and send £24.</p>
              <a className="btn btn--sage" href={SIGNUP}>Settle with Jordan</a>
              <a className="btn btn--ghost-light" href={SIGNUP}>Nudge him</a>
              <div style={{ marginTop: 22 }}>
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
              </div>
            </div>
            <div className="nowbox">
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
        </div>
      </section>
      <section id="spaces" className="doc">
        <div className="wrap">
          <p className="t-label" style={{ color: "var(--sage)" }}>Spaces</p>
          <h2 className="t-title" style={{ margin: "10px 0 0" }}>Every way people share.</h2>
          <div className="doc__list">
            {[
              ["photo/kitchen.jpg", "House shares", "Rent, bills, the Tuesday bins", "One kitchen. One cycle."],
              ["photo/couple.jpg", "Couples", "Joint expenses, one monthly picture", "No spreadsheet between you."],
              ["photo/studio.jpg", "Studios & offices", "Shared costs, tools, roles", "Who owns the broadband."],
              ["photo/trip.jpg", "Group trips", "Log on the go, settle before you land", "Clear before the airport."],
            ].map(([img, t, d, s]) => (
              <div className="doc__row" key={t}>
                <img src={asset(img)} alt="" />
                <div>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
                <p className="t-body">{s}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section id="membership" className="ink-rates">
        <div className="wrap">
          <p className="t-label" style={{ color: "#8fbfa4" }}>Membership</p>
          <h2 className="t-title" style={{ margin: "10px 0 8px" }}>Quiet pricing.</h2>
          <p className="t-body" style={{ color: "rgba(255,255,255,0.5)", marginBottom: 28 }}>7-day trial on your first space. No card.</p>
          <div className="rates__row">
            <span className="rates__name">Standard</span>
            <span className="rates__price">£4.99</span>
            <span className="rates__for">1 space · 8 members</span>
            <a className="btn btn--ghost-light" href={SIGNUP}>Start trial</a>
          </div>
          <div className="rates__row is-feat">
            <span className="rates__name">Pro</span>
            <span className="rates__price">£9.99</span>
            <span className="rates__for">3 spaces · 15 members</span>
            <a className="btn btn--sage" href={SIGNUP}>Start trial</a>
          </div>
          <div className="rates__row">
            <span className="rates__name">Agency</span>
            <span className="rates__price">£29.99</span>
            <span className="rates__for">Unlimited · operator path</span>
            <a className="btn btn--ghost-light" href={SIGNUP}>Start trial</a>
          </div>
        </div>
      </section>
      <Footer theme="ink" />
      <DesignSwitch current="ink" />
    </div>
  );
}
