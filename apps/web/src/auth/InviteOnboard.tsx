import { AuthLayout } from "./AuthLayout";
import { useApp } from "../state";

export function InvitePage() {
  const { go, session, signIn } = useApp();

  function join() {
    if (!session) {
      signIn({ name: "Maya Chen", email: "maya@14park.st" });
    }
    go("hub", { hub: "park" });
  }

  return (
    <AuthLayout>
      <div className="commune-auth-panel">
        <h2>Jordan invited you.</h2>
        <p className="commune-auth-lede">14 Park Street · household · Maya, Jordan, and you.</p>
        <div className="a-panel" style={{ background: "transparent", border: 0, boxShadow: "none", padding: 0 }}>
          <div className="a-member-row">
            <span className="avatar jordan">JH</span>
            <div className="who">
              <strong>14 Park Street</strong>
              <span>Household · 3 people after you join</span>
            </div>
          </div>
          <div className="a-field-row" style={{ marginTop: 18 }}>
            <button className="a-btn" type="button" onClick={join}>
              Join this hub
            </button>
            <button className="a-btn ghost" type="button" onClick={() => go("login")}>
              Sign in first
            </button>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}

export function OnboardPage() {
  const { go, session, signIn } = useApp();

  function create() {
    if (!session) signIn({ name: "Maya Chen", email: "maya@14park.st" });
    go("hub-empty", { hub: "park" });
  }

  return (
    <AuthLayout>
      <div className="commune-auth-panel">
        <h2>Name the space.</h2>
        <p className="commune-auth-lede">A home, a studio, a trip. One hub. You can add more later.</p>
        <div className="a-field">
          <label htmlFor="ob-name">Name</label>
          <input id="ob-name" type="text" defaultValue="14 Park Street" />
        </div>
        <div className="a-field">
          <label htmlFor="ob-type">Type</label>
          <select id="ob-type" defaultValue="Household">
            <option>Household</option>
            <option>Workspace</option>
            <option>Trip</option>
          </select>
        </div>
        <div className="a-field">
          <label htmlFor="ob-cur">Currency</label>
          <select id="ob-cur" defaultValue="£ GBP">
            <option>£ GBP</option>
            <option>$ USD</option>
            <option>€ EUR</option>
          </select>
        </div>
        <div className="a-field-row">
          <button className="a-btn" type="button" onClick={create}>
            Create hub
          </button>
        </div>
      </div>
    </AuthLayout>
  );
}
