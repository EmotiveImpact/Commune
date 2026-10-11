import { Image, View } from "react-native";
import { useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import { activeMembers, standing } from "../src/lib/derive";
import { useApp } from "../src/state";
import { photoOf } from "../src/ui/chrome";
import { Panel, Row, T } from "../src/ui/kit";
import { KIND_NAME, useTheme } from "../src/ui/theme";

/** Choose which commune Hub, Expenses and More show. */
export default function Switch() {
  const { c } = useTheme();
  const router = useRouter();
  const { snapshots, current, setCurrent, needs, waiting, recorded } = useApp();
  return <View style={{ padding: 20, paddingTop: 24, gap: 14, backgroundColor: c.canvas }}>
    <T kind="title" accessibilityRole="header">Your communes</T>
    <Panel>{snapshots.map((snapshot, index) => {
      const on = snapshot.commune.id === current?.commune.id;
      const people = activeMembers(snapshot).length;
      return <Row key={snapshot.commune.id} first={index === 0} accessibilityLabel={`${snapshot.commune.name}${on ? ", selected" : ""}`}
        onPress={() => { setCurrent(snapshot.commune.id); router.back(); }}
        left={<Image source={{ uri: photoOf(snapshot.commune.kind) }} style={{ width: 40, height: 40, borderRadius: 9 }} />}
        title={snapshot.commune.name}
        meta={<T kind="label" muted>{KIND_NAME[snapshot.commune.kind]} · {people} {people === 1 ? "person" : "people"} · {standing(snapshot, needs, waiting, recorded).line}</T>}
        right={on ? <Check size={18} color={c.action} /> : null} />;
    })}</Panel>
  </View>;
}
