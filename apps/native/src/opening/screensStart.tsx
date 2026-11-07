/**
 * The first screens: the launch wordmark, "Who are you sharing with?", the
 * invited arrival and the story player.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing, cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, Image as SvgImage, LinearGradient, Mask, Rect, Stop } from "react-native-svg";
import { Text } from "../ui/text";
import { PressScale, haptic, useCalm } from "../ui/motion";
import { startScreen } from "./engine";
import { useActive, useFlow, useClockGroup } from "./flow";
import { IMAGES, PHOTO_RATIO, type ImageKey } from "./images";
import { CAST, CLOUDS, FOCAL, GROUPS, type Beat, type CastId, type GroupKey } from "./stories";
import { Av, CloseX, Drawer, EASE, EASE_OUT, Glass, Ini, LinkBtn, O, Pill, Rise, Shade, Wordmark, YouAv, FILL, img, type } from "./ui";

/* ---------- launch ---------- */

const LETTERS = ["c", "o", "m", "m", "u", "n", "e", "."];

function Letter({ ch, i }: { ch: string; i: number }) {
  const calm = useCalm();
  const last = i === LETTERS.length - 1;
  const p = useSharedValue(calm ? 1 : 0);
  useEffect(() => { if (!calm) p.value = withDelay(last ? 620 : 120 + i * 55, withTiming(1, { duration: last ? 520 : 640, easing: EASE })); }, [calm, i, last, p]);
  const a = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: (1 - p.value) * (last ? -26 : 22) }] }));
  return <Animated.View style={a}>
    <Text style={{ fontSize: 64, lineHeight: 72, color: "#f5f1ea", fontFamily: "CommuneWordmark36", letterSpacing: -0.059 * 64 }}>{ch}</Text>
  </Animated.View>;
}

export function Launch() {
  const flow = useFlow();
  const active = useActive();
  useEffect(() => {
    const t = setTimeout(() => { if (active) flow.go(startScreen(flow.ctx.arrived)); }, 2300);
    return () => clearTimeout(t);
    // Runs once when the launch shows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <View style={{ flex: 1, backgroundColor: O.frame, alignItems: "center", justifyContent: "center", gap: 16 }}>
    <View accessible accessibilityLabel="commune." style={{ flexDirection: "row" }}>
      {LETTERS.map((ch, i) => <Letter key={i} ch={ch} i={i} />)}
    </View>
    <Rise delay={1050} from={6} duration={600}>
      <Text style={{ fontSize: 16, fontFamily: "DMSans_400Regular", color: "rgba(245,241,234,0.62)", letterSpacing: -0.16 }}>Live together. Keep it fair.</Text>
    </Rise>
  </View>;
}

/* ---------- pick: who are you sharing with? ---------- */

const PICK_ORDER: GroupKey[] = ["home", "trip", "night", "work"];

export function Pick() {
  const flow = useFlow();
  const hi = useClockGroup();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tileW = (width - 40 - 10) / 2;
  const [pressed, setPressed] = useState<GroupKey | null>(null);
  const pick = (g: GroupKey) => {
    haptic.select();
    setPressed(g);
    flow.choose(g);
    setTimeout(() => flow.go("intro"), 220);
  };
  return <View style={{ flex: 1, backgroundColor: O.stage }}>
    <View style={{ marginTop: Math.max(insets.top, 20) + 10, paddingHorizontal: 20 }}><Wordmark size={27} /></View>
    <View style={{ paddingTop: 22, paddingHorizontal: 22 }}>
      <Text style={[type.eyebrow, { color: O.stageInk, opacity: 0.7, marginBottom: 10 }]}>Welcome</Text>
      <Text accessibilityRole="header" style={[type.h1, { fontSize: 36, lineHeight: 37.5, color: O.stageInk }]}>Who are you sharing with?</Text>
      <Text style={{ marginTop: 10, fontSize: 15, lineHeight: 15 * 1.45, color: O.stageInk2 }}>Pick one and we'll show you a story like yours.</Text>
    </View>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, paddingTop: 20, paddingHorizontal: 20 }}>
      {PICK_ORDER.map((g, i) => {
        const group = GROUPS[g];
        const on = g === hi;
        return <Rise key={g} delay={260 + i * 70} from={18} duration={620}>
          <PressScale accessibilityRole="button" accessibilityLabel={`${group.t}. ${group.s}${on ? ". Right now" : ""}`} accessibilityState={{ selected: pressed === g }}
            onPress={() => pick(g)} style={{ width: tileW, height: tileW * 1.12, borderRadius: 22, overflow: "hidden", backgroundColor: "#222" }}>
            <Image source={img(group.img)} style={FILL} resizeMode="cover" />
            <Shade stops={[[0.4, "rgba(0,0,0,0)"], [1, "rgba(9,14,10,0.78)"]]} />
            {on ? <View style={{ position: "absolute", top: 10, left: 10, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: O.pale }}>
              <Text style={{ fontSize: 11.5, fontWeight: "600", color: O.onSettled }}>Right now</Text>
            </View> : null}
            <View style={{ position: "absolute", left: 13, right: 12, bottom: 12 }}>
              <Text style={{ fontSize: 16, lineHeight: 19, fontWeight: "600", color: "#fff" }}>{group.t}</Text>
              <Text style={{ fontSize: 12, lineHeight: 15.6, color: "rgba(255,255,255,0.82)", marginTop: 3 }}>{group.s}</Text>
            </View>
            {on ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 22, borderWidth: 2, borderColor: O.pale }]} /> : null}
          </PressScale>
        </Rise>;
      })}
    </View>
    <View style={{ marginTop: "auto", paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 20) + 14, gap: 4, alignItems: "center" }}>
      <LinkBtn text="Just show me a story" color={O.stageInk2} onPress={() => { flow.choose(null); flow.go("intro"); }} />
      <LinkBtn text="I already have an account." strong="Sign in" color={O.stageInk2} strongColor={O.stageInk} onPress={() => flow.go("signin")} />
    </View>
  </View>;
}

