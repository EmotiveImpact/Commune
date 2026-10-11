import { useApp } from "../src/state";
import { Body, Pad } from "../src/ui/chrome";
import { Panel, T } from "../src/ui/kit";

export default function Notes() {
  const { current } = useApp();
  const notes = current?.notes ?? [];
  return <Body>
    <Pad gap={12}>
      {notes.length ? notes.map((note) => <Panel key={note.id} pad>
        <T kind="strong">{note.title}</T>
        {note.lede ? <T kind="body" muted>{note.lede}</T> : null}
        {note.body ? <T kind="body">{note.body}</T> : null}
      </Panel>) : <Panel pad><T kind="body" muted>Nothing written down in {current?.commune.name} yet.</T></Panel>}
    </Pad>
  </Body>;
}
