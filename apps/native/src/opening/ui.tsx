/**
 * The building blocks of the opening flow, drawn to prototype v6: the same
 * colours, type sizes, pills and drawers, and the same calm motion (one
 * easing, no bounce). Colours are the app's light tokens; the opening is
 * designed for the light canvas.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { Image, Pressable, StyleSheet, View, useWindowDimensions, type ImageStyle, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { Text } from "../ui/text";
import { PressScale, haptic, useCalm } from "../ui/motion";
import { IMAGES, type ImageKey } from "./images";
import { CAST, type CastId } from "./stories";
import type { Who } from "./engine";

export const O = {
  stage: "#0e1622", stage2: "#14243b", stageInk: "#f5f1ea", stageInk2: "rgba(245,241,234,0.6)",
  canvas: "#f5f1ea", recessed: "#eee8de", surface: "#ffffff", frame: "#1a1e2b",
  ink: "#1a1e2b", ink2: "#59675f", outline: "rgba(26,30,43,0.13)", outline2: "rgba(26,30,43,0.075)",
  action: "#2d6a4f", actionPress: "#1b4332", pale: "#dce8d3", settled: "#d9ebe5", onSettled: "#1b4332",
  attention: "#8a4b1f", attentionSoft: "#f7e8d6", monzo: "#14233c",
};
export const EASE = Easing.bezier(0.32, 0.72, 0, 1);
export const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);

/** Initials for real people: four soft tints, never a cast face. */
export const TINTS: Array<[string, string]> = [["#dce8d3", "#1b4332"], ["#f7e8d6", "#8a4b1f"], ["#d9ebe5", "#1b4332"], ["#eee8de", "#59675f"]];

export function img(key: ImageKey) { return IMAGES[key]; }
/** A photo filling its box. Width and height are given so the web build doesn't fall back to the file's own size. */
export const FILL = { position: "absolute" as const, top: 0, left: 0, width: "100%" as const, height: "100%" as const };

export function Wordmark({ size, color = "#fff", style }: { size: number; color?: string; style?: StyleProp<TextStyle> }) {
  return <Text accessibilityLabel="commune." style={[{ fontSize: size, color, fontFamily: size >= 30 ? "CommuneWordmark36" : "CommuneWordmark25", letterSpacing: -0.059 * size, lineHeight: size * 1.1 }, style]}>commune.</Text>;
}

export const type = StyleSheet.create({
  h1: { fontSize: 38, lineHeight: 38 * 1.04, letterSpacing: -0.035 * 38, fontWeight: "400" },
  h2: { fontSize: 31, lineHeight: 31 * 1.08, letterSpacing: -0.03 * 31, fontWeight: "400", color: O.ink },
  lede: { fontSize: 16, lineHeight: 16 * 1.45, color: O.ink2, marginTop: 10 },
  eyebrow: { fontSize: 11.5, lineHeight: 13, letterSpacing: 0.11 * 11.5, fontWeight: "600", textTransform: "uppercase" },
  small: { fontSize: 13, lineHeight: 13 * 1.45, color: O.ink2 },
  num: { fontVariant: ["tabular-nums"] },
});

/** Items on a screen arrive one after another: a rise of 14 and a fade, 55 ms apart. */
export function St({ i = 0, children, style, base = 130 }: { i?: number; children: ReactNode; style?: StyleProp<ViewStyle>; base?: number }) {
  const calm = useCalm();
  const p = useSharedValue(calm ? 1 : 0);
  useEffect(() => { if (!calm) p.value = withDelay(base + i * 55, withTiming(1, { duration: 620, easing: EASE })); }, [calm, i, base, p]);
  const a = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: (1 - p.value) * 14 }] }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/** A rise and fade after a delay, for one-off arrivals. */
export function Rise({ delay = 0, from = 16, duration = 700, children, style, scale }: { delay?: number; from?: number; duration?: number; children: ReactNode; style?: StyleProp<ViewStyle>; scale?: number }) {
  const calm = useCalm();
  const p = useSharedValue(calm ? 1 : 0);
  useEffect(() => { if (!calm) p.value = withDelay(delay, withTiming(1, { duration, easing: EASE })); }, [calm, delay, duration, p]);
  const a = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: (1 - p.value) * from }, { scale: scale ? scale + (1 - scale) * p.value : 1 }] }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

