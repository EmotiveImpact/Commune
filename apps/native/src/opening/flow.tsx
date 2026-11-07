/**
 * The opening flow's own screen stack. Screens push in from the right and
 * the one behind slides back a little and dims; the launch, loading and
 * welcome screens fade instead. One easing, no bounce, as in prototype v6.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { StatusBar } from "expo-status-bar";
import { useCalm } from "../ui/motion";
import { EASE, O } from "./ui";
import {
  clockGroup, ctxFrom, demoPeople, groupOf, inviteOf, pickInGroup, pickStory, startScreen, storyById,
  type Arrival, type Ctx, type Who,
} from "./engine";
import { STORIES, type GroupKey, type Invite, type Kind, type Story } from "./stories";
import { useOpening } from "./store";

export type ScreenId =
  | "launch" | "pick" | "invited" | "intro" | "demo-split" | "demo-maths" | "demo-settle"
  | "signup" | "phone" | "code" | "name" | "signin"
  | "kind" | "name-commune" | "shares" | "invite" | "reminders" | "plans" | "trial" | "welcome" | "loading";

const FADES: ScreenId[] = ["launch", "loading", "welcome"];
const LIGHT_BAR: ScreenId[] = ["launch", "pick", "invited", "intro", "demo-settle", "signup", "signin", "welcome", "loading"];
/** Invited people skip set-up and the plan: whoever invited them already pays. */
const INVITE_ROUTE: Partial<Record<ScreenId, Partial<Record<ScreenId, ScreenId>>>> = { name: { kind: "reminders" }, reminders: { plans: "loading" } };

export const MONEY_CHIPS: Array<[string, string, boolean]> = [["Rent", "home", true], ["Energy", "bolt", true], ["Water", "drop", false], ["Internet", "wifi", true], ["Council tax", "bank", true], ["Food shop", "cart", false], ["Takeaways", "bag", false], ["Streaming", "tv", false]];
export const CHORE_CHIPS: Array<[string, string, boolean]> = [["Bins", "bin", true], ["Cleaning", "spray", true], ["Plants", "leaf", false], ["Laundry", "sock", false]];
export const PLANS = [
  { n: "Standard", p: "4.99", lead: "Up to 8 people · 1 commune.", line: "For a flatshare or a family home." },
  { n: "Pro", p: "9.99", lead: "3 communes · up to 15 people in each.", line: "For a home, a trip and a team at once." },
  { n: "Collective", p: "29.99", lead: "Up to 10 communes · 20 people in each.", line: "For everyone and everything you look after." },
];
export type Currency = "GBP" | "EUR" | "USD";

export type FlowData = {
  mode: "new" | "invite";
  /** Came back through "Sign in": nothing new is made at the end. */
  returning: boolean;
  story: Story;
  choice: GroupKey | null;
  people: Who[];
  sel: boolean[];
  name: string;
  phone: string;
  kind: Kind;
  /** The story the set-up was last filled from, so going back keeps edits. */
  kindSetFor: string;
  communeName: string;
  cover: number | null;
  currency: Currency;
  money: boolean[];
  chores: boolean[];
  plan: (typeof PLANS)[number];
};

type Flow = FlowData & {
  cur: ScreenId;
  /** The demo build fills in codes and signs in with Face ID; a live server uses the real sign-in. */
  backendMode: "demo" | "server";
  ctx: Ctx;
  inv: Invite;
  seen: string[];
  set(patch: Partial<FlowData>): void;
  go(id: ScreenId, opt?: { fade?: boolean; noStack?: boolean }): void;
  back(): void;
  /** Sets the story and everything that follows from it. */
  applyStory(story: Story, choice?: GroupKey | null): void;
  choose(g: GroupKey | null): void;
  finish(): Promise<void>;
  /** The person's first name, or "there". */
  first: string;
  communeOrDefault: string;
};

