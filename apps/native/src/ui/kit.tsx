import type { ReactNode } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { calParts, initials } from "../lib/format";
import type { Tone } from "../lib/derive";
import { radius, useTheme, type Palette } from "./theme";

export function tap(kind: "light" | "success" = "light") {
  // Haptics are a nicety; the web build and older phones simply skip them.
  const run = kind === "success"
    ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  run.catch(() => undefined);
}

type TextKind = "display" | "headline" | "title" | "section" | "body" | "bodyL" | "label" | "note" | "strong" | "amount";
const TEXT: Record<TextKind, TextStyle> = {
  display: { fontSize: 31, lineHeight: 35, fontWeight: "500", letterSpacing: -0.7 },
  headline: { fontSize: 28, lineHeight: 34, fontWeight: "600", letterSpacing: -0.5 },
  title: { fontSize: 21, lineHeight: 28, fontWeight: "600", letterSpacing: -0.25 },
  section: { fontSize: 17, lineHeight: 24, fontWeight: "600", letterSpacing: -0.13 },
  body: { fontSize: 14, lineHeight: 20 },
  bodyL: { fontSize: 15.5, lineHeight: 23 },
  label: { fontSize: 13, lineHeight: 18 },
  note: { fontSize: 12, lineHeight: 16 },
  strong: { fontSize: 15, lineHeight: 21, fontWeight: "600" },
  amount: { fontSize: 15, lineHeight: 20, fontWeight: "600", letterSpacing: -0.15, fontVariant: ["tabular-nums"] },
};

export function T({ kind = "body", muted, color, style, children, lines, ...rest }: {
  kind?: TextKind; muted?: boolean; color?: string; style?: StyleProp<TextStyle>; children: ReactNode; lines?: number;
  accessibilityRole?: "header" | "text";
}) {
  const { c } = useTheme();
  return <Text {...rest} numberOfLines={lines} style={[TEXT[kind], { color: color ?? (muted ? c.ink2 : c.ink), flexShrink: 1 }, style]}>{children}</Text>;
}

export function Button({ label, onPress, variant = "primary", size = "md", block, disabled, busy, icon, accessibilityLabel, onFrame }: {
  label: string; onPress?: () => void; variant?: "primary" | "secondary" | "quiet" | "danger"; size?: "sm" | "md" | "lg";
  block?: boolean; disabled?: boolean; busy?: boolean; icon?: ReactNode; accessibilityLabel?: string; onFrame?: boolean;
}) {
  const { c } = useTheme();
  const height = size === "lg" ? 48 : size === "sm" ? 34 : 42;
  const bg = variant === "primary" ? c.action : variant === "quiet" ? "transparent" : c.surface;
  const fg = variant === "primary" ? c.onAction : variant === "danger" ? c.late : onFrame ? c.onFrame : c.ink;
  return <Pressable
    accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }}
    disabled={disabled || busy}
    onPress={() => { tap(); onPress?.(); }}
    style={({ pressed }) => [{
      height, paddingHorizontal: size === "sm" ? 14 : size === "lg" ? 22 : 18, borderRadius: radius.pill, backgroundColor: bg,
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, alignSelf: block ? "stretch" : "flex-start",
      opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
    }, variant === "secondary" || variant === "danger" ? { borderWidth: 1, borderColor: variant === "danger" ? c.late : c.outline } : null]}>
    {busy ? <ActivityIndicator color={fg} /> : <>{icon}<Text style={{ color: fg, fontSize: size === "lg" ? 15.5 : size === "sm" ? 13 : 14, fontWeight: "500" }}>{label}</Text></>}
  </Pressable>;
}

