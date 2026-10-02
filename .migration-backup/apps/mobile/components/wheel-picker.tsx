/**
 * WheelPicker — 3D wheel-style picker (reacticx adaptation).
 *
 * Single-snap iOS-style picker with smooth scroll, blur on out-of-focus
 * items, gradient fade, and haptic on snap-change. Best for short option
 * lists (5–15 items) like currency, theme, frequency, time-of-day.
 *
 * For 50+ option lists, use SelectRow (bottom-sheet picker) — wheels
 * are unusable when you need to scroll past hundreds of items.
 *
 * API takes `{value, label}` objects so callers don't have to map back
 * from a bare string. Theming is via our design tokens.
 *
 * Original by reacticx.com (https://www.reacticx.com/docs/components/picker)
 * — adapted for our token palette and value-typed options.
 */

import {
  StyleSheet,
  View,
  Pressable,
  ScrollView,
  type ViewStyle,
  type TextStyle,
  type DimensionValue,
} from 'react-native';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedProps,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { BlurView, type BlurViewProps } from 'expo-blur';
import { scheduleOnRN } from 'react-native-worklets';
import { colors } from '@/constants/design';

const AnimatedBlurView =
  Animated.createAnimatedComponent<Partial<BlurViewProps>>(BlurView);

const DEFAULT_ITEM_HEIGHT = 44;
const DEFAULT_VISIBLE_ITEMS = 7;

export type WheelPickerOption<T extends string> = {
  value: T;
  label: string;
};

export type WheelPickerProps<T extends string> = {
  options: ReadonlyArray<WheelPickerOption<T>>;
  value: T | null | undefined;
  onChange: (value: T) => void;
  itemHeight?: number;
  fontSize?: number;
  width?: DimensionValue;
  textColor?: string;
  selectedTextColor?: string;
  backgroundColor?: string;
  selectionAreaBackgroundColor?: string;
  hapticFeedback?: boolean;
};

