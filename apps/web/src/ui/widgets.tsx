import { useState, type ReactNode } from "react";
import { cx } from "./cx";
import type { AvatarTone } from "../data/household";
import { useApp } from "../state";

export function Avatar({
  tone,
  initials,
  className,
  src,
  decorative = false,
}: {
  tone: AvatarTone | string;
  initials: string;
  className?: string;
  src?: string;
  /** Hidden from assistive technology when the name is already given nearby. */
  decorative?: boolean;
}) {
  const { you } = useApp();
  const photo = src ?? (tone === "maya" ? you.photo : undefined);
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  if (photo && photo !== failedPhoto) {
    return (
      <span className={cx("avatar", "has-photo", tone, className)} aria-hidden={decorative || undefined}>
        <img src={photo} alt="" onError={() => setFailedPhoto(photo)} />
      </span>
    );
  }
  return <span className={cx("avatar", tone, className)} aria-hidden={decorative || undefined}>{initials}</span>;
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

export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      className={cx("a-switch", checked && "is-on")}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  );
}
