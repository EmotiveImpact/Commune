/**
 * Setting up: what you share, its name and face, what you split, bringing
 * people in, reminders, the plan and free week, the welcome and loading.
 * Payment is a placeholder until Apple in-app purchase is wired: nothing is
 * charged and no App Store sheet opens.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import Svg, { Path, Rect } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import { Text, TextInput } from "../ui/text";
import { PressScale, haptic, useCalm } from "../ui/motion";
import { QrCode } from "../ui/qr";
import { addDays, billInSentence, longDate, shortDate, shuffled } from "./engine";
import { CHORE_CHIPS, MONEY_CHIPS, PLANS, useActive, useFlow, type Currency } from "./flow";
import type { ImageKey } from "./images";
import { CAST_NAMES, GENERAL_LINES, type Kind } from "./stories";
import { Av, CloseX, Drawer, EASE, Foot, Glass, Handle, Ini, LinkBtn, O, Pill, Rise, RowC, Shade, St, Tick, TopBar, Wordmark, YouAv, FILL, img, type } from "./ui";

/* ---------- kind ---------- */

const KINDS: Array<{ k: Kind; img: ImageKey; sub: string }> = [
  { k: "A home", img: "t-home", sub: "Flatshare, family, couple" },
  { k: "A trip", img: "t-trip", sub: "Holidays, weekends, festivals" },
  { k: "A workspace", img: "t-work", sub: "Studio, office, shared desk" },
  { k: "Something else", img: "t-else", sub: "Clubs, allotments, gifts" },
];

