import { useApp } from "../state";
import { Avatar, Pill } from "../ui/widgets";

export function HomeScreen() {
  const { go } = useApp();
  return (
    <>
      <button className="a-place a-focus-lead" type="button" onClick={() => go("hub", { hub: "park" })}>
        <div className="a-focus-hero">
          <span className="type">Needs you · Household</span>
          <h2>14 Park Street</h2>
          <p>You owe £42. Gas Friday. Bins still Jordan’s. Alex hasn’t paid into the fund.</p>
          <div className="a-cover-people">
            <div className="avatar-stack">
              <Avatar tone="maya" initials="MC" />
              <Avatar tone="jordan" initials="JH" />
              <Avatar tone="alex" initials="AR" />
            </div>
            Open this hub
          </div>
        </div>
        <div className="a-place-foot">
          <span>Gas Friday · bins overdue</span>
          <span className="amt">£42</span>
        </div>
      </button>

      <div className="a-focus-pair">
        <button className="a-place" type="button" onClick={() => go("hub", { hub: "studio" })}>
          <div className="a-place-hero studio">
            <span className="type">Quiet</span>
            <h3>Studio East</h3>
            <p>You’re even</p>
          </div>
          <div className="a-place-foot">
            <span>Printer ink Monday</span>
            <span className="amt even">£0</span>
          </div>
        </button>
        <button className="a-place" type="button" onClick={() => go("hub", { hub: "lisbon" })}>
          <div className="a-place-hero lisbon">
            <span className="type">You’re owed</span>
            <h3>Lisbon · Sept</h3>
            <p>You’re owed £64</p>
          </div>
          <div className="a-place-foot">
            <span>Airbnb hold Thursday</span>
            <span className="amt credit">+£64</span>
          </div>
        </button>
      </div>

      <div className="a-home-greet is-after">
        <h1>Park Street needs you this week.</h1>
        <p>Studio is even. Lisbon still owes you £64.</p>
      </div>

      <div className="a-week">
        <div className="a-card">
          <h2>Needs you</h2>
          <p className="sub">The three that should happen. Jump in, or open the hub.</p>
          <div className="hub-feed">
            <button className="hub-feed-row" type="button" onClick={() => go("operations", { hub: "park" })}>
              <Pill tone="warn">Park Street</Pill>
              <div>
                <strong>Bins overdue</strong>
                <div className="when">Still Jordan’s Tuesday</div>
              </div>
              <span className="hub-feed-go">Operations</span>
            </button>
            <button className="hub-feed-row" type="button" onClick={() => go("settle", { hub: "park" })}>
              <Pill tone="sage">Park Street</Pill>
              <div>
                <strong>Pay Jordan £42</strong>
                <div className="when">Gas share · or £24 if you net Tesco</div>
              </div>
              <span className="hub-feed-go">Settle</span>
            </button>
            <button className="hub-feed-row" type="button" onClick={() => go("expenses", { hub: "park" })}>
              <Pill tone="warn">Park Street</Pill>
              <div>
                <strong>British Gas Friday</strong>
                <div className="when">£94.20 · Jordan paid · your share open</div>
              </div>
              <span className="hub-feed-go">Expenses</span>
            </button>
          </div>
        </div>

        <div className="a-card">
          <div className="a-card-head">
            <div>
              <h2>This week</h2>
              <p className="sub">Already happened, across the three.</p>
            </div>
            <button className="a-btn ghost" type="button" onClick={() => go("activity")}>
              Activity
            </button>
          </div>
          <button className="a-item" type="button" onClick={() => go("expenses", { hub: "park" })}>
            <Avatar tone="jordan" initials="JH" />
            <div>
              <strong>British Gas</strong>
              <div className="when">Park Street · Jordan paid the bill</div>
            </div>
            <span className="when">Tue</span>
          </button>
          <button className="a-item" type="button" onClick={() => go("expenses", { hub: "park" })}>
            <Avatar tone="maya" initials="MC" />
            <div>
              <strong>Virgin Media</strong>
              <div className="when">Park Street · Maya logged it</div>
            </div>
            <span className="when">Yesterday</span>
          </button>
          <button className="a-item" type="button" onClick={() => go("hub", { hub: "lisbon" })}>
            <Avatar tone="maya" initials="MC" />
            <div>
              <strong>Airbnb hold</strong>
              <div className="when">Lisbon · your card, still collecting</div>
            </div>
            <span className="when">Thu</span>
          </button>
        </div>
      </div>
    </>
  );
}

