import { useEffect, useRef, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { springs, useCalm } from "./motion";
import { hiddenButton, lastSheet, recentPress, sheetDepth, type Rect } from "./origin";
import { useTheme } from "./theme";

const TOP_RADIUS = 22;

/**
 * A bottom sheet the app draws itself, used for the pay, record, switch and
 * invite sheets. It is as tall as its content (up to 92% of the screen, then
 * its content scrolls), with the content at the top.
 *
 * How it opens, as in the v7 prototype:
 * - Opened by a button just pressed, it grows out of that button: the
 *   button's pill opens into the sheet on the smooth spring while the
 *   button's colour fades, so the panel reveals its content rather than
 *   squashing it. The button stays hidden until the sheet closes.
 * - Replacing another sheet (pay, then "I've already paid"), it stays up and
 *   only changes height.
 * - Otherwise it rises from the bottom.
 * The screen behind steps back into a card while it is up (sheetDepth), and
 * comes forward as the sheet is dragged down. Let go past 100 px or with a
 * flick and it closes on the same spring, otherwise it springs back. Set
 * `closing` to send it away; `onClosed` runs after.
 */
const GROW_FROM_BUTTON = false;

export function Sheet({ children, closing = false, onClosed }: { children: ReactNode; closing?: boolean; onClosed: () => void }) {
  const { c } = useTheme();
  const calm = useCalm();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const done = useRef(false);

  // How it should open, decided once on mount.
  const [start] = useState(() => {
    const swap = lastSheet.swapping && Date.now() - lastSheet.at < 600 && lastSheet.height > 0;
    lastSheet.swapping = false;
    if (calm) return { kind: "rise" as const };
    if (swap) return { kind: "swap" as const, from: { x: 0, y: height - lastSheet.height, w: width, h: lastSheet.height } as Rect, color: "", radius: TOP_RADIUS };
    // Edem prefers the plain drawer rising from the bottom to the button morph,
    // so a sheet always rises; the grow path is kept for a later change of mind.
    if (GROW_FROM_BUTTON) {
      const press = recentPress();
      if (press?.rect) {
        hiddenButton.value = press.id;
        return { kind: "grow" as const, from: press.rect, color: press.color, radius: press.radius };
      }
    }
    return { kind: "rise" as const };
  });

  const y = useSharedValue(start.kind === "rise" ? height : 0);
  const shade = useSharedValue(start.kind === "swap" ? 1 : 0);
  const cardH = useSharedValue(0);
  // Growing: p runs 0 to 1; until the card is measured it stays hidden.
  const p = useSharedValue(start.kind === "rise" ? 1 : 0);
  const fill = useSharedValue(start.kind === "grow" ? 1 : 0);
  const [measured, setMeasured] = useState<{ h: number } | null>(null);
  const [morphing, setMorphing] = useState(start.kind !== "rise");

  const finish = () => {
    if (done.current) return;
    done.current = true;
    hiddenButton.value = "";
    onClosed();
  };
  const away = (velocity = 0) => {
    "worklet";
    shade.value = withTiming(0, { duration: 260 });
    sheetDepth.value = withSpring(0, springs.smooth);
    y.value = calm ? withTiming(height, { duration: 0 }, (ended) => { if (ended) runOnJS(finish)(); })
      : withSpring(height, { ...springs.smooth, velocity, overshootClamping: true }, (ended) => { if (ended) runOnJS(finish)(); });
  };

  // A sheet that grew out of a button folds back into it when closed by a tap.
  const shrinkRef = useRef(false);
  const close = () => {
    if (start.kind !== "grow" || calm || !measured) { away(); return; }
    shrinkRef.current = true;
    setMorphing(true);
    shade.value = withTiming(0, { duration: 260 });
    sheetDepth.value = withSpring(0, springs.smooth);
    fill.value = withTiming(1, { duration: 220 });
    p.value = withSpring(0, { ...springs.smooth, overshootClamping: true }, (ended) => { if (ended) runOnJS(finish)(); });
  };

  useEffect(() => {
    shade.value = withTiming(1, { duration: 300 });
    sheetDepth.value = calm ? 0 : withSpring(1, springs.smooth);
    if (start.kind === "rise") y.value = calm ? 0 : withSpring(0, springs.smooth);
    return () => {
      // Leaving for another sheet keeps the screen behind stepped back.
      if (!lastSheet.swapping) sheetDepth.value = withSpring(0, springs.smooth);
      hiddenButton.value = "";
    };
  }, []);
  useEffect(() => { if (closing) { lastSheet.height = cardH.value; if (lastSheet.swapping) away(); else close(); } }, [closing]);

  const onCard = (event: LayoutChangeEvent) => {
    const h = event.nativeEvent.layout.height;
    cardH.value = h;
    lastSheet.height = h;
    if (morphing && !measured && h > 0) {
      setMeasured({ h });
      p.value = withSpring(1, springs.smooth, (ended) => { if (ended && !shrinkRef.current) runOnJS(setMorphing)(false); });
      if (start.kind === "grow") fill.value = withDelay(40, withTiming(0, { duration: 300 }));
    }
  };

  const drag = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onUpdate((event) => {
      const t = event.translationY;
      y.value = t > 0 ? t : -Math.pow(-t, 0.7);
      if (cardH.value > 0) sheetDepth.value = Math.max(0, Math.min(1, 1 - Math.max(0, t) / cardH.value));
    })
    .onEnd((event) => {
      if (event.translationY > 100 || event.velocityY > 900) away(event.velocityY);
      else {
        y.value = withSpring(0, { ...springs.snappy, velocity: event.velocityY });
        sheetDepth.value = withSpring(1, springs.snappy);
      }
    });

  // While growing, the card's box runs from the button's rect to its own,
  // and the content inside stays where it will end up.
  const from = start.kind === "rise" ? null : start.from;
  const finalH = measured?.h ?? 0;
  const grow = useAnimatedStyle(() => {
    if (!from || !morphing || !finalH) return {};
    const k = p.value;
    const top = from.y + (height - finalH - from.y) * k;
    const h = from.h + (finalH - from.h) * k;
    const left = from.x * (1 - k);
    const w = from.w + (width - from.w) * k;
    const r0 = start.kind === "grow" ? start.radius : TOP_RADIUS;
    return {
      position: "absolute", top, left, width: w, height: h,
      borderTopLeftRadius: r0 + (TOP_RADIUS - r0) * k, borderTopRightRadius: r0 + (TOP_RADIUS - r0) * k,
      borderBottomLeftRadius: start.kind === "grow" ? r0 * (1 - k) : 0, borderBottomRightRadius: start.kind === "grow" ? r0 * (1 - k) : 0,
    };
  });
  const inner = useAnimatedStyle(() => {
    if (!from || !morphing || !finalH) return {};
    const k = p.value;
    const top = from.y + (height - finalH - from.y) * k;
    return { position: "absolute", width, height: finalH, top: (height - finalH) - top, left: -from.x * (1 - k) };
  });
  const card = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }], opacity: morphing && !finalH ? 0 : 1 }));
  const dim = useAnimatedStyle(() => ({ opacity: shade.value * 0.46 }));
  const colour = useAnimatedStyle(() => ({ opacity: fill.value }));

  const base = { backgroundColor: c.canvas, borderTopLeftRadius: TOP_RADIUS, borderTopRightRadius: TOP_RADIUS, overflow: "hidden" as const };
  const body = <>
    <GestureDetector gesture={drag}>
      <View accessibilityLabel="Drag down to close" style={{ alignItems: "center", paddingTop: 8, paddingBottom: 2 }}>
        <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: c.outline }} />
      </View>
    </GestureDetector>
    {children}
  </>;

  return <View style={styles.fill}>
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "#080a10" }, dim]} />
    <Pressable accessibilityRole="button" accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={close} />
    {/* One tree throughout, so the content never remounts: while growing,
        the card and its content only change style. */}
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.end} pointerEvents="box-none">
      <Animated.View onLayout={onCard} style={[base, { maxHeight: height * 0.92, flexShrink: 1 }, card, grow]}>
        <Animated.View style={[{ paddingBottom: insets.bottom, flexShrink: 1 }, inner]}>{body}</Animated.View>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: start.kind === "grow" ? start.color : "transparent" }, colour]} />
      </Animated.View>
    </KeyboardAvoidingView>
  </View>;
}

/** Options for a screen that opens as a Sheet. */
export const SHEET_SCREEN = {
  presentation: "transparentModal" as const,
  animation: "none" as const,
  headerShown: false,
  gestureEnabled: false,
  contentStyle: { backgroundColor: "transparent" },
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
  end: { flex: 1, justifyContent: "flex-end" },
});
