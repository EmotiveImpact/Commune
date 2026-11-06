import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { springs, useCalm } from "./motion";
import { useTheme } from "./theme";

/** An optional button on the toast, such as Undo. */
export type ToastAction = { label: string; onPress: () => void };

const Context = createContext<(text: string, action?: ToastAction) => void>(() => undefined);

/**
 * A short confirmation on the dark frame, read out by screen readers. It
 * rises from 0.9 on the smooth spring and leaves with a fade where it is.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const calm = useCalm();
  const [text, setText] = useState("");
  const [action, setAction] = useState<ToastAction | null>(null);
  const shown = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = useCallback(() => { setText(""); setAction(null); }, []);
  const hide = useCallback(() => {
    shown.value = withTiming(0, { duration: 200 }, (finished) => { if (finished) runOnJS(clear)(); });
  }, [shown, clear]);
  const show = useCallback((next: string, nextAction?: ToastAction) => {
    if (timer.current) clearTimeout(timer.current);
    setText(next);
    setAction(nextAction ?? null);
    shown.value = 0;
    shown.value = calm ? withTiming(1, { duration: 180 }) : withSpring(1, springs.smooth);
    // A toast with a button stays longer, so there is time to press it.
    timer.current = setTimeout(hide, nextAction ? 6000 : 3200);
  }, [shown, hide, calm]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, shown.value * 1.5),
    transform: calm ? [] : [{ translateY: (1 - shown.value) * 14 }, { scale: 0.9 + 0.1 * shown.value }],
  }));
  return <Context.Provider value={show}>
    {children}
    {text ? <Animated.View pointerEvents={action ? "box-none" : "none"} style={[{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + 84, alignItems: "center" }, style]}>
      <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ backgroundColor: c.frame, paddingVertical: action ? 6 : 12, paddingLeft: 16, paddingRight: action ? 6 : 16, borderRadius: 14, maxWidth: 420, flexDirection: "row", alignItems: "center", gap: 12, shadowColor: "#0d1016", shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 }}>
        <Text style={{ color: c.onFrame, fontSize: 14, lineHeight: 20, flexShrink: 1 }}>{text}</Text>
        {action ? <Pressable accessibilityRole="button" accessibilityLabel={action.label} hitSlop={4}
          onPress={() => { if (timer.current) clearTimeout(timer.current); hide(); action.onPress(); }}
          style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 12, justifyContent: "center", borderRadius: 8, opacity: pressed ? 0.7 : 1 })}>
          <Text style={{ color: "#9fd6b8", fontSize: 14, fontWeight: "600" }}>{action.label}</Text>
        </Pressable> : null}
      </View>
    </Animated.View> : null}
  </Context.Provider>;
}

export function useToast() {
  return useContext(Context);
}
