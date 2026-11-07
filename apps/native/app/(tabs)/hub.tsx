import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { ImageBackground, Linking, Platform, RefreshControl, StyleSheet, View, useWindowDimensions } from "react-native";
import { Text } from "../../src/ui/text";
import { useRouter, type Href } from "expo-router";
import { BlurView } from "expo-blur";
import * as Clipboard from "expo-clipboard";
import Animated, { interpolate, useAnimatedRef, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming, Extrapolation, type SharedValue } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Megaphone, CalendarDays, Check, ChevronDown, ChevronRight, Copy, Eye, EyeOff, Files, Phone, Plus, ReceiptText, Repeat2, ShoppingBag, UsersRound } from "lucide-react-native";
import {
  activeMembers, essentials, hubMoneyLine, oweTotals, owedTotals, people, week, weekSentence,
  type Essential, type WeekItem,
} from "../../src/lib/derive";
import { addDays, calParts, firstName, joinAnd, money } from "../../src/lib/format";
import { usePrefs } from "../../src/prefs";
import { failure, useApp } from "../../src/state";
import { Body, Ground, Pad, PULL_SHOWN, TopBar, photoOf, usePull } from "../../src/ui/chrome";
import { Avatar, Button, Cal, Empty, Faces, Panel, Row, SectionHead, State, T, tap, TextLink } from "../../src/ui/kit";
import { haptic, PressScale, springs, useCalm } from "../../src/ui/motion";
import { NeedsList, TaskCheck, WaitingRow } from "../../src/ui/parts";
import { PayPrimary } from "../../src/ui/pay";
import { HERO_HEIGHT, heroHidden, heroReveal, hubHooks } from "../../src/ui/hero";
import { Rolling } from "../../src/ui/rolling";
import { useToast } from "../../src/ui/toast";
import { KIND_NAME, radius, useTheme } from "../../src/ui/theme";

type HubTab = "overview" | "money" | "chores" | "notes";
const HUB_TABS: Array<{ id: HubTab; label: string }> = [
  { id: "overview", label: "Overview" }, { id: "money", label: "Money" }, { id: "chores", label: "Chores" }, { id: "notes", label: "Notes" },
];

/**
 * The Hub, the house at a glance: the commune's photo first with this week's
 * pulse on it, then Overview, Money, Chores and Notes. The tabs sit under the
 * photo and stick below the top bar, or at the bottom, as chosen in Settings.
 * Swiping sideways moves between them; the pill follows the finger.
 */
