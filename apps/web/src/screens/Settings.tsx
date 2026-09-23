import { Icon } from "../ui/Icon";
import { Avatar, Switch } from "../ui/widgets";
import { ImagePick } from "../ui/photos";
import { useApp } from "../state";
import { cx } from "../ui/cx";

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
  } = useApp();
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
        </div>
        <div className="a-set-card">
          <p className="a-set-plan-k">Local build</p>
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
                <span>Switch house, studio, or trip — or create one.</span>
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
                <span>Basic is Home, This Hub, and the jumps. Advanced adds the rest.</span>
              </span>
              <div className="a-seg" role="group" aria-label="Sidebar density">
                <button
                  type="button"
                  className={cx(navMode === "basic" && "is-on")}
                  onClick={() => setNavMode("basic")}
                >
                  Basic
                </button>
                <button
                  type="button"
                  className={cx(navMode === "advanced" && "is-on")}
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
            <a className="a-set-row" href="https://ourcommune.io/privacy" target="_blank" rel="noreferrer">
              <span className="a-set-row-copy">
                <strong>Privacy policy</strong>
              </span>
              <Icon name="external" size={16} />
            </a>
            <a className="a-set-row" href="https://ourcommune.io/terms" target="_blank" rel="noreferrer">
              <span className="a-set-row-copy">
                <strong>Terms of service</strong>
              </span>
              <Icon name="external" size={16} />
            </a>
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
