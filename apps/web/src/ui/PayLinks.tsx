import { useEffect, useState, type FormEvent } from "react";
import { useApp } from "../state";
import { money, type CurrencyCode } from "../live/model";
import { commandFailure } from "../data/commands";
import {
  bankDetailsText, formatSortCode, payLinkHref, payLinkLabel, PAY_PROVIDER_NAME, PAY_PROVIDERS,
  type PayLink, type PayLinkInput, type PayProvider,
} from "../data/payLinks";
import { Button, Dialog, Feedback, Field } from "./components";
// Styles sit with the other money surfaces.
import "../screens/Money.css";

/**
 * How the bill payer likes to be paid, shown to the person who owes them.
 * Each link opens the payer's own app; Commune records nothing until the
 * person reports the payment.
 */
export function PayeeLinks({ userId, communeId, name, amountMinor, currency, note, onOpen }: {
  userId: string | null | undefined; communeId?: string; name: string; amountMinor: number; currency: CurrencyCode; note?: string;
  /** Runs when one of their apps is opened, so Commune can ask afterwards whether it went. */
  onOpen?: (link: PayLink) => void;
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
          ? <a className="a-btn ghost" href={target.href} target="_blank" rel="noopener noreferrer" onClick={() => onOpen?.(link)}>Open {PAY_PROVIDER_NAME[link.provider]}</a>
          : <button className="a-btn ghost" type="button" onClick={() => void copy(link)}>{copied ? "Copied" : "Copy details"}</button>}
      </div>;
    })}
  </div>;
}

/** Someone you owe, as the pay controls need them. */
export type PayeeTarget = {
  payerId?: string; payerName: string; communeId?: string;
  outstandingMinor: number; currency: CurrencyCode; expenseName: string;
};

/** Their pay links, reading the commune's full record when only a summary is held. */
export function usePayeeLinks(payerId: string | null | undefined, communeId?: string): PayLink[] | null {
  const { payLinksFor, loadPayLinksFor } = useApp();
  const links = payLinksFor(payerId, communeId);
  const unread = links === null && Boolean(payerId);
  useEffect(() => {
    if (unread) void loadPayLinksFor(communeId).catch(() => undefined);
  }, [unread, communeId, loadPayLinksFor]);
  return payerId ? links : [];
}

const firstOf = (name: string) => name.split(" ")[0] || name;

/**
 * The main payment action, by what the person you owe has saved:
 * - a favourite way: one button that opens it ("Pay £5.90 with Monzo"),
 *   with their other ways and "Already paid" beside it;
 * - ways but no favourite: "Pay Tom £5.90", which lists them;
 * - none: "I’ve paid Tom £5.90", which records a payment made however you
 *   usually pay them.
 * Commune moves no money: a link opens their own app, and coming back asks
 * whether it went.
 */
export function PayPrimary({ target, onPay, onTell, onOpened, busy = false, size = "large" }: {
  target: PayeeTarget; onPay: () => void; onTell: () => void; onOpened: (link: PayLink) => void;
  busy?: boolean; size?: "large" | "normal";
}) {
  const links = usePayeeLinks(target.payerId, target.communeId);
  const amount = money(target.outstandingMinor, target.currency);
  const first = firstOf(target.payerName);
  const big = size === "large" ? " is-large" : "";
  if (!links?.length) {
    return <>
      <button className={`c-pay-primary${big}`} type="button" disabled={busy} onClick={onTell}>I’ve paid {first} {amount}</button>
      <p className="c-pay-hint">{links ? `${first} hasn’t said how they like to be paid. Pay them however you usually do, then record it here.` : `Pay ${first} however you usually do, then record it here.`}</p>
    </>;
  }
  const favourite = links.find((link) => link.preferred);
  if (favourite) {
    const provider = PAY_PROVIDER_NAME[favourite.provider];
    const href = payLinkHref(favourite, target.outstandingMinor, target.currency, target.expenseName);
    const others = links.length - 1;
    return <>
      {href
        ? <a className={`c-pay-primary${big}`} href={href.href} target="_blank" rel="noopener noreferrer" aria-disabled={busy || undefined}
          onClick={(event) => { if (busy) { event.preventDefault(); return; } onOpened(favourite); }}>
          Pay {amount} with {provider}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" /></svg>
          <span className="c-visually-hidden">, opens {provider}</span>
        </a>
        : <button className={`c-pay-primary${big}`} type="button" disabled={busy} onClick={onPay}>Pay {amount} by bank transfer</button>}
      <span className="c-pay-more">
        {others > 0 ? <button className="c-pay-secondary" type="button" disabled={busy} onClick={onPay}>Other ways ({others})</button> : null}
        <button className="c-pay-secondary" type="button" disabled={busy} onClick={onTell}>Already paid</button>
      </span>
      <p className="c-pay-hint">{href?.amountFilled ? `${first}’s favourite. It opens with ${amount} filled in.` : href ? `${first}’s favourite. Enter ${amount} when it opens.` : `${first}’s favourite. Their details are a tap away.`}</p>
    </>;
  }
  return <>
    <button className={`c-pay-primary${big}`} type="button" disabled={busy} onClick={onPay}>
      Pay {first} {amount}
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
    </button>
    <p className="c-pay-hint">{links.map((link) => PAY_PROVIDER_NAME[link.provider]).join(" · ")}</p>
    <button className="c-pay-tell" type="button" disabled={busy} onClick={onTell}>Already paid? Tell {first}</button>
  </>;
}

