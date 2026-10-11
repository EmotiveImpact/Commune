import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { ArrowRightLeft, Ellipsis, House, LayoutGrid, ReceiptText } from "lucide-react-native";
import { useApp } from "../../src/state";
import { Button, T } from "../../src/ui/kit";
import { useTheme } from "../../src/ui/theme";

const TABS = [
  { name: "index", label: "Home", Icon: LayoutGrid },
  { name: "hub", label: "Hub", Icon: House },
  { name: "expenses", label: "Expenses", Icon: ReceiptText },
  { name: "settle", label: "Settle", Icon: ArrowRightLeft },
  { name: "more", label: "More", Icon: Ellipsis },
];

/** Five tabs on the dark frame, the selected one in a pill, as in the approved mock. */
function TabBar({ state, navigation }: BottomTabBarProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return <View accessibilityRole="tablist" style={{ flexDirection: "row", backgroundColor: c.frame, paddingTop: 8, paddingHorizontal: 6, paddingBottom: Math.max(insets.bottom, 10) }}>
    {TABS.map((tab, index) => {
      const on = state.index === index;
      const color = on ? c.onFrame : c.onFrame2;
      return <Pressable key={tab.name} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={tab.label}
        onPress={() => {
          const event = navigation.emit({ type: "tabPress", target: state.routes[index].key, canPreventDefault: true });
          if (!on && !event.defaultPrevented) navigation.navigate(state.routes[index].name);
        }}
        style={{ flex: 1, alignItems: "center", gap: 4 }}>
        <View style={{ width: 54, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: on ? c.frameRaised : "transparent" }}>
          <tab.Icon size={21} color={color} strokeWidth={on ? 2 : 1.7} />
        </View>
        <Text style={{ fontSize: 11, fontWeight: "500", color }}>{tab.label}</Text>
      </Pressable>;
    })}
  </View>;
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
  return <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.canvas } }}>
    {TABS.map((tab) => <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />)}
  </Tabs>;
}
