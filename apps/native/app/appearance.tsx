import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import { APPEARANCE_LABEL, type Appearance } from "../src/lib/prefsStore";
import { usePrefs } from "../src/prefs";
import { FITTED, Panel, Row, T, tap } from "../src/ui/kit";
import { Sheet } from "../src/ui/sheet";
import { useTheme } from "../src/ui/theme";

const CHOICES: Appearance[] = ["match", "light", "dark"];

/** Settings > Appearance: follow the phone, or always light or dark. Kept on this phone. */
export default function AppearanceSheet() {
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const leave = () => (router.canGoBack() ? router.back() : router.replace("/"));
  return <Sheet closing={closing} onClosed={leave}><Body close={() => setClosing(true)} /></Sheet>;
}

function Body({ close }: { close(): void }) {
  const { c } = useTheme();
  const { appearance, setAppearance } = usePrefs();
  return <View style={[FITTED, { padding: 20, paddingTop: 12, gap: 14 }]}>
    <T kind="title" accessibilityRole="header">Appearance</T>
    <Panel>{CHOICES.map((choice, index) => <Row key={choice} first={index === 0}
      accessibilityLabel={`${APPEARANCE_LABEL[choice]}${appearance === choice ? ", selected" : ""}`}
      onPress={() => { tap("select"); setAppearance(choice); close(); }}
      title={APPEARANCE_LABEL[choice]}
      meta={choice === "match" ? <T kind="label" muted>Light or dark with your phone</T> : undefined}
      right={appearance === choice ? <Check size={18} color={c.action} /> : null} />)}</Panel>
  </View>;
}
