import { useEffect, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { FITTED, T } from "./kit";
import { springs, useCalm } from "./motion";
import { useTheme } from "./theme";

export function cap(text: string): string { return text ? text[0].toUpperCase() + text.slice(1) : text; }

/** A line on the last step: what it is, what was chosen, and Edit to go back to that step. */
export function CheckLine({ label, value, onEdit, first }: { label: string; value: string; onEdit(): void; first?: boolean }) {
  const { c } = useTheme();
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 46, paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth, borderTopColor: c.outline }}>
    <T kind="label" muted style={{ width: 72 }}>{label}</T>
    <T kind="body" style={{ flex: 1, fontWeight: "500" }} lines={2}>{value}</T>
    <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${label.toLowerCase()}`} onPress={onEdit} hitSlop={8}>
      <T kind="label" color={c.action} style={{ fontWeight: "600" }}>Edit</T>
    </Pressable>
  </View>;
}

/** One person's share of the split. */
export function ShareLine({ name, amount, first }: { name: string; amount: string; first?: boolean }) {
  const { c } = useTheme();
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44, paddingHorizontal: 16, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth, borderTopColor: c.outline }}>
    <T kind="body" style={{ flex: 1 }}>{name}</T>
    <T kind="body" style={{ fontWeight: "600", fontVariant: ["tabular-nums"] }}>{amount}</T>
  </View>;
}

/**
 * The step drawer: a steady height, Back (or Cancel) with the step's title and
 * four thin progress bars, the pages side by side sliding on the smooth
 * spring, and the step's button fixed at the bottom.
 */
export function Steps({ step, title, onBack, onCancel, pages, footer, count = pages.length, locked }: {
  step: number; title: string; onBack(): void; onCancel(): void; pages: ReactNode[]; footer: ReactNode;
  /** How many of the pages are numbered steps; later pages (such as "Ready") show no step count. */
  count?: number;
  /** Hide Back and Cancel, for a last page that only goes forward. */
  locked?: boolean;
}) {
  const { c } = useTheme();
  const calm = useCalm();
  const insets = useSafeAreaInsets();
  const { width: screen, height } = useWindowDimensions();
  const [width, setWidth] = useState(screen);
  const x = useSharedValue(0);
  useEffect(() => { x.value = withSpring(-step * width, springs.smooth); }, [step, width, x]);
  const row = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const page = (content: ReactNode, index: number) => <ScrollView key={index} style={{ width }} keyboardShouldPersistTaps="handled"
    contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}
    importantForAccessibility={index === step ? "auto" : "no-hide-descendants"} accessibilityElementsHidden={index !== step}>{content}</ScrollView>;
  return <View style={[FITTED, { height: Math.min(height * 0.88, 760), backgroundColor: c.canvas }]}>
    <View style={{ paddingHorizontal: 20, paddingTop: 14, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", minHeight: 40 }}>
        {locked ? <View style={{ minWidth: 72 }} /> : <Pressable accessibilityRole="button" accessibilityLabel={step ? "Back" : "Cancel"} onPress={step ? onBack : onCancel} hitSlop={8}
          style={{ minWidth: 72, flexDirection: "row", alignItems: "center", gap: 2 }}>
          {step ? <ChevronLeft size={20} color={c.ink} style={{ marginLeft: -6 }} /> : null}
          <T kind="body" style={{ fontSize: 16 }}>{step ? "Back" : "Cancel"}</T>
        </Pressable>}
        <T kind="strong" accessibilityRole="header" style={{ flex: 1, textAlign: "center" }} lines={1}>{title}</T>
        {step < count ? <View style={{ minWidth: 72 }} accessible accessibilityLabel={`Step ${step + 1} of ${count}`}><T kind="label" muted style={{ textAlign: "right" }}>{step + 1} of {count}</T></View> : <View style={{ minWidth: 72 }} />}
      </View>
      <View style={{ flexDirection: "row", gap: 4 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {pages.slice(0, count).map((_, index) => <View key={index} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: index <= step ? c.action : c.recessed }} />)}
      </View>
    </View>
    <View style={{ flex: 1, overflow: "hidden", marginTop: 8 }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {calm
        ? <Animated.View key={step} entering={FadeIn.duration(180)} style={{ flex: 1 }}>{page(pages[step], step)}</Animated.View>
        : <Animated.View style={[{ flexDirection: "row", width: width * pages.length, flex: 1 }, row]}>{pages.map(page)}</Animated.View>}
    </View>
    <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 16), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.outline }}>{footer}</View>
  </View>;
}

