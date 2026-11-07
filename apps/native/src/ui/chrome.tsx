import { useState, type ReactNode } from "react";
import { PressScale } from "./motion";
import { Image, RefreshControl, StyleSheet, View, type ScrollViewProps } from "react-native";
import { Text } from "./text";
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Bell, ChevronDown, ChevronLeft, LoaderCircle, Menu, Search, WifiOff } from "lucide-react-native";
import { cap, word } from "../lib/format";
import { SearchScreen } from "./search";
import { useMenu } from "./menu";
import { useApp } from "../state";
import { activeMembers } from "../lib/derive";
import { T } from "./kit";
import { BAR_HEIGHT, KIND_NAME, KIND_PHOTO, radius, useTheme } from "./theme";

/**
 * The slim dark top bar: the wordmark on every tab, then on the right search,
 * the notifications bell (a dot means something new) and the burger that
 * opens the menu. The title names the screen for screen readers.
 */
export function TopBar({ title, children, clear }: { title?: string; children?: ReactNode; clear?: boolean }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const menu = useMenu();
  const router = useRouter();
  const { snapshots } = useApp();
  const unread = snapshots.some((snapshot) => snapshot.notifications.some((item) => !item.readAt));
  const [searching, setSearching] = useState(false);
  return <View style={{ backgroundColor: clear ? "transparent" : c.frame, paddingTop: insets.top }}>
    <View style={{ height: BAR_HEIGHT, flexDirection: "row", alignItems: "center", paddingLeft: 20, paddingRight: 8, gap: 4 }}>
      <Text accessibilityRole="header" accessibilityLabel={title ? `Commune, ${title}` : "Commune, Home"} style={{ color: c.onFrame, fontSize: 25, fontFamily: "CommuneWordmark25", letterSpacing: -1.4 }}>commune.</Text>
      <View style={{ flex: 1 }} />
      <PressScale scaleTo={0.9} accessibilityRole="button" accessibilityLabel="Search" hitSlop={4}
        onPress={() => setSearching(true)} style={({ pressed }) => ({ width: 46, height: 46, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}>
        <Search size={22} color={c.onFrame} strokeWidth={1.7} />
      </PressScale>
      <PressScale scaleTo={0.9} accessibilityRole="button" accessibilityLabel={unread ? "Notifications, something new" : "Notifications"} hitSlop={4}
        onPress={() => router.push("/notifications")} style={({ pressed }) => ({ width: 46, height: 46, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}>
        <Bell size={22} color={c.onFrame} strokeWidth={1.7} />
        {unread ? <View style={{ position: "absolute", top: 10, right: 11, width: 9, height: 9, borderRadius: 5, backgroundColor: c.dot, borderWidth: 2, borderColor: c.frame }} /> : null}
      </PressScale>
      <PressScale scaleTo={0.9} accessibilityRole="button" accessibilityLabel="Menu" accessibilityState={{ expanded: menu.isOpen }} hitSlop={4}
        onPress={menu.open} style={({ pressed }) => ({ width: 46, height: 46, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}>
        <Menu size={23} color={c.onFrame} strokeWidth={1.7} />
      </PressScale>
    </View>
    <OfflineStrip />
    {children}
    <SearchScreen visible={searching} onClose={() => setSearching(false)} />
  </View>;
}

/**
 * v7's strip under the top bar when there is no signal, or while records
 * saved offline are sending.
 */
function OfflineStrip() {
  const { c } = useTheme();
  const { online, outbox, sending } = useApp();
  if (online && !outbox.length && !sending) return null;
  const n = outbox.length;
  const words = !online
    ? `No signal.${n ? ` ${cap(word(n))} ${n === 1 ? "record is" : "records are"} saved on this phone and will send when you’re back.` : " You can still record. It sends when you’re back."}`
    : "Sending…";
  return <View accessibilityLiveRegion="polite" style={{ paddingHorizontal: 12, paddingBottom: 10 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: c.frameRaised }}>
      {online ? <LoaderCircle size={17} color={c.onFrame2} /> : <WifiOff size={17} color={c.onFrame2} />}
      <Text style={{ flex: 1, color: c.onFrame, fontSize: 14, lineHeight: 20 }}>{words}</Text>
    </View>
  </View>;
}

export { BAR_HEIGHT };

/**
 * The top bar on inner screens (Notifications, Settings and the rest): the
 * same dark bar and height as the tabs' top bar, with a back chevron and the
 * screen's name. Swiping from the left goes back too.
 */
export function PushedBar({ title, onBack }: { title: string; onBack?: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return <View style={{ backgroundColor: c.frame, paddingTop: insets.top }}>
    <View style={{ height: BAR_HEIGHT, flexDirection: "row", alignItems: "center", paddingHorizontal: 6 }}>
      <View style={{ width: 52 }}>
        {onBack ? <PressScale scaleTo={0.9} accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={6}
          style={({ pressed }) => ({ width: 46, height: 46, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
          <ChevronLeft size={27} color={c.onFrame} strokeWidth={1.8} />
        </PressScale> : null}
      </View>
      <Text accessibilityRole="header" numberOfLines={1} style={{ flex: 1, textAlign: "center", color: c.onFrame, fontSize: 17, fontWeight: "600" }}>{title}</Text>
      <View style={{ width: 52 }} />
    </View>
  </View>;
}

/**
 * The scrolling body under a top bar. Pulling down refreshes, with the
 * spinner in the gap: the content follows the finger half way and `ground`
 * (the page's own top colour, canvas unless the page opens dark) fills the
 * rest, so no odd band appears. Pass refresh={false} where it makes no sense.
 */
export function Body({ children, ground, refresh = true, ...rest }: ScrollViewProps & { children: ReactNode; ground?: string; refresh?: boolean }) {
  const { c } = useTheme();
  const pull = usePull();
  const app = useApp();
  const [pulling, setPulling] = useState(false);
  const top = ground ?? c.canvas;
  const dark = top === c.frame;
  const control = rest.refreshControl ?? (refresh ? <RefreshControl refreshing={pulling} tintColor={dark ? c.onFrame : c.ink2} colors={[c.action]}
    onRefresh={async () => { setPulling(true); try { await app.refresh(); } finally { setPulling(false); } }} /> : undefined);
  return <Animated.ScrollView style={{ flex: 1, backgroundColor: c.canvas }} contentContainerStyle={{ paddingBottom: 32 }}
    onScroll={pull.onScroll} scrollEventThrottle={16} {...rest} refreshControl={control}>
    <Ground color={top} />
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
  return <PressScale scaleTo={0.985} accessibilityRole="button" accessibilityLabel={`Commune: ${commune.name}. Change commune.`}
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
  </PressScale>;
}
