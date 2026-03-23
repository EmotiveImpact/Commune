import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { useThemeStore } from '@/stores/theme';
import { useGroup, useUpdateGroup } from '@/hooks/use-groups';
import { getErrorMessage } from '@/lib/errors';
import { hapticLight, hapticMedium, hapticHeavy, hapticSuccess, hapticWarning, hapticSelection } from '@/lib/haptics';

const GROUP_TYPES = ['household', 'flat', 'couple', 'friends', 'workspace'] as const;
const CURRENCIES = ['GBP', 'USD', 'EUR', 'CAD', 'AUD', 'NGN', 'GHS', 'ZAR', 'INR', 'JPY'] as const;
const BILLING_CYCLES = ['weekly', 'monthly'] as const;

/* -------------------------------------------------------------------------- */
/*  Empty state                                                               */
/* -------------------------------------------------------------------------- */

function EmptyStateCard({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#FAFAFA',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
      }}
    >
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: 20,
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 3,
        }}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: '#F3F4F6',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <Ionicons name={icon} size={24} color="#9CA3AF" />
        </View>
        <Text style={{ fontSize: 17, fontWeight: '600', color: '#111827', marginBottom: 6 }}>
          {title}
        </Text>
        <Text
          style={{
            fontSize: 14,
            lineHeight: 20,
            color: '#6B7280',
            textAlign: 'center',
            maxWidth: 280,
            marginBottom: actionLabel ? 16 : 0,
          }}
        >
          {description}
        </Text>
        {actionLabel && onAction && (
          <TouchableOpacity onPress={onAction}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#2d6a4f' }}>
              {actionLabel}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main screen                                                               */
/* -------------------------------------------------------------------------- */

export default function GroupEditScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { activeGroupId } = useGroupStore();
  const { mode } = useThemeStore();
  const isDark = mode === 'dark';
  const {
    data: group,
    isLoading,
    error: groupError,
    refetch: refetchGroup,
  } = useGroup(activeGroupId ?? '');
  const updateGroup = useUpdateGroup(activeGroupId ?? '');

  const [name, setName] = useState('');
  const [type, setType] = useState<string>('household');
  const [currency, setCurrency] = useState<string>('GBP');
  const [billingCycle, setBillingCycle] = useState<string>('monthly');
  const [description, setDescription] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  useEffect(() => {
    if (group) {
      setName(group.name);
      setType(group.type ?? 'household');
      setCurrency(group.currency ?? 'GBP');
      setBillingCycle(
        ((group as unknown as Record<string, unknown>).billing_cycle as string) ?? 'monthly',
      );
      setDescription(
        ((group as unknown as Record<string, unknown>).description as string) ?? '',
      );
    }
  }, [group]);

  /* -- early returns ------------------------------------------------------- */

  if (!activeGroupId) {
    return (
      <EmptyStateCard
        icon="settings-outline"
        title="No group selected"
        description="Pick a group from the dashboard first."
        actionLabel="Go back"
        onAction={() => router.back()}
      />
    );
  }

  if (groupError) {
    return (
      <EmptyStateCard
        icon="cloud-offline-outline"
        title="Could not load group"
        description={getErrorMessage(groupError, 'Something went wrong loading group details.')}
        actionLabel="Try again"
        onAction={() => {
          void refetchGroup();
        }}
      />
    );
  }

  if (isLoading || !group) {
    return (
      <ScrollView style={{ flex: 1, paddingHorizontal: 20, paddingTop: 24, backgroundColor: '#FAFAFA' }}>
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              marginBottom: 16,
              borderRadius: 16,
              height: 100,
              backgroundColor: '#E5E7EB',
              opacity: 0.5,
            }}
          />
        ))}
      </ScrollView>
    );
  }

  const isAdmin = group.members.some(
    (member) => member.user_id === user?.id && member.role === 'admin',
  );

  if (!isAdmin) {
    return (
      <EmptyStateCard
        icon="lock-closed-outline"
        title="Admin access required"
        description="Only group admins can edit group settings."
        actionLabel="Go back"
        onAction={() => router.back()}
      />
    );
  }

  /* -- handlers ------------------------------------------------------------ */

  async function handleSave() {
    hapticMedium();
    if (!name.trim()) {
      hapticWarning();
      Alert.alert('Validation error', 'Group name is required.');
      return;
    }

    try {
      await updateGroup.mutateAsync({
        name: name.trim(),
        type,
        currency,
        billing_cycle: billingCycle,
      });
      hapticSuccess();
      Alert.alert('Saved', 'Group settings have been updated.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      hapticWarning();
      Alert.alert('Update failed', getErrorMessage(error, 'Could not save group settings.'));
    }
  }

  function handleDeleteGroup() {
    hapticHeavy();
    if (deleteConfirmation !== 'DELETE') {
      hapticWarning();
      Alert.alert('Confirmation required', 'Type DELETE to confirm.');
      return;
    }
    Alert.alert(
      'Delete group permanently?',
      'This action cannot be undone. All expenses, payments, and member data will be removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete group',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Deleted', 'The group has been permanently removed.', [
              { text: 'OK', onPress: () => router.replace('/(tabs)') },
            ]);
          },
        },
      ],
    );
  }

  /* -- render -------------------------------------------------------------- */

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#FAFAFA' }}
      contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 24, fontWeight: '700', color: '#171b24' }}>
          Edit group
        </Text>
        <Text style={{ marginTop: 4, fontSize: 14, color: '#667085' }}>
          Update your group details, manage members, and configure preferences.
        </Text>
        <View
          style={{
            marginTop: 8,
            alignSelf: 'flex-start',
            paddingHorizontal: 12,
            paddingVertical: 5,
            borderRadius: 20,
            backgroundColor: '#F3F4F6',
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '500', color: '#6B7280' }}>
            {group.name}
          </Text>
        </View>
      </View>

      {/* Group name */}
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 3,
        }}
      >
        <Text style={{ marginBottom: 4, fontSize: 18, fontWeight: '600', color: '#171b24' }}>
          Group name
        </Text>
        <Text style={{ marginBottom: 12, fontSize: 14, color: '#667085' }}>
          The name visible to all members.
        </Text>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
          Name
        </Text>
        <TextInput
          style={{
            backgroundColor: '#F3F4F6',
            borderRadius: 12,
            height: 50,
            paddingHorizontal: 16,
            fontSize: 16,
            color: '#111827',
          }}
          placeholder="Enter group name"
          placeholderTextColor="#9CA3AF"
          value={name}
          onChangeText={setName}
        />
      </View>

      {/* Description */}
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 3,
        }}
      >
        <Text style={{ marginBottom: 4, fontSize: 18, fontWeight: '600', color: '#171b24' }}>
          Description
        </Text>
        <Text style={{ marginBottom: 12, fontSize: 14, color: '#667085' }}>
          Optional details about this group.
        </Text>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
          Description
        </Text>
        <TextInput
          style={{
            backgroundColor: '#F3F4F6',
            borderRadius: 12,
            minHeight: 50,
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontSize: 16,
            color: '#111827',
            textAlignVertical: 'top',
          }}
          placeholder="e.g. Shared flat expenses for 2026"
          placeholderTextColor="#9CA3AF"
          value={description}
          onChangeText={setDescription}
          multiline
        />
      </View>

      {/* Group type */}
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 3,
        }}
      >
        <Text style={{ marginBottom: 4, fontSize: 18, fontWeight: '600', color: '#171b24' }}>
          Group type
        </Text>
        <Text style={{ marginBottom: 12, fontSize: 14, color: '#667085' }}>
          What kind of group is this?
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {GROUP_TYPES.map((option) => (
            <TouchableOpacity
              key={option}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 20,
                backgroundColor: type === option ? '#1f2330' : '#F3F4F6',
              }}
              onPress={() => { hapticSelection(); setType(option); }}
              activeOpacity={0.7}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '500',
                  color: type === option ? '#FFFFFF' : '#6B7280',
                }}
              >
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Currency */}
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 3,
        }}
      >
        <Text style={{ marginBottom: 4, fontSize: 18, fontWeight: '600', color: '#171b24' }}>
          Default currency
        </Text>
        <Text style={{ marginBottom: 12, fontSize: 14, color: '#667085' }}>
          Used for new expenses in this group.
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {CURRENCIES.map((option) => (
            <TouchableOpacity
              key={option}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 20,
                backgroundColor: currency === option ? '#1f2330' : '#F3F4F6',
              }}
              onPress={() => { hapticSelection(); setCurrency(option); }}
              activeOpacity={0.7}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '500',
                  color: currency === option ? '#FFFFFF' : '#6B7280',
                }}
              >
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Billing cycle */}
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 3,
        }}
      >
        <Text style={{ marginBottom: 4, fontSize: 18, fontWeight: '600', color: '#171b24' }}>
          Billing cycle
        </Text>
        <Text style={{ marginBottom: 12, fontSize: 14, color: '#667085' }}>
          How often the group settles up.
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {BILLING_CYCLES.map((option) => (
            <TouchableOpacity
              key={option}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 20,
                backgroundColor: billingCycle === option ? '#1f2330' : '#F3F4F6',
              }}
              onPress={() => { hapticSelection(); setBillingCycle(option); }}
              activeOpacity={0.7}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '500',
                  color: billingCycle === option ? '#FFFFFF' : '#6B7280',
                }}
              >
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Members section */}
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 3,
        }}
      >
        <View style={{ marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#171b24' }}>
              Members
            </Text>
            <Text style={{ marginTop: 4, fontSize: 14, color: '#667085' }}>
              {group.members.length} member{group.members.length !== 1 ? 's' : ''} in this group
            </Text>
          </View>
          <View
            style={{
              height: 40,
              width: 40,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 12,
              backgroundColor: '#EEF6F3',
            }}
          >
            <Ionicons name="people-outline" size={18} color="#2d6a4f" />
          </View>
        </View>

        {group.members.map((member, index) => {
          const isCurrentUser = member.user_id === user?.id;
          const displayName = member.user.name ?? member.user.email;
          const initials = displayName
            .split(' ')
            .map((n: string) => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();
          const isLastItem = index === group.members.length - 1;

          return (
            <View
              key={member.user_id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderTopWidth: 1,
                borderTopColor: '#F0F0F0',
                borderBottomWidth: isLastItem ? 0 : 0,
              }}
            >
              {/* Avatar */}
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: '#1f2330',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}>
                  {initials}
                </Text>
              </View>

              {/* Name + email */}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: '#171b24' }}>
                    {displayName}
                  </Text>
                  {isCurrentUser && (
                    <Text style={{ marginLeft: 8, fontSize: 12, color: '#667085' }}>
                      (you)
                    </Text>
                  )}
                </View>
                {member.user.name && member.user.email && (
                  <Text style={{ marginTop: 2, fontSize: 12, color: '#667085' }}>
                    {member.user.email}
                  </Text>
                )}
              </View>

              {/* Role chip */}
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 20,
                  backgroundColor: member.role === 'admin' ? '#ECFDF5' : '#F3F4F6',
                  marginRight: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '500',
                    color: member.role === 'admin' ? '#059669' : '#6B7280',
                  }}
                >
                  {member.role}
                </Text>
              </View>

              {/* Chevron */}
              <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
            </View>
          );
        })}
      </View>

      {/* Save button */}
      <TouchableOpacity
        style={{
          backgroundColor: updateGroup.isPending ? '#D1D5DB' : '#1f2330',
          height: 52,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
        }}
        onPress={handleSave}
        disabled={updateGroup.isPending}
        activeOpacity={0.8}
      >
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>
          Save changes
        </Text>
      </TouchableOpacity>

      {/* Danger zone */}
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          borderLeftWidth: 4,
          borderLeftColor: '#DC2626',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 3,
        }}
      >
        <View style={{ marginBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              marginRight: 12,
              height: 40,
              width: 40,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 12,
              backgroundColor: '#FEF2F2',
            }}
          >
            <Ionicons name="warning-outline" size={18} color="#DC2626" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#DC2626' }}>
              Danger Zone
            </Text>
            <Text style={{ marginTop: 2, fontSize: 14, color: '#667085' }}>
              Irreversible actions
            </Text>
          </View>
        </View>

        <Text style={{ fontSize: 14, lineHeight: 24, color: '#667085' }}>
          Deleting this group will permanently remove all expenses, payments, and member data.
          This action cannot be undone.
        </Text>

        <Text style={{ marginTop: 16, marginBottom: 8, fontSize: 14, fontWeight: '600', color: '#374151' }}>
          Type DELETE to confirm
        </Text>
        <TextInput
          style={{
            marginBottom: 16,
            height: 50,
            borderRadius: 12,
            borderWidth: 1,
            paddingHorizontal: 16,
            fontSize: 16,
            borderColor: 'rgba(220,38,38,0.2)',
            backgroundColor: '#FEF2F2',
            color: '#DC2626',
          }}
          placeholder="DELETE"
          placeholderTextColor="rgba(220,38,38,0.3)"
          value={deleteConfirmation}
          onChangeText={setDeleteConfirmation}
          autoCapitalize="characters"
        />

        <TouchableOpacity
          style={{
            backgroundColor: deleteConfirmation === 'DELETE' ? '#FEF2F2' : '#F9FAFB',
            height: 52,
            borderRadius: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: deleteConfirmation === 'DELETE' ? 1 : 0.4,
          }}
          onPress={handleDeleteGroup}
          disabled={deleteConfirmation !== 'DELETE'}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={16} color="#DC2626" />
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#DC2626' }}>
            Delete group permanently
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
