import { money } from "../src/lib/format";
import { useApp } from "../src/state";
import { Body, Pad } from "../src/ui/chrome";
import { Panel, Row, T } from "../src/ui/kit";

export default function Funds() {
  const { current } = useApp();
  const funds = (current?.funds ?? []).filter((fund) => !fund.archivedAt);
  const currency = current?.commune.currency ?? "GBP";
  return <Body>
    <Pad>
      {funds.length ? <Panel>{funds.map((fund, index) => {
        const inMinor = fund.commitments.reduce((sum, item) => sum + item.contributedMinor, 0);
        return <Row key={fund.id} first={index === 0} title={fund.name}
          meta={<T kind="label" muted>{money(inMinor, currency)} recorded in{fund.targetMinor ? ` of ${money(fund.targetMinor, currency)}` : ""}</T>} />;
      })}</Panel> : <Panel pad><T kind="body" muted>No shared pots in {current?.commune.name} yet.</T></Panel>}
    </Pad>
  </Body>;
}