/* ---------- invited: their real commune, real names, no cast ---------- */

function KenBurns({ source, from = 1.08, duration = 6000 }: { source: number; from?: number; duration?: number }) {
  const calm = useCalm();
  const s = useSharedValue(calm ? 1 : from);
  useEffect(() => { if (!calm) s.value = withTiming(1, { duration, easing: EASE_OUT }); }, [calm, duration, s]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.Image source={source} resizeMode="cover" style={[FILL, a]} />;
}

export function Invited() {
  const flow = useFlow();
  const insets = useSafeAreaInsets();
  const I = flow.inv;
  const ppl = I.people;
  const you = (flow.name.trim() || "Y").charAt(0).toUpperCase();
  return <View style={{ flex: 1, backgroundColor: O.stage }}>
    <KenBurns source={img(I.img)} />
    <Shade stops={[[0, "rgba(10,30,70,0.3)"], [0.26, "rgba(10,30,70,0)"], [0.46, "rgba(9,14,10,0.35)"], [0.7, "rgba(9,14,10,0.86)"], [1, "rgba(9,14,10,0.94)"]]} />
    <View style={{ marginTop: Math.max(insets.top, 20) + 10, paddingHorizontal: 18 }}><Wordmark size={27} /></View>
    <View style={{ position: "absolute", left: 0, right: 0, bottom: 150 + Math.max(insets.bottom - 20, 0), paddingHorizontal: 22 }}>
      <Rise delay={300}><Text style={[type.eyebrow, { color: "#fff", opacity: 0.85, marginBottom: 12 }]}>You're invited</Text></Rise>
      <Rise delay={390}><Text accessibilityRole="header" style={[type.h1, { fontSize: 36, lineHeight: 37.5, color: "#fff" }]}>{`${I.by} added you to ${I.commune}.`}</Text></Rise>
      <Rise delay={480} style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16 }}>
        <View style={{ flexDirection: "row" }}>
          {ppl.map((n, i) => <Ini key={n} name={n} i={i} size={34} style={{ marginLeft: i ? -9 : 0, borderWidth: 2, borderColor: "#10161e" }} />)}
          <YouAv size={34} initial={you} style={{ marginLeft: -9, borderWidth: 2, borderColor: "#10161e" }} />
        </View>
        <Text style={{ flex: 1, fontSize: 13.5, lineHeight: 18, color: "rgba(245,241,234,0.82)" }}>{`${ppl.slice(0, -1).join(", ")} and ${ppl[ppl.length - 1]} are already in.`}</Text>
      </Rise>
      <Rise delay={570}>
        <Glass alpha={0.86} style={{ marginTop: 16, paddingVertical: 12, paddingHorizontal: 14 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ fontSize: 12, color: O.ink2 }}>Waiting for you</Text><Text style={{ fontSize: 12, color: O.ink2 }}>{I.short}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
            <Ini name={I.by} i={0} size={38} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 14.5, lineHeight: 17.5, fontWeight: "600", color: O.ink }}>Your share so far</Text>
              <Text style={{ fontSize: 12.5, color: O.ink2, marginTop: 2 }}>{`${I.owe.what.charAt(0).toUpperCase()}${I.owe.what.slice(1)}, to ${I.by}`}</Text>
            </View>
            <Text style={[type.num, { fontSize: 18, fontWeight: "600", color: O.ink }]}>{I.owe.amt}</Text>
          </View>
        </Glass>
      </Rise>
      <Rise delay={660} style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
        {I.facts.map((f) => <View key={f} style={{ paddingVertical: 7, paddingHorizontal: 11, borderRadius: 999, backgroundColor: "rgba(245,241,234,0.14)" }}>
          <Text style={{ fontSize: 12, fontWeight: "500", color: "rgba(245,241,234,0.9)" }}>{f}</Text>
        </View>)}
      </Rise>
    </View>
    <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 16) + 14, gap: 10 }}>
      <Pill label={`Join ${I.commune}`} onPress={() => flow.go("signup")} />
      <LinkBtn text="Already on Commune?" strong="Sign in" color="#fff" onPress={() => flow.go("signin")} style={{ padding: 10 }} />
    </View>
  </View>;
}