export default function Hub() {
  const { c } = useTheme();
  const calm = useCalm();
  const { width } = useWindowDimensions();
  const { current } = useApp();
  const { hubTabsAt } = usePrefs();
  const [tab, setTab] = useState<HubTab>("overview");
  const [heights, setHeights] = useState<Partial<Record<HubTab, number>>>({});
  const pull = usePull();
  const scroller = useAnimatedRef<Animated.ScrollView>();
  useEffect(() => { hubHooks.scrollTop = () => scroller.current?.scrollTo({ y: 0, animated: false }); return () => { hubHooks.scrollTop = undefined; }; }, [scroller]);
  const { refresh } = useApp();
  const [pulling, setPulling] = useState(false);
  const index = HUB_TABS.findIndex((item) => item.id === tab);
  const at = useSharedValue(index);
  const pager = useSharedValue(-index * width);
  const left = useSharedValue(index);
  const right = useSharedValue(index);
  const communeId = current?.commune.id;

  // A new commune opens on its Overview.
  useEffect(() => { setTab("overview"); at.value = 0; pager.value = 0; left.value = 0; right.value = 0; }, [communeId, at, pager, left, right]);

  const movePill = useCallback((to: number) => {
    "worklet";
    if (calm) { left.value = withTiming(to, { duration: 180 }); right.value = withTiming(to, { duration: 180 }); return; }
    // Both edges move together, so the pill slides cleanly without stretching.
    left.value = withSpring(to, springs.smooth);
    right.value = withSpring(to, springs.smooth);
  }, [calm, left, right]);

  const choose = useCallback((next: HubTab, slid = false) => {
    const to = HUB_TABS.findIndex((item) => item.id === next);
    if (to === at.value && !slid) return;
    at.value = to;
    // A tapped tab switches at once; only the pill slides. No entrance animation.
    if (!slid) { pager.value = -to * width; movePill(to); }
    setTab(next);
    haptic.select();
  }, [at, pager, width, movePill]);

  const landed = useCallback((to: number) => choose(HUB_TABS[to].id, true), [choose]);
  const swipe = Gesture.Pan().activeOffsetX([-16, 16]).failOffsetY([-12, 12]).onUpdate((event) => {
    const i = at.value;
    let f = Math.max(-1, Math.min(1, -event.translationX / width));
    const j = i + Math.sign(f);
    if (j < 0 || j >= HUB_TABS.length) f *= 0.25; // Past the first or last tab it only gives a little.
    pager.value = -i * width - f * width;
    if (j < 0 || j >= HUB_TABS.length || f === 0) return;
    const amount = Math.abs(f), lead = amount, trail = amount;
    const forward = j > i;
    left.value = i + (j - i) * (forward ? trail : lead);
    right.value = i + (j - i) * (forward ? lead : trail);
  }).onEnd((event) => {
    const i = at.value;
    const f = -event.translationX / width;
    let to = i;
    if (f > 0.22 || event.velocityX < -600) to = Math.min(HUB_TABS.length - 1, i + 1);
    else if (f < -0.22 || event.velocityX > 600) to = Math.max(0, i - 1);
    pager.value = calm ? withTiming(-to * width, { duration: 200 }) : withSpring(-to * width, { ...springs.release, velocity: event.velocityX });
    movePill(to);
    if (to !== i) { at.value = to; runOnJS(landed)(to); }
  });
  const track = useAnimatedStyle(() => ({ transform: [{ translateX: pager.value }] }));

  if (!current) return <View style={{ flex: 1 }}><TopBar title="Hub" /><Body><Pad><T kind="body" muted>You’re not in a commune yet.</T></Pad></Body></View>;
  const pills = <HubPills tab={tab} onPick={(next) => choose(next)} left={left} right={right} floating={hubTabsAt === "bottom"} />;
  const pages: Record<HubTab, ReactNode[]> = {
    overview: [<Notice key="notice" />, <YourPart key="part" onMore={() => choose("money")} />, <WeekPanel key="week" onAll={() => choose("chores")} />, <PeoplePanel key="people" />],
    money: moneySections(),
    chores: [<ChoresPage key="chores" />],
    notes: [<Essentials key="essentials" />, <NotesList key="notes" />],
  };
  return <View style={{ flex: 1, backgroundColor: c.canvas }}>
    <TopBar title="Hub" />
    <Animated.ScrollView ref={scroller} onScroll={pull.onScroll} scrollEventThrottle={16} style={{ flex: 1 }}
      refreshControl={<RefreshControl refreshing={pulling} tintColor="#ffffff" onRefresh={async () => { setPulling(true); await refresh(); setPulling(false); }} />}
      stickyHeaderIndices={hubTabsAt === "top" ? [1] : undefined}
      contentContainerStyle={{ paddingBottom: hubTabsAt === "bottom" ? 96 : 32 }}>
      <Animated.View style={pull.damp}><Hero scrollY={pull.y} /></Animated.View>
      {hubTabsAt === "top" ? <Animated.View style={pull.damp}>{pills}</Animated.View> : null}
      <Animated.View style={pull.damp}><GestureDetector gesture={swipe}>
        <View style={{ overflow: "hidden", height: heights[tab] }}>
          <Animated.View style={[{ flexDirection: "row", width: width * HUB_TABS.length, alignItems: "flex-start" }, track]}>
            {HUB_TABS.map((item) => <View key={item.id} accessibilityElementsHidden={item.id !== tab} importantForAccessibility={item.id === tab ? "auto" : "no-hide-descendants"}
              onLayout={(event) => { const h = Math.ceil(event.nativeEvent.layout.height); setHeights((all) => (all[item.id] === h ? all : { ...all, [item.id]: h })); }}
              style={{ width, padding: 16, gap: 22 }}>
              {pages[item.id]}
            </View>)}
          </Animated.View>
        </View>
      </GestureDetector></Animated.View>
    </Animated.ScrollView>
    {hubTabsAt === "bottom" ? pills : null}
  </View>;
}

function moneySections(): ReactNode[] {
  return [<OweHere key="owe" />, <OwedHere key="owed" />, <MoneyActions key="acts" />, <MoneyMore key="more" />];
}

/** The photo, its place and people, and the week's pulse, with Change and Invite on glass. */
const HERO_GROUND = "#262b3a";

