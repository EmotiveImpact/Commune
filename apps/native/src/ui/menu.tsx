import { createContext, useCallback, useContext, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { FadeImage } from "./kit";
import { Text } from "./text";
import Animated, { interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import {
  Check, CircleHelp, FileText, Files, LogOut, Plus, Repeat2, Settings, ShoppingBag, SquareCheck, UsersRound, X,
} from "lucide-react-native";
import { standing } from "../lib/derive";
import { useApp } from "../state";
import { haptic, springs, useCalm, PressScale } from "./motion";
import { useConfirm } from "./confirm";
import { useToast } from "./toast";
import { BAR_HEIGHT, KIND_NAME, KIND_PHOTO, useTheme } from "./theme";

type Menu = { open(): void; close(): void; isOpen: boolean };
const Context = createContext<Menu>({ open: () => undefined, close: () => undefined, isOpen: false });
export function useMenu(): Menu {
  return useContext(Context);
}

/** How much of the main screen stays in view at the left while the menu is open. */
const PEEK = 76;

/**
 * The push menu: the burger slides the whole main screen (top bar, page and
 * tab bar together) to the left and settles it back a little, revealing the
 * menu beneath. Tapping or dragging the screen that is left in view closes it.
 */
export function MenuShell({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  const calm = useCalm();
  const { width } = useWindowDimensions();
  const travel = width - PEEK;
  const progress = useSharedValue(0);
  const [isOpen, setOpen] = useState(false);
  const settle = useCallback((to: 0 | 1, velocity = 0) => {
    progress.value = calm ? withTiming(to, { duration: 220 }) : withSpring(to, { ...springs.release, velocity });
  }, [calm, progress]);
  const open = useCallback(() => { setOpen(true); haptic.light(); settle(1); }, [settle]);
  const close = useCallback(() => { setOpen(false); settle(0); }, [settle]);

  // While open, the screen in view follows the finger back to the right.
  const drag = Gesture.Pan().activeOffsetX([-8, 8]).onUpdate((event) => {
    progress.value = Math.max(0, Math.min(1, 1 - event.translationX / travel));
  }).onEnd((event) => {
    const shut = event.velocityX > 500 || progress.value < 0.6;
    runOnJS(shut ? close : open)();
  });

  // The menu pushes the screen left, flat, with no shrinking or rounding
  // (Edem, 7 Nov: clean animation, no morphs). Sheets leave the screen as it is.
  const main = useAnimatedStyle(() => ({
    transform: calm ? [] : [{ translateX: -travel * progress.value }],
    opacity: calm ? interpolate(progress.value, [0, 1], [1, 0]) : 1,
  }));
  const dim = useAnimatedStyle(() => ({ opacity: progress.value * 0.35 }));
  const panel = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5, 1], [0, 0.6, 1]),
    transform: calm ? [] : [{ translateX: (1 - progress.value) * 48 }],
  }));

  const value = useMemo(() => ({ open, close, isOpen }), [open, close, isOpen]);
  return <Context.Provider value={value}>
    <View style={{ flex: 1, backgroundColor: c.frame }}>
      <Animated.View pointerEvents={isOpen ? "auto" : "none"} accessibilityElementsHidden={!isOpen} importantForAccessibility={isOpen ? "auto" : "no-hide-descendants"}
        style={[StyleSheet.absoluteFill, { left: PEEK }, panel]}>
        <MenuPanel />
      </Animated.View>
      <Animated.View style={[{ flex: 1, overflow: "hidden", backgroundColor: c.canvas }, main]}
        accessibilityElementsHidden={isOpen} importantForAccessibility={isOpen ? "no-hide-descendants" : "auto"}>
        {children}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#000" }, dim]} />
      </Animated.View>
      {isOpen ? <GestureDetector gesture={drag}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close menu" onPress={close} style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: PEEK }} />
      </GestureDetector> : null}
    </View>
  </Context.Provider>;
}