/* ---------- intro: the story player ---------- */

const BEAT_MS = 5500;

/**
 * One story photo, anchored on its group of people. A photo is 2:3 and a
 * phone is taller, so a full-height photo shows only part of its width; when
 * the group is wider than that, the photo is drawn smaller with a soft
 * blurred copy behind it, so nobody is cut off.
 */
function Slide({ k, on }: { k: ImageKey; on: boolean }) {
  const { width: W, height: H } = useWindowDimensions();
  const calm = useCalm();
  const opacity = useSharedValue(on ? 1 : 0);
  const zoom = useSharedValue(1);
  useEffect(() => {
    opacity.value = withTiming(on ? 1 : 0, { duration: calm ? 300 : 1100, easing: Easing.inOut(Easing.ease) });
    if (on && !calm) { zoom.value = 1.035; zoom.value = withTiming(1, { duration: 7500, easing: EASE_OUT }); }
  }, [on, calm, opacity, zoom]);
  const a = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: zoom.value }] }));
  const layout = useMemo(() => {
    const vis = Math.min(1, (W / H) / PHOTO_RATIO);
    const [c, wide] = FOCAL[k] ?? [0.5, 0];
    const F = wide ? Math.min(1, Math.max(vis, wide + 0.06)) : 0;
    if (!wide || F <= vis + 0.001) {
      const imgH = vis < 1 ? H : W / PHOTO_RATIO;
      const imgW = imgH * PHOTO_RATIO;
      const left = Math.min(Math.max(c - vis / 2, 0), 1 - vis);
      return { fit: false, imgW, imgH, x: -left * imgW, y: (H - imgH) / 2 };
    }
    const imgW = W / F;
    const imgH = imgW / PHOTO_RATIO;
    const left = Math.min(Math.max(c - F / 2, 0), 1 - F);
    return { fit: true, imgW, imgH, x: -left * imgW, y: (H - imgH) * 0.32 };
  }, [W, H, k]);
  const id = `m-${k}`;
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, a]}>
    {layout.fit ? <>
      <Image source={img(k)} blurRadius={34} resizeMode="cover" style={{ position: "absolute", top: -60, left: -60, width: W + 120, height: H + 120, opacity: 0.92 }} />
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#fff" stopOpacity={0} /><Stop offset="0.07" stopColor="#fff" stopOpacity={1} />
            <Stop offset="0.91" stopColor="#fff" stopOpacity={1} /><Stop offset="1" stopColor="#fff" stopOpacity={0} />
          </LinearGradient>
          <Mask id={id}><Rect x={layout.x} y={layout.y} width={layout.imgW} height={layout.imgH} fill={`url(#${id}g)`} /></Mask>
        </Defs>
        <SvgImage href={IMAGES[k]} x={layout.x} y={layout.y} width={layout.imgW} height={layout.imgH} preserveAspectRatio="xMidYMid slice" mask={`url(#${id})`} />
      </Svg>
    </> : <Image source={img(k)} style={{ position: "absolute", left: layout.x, top: layout.y, width: layout.imgW, height: layout.imgH }} />}
    {CLOUDS[k] && <Clouds k={CLOUDS[k]!} on={on} box={layout} />}
  </Animated.View>;
}

