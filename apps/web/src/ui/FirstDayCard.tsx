import { useEffect, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { useApp } from "../state";
import { forgetFirstDay, readFirstDay } from "../data/firstDay";
import { useEmailReminders } from "./useEmailReminders";
import "./first-day.css";

/*
 * Home's card for someone who has just joined a house (approved mock-up,
 * 8 November 2026): what is done, and the one or two things left. It goes
 * once hidden, or two weeks after joining.
 */
export function FirstDayCard() {
  const { session, places, myPayLinks, loadMyPayLinks, go } = useApp();
  const userId = session?.userId;
  const [record, setRecord] = useState(() => readFirstDay(userId));
  const reminders = useEmailReminders(record ? userId : undefined);
  useEffect(() => { setRecord(readFirstDay(userId)); }, [userId]);
  useEffect(() => { if (record && !myPayLinks) loadMyPayLinks().catch(() => {}); }, [loadMyPayLinks, myPayLinks, record]);

  if (!record || !userId || !places.some((place) => place.id === record.communeId)) return null;
  const paid = Boolean(myPayLinks?.length);
  const emailed = reminders.enabled === true;
  const done = 2 + (paid ? 1 : 0) + (emailed ? 1 : 0);
  function hide() {
    forgetFirstDay(userId!);
    setRecord(null);
  }

  return (
    <section className="c-first-day" aria-labelledby="first-day-title">
      <header>
        <h2 id="first-day-title">Your first day in {record.house}</h2>
        <span className="c-first-day-count">{done} of 4</span>
      </header>
      <ul>
        <Item done title={`Joined ${record.house}`} />
        <Item done={paid} title={paid ? "How to pay you is set" : "Say how people pay you"}
          note={paid ? undefined : "Monzo, PayPal, Revolut or bank details"}
          action={paid ? null : <button className="c-first-day-btn" type="button" onClick={() => go("pay-method")}>Add</button>} />
        <Item done title="Checked your part" />
        <Item done={emailed} title={emailed ? "Email reminders are on" : "Turn on email reminders"}
          note={emailed ? undefined : "An email when a bill or a chore is yours. Nothing else."}
          action={emailed || reminders.enabled === null ? null
            : <button className="c-first-day-btn" type="button" disabled={reminders.saving} onClick={() => void reminders.save(true)}>Turn on</button>} />
      </ul>
      {reminders.error ? <p className="c-first-day-error" role="alert">{reminders.error}</p> : null}
      <button className="c-first-day-hide" type="button" onClick={hide}>{done === 4 ? "All done. Hide this" : "Hide this"}</button>
    </section>
  );
}

function Item({ done, title, note, action }: { done: boolean; title: string; note?: string; action?: ReactNode }) {
  return (
    <li className={done ? "is-done" : undefined}>
      <span className="c-first-day-tick" aria-hidden="true">{done ? <Check size={14} strokeWidth={3} /> : null}</span>
      <span className="c-first-day-text"><strong>{title}</strong>{note ? <span>{note}</span> : null}</span>
      <span className="sr-only">{done ? "Done" : "Not done yet"}</span>
      {action}
    </li>
  );
}
