import { useEffect, useRef, useState } from "react";
import type { IconName } from "../ui/Icon";
import { Icon } from "../ui/Icon";
import { Avatar } from "../ui/widgets";
import { useApp } from "../state";
import type { ScreenId, WindowId } from "../data/household";
import { cx } from "../ui/cx";

type NavItem = { id: ScreenId; label: string; icon: IconName };

const BASIC: NavItem[] = [
  { id: "expenses", label: "Expenses", icon: "expenses" },
  { id: "settle", label: "Settle", icon: "settle" },
  { id: "recurring", label: "Recurring", icon: "recurring" },
  { id: "funds", label: "Funds", icon: "funds" },
  { id: "notes", label: "Notes", icon: "notes" },
  { id: "operations", label: "Operations", icon: "operations" },
];

const MONEY: NavItem[] = [
  { id: "expenses", label: "Expenses", icon: "expenses" },
  { id: "settle", label: "Settle", icon: "settle" },
  { id: "recurring", label: "Recurring", icon: "recurring" },
  { id: "funds", label: "Funds", icon: "funds" },
  { id: "templates", label: "Templates", icon: "templates" },
  { id: "billing", label: "Billing", icon: "billing" },
];

const INSIGHTS: NavItem[] = [
  { id: "analytics", label: "Analytics", icon: "analytics" },
  { id: "activity", label: "Activity", icon: "activity" },
];

const PEOPLE: NavItem[] = [
  { id: "members", label: "Members", icon: "members" },
  { id: "operations", label: "Operations", icon: "operations" },
  { id: "notes", label: "Notes", icon: "notes" },
];

function CreateCommune({ onClick, menu }: { onClick: () => void; menu?: boolean }) {
  return (
    <button className="a-create-space" type="button" role={menu ? "menuitem" : undefined} onClick={onClick}>
      <span className="a-create-mark" aria-hidden="true">
        <Icon name="plus" size={14} />
      </span>
      Create a commune
    </button>
  );
}