export function KindScreen() {
  const flow = useFlow();
  // Filled from the story the first time, so going back keeps any change.
  useEffect(() => {
    if (flow.kindSetFor !== flow.story.id) flow.set({ kindSetFor: flow.story.id, kind: flow.story.kind, communeName: flow.story.commune, cover: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <View style={{ flex: 1, backgroundColor: O.canvas }}>
    <TopBar onBack={flow.back} prog={[2, 6]} />
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, marginHorizontal: 24, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: O.pale }}>
      <Tick size={16} color={O.onSettled} width={2.6} />
      <Text style={{ flex: 1, fontSize: 13, lineHeight: 17, fontWeight: "500", color: O.onSettled }}>{`Account made, and your ${billInSentence(flow.story.bill.n)} split is saved.`}</Text>
    </View>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
      <St i={0}><Text accessibilityRole="header" style={[type.h2, { marginTop: 14 }]}>{`What are you sharing, ${flow.first}?`}</Text></St>
      <St i={1}><Text style={type.lede}>We'll set things up to suit it. You can run more than one.</Text></St>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 22 }}>
        {KINDS.map((x, i) => {
          const on = flow.kind === x.k;
          return <St key={x.k} i={2 + i} style={{ width: "48.4%" }}>
            <PressScale accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${x.k}. ${x.sub}`} scaleTo={0.98}
              onPress={() => { haptic.select(); flow.set({ kind: x.k }); }}
              style={{ aspectRatio: 1 / 1.08, borderRadius: 22, overflow: "hidden", backgroundColor: "#ccc" }}>
              <Image source={img(x.img)} resizeMode="cover" style={FILL} />
              <Shade stops={[[0.45, "rgba(0,0,0,0)"], [1, "rgba(0,0,0,0.6)"]]} />
              <View style={{ position: "absolute", top: 10, right: 10, width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center",
                backgroundColor: on ? O.action : "rgba(255,255,255,0.35)", borderWidth: on ? 0 : 2, borderColor: "#fff" }}>
                {on ? <Tick size={14} /> : null}
              </View>
              <View style={{ position: "absolute", left: 14, right: 12, bottom: 12 }}>
                <Text style={{ fontSize: 16, lineHeight: 19, fontWeight: "600", color: "#fff" }}>{x.k}</Text>
                <Text style={{ fontSize: 12.5, lineHeight: 16, color: "rgba(255,255,255,0.85)", marginTop: 2 }}>{x.sub}</Text>
              </View>
              {on ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 22, borderWidth: 2.5, borderColor: O.action }]} /> : null}
            </PressScale>
          </St>;
        })}
      </View>
    </ScrollView>
    <Foot><Pill label="Continue" onPress={() => flow.go("name-commune")} /></Foot>
  </View>;
}

/* ---------- name and face ---------- */

const COVERS: ImageKey[] = ["picnic", "chips", "bench", "shadowbox", "jeanphil", "fridge"];
const CURRENCIES: Array<[Currency, string]> = [["GBP", "£ Pounds"], ["EUR", "€ Euros"], ["USD", "$ Dollars"]];

function Chip({ label, on, onPress, icon }: { label: string; on: boolean; onPress(): void; icon?: string }) {
  return <PressScale accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={label} onPress={() => { haptic.select(); onPress(); }}
    style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 42, paddingHorizontal: 15, borderRadius: 999, backgroundColor: on ? O.action : O.surface, borderWidth: on ? 0 : 1.5, borderColor: O.outline2 }}>
    {icon ? <ChipIcon name={icon} color={on ? "#fff" : O.ink} /> : null}
    <Text style={{ fontSize: 14.5, fontWeight: "500", color: on ? "#fff" : O.ink }}>{label}</Text>
  </PressScale>;
}

const Label = ({ children }: { children: string }) => <Text style={{ fontSize: 12, fontWeight: "600", letterSpacing: 0.96, textTransform: "uppercase", color: O.ink2, marginTop: 22 }}>{children}</Text>;

export function NameCommune() {
  const flow = useFlow();
  const [focused, setFocused] = useState(false);
  const cover: ImageKey = flow.cover === null ? flow.story.beats[0].img : COVERS[flow.cover];
  const fade = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ opacity: fade.value }));
  const pickCover = (i: number) => { fade.value = 0.4; fade.value = withTiming(1, { duration: 420, easing: EASE }); flow.set({ cover: i }); };
  return <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: O.canvas }}>
    <TopBar onBack={flow.back} prog={[3, 6]} />
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 12 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <St i={0}><Text accessibilityRole="header" style={[type.h2, { marginTop: 14 }]}>Give it a name and a face.</Text></St>
      <St i={1}><Animated.View style={[{ marginTop: 18, height: 188, borderRadius: 24, overflow: "hidden", backgroundColor: O.recessed }, a]}>
        <Image source={img(cover)} resizeMode="cover" style={FILL} />
        <Shade stops={[[0.4, "rgba(0,0,0,0)"], [1, "rgba(0,0,0,0.55)"]]} />
        <View style={{ position: "absolute", left: 16, top: 14, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: "rgba(0,0,0,0.28)" }}>
          <Text style={{ fontSize: 11, fontWeight: "600", letterSpacing: 0.88, textTransform: "uppercase", color: "#fff" }}>{flow.kind}</Text>
        </View>
        <Text numberOfLines={1} style={{ position: "absolute", left: 16, right: 16, bottom: 14, color: "#fff", fontSize: 28, lineHeight: 30, letterSpacing: -0.84 }}>{flow.communeOrDefault}</Text>
      </Animated.View></St>
      <St i={2}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, padding: 3 }} style={{ marginTop: 12, marginHorizontal: -3 }}>
        {COVERS.map((c, i) => <Pressable key={c} accessibilityRole="radio" accessibilityState={{ selected: flow.cover === i }} accessibilityLabel={`Cover photo ${i + 1}`} onPress={() => { haptic.select(); pickCover(i); }}
          style={{ width: 62, height: 62, borderRadius: 16, borderWidth: 2, borderColor: flow.cover === i ? O.action : "transparent", padding: 2 }}>
          <Image source={img(c)} resizeMode="cover" style={{ width: 54, height: 54, borderRadius: 12 }} />
        </Pressable>)}
      </ScrollView></St>
      <St i={3}><Label>Name</Label></St>
      <St i={4}><View style={{ flexDirection: "row", alignItems: "center", height: 56, paddingHorizontal: 18, borderRadius: 18, backgroundColor: O.surface, marginTop: 10, borderWidth: focused ? 2 : 1.5, borderColor: focused ? O.action : O.outline2 }}>
        <TextInput value={flow.communeName} onChangeText={(v) => flow.set({ communeName: v.slice(0, 60) })} accessibilityLabel="Commune name" placeholder="Our commune" placeholderTextColor={O.outline}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} returnKeyType="done" style={{ flex: 1, fontSize: 18, fontWeight: "500", color: O.ink, paddingVertical: 0 }} />
      </View></St>
      <St i={5}><Label>Money in</Label></St>
      <St i={6} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
        {CURRENCIES.map(([code, label]) => <Chip key={code} label={label} on={flow.currency === code} onPress={() => flow.set({ currency: code })} />)}
      </St>
    </ScrollView>
    <Foot><Pill label="Continue" onPress={() => flow.go("shares")} /></Foot>
  </KeyboardAvoidingView>;
}

/* ---------- what you share ---------- */

const ICONS: Record<string, string> = {
  home: "M4 11l8-7 8 7v9H4z", bolt: "M13 3L5 13h6l-1 8 8-10h-6z", drop: "M12 3c4 5 6 8 6 11a6 6 0 01-12 0c0-3 2-6 6-11z",
  wifi: "M3 9a14 14 0 0118 0M6 12.5a9 9 0 0112 0M9 16a4 4 0 016 0M12 19h.01", bank: "M3 10l9-6 9 6M5 10v8M10 10v8M14 10v8M19 10v8M3 20h18",
  cart: "M3 4h2l2.5 11h11L21 7H7M9 19h.01M17 19h.01", bag: "M5 8h14l-1 12H6zM9 8a3 3 0 016 0", tv: "M5 5h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2zM9 21h6",
  bin: "M5 7h14M9 7V4h6v3M6 7l1 13h10l1-13", spray: "M8 10h6v11H8zM10 10V6h3l4-2M17 7h2M17 10h2", leaf: "M5 19C5 10 11 5 20 4c0 9-5 15-14 15zM5 19l7-7", sock: "M9 3h6v9l3 4a3 3 0 01-4.5 4L8 15V3",
};
function ChipIcon({ name, color }: { name: string; color: string }) {
  return <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><Path d={ICONS[name]} /></Svg>;
}

export function Shares() {
  const flow = useFlow();
  const m = flow.money.filter(Boolean).length;
  const c = flow.chores.filter(Boolean).length;
  return <View style={{ flex: 1, backgroundColor: O.canvas }}>
    <TopBar onBack={flow.back} prog={[4, 6]} />
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
      <St i={0}><Text accessibilityRole="header" style={[type.h2, { marginTop: 14 }]}>{`What do you share at ${flow.communeOrDefault}?`}</Text></St>
      <St i={1}><Text style={type.lede}>Pick a few to start. Anything can be added later.</Text></St>
      <St i={2}><Label>Money</Label></St>
      <St i={3} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
        {MONEY_CHIPS.map(([n, icon], i) => <Chip key={n} label={n} icon={icon} on={flow.money[i]} onPress={() => flow.set({ money: flow.money.map((v, k) => (k === i ? !v : v)) })} />)}
      </St>
      <St i={4}><Label>Chores</Label></St>
      <St i={5} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
        {CHORE_CHIPS.map(([n, icon], i) => <Chip key={n} label={n} icon={icon} on={flow.chores[i]} onPress={() => flow.set({ chores: flow.chores.map((v, k) => (k === i ? !v : v)) })} />)}
      </St>
    </ScrollView>
    <St i={6}><View style={{ marginHorizontal: 24, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18, backgroundColor: O.pale, flexDirection: "row", gap: 10, alignItems: "center" }}>
      <Tick size={20} color={O.onSettled} width={2.2} />
      <Text style={{ flex: 1, fontSize: 14, lineHeight: 19.6, color: O.onSettled }}>{"We'll set up "}<Text style={{ fontWeight: "700", color: O.onSettled }}>{`${m} bill${m === 1 ? "" : "s"}`}</Text>{" to split and "}
        <Text style={{ fontWeight: "700", color: O.onSettled }}>{`${c} chore rota${c === 1 ? "" : "s"}`}</Text>{". Amounts come later."}</Text>
    </View></St>
    <Foot><Pill label="Continue" onPress={() => flow.go("invite")} /></Foot>
  </View>;
}

/* ---------- bring your people in ---------- */

export function joinCodeFor(name: string): string {
  const word = (name.replace(/[^A-Za-z ]/g, "").split(" ").find((w) => w.length >= 3) ?? "HOME").toUpperCase().slice(0, 4);
  return `${word}-7Q4`;
}

export function InviteScreen() {
  const flow = useFlow();
  const code = joinCodeFor(flow.communeOrDefault);
  return <View style={{ flex: 1, backgroundColor: O.canvas }}>
    <TopBar onBack={flow.back} prog={[5, 6]} />
    <View style={{ paddingHorizontal: 24 }}>
      <St i={0}><Text accessibilityRole="header" style={[type.h2, { marginTop: 14 }]}>Bring your people in.</Text></St>
      <St i={1}><Text style={type.lede}>No email needed. They scan this with their camera and they're in.</Text></St>
    </View>
    <St i={2}><View style={{ marginTop: 22, alignSelf: "center", width: 250, backgroundColor: O.surface, borderRadius: 28, paddingTop: 20, paddingHorizontal: 20, paddingBottom: 16, alignItems: "center",
      shadowColor: O.ink, shadowOpacity: 0.18, shadowRadius: 25, shadowOffset: { width: 0, height: 24 } }}>
      <QrCode value={`https://app.ourcommune.io/j/${code.toLowerCase()}`} size={180} label={`Join code for ${flow.communeOrDefault}`} />
      <Text numberOfLines={1} style={{ fontSize: 21, lineHeight: 23, letterSpacing: -0.42, marginTop: 14, color: O.ink, fontFamily: "DMSans_400Regular" }}>{flow.communeOrDefault}</Text>
      <Text style={{ fontSize: 12.5, color: O.ink2, marginTop: 6, textAlign: "center" }}>Works for the next hour · you approve each person</Text>
      <View style={{ marginTop: 12, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: O.recessed }}>
        <Text style={[type.num, { fontSize: 15, fontWeight: "600", letterSpacing: 1.8, color: O.ink }]}>{code}</Text>
      </View>
    </View></St>
    <View style={{ flex: 1 }} />
    <Foot>
      <Pill label="Share the join link" onPress={() => flow.go("reminders")} />
      <LinkBtn text="I'll do this later" onPress={() => flow.go("reminders")} />
    </Foot>
  </View>;
}

/* ---------- reminders ---------- */

const REMINDERS_NEW: Array<[string, string, string]> = [
  ["Bins go out tonight", "Your turn, {name}. Jean Phil did it last week.", "18:00"],
  ["Jean Phil paid you £9.72", "Picnic in the park. Tap to confirm.", "now"],
  ["Rent goes out on Friday", "Everyone's share is in. Nothing to do.", "Wed"],
];

export function Reminders() {
  const flow = useFlow();
  const rem = flow.mode === "invite" ? flow.inv.rem : REMINDERS_NEW;
  const fill = (t: string) => t.replace("{name}", flow.first === "there" ? "you" : flow.first);
  const turnOn = async () => {
    if (Platform.OS !== "web") await Notifications.requestPermissionsAsync().catch(() => undefined);
    flow.go("plans");
  };
  return <View style={{ flex: 1, backgroundColor: O.canvas }}>
    <TopBar onBack={flow.back} prog={[6, 6]} />
    <View style={{ height: 262, marginTop: 14, marginHorizontal: 20 }}>
      {rem.map(([t, s, tm], i) => <Rise key={t} delay={200 + i * 160} from={26} duration={700} scale={0.96} style={{ position: "absolute", left: 0, right: 0, top: 18 + i * 78 }}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 12, paddingHorizontal: 14, borderRadius: 20, backgroundColor: O.surface,
          shadowColor: O.ink, shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 14 } }}>
          <View style={{ width: 36, height: 36, borderRadius: 9, backgroundColor: O.frame, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 12, fontFamily: "CommuneWordmark25", letterSpacing: -0.5, color: "#f5f1ea" }}>c.</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 14, lineHeight: 17.5, fontWeight: "600", color: O.ink }}>{fill(t)}</Text>
            <Text style={{ fontSize: 13, color: O.ink2, marginTop: 2 }}>{fill(s)}</Text>
          </View>
          <Text style={{ alignSelf: "flex-start", fontSize: 11.5, color: O.ink2 }}>{tm}</Text>
        </View>
      </Rise>)}
    </View>
    <View style={{ paddingHorizontal: 24 }}>
      <St i={0}><Text accessibilityRole="header" style={type.h2}>A nudge when it matters.</Text></St>
      <St i={1}><Text style={type.lede}>Money you owe or are owed, your chores and anything your commune flags. Never adverts. Change it any time.</Text></St>
    </View>
    <View style={{ flex: 1 }} />
    <Foot>
      <Pill label="Turn on reminders" onPress={() => void turnOn()} />
      <LinkBtn text="Not now" onPress={() => flow.go("plans")} />
    </Foot>
  </View>;
}

