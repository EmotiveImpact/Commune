import { useEffect, useState, type FormEvent } from "react";
import { useApp } from "../state";
import { money, type CurrencyCode } from "../live/model";
import { commandFailure } from "../data/commands";
import {
  bankDetailsText, formatSortCode, payLinkHref, payLinkLabel, PAY_PROVIDER_NAME, PAY_PROVIDERS,
  type PayLink, type PayLinkInput, type PayProvider,
} from "../data/payLinks";
import { Button, Feedback, Field } from "./components";
// Styles sit with the other money surfaces.
import "../screens/Money.css";

/**
 * How the bill payer likes to be paid, shown to the person who owes them.
 * Each link opens the payer's own app; Commune records nothing until the
 * person reports the payment.
 */
export function PayeeLinks({ userId, communeId, name, amountMinor, currency, note }: {
  userId: string | null | undefined; communeId?: string; name: string; amountMinor: number; currency: CurrencyCode; note?: string;
}) {
  const { payLinksFor, loadPayLinksFor } = useApp();
  const links = payLinksFor(userId, communeId);
  const [copied, setCopied] = useState(false);
  const amount = money(amountMinor, currency);
  const unread = links === null;
  useEffect(() => {
    if (unread) void loadPayLinksFor(communeId).catch(() => undefined);
  }, [unread, communeId, loadPayLinksFor]);
  // Only a summary of this commune is held: say nothing rather than "none" until its record arrives.
  if (links === null) return null;
  if (!links.length) {
    return <p className="c-pay-none">{name} hasn’t added how they like to be paid. Pay them however you usually do.</p>;
  }
  async function copy(link: PayLink) {
    try {
      await navigator.clipboard.writeText(bankDetailsText(link));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return <div className="c-pay-links" aria-label={`How ${name} likes to be paid`}>
    {links.map((link) => {
      const target = payLinkHref(link, amountMinor, currency, note);
      return <div className="c-pay-link" key={link.provider}>
        <span className={`c-pay-mark is-${link.provider}`} aria-hidden="true">{PAY_PROVIDER_NAME[link.provider][0]}</span>
        <span className="c-pay-copy">
          <strong>{PAY_PROVIDER_NAME[link.provider]}</strong>
          <span>{payLinkLabel(link)}</span>
          {target ? <small>{target.amountFilled ? `${amount} filled in` : `Enter ${amount} when it opens`}</small> : null}
        </span>
        {target
          ? <a className="a-btn ghost" href={target.href} target="_blank" rel="noopener noreferrer">Open {PAY_PROVIDER_NAME[link.provider]}</a>
          : <button className="a-btn ghost" type="button" onClick={() => void copy(link)}>{copied ? "Copied" : "Copy details"}</button>}
      </div>;
    })}
  </div>;
}

/**
 * The ways someone takes payment, as buttons beside a payment you owe them:
 * "Tom takes [Monzo £5.90] [Bank transfer]". A link opens their own app with
 * the amount filled in where it can. Either button also runs onOpen, which
 * opens "I’ve paid" (with the bank details to copy), so the payment is
 * recorded when the person comes back. Commune moves no money.
 */
export function PayButtons({ userId, communeId, name, amountMinor, currency, note, onOpen, load = false, short = false, disabled = false }: {
  userId: string | null | undefined; communeId?: string; name: string; amountMinor: number; currency: CurrencyCode; note?: string;
  onOpen?: () => void; load?: boolean; short?: boolean; disabled?: boolean;
}) {
  const { payLinksFor, loadPayLinksFor } = useApp();
  const links = payLinksFor(userId, communeId);
  const unread = links === null;
  // A commune held only as a summary has no pay links; reading its record is
  // worth it for one next step, not for every row of a list.
  useEffect(() => {
    if (load && unread) void loadPayLinksFor(communeId).catch(() => undefined);
  }, [load, unread, communeId, loadPayLinksFor]);
  if (!links?.length) return null;
  const amount = money(amountMinor, currency);
  const first = name.split(" ")[0] || name;
  return <span className={`c-pay-buttons${short ? " is-short" : ""}`} role="group" aria-label={`Ways to pay ${name}`}>
    {short ? null : <span className="c-pay-buttons-lead">{first} takes</span>}
    {links.map((link) => {
      const provider = PAY_PROVIDER_NAME[link.provider];
      const target = payLinkHref(link, amountMinor, currency, note);
      const label = target?.amountFilled && !short ? `${provider} ${amount}` : provider;
      return target
        ? <a key={link.provider} className="c-pay-button" href={target.href} target="_blank" rel="noopener noreferrer"
          aria-disabled={disabled || undefined} onClick={(event) => { if (disabled) { event.preventDefault(); return; } onOpen?.(); }}>
          {label}<span className="c-visually-hidden">, opens {provider} to pay {first} {amount}</span>
        </a>
        : <button key={link.provider} className="c-pay-button" type="button" disabled={disabled} onClick={() => onOpen?.()}>
          {label}<span className="c-visually-hidden">: see {first}’s details</span>
        </button>;
    })}
  </span>;
}

const EMPTY: Record<PayProvider, PayLinkInput> = {
  monzo: { handle: "" }, paypal: { handle: "" }, revolut: { handle: "" },
  bank: { accountName: "", sortCode: "", accountNumber: "" },
};

function inputFrom(link: PayLink | undefined, provider: PayProvider): PayLinkInput {
  if (!link) return { ...EMPTY[provider] };
  return provider === "bank"
    ? { accountName: link.accountName ?? "", sortCode: formatSortCode(link.sortCode), accountNumber: link.accountNumber ?? "" }
    : { handle: link.handle ?? "" };
}

/** Your own pay links: saved in Commune and shown to people in your communes. */
export function PayLinksEditor() {
  const { myPayLinks, loadMyPayLinks, savePayLink, removePayLink } = useApp();
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState<PayProvider | null>(null);
  const [draft, setDraft] = useState<PayLinkInput>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let live = true;
    loadMyPayLinks().catch((cause) => { if (live) setLoadError(commandFailure(cause, "Could not load your pay links.").message); });
    return () => { live = false; };
  }, [loadMyPayLinks]);

  function start(provider: PayProvider) {
    setEditing(provider);
    setDraft(inputFrom(myPayLinks?.find((link) => link.provider === provider), provider));
    setError(""); setMessage("");
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing || pending) return;
    setPending(true); setError("");
    try {
      await savePayLink(editing, draft);
      setMessage(`${PAY_PROVIDER_NAME[editing]} saved. People in your communes see it when they owe you.`);
      setEditing(null);
    } catch (cause) {
      setError(commandFailure(cause, "Could not save it.").message);
    } finally {
      setPending(false);
    }
  }
  async function remove(provider: PayProvider) {
    if (pending) return;
    setPending(true); setError(""); setMessage("");
    try {
      await removePayLink(provider);
      setMessage(`${PAY_PROVIDER_NAME[provider]} removed.`);
      if (editing === provider) setEditing(null);
    } catch (cause) {
      setError(commandFailure(cause, "Could not remove it.").message);
    } finally {
      setPending(false);
    }
  }

  if (loadError) return <Feedback error={loadError} />;
  if (!myPayLinks) return <p className="a-window-note" role="status">Loading your pay links…</p>;
  return <div className="c-pay-editor">
    {PAY_PROVIDERS.map((provider) => {
      const link = myPayLinks.find((item) => item.provider === provider);
      if (editing === provider) {
        return <form className="c-pay-form" key={provider} onSubmit={(event) => void save(event)}>
          <strong>{PAY_PROVIDER_NAME[provider]}</strong>
          {provider === "bank" ? <>
            <Field label="Name on the account">
              <input type="text" maxLength={60} autoComplete="name" value={draft.accountName ?? ""} disabled={pending} required
                onChange={(event) => setDraft({ ...draft, accountName: event.target.value })} />
            </Field>
            <Field label="Sort code">
              <input type="text" inputMode="numeric" maxLength={8} placeholder="20-45-77" value={draft.sortCode ?? ""} disabled={pending} required
                onChange={(event) => setDraft({ ...draft, sortCode: event.target.value })} />
            </Field>
            <Field label="Account number">
              <input type="text" inputMode="numeric" maxLength={8} value={draft.accountNumber ?? ""} disabled={pending} required
                onChange={(event) => setDraft({ ...draft, accountNumber: event.target.value })} />
            </Field>
          </> : <Field label={`${PAY_PROVIDER_NAME[provider]} username`} hint={`Your ${provider === "paypal" ? "PayPal.me" : provider === "monzo" ? "Monzo.me" : "Revolut.me"} name. A pasted link works too.`}>
            <input type="text" maxLength={120} autoCapitalize="none" spellCheck={false} value={draft.handle ?? ""} disabled={pending} required
              onChange={(event) => setDraft({ handle: event.target.value })} />
          </Field>}
          <Feedback error={error} />
          <div className="a-field-row">
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
            <Button variant="secondary" disabled={pending} onClick={() => { setEditing(null); setError(""); }}>Cancel</Button>
          </div>
        </form>;
      }
      return <div className="c-pay-link" key={provider}>
        <span className={`c-pay-mark is-${provider}`} aria-hidden="true">{PAY_PROVIDER_NAME[provider][0]}</span>
        <span className="c-pay-copy">
          <strong>{PAY_PROVIDER_NAME[provider]}</strong>
          <span>{link ? payLinkLabel(link) : "Not added"}</span>
        </span>
        <button className="a-btn ghost" type="button" disabled={pending || editing !== null} onClick={() => start(provider)}>{link ? "Change" : "Add"}</button>
        {link ? <button className="a-btn ghost" type="button" disabled={pending || editing !== null} onClick={() => void remove(provider)}>Remove</button> : null}
      </div>;
    })}
    {message ? <p className="a-window-note" role="status">{message}</p> : null}
  </div>;
}
