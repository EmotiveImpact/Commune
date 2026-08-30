import { Link } from "wouter";
import { asset } from "./content";
import { Header, Footer, DesignSwitch } from "./Chrome";

const STUDIES = [
  {
    href: "/paper",
    kicker: "01  ·  Paper",
    title: "The house journal",
    body: "Cream field, tighten type, photography as evidence. Closest to how the product already feels.",
    img: "photo/kitchen.png",
    wide: true,
  },
  {
    href: "/ink",
    kicker: "02  ·  Ink",
    title: "The night desk",
    body: "Navy canvas from the app sidebar. Same 14px body, same 10px labels — darker, quieter.",
    img: "photo/night.png",
    wide: false,
  },
  {
    href: "/product",
    kicker: "03  ·  Product",
    title: "The operating surface",
    body: "The hub is the hero. Lifestyle sits underneath. Built for people who need to see the tool.",
    img: "photo/house.png",
    wide: false,
  },
] as const;

export default function StudioPage() {
  return (
    <div className="studio">
      <Header />
      <main>
        <section className="studio__hero">
          <div className="wrap">
            <p className="t-label studio__kicker">Landing explorations</p>
            <h1 className="t-display">Three directions. One type system.</h1>
            <p className="t-body studio__lead">
              Fonts and sizing come from the tighten HTML mocks: Inter, 10px labels,
              14px body, 24px titles, 64px chrome. Display type tops out at 48px —
              not the billboard the current landing uses. Open a study, live with it,
              keep it or throw it out.
            </p>
          </div>
        </section>

        <section className="wrap">
          <div className="studio__grid">
            {STUDIES.map((s) => (
              <Link key={s.href} href={s.href} className={`scard${s.wide ? " scard--wide" : ""}`}>
                <div className="scard__img">
                  <img src={asset(s.img)} alt="" />
                </div>
                <div className="scard__body">
                  <p className="t-label scard__meta">{s.kicker}</p>
                  <h2 className="scard__h">{s.title}</h2>
                  <p className="t-body">{s.body}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="studio__note">
          <div className="wrap">
            <h2>What we took from the research</h2>
            <p className="t-body">
              Clean sites for this audience — shared houses, couples, studios, trips —
              are winning with editorial restraint, not SaaS chrome. Type is the
              differentiator. Photography is used sparingly and at full intent.
              Proof is specific. The current landing fights that: Inter at 800,
              6.5rem heroes, stock slideshow. These three studies keep the product’s
              paper, ink, and sage, and the tighten scale, then let layout and image
              do the talking.
            </p>
          </div>
        </section>
      </main>
      <Footer />
      <DesignSwitch />
    </div>
  );
}
