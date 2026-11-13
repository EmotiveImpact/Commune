import { useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pencil, Plus } from "lucide-react-native";
import { SECRET } from "../src/lib/derive";
import { useApp } from "../src/state";
import { useTheme } from "../src/ui/theme";
import { Body, Pad } from "../src/ui/chrome";
import { Button, Panel, T } from "../src/ui/kit";

/** Every note in full, each with Edit, which opens the same sheet as Add a note. */
export default function Notes() {
  const { current } = useApp();
  const { c } = useTheme();
  const router = useRouter();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  // A note opened from search comes first and is marked.
  const [shown, setShown] = useState<string[]>([]);
  const notes = [...(current?.notes ?? [])].sort((a, b) => Number(b.id === focus) - Number(a.id === focus));
  return <Body>
    <Pad gap={12}>
      {notes.length ? notes.map((note) => <Panel key={note.id} pad style={note.id === focus ? { backgroundColor: c.settled, borderColor: c.action } : null}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            {note.pill ? <T kind="label" muted>{note.pill}</T> : null}
            <T kind="strong">{note.title}</T>
          </View>
          <Button size="sm" variant="secondary" label="Edit" accessibilityLabel={`Edit ${note.title}`} icon={<Pencil size={13} color={c.ink} />}
            onPress={() => router.push({ pathname: "/add-note", params: { id: note.id } })} />
        </View>
        {note.lede ? <T kind="body" muted>{note.lede}</T> : null}
        {note.body ? <T kind="body">{note.body}</T> : null}
        {note.facts?.length ? <View style={{ gap: 6 }}>{note.facts.map(([label, value], index) => {
          // Passwords and codes stay hidden until asked for, as on the Hub.
          const key = `${note.id}:${index}`;
          const hidden = SECRET.test(label) && !shown.includes(key);
          return <View key={index} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <T kind="label" muted style={{ width: 96 }}>{label}</T>
            <T kind="label" style={{ flex: 1, fontWeight: "500" }}>{hidden ? "••••••••" : value}</T>
            {SECRET.test(label) ? <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setShown(hidden ? [...shown, key] : shown.filter((item) => item !== key))}>
              <T kind="label" color={c.action} style={{ fontWeight: "600" }}>{hidden ? "Show" : "Hide"}</T>
            </Pressable> : null}
          </View>;
        })}</View> : null}
      </Panel>) : <Panel pad><T kind="body" muted>Nothing written down in {current?.commune.name} yet.</T></Panel>}
      <Button variant="secondary" block label="Add a note" icon={<Plus size={16} color={c.ink} />} onPress={() => router.push("/add-note")} />
    </Pad>
  </Body>;
}
