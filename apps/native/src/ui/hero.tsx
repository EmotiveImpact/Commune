import { useEffect, useState } from "react";
import { Image, StyleSheet } from "react-native";
import Animated, { makeMutable, runOnJS, useAnimatedStyle, withDelay, withSpring, withTiming } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { springs } from "./motion";
import type { Rect as Box } from "./origin";

/**
 * v7's commune photo flight: tapping a commune tile lifts its photo and flies
 * it, growing, into the Hub's hero, where the real hero takes over on landing.
 * One overlay at the root draws the photo in flight so it can cross screens.
 */
export const HERO_HEIGHT = 262;

const x = makeMutable(0), y = makeMutable(0), w = makeMutable(0), h = makeMutable(0), r = makeMutable(12);
const op = makeMutable(0), scrim = makeMutable(0);
/** 1 while the photo is in flight, so the Hub keeps its own photo hidden. */
export const heroHidden = makeMutable(0);
/** The hero's words and buttons: 0 hidden, 1 shown. They rise in after landing. */
export const heroReveal = makeMutable(1);
/** The Hub registers a way to jump to its top, so the photo lands where the hero is. */
export const hubHooks: { scrollTop?: () => void } = {};

let setUri: ((uri: string) => void) | null = null;

export function flyHero(from: Box, to: Box, uri: string) {
  setUri?.(uri);
  hubHooks.scrollTop?.();
  x.value = from.x; y.value = from.y; w.value = from.w; h.value = from.h; r.value = 12;
  op.value = 1; scrim.value = 0; heroHidden.value = 1; heroReveal.value = 0;
  const land = () => {
    heroHidden.value = 0;
    op.value = withTiming(0, { duration: 200 });
    heroReveal.value = withSpring(1, springs.snappy);
  };
  x.value = withSpring(to.x, springs.smooth);
  y.value = withSpring(to.y, springs.smooth);
  w.value = withSpring(to.w, springs.smooth);
  r.value = withSpring(0, springs.smooth);
  scrim.value = withDelay(150, withTiming(1, { duration: 500 }));
  h.value = withSpring(to.h, springs.smooth, (ended) => { if (ended) runOnJS(land)(); });
}

/** Mounted once, above every screen. */
export function HeroFlight() {
  const [uri, set] = useState("");
  useEffect(() => { setUri = set; return () => { setUri = null; }; }, []);
  const box = useAnimatedStyle(() => ({ opacity: op.value, left: x.value, top: y.value, width: w.value, height: h.value, borderRadius: r.value }));
  const shade = useAnimatedStyle(() => ({ opacity: scrim.value }));
  if (!uri) return null;
  return <Animated.View pointerEvents="none" style={[{ position: "absolute", overflow: "hidden" }, box]}>
    <Image source={{ uri }} style={StyleSheet.absoluteFill} />
    <Animated.View style={[StyleSheet.absoluteFill, shade]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="flightScrim" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0e1018" stopOpacity={0.42} />
            <Stop offset="0.28" stopColor="#0e1018" stopOpacity={0} />
            <Stop offset="0.48" stopColor="#0e1018" stopOpacity={0.12} />
            <Stop offset="1" stopColor="#0e1018" stopOpacity={0.86} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#flightScrim)" />
      </Svg>
    </Animated.View>
  </Animated.View>;
}
