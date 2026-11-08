import { MessageCircle } from "lucide-react";
import { shareUrl } from "../data/whatsapp";
import { cx } from "./cx";

/**
 * Opens WhatsApp with a message ready for the person to send to whichever
 * chat they choose, usually the house group. Commune sends nothing itself.
 */
export function WhatsAppShare({ text, label = "Share to WhatsApp", hidden, className }: {
  text: string; label?: string; hidden?: string; className?: string;
}) {
  return <a className={cx("a-btn ghost c-whatsapp-share", className)} href={shareUrl(text)} target="_blank" rel="noopener noreferrer">
    <MessageCircle size={15} strokeWidth={1.75} aria-hidden="true" />{label}
    <span className="c-visually-hidden">{hidden ? ` ${hidden}` : ""} (opens WhatsApp)</span>
  </a>;
}
