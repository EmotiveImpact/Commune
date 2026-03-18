import { useMemo, useState } from 'react';
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Group } from '@commune/types';
import { AppButton, StatusChip, Surface } from './ui';

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

  const activeGroup = useMemo(
    () => groups.find((group) => group.id === activeGroupId) ?? groups[0] ?? null,
    [activeGroupId, groups]
  );

  if (!activeGroup) {
    return null;
  }

  return (
    <>
      <TouchableOpacity activeOpacity={0.88} onPress={() => setIsOpen(true)}>
        {variant === 'compact' ? (
          <View className="flex-row items-center rounded-[18px] bg-white/10 px-3 py-2">
            <View className="mr-2 flex-1">
              <Text
                className="text-[13px] font-semibold text-white"
                numberOfLines={1}
              >
                {activeGroup.name}
              </Text>
              <Text className="mt-0.5 text-[11px] text-[#BBB4C1]">
                {pendingInvites > 0
                  ? `${pendingInvites} invite${pendingInvites === 1 ? '' : 's'}`
                  : `${activeGroup.type} group`}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={16} color="#FFFFFF" />
          </View>
        ) : (
          <Surface className="mb-3 p-4">
            <View className="flex-row items-center justify-between">
              <View className="mr-4 flex-1">
                <Text className="text-[11px] font-semibold uppercase tracking-[2px] text-[#7B746D]">
                  Group
                </Text>
                <Text className="mt-1.5 text-lg font-semibold text-[#17141F]">
                  {activeGroup.name}
                </Text>
                <View className="mt-2 flex-row flex-wrap">
                  <StatusChip
                    label={`${activeGroup.type} group · ${activeGroup.currency}`}
                  />
                  {pendingInvites > 0 ? (
                    <StatusChip
                      label={`${pendingInvites} invite${pendingInvites === 1 ? '' : 's'}`}
                      tone="sky"
                    />
                  ) : null}
                </View>
              </View>
              <View className="h-10 w-10 items-center justify-center rounded-[18px] bg-[#EEF6F3]">
                <Ionicons name="swap-horizontal" size={18} color="#205C54" />
              </View>
            </View>
          </Surface>
        )}
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black/30"
          onPress={() => setIsOpen(false)}
        >
          <Pressable className="mt-auto rounded-t-[32px] bg-[#F4EFE8] px-5 pb-10 pt-6">
            <View className="mb-5 flex-row items-center justify-between">
              <View>
                <Text className="text-2xl font-semibold text-[#17141F]">
                  Switch group
                </Text>
                <Text className="mt-1 text-sm text-[#6A645D]">
                  Choose the shared space you want to manage.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsOpen(false)}
                className="h-10 w-10 items-center justify-center rounded-full bg-white"
              >
                <Ionicons name="close" size={20} color="#17141F" />
              </TouchableOpacity>
            </View>

            {groups.map((group) => {
              const selected = group.id === activeGroup.id;
              return (
                <TouchableOpacity
                  key={group.id}
                  activeOpacity={0.86}
                  className={`mb-3 rounded-[24px] border px-4 py-4 ${selected ? 'border-[#17141F] bg-[#F2F6EC]' : 'border-[#DDD5CA] bg-white'}`}
                  onPress={() => {
                    onSelect(group.id);
                    setIsOpen(false);
                  }}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="mr-4 flex-1">
                      <Text className="text-base font-semibold text-[#17141F]">
                        {group.name}
                      </Text>
                      <View className="mt-2 flex-row flex-wrap">
                        <StatusChip label={`${group.type} · ${group.currency}`} />
                        <StatusChip label={`Cycle day ${group.cycle_date}`} tone="neutral" />
                      </View>
                    </View>
                    {selected ? (
                      <Ionicons name="checkmark-circle" size={24} color="#17141F" />
                    ) : (
                      <Ionicons name="chevron-forward" size={20} color="#827A72" />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}

            {onOpenSetup ? (
              <View className="mt-2">
                <AppButton
                  label={
                    pendingInvites > 0
                      ? 'Review invites and setup'
                      : 'Create or join another group'
                  }
                  variant="secondary"
                  icon="add-circle-outline"
                  onPress={() => {
                    setIsOpen(false);
                    onOpenSetup();
                  }}
                />
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
