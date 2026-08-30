import { Link } from "wouter";
import { NAV, APP, SIGNUP, PLANS, asset } from "./content";

export function DesignSwitch({ current }: { current?: "paper" | "ink" | "product" }) {
  return (
    <nav className="dswitch" aria-label="Design explorations">
      <Link href="/" className={!current ? "is-on" : undefined}>All</Link>
      <Link href="/paper" className={current === "paper" ? "is-on" : undefined}>Paper</Link>
      <Link href="/ink" className={current === "ink" ? "is-on" : undefined}>Ink</Link>
      <Link href="/product" className={current === "product" ? "is-on" : undefined}>Product</Link>
    </nav>
  );
}

export function Header({ theme = "paper" }: { theme?: "paper" | "ink" }) {
  return (
    <header className={`top${theme === "ink" ? " top--ink" : ""}`}>
      <div className="top__in">
        <a href="/" className="top__brand">
          <img src={asset("logo.png")} alt="" />
          <span className="t-logo">Commune</span>
        </a>
        <nav className="top__nav">
          {NAV.map((n) => (
            <a key={n.href} href={n.href}>{n.label}</a>
          ))}
        </nav>
        <div className="top__acts">
          <a className="top__signin" href={APP}>Sign in</a>
          <a className={`btn ${theme === "ink" ? "btn--light" : "btn--sage"}`} href={SIGNUP}>
            Start for free
          </a>
        </div>
      </div>
    </header>
  );
}

export function Footer({ theme = "paper" }: { theme?: "paper" | "ink" }) {
  return (
    <footer className={`foot${theme === "ink" ? " foot--ink" : ""}`}>
      <div className="foot__in">
        <div className="foot__brand">
          <img src={asset("logo.png")} alt="" />
          <span className="t-logo">Commune</span>
        </div>
        <p className="t-body">© {new Date().getFullYear()} Commune</p>
        <a className="t-ui" href="mailto:support@ourcommune.io">support@ourcommune.io</a>
      </div>
    </footer>
  );
}

export function Pricing({ ink = false }: { ink?: boolean }) {
  return (
    <section id="pricing" className="section">
      <div className="wrap">
        <p className="t-label" style={{ color: ink ? "#8fbfa4" : undefined, marginBottom: 10 }}>Membership</p>
        <h2 className="t-title" style={{ marginBottom: 8 }}>Simple, transparent pricing.</h2>
        <p className="t-body" style={{ marginBottom: 28, color: ink ? "rgba(255,255,255,0.55)" : undefined }}>
          7-day free trial on your first space. No card required.
        </p>
        <div className="plans">
          {PLANS.map((p) => (
            <article key={p.name} className={`plan${p.featured ? " plan--feat" : ""}`}>
              <p className="t-label plan__name">{p.name}{p.featured ? " · most popular" : ""}</p>
              <div>
                <span className="plan__price">{p.price}</span>
                <span className="plan__mo">/mo</span>
              </div>
              <hr className="plan__rule" />
              <ul className="plan__list">
                {p.items.map((it) => <li key={it}>{it}</li>)}
              </ul>
              <a className={`btn ${p.featured ? (ink ? "btn--sage" : "btn--light") : (ink ? "btn--ghost-light" : "btn--ghost")}`} href={SIGNUP}>
                Start 7-day trial
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
