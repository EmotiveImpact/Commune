import { useEffect, useRef, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from "react-native-reanimated";
import { springs, useCalm } from "./motion";
import { sheetDepth } from "./origin";
import { Text } from "./text";

/**
 * When a sheet is still up (or closing), wait for it to clear before a
 * change plays, as v7 did, so the movement is seen rather than hidden.
 */
function sheetWait() {
  return sheetDepth.value > 0.05 ? 380 : 0;
}

/** Reads the number in a string, so a roll can go up or down. */
function valueOf(text: string) {
  const n = Number(text.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/**
 * An amount that rolls when it changes (v7's rollText): each changed
 * character slides out 0.55 em while fading and the new one slides in from
 * below, staggered 45 ms from the right. Values going down roll the other
 * way. Characters that did not change stay still. Reduce Motion swaps at once.
 */
export function Rolling({ text, style, accessibilityLabel }: { text: string; style?: StyleProp<TextStyle>; accessibilityLabel?: string }) {
  const calm = useCalm();
  const prev = useRef(text);
  const roll = useRef({ from: text, wait: 0, up: true, id: 0, digits: false });
  if (prev.current !== text) {
    const shape = (value: string) => value.replace(/\d/g, "0");
    roll.current = {
      from: prev.current, wait: sheetWait(), up: valueOf(text) >= valueOf(prev.current), id: roll.current.id + 1,
      // Only a change of figures rolls; anything else ("Waiting" to "All recorded") comes in again whole.
      digits: shape(text) === shape(prev.current),
    };
    prev.current = text;
  }
  const { from, wait, up, id, digits } = roll.current;
  if (calm || id === 0 || !digits) {
    const plain = <Text accessibilityLabel={accessibilityLabel} style={style}>{text}</Text>;
    return id === 0 || calm ? plain : <Swap value={String(id)}>{plain}</Swap>;
  }
  const flat = StyleSheet.flatten(style) ?? {};
  const size = flat.fontSize ?? 15;
  const line = flat.lineHeight ?? Math.round(size * 1.25);
  // Spaces become non-breaking so the web does not drop them between pieces.
  const show = (char: string) => (char === " " ? "\u00a0" : char);
  return <View accessible accessibilityLabel={accessibilityLabel ?? text} style={{ flexDirection: "row", alignItems: "flex-end", flexWrap: "nowrap" }}>
    {Array.from(text, (char, index) => {
      if (char === from[index]) return <Text key={`${index}-still`} style={[style, { lineHeight: line }]}>{show(char)}</Text>;
      return <Digit key={`${index}-${id}`} char={char} old={from[index]} style={style} line={line} size={size} up={up}
        delay={wait + (text.length - 1 - index) * 45} />;
    })}
  </View>;
}

function Digit({ char, old, style, line, size, up, delay }: {
  char: string; old: string; style?: StyleProp<TextStyle>; line: number; size: number; up: boolean; delay: number;
}) {
  const t = useSharedValue(0);
  useEffect(() => { t.value = withDelay(delay, withSpring(1, springs.snappy)); }, []);
  const travel = 0.55 * size * (up ? 1 : -1);
  const leaving = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - t.value * 1.5), transform: [{ translateY: -travel * t.value }] }));
  const coming = useAnimatedStyle(() => ({ opacity: Math.min(1, t.value * 1.2), transform: [{ translateY: travel * (1 - t.value) }] }));
  return <View style={{ height: line, overflow: "hidden" }}>
    {old.trim() ? <Animated.View style={[{ position: "absolute", left: 0, top: 0 }, leaving]}><Text style={[style, { lineHeight: line }]}>{old}</Text></Animated.View> : null}
    <Animated.View style={coming}><Text style={[style, { lineHeight: line }]}>{char}</Text></Animated.View>
  </View>;
}

/**
 * Text that comes in again when it changes (v7's swap): it fades up from
 * 14 px below and settles from 0.98 on the snappy spring. Pass the text as
 * `value` so the replay only runs on a real change. Nothing moves on the
 * first render.
 */
export function Swap({ value, children, style }: { value: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const calm = useCalm();
  const t = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    t.value = 0;
    t.value = calm ? withTiming(1, { duration: 200 }) : withDelay(sheetWait(), withSpring(1, springs.snappy));
  }, [value]);
  const animated = useAnimatedStyle(() => ({
    opacity: Math.min(1, t.value * 1.4),
    transform: calm ? [] : [{ translateY: 14 * (1 - t.value) }, { scale: 0.98 + 0.02 * t.value }],
  }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