function WheelPickerImpl<T extends string>({
  options,
  value,
  onChange,
  itemHeight = DEFAULT_ITEM_HEIGHT,
  fontSize = 20,
  // Both colours default to `textPrimary` so faded (low-opacity) items
  // remain readable on light backgrounds. The interpolated opacity does
  // the visual differentiation, not a colour swap.
  textColor = colors.textPrimary,
  selectedTextColor = colors.textPrimary,
  backgroundColor = colors.bgSurface,
  // Apple's native wheel picker has no coloured band — just two hairline
  // indicators at the top and bottom of the selection slot. Coloured
  // bands cover the selected item if their z-index sits above the
  // ScrollView (which is the React Native default for absolute siblings).
  selectionAreaBackgroundColor = 'transparent',
  hapticFeedback = true,
  width,
}: WheelPickerProps<T>) {
  const items = useMemo(() => options.map((o) => o.label), [options]);
  const initialIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  const scrollY = useSharedValue<number>(initialIndex * itemHeight);
  const lastSelectedIndex = useRef<number>(initialIndex);
  // Plain ScrollView ref — we replaced the inner FlatList because it
  // was a VirtualizedList nested in another ScrollView (RN warning).
  // Our option lists are short (≤15), virtualization brings nothing.
  const scrollRef = useRef<Animated.ScrollView>(null);
  const pickerHeight = itemHeight * DEFAULT_VISIBLE_ITEMS;

  useEffect(() => {
    if (scrollRef.current && initialIndex >= 0) {
      const t = setTimeout(() => {
        scrollRef.current?.scrollTo({
          y: initialIndex * itemHeight,
          animated: false,
        });
      }, 80);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [initialIndex, itemHeight]);

  const triggerHaptic = useCallback(() => {
    if (hapticFeedback) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [hapticFeedback]);

  const handleIndexChange = useCallback(
    (index: number) => {
      const roundedIndex = Math.round(index);
      if (roundedIndex !== lastSelectedIndex.current) {
        lastSelectedIndex.current = roundedIndex;
        triggerHaptic();
        if (roundedIndex >= 0 && roundedIndex < options.length) {
          onChange(options[roundedIndex]!.value);
        }
      }
    },
    [options, onChange, triggerHaptic],
  );

  const AnimatedItem = useCallback(
    ({ item, index }: { item: string; index: number }) => {
      const animatedStyle = useAnimatedStyle<
        Required<Partial<Pick<ViewStyle, 'opacity' | 'transform'>>>
      >(() => {
        const centerOffset = index * itemHeight;
        const distance = scrollY.value - centerOffset;
        const normalizedDistance = distance / itemHeight;
        const absDistance = Math.abs(normalizedDistance);

        const opacity = interpolate(
          absDistance,
          [0, 0.3, 0.6, 1, 1.5, 2],
          [1, 0.85, 0.6, 0.35, 0.15, 0.05],
          Extrapolation.CLAMP,
        );
        const scale = interpolate(absDistance, [0, 1, 2], [1, 0.96, 0.94], Extrapolation.CLAMP);
        const translateY = interpolate(
          normalizedDistance,
          [-3, -2, -1, 0, 1, 2, 3],
          [15, 10, 5, 0, -5, -10, -15],
          Extrapolation.CLAMP,
        );
        const rotateX = interpolate(
          normalizedDistance,
          [-3, -2, -1, 0, 1, 2, 3],
          [85, 60, 30, 0, -30, -60, -85],
          Extrapolation.CLAMP,
        );

        return {
          opacity,
          transform: [
            { perspective: 1400 },
            { translateY },
            { rotateX: `${rotateX}deg` },
            { scale },
          ],
        };
      });

      const textAnimatedStyle = useAnimatedStyle<
        Required<Partial<Pick<TextStyle, 'color' | 'fontWeight'>>>
      >(() => {
        const centerOffset = index * itemHeight;
        const distance = scrollY.value - centerOffset;
        const normalizedDistance = Math.abs(distance / itemHeight);
        const isSelected = normalizedDistance < 0.5;
        return {
          color: interpolateColor(normalizedDistance, [0, 1], [selectedTextColor, textColor]),
          fontWeight: isSelected ? '600' : '400',
        };
      });

      const blurAnimatedProps = useAnimatedProps<Partial<BlurViewProps>>(() => {
        const centerOffset = index * itemHeight;
        const distance = Math.abs(scrollY.value - centerOffset);
        const normalizedDistance = distance / itemHeight;
        const blurOpacity = interpolate(
          normalizedDistance,
          [0, 0.6, 1.2, 2],
          [0, 2.5, 3.5, 6],
          Extrapolation.CLAMP,
        );
        return { intensity: blurOpacity };
      });

      return (
        <Animated.View style={[styles.item, { height: itemHeight, width }, animatedStyle]}>
          <Animated.Text
            style={[styles.itemText, { fontSize }, textAnimatedStyle]}
            numberOfLines={1}
            allowFontScaling={false}
          >
            {item}
          </Animated.Text>
          <AnimatedBlurView
            animatedProps={blurAnimatedProps}
            tint="light"
            style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderRadius: 99 }]}
            pointerEvents="none"
          />
        </Animated.View>
      );
    },
    [scrollY, itemHeight, fontSize, textColor, selectedTextColor, width],
  );

  const onScroll = useAnimatedScrollHandler<Record<string, unknown>>({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
      const interpolatedIndex = interpolate(
        event.contentOffset.y,
        items.map((_, i) => i * itemHeight),
        items.map((_, i) => i),
        Extrapolation.CLAMP,
      );
      scheduleOnRN(handleIndexChange, interpolatedIndex);
    },
  });

  const scrollToIndex = useCallback(
    (index: number) => {
      scrollRef.current?.scrollTo({
        y: index * itemHeight,
        animated: true,
      });
    },
    [itemHeight],
  );

  return (
    <View style={[styles.container, { height: pickerHeight }]}>
      <View style={[styles.background, { backgroundColor }]} />
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToAlignment="center"
        snapToInterval={itemHeight}
        contentContainerStyle={{ paddingVertical: (pickerHeight - itemHeight) / 2 }}
        showsVerticalScrollIndicator={false}
        disableIntervalMomentum
        bounces
        nestedScrollEnabled
      >
        {items.map((item, index) => (
          <Pressable key={`${item}-${index}`} onPress={() => scrollToIndex(index)}>
            <AnimatedItem item={item} index={index} />
          </Pressable>
        ))}
      </Animated.ScrollView>
      <View
        style={[
          styles.selectionArea,
          {
            top: (pickerHeight - itemHeight) / 2,
            height: itemHeight,
            width,
            backgroundColor: selectionAreaBackgroundColor,
          },
        ]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[
          backgroundColor,
          backgroundColor,
          `${backgroundColor}F2`,
          `${backgroundColor}DD`,
          `${backgroundColor}CC`,
          `${backgroundColor}AA`,
          `${backgroundColor}77`,
          `${backgroundColor}33`,
          `${backgroundColor}00`,
        ]}
        locations={[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.65, 0.8, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.gradient, styles.topGradient, { height: (pickerHeight - itemHeight) / 2 + 10 }]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[
          `${backgroundColor}00`,
          `${backgroundColor}33`,
          `${backgroundColor}77`,
          `${backgroundColor}AA`,
          `${backgroundColor}CC`,
          `${backgroundColor}DD`,
          `${backgroundColor}F2`,
          backgroundColor,
          backgroundColor,
        ]}
        locations={[0, 0.2, 0.35, 0.5, 0.6, 0.7, 0.8, 0.9, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.gradient, styles.bottomGradient, { height: (pickerHeight - itemHeight) / 2 + 10 }]}
        pointerEvents="none"
      />
      <View
        style={[
          styles.selectionIndicator,
          { top: (pickerHeight - itemHeight) / 2, height: itemHeight },
        ]}
        pointerEvents="none"
      >
        <View style={styles.indicatorLine} />
        <View style={[styles.indicatorLine, { bottom: 0, top: undefined }]} />
      </View>
    </View>
  );
}

export const WheelPicker = memo(WheelPickerImpl) as typeof WheelPickerImpl;

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden', borderRadius: 12 },
  background: { ...StyleSheet.absoluteFillObject },
  item: { alignItems: 'center', justifyContent: 'center' },
  itemText: { textAlign: 'center', letterSpacing: -0.3 },
  gradient: { position: 'absolute', left: 0, right: 0, zIndex: 10 },
  topGradient: { top: -5 },
  bottomGradient: { bottom: -5 },
  selectionArea: { position: 'absolute', left: 0, right: 0, zIndex: 5, borderRadius: 14 },
  selectionIndicator: {
    position: 'absolute',
    left: 0,
    right: 0,
    justifyContent: 'space-between',
    zIndex: 15,
  },
  indicatorLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(60, 60, 67, 0.29)',
  },
});
