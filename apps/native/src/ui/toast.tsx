import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { Text } from "./text";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { springs, useCalm } from "./motion";
import { useTheme } from "./theme";

/** An optional button on the toast, such as Undo. */
export type ToastAction = { label: string; onPress: () => void };

const Context = createContext<(text: string, action?: ToastAction) => void>(() => undefined);
/** Where a screen's bottom dock begins, so the toast can sit above it (v7's lift). */
const LiftContext = createContext<(top: number | null) => void>(() => undefined);

/**
 * A short confirmation on the dark frame, read out by screen readers. It
 * rises from 0.9 on the smooth spring, its words follow 60 ms later, and it
 * leaves where it is: fading over 0.32 s while settling to 0.98 on snappy.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const calm = useCalm();
  const [text, setText] = useState("");
  const [action, setAction] = useState<ToastAction | null>(null);
  const { height } = useWindowDimensions();
  const [dockTop, setDockTop] = useState<number | null>(null);
  const shown = useSharedValue(0);
  const words = useSharedValue(0);
  const leaving = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = useCallback(() => { setText(""); setAction(null); }, []);
  const hide = useCallback(() => {
    if (calm) { shown.value = withTiming(0, { duration: 200 }, (finished) => { if (finished) runOnJS(clear)(); }); return; }
    leaving.value = withSpring(1, springs.snappy);
    shown.value = withTiming(0, { duration: 320 }, (finished) => { if (finished) runOnJS(clear)(); });
  }, [shown, leaving, clear, calm]);
  const show = useCallback((next: string, nextAction?: ToastAction) => {
    if (timer.current) clearTimeout(timer.current);
    setText(next);
    setAction(nextAction ?? null);
    shown.value = 0;
    leaving.value = 0;
    words.value = 0;
    shown.value = calm ? withTiming(1, { duration: 180 }) : withSpring(1, springs.smooth);
    words.value = calm ? 1 : withDelay(60, withSpring(1, springs.snappy));
    // A toast with a button stays longer, so there is time to press it.
    timer.current = setTimeout(hide, nextAction ? 6000 : 3200);
  }, [shown, words, leaving, hide, calm]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const style = useAnimatedStyle(() => {
    const out = leaving.value > 0;
    return {
      opacity: out ? shown.value : Math.min(1, shown.value * 1.5),
      transform: calm ? [] : out
        ? [{ scale: 1 - 0.02 * leaving.value }]
        : [{ translateY: (1 - shown.value) * 24 }, { scale: 0.9 + 0.1 * shown.value }],
    };
  });
  const wordStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, words.value),
    transform: calm ? [] : [{ translateY: (1 - words.value) * 6 }],
  }));
  const bottom = dockTop != null ? Math.max(insets.bottom + 84, height - dockTop + 12) : insets.bottom + 84;
  return <Context.Provider value={show}><LiftContext.Provider value={setDockTop}>
    {children}
    {text ? <Animated.View pointerEvents={action ? "box-none" : "none"} style={[{ position: "absolute", left: 16, right: 16, bottom, alignItems: "center" }, style]}>
      <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ backgroundColor: c.frame, paddingVertical: action ? 6 : 12, paddingLeft: 16, paddingRight: action ? 6 : 16, borderRadius: 14, maxWidth: 420, flexDirection: "row", alignItems: "center", gap: 12, shadowColor: "#0d1016", shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 }}>
        <Animated.View style={[{ flexShrink: 1 }, wordStyle]}><Text style={{ color: c.onFrame, fontSize: 14, lineHeight: 20 }}>{text}</Text></Animated.View>
        {action ? <Pressable accessibilityRole="button" accessibilityLabel={action.label} hitSlop={4}
          onPress={() => { if (timer.current) clearTimeout(timer.current); hide(); action.onPress(); }}
          style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 12, justifyContent: "center", borderRadius: 8, opacity: pressed ? 0.7 : 1 })}>
          <Text style={{ color: "#9fd6b8", fontSize: 14, fontWeight: "600" }}>{action.label}</Text>
        </Pressable> : null}
      </View>
    </Animated.View> : null}
  </LiftContext.Provider></Context.Provider>;
}

export function useToast() {
  return useContext(Context);
}

/**
 * Put inside a screen's bottom dock: while it is on screen, toasts rise
 * above the dock instead of covering it.
 */
export function ToastLift() {
  const setTop = useContext(LiftContext);
  const ref = useRef<View>(null);
  useEffect(() => () => setTop(null), [setTop]);
  return <View ref={ref} pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, width: 1, height: 1 }}
    onLayout={() => ref.current?.measureInWindow((_x, y) => setTop(y))} />;
}
