import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { createGroupSchema, inviteMemberSchema } from '@commune/core';
import { GroupType } from '@commune/types';
import { useGroupStore } from '@/stores/group';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';
import {
  useAcceptInvite,
  useCreateGroup,
  useInviteMember,
  usePendingInvites,
  useUserGroups,
} from '@/hooks/use-groups';
import { usePlanLimits } from '@/hooks/use-plan-limits';
import { getErrorMessage } from '@/lib/errors';
import { hapticLight, hapticMedium, hapticSuccess, hapticWarning } from '@/lib/haptics';

const groupTypeOptions = Object.entries(GroupType).map(([key, value]) => ({
  label: key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' '),
  value,
}));

type OnboardingStep = 1 | 2 | 3;

const STEP_LABELS: Record<OnboardingStep, { title: string; subtitle: string }> = {
  1: {
    title: 'Create your group',
    subtitle: 'Start with one shared space for the bills, subscriptions, or trip costs you manage together.',
  },
  2: {
    title: 'Invite your people',
    subtitle: 'Invite housemates, teammates, or collaborators. You can skip this and come back later.',
  },
  3: {
    title: 'Add your first expense',
    subtitle: 'Your group is ready. Start tracking shared expenses right away.',
  },
};

/* ---------- Shimmer skeleton ---------- */
function ShimmerBlock({ width, height, style }: { width: number | string; height: number; style?: object }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width: width as number, height, borderRadius: 8, backgroundColor: '#E5E7EB', opacity },
        style,
      ]}
    />
  );
}

function OnboardingSkeleton() {
  return (
    <View style={{ flex: 1, backgroundColor: '#FAFAFA', paddingHorizontal: 20, paddingTop: 60 }}>
      <ShimmerBlock width="60%" height={28} style={{ marginBottom: 8 }} />
      <ShimmerBlock width="90%" height={14} style={{ marginBottom: 32 }} />
      <ShimmerBlock width="100%" height={200} style={{ borderRadius: 16 }} />
    </View>
  );
}