/* ---------- plans ---------- */

export function Plans() {
  const flow = useFlow();
  const [restore, setRestore] = useState(false);
  return <View style={{ flex: 1, backgroundColor: O.canvas }}>
    <TopBar onBack={flow.back} right={<Pressable accessibilityRole="button" onPress={() => setRestore(true)} hitSlop={8} style={{ paddingVertical: 10, paddingHorizontal: 4 }}>
      <Text style={{ fontSize: 14, fontWeight: "600", color: O.ink2 }}>Restore</Text></Pressable>} />
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
      <St i={0}><Text accessibilityRole="header" style={[type.h2, { marginTop: 10 }]}>{`${flow.communeOrDefault} is ready. Keep it free for a week.`}</Text></St>
      {restore ? <Text style={[type.small, { marginTop: 10 }]}>Nothing to restore yet. Plans you buy through the App Store come back here.</Text> : null}
      <View accessibilityRole="radiogroup" accessibilityLabel="Plans" style={{ gap: 10, marginTop: 20 }}>
        {PLANS.map((p, i) => {
          const on = flow.plan.n === p.n;
          return <St key={p.n} i={1 + i}>
            <PressScale accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${p.n}, £${p.p} a month. ${p.lead} ${p.line}`} scaleTo={0.985}
              onPress={() => { haptic.select(); flow.set({ plan: p }); }}
              style={{ backgroundColor: O.surface, borderRadius: 22, paddingVertical: 16, paddingHorizontal: 18, borderWidth: on ? 2.5 : 1.5, borderColor: on ? O.action : O.outline2 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                <Text style={{ fontSize: 18, fontWeight: "600", color: O.ink }}>{p.n}</Text>
                <Text style={{ fontSize: 20, fontWeight: "600", letterSpacing: -0.4, color: O.ink }}>{`£${p.p}`}<Text style={{ fontSize: 13, fontWeight: "500", color: O.ink2, letterSpacing: 0 }}> /month</Text></Text>
              </View>
              <Text style={{ fontSize: 13.5, lineHeight: 18.9, color: O.ink2, marginTop: 7, paddingRight: 30 }}><Text style={{ fontWeight: "600", color: O.ink }}>{p.lead}</Text>{`\n${p.line}`}</Text>
              <View style={{ position: "absolute", right: 18, bottom: 16, width: 22, height: 22, borderRadius: 11, borderWidth: on ? 7 : 2, borderColor: on ? O.action : O.outline }} />
            </PressScale>
          </St>;
        })}
      </View>
      <St i={4}><Text style={{ marginTop: 16, fontSize: 13, lineHeight: 19.5, color: O.ink2 }}><Text style={{ fontWeight: "600", color: O.ink }}>Every plan has it all:</Text> bills and splits, chores and rotas, pay links, reminders, receipts and statements.</Text></St>
    </ScrollView>
    <Foot><Pill label={`Try ${flow.plan.n} free for 7 days`} onPress={() => flow.go("trial")} /></Foot>
  </View>;
}

/* ---------- the free week ---------- */

function Lock({ color }: { color: string }) { return <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><Path d="M7 11V8a5 5 0 0110 0" /><Rect x={5} y={11} width={14} height={10} rx={2} /></Svg>; }
function Bell({ color }: { color: string }) { return <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><Path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z" /><Path d="M10 21h4" /></Svg>; }
function CardIcon({ color }: { color: string }) { return <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><Path d="M4 7h16v12H4z" /><Path d="M4 11h16" /></Svg>; }

function Step({ lit, when, title, body, Icon }: { lit: boolean; when: string; title: string; body: string; Icon: (p: { color: string }) => React.ReactElement }) {
  const p = useSharedValue(0);
  useEffect(() => { p.value = withTiming(lit ? 1 : 0, { duration: 300 }); }, [lit, p]);
  const dot = useAnimatedStyle(() => ({ backgroundColor: p.value > 0.5 ? O.action : O.surface, borderWidth: p.value > 0.5 ? 0 : 2 }));
  return <View>
    <Animated.View style={[{ position: "absolute", left: -44, top: 0, width: 33, height: 33, borderRadius: 17, borderColor: O.outline, alignItems: "center", justifyContent: "center" }, dot]}>
      <Icon color={lit ? "#fff" : O.ink2} />
    </Animated.View>
    <Text style={{ fontSize: 12, fontWeight: "600", letterSpacing: 0.96, textTransform: "uppercase", color: O.action }}>{when}</Text>
    <Text style={{ marginTop: 6, marginBottom: 4, fontSize: 17, lineHeight: 20.4, fontWeight: "600", color: O.ink }}>{title}</Text>
    <Text style={{ fontSize: 14, lineHeight: 20.3, color: O.ink2 }}>{body}</Text>
  </View>;
}

export function Trial() {
  const flow = useFlow();
  const active = useActive();
  const calm = useCalm();
  const today = useMemo(() => new Date(), []);
  const [lit, setLit] = useState(0);
  const [h, setH] = useState(0);
  const fill = useSharedValue(0);
  const [open, setOpen] = useState(false);
  const [buy, setBuy] = useState<"idle" | "checking" | "done">("idle");
  useEffect(() => {
    if (!h) return;
    const ts = [setTimeout(() => { fill.value = withTiming(h - 28, { duration: calm ? 0 : 1600, easing: EASE }); }, 450),
      ...[0, 1, 2].map((i) => setTimeout(() => setLit(i + 1), 450 + i * 640))];
    return () => ts.forEach(clearTimeout);
  }, [h, calm, fill]);
  const fillStyle = useAnimatedStyle(() => ({ height: fill.value }));
  const confirm = () => {
    setBuy("checking");
    setTimeout(() => { haptic.success(); setBuy("done"); setTimeout(() => { if (active) flow.go("welcome"); }, 650); }, 1000);
  };
  const plan = flow.plan;
  return <View style={{ flex: 1, backgroundColor: O.canvas }}>
    <TopBar onBack={flow.back} />
    <View style={{ paddingHorizontal: 24 }}>
      <St i={0}><Text accessibilityRole="header" style={[type.h2, { marginTop: 10 }]}>How your free week works</Text></St>
      <View onLayout={(e) => setH(e.nativeEvent.layout.height)} style={{ marginTop: 26, paddingLeft: 44, gap: 26 }}>
        <View style={{ position: "absolute", left: 15, top: 14, bottom: 14, width: 3, borderRadius: 2, backgroundColor: O.outline }} />
        <Animated.View style={[{ position: "absolute", left: 15, top: 14, width: 3, borderRadius: 2, backgroundColor: O.action }, fillStyle]} />
        <St i={1}><Step lit={lit >= 1} Icon={Lock} when={`Today · ${shortDate(today)}`} title="Everything unlocked" body={`Set up ${flow.communeOrDefault}, bring people in, split the first bill.`} /></St>
        <St i={2}><Step lit={lit >= 2} Icon={Bell} when={shortDate(addDays(today, 5))} title="We remind you" body="A notification two days before anything is charged." /></St>
        <St i={3}><Step lit={lit >= 3} Icon={CardIcon} when={shortDate(addDays(today, 7))} title={`${plan.n} starts, £${plan.p} a month`} body="Cancel in Settings before then and you pay nothing." /></St>
      </View>
    </View>
    <View style={{ flex: 1 }} />
    <Foot>
      <St i={4} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}><Tick size={16} color={O.onSettled} width={2.6} /><Text style={{ fontSize: 14, fontWeight: "500", color: O.onSettled }}>Nothing to pay today</Text></St>
      <Pill label="Start my free week" onPress={() => setOpen(true)} />
    </Foot>
    <Drawer open={open} onClose={() => { if (buy === "idle") setOpen(false); }} label="Confirm your free week">
      <Handle />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <View><Text style={{ fontSize: 20, lineHeight: 24, fontWeight: "600", color: O.ink }}>Confirm your free week</Text><Text style={type.small}>Billed through the App Store</Text></View>
        <CloseX onPress={() => { if (buy === "idle") setOpen(false); }} />
      </View>
      <RowC><View><Text style={{ fontSize: 14.5, fontWeight: "600", color: O.ink }}>{`Commune ${plan.n}`}</Text><Text style={{ fontSize: 12.5, color: O.ink2, marginTop: 2 }}>{`Free for 7 days, then £${plan.p} a month`}</Text></View></RowC>
      <RowC>
        <View style={{ flex: 1 }}><Text style={{ fontSize: 14.5, fontWeight: "600", color: O.ink }}>Today</Text><Text style={{ fontSize: 12.5, color: O.ink2, marginTop: 2 }}>{`Free until ${longDate(addDays(today, 7))}`}</Text></View>
        <Text style={[type.num, { fontWeight: "600", color: O.ink }]}>£0.00</Text>
      </RowC>
      <Pill style={{ marginTop: 10 }} disabled={buy !== "idle"} onPress={confirm}
        icon={buy === "done" ? <Tick size={20} width={2.8} /> : buy === "checking" ? <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><Path d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2" /></Svg> : undefined}
        label={buy === "done" ? "Done" : buy === "checking" ? "Checking" : "Confirm with Face ID"} />
    </Drawer>
  </View>;
}

/* ---------- welcome ---------- */

export function Welcome() {
  const flow = useFlow();
  const insets = useSafeAreaInsets();
  const m = flow.money.filter(Boolean).length;
  const c = flow.chores.filter(Boolean).length;
  const items = [`${m} bills ready to split`, `${c} chore rota${c === 1 ? "" : "s"} started`, "Join code live for the next hour", `${flow.plan.n} free until ${longDate(addDays(new Date(), 7))}`];
  return <View style={{ flex: 1, backgroundColor: O.frame }}>
    <Image source={img("jeanphil")} resizeMode="cover" style={FILL} />
    <Shade stops={[[0, "rgba(10,30,70,0.35)"], [0.3, "rgba(0,0,0,0)"], [0.45, "rgba(0,0,0,0)"], [0.72, "rgba(9,14,10,0.7)"], [1, "rgba(9,14,10,0.92)"]]} />
    <View style={{ marginTop: Math.max(insets.top, 20) + 14, paddingHorizontal: 22 }}>
      <St i={0} style={{ alignSelf: "flex-start" }}><Glass alpha={0.2} radius={999} style={{ paddingVertical: 8, paddingHorizontal: 12, shadowOpacity: 0 }}>
        <Text style={{ fontSize: 12.5, fontWeight: "600", color: "#fff" }}>Day 1 of 7 · free</Text>
      </Glass></St>
      <St i={1}><Text accessibilityRole="header" style={[type.h1, { marginTop: 16, fontSize: 44, lineHeight: 45, color: "#fff" }]}>{`You're in, ${flow.first}.`}</Text></St>
    </View>
    <St i={2} style={{ position: "absolute", left: 16, right: 16, bottom: 108 + Math.max(insets.bottom - 20, 0) }}>
      <Glass alpha={0.9} radius={24} style={{ paddingVertical: 16, paddingHorizontal: 18 }}>
        <Text style={{ fontSize: 22, lineHeight: 24, letterSpacing: -0.44, marginBottom: 10, color: O.ink, fontFamily: "DMSans_400Regular" }}>{flow.communeOrDefault}</Text>
        {items.map((t, i) => <Rise key={t} delay={700 + i * 140} from={0} duration={500} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: O.settled, alignItems: "center", justifyContent: "center" }}><Tick size={12} color={O.onSettled} width={3.2} /></View>
          <Text style={{ fontSize: 14.5, color: O.ink }}>{t}</Text>
        </Rise>)}
      </Glass>
    </St>
    <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 16) + 14 }}>
      <Pill label={`Open ${flow.communeOrDefault}`} onPress={() => flow.go("loading")} />
    </View>
  </View>;
}

