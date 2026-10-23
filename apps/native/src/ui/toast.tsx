import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "./theme";

/** An optional button on the toast, such as Undo. */
export type ToastAction = { label: string; onPress: () => void };

const Context = createContext<(text: string, action?: ToastAction) => void>(() => undefined);

/** A short confirmation on the dark frame, read out by screen readers. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const [action, setAction] = useState<ToastAction | null>(null);
  const fade = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hide = useCallback(() => {
    Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => { setText(""); setAction(null); });
  }, [fade]);
  const show = useCallback((next: string, nextAction?: ToastAction) => {
    if (timer.current) clearTimeout(timer.current);
    setText(next);
    setAction(nextAction ?? null);
    Animated.timing(fade, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    // A toast with a button stays longer, so there is time to press it.
    timer.current = setTimeout(hide, nextAction ? 6000 : 3200);
  }, [fade, hide]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return <Context.Provider value={show}>
    {children}
    {text ? <Animated.View pointerEvents={action ? "box-none" : "none"} style={{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + 84, alignItems: "center", opacity: fade }}>
      <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ backgroundColor: c.frame, paddingVertical: action ? 6 : 12, paddingLeft: 16, paddingRight: action ? 6 : 16, borderRadius: 12, maxWidth: 420, flexDirection: "row", alignItems: "center", gap: 12 }}>
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
