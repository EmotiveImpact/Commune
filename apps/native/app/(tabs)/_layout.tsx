import { useEffect, type ComponentType } from "react";
import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { ArrowRightLeft, House, LayoutGrid, ReceiptText } from "lucide-react-native";
import { useApp } from "../../src/state";
import { Avatar, Button, T } from "../../src/ui/kit";
import { MenuShell } from "../../src/ui/menu";
import { PressScale, haptic, springs, useCalm } from "../../src/ui/motion";
import { useTheme } from "../../src/ui/theme";

type Icon = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
const TABS: Array<{ name: string; label: string; Icon?: Icon }> = [
  { name: "index", label: "Home", Icon: LayoutGrid },
  { name: "hub", label: "Hub", Icon: House },
  { name: "expenses", label: "Expenses", Icon: ReceiptText },
  { name: "settle", label: "Settle", Icon: ArrowRightLeft },
  { name: "profile", label: "Profile" },
];

/**
 * Five tabs on the dark frame. The chosen one has no pill: it comes alive
 * instead, springing up from a little smaller, while the others rest at 55% opacity.
 */
function TabBar({ state, navigation }: BottomTabBarProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return <View accessibilityRole="tablist" style={{ flexDirection: "row", backgroundColor: c.frame, paddingTop: 8, paddingHorizontal: 6, paddingBottom: Math.max(insets.bottom - 4, 10) }}>
    {TABS.map((tab, index) => <TabButton key={tab.name} tab={tab} on={state.index === index}
      onPress={() => {
        const on = state.index === index;
        const event = navigation.emit({ type: "tabPress", target: state.routes[index].key, canPreventDefault: true });
        if (!on && !event.defaultPrevented) { haptic.select(); navigation.navigate(state.routes[index].name); }
      }} />)}
  </View>;
}

function TabButton({ tab, on, onPress }: { tab: (typeof TABS)[number]; on: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const calm = useCalm();
  const { user } = useApp();
  const life = useSharedValue(on ? 1 : 0);
  const pop = useSharedValue(1);
  useEffect(() => {
    life.value = calm ? withTiming(on ? 1 : 0, { duration: 180 }) : withSpring(on ? 1 : 0, springs.snappy);
    if (on && !calm) { pop.value = 0.86; pop.value = withSpring(1, springs.bouncy); }
  }, [on, calm, life, pop]);
  const body = useAnimatedStyle(() => ({ opacity: 0.55 + 0.45 * life.value, transform: [{ scale: pop.value }] }));
  const color = c.onFrame;
  return <PressScale accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={tab.label} onPress={onPress}
    style={{ flex: 1, alignItems: "center" }}>
    <Animated.View style={[{ alignItems: "center", gap: 4 }, body]}>
      <View style={{ height: 30, alignItems: "center", justifyContent: "center" }}>
        {tab.Icon ? <tab.Icon size={22} color={color} strokeWidth={on ? 2.1 : 1.7} />
          : <Avatar name={user?.name ?? "You"} size={28} ring={on ? c.onFrame : undefined} />}
      </View>
      <Text style={{ fontSize: 11, fontWeight: on ? "600" : "500", color }}>{tab.label}</Text>
    </Animated.View>
  </PressScale>;
}

export default function TabsLayout() {
  const { c } = useTheme();
  const { status, error, refresh } = useApp();
  if (status === "signed-out") return <Redirect href="/sign-in" />;
  if (status === "starting" || status === "loading") {
    return <View style={{ flex: 1, backgroundColor: c.frame, alignItems: "center", justifyContent: "center", gap: 16 }}>
      <Text style={{ color: c.onFrame, fontSize: 34, fontWeight: "700", letterSpacing: -2 }}>commune.</Text>
      <ActivityIndicator color={c.onFrame} />
    </View>;
  }
  if (status === "error") {
    return <View style={{ flex: 1, backgroundColor: c.canvas, padding: 24, justifyContent: "center", gap: 12 }}>
      <T kind="title">Commune didn’t load</T>
      <T kind="body" muted>{error}</T>
      <Button label="Try again" onPress={() => void refresh()} />
    </View>;
  }
  return <MenuShell>
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.canvas }, animation: "fade" }}>
      {TABS.map((tab) => <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />)}
    </Tabs>
  </MenuShell>;
}
