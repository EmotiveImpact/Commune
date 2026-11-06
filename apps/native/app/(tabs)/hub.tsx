import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { ImageBackground, Linking, Pressable, RefreshControl, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRouter, type Href } from "expo-router";
import * as Clipboard from "expo-clipboard";
import Animated, { interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming, Extrapolation, type SharedValue } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { CalendarDays, Check, ChevronDown, ChevronRight, Copy, Eye, EyeOff, Files, Phone, Plus, ReceiptText, Repeat2, ShoppingBag, UsersRound } from "lucide-react-native";
import {
  activeMembers, essentials, hubMoneyLine, oweTotals, owedTotals, people, week, weekSentence,
  type Essential, type WeekItem,
} from "../../src/lib/derive";
import { addDays, calParts, firstName, joinAnd, money } from "../../src/lib/format";
import { usePrefs } from "../../src/prefs";
import { failure, useApp } from "../../src/state";
import { Body, Ground, Pad, PULL_SHOWN, TopBar, photoOf, usePull } from "../../src/ui/chrome";
import { Avatar, Button, Cal, Empty, Faces, Panel, Row, SectionHead, State, T, tap } from "../../src/ui/kit";
import { haptic, PressScale, springs, useCalm } from "../../src/ui/motion";
import { NeedsList, TaskCheck, WaitingRow } from "../../src/ui/parts";
import { PayPrimary } from "../../src/ui/pay";
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
    const forward = to > left.value;
    if (calm) { left.value = withTiming(to, { duration: 180 }); right.value = withTiming(to, { duration: 180 }); return; }
    // The leading edge moves on the snappy spring and the trailing edge on the smooth one, so the pill stretches as it travels.
    left.value = withSpring(to, forward ? springs.smooth : springs.snappy);
    right.value = withSpring(to, forward ? springs.snappy : springs.smooth);
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
    const amount = Math.abs(f), lead = Math.min(1, amount * 1.3), trail = Math.max(0, (amount - 0.3) / 0.7);
    const forward = j > i;
    left.value = i + (j - i) * (forward ? trail : lead);
    right.value = i + (j - i) * (forward ? lead : trail);
  }).onEnd((event) => {
    const i = at.value;
    const f = -event.translationX / width;
    let to = i;
    if (f > 0.22 || event.velocityX < -600) to = Math.min(HUB_TABS.length - 1, i + 1);
    else if (f < -0.22 || event.velocityX > 600) to = Math.max(0, i - 1);
    pager.value = calm ? withTiming(-to * width, { duration: 200 }) : withSpring(-to * width, { ...springs.smooth, velocity: event.velocityX });
    movePill(to);
    if (to !== i) { at.value = to; runOnJS(landed)(to); }
  });
  const track = useAnimatedStyle(() => ({ transform: [{ translateX: pager.value }] }));

  if (!current) return <View style={{ flex: 1 }}><TopBar title="Hub" /><Body><Pad><T kind="body" muted>You’re not in a commune yet.</T></Pad></Body></View>;
  const pills = <HubPills tab={tab} onPick={(next) => choose(next)} left={left} right={right} floating={hubTabsAt === "bottom"} />;
  const pages: Record<HubTab, ReactNode[]> = {
    overview: [<YourPart key="part" onMore={() => choose("money")} />, <WeekPanel key="week" onAll={() => choose("chores")} />, <PeoplePanel key="people" />],
    money: moneySections(),
    chores: [<ChoresPage key="chores" />],
    notes: [<Essentials key="essentials" />, <NotesList key="notes" />],
  };
  return <View style={{ flex: 1, backgroundColor: c.canvas }}>
    <TopBar title="Hub" />
    <Animated.ScrollView onScroll={pull.onScroll} scrollEventThrottle={16} style={{ flex: 1 }}
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
const HERO_HEIGHT = 290;
const HERO_GROUND = "#262b3a";