type PillKind = "action" | "light" | "black" | "ghost" | "glass";
export function Pill({ label, onPress, kind = "action", icon, disabled, height = 56, fontSize = 17, style, accessibilityLabel }: {
  label: ReactNode; onPress?: () => void; kind?: PillKind; icon?: ReactNode; disabled?: boolean; height?: number; fontSize?: number; style?: StyleProp<ViewStyle>; accessibilityLabel?: string;
}) {
  const bg = { action: O.action, light: "#fff", black: "#000", ghost: "transparent", glass: "rgba(255,255,255,0.16)" }[kind];
  const fg = kind === "light" || kind === "ghost" ? O.ink : "#fff";
  const ring = kind === "light" ? O.outline : kind === "ghost" ? O.outline : kind === "glass" ? "rgba(255,255,255,0.28)" : "transparent";
  return <PressScale accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? (typeof label === "string" ? label : undefined)} accessibilityState={{ disabled: !!disabled }}
    disabled={disabled} scaleTo={0.975} onPress={() => { haptic.light(); onPress?.(); }}
    style={({ pressed }) => [{ height, borderRadius: 999, backgroundColor: pressed && kind === "action" ? O.actionPress : bg, borderWidth: kind === "ghost" ? 1.5 : kind === "light" || kind === "glass" ? 1 : 0, borderColor: ring,
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, opacity: disabled ? 0.35 : 1, alignSelf: "stretch" }, style]}>
    {icon}
    {typeof label === "string" ? <Text style={{ color: fg, fontSize, fontWeight: "600", letterSpacing: -0.01 * fontSize }}>{label}</Text> : label}
  </PressScale>;
}

/** A quiet text button. Bold part goes in `strong`. */
export function LinkBtn({ text, strong, onPress, color = O.ink, strongColor, style, size = 15 }: { text: string; strong?: string; onPress: () => void; color?: string; strongColor?: string; style?: StyleProp<ViewStyle>; size?: number }) {
  return <Pressable accessibilityRole="button" onPress={onPress} hitSlop={6} style={({ pressed }) => [{ padding: 12, alignItems: "center", opacity: pressed ? 0.6 : 1 }, style]}>
    <Text style={{ fontSize: size, fontWeight: "500", color, textAlign: "center" }}>{text}{strong ? <Text style={{ fontWeight: "600", color: strongColor ?? color }}>{` ${strong}`}</Text> : null}</Text>
  </Pressable>;
}

export function Chevron({ color = O.ink, size = 18 }: { color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><Path d="M15 18l-6-6 6-6" /></Svg>;
}
export function Tick({ size = 14, color = "#fff", width = 3 }: { size?: number; color?: string; width?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round"><Path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>;
}
export function Cross({ size = 14, color = O.ink }: { size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round"><Path d="M6 6l12 12M18 6L6 18" /></Svg>;
}

/** The progress dashes in a top bar: done ones fill with sage. */
function Prog({ done, total }: { done: number; total: number }) {
  return <View style={{ flex: 1, flexDirection: "row", gap: 5 }}>
    {Array.from({ length: total }, (_, i) => <ProgBit key={i} on={i < done} />)}
  </View>;
}
function ProgBit({ on }: { on: boolean }) {
  const p = useSharedValue(0);
  useEffect(() => { p.value = withTiming(on ? 1 : 0, { duration: 600, easing: EASE }); }, [on, p]);
  const a = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));
  return <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: O.outline, overflow: "hidden" }}>
    <Animated.View style={[{ height: 4, backgroundColor: O.action }, a]} />
  </View>;
}

export function TopBar({ onBack, prog, skip, right, dark }: { onBack?: () => void; prog?: [number, number]; skip?: () => void; right?: ReactNode; dark?: boolean }) {
  const insets = useSafeAreaInsets();
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 14, height: 48, paddingHorizontal: 16, marginTop: Math.max(insets.top, 20) + 6 }}>
    {onBack ? <PressScale accessibilityRole="button" accessibilityLabel="Back" onPress={() => { haptic.select(); onBack(); }}
      style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: dark ? "rgba(255,255,255,0.08)" : O.surface, borderWidth: dark ? 0 : 1, borderColor: O.outline2 }}>
      <Chevron color={dark ? "#f5f1ea" : O.ink} />
    </PressScale> : null}
    {prog ? <Prog done={prog[0]} total={prog[1]} /> : <View style={{ flex: 1 }} />}
    {skip ? <Pressable accessibilityRole="button" onPress={skip} hitSlop={8} style={{ paddingVertical: 10, paddingHorizontal: 4 }}>
      <Text style={{ fontSize: 14, fontWeight: "600", color: O.ink2 }}>Skip</Text>
    </Pressable> : null}
    {right}
  </View>;
}

/** The bottom area that holds a screen's buttons. */
export function Foot({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  return <View style={[{ paddingTop: 12, paddingHorizontal: 24, paddingBottom: Math.max(insets.bottom, 20) + 14, gap: 10 }, style]}>{children}</View>;
}

export function Av({ who, size = 44, ring, style }: { who: Who; size?: number; ring?: string; style?: StyleProp<ViewStyle> }) {
  const r: ViewStyle = ring ? { borderWidth: 2, borderColor: ring } : {};
  if (who === "you") return <YouAv size={size} style={[r, style]} />;
  return <Image source={img(CAST[who as CastId].av)} accessibilityLabel={CAST[who as CastId].n}
    style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: O.settled }, r as ImageStyle, style as StyleProp<ImageStyle>]} />;
}
export function YouAv({ size = 44, initial = "Y", style }: { size?: number; initial?: string; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: O.frame, alignItems: "center", justifyContent: "center" }, style]}>
    <Text style={{ color: "#f5f1ea", fontSize: Math.round(size * 0.34), fontWeight: "600" }}>{initial}</Text>
  </View>;
}
export function Ini({ name, i, size = 34, style }: { name: string; i: number; size?: number; style?: StyleProp<ViewStyle> }) {
  const [bg, fg] = TINTS[i % 4];
  return <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: "center", justifyContent: "center" }, style]}>
    <Text style={{ color: fg, fontSize: Math.round(size * 0.38), fontWeight: "600" }}>{name.charAt(0)}</Text>
  </View>;
}

