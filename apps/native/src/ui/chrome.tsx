import { useState, type ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, View, type ScrollViewProps } from "react-native";
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Bell, ChevronDown, Menu, Search } from "lucide-react-native";
import { SearchScreen } from "./search";
import { useMenu } from "./menu";
import { useApp } from "../state";
import { activeMembers } from "../lib/derive";
import { T } from "./kit";
import { KIND_NAME, KIND_PHOTO, radius, useTheme } from "./theme";

/**
 * The slim dark top bar: the wordmark on every tab, then on the right search,
 * the notifications bell (a dot means something new) and the burger that
 * opens the menu. The title names the screen for screen readers.
 */
export function TopBar({ title, children }: { title?: string; children?: ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const menu = useMenu();
  const router = useRouter();
  const { snapshots } = useApp();
  const unread = snapshots.some((snapshot) => snapshot.notifications.some((item) => !item.readAt));
  const [searching, setSearching] = useState(false);
  return <View style={{ backgroundColor: c.frame, paddingTop: insets.top }}>
    <View style={{ height: 52, flexDirection: "row", alignItems: "center", paddingLeft: 20, paddingRight: 8, gap: 4 }}>
      <Text accessibilityRole="header" accessibilityLabel={title ? `Commune, ${title}` : "Commune, Home"} style={{ color: c.onFrame, fontSize: 25, fontWeight: "700", letterSpacing: -1.4 }}>commune.</Text>
      <View style={{ flex: 1 }} />
      <Pressable accessibilityRole="button" accessibilityLabel="Search" hitSlop={4}
        onPress={() => setSearching(true)} style={({ pressed }) => ({ width: 46, height: 46, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}>
        <Search size={22} color={c.onFrame} strokeWidth={1.7} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={unread ? "Notifications, something new" : "Notifications"} hitSlop={4}
        onPress={() => router.push("/notifications")} style={({ pressed }) => ({ width: 46, height: 46, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}>
        <Bell size={22} color={c.onFrame} strokeWidth={1.7} />
        {unread ? <View style={{ position: "absolute", top: 10, right: 11, width: 9, height: 9, borderRadius: 5, backgroundColor: c.dot, borderWidth: 2, borderColor: c.frame }} /> : null}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Menu" accessibilityState={{ expanded: menu.isOpen }} hitSlop={4}
        onPress={menu.open} style={({ pressed }) => ({ width: 46, height: 46, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}>
        <Menu size={23} color={c.onFrame} strokeWidth={1.7} />
      </Pressable>
    </View>
    {children}
    <SearchScreen visible={searching} onClose={() => setSearching(false)} />
  </View>;
}

/** The scrolling body under a top bar. */
export function Body({ children, ground, ...rest }: ScrollViewProps & { children: ReactNode; ground?: string }) {
  const { c } = useTheme();
  const pull = usePull();
  return <Animated.ScrollView style={{ flex: 1, backgroundColor: c.canvas }} contentContainerStyle={{ paddingBottom: 32 }}
    onScroll={pull.onScroll} scrollEventThrottle={16} {...rest}>
    <Ground color={ground ?? c.frame} />
    <Animated.View style={pull.damp}>{children}</Animated.View>
  </Animated.ScrollView>;
}

/** Share of a pull past the top that the content follows; the rest is taken up by the stretching top. */
export const PULL_SHOWN = 0.5;

/**
 * Tracks a scroll view's position and damps a pull past the top: the content
 * moves down only PULL_SHOWN of the way, so the screen pulls down less while
 * the dark top fills the gap. Wrap the content in an Animated.View with `damp`.
 */
export function usePull() {
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => { y.value = event.contentOffset.y; });
  const damp = useAnimatedStyle(() => ({ transform: [{ translateY: y.value < 0 ? y.value * (1 - PULL_SHOWN) : 0 }] }));
  return { y, onScroll, damp };
}

/**
 * The dark top carried on above the content, so pulling down (to refresh, or
 * just past the top) stretches the dark band under the top bar instead of
 * showing an empty light gap. Put it first inside a scroll view.
 */
export function Ground({ color }: { color: string }) {
  return <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: -1200, height: 1200, backgroundColor: color }} />;
}
export function Pad({ children, gap = 16 }: { children: ReactNode; gap?: number }) {
  return <View style={{ padding: 16, gap }}>{children}</View>;
}

export function photoOf(kind: "household" | "workspace" | "trip") {
  return KIND_PHOTO[kind];
}

/** One control at the top of Hub, Expenses and More: which commune you're looking at. */
export function ScopeRow() {
  const { c } = useTheme();
  const router = useRouter();
  const { current, communes } = useApp();
  if (!current) return null;
  const { commune } = current;
  const people = activeMembers(current).length;
  return <Pressable accessibilityRole="button" accessibilityLabel={`Commune: ${commune.name}. Change commune.`}
    disabled={communes.length < 2} onPress={() => router.push("/switch")}
    style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: radius.surface, backgroundColor: pressed ? c.press : c.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: c.outline })}>
    <Image source={{ uri: photoOf(commune.kind) }} style={{ width: 40, height: 40, borderRadius: 9, backgroundColor: c.recessed }} />
    <View style={{ flex: 1, minWidth: 0 }}>
      <T kind="section" lines={1}>{commune.name}</T>
      <T kind="label" muted>{KIND_NAME[commune.kind]} · {people} {people === 1 ? "person" : "people"}</T>
    </View>
    {communes.length > 1 ? <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingRight: 4 }}>
      <T kind="label" style={{ fontWeight: "500" }}>Change</T><ChevronDown size={16} color={c.ink} />
    </View> : null}
  </Pressable>;
}