function Hero({ scrollY }: { scrollY: SharedValue<number> }) {
  const router = useRouter();
  // Pulled past the top, the photo grows from its bottom edge to fill the
  // gap, like a music app's album header, instead of showing a blank band.
  const stretch = useAnimatedStyle(() => {
    const gap = Math.max(0, -scrollY.value) * PULL_SHOWN;
    return { transform: [{ translateY: -gap / 2 }, { scale: interpolate(gap, [0, HERO_HEIGHT], [1, 2], Extrapolation.EXTEND) }] };
  });
  const { current, communes, user, today } = useApp();
  if (!current) return null;
  const { commune } = current;
  const members = activeMembers(current);
  const place = commune.address || commune.destination || "";
  const sentence = weekSentence(week(current, user?.id ?? "", today));
  const glass = { flexDirection: "row" as const, alignItems: "center" as const, gap: 6, height: 36, paddingHorizontal: 13, borderRadius: 18, backgroundColor: "rgba(20,22,30,0.42)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.35)" };
  return <View style={{ height: HERO_HEIGHT, backgroundColor: HERO_GROUND }}>
    <Ground color={HERO_GROUND} />
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, stretch]}>
    <ImageBackground source={{ uri: photoOf(commune.kind) }} accessibilityIgnoresInvertColors style={StyleSheet.absoluteFill} />
    {/* A smooth scrim, clear at the top and dark under the name, drawn with
        react-native-svg so it needs no extra native module. */}
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" pointerEvents="none">
      <Defs>
        <LinearGradient id="heroScrim" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0e1018" stopOpacity={0.3} />
          <Stop offset="0.3" stopColor="#0e1018" stopOpacity={0.05} />
          <Stop offset="0.55" stopColor="#0e1018" stopOpacity={0.25} />
          <Stop offset="1" stopColor="#0e1018" stopOpacity={0.82} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroScrim)" />
    </Svg>
    </Animated.View>
    <View style={{ flexDirection: "row", padding: 14, gap: 8 }}>
      {communes.length > 1 ? <PressScale accessibilityRole="button" accessibilityLabel={`Commune: ${commune.name}. Change commune.`} onPress={() => router.push("/switch")} style={glass}>
        <ChevronDown size={15} color="#fff" /><Text style={{ color: "#fff", fontSize: 14, fontWeight: "500" }}>Change</Text>
      </PressScale> : null}
      <View style={{ flex: 1 }} />
      <PressScale accessibilityRole="button" accessibilityLabel={`Invite people to ${commune.name}`} onPress={() => router.push("/members")} style={glass}>
        <UsersRound size={15} color="#fff" /><Text style={{ color: "#fff", fontSize: 14, fontWeight: "500" }}>Invite</Text>
      </PressScale>
    </View>
    <View style={{ flex: 1 }} />
    <View style={{ paddingHorizontal: 18, paddingBottom: 18, gap: 4 }}>
      <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "500" }}>{KIND_NAME[commune.kind]}{place ? ` · ${place}` : ""}</Text>
      <Text accessibilityRole="header" style={{ color: "#fff", fontSize: 30, lineHeight: 36, fontWeight: "600", letterSpacing: -0.6 }}>{commune.name}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 }}>
        <Faces names={members.map((member) => member.name)} size={26} ring="rgba(255,255,255,0.9)" />
        <Text style={{ color: "#fff", fontSize: 13.5 }}>{members.length} {members.length === 1 ? "person" : "people"}</Text>
      </View>
      <View style={{ alignSelf: "flex-start", marginTop: 8, backgroundColor: "rgba(255,255,255,0.92)", borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 }}>
        <Text style={{ color: "#1a1e2b", fontSize: 13.5, fontWeight: "500" }}>{sentence}</Text>
      </View>
    </View>
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
        return <Pressable key={item.id} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={item.label}
          onLayout={(event) => {
            const { x, width } = event.nativeEvent.layout;
            sizes.current[i * 2] = x; sizes.current[i * 2 + 1] = width;
            if (sizes.current.filter((value) => value != null).length === HUB_TABS.length * 2) { boxes.value = [...sizes.current]; setMeasured((n) => n + 1); }
          }}
          onPress={() => onPick(item.id)}
          style={{ flex: 1, height: 40, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 15, fontWeight: on ? "600" : "500", color: on ? c.ink : c.ink2 }}>{item.label}</Text>
        </Pressable>;
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
  return <View accessibilityLabel="Your part" style={{ backgroundColor: c.settled + "99", borderRadius: radius.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: c.outline, padding: 16, gap: 10 }}>
    <T kind="note" muted style={{ fontWeight: "600", letterSpacing: 0.7, textTransform: "uppercase" }}>Your part in {commune.name}</T>
    <Text accessibilityRole="header" style={{ color: c.ink, fontSize: 24, lineHeight: 30, fontWeight: "500", letterSpacing: -0.4 }}>
      {owe > 0 ? <>You owe <Text style={{ color: c.ink, backgroundColor: c.surface }}> {money(owe, commune.currency)} </Text> here.</>
        : owed > 0 ? <>You’re owed <Text style={{ backgroundColor: c.surface }}> {money(owed, commune.currency)} </Text> here.</>
        : "You’re all square here."}
    </Text>
    <T kind="label" muted>{hubMoneyLine(owe, owed, commune.currency)}</T>
    {first ? <View style={{ backgroundColor: c.surface, borderRadius: 12, padding: 12, gap: 10 }}>
      <Pressable accessibilityRole="button" onPress={() => router.push(`/expense/${first.expenseId}`)} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T kind="body" style={{ fontSize: 15, fontWeight: "500" }}>{first.title}</T>
          <View style={{ flexDirection: "row", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <T kind="label" muted>You owe {firstName(first.payerName)}</T>
            <State text={first.status.text} tone={first.status.tone} />
          </View>
        </View>
        <T kind="amount" style={{ fontSize: 19, lineHeight: 24 }}>{money(first.amountMinor, first.currency)}</T>
      </Pressable>
      <PayPrimary size="md" target={{ shareId: first.shareId, communeId: first.communeId, payerId: first.payerId, payerName: first.payerName, amountMinor: first.amountMinor, currency: first.currency, title: first.title }} />
      {shares.length > 1 ? <Button variant="quiet" size="sm" label={`${shares.length - 1} more to settle`} onPress={onMore} /> : null}
    </View> : toConfirm?.debtor.pending ? <View style={{ backgroundColor: c.surface, borderRadius: 12, padding: 12, gap: 10 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <T kind="body" style={{ fontSize: 15, fontWeight: "500" }}>{toConfirm.entry.title}</T>
          <T kind="label" muted>{firstName(toConfirm.debtor.name)} says they sent it</T>
        </View>
        <T kind="amount" style={{ fontSize: 19, lineHeight: 24 }}>{money(toConfirm.debtor.pending.amountMinor, commune.currency)}</T>
      </View>
      <Button block busy={busy} label={`Confirm ${money(toConfirm.debtor.pending.amountMinor, commune.currency)} received`} onPress={() => void confirm()} />
      <Button variant="quiet" size="sm" label="Not received" onPress={() => router.push("/settle")} />
    </View> : null}
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <Button variant="secondary" size="sm" label="Add expense" icon={<Plus size={15} color={c.ink} />} onPress={() => router.push("/add-expense")} />
      <Button variant="quiet" size="sm" label="View settlement" onPress={() => router.push("/settle")} />
      {first && confirms.length ? <T kind="label" muted>{confirms.length} to confirm</T> : null}
    </View>
  </View>;
}

/** Late jobs first, then each day of the week that has something on it. Free days are left out. */
function WeekPanel({ onAll }: { onAll(): void }) {
  const { c } = useTheme();
  const { current, user, today } = useApp();
  if (!current) return null;
  const viewerId = user?.id ?? "";
  const value = week(current, viewerId, today);
  const days = value.days.filter((day, index) => index === 0 || day.items.length);
  const empty = !value.late.length && value.days.every((day) => !day.items.length);
  return <View style={{ gap: 12 }}>
    <SectionHead title="This week" right={<Button variant="quiet" size="sm" label="All chores" onPress={onAll} />} />
    <Panel>
      {empty ? <Empty icon={<Check size={18} color={c.onSettled} />} title="Nothing planned for this week" body="Tasks, events and bills due will show here." /> : <>
        {value.late.length ? <DayHead first label="Late" count={value.late.length} late /> : null}
        {value.late.map((item) => <WeekRow key={item.key} item={item} late />)}
        {days.map((day, index) => <View key={day.date}>
          <DayHead first={!value.late.length && index === 0} date={day.date} label={day.date === today ? "Today" : day.date === addDays(today, 1) ? "Tomorrow" : undefined} />
          {day.items.length ? day.items.map((item) => <WeekRow key={item.key} item={item} />)
            : <T kind="label" muted style={{ paddingHorizontal: 16, paddingBottom: 12 }}>Nothing today.</T>}
        </View>)}
      </>}
    </Panel>
  </View>;
}

function DayHead({ date, label, count, late, first }: { date?: string; label?: string; count?: number; late?: boolean; first?: boolean }) {
  const { c } = useTheme();
  const { today } = useApp();
  const parts = date ? calParts(date, today) : null;
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 12, paddingBottom: 4, paddingHorizontal: 16, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth, borderTopColor: c.outline }}>
    {date ? <Cal iso={date} today={today} small /> : null}
    <Text accessibilityRole="header" style={{ fontSize: 13, fontWeight: "600", color: late ? c.late : c.ink }}>
      {label ?? `${parts?.dow} ${parts?.day} ${parts?.mon}`}{count != null ? <Text style={{ color: c.ink2, fontWeight: "500" }}>  {count}</Text> : null}
    </Text>
  </View>;
}

function WeekRow({ item, late }: { item: WeekItem; late?: boolean }) {
  const { c } = useTheme();
  const router = useRouter();
  const { current, user } = useApp();
  if (!current) return null;
  if (item.kind === "task" && item.operation) {
    const who = item.mine ? "You" : item.who;
    return <TaskCheck communeId={current.commune.id} operationId={item.operation.id} date={item.operation.date} title={item.title}
      assigneeId={item.assigneeId} assigneeName={item.assigneeId === user?.id ? user?.name ?? "You" : current.members.find((member) => member.userId === item.assigneeId)?.name ?? item.who}
      late={late} meta={late ? `${who} · late` : item.assigneeId ? who : "Nobody yet · tick it to take it"} />;
  }
  const bill = item.kind === "bill";
  const meta = bill
    ? `Bill due · ${money(item.amountMinor ?? 0, item.currency)}${item.yourShareMinor ? ` · your share ${money(item.yourShareMinor, item.currency)}` : item.mine ? " · you paid it" : ""}`
    : [item.operation?.time ? item.operation.time.slice(0, 5) : "", item.assigneeId ? item.who : ""].filter(Boolean).join(" · ") || "Event";
  const Icon = bill ? ReceiptText : CalendarDays;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${item.title}. ${meta}`}
    onPress={() => (bill ? router.push(`/expense/${item.expenseId}`) : router.push("/tasks"))}
    style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: pressed ? c.press : "transparent" })}>
    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.recessed, alignItems: "center", justifyContent: "center" }}><Icon size={15} color={c.ink2} /></View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <T kind="body" style={{ fontSize: 15, lineHeight: 21, fontWeight: "500" }}>{item.title}</T>
      <T kind="label" muted>{meta}</T>
    </View>
  </Pressable>;
}

/** Each person's balance with you here, and what they have on next. */
function PeoplePanel() {
  const { c } = useTheme();
  const router = useRouter();
  const { current, user, today } = useApp();
  if (!current) return null;
  const lines = people(current, user?.id ?? "", today);
  return <View style={{ gap: 12 }}>
    <SectionHead title="People" right={<Button variant="quiet" size="sm" label="Members" onPress={() => router.push("/members")} />} />
    <Panel>{lines.map((line, index) => <Pressable key={line.userId} accessibilityRole="button" accessibilityLabel={`${line.name}. ${line.balance}. ${line.job}.`}
      onPress={() => router.push("/settle")}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 16, borderTopWidth: index ? StyleSheet.hairlineWidth : 0, borderTopColor: c.outline, backgroundColor: pressed ? c.press : "transparent" })}>
      <Avatar name={line.isYou ? user?.name ?? "You" : line.name} size={36} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T kind="body" style={{ fontSize: 15, fontWeight: "500" }}>{line.name}</T>
        <T kind="label" muted lines={1}>{line.job}</T>
      </View>
      <T kind="label" color={line.coming ? c.action : c.ink} style={{ fontWeight: "600" }}>{line.balance}</T>
    </Pressable>)}</Panel>
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
  </View>;
}

/** Every note, in full, under the essentials. */
function NotesList() {
  const router = useRouter();
  const { current } = useApp();
  const notes = current?.notes ?? [];
  if (!notes.length) return null;
  return <View style={{ gap: 12 }}>
    <SectionHead title="All notes" count={notes.length} right={<Button variant="quiet" size="sm" label="Open" onPress={() => router.push("/notes")} />} />
    <Panel>{notes.map((note, index) => <Row key={note.id} first={index === 0} onPress={() => router.push("/notes")} title={note.title}
      meta={note.lede || note.body ? <T kind="label" muted lines={1}>{note.lede || note.body}</T> : undefined} />)}</Panel>
    <T kind="note" muted style={{ paddingHorizontal: 4 }}>Adding and editing notes is on the web app for now.</T>
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
    <Button variant="quiet" size="sm" label="All expenses" onPress={() => router.navigate("/expenses")} />
    <Button variant="quiet" size="sm" label="Settlement" onPress={() => router.navigate("/settle")} />
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

/** This week's chores, late ones first, each with its tick. Free days are left out. */
function ChoresPage() {
  const { c } = useTheme();
  const router = useRouter();
  const { current, user, today } = useApp();
  if (!current) return null;
  const value = week(current, user?.id ?? "", today);
  const late = value.late;
  const days = value.days.map((day) => ({ ...day, items: day.items.filter((item) => item.kind === "task") })).filter((day) => day.items.length);
  const count = late.length + days.reduce((sum, day) => sum + day.items.length, 0);
  return <View style={{ gap: 12 }}>
    <SectionHead title="This week" count={count} right={<Button variant="quiet" size="sm" label="All tasks" onPress={() => router.push("/tasks")} />} />
    <Panel>
      {!count ? <Empty icon={<Check size={18} color={c.onSettled} />} title="No chores left this week" /> : <>
        {late.length ? <DayHead first label="Late" count={late.length} late /> : null}
        {late.map((item) => <WeekRow key={item.key} item={item} late />)}
        {days.map((day, index) => <View key={day.date}>
          <DayHead first={!late.length && index === 0} date={day.date} label={day.date === today ? "Today" : day.date === addDays(today, 1) ? "Tomorrow" : undefined} />
          {day.items.map((item) => <WeekRow key={item.key} item={item} />)}
        </View>)}
      </>}
    </Panel>
    {count ? <T kind="label" muted style={{ textAlign: "center" }}>Free days are left out on the phone.</T> : null}
    <T kind="note" muted style={{ paddingHorizontal: 4 }}>Adding chores and changing the rota is on the web app for now.</T>
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
  return <View style={{ backgroundColor: c.surface, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: c.outline, padding: 14, gap: 8 }}>
    {item.category ? <T kind="note" muted style={{ fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase" }}>{item.category}</T> : null}
    <T kind="strong">{item.title}</T>
    {item.facts.length ? <View style={{ gap: 3 }}>{item.facts.map((fact) => <View key={fact.label} style={{ flexDirection: "row", gap: 12 }}>
      <T kind="label" muted style={{ width: 78 }}>{fact.label}</T>
      <T kind="label" style={{ flex: 1 }} >{fact.secret && !shown ? "••••••" : fact.value}</T>
    </View>)}</View> : <T kind="label" muted>{item.summary}</T>}
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
