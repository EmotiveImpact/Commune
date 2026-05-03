import { useMemo, useState } from 'react';
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Chip, Button, Avatar } from 'heroui-native';
import type { Group } from '@commune/types';
import { useThemeStore } from '@/stores/theme';

export function GroupSwitcher({
  groups,
  activeGroupId,
  pendingInvites = 0,
  onSelect,
  onOpenSetup,
  variant = 'card',
}: {
  groups: Group[];
  activeGroupId: string | null;
  pendingInvites?: number;
  onSelect: (groupId: string) => void;
  onOpenSetup?: () => void;
  variant?: 'card' | 'compact';
}) {
  const [isOpen, setIsOpen] = useState(false);
  const themeMode = useThemeStore((s) => s.mode);
  const isDark = themeMode === 'dark';

  const activeGroup = useMemo(
    () => groups.find((group) => group.id === activeGroupId) ?? groups[0] ?? null,
    [activeGroupId, groups]
  );

  if (!activeGroup) {
    return null;
  }

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => setIsOpen(true)}
        accessibilityLabel={`Switch group. Current: ${activeGroup.name}`}
        accessibilityRole="button"
      >
        {variant === 'compact' ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderRadius: 12,
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            <View style={{ flex: 1, marginRight: 4 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: isDark ? '#FAFAFA' : '#171b24',
                }}
                numberOfLines={1}
              >
                {activeGroup.name}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: isDark ? 'rgba(255,255,255,0.5)' : '#667085',
                  marginTop: 1,
                }}
              >
                {pendingInvites > 0
                  ? `${pendingInvites} invite${pendingInvites === 1 ? '' : 's'}`
                  : `${activeGroup.type} group`}
              </Text>
            </View>
            <Ionicons
              name="chevron-down"
              size={14}
              color={isDark ? '#A1A1AA' : '#667085'}
            />
          </View>
        ) : (
          <Card style={{ marginBottom: 12, padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 2, color: '#667085' }}>
                  Group
                </Text>
                <Text style={{ marginTop: 6, fontSize: 18, fontWeight: '600', color: isDark ? '#FAFAFA' : '#171b24' }}>
                  {activeGroup.name}
                </Text>
                <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  <Chip variant="soft" size="sm">
                    {`${activeGroup.type} · ${activeGroup.currency}`}
                  </Chip>
                  {pendingInvites > 0 && (
                    <Chip variant="soft" size="sm">
                      {`${pendingInvites} invite${pendingInvites === 1 ? '' : 's'}`}
                    </Chip>
                  )}
                </View>
              </View>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  backgroundColor: '#EEF6F3',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="swap-horizontal" size={18} color="#2d6a4f" />
              </View>
            </View>
          </Card>
        )}
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }}
          onPress={() => setIsOpen(false)}
        >
          <Pressable
            style={{
              marginTop: 'auto',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              backgroundColor: isDark ? '#18181B' : '#FAFAFA',
              paddingHorizontal: 20,
              paddingBottom: 40,
              paddingTop: 24,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <View>
                <Text style={{ fontSize: 24, fontWeight: '600', color: isDark ? '#FAFAFA' : '#171b24' }}>
                  Switch group
                </Text>
                <Text style={{ marginTop: 4, fontSize: 14, color: '#667085' }}>
                  Choose the shared space you want to manage.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsOpen(false)}
                style={{
                  height: 40,
                  width: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 20,
                  backgroundColor: isDark ? '#27272A' : '#FFFFFF',
                }}
                accessibilityLabel="Close group switcher"
                accessibilityRole="button"
              >
                <Ionicons name="close" size={20} color={isDark ? '#FAFAFA' : '#171b24'} />
              </TouchableOpacity>
            </View>

            {groups.map((group) => {
              const selected = group.id === activeGroup.id;
              return (
                <TouchableOpacity
                  key={group.id}
                  activeOpacity={0.86}
                  style={{
                    marginBottom: 12,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: selected ? '#2d6a4f' : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(23,27,36,0.1)',
                    backgroundColor: selected
                      ? (isDark ? '#1a2e25' : '#EEF6F3')
                      : (isDark ? '#27272A' : '#FFFFFF'),
                    padding: 16,
                  }}
                  onPress={() => {
                    onSelect(group.id);
                    setIsOpen(false);
                  }}
                  accessibilityLabel={`Select group ${group.name}`}
                  accessibilityRole="button"
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1, marginRight: 16 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: isDark ? '#FAFAFA' : '#171b24' }}>
                        {group.name}
                      </Text>
                      <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        <Chip variant="soft" size="sm">
                          {`${group.type} · ${group.currency}`}
                        </Chip>
                        <Chip variant="soft" size="sm">
                          {`Cycle day ${group.cycle_date}`}
                        </Chip>
                      </View>
                    </View>
                    {selected ? (
                      <Ionicons name="checkmark-circle" size={24} color="#2d6a4f" />
                    ) : (
                      <Ionicons name="chevron-forward" size={20} color="#667085" />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}

            {onOpenSetup && (
              <View style={{ marginTop: 8 }}>
                <Button
                  variant="outline"
                 
                  className="w-full"
                  onPress={() => {
                    setIsOpen(false);
                    onOpenSetup();
                  }}
                >
                  {pendingInvites > 0
                    ? 'Review invites and setup'
                    : 'Create or join another group'}
                </Button>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