export function Panel({ children, pad, style }: { children: ReactNode; pad?: boolean; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <View style={[{ backgroundColor: c.surface, borderRadius: radius.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: c.outline, overflow: "hidden" }, pad ? { padding: 20, gap: 12 } : null, style]}>{children}</View>;
}

export function Row({ left, title, meta, right, onPress, first, accessibilityLabel }: {
  left?: ReactNode; title: ReactNode; meta?: ReactNode; right?: ReactNode; onPress?: () => void; first?: boolean; accessibilityLabel?: string;
}) {
  const { c } = useTheme();
  const body = <>
    {left}
    <View style={{ flex: 1, minWidth: 0 }}>
      {typeof title === "string" ? <T kind="body" style={{ fontSize: 15, lineHeight: 21, fontWeight: "500" }}>{title}</T> : title}
      {meta ? <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 8, rowGap: 2, marginTop: 2 }}>{meta}</View> : null}
    </View>
    {right}
  </>;
  const style = { flexDirection: "row" as const, alignItems: "center" as const, gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth, borderTopColor: c.outline };
  return onPress
    ? <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [style, pressed ? { backgroundColor: c.press } : null]}>{body}</Pressable>
    : <View style={style}>{body}</View>;
}

export function Meta({ children }: { children: ReactNode }) {
  return <T kind="label" muted>{children}</T>;
}

export function Cal({ iso, today, small }: { iso: string | null; today: string; small?: boolean }) {
  const { c } = useTheme();
  const width = small ? 44 : 52;
  if (!iso) {
    return <View accessibilityLabel="No date" style={{ width, minHeight: small ? 46 : 52, borderRadius: 10, borderWidth: 1, borderStyle: "dashed", borderColor: c.calEdge, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: 9.5, fontWeight: "500", color: c.ink2 }}>No date</Text>
    </View>;
  }
  const p = calParts(iso, today);
  return <View accessibilityLabel={`${p.dow} ${p.day} ${p.mon}`} style={{ width, borderRadius: 10, borderWidth: 1, borderColor: c.calEdge, backgroundColor: c.calFace, alignItems: "center", overflow: "hidden", paddingBottom: 3 }}>
    <View style={{ alignSelf: "stretch", minHeight: 15, alignItems: "center", justifyContent: "center", backgroundColor: p.isToday ? "#2d6a4f" : c.calStrip }}>
      <Text style={{ fontSize: 9, fontWeight: "800", letterSpacing: 0.7, color: p.isToday ? "#fff" : c.calStripInk }}>{p.dow.toUpperCase()}</Text>
    </View>
    <Text style={{ fontSize: small ? 18 : 21, fontWeight: "800", letterSpacing: -0.8, color: c.ink, lineHeight: small ? 21 : 24, fontVariant: ["tabular-nums"] }}>{p.day}</Text>
    <Text style={{ fontSize: 9.5, fontWeight: "700", color: c.calStripInk }}>{p.mon}</Text>
  </View>;
}

export function State({ text, tone = "plain" }: { text: string; tone?: Tone | "settled" }) {
  const { c } = useTheme();
  const color = tone === "late" ? c.late : tone === "attention" ? c.attention : tone === "settled" ? c.onSettled : c.ink2;
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 }}>
    {tone === "settled" ? null : <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tone === "plain" ? c.outline : color }} />}
    <Text style={{ fontSize: 12.5, lineHeight: 16, fontWeight: "500", color, flexShrink: 1 }}>{text}</Text>
  </View>;
}

export function Badge({ text, tone = "plain", icon }: { text: string; tone?: "plain" | "late" | "attention" | "settled"; icon?: ReactNode }) {
  const { c } = useTheme();
  const [bg, fg] = tone === "late" ? [c.lateSoft, c.late] : tone === "attention" ? [c.attentionSoft, c.attention] : tone === "settled" ? [c.settled, c.onSettled] : [c.recessed, c.ink2];
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 5, height: 22, paddingHorizontal: 9, borderRadius: 11, backgroundColor: bg }}>
    {icon}<Text style={{ fontSize: 12, fontWeight: "500", color: fg }}>{text}</Text>
  </View>;
}