/** A photo's high clouds on their own layer, drifting slowly sideways (9 s each way). Still under Reduce Motion. */
function Clouds({ k, on, box }: { k: ImageKey; on: boolean; box: { imgW: number; imgH: number; x: number; y: number } }) {
  const calm = useCalm();
  const drift = useSharedValue(-10);
  useEffect(() => {
    cancelAnimation(drift);
    if (on && !calm) drift.value = withRepeat(withTiming(12, { duration: 9000, easing: Easing.inOut(Easing.ease) }), -1, true);
    else drift.value = withTiming(0, { duration: 400 });
    return () => cancelAnimation(drift);
  }, [on, calm, drift]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: drift.value }] }));
  return <Animated.Image source={img(k)} style={[{ position: "absolute", left: box.x, top: box.y, width: box.imgW, height: box.imgH }, a]} />;
}

function Bar({ state, progress }: { state: "done" | "now" | "later"; progress: ReturnType<typeof useSharedValue<number>> }) {
  const a = useAnimatedStyle(() => ({ width: `${(state === "done" ? 1 : state === "now" ? progress.value : 0) * 100}%` }));
  return <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.35)", overflow: "hidden" }}>
    <Animated.View style={[{ height: 3, backgroundColor: "#fff" }, a]} />
  </View>;
}

function Toast({ beat, first }: { beat: Beat; first: boolean }) {
  const calm = useCalm();
  const shake = useSharedValue(0);
  useEffect(() => {
    if (beat.chat && !calm) shake.value = withDelay(1250, withSequence(
      withTiming(-5, { duration: 105 }), withTiming(5, { duration: 105 }), withTiming(-3, { duration: 105 }), withTiming(0, { duration: 105 })));
  }, [beat, calm, shake]);
  const s = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const who = (beat.chat ?? beat.note)!.who;
  const c = CAST[who];
  return <Rise delay={first ? 900 : 520} from={18} duration={640} scale={0.97}>
    <Animated.View style={s}>
      <Glass alpha={beat.chat ? 0.94 : 0.82} style={{ flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 12, paddingHorizontal: 14 }}>
        <Image source={img(c.av)} style={{ width: 38, height: 38, borderRadius: 19 }} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
            {beat.chat ? <Text style={{ fontSize: 12, color: O.ink2 }}>{beat.chat.from}</Text>
              : <Text style={{ fontSize: 12, fontWeight: "600", color: O.ink }}>commune.</Text>}
            <Text style={{ fontSize: 12, color: O.ink2 }}>{beat.note?.w ?? "now"}</Text>
          </View>
          {beat.chat ? <>
            <Text style={{ fontSize: 13, lineHeight: 16, fontWeight: "600", color: O.ink2 }}>{c.n}</Text>
            <Text style={{ fontSize: 15, lineHeight: 19.5, fontWeight: "500", color: O.ink }}>{beat.chat.t}</Text>
          </> : <>
            <Text style={{ fontSize: 14.5, lineHeight: 18, fontWeight: "600", color: O.ink }}>{beat.note!.t}</Text>
            <Text style={{ fontSize: 13.5, lineHeight: 17.5, color: O.ink2 }}>{beat.note!.s}</Text>
          </>}
        </View>
      </Glass>
    </Animated.View>
  </Rise>;
}

