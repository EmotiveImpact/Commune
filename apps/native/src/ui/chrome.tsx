import type { ReactNode } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Bell, ChevronDown } from "lucide-react-native";
import { useApp } from "../state";
import { activeMembers } from "../lib/derive";
import { Avatar, T } from "./kit";
import { KIND_NAME, KIND_PHOTO, radius, useTheme } from "./theme";

/**
 * The slim dark top bar from the approved phone mock: the wordmark on Home,
 * the screen's name elsewhere, then notifications and your account.
 */
export function TopBar({ title, children }: { title?: string; children?: ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, snapshots } = useApp();
  const unread = snapshots.some((snapshot) => snapshot.notifications.some((item) => !item.readAt));
  return <View style={{ backgroundColor: c.frame, paddingTop: insets.top }}>
    <View style={{ height: 50, flexDirection: "row", alignItems: "center", paddingLeft: 18, paddingRight: 10, gap: 4 }}>
      {title
        ? <Text accessibilityRole="header" style={{ color: c.onFrame, fontSize: 19, fontWeight: "600", letterSpacing: -0.3 }}>{title}</Text>
        : <Text accessibilityRole="header" accessibilityLabel="Commune, Home" style={{ color: c.onFrame, fontSize: 25, fontWeight: "700", letterSpacing: -1.4 }}>commune.</Text>}
      <View style={{ flex: 1 }} />
      <Pressable accessibilityRole="button" accessibilityLabel={unread ? "Notifications, new" : "Notifications"} hitSlop={4}
        onPress={() => router.push("/notifications")} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
        <Bell size={21} color={c.onFrame} strokeWidth={1.8} />
        {unread ? <View style={{ position: "absolute", top: 11, right: 11, width: 8, height: 8, borderRadius: 4, backgroundColor: c.dot, borderWidth: 2, borderColor: c.frame }} /> : null}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Your account" onPress={() => router.push("/account")} style={{ padding: 6 }}>
        <Avatar name={user?.name ?? "You"} size={30} ring={c.frame} />
      </Pressable>
    </View>
    {children}
  </View>;
}

/** The scrolling body under a top bar. */
export function Body({ children, ...rest }: ScrollViewProps & { children: ReactNode }) {
  const { c } = useTheme();
  return <ScrollView style={{ flex: 1, backgroundColor: c.canvas }} contentContainerStyle={{ paddingBottom: 32 }} {...rest}>{children}</ScrollView>;
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
