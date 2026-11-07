import { View } from "react-native";
import { Delete } from "lucide-react-native";
import { Text } from "./text";
import { haptic, PressScale } from "./motion";
import { radius, useTheme } from "./theme";
import { KEYS, pressKey } from "../lib/keypad";


/** A 3 by 4 number pad for amounts, so the big figure above it is all you need to look at. */
export function Keypad({ value, onChange }: { value: string; onChange(value: string): void }) {
  const { c } = useTheme();
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
    {KEYS.map((key) => <PressScale key={key} scaleTo={0.94} accessibilityRole="button" accessibilityLabel={key === "del" ? "Delete" : key === "." ? "Point" : key}
      onPress={() => { haptic.select(); onChange(pressKey(value, key)); }}
      style={({ pressed }) => ({ width: "31.5%", flexGrow: 1, height: 46, borderRadius: radius.control, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? c.recessed : c.surface, borderWidth: 1, borderColor: c.outline })}>
      {key === "del" ? <Delete size={21} color={c.ink} strokeWidth={1.75} />
        : <Text style={{ fontSize: 21, fontWeight: "500", color: c.ink, fontVariant: ["tabular-nums"] }}>{key}</Text>}
    </PressScale>)}
  </View>;
}