function CastRow({ cast, first, onMeet }: { cast: CastId[]; first: boolean; onMeet(k: CastId): void }) {
  return <View style={{ paddingHorizontal: 14 }}>
    <Glass radius={24} style={{ flexDirection: "row", paddingTop: 12, paddingBottom: 10, paddingHorizontal: 8 }}>
      {cast.map((k, i) => <Rise key={k} delay={(first ? 900 : 420) + i * 70} from={14} duration={600} style={{ flex: 1 }}>
        <PressScale accessibilityRole="button" accessibilityLabel={`Meet ${CAST[k].n}`} onPress={() => { haptic.select(); onMeet(k); }} scaleTo={0.94} style={{ alignItems: "center", gap: 6 }}>
          <Av who={k} size={46} ring="#fff" />
          <Text style={{ fontSize: 12, fontWeight: "500", color: O.ink }}>{CAST[k].n.split(" ")[0] + (k === "jp" ? " P" : "")}</Text>
        </PressScale>
      </Rise>)}
    </Glass>
    <Text style={{ marginTop: 10, textAlign: "center", fontSize: 12.5, fontWeight: "500", color: "rgba(255,255,255,0.85)" }}>Tap someone to meet them</Text>
  </View>;
}

function Profile({ who, onClose }: { who: CastId | null; onClose(): void }) {
  const [shown, setShown] = useState<CastId>(who ?? "jp");
  useEffect(() => { if (who) setShown(who); }, [who]);
  const c = CAST[shown];
  return <Drawer open={!!who} onClose={onClose} label="Profile" style={{ paddingTop: 0, paddingHorizontal: 0, overflow: "hidden" }}>
    <View style={{ position: "absolute", top: 8, left: 0, right: 0, zIndex: 3 }}><View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.7)", alignSelf: "center" }} /></View>
    <CloseX onPress={onClose} style={{ position: "absolute", top: 14, right: 14, zIndex: 3, backgroundColor: "rgba(255,255,255,0.85)" }} />
    <Image source={img(c.img)} resizeMode="cover" style={{ height: 300, width: "100%" }} />
    <View style={{ paddingTop: 18, paddingHorizontal: 22 }}>
      <Text style={[type.eyebrow, { color: O.action }]}>{c.role}</Text>
      <Text style={{ marginTop: 8, fontSize: 34, lineHeight: 36, letterSpacing: -1, color: O.ink }}>{c.n}</Text>
      <Text style={{ marginTop: 10, fontSize: 15, lineHeight: 21.75, color: O.ink2 }}>{c.line}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
        {c.facts.map((f) => <View key={f} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: O.surface, borderWidth: 1, borderColor: O.outline2 }}>
          <Text style={{ fontSize: 13, fontWeight: "500", color: O.ink }}>{f}</Text>
        </View>)}
      </View>
      <Text style={{ marginTop: 14, fontSize: 12, color: O.ink2 }}>One of the six at 14 Park Street. They turn up in every story.</Text>
    </View>
  </Drawer>;
}