function Hero({ scrollY }: { scrollY: SharedValue<number> }) {
  const router = useRouter();
  // Pulled past the top, the photo grows from its bottom edge to fill the
  // gap, like a music app's album header, instead of showing a blank band.
  const stretch = useAnimatedStyle(() => {
    const gap = Math.max(0, -scrollY.value) * PULL_SHOWN;
    return { opacity: 1 - heroHidden.value, transform: [{ translateY: -gap / 2 }, { scale: interpolate(gap, [0, HERO_HEIGHT], [1, 2], Extrapolation.EXTEND) }] };
  });
  // After the photo lands from a tile, the buttons and words rise in.
  const reveal = useAnimatedStyle(() => ({ opacity: heroReveal.value, transform: [{ translateY: 10 * (1 - heroReveal.value) }] }));
  const revealLate = useAnimatedStyle(() => {
    const k = Math.max(0, Math.min(1, heroReveal.value * 1.25 - 0.25));
    return { opacity: k, transform: [{ translateY: 10 * (1 - k) }] };
  });
  const { current, communes, user, today } = useApp();
  if (!current) return null;
  const { commune } = current;
  const members = activeMembers(current);
  const place = commune.address || commune.destination || "";
  const sentence = weekSentence(week(current, user?.id ?? "", today));
  // v7's glass buttons: dark frosted glass with a soft light edge.
  const glass = { flexDirection: "row" as const, alignItems: "center" as const, gap: 6, height: 36, paddingHorizontal: 13, borderRadius: 18, overflow: "hidden" as const, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" };
  const glassIn = { flexDirection: "row" as const, alignItems: "center" as const, gap: 6, zIndex: 1 };
  const frost = <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 18, overflow: "hidden" }]}>
    <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
    <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(14,16,24,0.45)" }]} />
  </View>;
  return <View style={{ height: HERO_HEIGHT, backgroundColor: HERO_GROUND }}>
    <Ground color={HERO_GROUND} />
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, stretch]}>
    <ImageBackground source={{ uri: photoOf(commune.kind) }} accessibilityIgnoresInvertColors style={StyleSheet.absoluteFill} />
    {/* A smooth scrim, clear at the top and dark under the name, drawn with
        react-native-svg so it needs no extra native module. */}
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" pointerEvents="none">
      <Defs>
        <LinearGradient id="heroScrim" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0e1018" stopOpacity={0.42} />
          <Stop offset="0.28" stopColor="#0e1018" stopOpacity={0} />
          <Stop offset="0.48" stopColor="#0e1018" stopOpacity={0.12} />
          <Stop offset="1" stopColor="#0e1018" stopOpacity={0.86} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroScrim)" />
    </Svg>
    </Animated.View>
    <Animated.View style={[{ flexDirection: "row", padding: 14, gap: 8 }, reveal]}>
      {communes.length > 1 ? <PressScale accessibilityRole="button" accessibilityLabel={`Commune: ${commune.name}. Change commune.`} onPress={() => router.push("/switch")} style={glass}>
        {frost}<View style={glassIn}><ChevronDown size={15} color="#fff" /><Text style={{ color: "#fff", fontSize: 13, fontWeight: "500" }}>Change</Text></View>
      </PressScale> : null}
      <View style={{ flex: 1 }} />
      <PressScale accessibilityRole="button" accessibilityLabel={`Announce something to ${commune.name}`} onPress={() => router.push("/announce")} style={[glass, { width: 36, paddingHorizontal: 0, justifyContent: "center" }]}>
        {frost}<View style={glassIn}><Megaphone size={15} color="#fff" /></View>
      </PressScale>
      <PressScale accessibilityRole="button" accessibilityLabel={`Invite people to ${commune.name}`} onPress={() => router.push("/members")} style={glass}>
        {frost}<View style={glassIn}><UsersRound size={15} color="#fff" /><Text style={{ color: "#fff", fontSize: 13, fontWeight: "500" }}>Invite</Text></View>
      </PressScale>
    </Animated.View>
    <View style={{ flex: 1 }} />
    <Animated.View style={[{ paddingHorizontal: 18, paddingBottom: 18, gap: 4 }, revealLate]}>
      <Text style={{ color: "rgba(255,255,255,0.86)", fontSize: 12.5, lineHeight: 17, fontWeight: "500" }}>{KIND_NAME[commune.kind]}{place ? ` · ${place}` : ""}</Text>
      <Text accessibilityRole="header" style={{ color: "#fff", fontSize: 28, lineHeight: 34, fontWeight: "600", letterSpacing: -0.6 }}>{commune.name}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 }}>
        <Faces names={members.map((member) => member.name)} size={24} ring="rgba(255,255,255,0.9)" />
        <Text style={{ color: "#fff", fontSize: 12.5 }}>{members.length} {members.length === 1 ? "person" : "people"}</Text>
      </View>
      <View style={{ alignSelf: "flex-start", marginTop: 8, backgroundColor: "rgba(250,248,244,0.94)", borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 }}>
        <Text style={{ color: "#1a1e2b", fontSize: 13, lineHeight: 17, fontWeight: "500" }}>{sentence}</Text>
      </View>
    </Animated.View>
  </View>;
}

/** Edge of the pill at a fractional tab position, between two measured buttons. */
function edge(boxes: number[], at: number, side: "left" | "right"): number {
  "worklet";
  const count = boxes.length / 2;
  if (!count) return 0;
  const clamped = Math.max(0, Math.min(count - 1, at));
  const a = Math.floor(clamped), b = Math.min(count - 1, a + 1), t = clamped - a;
  const pick = (i: number) => (side === "left" ? boxes[i * 2] : boxes[i * 2] + boxes[i * 2 + 1]);
  return pick(a) + (pick(b) - pick(a)) * t;
}

/** The four Hub tabs as pills, with one white pill that slides and stretches between them. */
function HubPills({ tab, onPick, left, right, floating }: {
  tab: HubTab; onPick(tab: HubTab): void; left: SharedValue<number>; right: SharedValue<number>; floating: boolean;
}) {
  const { c } = useTheme();
  const boxes = useSharedValue<number[]>([]);
  const [, setMeasured] = useState(0);
  const sizes = useRef<number[]>([]);
  const pill = useAnimatedStyle(() => {
    const l = edge(boxes.value, left.value, "left");
    const r = edge(boxes.value, right.value, "right");
    return { opacity: boxes.value.length ? 1 : 0, width: Math.max(0, r - l), transform: [{ translateX: l }] };
  });
  return <View style={floating
    ? { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, backgroundColor: c.canvas + "f2", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.outline }
    : { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, backgroundColor: c.canvas }}>
    <View accessibilityRole="tablist" style={{ flexDirection: "row", backgroundColor: c.recessed, borderRadius: 999, padding: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: c.outline }}>
      <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 4, bottom: 4, left: 0, borderRadius: 999, backgroundColor: c.surface, shadowColor: "#1a1e2b", shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 }, pill]} />
      {HUB_TABS.map((item, i) => {
        const on = item.id === tab;
        return <PressScale key={item.id} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={item.label}
          onLayout={(event) => {
            const { x, width } = event.nativeEvent.layout;
            sizes.current[i * 2] = x; sizes.current[i * 2 + 1] = width;
            if (sizes.current.filter((value) => value != null).length === HUB_TABS.length * 2) { boxes.value = [...sizes.current]; setMeasured((n) => n + 1); }
          }}
          onPress={() => onPick(item.id)}
          style={{ flex: 1, height: 40, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 15, fontWeight: on ? "600" : "500", color: on ? c.ink : c.ink2 }}>{item.label}</Text>
        </PressScale>;
      })}
    </View>
  </View>;
}