type Icon = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/** The menu itself, as in the approved prototype: your communes, then everything else. */
function MenuPanel() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const { close } = useMenu();
  const { snapshots, current, setCurrent, needs, waiting, recorded, user, signOut } = useApp();
  const go = (href: Href) => { close(); router.push(href); };
  async function askSignOut() {
    if (!(await confirm({ title: "Sign out of Commune on this phone?", message: "Your records stay in Commune. You’ll sign in again to see them.", yes: "Sign out", destructive: true }))) return;
    close(); void signOut().then(() => router.replace("/sign-in"));
  }
  const name = current?.commune.name ?? "your commune";

  const row = (key: string, icon: Icon, label: string, onPress: () => void, sub?: string, badge?: string) =>
    <PressScale scaleTo={0.985} key={key} accessibilityRole="button" accessibilityLabel={[label, sub, badge].filter(Boolean).join(". ")} onPress={onPress}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingHorizontal: 8, borderRadius: 12, backgroundColor: pressed ? c.frameRaised : "transparent" })}>
      <View style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>{(() => { const I = icon; return <I size={19} color={c.onFrame2} strokeWidth={1.7} />; })()}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: c.onFrame, fontSize: 15, lineHeight: 20, fontWeight: "500" }}>{label}</Text>
        {sub ? <Text numberOfLines={1} style={{ color: c.onFrame2, fontSize: 12.5, lineHeight: 17 }}>{sub}</Text> : null}
      </View>
      {badge ? <View style={{ backgroundColor: c.dot, borderRadius: 11, paddingHorizontal: 9, height: 22, justifyContent: "center" }}>
        <Text style={{ color: "#1a1e2b", fontSize: 12.5, fontWeight: "600" }}>{badge}</Text>
      </View> : null}
    </PressScale>;

  const ops = (current?.operations ?? []).filter((item) => item.status === "open").length;
  const notes = current?.notes?.length ?? 0;
  const bills = current?.recurringBills?.length ?? 0;
  const funds = current?.funds.filter((fund) => !fund.archivedAt).length ?? 0;
  const templates = (current?.splitTemplates ?? []).filter((item) => !item.archivedAt).length;

  return <View style={{ flex: 1, paddingTop: insets.top }}>
    <View style={{ flexDirection: "row", alignItems: "center", paddingLeft: 24, paddingRight: 8, height: BAR_HEIGHT }}>
      <Text accessibilityRole="header" style={{ flex: 1, color: c.onFrame2, fontSize: 12.5, fontWeight: "600" }}>Your communes</Text>
      <PressScale scaleTo={0.9} accessibilityRole="button" accessibilityLabel="Close menu" onPress={close} hitSlop={6} style={{ width: 46, height: 46, alignItems: "center", justifyContent: "center" }}>
        <X size={22} color={c.onFrame} strokeWidth={1.8} />
      </PressScale>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 16, gap: 2 }}>
      {snapshots.map((snapshot) => {
        const on = snapshot.commune.id === current?.commune.id;
        const line = standing(snapshot, needs, waiting, recorded).line;
        return <PressScale scaleTo={0.985} key={snapshot.commune.id} accessibilityRole="button" accessibilityState={{ selected: on }}
          accessibilityLabel={`${snapshot.commune.name}. ${KIND_NAME[snapshot.commune.kind]}. ${line}.`}
          onPress={() => { setCurrent(snapshot.commune.id); haptic.select(); close(); router.navigate("/hub"); toast(`Showing ${snapshot.commune.name}`); }}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 8, minHeight: 60, borderRadius: 14, backgroundColor: on || pressed ? c.frameRaised : "transparent" })}>
          <FadeImage uri={KIND_PHOTO[snapshot.commune.kind]} placeholder={c.frameRaised} style={{ width: 44, height: 44, borderRadius: 11 }} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: c.onFrame, fontSize: 14.5, lineHeight: 19, fontWeight: "600" }}>{snapshot.commune.name}</Text>
            <Text numberOfLines={1} style={{ color: c.onFrame2, fontSize: 12.5, lineHeight: 17 }}>{KIND_NAME[snapshot.commune.kind]} · {line}</Text>
          </View>
          {on ? <Check size={18} color={c.onFrame} /> : null}
        </PressScale>;
      })}
      <PressScale scaleTo={0.985} accessibilityRole="button" onPress={() => go("/new-commune")}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, padding: 8, borderRadius: 14, backgroundColor: pressed ? c.frameRaised : "transparent" })}>
        <View style={{ width: 44, height: 44, borderRadius: 11, borderWidth: 1, borderColor: "rgba(245,241,234,0.3)", alignItems: "center", justifyContent: "center" }}>
          <Plus size={18} color={c.onFrame} />
        </View>
        <Text style={{ color: c.onFrame, fontSize: 14.5, fontWeight: "600" }}>New commune</Text>
      </PressScale>

      <Divider />
      <Text style={{ color: c.onFrame2, fontSize: 13, fontWeight: "600", paddingHorizontal: 12, paddingBottom: 4 }} numberOfLines={1}>In {name}</Text>
      {row("tasks", SquareCheck, "Chores and tasks", () => go("/tasks"), ops ? `${ops} on the list` : "Nothing on the list")}
      {row("notes", FileText, "Notes", () => go("/notes"), notes ? `${notes} written down` : "Nothing written down yet")}
      {row("members", UsersRound, "Members", () => go("/members"), current ? `${current.members.filter((member) => member.active !== false).length} people` : undefined)}
      {row("recurring", Repeat2, "Recurring", () => go("/recurring"), bills ? `${bills} repeating ${bills === 1 ? "bill" : "bills"}` : "Nothing repeats here")}
      {row("funds", ShoppingBag, "Funds", () => go("/funds"), funds ? `${funds} shared ${funds === 1 ? "pot" : "pots"}` : "No shared pots yet")}
      {row("templates", Files, "Templates", () => go("/templates"), templates ? `${templates} saved ${templates === 1 ? "split" : "splits"}` : "None saved yet")}
      {row("commune-settings", Settings, "Commune settings", () => go("/commune-settings"), current?.commune.role === "admin" ? "Name, kind, place and currency" : "Details, and leaving")}

      <Divider />
      {row("invite", UsersRound, "Invite people", () => go("/invite"), `To ${name}`)}
      {row("settings", Settings, "Settings", () => go("/account"), "Layout, pay links and sign out")}
      {row("help", CircleHelp, "Help and feedback", () => go("/help"))}
      <View style={{ height: 18 }} />
      {row("signout", LogOut, "Sign out", () => void askSignOut(), user?.email)}
    </ScrollView>
  </View>;
}

function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: "rgba(245,241,234,0.16)", marginVertical: 12, marginHorizontal: 6 }} />;
}
