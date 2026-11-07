import { useEffect, useState } from "react";
import { View, type LayoutRectangle } from "react-native";
import { Text } from "./text";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { haptic, springs, useCalm, PressScale } from "./motion";
import { useTheme } from "./theme";

/**
 * A two-or-more way choice. The white pill is one piece that slides to the
 * chosen option on the snappy spring.
 */
export function Segmented<V extends string>({ options, value, onChange, label, tone }: {
  options: Array<{ value: V; label: string }>; value: V; onChange(value: V): void; label: string;
  /** "frame" is v7's dark chosen segment, as in Settings. */
  tone?: "frame";
}) {
  const { c, dark } = useTheme();
  const pillColour = tone === "frame" ? (dark ? c.ink : c.frame) : c.surface;
  const onPill = tone === "frame" ? (dark ? c.frame : c.onFrame) : c.ink;
  const calm = useCalm();
  const [boxes, setBoxes] = useState<Record<string, LayoutRectangle>>({});
  const x = useSharedValue(0);
  const w = useSharedValue(0);
  const box = boxes[value];
  useEffect(() => {
    if (!box) return;
    if (w.value === 0 || calm) { x.value = calm && w.value ? withTiming(box.x, { duration: 180 }) : box.x; w.value = box.width; return; }
    x.value = withSpring(box.x, springs.snappy);
    w.value = withSpring(box.width, springs.snappy);
  }, [box, calm, w, x]);
  const pill = useAnimatedStyle(() => ({ width: w.value, transform: [{ translateX: x.value }], opacity: w.value ? 1 : 0 }));
  return <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: "row", backgroundColor: c.recessed, borderRadius: 999, padding: 3 }}>
    <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 3, bottom: 3, left: 0, borderRadius: 999, backgroundColor: pillColour, shadowColor: "#1a1e2b", shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 }, pill]} />
    {options.map((option) => {
      const on = option.value === value;
      return <PressScale key={option.value} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={option.label}
        onLayout={(event) => { const layout = event.nativeEvent.layout; setBoxes((all) => ({ ...all, [option.value]: layout })); }}
        onPress={() => { if (!on) { haptic.select(); onChange(option.value); } }}
        style={{ flex: 1, height: 38, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 }}>
        <Text style={{ fontSize: 14, fontWeight: on ? "600" : "500", color: on ? onPill : c.ink2 }}>{option.label}</Text>
      </PressScale>;
    })}
  </View>;
}