/** Where you stand here, and the one payment to record next. */
function YourPart({ onMore }: { onMore(): void }) {
  const { c } = useTheme();
  const router = useRouter();
  const { current, needs, waiting, resolveReport } = useApp();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!current) return null;
  const { commune } = current;
  const owe = oweTotals(needs, commune.id)[commune.currency] ?? 0;
  const owed = owedTotals(waiting, commune.id)[commune.currency] ?? 0;
  const shares = needs.filter((need) => need.communeId === commune.id && need.kind === "share");
  const first = shares[0]?.kind === "share" ? shares[0] : undefined;
  const confirms = waiting.filter((entry) => entry.communeId === commune.id).flatMap((entry) => entry.debtors.filter((debtor) => debtor.pending).map((debtor) => ({ entry, debtor })));
  const toConfirm = !first ? confirms[0] : undefined;
  async function confirm() {
    if (!toConfirm?.debtor.pending) return;
    setBusy(true);
    try {
      await resolveReport(commune.id, toConfirm.debtor.pending.id, "confirm");
      tap("success");
      toast(`Confirmed. ${firstName(toConfirm.debtor.name)}’s ${money(toConfirm.debtor.pending.amountMinor, commune.currency)} is recorded.`);
    } catch (cause) {
      toast(failure(cause, "Couldn’t confirm it. Try again."));
    } finally {
      setBusy(false);
    }
  }
  const big = { color: c.ink, fontSize: 25, lineHeight: 30, fontWeight: "500" as const, letterSpacing: -0.5 };
  // The amount sits in its own small white chip with rounded corners, as in v7.
  const chip = (amount: number) => <View style={{ backgroundColor: c.surface, borderRadius: 8, paddingHorizontal: 6, marginHorizontal: 6 }}><Rolling text={money(amount, commune.currency)} style={big} /></View>;
  return <View accessibilityLabel="Your part" style={{ backgroundColor: mix(c.settled, c.canvas, 0.55), borderRadius: 15, borderWidth: 1, borderColor: c.outline2, padding: 16, gap: 8 }}>
    <T kind="note" muted style={{ fontSize: 12.5, fontWeight: "600" }}>Your part in {commune.name}</T>
    <View accessibilityRole="header" style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}>
      {owe > 0 ? <><Text style={big}>You owe</Text>{chip(owe)}<Text style={big}>here.</Text></>
        : owed > 0 ? <><Text style={big}>You’re owed</Text>{chip(owed)}<Text style={big}>here.</Text></>
        : <Text style={big}>You’re all square here.</Text>}
    </View>
    <T kind="label" muted style={{ fontSize: 14, lineHeight: 20 }}>{hubMoneyLine(owe, owed, commune.currency)}</T>
    {first ? <View style={{ backgroundColor: c.surface, borderRadius: 12, padding: 12, gap: 10 }}>
      <PressScale scaleTo={0.985} accessibilityRole="button" onPress={() => router.push(`/expense/${first.expenseId}`)} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T kind="body" style={{ fontSize: 14, fontWeight: "500" }}>{first.title}</T>
          <View style={{ flexDirection: "row", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <T kind="label" muted>You owe {firstName(first.payerName)}</T>
            <State text={first.status.text} tone={first.status.tone} />
          </View>
        </View>
        <T kind="amount" style={{ fontSize: 19, lineHeight: 24 }}>{money(first.amountMinor, first.currency)}</T>
      </PressScale>
      <PayPrimary size="md" target={{ shareId: first.shareId, communeId: first.communeId, payerId: first.payerId, payerName: first.payerName, amountMinor: first.amountMinor, currency: first.currency, title: first.title }} />
      {shares.length > 1 ? <TextLink centred label={`${shares.length - 1} more to settle`} onPress={onMore} /> : null}
    </View> : toConfirm?.debtor.pending ? <View style={{ backgroundColor: c.surface, borderRadius: 12, padding: 12, gap: 10 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <T kind="body" style={{ fontSize: 15, fontWeight: "500" }}>{toConfirm.entry.title}</T>
          <T kind="label" muted>{firstName(toConfirm.debtor.name)} says they sent it</T>
        </View>
        <T kind="amount" style={{ fontSize: 19, lineHeight: 24 }}>{money(toConfirm.debtor.pending.amountMinor, commune.currency)}</T>
      </View>
      <Button block busy={busy} label={`Confirm ${money(toConfirm.debtor.pending.amountMinor, commune.currency)} received`} onPress={() => void confirm()} />
      <TextLink label="Not received" onPress={() => router.push("/settle")} />
    </View> : null}
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
      <Button variant="secondary" label="Add expense" icon={<Plus size={15} color={c.ink} />} onPress={() => router.push("/add-expense")} />
      <TextLink label="View settlement" onPress={() => router.push("/settle")} />
      {first && confirms.length ? <T kind="label" muted>{confirms.length} to confirm</T> : null}
    </View>
  </View>;
}

/**
 * v7's week: a strip of day buttons (Late, then the next seven days) with dots
 * for what is on, and the chosen day's chores and bills as chips below.
 */
function WeekPanel({ onAll }: { onAll(): void }) {
  const { c } = useTheme();
  const { current, user, today } = useApp();
  const [picked, setPicked] = useState<string | null>(null);
  if (!current) return null;
  const viewerId = user?.id ?? "";
  const value = week(current, viewerId, today);
  const empty = !value.late.length && value.days.every((day) => !day.items.length);
  const chosen = picked ?? (value.late.length ? "late" : today);
  const items = chosen === "late" ? value.late : value.days.find((day) => day.date === chosen)?.items ?? [];
  const label = chosen === "late" ? "late" : chosen === today ? "today" : chosen === addDays(today, 1) ? "tomorrow" : "on this day";
  return <View style={{ gap: 12 }}>
    <SectionHead title="This week" right={<TextLink label="All chores" onPress={onAll} />} />
    {empty ? <Panel><Empty icon={<Check size={18} color={c.onSettled} />} title="Nothing planned for this week" body="Tasks, events and bills due will show here." /></Panel> : <>
      <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 4 }}>
        {value.late.length ? <WeekDay late on={chosen === "late"} top="Late" big={String(value.late.length)} dots={Math.min(3, value.late.length)} onPress={() => setPicked("late")} /> : null}
        {value.days.map((day) => {
          const parts = calParts(day.date, today);
          return <WeekDay key={day.date} today={day.date === today} on={chosen === day.date} top={parts.dow} big={parts.day} dots={Math.min(3, day.items.length)} onPress={() => setPicked(day.date)} />;
        })}
      </View>
      <View style={{ gap: 6 }}>
        {items.length ? items.map((item) => <WeekChip key={item.key} item={item} late={chosen === "late"} />)
          : <T kind="label" muted style={{ paddingHorizontal: 4, paddingVertical: 6 }}>Nothing {label}.</T>}
      </View>
    </>}
  </View>;
}

function WeekDay({ top, big, dots, on, today, late, onPress }: { top: string; big: string; dots: number; on: boolean; today?: boolean; late?: boolean; onPress(): void }) {
  const { c } = useTheme();
  const ink = on ? c.onFrame : late ? c.late : c.ink;
  return <PressScale accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={late ? `Late, ${big}` : `${top} ${big}${dots ? `, ${dots} on` : ""}`} onPress={() => { haptic.select(); onPress(); }}
    scaleTo={0.94} style={{ flex: 1, minHeight: 64, paddingTop: 7, paddingBottom: 6, borderRadius: 12, alignItems: "center", gap: 2,
      backgroundColor: on ? c.frame : c.surface, borderWidth: today && !on ? 1.5 : 1, borderColor: on ? c.frame : today ? c.action : c.outline2 }}>
    <Text style={{ fontSize: 10.5, lineHeight: 14, fontWeight: "600", color: on ? c.onFrame2 : late ? c.late : c.ink2 }}>{top}</Text>
    <Text style={{ fontSize: 17, lineHeight: 22, fontWeight: "700", letterSpacing: -0.35, color: ink }}>{big}</Text>
    <View style={{ flexDirection: "row", gap: 3, height: 5 }}>
      {Array.from({ length: dots }, (_, i) => <View key={i} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: on ? c.onFrame2 : late ? c.late : c.ink2 }} />)}
    </View>
  </PressScale>;
}