/** Frosted white glass for cards laid over photos. */
export function Glass({ children, style, alpha = 0.82, radius = 22 }: { children: ReactNode; style?: StyleProp<ViewStyle>; alpha?: number; radius?: number }) {
  return <View style={[{ borderRadius: radius, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 12 } }, style]}>
    <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
    <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(255,255,255,${alpha})` }]} />
    {children}
  </View>;
}

/** A vertical gradient over the whole box: [offset 0 to 1, rgba colour]. */
export function Shade({ stops, style }: { stops: Array<[number, string]>; style?: StyleProp<ViewStyle> }) {
  const id = useRef(`g${Math.random().toString(36).slice(2, 8)}`).current;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
    <Svg width="100%" height="100%" preserveAspectRatio="none">
      <Defs><LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        {stops.map(([o, col], k) => { const m = /rgba?\(([^)]+)\)/.exec(col); const parts = m ? m[1].split(",").map((x) => x.trim()) : null;
          return <Stop key={k} offset={o} stopColor={parts ? `rgb(${parts[0]},${parts[1]},${parts[2]})` : col} stopOpacity={parts && parts[3] !== undefined ? Number(parts[3]) : 1} />; })}
      </LinearGradient></Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  </View>;
}

/**
 * A plain bottom drawer: the scrim fades in, the drawer slides up, and a
 * drag down or a tap on the scrim closes it. No morphing.
 */
export function Drawer({ open, onClose, children, style, label }: { open: boolean; onClose: () => void; children: ReactNode; style?: StyleProp<ViewStyle>; label?: string }) {
  const { height } = useWindowDimensions();
  const p = useSharedValue(0);
  const drag = useSharedValue(0);
  const calm = useCalm();
  useEffect(() => {
    drag.value = 0;
    p.value = withTiming(open ? 1 : 0, { duration: calm ? 200 : 500, easing: EASE });
  }, [open, calm, p, drag]);
  const scrim = useAnimatedStyle(() => ({ opacity: p.value }));
  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - p.value) * height + Math.max(0, drag.value) }] }));
  const pan = Gesture.Pan().activeOffsetY(8).onUpdate((e) => { drag.value = e.translationY; }).onEnd((e) => {
    if (e.translationY > 110 || e.velocityY > 800) runOnJS(onClose)();
    else drag.value = withTiming(0, { duration: 300, easing: EASE });
  });
  return <View pointerEvents={open ? "auto" : "none"} style={[StyleSheet.absoluteFill, { zIndex: 50 }]}>
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(10,12,18,0.42)" }, scrim]}>
      <Pressable accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={onClose} />
    </Animated.View>
    <GestureDetector gesture={pan}>
      <Animated.View accessibilityViewIsModal={open} accessibilityLabel={label}
        style={[{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: O.canvas, borderTopLeftRadius: 28, borderTopRightRadius: 28,
          paddingTop: 8, paddingHorizontal: 20, paddingBottom: 34, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 25, shadowOffset: { width: 0, height: -20 } }, style, sheet]}>
        {children}
      </Animated.View>
    </GestureDetector>
  </View>;
}
export function Handle({ light }: { light?: boolean }) {
  return <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: light ? "rgba(255,255,255,0.7)" : O.outline, alignSelf: "center", marginBottom: 14 }} />;
}
export function CloseX({ onPress, style }: { onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return <PressScale accessibilityRole="button" accessibilityLabel="Close" onPress={onPress} style={[{ width: 32, height: 32, borderRadius: 16, backgroundColor: O.recessed, alignItems: "center", justifyContent: "center" }, style]}>
    <Cross />
  </PressScale>;
}
/** A white row inside a drawer. */
export function RowC({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: O.surface, borderRadius: 16, paddingVertical: 13, paddingHorizontal: 14, marginBottom: 8 }, style]}>{children}</View>;
}
export function MonzoMark() {
  return <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: O.monzo, alignItems: "center", justifyContent: "center" }}>
    <Svg width={16} height={14} viewBox="0 0 16 14"><Path d="M1 13V1l7 7 7-7v12" fill="none" stroke="#ff5a4f" strokeWidth={2.4} strokeLinejoin="round" /></Svg>
  </View>;
}
