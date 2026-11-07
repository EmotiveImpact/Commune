import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { MapPin } from "lucide-react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { chooseAddressSearch } from "../lib/addressSearch";
import type { AddressSuggestion } from "../lib/places";
import { Text, TextInput } from "./text";
import { T } from "./kit";
import { PressScale, haptic, useCalm } from "./motion";
import { radius, useTheme } from "./theme";

/**
 * The address box. Where an address search is switched on (Apple's on iPhone,
 * Google's once its key is set), matching addresses show under it as you type
 * and a tap fills in the full address. Anything can still be typed by hand.
 */
export function AddressField({ label, value, onChange, placeholder, max = 160 }: {
  label: string; value: string; onChange(value: string): void; placeholder?: string; max?: number;
}) {
  const { c } = useTheme();
  const calm = useCalm();
  const search = useMemo(() => chooseAddressSearch(), []);
  const [typed, setTyped] = useState(false);
  const [focused, setFocused] = useState(false);
  const [rows, setRows] = useState<AddressSuggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const asked = useRef(0);

  useEffect(() => {
    if (!search || !typed || !focused || value.trim().length < 3) { setRows([]); return; }
    const ask = ++asked.current;
    const timer = setTimeout(() => {
      search.suggest(value).then((found) => { if (ask === asked.current) setRows(found); }).catch(() => undefined);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, typed, focused, value]);

  async function choose(row: AddressSuggestion) {
    haptic.select();
    asked.current += 1;
    setBusy(true);
    const full = await row.pick().catch(() => [row.title, row.subtitle].filter(Boolean).join(", "));
    setBusy(false);
    setTyped(false);
    setRows([]);
    onChange(full.slice(0, max));
  }

  return <View style={{ gap: 6 }}>
    <T kind="label" style={{ fontWeight: "600" }}>{label}</T>
    <View>
      <TextInput accessibilityLabel={label} value={value} maxLength={max} placeholder={placeholder} placeholderTextColor={c.ink2}
        onChangeText={(text) => { setTyped(true); onChange(text); }} textContentType="fullStreetAddress" autoComplete="street-address"
        onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 150)}
        style={{ minHeight: 48, borderRadius: radius.control, borderWidth: 1, borderColor: c.outline, backgroundColor: c.surface, paddingHorizontal: 14, paddingRight: busy ? 40 : 14, fontSize: 16, color: c.ink }} />
      {busy ? <ActivityIndicator style={{ position: "absolute", right: 14, top: 14 }} color={c.ink2} /> : null}
    </View>
    {rows.length ? <Animated.View entering={calm ? undefined : FadeIn.duration(180)}
      style={{ borderRadius: radius.control, borderWidth: 1, borderColor: c.outline, backgroundColor: c.surface, overflow: "hidden" }}>
      {rows.map((row, index) => <PressScale key={`${row.title}-${row.subtitle}-${index}`} scaleTo={0.99} accessibilityRole="button"
        accessibilityLabel={[row.title, row.subtitle].filter(Boolean).join(", ")} onPress={() => void choose(row)}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 54, paddingHorizontal: 14, paddingVertical: 8,
          borderTopWidth: index ? StyleSheet.hairlineWidth : 0, borderTopColor: c.outline, backgroundColor: pressed ? c.press : "transparent" })}>
        <MapPin size={18} color={c.ink2} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "500", color: c.ink }}>{row.title}</Text>
          {row.subtitle ? <Text numberOfLines={1} style={{ fontSize: 13, color: c.ink2 }}>{row.subtitle}</Text> : null}
        </View>
      </PressScale>)}
      <Text style={{ fontSize: 11, color: c.ink2, paddingHorizontal: 14, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.outline }}>
        {search?.name === "google" ? "Powered by Google" : "Suggestions from Apple Maps"}
      </Text>
    </Animated.View> : null}
  </View>;
}