function CommuneSwitch() {
  const { go, hub, places, session } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hasCommunes = Boolean(session?.hasHubs && places.length);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!hasCommunes) {
    return (
      <div className="a-switch-section">
        <CreateCommune onClick={() => go("commune-new")} />
      </div>
    );
  }

  return (
    <div className="a-switch-section" ref={ref}>
      <button
        className={cx("a-hub-switch", open && "is-active")}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Switch commune"
        onClick={() => setOpen((value) => !value)}
      >
        <div className="hub-ico" aria-hidden="true">
          <Icon name="hub" size={14} />
        </div>
        <div className="grow">
          <strong>{hub.name}</strong>
          <span>{hub.switchMeta}</span>
        </div>
        <span className={cx("a-hub-chev", open && "is-open")}>
          <Icon name="chevronDown" size={14} />
        </span>
      </button>
      {open ? (
        <div className="a-hub-menu" role="menu" aria-label="Communes">
          {places.map((place) => (
            <button
              key={place.id}
              className={cx("a-hub-option", place.id === hub.id && "is-current")}
              type="button"
              role="menuitem"
              aria-current={place.id === hub.id ? "true" : undefined}
              onClick={() => {
                setOpen(false);
                go("hub", { hub: place.id });
              }}
            >
              <span className="hub-ico" aria-hidden="true">
                <Icon name="hub" size={14} />
              </span>
              <span className="grow">
                <strong>{place.name}</strong>
                <span>{place.switchMeta}</span>
              </span>
            </button>
          ))}
          <CreateCommune
            menu
            onClick={() => {
              setOpen(false);
              go("commune-new");
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function NavButton({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button className={cx("a-link", active && "is-active")} type="button" onClick={onClick}>
      <Icon name={item.icon} />
      {item.label}
    </button>
  );
}

export function Sidebar({ screen }: { screen: ScreenId }) {
  const { go, hub, you } = useApp();
  const active = (id: ScreenId) =>
    screen === id ||
    (id === "settle" && screen === "settle-even") ||
    (id === "home" && (screen === "home-empty" || screen === "home-inbox")) ||
    (id === "hub" && screen === "hub-empty") ||
    (id === "expenses" && screen === "expenses-empty");

  return (
    <aside className="a-side">
      <button className="a-brand" type="button" onClick={() => go("home")}>
        <img className="a-logo" src="/logo.png" width={18} height={18} alt="" />
        <span className="a-wordmark">Commune</span>
      </button>

      <nav className="a-nav" aria-label="Primary">
        <NavButton item={{ id: "home", label: "Home", icon: "home" }} active={active("home")} onClick={() => go("home")} />
        <NavButton item={{ id: "hub", label: "This Hub", icon: "hub" }} active={active("hub")} onClick={() => go("hub")} />

        <div className="a-nav-basic">
          {BASIC.map((item) => (
            <NavButton key={item.id} item={item} active={active(item.id)} onClick={() => go(item.id)} />
          ))}
        </div>

        <div className="a-nav-advanced">
          <div className="a-group-label">Money</div>
          <div className="a-sub">
            {MONEY.map((item) => (
              <NavButton key={item.id} item={item} active={active(item.id)} onClick={() => go(item.id)} />
            ))}
          </div>
          <div className="a-group-label">Insights</div>
          <div className="a-sub">
            {INSIGHTS.map((item) => (
              <NavButton key={item.id} item={item} active={active(item.id)} onClick={() => go(item.id)} />
            ))}
          </div>
          <div className="a-group-label">People</div>
          <div className="a-sub">
            {PEOPLE.map((item) => (
              <NavButton key={item.id} item={item} active={active(item.id)} onClick={() => go(item.id)} />
            ))}
          </div>
        </div>
      </nav>

      <CommuneSwitch />

      <button className="a-side-foot" type="button" onClick={() => go("settings")}>
        <Avatar tone="maya" initials={you.initials} />
        <div className="meta">
          <strong>{you.name}</strong>
          <span>{hub.youMeta}</span>
        </div>
      </button>
    </aside>
  );
}

export function Header({ screen }: { screen: ScreenId }) {
  const { go, pageTitle, pageLede, setMoreOpen, native, you } = useApp();
  void screen;
  return (
    <header className="a-header">
      <button className="a-icon-btn a-more-btn" type="button" aria-label="More" onClick={() => setMoreOpen(true)}>
        <Icon name="menu" size={16} />
      </button>
      <img className="a-header-mark" src="/logo-mark.svg" width={18} height={18} alt="" />
      <div className="a-header-title">
        <h1>{pageTitle}</h1>
        {pageLede ? <p>{pageLede}</p> : null}
      </div>
      {native ? null : (
        <label className="a-search">
          <Icon name="search" size={16} />
          <input type="search" placeholder="Search expenses, people, bills" aria-label="Search expenses, people, bills" />
        </label>
      )}
      <div className="a-header-actions">
        <button className="a-icon-btn a-you-btn" type="button" aria-label="You" onClick={() => go("settings")}>
          <Avatar tone="maya" initials={you.initials} />
        </button>
        <button className="a-icon-btn has-unread" type="button" aria-label="Notifications" onClick={() => go("notices")}>
          <Icon name="bell" size={16} />
        </button>
      </div>
    </header>
  );
}

export function PhoneTabs({ screen }: { screen: ScreenId }) {
  const { go } = useApp();
  const tabs: Array<{ id: ScreenId; label: string; icon: IconName }> = [
    { id: "home", label: "Home", icon: "home" },
    { id: "hub", label: "Hub", icon: "hub" },
    { id: "expenses", label: "Expenses", icon: "expenses" },
    { id: "settle", label: "Settle", icon: "settle" },
  ];
  return (
    <nav className="a-bottom" aria-label="Phone">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={cx(
            (tab.id === "home" && (screen === "home" || screen === "home-empty" || screen === "home-inbox")) ||
              (tab.id === "hub" && (screen === "hub" || screen === "hub-empty")) ||
              (tab.id === "expenses" && (screen === "expenses" || screen === "expenses-empty")) ||
              (tab.id === "settle" && (screen === "settle" || screen === "settle-even"))
              ? "is-active"
              : undefined,
          )}
          onClick={() => go(tab.id)}
        >
          <Icon name={tab.icon} />
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

const MORE: Array<{ id: ScreenId | WindowId; title: string; hint: string; icon: IconName; dash?: boolean }> = [
  { id: "commune-new", title: "Create a commune", hint: "A home, a studio, or a trip", icon: "plus", dash: true },
  { id: "communes", title: "Places", hint: "Switch house, studio, or trip", icon: "hub" },
  { id: "notes", title: "Notes", hint: "Wi-Fi, bins, landlord", icon: "notes" },
  { id: "funds", title: "Funds", hint: "House pot · chase Alex", icon: "funds" },
  { id: "recurring", title: "Recurring", hint: "Open bills. Rent from the fund", icon: "refresh" },
  { id: "operations", title: "Operations", hint: "What’s late, what’s yours, then the week", icon: "operations" },
  { id: "members", title: "Members", hint: "Who’s here this cycle", icon: "members" },
  { id: "settings", title: "You & settings", hint: "Plan, pay-me, preferences", icon: "settings" },
];

export function MoreSheet() {
  const { setMoreOpen, go } = useApp();
  return (
    <>
      <div className="a-sheet-scrim" onClick={() => setMoreOpen(false)} />
      <div className="a-more" role="dialog" aria-label="More">
        <div className="a-more-head">
          <div>
            <p className="a-more-kicker">More</p>
            <p className="a-more-lede">Notes, funds, and the rest of the house. The four tabs stay the spine.</p>
          </div>
          <button className="a-more-x" type="button" aria-label="Close More" onClick={() => setMoreOpen(false)}>
            <Icon name="close" size={16} />
          </button>
        </div>
        {MORE.map((row) => (
          <button key={row.id} type="button" onClick={() => go(row.id)}>
            <span className={cx("a-more-ic", row.dash && "a-more-ic-dash")} aria-hidden="true">
              <Icon name={row.icon} />
            </span>
            <span className="a-more-copy">
              <strong>{row.title}</strong>
              <span>{row.hint}</span>
            </span>
            <Icon name="chevron" size={16} />
          </button>
        ))}
      </div>
    </>
  );
}
