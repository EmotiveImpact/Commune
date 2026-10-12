import { useApp } from "../src/state";
import { Body, Pad } from "../src/ui/chrome";
import { Panel, Row, T } from "../src/ui/kit";

export default function Templates() {
  const { current } = useApp();
  const items = (current?.splitTemplates ?? []).filter((item) => !item.archivedAt);
  return <Body>
    <Pad>
      {items.length ? <Panel>{items.map((item, index) => <Row key={item.id} first={index === 0} title={item.name}
        meta={<T kind="label" muted>{item.method} · {item.participants.length} people</T>} />)}</Panel>
        : <Panel pad><T kind="body" muted>No saved splits in {current?.commune.name} yet.</T></Panel>}
    </Pad>
  </Body>;
}
