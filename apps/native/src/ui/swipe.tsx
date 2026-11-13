import { useRef, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { Clock3 } from "lucide-react-native";
import { Text } from "./text";
import { haptic, springs, useCalm } from "./motion";
import { useTheme } from "./theme";

const OPEN = -112;

/**
 * v7's row swipe: drag a row left and "Remind me" shows behind it on the
 * dark panel. Let go past halfway and it stays open; tap the row or drag it
 * back to close. A rightward drag is left alone, so the Hub tabs still swipe.
 * `guard` wraps the row's own taps so letting go of a drag never opens the row.
 */
export function SwipeRow({ children, onRemind, label, background }: { children: (guard: (action?: () => void) => (() => void) | undefined) => ReactNode; onRemind(): void; label: string; background?: string }) {
  const { c } = useTheme();
  const calm = useCalm();
  const x = useSharedValue(0);
  const from = useSharedValue(0);
  const [open, setOpen] = useState(false);
  const dragged = useRef(0);
  const moved = () => { dragged.current = Date.now(); };
  const guard = (action?: () => void) => action && (() => { if (Date.now() - dragged.current > 400) action(); });
  const settle = (to: number, velocity = 0) => {
    "worklet";
    x.value = calm ? withTiming(to, { duration: 180 }) : withSpring(to, { ...springs.snappy, velocity });
  };
  const close = () => { settle(0); setOpen(false); };
  const opened = () => { setOpen(true); haptic.light(); };
  const pan = Gesture.Pan()
    // Leftward only while closed: a rightward drag fails at once and goes to
    // the Hub's tab pager, which waits for 16 px. Vertical moves scroll.
    .activeOffsetX(open ? [-10, 10] : [-10, 10000])
    .failOffsetX(open ? [-10000, 10000] : [-10000, 10])
    .failOffsetY([-10, 10])
    .onBegin(() => { from.value = x.value; })
    .onStart(() => { runOnJS(moved)(); })
    .onUpdate((event) => { x.value = Math.min(0, Math.max(-150, from.value + event.translationX)); })
    .onEnd((event) => {
      runOnJS(moved)();
      const stay = x.value < OPEN / 2 || event.velocityX < -500;
      settle(stay ? OPEN : 0, event.velocityX);
      if (stay && !open) runOnJS(opened)();
      if (!stay && open) runOnJS(setOpen)(false);
    });
  const front = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const back = useAnimatedStyle(() => ({ opacity: x.value < 0 ? 1 : 0 }));
  return <View style={{ overflow: "hidden" }}>
    <Animated.View style={[{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "flex-end", backgroundColor: c.frameRaised }, back]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Remind me about ${label}`} onPress={() => { close(); onRemind(); }}
        style={{ width: 112, alignItems: "center", justifyContent: "center", gap: 4 }}>
        <Clock3 size={18} color={c.onFrame} />
        <Text style={{ color: c.onFrame, fontSize: 12, fontWeight: "500" }}>Remind me</Text>
      </Pressable>
    </Animated.View>
    <GestureDetector gesture={pan}>
      <Animated.View style={[{ backgroundColor: background ?? c.surface }, front]}>
        {children(guard)}
        {open ? <Pressable accessibilityLabel="Close" onPress={close} style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }} /> : null}
      </Animated.View>
    </GestureDetector>
  </View>;
}