export function PlacesScreen() {
  const { go } = useApp();
  return (
    <>
      <div className="a-toolbar">
        <button className="a-btn" type="button" onClick={() => go("commune-new")}>
          New commune
        </button>
      </div>
      <div className="a-place-grid">
        <button className="a-place" type="button" onClick={() => go("hub", { hub: "park" })}>
          <div className="a-place-hero park">
            <span className="type">Household</span>
            <h3>14 Park Street</h3>
            <p>You owe £42</p>
          </div>
          <div className="a-place-foot">
            <span>Gas Friday · bins overdue</span>
            <span className="amt">£42</span>
          </div>
        </button>
        <button className="a-place" type="button" onClick={() => go("hub", { hub: "studio" })}>
          <div className="a-place-hero studio">
            <span className="type">Workspace</span>
            <h3>Studio East</h3>
            <p>You’re even</p>
          </div>
          <div className="a-place-foot">
            <span>Printer ink Monday</span>
            <span className="amt even">£0</span>
          </div>
        </button>
        <button className="a-place" type="button" onClick={() => go("hub", { hub: "lisbon" })}>
          <div className="a-place-hero lisbon">
            <span className="type">Trip</span>
            <h3>Lisbon · Sept</h3>
            <p>You’re owed £64</p>
          </div>
          <div className="a-place-foot">
            <span>Airbnb hold Thursday</span>
            <span className="amt credit">+£64</span>
          </div>
        </button>
      </div>

      <div className="a-card" style={{ marginTop: 18 }}>
        <h2>Needs you</h2>
        <p className="sub">Across every space. Open the hub, or jump straight in.</p>
        <div className="hub-feed">
          <button className="hub-feed-row" type="button" onClick={() => go("settle", { hub: "park" })}>
            <Pill tone="sage">Park Street</Pill>
            <div>
              <strong>Pay Jordan £42</strong>
              <div className="when">Gas share · or £24 if you net Tesco</div>
            </div>
            <span className="hub-feed-go">Settle</span>
          </button>
          <button className="hub-feed-row" type="button" onClick={() => go("expenses", { hub: "park" })}>
            <Pill tone="warn">Park Street</Pill>
            <div>
              <strong>British Gas Friday</strong>
              <div className="when">£94.20 · Jordan paid · your share open</div>
            </div>
            <span className="hub-feed-go">Expenses</span>
          </button>
          <button className="hub-feed-row" type="button" onClick={() => go("operations", { hub: "park" })}>
            <Pill tone="warn">Park Street</Pill>
            <div>
              <strong>Bins overdue</strong>
              <div className="when">Still Jordan’s Tuesday</div>
            </div>
            <span className="hub-feed-go">Operations</span>
          </button>
          <button className="hub-feed-row" type="button" onClick={() => go("hub", { hub: "lisbon" })}>
            <Pill tone="open">Lisbon</Pill>
            <div>
              <strong>Airbnb hold · 4 days</strong>
              <div className="when">Collect £40 from Jordan, £24 from Ness</div>
            </div>
            <span className="hub-feed-go">Open hub</span>
          </button>
          <button className="hub-feed-row" type="button" onClick={() => go("hub", { hub: "studio" })}>
            <Pill>Studio East</Pill>
            <div>
              <strong>Printer ink Monday</strong>
              <div className="when">Sam’s run · split three ways</div>
            </div>
            <span className="hub-feed-go">Open hub</span>
          </button>
        </div>
      </div>
    </>
  );
}

export function HomeEmptyScreen() {
  const { go } = useApp();
  return (
    <div className="a-empty">
      <h2>No communes yet.</h2>
      <p>A hub is a house, a studio, or a trip. Create one, or join from an invite.</p>
      <div className="a-field-row">
        <button className="a-btn" type="button" onClick={() => go("onboard")}>
          Create a hub
        </button>
        <button className="a-btn ghost" type="button" onClick={() => go("invite")}>
          I have an invite
        </button>
      </div>
    </div>
  );
}
