import { useEffect, useId, useRef, useState } from "react";
import { ArrowRightLeft, Clock3, FileText, Files, House, LayoutGrid, ReceiptText, Repeat2, ShoppingBag, SquareCheck, UsersRound, type LucideIcon } from "lucide-react";
import type { IconName } from "../ui/Icon";
import { Icon } from "../ui/Icon";
import { Avatar } from "../ui/widgets";
import { useApp } from "../state";
import type { ScreenId } from "../data/household";
import { QuickSearch } from "../ui/QuickSearch";
import { cx } from "../ui/cx";

type NavItem = { id: ScreenId; label: string; icon: IconName };

const NAV_ICONS: Partial<Record<IconName, LucideIcon>> = {
  home: LayoutGrid, hub: House, expenses: ReceiptText, settle: ArrowRightLeft,
  recurring: Repeat2, funds: ShoppingBag, notes: FileText, operations: SquareCheck,
  templates: Files,
  activity: Clock3, members: UsersRound,
};

const BASIC: NavItem[] = [
  { id: "expenses", label: "Expenses", icon: "expenses" },
  { id: "settle", label: "Settle", icon: "settle" },
  { id: "recurring", label: "Recurring", icon: "recurring" },
  { id: "funds", label: "Funds", icon: "funds" },
  { id: "notes", label: "Notes", icon: "notes" },
  { id: "operations", label: "Operations", icon: "operations" },
];

// The phone menu has no other route to these in basic mode.
const DRAWER_BASIC: NavItem[] = [
  { id: "members", label: "Members", icon: "members" },
  { id: "templates", label: "Templates", icon: "templates" },
];

const MONEY: NavItem[] = [
  { id: "expenses", label: "Expenses", icon: "expenses" },
  { id: "settle", label: "Settle", icon: "settle" },
  { id: "recurring", label: "Recurring", icon: "recurring" },
  { id: "funds", label: "Funds", icon: "funds" },
  { id: "templates", label: "Templates", icon: "templates" },
];

// Billing and Analytics stay out of the navigation until they do something.
const INSIGHTS: NavItem[] = [
  { id: "activity", label: "Activity", icon: "activity" },
];

const PEOPLE: NavItem[] = [
  { id: "members", label: "Members", icon: "members" },
  { id: "operations", label: "Operations", icon: "operations" },
  { id: "notes", label: "Notes", icon: "notes" },
];

