import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "./theme";

const Context = createContext<(text: string) => void>(() => undefined);

/** A short confirmation on the dark frame, read out by screen readers. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const fade = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((next: string) => {
    if (timer.current) clearTimeout(timer.current);
    setText(next);
    Animated.timing(fade, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    timer.current = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setText(""));
    }, 3200);
  }, [fade]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return <Context.Provider value={show}>
    {children}
    {text ? <Animated.View pointerEvents="none" style={{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + 84, alignItems: "center", opacity: fade }}>
      <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ backgroundColor: c.frame, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, maxWidth: 420 }}>
        <Text style={{ color: c.onFrame, fontSize: 14, lineHeight: 20 }}>{text}</Text>
      </View>
    </Animated.View> : null}
  </Context.Provider>;
}

export function useToast() {
  return useContext(Context);
}
