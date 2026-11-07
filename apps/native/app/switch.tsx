import { useState } from "react";
import { Image, View } from "react-native";
import { useRouter } from "expo-router";
import { Check, Plus } from "lucide-react-native";
import { activeMembers, standing } from "../src/lib/derive";
import { useApp } from "../src/state";
import { photoOf } from "../src/ui/chrome";
import { FITTED, Panel, Row, T } from "../src/ui/kit";
import { Sheet } from "../src/ui/sheet";
import { KIND_NAME, useTheme } from "../src/ui/theme";

/** Choose which commune Hub, Expenses and More show, in a sheet only as tall as the list. */
export default function Switch() {
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const [next, setNext] = useState<(() => void) | null>(null);
  const leave = () => {
    if (router.canGoBack()) router.back(); else router.replace("/");
    if (next) setTimeout(next, 30);
  };
  return <Sheet closing={closing} onClosed={leave}><SwitchBody close={(then) => { if (then) setNext(() => then); setClosing(true); }} /></Sheet>;
}

function SwitchBody({ close }: { close: (then?: () => void) => void }) {
  const { c } = useTheme();
  const router = useRouter();
  const { snapshots, current, setCurrent, needs, waiting, recorded } = useApp();
  return <View style={[FITTED, { padding: 20, paddingTop: 12, gap: 14 }]}>
    <T kind="title" accessibilityRole="header">Your communes</T>
    <Panel>{snapshots.map((snapshot, index) => {
      const on = snapshot.commune.id === current?.commune.id;
      const people = activeMembers(snapshot).length;
      return <Row key={snapshot.commune.id} first={index === 0} accessibilityLabel={`${snapshot.commune.name}${on ? ", selected" : ""}`}
        onPress={() => { setCurrent(snapshot.commune.id); close(); }}
        left={<Image source={{ uri: photoOf(snapshot.commune.kind) }} style={{ width: 40, height: 40, borderRadius: 9 }} />}
        title={snapshot.commune.name}
        meta={<T kind="label" muted>{KIND_NAME[snapshot.commune.kind]} · {people} {people === 1 ? "person" : "people"} · {standing(snapshot, needs, waiting, recorded).line}</T>}
        right={on ? <Check size={18} color={c.action} /> : null} />;
    })}
      <Row onPress={() => close(() => router.push("/new-commune"))}
        left={<View style={{ width: 40, height: 40, borderRadius: 9, borderWidth: 1, borderStyle: "dashed", borderColor: c.outline, alignItems: "center", justifyContent: "center" }}><Plus size={18} color={c.ink} /></View>}
        title="New commune" meta={<T kind="label" muted>A home, a team or a trip</T>} />
    </Panel>
  </View>;
}
