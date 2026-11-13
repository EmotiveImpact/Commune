import type React from "react";
import { useEffect, useState, type ReactNode } from "react";
import { Pressable, View, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming, type WithSpringConfig,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

/**
 * The app's motion, in one place so every screen moves the same way.
 * Springs with no overshoot: smooth for screens and sheets, snappy for
 * presses and toggles. Nothing bounces or wobbles when it lands.
 */
export const springs = {
  // Clean, with no overshoot and no settle wobble: every spring is critically
  // damped (Edem, 7 Nov: "just clean animation", no jiggle). Kept as springs so
  // a swipe's speed still carries into the release.
  smooth: { duration: 420, dampingRatio: 1 },
  snappy: { duration: 260, dampingRatio: 1 },
  bouncy: { duration: 420, dampingRatio: 1 },
  release: { duration: 380, dampingRatio: 1 },
} satisfies Record<string, WithSpringConfig>;

/** Gap between rows arriving one after another, and how many rows get a stagger. */
export const STAGGER_MS = 70;
export const STAGGER_CAP = 8;

/** True when the phone asks for less motion: moves become fades. */
export function useCalm(): boolean {
  return useReducedMotion();
}

/** Light haptics on the moments that matter. Skipped quietly where there are none, such as the web. */
export const haptic = {
  light() { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined); },
  select() { Haptics.selectionAsync().catch(() => undefined); },
  success() { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined); },
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * A Pressable that gives under the finger: it settles to 0.97 on the snappy
 * spring and springs back on release (v7 uses 0.985 for full-width rows).
 * With Reduce Motion it only dims. `style` may be a function of `pressed`,
 * as with Pressable.
 */
export function PressScale({ style, children, onPressIn, onPressOut, scaleTo = 0.97, pressedStyle, pressRef, ...rest }: Omit<PressableProps, "style" | "children"> & {
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>); pressedStyle?: StyleProp<ViewStyle>; children?: ReactNode; scaleTo?: number; pressRef?: React.Ref<View>;
}) {
  const calm = useCalm();
  const scale = useSharedValue(1);
  const [pressed, setPressed] = useState(false);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <AnimatedPressable {...rest} ref={pressRef as never}
    onPressIn={(event) => { setPressed(true); if (!calm) scale.value = withSpring(scaleTo, springs.snappy); onPressIn?.(event); }}
    onPressOut={(event) => { setPressed(false); scale.value = withSpring(1, springs.snappy); onPressOut?.(event); }}
    style={[typeof style === "function" ? style({ pressed }) : style, pressed ? pressedStyle : null, animated]}>
    {children}
  </AnimatedPressable>;
}

/**
 * Content arriving: it fades in and rises 10 px on the smooth spring. Rows
 * in a list pass their index for a short stagger, capped so a long list is
 * never slow. With Reduce Motion it only fades.
 */
export function Rise({ index = 0, children, style, delay = 0 }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle>; delay?: number }) {
  const calm = useCalm();
  const shown = useSharedValue(0);
  useEffect(() => {
    const wait = delay + Math.min(index, STAGGER_CAP) * STAGGER_MS;
    shown.value = withDelay(wait, calm ? withTiming(1, { duration: 220 }) : withSpring(1, springs.smooth));
  }, [calm, delay, index, shown]);
  const animated = useAnimatedStyle(() => ({
    opacity: Math.min(1, shown.value * 1.4),
    transform: calm ? [] : [{ translateY: (1 - shown.value) * 10 }],
  }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/**
 * Same props as Rise, with no entrance. The tab screens use it: switching
 * tabs shows the page at once rather than replaying its rows.
 */
export function Still({ children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle>; delay?: number }) {
  return <View style={style}>{children}</View>;
}
