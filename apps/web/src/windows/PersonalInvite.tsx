import { useRef, useState } from "react";
import {
  defaultCallingCode, inviteFirstName, inviteMessage, textLink, whatsAppLink, whatsAppNumber, withInviteLink,
  type InviteChannel,
} from "@commune/core";
import { useApp } from "../state";
import { showToast } from "../ui/Toast";
import { WhatsAppMark } from "../ui/WhatsAppMark";
import "./PersonalInvite.css";

type PickedContact = { name?: string[]; tel?: string[] };
type ContactPicker = { select: (properties: string[], options: { multiple: boolean }) => Promise<PickedContact[]> };

/** The browser's own contact picker, where there is one (Chrome on Android). */
function contactPicker(): ContactPicker | null {
  const picker = (navigator as Navigator & { contacts?: ContactPicker }).contacts;
  return picker && typeof picker.select === "function" ? picker : null;
}
/** A phone, where Text can open Messages. Computers and most tablets can't send a text. */
function canText(): boolean {
  return /Android|iPhone|iPod/i.test(navigator.userAgent);
}
function isApple(): boolean {
  return /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent);
}

/**
 * Inviting one person by name, as on the phone app: their name (from the
 * contact picker where the browser has one), the message in a bubble they can
 * change, and two small buttons. The link is made on the first send and kept
 * for the other buttons, so one person gets one link. A number picked from
 * contacts is used only to open the right chat; Commune never receives it.
 */
export function PersonalInvite() {
  const { hub, createPersonalInvite } = useApp();
  const kind = hub.type === "Trip" ? "trip" : hub.type === "Workspace" ? "workspace" : "household";
  const [name, setName] = useState("");
  const [phones, setPhones] = useState<string[]>([]);
  const [phoneAt, setPhoneAt] = useState(0);
  const [message, setMessage] = useState(() => inviteMessage({ name: "", communeName: hub.name, kind }));
  const [edited, setEdited] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<InviteChannel | null>(null);
  const [error, setError] = useState("");
  const nameInput = useRef<HTMLInputElement>(null);
  const picker = contactPicker();
  const phone = phones[phoneAt] ?? null;
  const first = inviteFirstName(name);

  function rename(next: string, numbers: string[] = phones) {
    setName(next); setError("");
    setPhones(numbers); setPhoneAt(0);
    // A new person needs a new link.
    if (next.trim() !== name.trim()) setUrl("");
    if (!edited) setMessage(inviteMessage({ name: next, communeName: hub.name, kind }));
  }
  async function pick() {
    if (!picker) return;
    try {
      const [chosen] = await picker.select(["name", "tel"], { multiple: false });
      if (!chosen) return;
      rename((chosen.name?.[0] ?? "").trim(), chosen.tel ?? []);
      if (!chosen.name?.[0]) nameInput.current?.focus();
    } catch {
      setError("Couldn’t open your contacts. Type their name instead.");
    }
  }
  async function send(channel: InviteChannel) {
    if (busy) return;
    if (!name.trim()) { setError("Type their name first."); nameInput.current?.focus(); return; }
    // On a computer WhatsApp opens in a new tab; open it now, while the click
    // still counts, and point it at the chat once the link is made.
    const tab = channel === "whatsapp" && !canText() ? window.open("", "_blank") : null;
    setBusy(channel); setError("");
    try {
      const link = url || (await createPersonalInvite(name.trim(), channel)).url;
      setUrl(link);
      const text = withInviteLink(message, link);
      if (channel === "link") {
        await navigator.clipboard.writeText(link);
        showToast({ text: `Link for ${first} copied. It works once, for 7 days.` });
      } else if (channel === "whatsapp") {
        const target = whatsAppLink(whatsAppNumber(phone, defaultCallingCode(hub.currency)), text);
        if (tab) tab.location.href = target; else window.location.href = target;
        showToast({ text: `${first}’s invite is ready in WhatsApp.` });
      } else {
        window.location.href = textLink(phone, text, isApple());
        showToast({ text: `${first}’s invite is ready in Messages.` });
      }
    } catch (cause) {
      tab?.close();
      setError(channel === "link" && url
        ? "Copy failed. Select the link in the message and copy it."
        : cause instanceof Error ? cause.message : "Couldn’t make the invite. Try again.");
    } finally { setBusy(null); }
  }

  return (
    <section className="c-pinvite" aria-labelledby="pinvite-title">
      <h3 id="pinvite-title" className="c-pinvite-title">Send them a link</h3>
      <div className="a-field">
        <label htmlFor="pinvite-name">Their name</label>
        <div className="c-pinvite-name">
          <input
            id="pinvite-name" ref={nameInput} value={name} maxLength={80} autoComplete="off" placeholder="Maya Okafor"
            onChange={(event) => rename(event.target.value, [])}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void send("whatsapp"); } }}
            aria-invalid={error && !name.trim() ? true : undefined}
          />
          {picker ? <button type="button" className="c-pinvite-pick" onClick={() => void pick()}>Choose from contacts</button> : null}
        </div>
        {phone ? (
          <p className="a-window-note c-pinvite-phone">
            {phone}
            {phones.length > 1 ? <button type="button" className="c-pinvite-link" onClick={() => setPhoneAt((at) => (at + 1) % phones.length)}>Other number</button> : null}
          </p>
        ) : null}
      </div>
      <div className="c-pinvite-bubble">
        <label htmlFor="pinvite-message" className="c-visually-hidden">Message</label>
        <textarea
          id="pinvite-message" rows={2} maxLength={400} value={message}
          onChange={(event) => { setMessage(event.target.value); setEdited(true); }}
        />
        <span className="c-pinvite-url" aria-live="polite">{url ? url.replace(/^https?:\/\//, "") : `${first ? `${first}’s` : "Their"} invite link goes here`}</span>
      </div>
      <div className="c-pinvite-send">
        <button type="button" className="a-btn c-pinvite-btn" disabled={busy !== null} onClick={() => void send("whatsapp")}
          aria-label={`Send ${first ? `${first}’s` : "the"} invite on WhatsApp`}>
          <WhatsAppMark /> {busy === "whatsapp" ? "Opening…" : "WhatsApp"}
        </button>
        {canText() ? (
          <button type="button" className="a-btn ghost c-pinvite-btn" disabled={busy !== null} onClick={() => void send("text")}
            aria-label={`Send ${first ? `${first}’s` : "the"} invite by text`}>
            {busy === "text" ? "Opening…" : "Text"}
          </button>
        ) : null}
        <button type="button" className="c-pinvite-link c-pinvite-copy" disabled={busy !== null} onClick={() => void send("link")}
          aria-label={`Copy link for ${first || "them"}`}>
          {busy === "link" ? "Copying…" : "Copy link"}
        </button>
      </div>
      {error ? <p className="a-form-error" role="alert">{error}</p> : null}
      <p className="a-window-note">The link works once, for {first || "them"} only, for 7 days. Commune doesn’t keep their number.</p>
    </section>
  );
}