/* ---------- loading ---------- */

function Sweep() {
  const calm = useCalm();
  const x = useSharedValue(-1);
  useEffect(() => { if (!calm) x.value = withRepeat(withTiming(3.3, { duration: 1250, easing: EASE }), -1, false); }, [calm, x]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * 52.8 }] }));
  return <View style={{ width: 132, height: 3, borderRadius: 2, backgroundColor: "rgba(245,241,234,0.14)", overflow: "hidden" }}>
    <Animated.View style={[{ position: "absolute", top: 0, bottom: 0, left: 0, width: 52.8, borderRadius: 2, backgroundColor: O.pale }, a]} />
  </View>;
}

function Bob({ i, children }: { i: number; children: React.ReactNode }) {
  const calm = useCalm();
  const y = useSharedValue(0);
  useEffect(() => {
    if (calm) return;
    y.value = withDelay(i * 120, withRepeat(withSequence(withTiming(-6, { duration: 360, easing: EASE }), withTiming(0, { duration: 360, easing: EASE }), withTiming(0, { duration: 1080 })), -1, false));
  }, [calm, i, y]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[{ marginLeft: i ? -8 : 0 }, a]}>{children}</Animated.View>;
}

function Line({ text }: { text: string }) {
  return <Rise key={text} from={8} duration={450} style={StyleSheet.absoluteFill}>
    <Text style={{ fontSize: 15, lineHeight: 20, textAlign: "center", color: "rgba(245,241,234,0.62)", fontFamily: "DMSans_400Regular" }}>{text}</Text>
  </Rise>;
}