const FlowContext = createContext<Flow | null>(null);
export function useFlow(): Flow {
  const flow = useContext(FlowContext);
  if (!flow) throw new Error("useFlow outside the opening flow");
  return flow;
}
/** False while a screen is leaving, so its timers don't move the flow on. */
const ActiveContext = createContext(true);
export const useActive = () => useContext(ActiveContext);

type Layer = { id: ScreenId; k: number; role: "enter" | "exit" | "still"; fade: boolean; back: boolean };

export function OpeningFlow({ arrived, screens, onFinish, backendMode }: { arrived: Arrival; screens: Record<ScreenId, ComponentType>; onFinish(flow: FlowData): Promise<void>; backendMode: "demo" | "server" }) {
  const opening = useOpening();
  const ctx = useMemo(() => ctxFrom(new Date(), arrived), [arrived]);
  const seenRef = useRef<string[]>(opening.seen);
  const inv = inviteOf(arrived) ?? inviteOf("invite-home")!;
  const initialStory = useMemo(() => {
    if (arrived.startsWith("link-")) return storyById(arrived.slice(5)) ?? STORIES[0];
    return pickStory(ctx, seenRef.current);
  }, [arrived, ctx]);
  const [data, setData] = useState<FlowData>(() => {
    const people = demoPeople(initialStory);
    return {
      mode: arrived.startsWith("invite-") ? "invite" : "new", returning: false,
      story: initialStory, choice: arrived.startsWith("link-") ? groupOf(initialStory.id) ?? null : null,
      people, sel: people.map((_, i) => i < Math.min(people.length, 5)),
      name: "", phone: "", kind: initialStory.kind, kindSetFor: "", communeName: initialStory.commune, cover: null, currency: initialStory.bill.cur === "€" ? "EUR" : "GBP",
      money: MONEY_CHIPS.map((m) => m[2]), chores: CHORE_CHIPS.map((m) => m[2]), plan: PLANS[0],
    };
  });
  const dataRef = useRef(data);
  dataRef.current = data;
  const set = useCallback((patch: Partial<FlowData>) => setData((d) => ({ ...d, ...patch })), []);

  const markSeen = useCallback((id: string) => {
    if (seenRef.current.includes(id)) return;
    seenRef.current = [...seenRef.current, id];
    opening.save({ seen: seenRef.current });
  }, [opening]);

  const applyStory = useCallback((story: Story, choice: GroupKey | null = null) => {
    const people = demoPeople(story);
    set({ story, choice, people, sel: people.map((_, i) => i < Math.min(people.length, 5)) });
    markSeen(story.id);
  }, [set, markSeen]);
  const choose = useCallback((g: GroupKey | null) => {
    applyStory(g ? pickInGroup(g, ctx, seenRef.current) : pickStory(ctx, seenRef.current), g);
  }, [ctx, applyStory]);
  useEffect(() => { if (arrived.startsWith("link-")) markSeen(initialStory.id); }, [arrived, initialStory, markSeen]);

  const [layers, setLayers] = useState<Layer[]>([{ id: "launch", k: 0, role: "still", fade: true, back: false }]);
  const counter = useRef(1);
  const history = useRef<ScreenId[]>([]);
  const cur = layers[layers.length - 1].id;
  const curRef = useRef(cur);
  curRef.current = cur;

  const go = useCallback((target: ScreenId, opt: { fade?: boolean; noStack?: boolean; back?: boolean } = {}) => {
    const from = curRef.current;
    let id = target;
    if (!opt.back && dataRef.current.mode === "invite") id = INVITE_ROUTE[from]?.[target] ?? target;
    if (id === from) return;
    if (!opt.back && !opt.noStack) history.current.push(from);
    const fade = opt.fade ?? (FADES.includes(id) || from === "launch" || from === "loading");
    curRef.current = id;
    setLayers((ls) => {
      const top = ls[ls.length - 1];
      return [{ ...top, role: "exit", fade, back: !!opt.back }, { id, k: counter.current++, role: "enter", fade, back: !!opt.back }];
    });
  }, []);
  const back = useCallback(() => { const p = history.current.pop(); if (p) go(p, { back: true }); }, [go]);
  const gone = useCallback((k: number) => setLayers((ls) => ls.filter((l) => l.k !== k)), []);

  const finishing = useRef(false);
  const finish = useCallback(async () => {
    if (finishing.current) return;
    finishing.current = true;
    await onFinish(dataRef.current);
  }, [onFinish]);

  const first = data.name.trim() || "there";
  const value = useMemo<Flow>(() => ({
    ...data, cur, backendMode, ctx, inv, seen: seenRef.current, set, go, back, applyStory, choose, finish, first,
    communeOrDefault: data.communeName.trim() || "Our commune",
  }), [data, cur, backendMode, ctx, inv, set, go, back, applyStory, choose, finish, first]);

  return <FlowContext.Provider value={value}>
    <StatusBar style={LIGHT_BAR.includes(cur) ? "light" : "dark"} />
    <View style={{ flex: 1, backgroundColor: O.frame }}>
      {layers.map((l) => {
        const Screen = screens[l.id];
        return <LayerView key={l.k} layer={l} onGone={gone}>
          <ActiveContext.Provider value={l.role !== "exit"}><Screen /></ActiveContext.Provider>
        </LayerView>;
      })}
    </View>
  </FlowContext.Provider>;
}

