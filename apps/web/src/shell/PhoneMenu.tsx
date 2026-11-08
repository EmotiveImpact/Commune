import { useEffect, useRef, type ReactNode } from "react";
import { Check, Clock3, FileText, Files, Plus, Repeat2, Settings, ShoppingBag, SquareCheck, UsersRound, X, type LucideIcon } from "lucide-react";
import { useApp } from "../state";
import type { GoTarget } from "../state";
import { CoverImage, coverToneClass } from "../ui/CoverImage";
import { crossFadeContent } from "../ui/motion";
import { showToast } from "../ui/Toast";
import { cx } from "../ui/cx";

const count = (n: number, one: string, many: string, none: string) => (n ? `${n} ${n === 1 ? one : many}` : none);

/**
 * The phone menu, as the phone app has it: the burger at the top right pushes
 * the page left and this dark panel comes in from the right. Your communes
 * with their photos first, then this commune's own pages, then you.
 */
export function PhoneMenu() {
  const { go, places, hub, session, setMoreOpen, operations, notes, recurringBills, funds, splitTemplates } = useApp();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); }, []);
  const hasCommunes = Boolean(session?.hasHubs && places.length);
  const open = (target: GoTarget) => { setMoreOpen(false); go(target); };
  const openTasks = operations.filter((item) => item.status === "open").length;
  const noteCount = Object.keys(notes).length;
  const liveFunds = funds.filter((fund) => !fund.archivedAt).length;
  const templates = splitTemplates.filter((item) => !item.archivedAt).length;

  const row = (key: GoTarget, Icon: LucideIcon, label: string, sub?: string): ReactNode => (
    <button key={key} className="c-pmenu-row" type="button" onClick={() => open(key)}>
      <span className="c-pmenu-icon" aria-hidden="true"><Icon size={19} strokeWidth={1.7} /></span>
      <span className="c-pmenu-copy"><strong>{label}</strong>{sub ? <small>{sub}</small> : null}</span>
    </button>
  );

  return (
    <aside className="c-pmenu a-drawer" data-leave="drawer-end" role="dialog" aria-modal="true" aria-label="Menu">
      <div className="c-pmenu-head">
        <h2>Your communes</h2>
        <button ref={closeRef} className="c-pmenu-x" type="button" aria-label="Close menu" onClick={() => setMoreOpen(false)}>
          <X size={22} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>
      <div className="c-pmenu-scroll">
        {hasCommunes ? places.map((place) => {
          const on = place.id === hub.id;
          return (
            <button key={place.id} className={cx("c-pmenu-commune", on && "is-current")} type="button" aria-current={on ? "true" : undefined}
              onClick={() => {
                setMoreOpen(false);
                if (!on) { crossFadeContent(); showToast({ text: `Showing ${place.name}.` }); }
                go("hub", { hub: place.id });
              }}>
              <span className={cx("c-pmenu-photo", coverToneClass(place))} aria-hidden="true"><CoverImage hub={place} placement="thumb" /></span>
              <span className="c-pmenu-copy"><strong>{place.name}</strong><small>{place.switchMeta}</small></span>
              {on ? <Check size={18} aria-hidden="true" /> : null}
            </button>
          );
        }) : null}
        <button className="c-pmenu-commune" type="button" onClick={() => open("commune-new")}>
          <span className="c-pmenu-photo is-new" aria-hidden="true"><Plus size={18} /></span>
          <span className="c-pmenu-copy"><strong>New commune</strong></span>
        </button>

        {hasCommunes ? <>
          <hr className="c-pmenu-rule" />
          <p className="c-pmenu-label">In {hub.name}</p>
          {row("operations", SquareCheck, "Chores and tasks", count(openTasks, "on the list", "on the list", "Nothing on the list"))}
          {row("notes", FileText, "Notes", count(noteCount, "written down", "written down", "Nothing written down yet"))}
          {row("members", UsersRound, "Members", count(hub.members.length, "person", "people", "Just you"))}
          {row("recurring", Repeat2, "Recurring", count(recurringBills.length, "repeating bill", "repeating bills", "Nothing repeats here"))}
          {row("funds", ShoppingBag, "Funds", count(liveFunds, "shared pot", "shared pots", "No shared pots yet"))}
          {row("templates", Files, "Templates", count(templates, "saved split", "saved splits", "None saved yet"))}
          {row("activity", Clock3, "Activity", "Everything that changed")}
          {row("commune-settings", Settings, "Commune settings", hub.role === "admin" ? "Name, kind, place and currency" : "Details, and leaving")}
        </> : null}

        <hr className="c-pmenu-rule" />
        {hasCommunes && hub.role === "admin" ? row("member-invite", UsersRound, "Invite people", `To ${hub.name}`) : null}
        {row("settings", Settings, "Settings", "Layout, pay links and sign out")}
      </div>
    </aside>
  );
}
