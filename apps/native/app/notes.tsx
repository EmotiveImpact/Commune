import { useLocalSearchParams } from "expo-router";
import { useApp } from "../src/state";
import { useTheme } from "../src/ui/theme";
import { Body, Pad } from "../src/ui/chrome";
import { Panel, T } from "../src/ui/kit";

export default function Notes() {
  const { current } = useApp();
  const { c } = useTheme();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  // A note opened from search comes first and is marked.
  const notes = [...(current?.notes ?? [])].sort((a, b) => Number(b.id === focus) - Number(a.id === focus));
  return <Body>
    <Pad gap={12}>
      {notes.length ? notes.map((note) => <Panel key={note.id} pad style={note.id === focus ? { backgroundColor: c.settled, borderColor: c.action } : null}>
        <T kind="strong">{note.title}</T>
        {note.lede ? <T kind="body" muted>{note.lede}</T> : null}
        {note.body ? <T kind="body">{note.body}</T> : null}
      </Panel>) : <Panel pad><T kind="body" muted>Nothing written down in {current?.commune.name} yet.</T></Panel>}
    </Pad>
  </Body>;
}