function LayerView({ layer, onGone, children }: { layer: Layer; onGone(k: number): void; children: ReactNode }) {
  const { width } = useWindowDimensions();
  const calm = useCalm();
  const p = useSharedValue(layer.role === "enter" ? 0 : 1);
  const exiting = useSharedValue(layer.role === "exit" ? 1 : 0);
  const fade = useSharedValue(layer.fade || calm ? 1 : 0);
  const backV = useSharedValue(layer.back ? 1 : 0);
  useEffect(() => {
    fade.value = layer.fade || calm ? 1 : 0;
    backV.value = layer.back ? 1 : 0;
    const duration = calm ? 180 : layer.fade ? 700 : 560;
    if (layer.role === "enter") { exiting.value = 0; p.value = 0; p.value = withTiming(1, { duration, easing: EASE }); }
    if (layer.role === "exit") {
      exiting.value = 1; p.value = 1;
      const k = layer.k;
      p.value = withTiming(0, { duration, easing: EASE }, (done) => { if (done) runOnJS(onGone)(k); });
    }
  }, [layer.role, layer.fade, layer.back, layer.k, calm, p, exiting, fade, backV, onGone]);
  const style = useAnimatedStyle(() => {
    if (fade.value) return { opacity: p.value, transform: [{ translateX: 0 }] };
    // Forward: the new screen comes in from the right, the old one slides back 28%.
    // Back: the reverse.
    const front = exiting.value ? backV.value === 1 : backV.value === 0;
    const x = front ? (1 - p.value) * width : -(1 - p.value) * 0.28 * width;
    return { opacity: 1, transform: [{ translateX: x }] };
  });
  const dim = useAnimatedStyle(() => {
    if (fade.value) return { opacity: 0 };
    const front = exiting.value ? backV.value === 1 : backV.value === 0;
    return { opacity: front ? 0 : (1 - p.value) * 0.14 };
  });
  const z = layer.role === "exit" ? (layer.back ? 2 : 1) : layer.back ? 1 : 2;
  return <Animated.View pointerEvents={layer.role === "exit" ? "none" : "auto"} style={[StyleSheet.absoluteFill, { zIndex: z, overflow: "hidden" }, style]}>
    {children}
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#000" }, dim]} />
  </Animated.View>;
}

/** Which answer the clock points at, for the "Right now" tag. */
export function useClockGroup(): GroupKey {
  const { ctx } = useFlow();
  return useMemo(() => clockGroup(ctx), [ctx]);
}
export { startScreen };