/** One chore, event or bill as a chip. A chore carries its tick; a bill sits on a clear chip with its icon. */
function WeekChip({ item, late }: { item: WeekItem; late?: boolean }) {
  const { c } = useTheme();
  const bill = item.kind === "bill";
  return <View style={{ borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: bill ? c.outline : c.outline2, backgroundColor: bill ? "transparent" : late ? c.lateSoft : c.surface }}>
    <WeekRow item={item} late={late} chip />
  </View>;
}


function WeekRow({ item, late, chip }: { item: WeekItem; late?: boolean; chip?: boolean }) {
  const { c } = useTheme();
  const router = useRouter();
  const { current, user } = useApp();
  if (!current) return null;
  if (item.kind === "task" && item.operation) {
    const who = item.mine ? "You" : item.who;
    return <TaskCheck communeId={current.commune.id} operationId={item.operation.id} date={item.operation.date} title={item.title}
      assigneeId={item.assigneeId} assigneeName={item.assigneeId === user?.id ? user?.name ?? "You" : current.members.find((member) => member.userId === item.assigneeId)?.name ?? item.who}
      first={chip} late={late} meta={late ? `${who} · late` : item.assigneeId ? who : "Nobody yet"} />;
  }
  const bill = item.kind === "bill";
  const meta = bill
    ? `Bill due · ${money(item.amountMinor ?? 0, item.currency)}${item.yourShareMinor ? ` · your share ${money(item.yourShareMinor, item.currency)}` : item.mine ? " · you paid it" : ""}`
    : [item.operation?.time ? item.operation.time.slice(0, 5) : "", item.assigneeId ? item.who : ""].filter(Boolean).join(" · ") || "Event";
  const Icon = bill ? ReceiptText : CalendarDays;
  return <PressScale scaleTo={0.985} accessibilityRole="button" accessibilityLabel={`${item.title}. ${meta}`}
    onPress={() => (bill ? router.push(`/expense/${item.expenseId}`) : router.push("/tasks"))}
    style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: chip ? 10 : 12, minHeight: chip ? 52 : undefined, paddingVertical: chip ? 6 : 10, paddingHorizontal: chip ? 10 : 16, backgroundColor: pressed ? c.press : "transparent" })}>
    <View style={{ width: 28, height: 28, borderRadius: chip ? 8 : 14, backgroundColor: c.recessed, alignItems: "center", justifyContent: "center" }}><Icon size={15} color={c.ink2} /></View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <T kind="body" style={chip ? { fontSize: 14, lineHeight: 19, fontWeight: "500" } : { fontSize: 15, lineHeight: 21, fontWeight: "500" }}>{item.title}</T>
      <T kind="label" muted style={chip ? { fontSize: 12.5, lineHeight: 17 } : undefined}>{meta}</T>
    </View>
  </PressScale>;
}