/**
 * "Pay Tom £5.90": every way they take money, each opening their own app
 * with the amount filled in where it can, and a way to say you already paid.
 */
export function PaySheet({ target, onClose, onTell, onOpened }: {
  target: PayeeTarget; onClose: () => void; onTell: () => void; onOpened: (link: PayLink) => void;
}) {
  const links = usePayeeLinks(target.payerId, target.communeId);
  const amount = money(target.outstandingMinor, target.currency);
  const first = firstOf(target.payerName);
  return <Dialog title={`Pay ${first} ${amount}`} onClose={onClose} className="c-receipt-dialog c-pay-sheet">
    <p className="c-receipt-context">{target.expenseName}</p>
    {links?.length ? <p className="c-pay-intro">{first} takes these. Pick one and it opens in your own app.</p> : null}
    <PayeeLinks userId={target.payerId} communeId={target.communeId} name={target.payerName}
      amountMinor={target.outstandingMinor} currency={target.currency} note={target.expenseName} onOpen={onOpened} />
    <p className="c-receipt-note">The money moves in your own app. Commune never sees it.</p>
    <div className="a-field-row">
      <Button variant="secondary" onClick={onTell}>I’ve already paid, tell {first}</Button>
    </div>
  </Dialog>;
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
  const { myPayLinks, loadMyPayLinks, savePayLink, removePayLink, setPreferredPayLink } = useApp();
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

  // One favourite: people who owe you get a single button that opens it.
  async function favourite(provider: PayProvider, on: boolean) {
    if (pending) return;
    setPending(true); setError(""); setMessage("");
    try {
      await setPreferredPayLink(on ? provider : null);
      setMessage(on
        ? `${PAY_PROVIDER_NAME[provider]} is your favourite. People who owe you see it first.`
        : "No favourite. People who owe you see every way you take money.");
    } catch (cause) {
      setError(commandFailure(cause, "Could not change your favourite.").message);
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
          {link?.preferred ? <small className="c-pay-favourite">Your favourite</small> : null}
        </span>
        {link ? <button className="a-btn ghost" type="button" aria-pressed={link.preferred} disabled={pending || editing !== null}
          onClick={() => void favourite(provider, !link.preferred)}>
          {link.preferred ? "Unfavourite" : "Make favourite"}{" "}<span className="c-visually-hidden">{PAY_PROVIDER_NAME[provider]}</span>
        </button> : null}
        <button className="a-btn ghost" type="button" disabled={pending || editing !== null} onClick={() => start(provider)}>{link ? "Change" : "Add"}</button>
        {link ? <button className="a-btn ghost" type="button" disabled={pending || editing !== null} onClick={() => void remove(provider)}>Remove</button> : null}
      </div>;
    })}
    {message ? <p className="a-window-note" role="status">{message}</p> : null}
  </div>;
}
