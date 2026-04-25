import type { ComponentType } from 'react';
import { useEffect } from 'react';
import { Modal, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors, elevation, space } from '@/constants/design';
import { Pressable } from '@/components/primitives';
import { hapticMedium } from '@/lib/haptics';

type TablerIcon = ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;

export type SpeedDialAction = {
  key: string;
  Icon: TablerIcon;
  label: string;
  color: string;
  bg: string;
  onPress: () => void;
};

const PILL_HEIGHT = 52;
const PILL_GAP = 10;
const FAB_SIZE = 64;

export function SpeedDial({
  visible,
  onClose,
  actions,
  fabOffsetFromBottom,
}: {
  visible: boolean;
  onClose: () => void;
  actions: SpeedDialAction[];
  /** Distance from the bottom of the screen where the FAB center sits */
  fabOffsetFromBottom: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration: visible ? 300 : 200,
      easing: Easing.out(Easing.cubic),
    });
  }, [visible, progress]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1]),
  }));

  // Pills sit just above the FAB
  const stackBottom = fabOffsetFromBottom + FAB_SIZE / 2 + 24;

  const handleAction = (action: SpeedDialAction) => {
    hapticMedium();
    onClose();
    setTimeout(() => action.onPress(), 180);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(10,12,20,0.45)',
          },
          backdropStyle,
        ]}
      >
        <Pressable onPress={onClose} style={{ flex: 1 }} />
      </Animated.View>

      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: stackBottom,
          alignItems: 'center',
        }}
      >
        {actions.map((action, idx) => {
          const order = actions.length - 1 - idx;
          return (
            <SpeedDialPill
              key={action.key}
              action={action}
              order={order}
              total={actions.length}
              progress={progress}
              onPress={() => handleAction(action)}
            />
          );
        })}
      </View>
    </Modal>
  );
}

function SpeedDialPill({
  action,
  order,
  total,
  progress,
  onPress,
}: {
  action: SpeedDialAction;
  order: number;
  total: number;
  progress: SharedValue<number>;
  onPress: () => void;
}) {
  const style = useAnimatedStyle(() => {
    const stagger = 0.6 / Math.max(1, total);
    const start = order * stagger;
    const end = Math.min(1, start + 0.6);
    const p = interpolate(progress.value, [start, end], [0, 1], 'clamp');
    return {
      opacity: p,
      transform: [{ translateY: (1 - p) * 18 }, { scale: 0.9 + p * 0.1 }],
    };
  });

  return (
    <Animated.View style={[{ marginBottom: PILL_GAP }, style]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={action.label}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          height: PILL_HEIGHT,
          paddingLeft: 6,
          paddingRight: space.lg,
          borderRadius: PILL_HEIGHT / 2,
          backgroundColor: colors.bgSurface,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
          gap: space.md,
          opacity: pressed ? 0.75 : 1,
          ...elevation.card,
        })}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: action.bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <action.Icon size={20} strokeWidth={1.75} color={action.color} />
        </View>
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>
          {action.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