/** Each person's balance with you here, and what they have on next. */
function PeoplePanel() {
  const { c } = useTheme();
  const router = useRouter();
  const { current, user, today } = useApp();
  if (!current) return null;
  const lines = people(current, user?.id ?? "", today);
  return <View style={{ gap: 12 }}>
    <SectionHead title="People" right={<TextLink label="Members" onPress={() => router.push("/members")} />} />
    <Panel>{lines.map((line, index) => <PressScale scaleTo={0.985} key={line.userId} accessibilityRole="button" accessibilityLabel={`${line.name}. ${line.balance}. ${line.job}.`}
      onPress={() => router.push("/settle")}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 16, borderTopWidth: index ? StyleSheet.hairlineWidth : 0, borderTopColor: c.outline, backgroundColor: pressed ? c.press : "transparent" })}>
      <Avatar name={line.isYou ? user?.name ?? "You" : line.name} size={36} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T kind="body" style={{ fontSize: 15, fontWeight: "500" }}>{line.name}</T>
        <T kind="label" muted lines={1}>{line.job}</T>
      </View>
      <T kind="label" color={line.coming ? c.action : c.ink} style={{ fontWeight: "600" }}>{line.balance}</T>
    </PressScale>)}</Panel>
  </View>;
}

/** The details people look up, with the facts in place. Passwords and codes stay hidden until asked for. */
function Essentials() {
  const { current } = useApp();
  if (!current) return null;
  const items = essentials(current, 8);
  return <View style={{ gap: 12 }}>
    <SectionHead title="Shared essentials" count={items.length} />
    {items.length ? items.map((item) => <EssentialCard key={item.id} item={item} />)
      : <Panel pad><T kind="body" muted>Nothing written down in {current.commune.name} yet.</T></Panel>}
    <T kind="label" muted style={{ paddingHorizontal: 4 }}>Only people in {current.commune.name} can see these. Passwords and codes stay hidden until you tap Show.</T>
    <AddButton label="Add a note" href="/add-note" />
  </View>;
}

/** Every note, in full, under the essentials. */
function NotesList() {
  const router = useRouter();
  const { current } = useApp();
  const notes = current?.notes ?? [];
  if (!notes.length) return null;
  return <View style={{ gap: 12 }}>
    <SectionHead title="All notes" count={notes.length} right={<TextLink label="Open" onPress={() => router.push("/notes")} />} />
    <Panel>{notes.map((note, index) => <Row key={note.id} first={index === 0} onPress={() => router.push("/notes")} title={note.title}
      meta={note.lede || note.body ? <T kind="label" muted lines={1}>{note.lede || note.body}</T> : undefined} />)}</Panel>
  </View>;
}

/** What you owe in this commune, oldest first, each with its way to pay. */
function OweHere() {
  const { c } = useTheme();
  const { current, needs } = useApp();
  if (!current) return null;
  const mine = needs.filter((need) => need.communeId === current.commune.id && need.kind === "share");
  const total = oweTotals(mine, current.commune.id)[current.commune.currency] ?? 0;
  return <View style={{ gap: 12 }}>
    <SectionHead title="You owe here" right={mine.length ? <T kind="label" muted>{mine.length} · {money(total, current.commune.currency)}</T> : undefined} />
    <Panel>{mine.length ? <NeedsList items={mine} />
      : <Empty icon={<Check size={18} color={c.onSettled} />} title="Nothing to pay here" body={`Every bill you share in ${current.commune.name} is recorded.`} />}</Panel>
  </View>;
}