export function Intro() {
  const flow = useFlow();
  const active = useActive();
  const insets = useSafeAreaInsets();
  const calm = useCalm();
  const beats = flow.story.beats;
  const imgs = useMemo(() => [...new Set(beats.map((b) => b.img))], [beats]);
  const [si, setSi] = useState(0);
  const [first, setFirst] = useState(true);
  const [meet, setMeet] = useState<CastId | null>(null);
  const progress = useSharedValue(0);
  const paused = useRef(false);
  const activeRef = useRef(active);
  activeRef.current = active;

  const show = useCallback((i: number) => {
    setFirst(false);
    setSi((i + beats.length) % beats.length);
  }, [beats.length]);
  const next = useCallback(() => { if (activeRef.current && !paused.current) show(si + 1); }, [show, si]);
  const run = useCallback((from: number) => {
    cancelAnimation(progress);
    progress.value = from;
    progress.value = withTiming(1, { duration: (1 - from) * BEAT_MS, easing: Easing.linear }, (done) => { if (done) runOnJS(next)(); });
  }, [progress, next]);
  useEffect(() => { paused.current = false; run(0); return () => cancelAnimation(progress); }, [si, run, progress]);
  // A new story (picked again) starts from its first slide.
  useEffect(() => { setSi(0); setFirst(true); }, [flow.story.id]);

  const pause = () => { if (paused.current) return; paused.current = true; cancelAnimation(progress); };
  const resume = () => { if (!paused.current) return; paused.current = false; run(progress.value); };

  // Not the one they wanted? Swipe right, or the back button, to pick again.
  const { width: SW } = useWindowDimensions();
  const canPick = flow.mode !== "invite";
  const dragX = useSharedValue(0);
  const pickAgain = () => { pause(); haptic.select(); flow.backTo("pick"); };
  const swipe = Gesture.Pan().enabled(canPick).activeOffsetX(16).failOffsetY([-14, 14])
    .onStart(() => { runOnJS(pause)(); })
    .onUpdate((e) => { dragX.value = Math.max(0, e.translationX); })
    .onEnd((e) => {
      if (e.translationX > SW * 0.3 || (e.velocityX > 800 && e.translationX > 40)) runOnJS(pickAgain)();
      else { dragX.value = withTiming(0, { duration: 340, easing: EASE_OUT }); runOnJS(resume)(); }
    });
  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateX: dragX.value }] }));
  const st = beats[si];
  const held = useRef(false);
  const tap = (dir: 1 | -1) => ({
    onPressIn: () => { held.current = false; },
    onLongPress: () => { held.current = true; pause(); },
    onPressOut: () => { if (held.current) resume(); },
    onPress: () => { if (!held.current) { haptic.select(); show(si + dir); } },
    delayLongPress: 260,
  });

  return <GestureDetector gesture={swipe}><Animated.View style={[{ flex: 1, backgroundColor: O.stage2 }, dragStyle]}>
    {imgs.map((k) => <Slide key={k} k={k} on={st.img === k} />)}
    <Shade stops={[[0, "rgba(10,30,70,0.38)"], [0.34, "rgba(10,30,70,0)"], [0.52, "rgba(0,0,0,0)"], [0.74, "rgba(9,14,10,0.55)"], [1, "rgba(9,14,10,0.88)"]]} />
    <View style={{ zIndex: 3, marginTop: Math.max(insets.top, 20) + 10, paddingHorizontal: 18, gap: 14 }}>
      <View style={{ flexDirection: "row", gap: 5 }}>
        {beats.map((_, k) => <Bar key={k} state={k < si ? "done" : k === si ? "now" : "later"} progress={progress} />)}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Wordmark size={27} />
        {canPick ? <PressScale accessibilityRole="button" accessibilityLabel="Pick a different story" hitSlop={8} onPress={pickAgain}
          style={{ height: 34, paddingHorizontal: 14, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.16)" }}>
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>Other stories</Text>
        </PressScale> : null}
      </View>
    </View>
    <View key={`copy-${si}-${flow.story.id}`} style={{ zIndex: 3, paddingTop: 14, paddingHorizontal: 22 }}>
      <Rise delay={first ? 500 : 120}><Text style={[type.eyebrow, { color: "#fff", opacity: 0.85, marginBottom: 12 }]}>{st.e}</Text></Rise>
      <Rise delay={first ? 590 : 210}>
        <Text accessibilityRole="header" style={[type.h1, { fontSize: 40, lineHeight: 41.6, color: "#fff", textShadowColor: "rgba(0,30,80,0.25)", textShadowRadius: 24, textShadowOffset: { width: 0, height: 2 } }]}>{st.h}</Text>
      </Rise>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Previous story" {...tap(-1)} style={{ position: "absolute", zIndex: 2, top: 120, bottom: 280, left: 0, width: "40%" }} />
    <Pressable accessibilityRole="button" accessibilityLabel="Next story" {...tap(1)} style={{ position: "absolute", zIndex: 2, top: 120, bottom: 280, right: 0, width: "40%" }} />
    <View key={`card-${si}-${flow.story.id}`} style={{ position: "absolute", zIndex: 4, left: 0, right: 0, bottom: 200 + Math.max(insets.bottom - 20, 0) }} pointerEvents="box-none">
      {st.cast ? <CastRow cast={flow.story.cast} first={first} onMeet={(k) => { pause(); setMeet(k); }} />
        : <View style={{ paddingHorizontal: 16, marginBottom: 8 }}><Toast beat={st} first={first} /></View>}
    </View>
    <View style={{ position: "absolute", zIndex: 5, left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 16) + 14, gap: 10 }}>
      <Pill label="Get started" onPress={() => { pause(); flow.go("demo-split"); }} />
      <LinkBtn text="I already have an account." strong="Sign in" color="#fff" onPress={() => { pause(); flow.go("signin"); }} style={{ padding: 10 }} />
    </View>
    <Profile who={meet} onClose={() => { setMeet(null); if (!calm || true) resume(); }} />
  </Animated.View></GestureDetector>;
}