export function Loading() {
  const flow = useFlow();
  const lines = useMemo(() => {
    if (flow.mode === "invite") {
      const gl = shuffled(GENERAL_LINES.filter((l) => !CAST_NAMES.some((n) => l.includes(n))));
      return [flow.inv.lines[0], gl[0], flow.inv.lines[1], flow.inv.lines[2]];
    }
    const sl = shuffled(flow.story.lines);
    const gl = shuffled(GENERAL_LINES);
    return [sl[0], gl[0], sl[1], flow.story.sig];
  }, [flow.mode, flow.inv, flow.story]);
  const [i, setI] = useState(0);
  const finishRef = useRef(flow.finish);
  finishRef.current = flow.finish;
  useEffect(() => {
    const t = setTimeout(() => { if (i + 1 >= lines.length) void finishRef.current(); else setI(i + 1); }, 900);
    return () => clearTimeout(t);
  }, [i, lines.length]);
  const you = (flow.name.trim().charAt(0) || "Y").toUpperCase();
  return <View style={{ flex: 1, backgroundColor: O.frame }}>
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 28 }}>
      <Wordmark size={46} color="#f5f1ea" />
      <Sweep />
      <View accessibilityLiveRegion="polite" style={{ height: 20, width: 280 }}><Line text={lines[i]} /></View>
    </View>
    <View style={{ flexDirection: "row", justifyContent: "center", paddingBottom: 60 }}>
      {flow.mode === "invite"
        ? [...flow.inv.people.map((n, k) => <Bob key={n} i={k}><Ini name={n} i={k} size={30} style={{ borderWidth: 2.5, borderColor: O.frame }} /></Bob>),
          <Bob key="you" i={flow.inv.people.length}><YouAv size={30} initial={you} style={{ borderWidth: 2.5, borderColor: O.frame }} /></Bob>]
        : (["maya", "jp", "theo", "ama", "leo"] as const).map((k, n) => <Bob key={k} i={n}><Av who={k} size={30} ring={O.frame} /></Bob>)}
    </View>
  </View>;
}