/** What people here owe you, with confirm and nudge in place. */
function OwedHere() {
  const { c } = useTheme();
  const { current, waiting } = useApp();
  if (!current) return null;
  const mine = waiting.filter((entry) => entry.communeId === current.commune.id);
  const total = owedTotals(mine, current.commune.id)[current.commune.currency] ?? 0;
  return <View style={{ gap: 12 }}>
    <SectionHead title="Owed to you here" right={mine.length ? <T kind="label" muted>{money(total, current.commune.currency)}</T> : undefined} />
    <Panel>{mine.length ? mine.map((entry, index) => <WaitingRow key={entry.key} entry={entry} first={index === 0} />)
      : <Empty icon={<Check size={18} color={c.onSettled} />} title="Nobody owes you here" />}</Panel>
  </View>;
}

function MoneyActions() {
  const { c } = useTheme();
  const router = useRouter();
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
    <Button label="Add expense" icon={<Plus size={15} color={c.onAction} />} onPress={() => router.push("/add-expense")} />
    <TextLink label="All expenses" onPress={() => router.navigate("/expenses")} />
    <TextLink label="Settlement" onPress={() => router.navigate("/settle")} />
  </View>;
}

/** Recurring bills, saved splits and shared pots, a tap away. */
function MoneyMore() {
  const { c } = useTheme();
  const router = useRouter();
  const { current } = useApp();
  if (!current) return null;
  const bills = current.recurringBills ?? [];
  const templates = (current.splitTemplates ?? []).filter((item) => !item.archivedAt);
  const funds = current.funds.filter((fund) => !fund.archivedAt);
  const rows: Array<{ icon: typeof Repeat2; label: string; sub: string; href: Href }> = [
    { icon: Repeat2, label: "Recurring", href: "/recurring", sub: bills.length ? joinAnd(bills.slice(0, 3).map((bill) => bill.title)) : "Nothing repeats here" },
    { icon: Files, label: "Templates", href: "/templates", sub: templates.length ? `${templates.length} saved ${templates.length === 1 ? "split" : "splits"}` : "None saved yet" },
    { icon: ShoppingBag, label: "Funds", href: "/funds", sub: funds.length ? `${funds.length} shared ${funds.length === 1 ? "pot" : "pots"}` : "No shared pots yet" },
  ];
  return <Panel>{rows.map((row, index) => <Row key={row.label} first={index === 0} onPress={() => router.push(row.href)}
    left={<View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: c.recessed, alignItems: "center", justifyContent: "center" }}><row.icon size={17} color={c.ink} /></View>}
    title={row.label} meta={<T kind="label" muted lines={1}>{row.sub}</T>} right={<ChevronRight size={17} color={c.ink2} />} />)}</Panel>;
}

/** v7's secondary "+ Add …" button, the same on every tab. */
function AddButton({ label, href }: { label: string; href: Href }) {
  const { c } = useTheme();
  const router = useRouter();
  return <Button variant="secondary" block label={label} icon={<Plus size={16} color={c.ink} />} onPress={() => router.push(href)} />;
}

/** The latest announcement, at the top of the Overview, until it is a fortnight old. */
function Notice() {
  const { c } = useTheme();
  const { current, today } = useApp();
  const latest = (current?.announcements ?? [])[0];
  if (!current || !latest || latest.createdAt.slice(0, 10) < addDays(today, -14)) return null;
  const author = current.members.find((member) => member.userId === latest.authorId)?.name ?? "Someone";
  return <View accessibilityLabel="Announcement" style={{ flexDirection: "row", gap: 12, padding: 14, borderRadius: 15, backgroundColor: c.surface, borderWidth: 1, borderColor: c.outline2 }}>
    <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: c.recessed, alignItems: "center", justifyContent: "center" }}><Megaphone size={17} color={c.ink} /></View>
    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
      <T kind="body" style={{ fontSize: 15, fontWeight: "600" }}>{latest.title}</T>
      {latest.body ? <T kind="label" muted>{latest.body}</T> : null}
      <T kind="note" muted>{firstName(author)} · {latest.createdAt.slice(0, 10) === today ? "today" : `${calParts(latest.createdAt.slice(0, 10), today).day} ${calParts(latest.createdAt.slice(0, 10), today).mon}`}</T>
    </View>
  </View>;
}

/**
 * v7's Chores tab: each day as a row, its calendar on the left and that day's
 * chores stacked as chips on the right, late ones first. Then the rota, and
 * a button to add a chore.
 */
