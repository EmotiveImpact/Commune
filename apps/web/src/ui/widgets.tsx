import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "./cx";
import type { AvatarTone } from "../data/household";
import { useApp } from "../state";
import { Icon } from "./Icon";

export function Avatar({
  tone,
  initials,
  className,
  src,
}: {
  tone: AvatarTone | string;
  initials: string;
  className?: string;
  src?: string;
}) {
  const { you } = useApp();
  const photo = src ?? (tone === "maya" ? you.photo : undefined);
  if (photo) {
    return (
      <span className={cx("avatar", "has-photo", tone, className)}>
        <img src={photo} alt="" />
      </span>
    );
  }
  return <span className={cx("avatar", tone, className)}>{initials}</span>;
}

export function Pill({
  tone,
  children,
}: {
  tone?: string;
  children: ReactNode;
}) {
  return <span className={cx("pill", tone)}>{children}</span>;
}

export function Choose({
  label = "Choose",
  items,
}: {
  label?: string;
  items: Array<{ label: string; onSelect: () => void }>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="a-choose" ref={ref}>
      <button
        className="a-btn"
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <Icon name="chevronDown" size={14} />
      </button>
      <div className="a-choose-menu" role="menu" hidden={!open}>
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              item.onSelect();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      className={cx("a-switch", checked && "is-on")}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    />
  );
}
