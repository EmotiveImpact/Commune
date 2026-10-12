import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { Icon } from "../ui/Icon";
import { Avatar, Switch } from "../ui/widgets";
import { ImagePick } from "../ui/photos";
import { CoverImage, coverToneClass } from "../ui/CoverImage";
import { useApp } from "../state";
import { cx } from "../ui/cx";
import { LIMITS } from "../data/limits";
import { CommuneLocationFields, type CommuneLocation } from "../ui/CommuneLocationFields";
import { ReminderUsageMeter } from "../ui/ReminderUsage";
import { useEmailReminders } from "../ui/useEmailReminders";
import { SignInSettings } from "../ui/SignInSettings";
import { communeExportJson, downloadText, expensesCsv } from "../data/export";
import { todayIso } from "../data/operations";
import { currencyHint, currencyLockedBy } from "../data/currency";
import type { Snapshot } from "../live/model";

export function SettingsScreen() {
  const {
    go,
    navMode,
    setNavMode,
    dark,
    setDark,
    noticesOn,
    setNoticesOn,
    currency,
    setCurrency,
    signOut,
    you,
    setAvatar,
    hub,
    places,
    reminderUsage,
    session,
  } = useApp();
  const emailReminders = useEmailReminders(session?.userId);
  return (
    <div className="a-set">
      <aside className="a-set-left">
        <div className="a-set-card">
          <div className="a-set-you">
            <Avatar tone="maya" initials={you.initials} />
            <div className="a-set-you-copy">
              <button className="a-set-name" type="button" onClick={() => go("profile")}>
                {you.name}
                <Icon name="edit" size={14} />
              </button>
              <span>{you.email}</span>
              <ImagePick
                label="Change photo"
                clearLabel="Remove"
                hasCustom={Boolean(you.photo)}
                maxEdge={320}
                inputLabel="Your photo"
                onPhoto={setAvatar}
                onClear={() => setAvatar(null)}
              />
            </div>
          </div>
          <ReminderUsageMeter usage={reminderUsage} placement="account" />
        </div>
        <div className="a-set-card">
          <p className="a-set-plan-k">Early access</p>
          <h3 className="a-set-plan-name">No subscription yet</h3>
          <p className="a-set-plan-lede">Billing and payments are not connected.</p>
          <div className="a-set-meter-meta">
            <span>{hub.members.length} {hub.members.length === 1 ? "member" : "members"}</span>
            <span>{places.length} {places.length === 1 ? "hub" : "hubs"}</span>
          </div>
          <p className="a-set-plan-note">No renewal or charge is scheduled for {hub.name}.</p>
        </div>
      </aside>
      <div className="a-set-main">
        <div className="a-set-group">
          <h3>Get more out of Commune</h3>
          <div className="a-set-list">
            <button className="a-set-row" type="button" onClick={() => go("commune-settings")}>
              <span className="a-set-row-ic" aria-hidden="true"><Icon name="settings" /></span>
              <span className="a-set-row-copy">
                <strong>{hub.name} settings</strong>
                <span>Photo, details, and members for this commune.</span>
              </span>
              <Icon name="chevron" size={16} />
            </button>
            <button className="a-set-row" type="button" onClick={() => go("profile")}>
              <span className="a-set-row-ic" aria-hidden="true">
                <Icon name="billing" />
              </span>
              <span className="a-set-row-copy">
                <strong>How people pay you</strong>
                <span>Revolut, PayPal, bank. Saved only in this browser for now.</span>
              </span>
              <Icon name="chevron" size={16} />
            </button>
            <button className="a-set-row" type="button" onClick={() => go("communes")}>
              <span className="a-set-row-ic" aria-hidden="true">
                <Icon name="hub" />
              </span>
              <span className="a-set-row-copy">
                <strong>Places</strong>
                <span>Switch house, studio, or trip. Or create one.</span>
              </span>
              <Icon name="chevron" size={16} />
            </button>
          </div>
        </div>
        <div className="a-set-group">
          <h3>Preferences</h3>
          <div className="a-set-list">
            <div className="a-set-row">
              <span className="a-set-row-copy">
                <strong>Sidebar</strong>
                <span>Basic keeps everyday tools visible. Advanced adds templates and insights.</span>
              </span>
              <div className="a-seg" role="group" aria-label="Sidebar density">
                <button
                  type="button"
                  className={cx(navMode === "basic" && "is-on")}
                  aria-pressed={navMode === "basic"}
                  onClick={() => setNavMode("basic")}
                >
                  Basic
                </button>
                <button
                  type="button"
                  className={cx(navMode === "advanced" && "is-on")}
                  aria-pressed={navMode === "advanced"}
                  onClick={() => setNavMode("advanced")}
                >
                  Advanced
                </button>
              </div>
            </div>
            <div className="a-set-row">
              <span className="a-set-row-copy">
                <strong>Dark mode</strong>
                <span>Ink canvas. Off keeps the cream paper.</span>
              </span>
              <Switch checked={dark} onChange={setDark} label="Dark mode" />
            </div>
            <div className="a-set-row">
              <span className="a-set-row-copy">
                <strong>Notices</strong>
                <span>Show in-app reminders on this device.</span>
              </span>
              <Switch checked={noticesOn} onChange={setNoticesOn} label="Notices" />
            </div>
            <div className="a-set-row">
              <span className="a-set-row-copy">
                <strong>Email reminders</strong>
                <span aria-live="polite">
                  {emailReminders.error || (emailReminders.enabled === null
                    ? "Checking your email setting…"
                    : "Email me when someone in a commune sends me a reminder.")}
                </span>
              </span>
              <Switch
                checked={emailReminders.enabled === true}
                onChange={(next) => void emailReminders.save(next)}
                label="Email reminders"
                disabled={emailReminders.enabled === null || emailReminders.saving}
              />
            </div>
            <div className="a-set-row">
              <span className="a-set-row-copy">
                <strong>Currency</strong>
                <span>Your display preference; each commune keeps its own currency.</span>
              </span>
              <select
                aria-label="Currency"
                value={currency}
                onChange={(event) =>
                  setCurrency(event.target.value as "£ GBP" | "$ USD" | "€ EUR")
                }
              >
                <option>£ GBP</option>
                <option>$ USD</option>
                <option>€ EUR</option>
              </select>
            </div>
            <div className="a-set-row">
              <span className="a-set-row-copy">
                <strong>Language</strong>
                <span>The app, not the house chat.</span>
              </span>
              <span className="a-set-val">English</span>
            </div>
          </div>
        </div>
        <SignInSettings />
        <div className="a-set-group">
          <h3>Support &amp; legal</h3>
          <div className="a-set-list">
            <a className="a-set-row" href="https://ourcommune.io" target="_blank" rel="noreferrer">
              <span className="a-set-row-copy">
                <strong>Contact us</strong>
                <span>ourcommune.io</span>
              </span>
              <Icon name="external" size={16} />
            </a>
            <Link className="a-set-row" href="/privacy">
              <span className="a-set-row-copy">
                <strong>Privacy</strong>
              </span>
              <Icon name="chevron" size={16} />
            </Link>
            <Link className="a-set-row" href="/terms">
              <span className="a-set-row-copy">
                <strong>Terms of use</strong>
              </span>
              <Icon name="chevron" size={16} />
            </Link>
            <button className="a-set-row" type="button" onClick={signOut}>
              <span className="a-set-row-copy">
                <strong>Log out</strong>
                <span>Return to the login page.</span>
              </span>
              <Icon name="chevron" size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CommuneSettingsScreen() {
  const {
    hub, session, go, setHubPhoto, updateCommune, snapshots, loadFullHistory,
  } = useApp();
  const [name, setName] = useState(hub.name);
  const [type, setType] = useState(hub.type);
  const [currency, setCurrency] = useState(hub.currency);
  const [location, setLocation] = useState<CommuneLocation>({
    address: hub.address ?? "",
    destination: hub.destination ?? "",
    stayName: hub.stayName ?? "",
    stayAddress: hub.stayAddress ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState<"" | "loading" | "error">("");
  // The database's rule, as its snapshot reports it.
  const currencyLocks = currencyLockedBy(snapshots[hub.id]);
  const canEdit = hub.role === "admin";
  const locationChanged = type === "Trip"
    ? location.destination.trim() !== (hub.destination ?? "") || location.stayName.trim() !== (hub.stayName ?? "") || location.stayAddress.trim() !== (hub.stayAddress ?? "")
    : location.address.trim() !== (hub.address ?? "");
  const hasChanges = name.trim() !== hub.name || type !== hub.type || currency !== hub.currency || locationChanged;
  const hasCustomPhoto = Boolean(session?.hubPhotos?.[hub.id]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!canEdit) return;
    setError("");
    setSaved(false);
    if (!name.trim()) {
      setError("Give this commune a name.");
      return;
    }
    setBusy(true);
    try {
      await updateCommune({ name, type, currency: currency ?? "GBP", ...location });
      setLocation(type === "Trip" ? { ...location, address: "" } : { address: location.address, destination: "", stayName: "", stayAddress: "" });
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save commune settings.");
    } finally {
      setBusy(false);
    }
  }

  // A file holds every expense, so the older ones are loaded first.
  async function download(save: (ledger: Snapshot) => void) {
    setExporting("loading");
    try {
      const ledger = await loadFullHistory();
      if (ledger) save(ledger);
      setExporting("");
    } catch {
      setExporting("error");
    }
  }

  if (!hub.id) {
    return <div className="a-empty"><h2>No commune selected.</h2><button className="a-btn" type="button" onClick={() => go("commune-new")}>Create a commune</button></div>;
  }

  return (
    <div className="a-set a-commune-set">
      <aside className="a-set-left">
        <div className="a-set-card">
          <div className={cx("a-commune-photo-preview", coverToneClass(hub))} role="img" aria-label={`${hub.name} cover photo`}>
            <CoverImage hub={hub} placement="preview" />
          </div>
          <h2>{hub.name}</h2>
          <p className="a-set-plan-lede">{hub.type} · {hub.members.length} {hub.members.length === 1 ? "person" : "people"}</p>
          <ImagePick
            label="Choose photo"
            clearLabel="Use original"
            hasCustom={hasCustomPhoto}
            maxEdge={1280}
            inputLabel={`Photo for ${hub.name}`}
            onPhoto={(dataUrl) => setHubPhoto(hub.id, dataUrl)}
            onClear={() => setHubPhoto(hub.id, null)}
          />
          <p className="a-commune-setting-note">This photo is kept in this browser session for now. It is not shared with other members.</p>
        </div>
        <button className="a-btn ghost" type="button" onClick={() => go("hub")}>Back to this commune</button>
      </aside>
      <div className="a-set-main">
        <div className="a-set-group">
          <h3>Shared details</h3>
          <form className="a-set-list a-commune-details" onSubmit={(event) => void save(event)}>
            <div className="a-field">
              <label htmlFor="commune-setting-name">Commune name</label>
              <input id="commune-setting-name" value={name} maxLength={LIMITS.communeName} disabled={!canEdit || busy} onChange={(event) => { setName(event.target.value); setSaved(false); }} required />
              <span className="a-field-limit">{name.length}/{LIMITS.communeName}</span>
            </div>
            <div className="a-field">
              <label htmlFor="commune-setting-type">Type</label>
              <select id="commune-setting-type" value={type} disabled={!canEdit || busy} onChange={(event) => { setType(event.target.value as typeof type); setSaved(false); }}>
                <option>Household</option><option>Workspace</option><option>Trip</option>
              </select>
              <p className="hint">Changes the label and default cover, not existing records.</p>
            </div>
            <div className="a-field">
              <label htmlFor="commune-setting-currency">Currency</label>
              <select id="commune-setting-currency" value={currency} disabled={!canEdit || busy || currencyLocks.length > 0} onChange={(event) => { setCurrency(event.target.value as typeof currency); setSaved(false); }}>
                <option value="GBP">£ GBP</option><option value="USD">$ USD</option><option value="EUR">€ EUR</option>
              </select>
              <p className="hint">{currencyHint(currencyLocks)}</p>
            </div>
            <CommuneLocationFields type={type} value={location} onChange={(next) => { setLocation(next); setSaved(false); }} disabled={!canEdit || busy} idPrefix="commune-setting" />
            {error ? <p className="a-form-error" role="alert">{error}</p> : null}
            {saved ? <p className="a-form-success" role="status">Commune settings saved for everyone.</p> : null}
            {canEdit ? <div className="a-field-row"><button className="a-btn" type="submit" disabled={busy || !hasChanges}>{busy ? "Saving…" : "Save changes"}</button></div> : <p className="hint">Only a commune admin can edit shared details.</p>}
          </form>
        </div>
        <div className="a-set-group">
          <h3>Records</h3>
          <div className="a-set-list">
            <button className="a-set-row" type="button" disabled={!snapshots[hub.id] || exporting === "loading"} onClick={() => void download((ledger) =>
              downloadText(`${hub.name} expenses ${todayIso()}.csv`, expensesCsv(ledger), "text/csv;charset=utf-8"))}>
              <span className="a-set-row-ic" aria-hidden="true"><Icon name="expenses" /></span>
              <span className="a-set-row-copy"><strong>Download expenses</strong><span>A spreadsheet with one row per share: amounts, payments received and what is outstanding.</span></span>
            </button>
            <button className="a-set-row" type="button" disabled={!snapshots[hub.id] || exporting === "loading"} onClick={() => void download((ledger) =>
              downloadText(`${hub.name} records ${todayIso()}.json`, communeExportJson(ledger), "application/json"))}>
              <span className="a-set-row-ic" aria-hidden="true"><Icon name="notes" /></span>
              <span className="a-set-row-copy"><strong>Download all records</strong><span>Everything you can see in this commune, as a file. Passwords and door codes in notes are left out.</span></span>
            </button>
          </div>
          {exporting === "loading" ? <p className="a-commune-setting-note" role="status">Loading earlier expenses for the file…</p> : null}
          {exporting === "error" ? <p className="a-form-error" role="alert">Earlier expenses couldn’t be loaded, so no file was made. Try again.</p> : null}
          <p className="a-commune-setting-note">Files are made on this device from what you can already see. Nothing is sent anywhere.</p>
        </div>
        <div className="a-set-group">
          <h3>People</h3>
          <div className="a-set-list">
            <button className="a-set-row" type="button" onClick={() => go("members")}>
              <span className="a-set-row-ic" aria-hidden="true"><Icon name="members" /></span>
              <span className="a-set-row-copy"><strong>Members</strong><span>{hub.members.length} {hub.members.length === 1 ? "person" : "people"} in this commune</span></span>
              <Icon name="chevron" size={16} />
            </button>
            {canEdit ? <button className="a-set-row" type="button" onClick={() => go("member-invite")}>
              <span className="a-set-row-ic" aria-hidden="true"><Icon name="plus" /></span>
              <span className="a-set-row-copy"><strong>Invite someone</strong><span>Send an email invitation or copy a secure link.</span></span>
              <Icon name="chevron" size={16} />
            </button> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
