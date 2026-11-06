import { useEffect, useRef, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { springs, useCalm } from "./motion";
import { useTheme } from "./theme";

/**
 * A bottom sheet the app draws itself, used for the pay sheets. It is as tall
 * as its content (up to 92% of the screen, then its content scrolls), with the
 * content always at the top. The iOS form sheet laid this content out at the
 * bottom of a tall blank sheet, above all when one sheet replaced another, so
 * these screens open as transparent modals and this view does the rest.
 *
 * It rises on the smooth spring, dims what is behind it, and follows the
 * finger down: let go past 100 px or with a flick and it closes, otherwise it
 * springs back. Set `closing` to animate it away; `onClosed` runs after.
 */
export function Sheet({ children, closing = false, onClosed }: { children: ReactNode; closing?: boolean; onClosed: () => void }) {
  const { c } = useTheme();
  const calm = useCalm();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const y = useSharedValue(height);
  const shade = useSharedValue(0);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onClosed();
  };
  const away = () => {
    "worklet";
    shade.value = withTiming(0, { duration: 220 });
    y.value = withTiming(height, { duration: calm ? 0 : 240 }, (ended) => { if (ended) runOnJS(finish)(); });
  };

  useEffect(() => {
    shade.value = withTiming(1, { duration: 260 });
    y.value = calm ? 0 : withSpring(0, springs.smooth);
  }, []);
  useEffect(() => { if (closing) away(); }, [closing]);

  const drag = Gesture.Pan()
    .activeOffsetY(8)
    .onUpdate((event) => { y.value = Math.max(0, event.translationY); })
    .onEnd((event) => {
      if (event.translationY > 100 || event.velocityY > 900) away();
      else y.value = withSpring(0, { ...springs.snappy, velocity: event.velocityY });
    });

  const card = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const dim = useAnimatedStyle(() => ({ opacity: shade.value * 0.38 }));

  return <View style={styles.fill}>
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "#0e1018" }, dim]} />
    <Pressable accessibilityRole="button" accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={() => away()} />
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.end} pointerEvents="box-none">
      <Animated.View style={[{ backgroundColor: c.canvas, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: height * 0.92, flexShrink: 1, paddingBottom: insets.bottom, overflow: "hidden" }, card]}>
        <GestureDetector gesture={drag}>
          <View accessibilityLabel="Drag down to close" style={{ alignItems: "center", paddingTop: 8, paddingBottom: 2 }}>
            <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: c.outline }} />
          </View>
        </GestureDetector>
        {children}
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
