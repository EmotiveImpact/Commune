import { WHY, SPACES, SIGNUP, asset } from "./content";
import { Header, Footer, Pricing, DesignSwitch } from "./Chrome";

export default function InkPage() {
  return (
    <div className="lp lp--ink">
      <Header theme="ink" />
      <main>
        <section className="hero-i">
          <img className="hero-i__bg" src={asset("photo/night.png")} alt="" />
          <div className="hero-i__veil" />
          <div className="hero-i__in">
            <div className="wrap">
              <p className="t-label hero-i__kicker">The operating system for shared spaces</p>
              <h1 className="t-display hero-i__h">Know what you owe. Know what needs doing.</h1>
              <p className="t-body hero-i__sub">
                Communal finance and house operations in one calm surface —
                for homes, studios, crews, and trips.
              </p>
              <div className="hero-i__cta">
                <a className="btn btn--sage" href={SIGNUP}>Start 7-day trial</a>
                <a className="btn btn--ghost-light" href="#why">Why Commune</a>
              </div>
            </div>
          </div>
        </section>

        <section id="why" className="section">
          <div className="wrap">
            <p className="t-label" style={{ color: "#8fbfa4", marginBottom: 10 }}>Why Commune</p>
            <h2 className="t-title" style={{ marginBottom: 22 }}>Four pillars. No extra noise.</h2>
            <div className="ink-cards">
              {WHY.map((w) => (
                <article key={w.n} className="ink-card">
                  <p className="t-label ink-card__n">{w.n}</p>
                  <p className="ink-card__t">{w.t}</p>
                  <p className="ink-card__d">{w.d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="spaces" className="ink-band section">
          <div className="wrap">
            <p className="t-label" style={{ color: "var(--sage)", marginBottom: 10 }}>Spaces</p>
            <h2 className="t-title" style={{ marginBottom: 22 }}>Every way people share.</h2>
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

        <Pricing ink />
      </main>
      <Footer theme="ink" />
      <DesignSwitch current="ink" />
    </div>
  );
}
