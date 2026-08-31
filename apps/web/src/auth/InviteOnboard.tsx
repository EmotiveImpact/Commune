import { useState, type FormEvent } from "react";
import { AuthLayout } from "./AuthLayout";
import { useApp } from "../state";
import type { Hub } from "../data/household";

export function InvitePage() {
  const { go, session, signIn } = useApp();

  function join() {
    if (!session || session.seed !== "maya" || !session.hasHubs) {
      signIn({
        name: "Maya Chen",
        email: "maya@14park.st",
        seed: "maya",
        hasHubs: true,
        emptyLedger: false,
      });
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
  const { createHub, session } = useApp();
  const [name, setName] = useState("14 Park Street");
  const [type, setType] = useState<Hub["type"]>("Household");
  const [currency, setCurrency] = useState("£ GBP");

  function create(event: FormEvent) {
    event.preventDefault();
    createHub(
      {
        name: name.trim() || "14 Park Street",
        type,
        currency,
      },
      { openExpense: true },
    );
  }

  return (
    <AuthLayout>
      <form className="commune-auth-panel" onSubmit={create}>
        <h2>Name the space.</h2>
        <p className="commune-auth-lede">
          {session?.name ? `${session.name} · ` : ""}A home, a studio, a trip. One hub. You can add more later.
        </p>
        <div className="a-field">
          <label htmlFor="ob-name">Name</label>
          <input id="ob-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="a-field">
          <label htmlFor="ob-type">Type</label>
          <select id="ob-type" value={type} onChange={(e) => setType(e.target.value as Hub["type"])}>
            <option>Household</option>
            <option>Workspace</option>
            <option>Trip</option>
          </select>
        </div>
        <div className="a-field">
          <label htmlFor="ob-cur">Currency</label>
          <select id="ob-cur" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option>£ GBP</option>
            <option>$ USD</option>
            <option>€ EUR</option>
          </select>
        </div>
        <div className="a-field-row">
          <button className="a-btn" type="submit">
            Create hub
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}
