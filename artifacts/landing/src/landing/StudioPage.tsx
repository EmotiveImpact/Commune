import { Link } from "wouter";
import { asset } from "./content";
import { Header, Footer, DesignSwitch } from "./Chrome";

export default function StudioPage() {
  return (
    <>
      <div className="cover">
        <img className="cover__img" src={asset("photo/kitchen.jpg")} alt="" />
        <div className="cover__veil" />
        <Header
          theme="clear"
          links={[
            { href: "/paper", label: "Paper" },
            { href: "/ink", label: "Ink" },
            { href: "/product", label: "Product" },
          ]}
        />
        <div className="cover__in wrap">
          <p className="t-label cover__k">Landing explorations · August</p>
          <h1 className="t-display cover__h">Three ways the house could meet the street.</h1>
          <p className="t-body cover__lead">
            Same Inter scale. Same paper, ink, and sage. Different art direction. Open one and live with it.
          </p>
        </div>
      </div>
      <section className="contents">
        <div className="wrap">
          <Link href="/paper" className="contents__row">
            <span className="contents__n">01</span>
            <div>
              <h2 className="contents__t">Paper · the house journal</h2>
              <p className="contents__d">A cream field, a photograph that meets the edge, and the month at 14 Park Street set like a ledger.</p>
            </div>
            <div className="contents__img"><img src={asset("photo/house.jpg")} alt="" /></div>
          </Link>
          <Link href="/ink" className="contents__row">
            <span className="contents__n">02</span>
            <div>
              <h2 className="contents__t">Ink · the night desk</h2>
              <p className="contents__d">You open it after dinner. August, you owe £42, gas Friday — then the transfers.</p>
            </div>
            <div className="contents__img"><img src={asset("photo/night.jpg")} alt="" /></div>
          </Link>
          <Link href="/product" className="contents__row">
            <span className="contents__n">03</span>
            <div>
              <h2 className="contents__t">Product · the operating surface</h2>
              <p className="contents__d">The hub is the first screen. Navy chrome, one balance, You → Jordan. Lifestyle sits underneath.</p>
            </div>
            <div className="contents__img"><img src={asset("photo/studio.jpg")} alt="" /></div>
          </Link>
        </div>
      </section>
      <Footer note="Keep one. Throw the others out." />
      <DesignSwitch />
    </>
  );
}