const AV = [["#d9ebe5", "#1b4332"], ["#f7e8d6", "#8a4b1f"], ["#e3e4f3", "#343a7a"], ["#f3e0e6", "#7a2f4a"], ["#e6eef6", "#24506e"]];
function toneOf(name: string, c: Palette): [string, string] {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % AV.length === 0 ? [c.settled, c.onSettled] : (AV[h % AV.length] as [string, string]);
}
export function Avatar({ name, size = 32, ring }: { name: string; size?: number; ring?: string }) {
  const { c } = useTheme();
  const [bg, fg] = toneOf(name, c);
  return <View accessibilityLabel={name} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: "center", justifyContent: "center", borderWidth: ring ? 2 : 0, borderColor: ring }}>
    <Text style={{ color: fg, fontSize: Math.round(size * 0.36), fontWeight: "600" }}>{initials(name)}</Text>
  </View>;
}
export function Faces({ names, size = 24, ring }: { names: string[]; size?: number; ring?: string }) {
  const { c } = useTheme();
  return <View style={{ flexDirection: "row" }}>
    {names.slice(0, 5).map((name, index) => <View key={`${name}-${index}`} style={{ marginLeft: index ? -7 : 0 }}><Avatar name={name} size={size} ring={ring ?? c.surface} /></View>)}
  </View>;
}

/** A person with the commune's photo at their shoulder. */
export function Who({ name, photo, size = 40 }: { name: string; photo: string; size?: number }) {
  const { c } = useTheme();
  return <View style={{ width: size, height: size }}>
    <Avatar name={name} size={size} />
    <Image source={{ uri: photo }} accessibilityIgnoresInvertColors style={{ position: "absolute", right: -4, bottom: -4, width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: c.surface }} />
  </View>;
}

export function SectionHead({ title, count, right }: { title: string; count?: number; right?: ReactNode }) {
  const { c } = useTheme();
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 }}>
    <T kind="section" accessibilityRole="header">{title}</T>
    {count != null ? <View style={{ minWidth: 22, height: 22, paddingHorizontal: 7, borderRadius: 11, backgroundColor: c.recessed, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: 12, fontWeight: "600", color: c.ink2 }}>{count}</Text></View> : null}
    <View style={{ flex: 1 }} />
    {right}
  </View>;
}

export function Group({ label, count, late, first }: { label: string; count: number; late?: boolean; first?: boolean }) {
  const { c } = useTheme();
  return <View style={{ flexDirection: "row", gap: 8, paddingTop: 10, paddingBottom: 6, paddingHorizontal: 16, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth, borderTopColor: c.outline }}>
    <Text style={{ fontSize: 12, fontWeight: "600", color: late ? c.late : c.ink }}>{label}</Text>
    <Text style={{ fontSize: 12, fontWeight: "500", color: c.ink2 }}>{count}</Text>
  </View>;
}

/** Small grey heading above a list, like "Owed to you · euros". */
export function Kicker({ children }: { children: ReactNode }) {
  return <T kind="label" muted style={{ fontWeight: "600", paddingHorizontal: 4, textTransform: "none" }}>{children}</T>;
}

export function Empty({ title, body, icon }: { title: string; body?: string; icon?: ReactNode }) {
  const { c } = useTheme();
  return <View style={{ padding: 22, gap: 6, alignItems: "flex-start" }}>
    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.settled, alignItems: "center", justifyContent: "center", marginBottom: 4 }}>{icon}</View>
    <T kind="strong">{title}</T>
    {body ? <T kind="body" muted>{body}</T> : null}
  </View>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  if (!children) return null;
  return <Text accessibilityRole="alert" style={{ color: c.late, fontSize: 13, lineHeight: 18, fontWeight: "500" }}>{children}</Text>;
}

/** A list of tappable settings-style rows. */
export function List({ children }: { children: ReactNode }) {
  return <Panel>{children}</Panel>;
}
