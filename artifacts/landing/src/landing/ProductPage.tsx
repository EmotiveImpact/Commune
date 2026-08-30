import { SPACES, STEPS, SIGNUP, asset } from "./content";
import { Header, Footer, Pricing, DesignSwitch } from "./Chrome";
import { HubPreview } from "./HubPreview";

export default function ProductPage() {
  return (
    <div className="lp lp--product">
      <Header />
      <main>
        <section className="hero-pr">
          <div className="wrap">
            <p className="t-label hero-pr__k">Communal finance + group operations</p>
            <h1 className="t-display hero-pr__h">The command centre for a shared space.</h1>
            <p className="t-body hero-pr__sub">
              Open the hub. See what you owe, what is paid, and what needs a person.
              Then switch to the next space.
            </p>
            <div className="hero-pr__cta">
              <a className="btn btn--sage" href={SIGNUP}>Start 7-day trial</a>
              <a className="btn btn--ghost" href="#pricing">View pricing</a>
            </div>
            <HubPreview />
          </div>
        </section>

        <section className="section">
          <div className="wrap">
            <p className="t-label" style={{ color: "var(--sage)", marginBottom: 10 }}>How it works</p>
            <h2 className="t-title" style={{ marginBottom: 22 }}>Three steps to a well-run space.</h2>
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

        <section className="section" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="strip">
              <img src={asset("photo/kitchen.jpg")} alt="" />
              <img src={asset("photo/studio.jpg")} alt="" />
              <img src={asset("photo/trip.jpg")} alt="" />
            </div>
          </div>
        </section>

        <section id="spaces" className="section" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <p className="t-label" style={{ color: "var(--sage)", marginBottom: 10 }}>Spaces</p>
            <h2 className="t-title" style={{ marginBottom: 22 }}>One model. Many kinds of group.</h2>
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

        <Pricing />
      </main>
      <Footer />
      <DesignSwitch current="product" />
    </div>
  );
}