/* ---------- Empty state ---------- */
function OnboardingEmpty({
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
      <View style={{ alignItems: 'center', paddingVertical: 24 }}>
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
        <Text
          style={{
            fontSize: 17,
            fontWeight: '600',
            color: '#111827',
            marginBottom: 6,
          }}
        >
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

/* ---------- Step indicator ---------- */
function StepIndicator({ current, total }: { current: OnboardingStep; total: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      {Array.from({ length: total }, (_, i) => {
        const step = (i + 1) as OnboardingStep;
        const isActive = step === current;
        const isComplete = step < current;
        return (
          <View key={step} style={{ alignItems: 'center' }}>
            <View
              style={{
                width: isActive ? 32 : isComplete ? 10 : 8,
                height: isActive ? 10 : isComplete ? 10 : 8,
                borderRadius: 5,
                backgroundColor: isActive || isComplete ? '#2d6a4f' : '#E5E7EB',
              }}
            />
          </View>
        );
      })}
    </View>
  );
}

/* ---------- Main screen ---------- */
export default function OnboardingScreen() {
  const router = useRouter();
  const mode = useThemeStore((s) => s.mode);
  const isDark = mode === 'dark';

  const { user } = useAuthStore();
  const { activeGroupId, setActiveGroupId } = useGroupStore();
  const { canCreateGroup, groupLimit, currentGroups } = usePlanLimits(user?.id ?? '');
  const {
    data: groups,
    isLoading: groupsLoading,
    error: groupsError,
    refetch: refetchGroups,
  } = useUserGroups();
  const {
    data: pendingInvites,
    isLoading: invitesLoading,
    error: invitesError,
    refetch: refetchInvites,
  } = usePendingInvites();
  const createGroup = useCreateGroup();
  const acceptInvite = useAcceptInvite();
  const [showCreateFlow, setShowCreateFlow] = useState(false);
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState<(typeof GroupType)[keyof typeof GroupType]>(
    GroupType.HOME,
  );
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('GBP');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitedEmails, setInvitedEmails] = useState<string[]>([]);

  const inviteMember = useInviteMember(createdGroupId ?? '');

  const loadError = groupsError ?? invitesError;

  const currentStep: OnboardingStep = createdGroupId
    ? invitedEmails.length > 0
      ? 3
      : 2
    : 1;

  useEffect(() => {
    if (groupsLoading || invitesLoading || loadError) {
      return;
    }

    if (activeGroupId) {
      router.replace('/(tabs)');
      return;
    }

    const firstGroupId = groups?.[0]?.id;
    if (firstGroupId) {
      setActiveGroupId(firstGroupId);
      router.replace('/(tabs)');
      return;
    }

    if ((pendingInvites?.length ?? 0) === 0) {
      setShowCreateFlow(true);
    }
  }, [
    activeGroupId,
    groups,
    loadError,
    groupsLoading,
    invitesLoading,
    pendingInvites?.length,
    router,
    setActiveGroupId,
  ]);

  async function handleCreateGroup() {
    hapticMedium();
    if (!canCreateGroup) {
      hapticWarning();
      Alert.alert(
        'Group limit reached',
        `You've reached the group limit for your plan (${currentGroups}/${groupLimit === Infinity ? 'unlimited' : groupLimit}). Upgrade your plan to create more groups.`,
      );
      return;
    }

    const result = createGroupSchema.safeParse({
      name,
      type,
      description: description || undefined,
      currency,
      cycle_date: 1,
    });

    if (!result.success) {
      hapticWarning();
      Alert.alert('Check your details', result.error.issues[0]?.message ?? 'Group details are invalid.');
      return;
    }

    try {
      const group = await createGroup.mutateAsync(result.data);
      hapticSuccess();
      setCreatedGroupId(group.id);
      setActiveGroupId(group.id);
      setShowCreateFlow(true);
      Alert.alert('Group created', `${group.name} is ready for expenses.`);
    } catch (error) {
      hapticWarning();
      Alert.alert('Could not create group', getErrorMessage(error));
    }
  }

  async function handleInvite() {
    hapticMedium();
    const result = inviteMemberSchema.safeParse({ email: inviteEmail });
    if (!result.success || !createdGroupId) {
      hapticWarning();
      Alert.alert('Invalid email', 'Enter a valid email address.');
      return;
    }

    try {
      await inviteMember.mutateAsync(result.data.email);
      hapticSuccess();
      setInvitedEmails((current) => [...current, result.data.email]);
      setInviteEmail('');
    } catch (error) {
      hapticWarning();
      Alert.alert('Invite failed', getErrorMessage(error, 'Could not send invite.'));
    }
  }

  async function handleAcceptInvite(groupId: string) {
    hapticMedium();
    try {
      await acceptInvite.mutateAsync(groupId);
      hapticSuccess();
      setActiveGroupId(groupId);
      router.replace('/(tabs)');
    } catch (error) {
      hapticWarning();
      Alert.alert('Could not join group', getErrorMessage(error));
    }
  }

  if (groupsLoading || invitesLoading) {
    return <OnboardingSkeleton />;
  }

  if (loadError) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: '#FAFAFA' }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 60 }}
      >
        <OnboardingEmpty
          icon="cloud-offline-outline"
          title="Setup unavailable"
          description={getErrorMessage(loadError, 'Could not load your group setup right now.')}
          actionLabel="Try again"
          onAction={() => {
            hapticLight();
            void refetchGroups();
            void refetchInvites();
          }}
        />
      </ScrollView>
    );
  }

  /* ---------- Pending invites view ---------- */
  if ((pendingInvites?.length ?? 0) > 0 && !showCreateFlow && !createdGroupId) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: '#FAFAFA' }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 60, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ marginBottom: 24 }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              backgroundColor: '#F3F4F6',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Ionicons name="mail-outline" size={22} color="#6B7280" />
          </View>
          <Text
            style={{
              fontSize: 28,
              fontWeight: '700',
              color: '#111827',
              marginBottom: 6,
            }}
          >
            You have an invite waiting
          </Text>
          <Text
            style={{
              fontSize: 15,
              lineHeight: 22,
              color: '#6B7280',
            }}
          >
            Join the right shared workspace instead of starting from an empty dashboard.
          </Text>
        </View>

        {pendingInvites?.map((invite) => (
          <View
            key={invite.id}
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
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  marginRight: 12,
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: '#EEF6F3',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="people-outline" size={20} color="#2d6a4f" />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: '600',
                    color: '#111827',
                  }}
                >
                  {invite.group.name}
                </Text>
                <Text
                  style={{
                    marginTop: 2,
                    fontSize: 14,
                    color: '#6B7280',
                  }}
                >
                  {invite.group.type} group
                  {invite.group.description ? ` \u00B7 ${invite.group.description}` : ''}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={{
                marginTop: 16,
                backgroundColor: '#1f2330',
                height: 52,
                borderRadius: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
              onPress={() => handleAcceptInvite(invite.group_id)}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>
                Accept invite
              </Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity
          style={{
            marginTop: 4,
            backgroundColor: '#FFFFFF',
            height: 52,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: '#E5E7EB',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onPress={() => { hapticLight(); setShowCreateFlow(true); }}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151' }}>
            Create a different group
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  /* ---------- Main onboarding flow ---------- */
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#FAFAFA' }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 60, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header with step info */}
      <View style={{ marginBottom: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <View
            style={{
              marginRight: 12,
              width: 40,
              height: 40,
              borderRadius: 14,
              backgroundColor: '#F3F4F6',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons
              name={
                currentStep === 1
                  ? 'add-circle-outline'
                  : currentStep === 2
                    ? 'people-outline'
                    : 'receipt-outline'
              }
              size={20}
              color="#6B7280"
            />
          </View>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: 1.5,
              color: '#9CA3AF',
            }}
          >
            Step {currentStep} of 3
          </Text>
        </View>
        <Text
          style={{
            fontSize: 28,
            fontWeight: '700',
            color: '#111827',
            marginBottom: 6,
          }}
        >
          {STEP_LABELS[currentStep].title}
        </Text>
        <Text
          style={{
            fontSize: 15,
            lineHeight: 22,
            color: '#6B7280',
          }}
        >
          {STEP_LABELS[currentStep].subtitle}
        </Text>
        <View style={{ marginTop: 20 }}>
          <StepIndicator current={currentStep} total={3} />
        </View>
      </View>

      {/* Step 1: Create group */}
      {!createdGroupId ? (
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
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
            Group name
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
            placeholder="42 Oak Street"
            placeholderTextColor="#9CA3AF"
            value={name}
            onChangeText={setName}
          />

          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: '#374151',
              marginBottom: 8,
              marginTop: 20,
            }}
          >
            Group type
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {groupTypeOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 20,
                  backgroundColor: option.value === type ? '#1f2330' : '#F3F4F6',
                }}
                onPress={() => { hapticLight(); setType(option.value); }}
                activeOpacity={0.7}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '500',
                    color: option.value === type ? '#FFFFFF' : '#6B7280',
                  }}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
            Currency
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
            placeholder="GBP"
            placeholderTextColor="#9CA3AF"
            value={currency}
            onChangeText={(value: string) => setCurrency(value.toUpperCase())}
            autoCapitalize="characters"
            maxLength={3}
          />

          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: '#374151',
              marginBottom: 8,
              marginTop: 20,
            }}
          >
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
            placeholder="Optional details about the group"
            placeholderTextColor="#9CA3AF"
            value={description}
            onChangeText={setDescription}
            multiline
          />

          {!canCreateGroup && (
            <View
              style={{
                marginTop: 16,
                borderRadius: 16,
                backgroundColor: '#FFF1DB',
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}
            >
              <Text style={{ fontSize: 14, color: '#8A593B' }}>
                You've reached the group limit for your plan ({currentGroups}/
                {groupLimit === Infinity ? 'unlimited' : groupLimit}). Upgrade to create more
                groups.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={{
              marginTop: 20,
              backgroundColor: canCreateGroup ? '#1f2330' : '#D1D5DB',
              height: 52,
              borderRadius: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
            onPress={handleCreateGroup}
            disabled={!canCreateGroup}
            activeOpacity={0.8}
          >
            <Ionicons name="sparkles-outline" size={16} color="#FFFFFF" />
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>
              Create group
            </Text>
          </TouchableOpacity>
        </View>
      ) : currentStep === 2 ? (
        /* Step 2: Invite members */
        <>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View
                style={{
                  marginRight: 12,
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: '#EEF6F3',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="mail-outline" size={18} color="#2d6a4f" />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: '600',
                    color: '#111827',
                  }}
                >
                  Add members by email
                </Text>
                <Text
                  style={{
                    marginTop: 2,
                    fontSize: 14,
                    color: '#6B7280',
                  }}
                >
                  They can accept from web or mobile.
                </Text>
              </View>
            </View>

            <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
              Email
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
              placeholder="member@example.com"
              placeholderTextColor="#9CA3AF"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <TouchableOpacity
              style={{
                marginTop: 12,
                backgroundColor: '#FFFFFF',
                height: 52,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: '#E5E7EB',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
              onPress={handleInvite}
              activeOpacity={0.7}
            >
              <Ionicons name="mail-outline" size={16} color="#374151" />
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151' }}>
                Send invite
              </Text>
            </TouchableOpacity>

            {invitedEmails.length > 0 && (
              <View
                style={{
                  marginTop: 20,
                  borderRadius: 16,
                  backgroundColor: '#EEF6F3',
                  padding: 16,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#2d6a4f' }}>
                  Invites sent
                </Text>
                {invitedEmails.map((email) => (
                  <View key={email} style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="checkmark-circle" size={14} color="#2d6a4f" />
                    <Text
                      style={{
                        marginLeft: 8,
                        fontSize: 14,
                        color: '#6B7280',
                      }}
                    >
                      {email}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <TouchableOpacity
            style={{
              backgroundColor: '#1f2330',
              height: 52,
              borderRadius: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
            onPress={() => { hapticMedium(); router.replace('/(tabs)'); }}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>
              Continue to dashboard
            </Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </>
      ) : (
        /* Step 3: Ready to go */
        <>
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
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: '#EEF6F3',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <Ionicons name="checkmark-circle" size={32} color="#2d6a4f" />
              </View>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: '700',
                  color: '#111827',
                  marginBottom: 8,
                }}
              >
                You're all set
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  lineHeight: 20,
                  color: '#6B7280',
                  textAlign: 'center',
                  maxWidth: 260,
                }}
              >
                Your group is ready with {invitedEmails.length} invite
                {invitedEmails.length !== 1 ? 's' : ''} sent. Start adding expenses now.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={{
              backgroundColor: '#1f2330',
              height: 52,
              borderRadius: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
            onPress={() => { hapticMedium(); router.replace('/(tabs)'); }}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>
              Go to dashboard
            </Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </>
      )}

      {!createdGroupId && groups?.length === 0 ? null : (
        <TouchableOpacity
          style={{ marginTop: 20, paddingVertical: 8 }}
          onPress={() => { hapticLight(); router.replace('/(tabs)'); }}
        >
          <Text
            style={{
              textAlign: 'center',
              fontSize: 14,
              fontWeight: '500',
              color: '#2d6a4f',
            }}
          >
            Skip for now
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}
