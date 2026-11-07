import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { Text } from "./text";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { haptic, springs, useCalm } from "./motion";
import { radius, useTheme } from "./theme";

type Ask = { title: string; message?: string; yes: string; no?: string; destructive?: boolean };
type Confirm = (ask: Ask) => Promise<boolean>;
const Context = createContext<Confirm>(async () => false);

/** Ask before something that matters, in Commune's own card instead of the plain system alert. */
export function useConfirm(): Confirm {
  return useContext(Context);
}

/**
 * A small centred card that settles in on the snappy spring over a dimmed
 * screen, with the choice as two round buttons. Tapping outside cancels.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [ask, setAsk] = useState<Ask | null>(null);
  const resolver = useRef<((yes: boolean) => void) | null>(null);
  const confirm = useCallback<Confirm>((next) => new Promise((resolve) => {
    resolver.current?.(false);
    resolver.current = resolve;
    haptic.light();
    setAsk(next);
  }), []);
  const answer = (yes: boolean) => { resolver.current?.(yes); resolver.current = null; setAsk(null); };
  return <Context.Provider value={confirm}>
    {children}
    <Modal visible={!!ask} transparent animationType="none" statusBarTranslucent onRequestClose={() => answer(false)}>
      {ask ? <Card ask={ask} answer={answer} /> : null}
    </Modal>
  </Context.Provider>;
}

function Card({ ask, answer }: { ask: Ask; answer: (yes: boolean) => void }) {
  const { c } = useTheme();
  const calm = useCalm();
  const shown = useSharedValue(0);
  useEffect(() => { shown.value = calm ? withTiming(1, { duration: 160 }) : withSpring(1, springs.snappy); }, []);
  const dim = useAnimatedStyle(() => ({ opacity: Math.min(1, shown.value) * 0.42 }));
  const card = useAnimatedStyle(() => ({ opacity: Math.min(1, shown.value * 1.6), transform: calm ? [] : [{ scale: 0.94 + 0.06 * shown.value }] }));
  const button = (label: string, filled: boolean, onPress: () => void) => <Pressable accessibilityRole="button" onPress={onPress}
    style={({ pressed }) => ({ flex: 1, height: 46, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1,
      backgroundColor: filled ? (ask.destructive ? c.late : c.action) : c.recessed })}>
    <Text style={{ color: filled ? "#ffffff" : c.ink, fontSize: 15.5, fontWeight: "600" }}>{label}</Text>
  </Pressable>;
  return <View style={styles.fill}>
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "#0e1018" }, dim]} />
    <Pressable accessibilityRole="button" accessibilityLabel={ask.no ?? "Cancel"} style={StyleSheet.absoluteFill} onPress={() => answer(false)} />
    <Animated.View accessibilityViewIsModal style={[{ width: "86%", maxWidth: 360, backgroundColor: c.surface, borderRadius: 24, padding: 22, paddingTop: 24, gap: 8 }, card]}>
      <Text accessibilityRole="header" style={{ color: c.ink, fontSize: 19, fontWeight: "600", letterSpacing: -0.3 }}>{ask.title}</Text>
      {ask.message ? <Text style={{ color: c.ink2, fontSize: 15, lineHeight: 21 }}>{ask.message}</Text> : null}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
        {button(ask.no ?? "Cancel", false, () => answer(false))}
        {button(ask.yes, true, () => answer(true))}
      </View>
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({ fill: { flex: 1, alignItems: "center", justifyContent: "center" } });