function CreateCommune({ onClick }: { onClick: () => void }) {
  return (
    <button className="a-create-space" type="button" onClick={onClick}>
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const hasCommunes = Boolean(session?.hasHubs && places.length);

  // A plain show-and-hide list: a click or focus elsewhere closes it, and
  // Escape closes it and returns focus to the button.
  useEffect(() => {
    if (!open) return;
    const onOutside = (event: Event) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("focusin", onOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("focusin", onOutside);
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
        ref={buttonRef}
        className={cx("a-hub-switch", open && "is-active")}
        type="button"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <div className="hub-ico" aria-hidden="true">
          <Icon name="hub" size={14} />
        </div>
        <div className="grow">
          <strong>{hub.name}</strong>
          <span>{hub.switchMeta}</span>
        </div>
        {" "}<span className="c-visually-hidden">Switch commune</span>
        <span className={cx("a-hub-chev", open && "is-open")} aria-hidden="true">
          <Icon name="chevronDown" size={14} />
        </span>
      </button>
      {open ? (
        <div className="a-hub-menu" id={listId} role="group" aria-label="Communes">
          {places.map((place) => (
            <button
              key={place.id}
              className={cx("a-hub-option", place.id === hub.id && "is-current")}
              type="button"
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
  const NavIcon = NAV_ICONS[item.icon];
  return (
    <button className={cx("a-link", active && "is-active")} aria-current={active ? "page" : undefined} type="button" onClick={onClick}>
      {NavIcon ? <NavIcon size={19} strokeWidth={1.6} aria-hidden="true" /> : <Icon name={item.icon} />}
      {item.label}
    </button>
  );
}

export function Sidebar({ screen, drawer }: { screen: ScreenId; drawer?: boolean }) {
  const { go, hub, you, setMoreOpen } = useApp();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (drawer) closeRef.current?.focus();
  }, [drawer]);
  const accountRole = hub.youMeta?.split(" · ")[0];
  const active = (id: ScreenId) =>
    screen === id ||
    (id === "settle" && screen === "settle-even") ||
    (id === "home" && (screen === "home-empty" || screen === "home-inbox")) ||
    (id === "hub" && (screen === "hub-empty" || screen === "commune-settings")) ||
    (id === "expenses" && screen === "expenses-empty");

  return (
    <aside
      className={cx("a-side", drawer && "a-drawer")}
      role={drawer ? "dialog" : undefined}
      aria-modal={drawer ? true : undefined}
      aria-label={drawer ? "Menu" : undefined}
    >
      <div className="a-side-head">
        <button className="a-brand" type="button" onClick={() => go("home")}>
          <span className="a-wordmark">commune.</span>
        </button>
        {drawer ? (
          <button ref={closeRef} className="a-drawer-x" type="button" aria-label="Close menu" onClick={() => setMoreOpen(false)}>
            <Icon name="close" size={18} />
          </button>
        ) : null}
      </div>

      <nav className="a-nav" aria-label="Primary">
        <NavButton item={{ id: "home", label: "Home", icon: "home" }} active={active("home")} onClick={() => go("home")} />
        <NavButton item={{ id: "hub", label: "This Hub", icon: "hub" }} active={active("hub")} onClick={() => go("hub")} />

        <div className="a-nav-basic">
          {(drawer ? [...BASIC, ...DRAWER_BASIC] : BASIC).map((item) => (
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

      <div className="a-side-account">
        <Avatar tone="maya" initials={you.initials} />
        <div className="a-side-account-copy">
          <button className="a-side-foot" type="button" onClick={() => go("settings")}>
            <strong>{you.name}</strong>
          </button>
          <div className="a-side-account-meta">
            {accountRole && <span className="a-side-account-role">{accountRole}</span>}
          </div>
        </div>
      </div>
    </aside>
  );
}

export function Header({ screen }: { screen: ScreenId }) {
  const {
    go,
    pageTitle,
    pageLede,
    moreOpen,
    setMoreOpen,
    native,
    you,
    noticesOn,
    noticeCounts,
    hubId,
    session,
    places,
    window: currentWindow,
  } = useApp();
  const [searchOpen, setSearchOpen] = useState(false);
  // On a phone, Home's all-square photo shows through the bar until the page moves.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const searchingAll = ["home", "home-empty", "communes", "home-activity"].includes(screen);
  // Every commune's unread notices, wherever the reader is.
  const unread = noticesOn ? Object.values(noticeCounts).reduce((total, count) => total + count, 0) : 0;
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (event.isComposing || event.repeat) return;
      const target = event.target instanceof Element ? event.target : null;
      const typing = target?.closest("input, textarea, select, [contenteditable='true']");
      const toggle = (event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "k";
      const slash = event.key === "/" && !typing && !event.metaKey && !event.ctrlKey && !event.altKey;
      if (!toggle && !slash) return;
      // Never open a second modal over an expense, invite or editor.
      if (!searchOpen && (currentWindow || document.querySelector("dialog[open]"))) return;
      event.preventDefault(); setSearchOpen(open => toggle ? !open : true);
    }
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, [searchOpen, currentWindow]);
  return (
    <header className={cx("a-header", (screen === "home" || screen === "home-empty") && (places.length ? "is-home" : "a-header-home"), scrolled && "is-scrolled")}>
      <button className="a-icon-btn a-more-btn" type="button" aria-label="Menu" aria-haspopup="dialog" aria-expanded={moreOpen}
        onClick={() => setMoreOpen(true)}>
        <Icon name="menu" size={16} />
      </button>
      <div className="a-header-title">
        <h1>{pageTitle}</h1>
        {pageLede ? <p>{pageLede}</p> : null}
      </div>
      <button className="a-search c-search-trigger" type="button" aria-label="Search Commune"
        aria-haspopup="dialog" aria-keyshortcuts="Meta+K Control+K" onClick={() => setSearchOpen(true)}>
          <Icon name="search" size={16} />
          {!native && <><span>Search Commune</span><kbd aria-hidden="true">⌘ K</kbd></>}
      </button>
      <div className="a-header-actions">
        <button className={cx("a-icon-btn", unread > 0 && "has-unread")} type="button" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} onClick={() => go("notices")}>
          <Icon name="bell" size={16} />
        </button>
        {/* Home's everyday action, beside the bell as drawn; a phone has it on the Hub. */}
        {screen === "home" && places.length ? (
          <button className="a-btn ghost a-header-add" type="button" onClick={() => go("add-expense")}>
            <Icon name="plus" size={16} /><span className="a-header-add-label">Add expense</span>
          </button>
        ) : null}
        <button className="a-icon-btn a-you-btn" type="button" aria-label="You" onClick={() => go("settings")}>
          <Avatar tone="maya" initials={you.initials} decorative />
        </button>
      </div>
      {searchOpen && <QuickSearch onClose={() => setSearchOpen(false)}
        initialScope={!session?.hasHubs || searchingAll || screen === "search" ? null : hubId} />}
    </header>
  );
}

// The same drawings as the sidebar, in a pill that marks the current tab.
function TabIcon({ name }: { name: IconName }) {
  const TabGlyph = NAV_ICONS[name];
  return <span className="a-tab-pill" aria-hidden="true">{TabGlyph ? <TabGlyph size={20} strokeWidth={1.6} /> : <Icon name={name} />}</span>;
}

export function PhoneTabs({ screen }: { screen: ScreenId }) {
  const { go, moreOpen } = useApp();
  const tabs: Array<{ id: ScreenId; label: string; icon: IconName }> = [
    { id: "home", label: "Home", icon: "home" },
    { id: "hub", label: "Hub", icon: "hub" },
    { id: "expenses", label: "Expenses", icon: "expenses" },
    { id: "settle", label: "Settle", icon: "settle" },
  ];
  const current = (id: ScreenId) =>
    (id === "home" && (screen === "home" || screen === "home-empty" || screen === "home-inbox")) ||
    (id === "hub" && (screen === "hub" || screen === "hub-empty" || screen === "commune-settings")) ||
    (id === "expenses" && (screen === "expenses" || screen === "expenses-empty")) ||
    (id === "settle" && (screen === "settle" || screen === "settle-even"));
  return (
    <nav className="a-bottom" aria-label="Phone" inert={moreOpen}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={cx(current(tab.id) && "is-active")}
          aria-current={current(tab.id) ? "page" : undefined}
          onClick={() => go(tab.id)}
        >
          <TabIcon name={tab.icon} />
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

/** The phone menu: the desktop sidebar, opened as a drawer from the left. */
export function MoreSheet() {
  const { moreOpen, setMoreOpen, screen } = useApp();
  const wasOpen = useRef(false);
  useEffect(() => {
    if (!moreOpen) {
      if (!wasOpen.current) return;
      wasOpen.current = false;
      // Closing returns focus to the menu button, unless choosing a page
      // has already moved it there.
      const active = document.activeElement;
      if (!active || active === document.body) document.querySelector<HTMLElement>(".a-header .a-more-btn")?.focus();
      return;
    }
    wasOpen.current = true;
    const onKey = (event: KeyboardEvent) => {
      // An open commune list inside the drawer closes first.
      if (event.key === "Escape" && !document.querySelector(".a-drawer .a-hub-menu")) setMoreOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [moreOpen, setMoreOpen]);
  if (!moreOpen) return null;
  return (
    <>
      <div className="a-sheet-scrim" onClick={() => setMoreOpen(false)} />
      <Sidebar screen={screen} drawer />
    </>
  );
}
