import { useState, type FormEvent } from "react";
import { AuthLayout } from "./AuthLayout";
import { useApp } from "../state";
import type { Hub } from "../data/household";
import { LIMITS } from "../data/limits";
import { CommuneLocationFields, EMPTY_COMMUNE_LOCATION } from "../ui/CommuneLocationFields";

export function OnboardPage() {
  const { createHub, session } = useApp();
  const [name, setName] = useState("");
  const [type, setType] = useState<Hub["type"]>("Household");
  const [currency, setCurrency] = useState("£ GBP");
  const [location, setLocation] = useState(EMPTY_COMMUNE_LOCATION);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Give your commune a name.");
      return;
    }
    setBusy(true);
    try {
      const created = await createHub({ name: name.trim(), type, currency, ...location });
      if (!created) throw new Error("Could not create the commune.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the commune.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <form className="commune-auth-panel" onSubmit={(event) => void create(event)}>
        <h2>Name your commune.</h2>
        <p className="commune-auth-lede">
          {session?.name ? `${session.name} · ` : ""}A home, a studio, or a trip. Invite other people after you create it.
        </p>
        {error ? <div className="commune-auth-alert" role="alert">{error}</div> : null}
        <div className="a-field">
          <label htmlFor="ob-name">Name</label>
          <input id="ob-name" type="text" required maxLength={LIMITS.communeName} value={name} onChange={(event) => setName(event.target.value)} />
          <span className="a-field-limit">{name.length}/{LIMITS.communeName}</span>
        </div>
        <div className="a-field">
          <label htmlFor="ob-type">Type</label>
          <select id="ob-type" value={type} onChange={(event) => setType(event.target.value as Hub["type"])}>
            <option>Household</option><option>Workspace</option><option>Trip</option>
          </select>
        </div>
        <div className="a-field">
          <label htmlFor="ob-cur">Currency</label>
          <select id="ob-cur" value={currency} onChange={(event) => setCurrency(event.target.value)}>
            <option>£ GBP</option><option>$ USD</option><option>€ EUR</option>
          </select>
        </div>
        <CommuneLocationFields type={type} value={location} onChange={setLocation} disabled={busy} idPrefix="onboard" />
        <div className="a-field-row">
          <button className="a-btn" type="submit" disabled={busy}>{busy ? "Creating…" : "Create commune"}</button>
        </div>
      </form>
    </AuthLayout>
  );
}