function ChoresPage() {
  const { c } = useTheme();
  const router = useRouter();
  const { current, user, today } = useApp();
  if (!current) return null;
  const value = week(current, user?.id ?? "", today);
  const late = value.late;
  const days = value.days.map((day) => ({ ...day, items: day.items.filter((item) => item.kind === "task") })).filter((day) => day.items.length);
  const count = late.length + days.reduce((sum, day) => sum + day.items.length, 0);
  const rotas = (current.operations ?? []).filter((item) => item.kind === "task" && item.status === "open" && (item.rotationIds?.length ?? 0) > 1);
  const nameOf = (id: string) => (id === user?.id ? "you" : firstName(current.members.find((member) => member.userId === id)?.name ?? "someone"));
  return <View style={{ gap: 22 }}>
    <View style={{ gap: 12 }}>
      <SectionHead title="This week" count={count} right={<TextLink label="All tasks" onPress={() => router.push("/tasks")} />} />
      {!count ? <Panel><Empty icon={<Check size={18} color={c.onSettled} />} title="No chores left this week" /></Panel> : <View style={{ gap: 6 }}>
        {late.length ? <DayRow left={<View style={{ width: 44, minHeight: 50, borderRadius: 10, backgroundColor: c.lateSoft, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 10.5, fontWeight: "600", color: c.late }}>Late</Text><Text style={{ fontSize: 17, lineHeight: 22, fontWeight: "700", color: c.late }}>{late.length}</Text></View>}>
          {late.map((item) => <WeekChip key={item.key} item={item} late />)}
        </DayRow> : null}
        {days.map((day) => <DayRow key={day.date} left={<Cal iso={day.date} today={today} small />}>
          {day.items.map((item) => <WeekChip key={item.key} item={item} />)}
        </DayRow>)}
      </View>}
    </View>
    {rotas.length ? <View style={{ gap: 12 }}>
      <SectionHead title="Rota" />
      <Panel>{rotas.map((item, index) => {
        const ids = item.rotationIds ?? [];
        const at = Math.max(0, ids.indexOf(item.assigneeId ?? ""));
        const next = [ids[at], ids[(at + 1) % ids.length]].map(nameOf);
        return <Row key={item.id} first={index === 0} title={item.title}
          meta={<T kind="label" muted>{item.repeat === "monthly" ? "Monthly" : item.repeat === "weekly" ? "Weekly" : "Once"} · next: {next[0]}, then {next[1]}</T>}
          right={<Faces names={ids.map((id) => (id === user?.id ? user?.name ?? "You" : current.members.find((member) => member.userId === id)?.name ?? "?"))} size={24} />} />;
      })}</Panel>
    </View> : null}
    <AddButton label="Add a chore" href="/add-chore" />
  </View>;
}

function DayRow({ left, children }: { left: ReactNode; children: ReactNode }) {
  return <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start", paddingVertical: 4 }}>
    {left}
    <View style={{ flex: 1, minWidth: 0, gap: 6 }}>{children}</View>
  </View>;
}

function EssentialCard({ item }: { item: Essential }) {
  const { c } = useTheme();
  const toast = useToast();
  const [shown, setShown] = useState(false);
  const secrets = item.facts.filter((fact) => fact.secret);
  const phone = item.facts.find((fact) => fact.phone);
  async function copy() {
    const text = (secrets[0] ?? item.facts[0])?.value ?? "";
    if (!text) return;
    await Clipboard.setStringAsync(text);
    tap();
    toast(`Copied ${(secrets[0] ?? item.facts[0])?.label.toLowerCase()}.`);
  }
  // v7's note card: title, then a grid of labels (84 px) and values; secrets
  // show as dots until asked for, then in a fixed-width face.
  const mono = Platform.OS === "ios" ? "Menlo" : "monospace";
  return <View style={{ backgroundColor: c.surface, borderRadius: 15, borderWidth: 1, borderColor: c.outline2, paddingVertical: 14, paddingHorizontal: 16, gap: 10 }}>
    <T kind="strong" style={{ fontSize: 16, fontWeight: "600" }}>{item.title}</T>
    {item.facts.length ? <View style={{ gap: 6 }}>{item.facts.map((fact) => <View key={fact.label} style={{ flexDirection: "row", gap: 10 }}>
      <Text style={{ width: 84, fontSize: 14, lineHeight: 20, color: c.ink2 }}>{fact.label}</Text>
      <Text style={fact.secret && shown ? { flex: 1, fontFamily: mono, fontSize: 13.5, lineHeight: 20, color: c.ink } : { flex: 1, fontSize: 14, lineHeight: 20, color: c.ink, letterSpacing: fact.secret ? 1.1 : 0 }}>{fact.secret && !shown ? "••••••••" : fact.value}</Text>
    </View>)}</View> : <T kind="label" muted style={{ fontSize: 14, lineHeight: 20 }}>{item.summary}</T>}
    {secrets.length || phone ? <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
      {secrets.length ? <>
        <Button size="sm" variant="secondary" label={shown ? "Hide" : "Show"} accessibilityLabel={`${shown ? "Hide" : "Show"} ${item.title} ${secrets[0].label.toLowerCase()}`}
          icon={shown ? <EyeOff size={14} color={c.ink} /> : <Eye size={14} color={c.ink} />} onPress={() => setShown(!shown)} />
        <Button size="sm" variant="secondary" label="Copy" accessibilityLabel={`Copy ${item.title} ${secrets[0].label.toLowerCase()}`} icon={<Copy size={14} color={c.ink} />} onPress={() => void copy()} />
      </> : null}
      {phone ? <Button size="sm" variant="secondary" label={`Call ${phone.label.toLowerCase()}`} icon={<Phone size={14} color={c.ink} />}
        onPress={() => void Linking.openURL(`tel:${phone.value.replace(/[^\d+]/g, "")}`)} /> : null}
    </View> : null}
  </View>;
}

/** Mixes two #rrggbb colours: `amount` of the first, the rest of the second. */
function mix(a: string, b: string, amount: number): string {
  const parse = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  if (!/^#[0-9a-f]{6}$/i.test(a) || !/^#[0-9a-f]{6}$/i.test(b)) return a;
  const [x, y] = [parse(a), parse(b)];
  return `#${x.map((v, i) => Math.round(v * amount + y[i] * (1 - amount)).toString(16).padStart(2, "0")).join("")}`;
}
