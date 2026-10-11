import { memberName } from "../src/lib/derive";
import { firstName, money } from "../src/lib/format";
import { useApp } from "../src/state";
import { Body, Pad } from "../src/ui/chrome";
import { Cal, Panel, Row, T } from "../src/ui/kit";

export default function Recurring() {
  const { current, user, today } = useApp();
  const bills = current?.recurringBills ?? [];
  return <Body>
    <Pad>
      {bills.length ? <Panel>{bills.map((bill, index) => <Row key={bill.id} first={index === 0} left={<Cal iso={bill.nextDueOn} today={today} small />}
        title={bill.title}
        meta={<T kind="label" muted>{money(bill.amountMinor, current!.commune.currency)} {bill.frequency} · {bill.paidByUserId === user?.id ? "you pay" : `${firstName(memberName(current!, bill.paidByUserId))} pays`}{bill.paused ? " · paused" : ""}</T>} />)}</Panel>
        : <Panel pad><T kind="body" muted>Nothing repeats in {current?.commune.name}.</T></Panel>}
    </Pad>
  </Body>;
}
