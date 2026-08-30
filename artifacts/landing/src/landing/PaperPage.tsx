import { WHY, SPACES, STEPS, SIGNUP, asset } from "./content";
import { Header, Footer, Pricing, DesignSwitch } from "./Chrome";
import { HubPreview } from "./HubPreview";

export default function PaperPage() {
  return (
    <div className="lp lp--paper">
      <Header />
      <main>
        <section className="hero-p">
          <div className="wrap hero-p__grid">
            <div>
              <p className="t-label hero-p__kicker">Shared money · shared spaces</p>
              <h1 className="t-display hero-p__h">Live clearly, together.</h1>
              <p className="t-body hero-p__sub">
                One hub for the house, the studio, the trip. What you owe, what needs
                doing, who owns it — without the chase.
              </p>
              <div className="hero-p__cta">
                <a className="btn btn--sage" href={SIGNUP}>Start 7-day trial</a>
                <a className="btn btn--ghost" href="#why">See how it works</a>
              </div>
            </div>
            <div className="hero-p__frame">
              <img src={asset("photo/kitchen.png")} alt="Housemates at the kitchen table" />
            </div>
          </div>
        </section>

        <section className="section--tight">
          <div className="wrap">
            <div className="facts">
              <div className="facts__item">
                <p className="t-label facts__k">For</p>
                <p className="facts__v">Houses, couples, studios, trips</p>
              </div>
              <div className="facts__item">
                <p className="t-label facts__k">Trial</p>
                <p className="facts__v">7 days on your first space</p>
              </div>
              <div className="facts__item">
                <p className="t-label facts__k">From</p>
                <p className="facts__v">£4.99 / month after trial</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="wrap split">
            <div className="split__img">
              <img src={asset("photo/house.png")} alt="A quiet shared living room" />
            </div>
            <div>
              <p className="t-label split__k">About Commune</p>
              <h2 className="t-title split__h">Managing shared money and shared spaces should not be complicated.</h2>
              <p className="t-body">
                Shared life usually runs across transfers, screenshots, and group chat.
                Commune is the one place for every cost, every responsibility, and every
                person in the space.
              </p>
            </div>
          </div>
        </section>

        <section id="why" className="section">
          <div className="wrap">
            <p className="t-label" style={{ color: "var(--sage)", marginBottom: 10 }}>Why Commune</p>
            <h2 className="t-title" style={{ marginBottom: 28 }}>Four things a well-run space needs.</h2>
            <div className="why-list">
              {WHY.map((w) => (
                <div key={w.n} className="why-row">
                  <span className="why-row__n">{w.n}</span>
                  <div>
                    <p className="why-row__t">{w.t}</p>
                    <p className="why-row__d">{w.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <p className="t-label" style={{ color: "var(--sage)", marginBottom: 10 }}>In the product</p>
            <h2 className="t-title" style={{ marginBottom: 22 }}>A space, at a glance.</h2>
            <HubPreview />
          </div>
        </section>

        <section id="spaces" className="section">
          <div className="wrap">
            <p className="t-label" style={{ color: "var(--sage)", marginBottom: 10 }}>Spaces</p>
            <h2 className="t-title" style={{ marginBottom: 22 }}>Built for every way people share.</h2>
            <div className="spaces">
              {SPACES.map((s) => (
                <article key={s.id} className="space">
                  <div className="space__img">
                    <img src={asset(s.img)} alt={s.label} />
                  </div>
                  <div className="space__copy">
                    <p className="space__label">{s.label}</p>
                    <p className="space__sub">{s.sub}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <p className="t-label" style={{ color: "var(--sage)", marginBottom: 10 }}>How it works</p>
            <h2 className="t-title" style={{ marginBottom: 22 }}>Three steps.</h2>
            <div className="steps">
              {STEPS.map((s) => (
                <article key={s.n} className="step">
                  <div className="step__n">{s.n}</div>
                  <p className="step__t">{s.t}</p>
                  <p className="t-body">{s.d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <Pricing />

        <section className="cta-photo">
          <img src={asset("photo/couple.png")} alt="" />
          <div className="cta-photo__veil" />
          <div className="cta-photo__in">
            <h2 className="t-title">Live clearly, together.</h2>
            <a className="btn btn--light" href={SIGNUP}>Start your space</a>
          </div>
        </section>
      </main>
      <Footer />
      <DesignSwitch current="paper" />
    </div>
  );
}
