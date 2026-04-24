import type { ComponentType } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Dimensions, Image, Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconChevronLeft, IconChevronRight, IconX } from '@tabler/icons-react-native';
import { colors, font, space } from '@/constants/design';
import { hapticLight, hapticMedium } from '@/lib/haptics';

type TablerIcon = ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;

type DrawerItem =
  | {
      type: 'action';
      key: string;
      Icon: TablerIcon;
      label: string;
      caption?: string;
      color: string;
      bg: string;
      onPress: () => void;
    }
  | {
      type: 'nested';
      key: string;
      Icon: TablerIcon;
      label: string;
      caption?: string;
      color: string;
      bg: string;
      panel: string;
    };

type DrawerPanel = {
  key: string;
  title: string;
  subtitle?: string;
  items: DrawerItem[];
};

const ANIM_OPEN_MS = 260;
const ANIM_CLOSE_MS = 220;
const PANEL_SWAP_MS = 260;

export function SideDrawer({
  visible,
  onClose,
  panels,
  initialPanel = 'main',
  userLabel,
  userCaption,
  userAvatarUrl,
}: {
  visible: boolean;
  onClose: () => void;
  panels: DrawerPanel[];
  initialPanel?: string;
  userLabel?: string;
  userCaption?: string;
  userAvatarUrl?: string | null;
}) {
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get('window').width;
  const drawerWidth = Math.min(screenWidth * 0.86, 360);

  const [mounted, setMounted] = useState(visible);
  const [stack, setStack] = useState<string[]>([initialPanel]);

  const containerX = useSharedValue(-drawerWidth);
  const backdrop = useSharedValue(0);
  const contentX = useSharedValue(0);

  const dismount = () => setMounted(false);

  // Open/close master animation
  useEffect(() => {
    if (visible) {
      setMounted(true);
      setStack([initialPanel]);
      contentX.value = 0;
      containerX.value = withTiming(0, {
        duration: ANIM_OPEN_MS,
        easing: Easing.out(Easing.cubic),
      });
      backdrop.value = withTiming(1, { duration: ANIM_OPEN_MS });
    } else if (mounted) {
      containerX.value = withTiming(
        -drawerWidth,
        { duration: ANIM_CLOSE_MS, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(dismount)();
        },
      );
      backdrop.value = withTiming(0, { duration: ANIM_CLOSE_MS });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, drawerWidth, initialPanel]);

  // Panel stack → slide the content strip
  useEffect(() => {
    contentX.value = withTiming(-((stack.length - 1) * drawerWidth), {
      duration: PANEL_SWAP_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [stack, drawerWidth, contentX]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: containerX.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdrop.value,
  }));
  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: contentX.value }],
  }));

  const panelMap = useMemo(() => {
    const map: Record<string, DrawerPanel> = {};
    for (const p of panels) map[p.key] = p;
    return map;
  }, [panels]);

  const handleBack = () => {
    hapticLight();
    if (stack.length > 1) {
      setStack((s) => s.slice(0, -1));
    } else {
      onClose();
    }
  };

  const handleItem = (item: DrawerItem) => {
    hapticMedium();
    if (item.type === 'nested') {
      if (panelMap[item.panel]) {
        setStack((s) => [...s, item.panel]);
      }
    } else {
      item.onPress();
    }
  };

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      animationType="none"
      transparent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {/* Backdrop */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(10,12,20,0.5)',
            },
            backdropStyle,
          ]}
        >
          <Pressable onPress={onClose} style={{ flex: 1 }} />
        </Animated.View>

        {/* Drawer panel */}
        <Animated.View
          style={[
            {
              width: drawerWidth,
              height: '100%',
              backgroundColor: colors.bgBase,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOpacity: 0.15,
              shadowRadius: 20,
              shadowOffset: { width: 4, height: 0 },
              elevation: 14,
            },
            containerStyle,
          ]}
        >
          {/* Profile summary */}
          <View
            style={{
              paddingTop: insets.top + space.lg,
              paddingHorizontal: space.gutter,
              paddingBottom: space.lg,
              borderBottomWidth: 1,
              borderBottomColor: colors.borderSubtle,
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.md,
            }}
          >
            {userAvatarUrl ? (
              <Image
                source={{ uri: userAvatarUrl }}
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bgSubtle }}
              />
            ) : (
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: '#1A1E2B',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '700' }}>
                  {(userLabel ?? '?').trim().charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text
                numberOfLines={1}
                style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}
              >
                {userLabel ?? 'Guest'}
              </Text>
              {userCaption ? (
                <Text
                  numberOfLines={1}
                  style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}
                >
                  {userCaption}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              activeOpacity={0.6}
              onPress={onClose}
              accessibilityLabel="Close menu"
              hitSlop={8}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: colors.bgSubtle,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconX size={18} strokeWidth={2} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Animated panel strip */}
          <Animated.View
            style={[
              {
                flex: 1,
                flexDirection: 'row',
                width: drawerWidth * panels.length,
              },
              contentStyle,
            ]}
          >
            {panels.map((panel) => {
              const isTop = panel.key === initialPanel;
              return (
                <View
                  key={panel.key}
                  style={{ width: drawerWidth, flex: 1 }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: space.gutter,
                      paddingVertical: space.md,
                    }}
                  >
                    {!isTop && (
                      <TouchableOpacity
                        activeOpacity={0.6}
                        onPress={handleBack}
                        hitSlop={8}
                        accessibilityLabel="Back"
                        style={{
                          width: 28,
                          height: 28,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: space.sm,
                        }}
                      >
                        <IconChevronLeft size={22} strokeWidth={2} color={colors.textPrimary} />
                      </TouchableOpacity>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 20,
                          fontWeight: '700',
                          color: colors.textPrimary,
                          letterSpacing: -0.2,
                        }}
                      >
                        {panel.title}
                      </Text>
                      {panel.subtitle ? (
                        <Text
                          style={[font.caption, { color: colors.textTertiary, marginTop: 2 }]}
                          numberOfLines={1}
                        >
                          {panel.subtitle}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={{ paddingHorizontal: space.gutter }}>
                    {panel.items.map((item) => (
                      <TouchableOpacity
                        key={item.key}
                        activeOpacity={0.55}
                        onPress={() => handleItem(item)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: space.md,
                          borderBottomWidth: 1,
                          borderBottomColor: colors.borderSubtle,
                        }}
                      >
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            backgroundColor: item.bg,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <item.Icon size={20} strokeWidth={1.75} color={item.color} />
                        </View>
                        <View
                          style={{ flex: 1, marginLeft: space.md, marginRight: space.sm }}
                        >
                          <Text
                            style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}
                            numberOfLines={1}
                          >
                            {item.label}
                          </Text>
                          {item.caption ? (
                            <Text
                              style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}
                              numberOfLines={1}
                            >
                              {item.caption}
                            </Text>
                          ) : null}
                        </View>
                        <IconChevronRight size={16} strokeWidth={2} color={colors.textTertiary} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              );
            })}
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}
