import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  createGroupSchema,
  getSpaceEssentialDefinitions,
  getSpacePreset,
  inviteMemberSchema,
} from '@commune/core';
import { GroupType, type SpaceEssentials } from '@commune/types';
import { Screen, Button, EmptyState, Pressable } from '@/components/primitives';
import { colors, radius, space } from '@/constants/design';
import { useGroupStore } from '@/stores/group';
import { useAuthStore } from '@/stores/auth';
import {
  useAcceptInvite,
  useCreateGroup,
  useInviteMember,
  usePendingInvites,
  useUserGroups,
} from '@/hooks/use-groups';
import { useApplyGroupStarterPack } from '@/hooks/use-onboarding';
import { usePlanLimits } from '@/hooks/use-plan-limits';
import { getErrorMessage } from '@/lib/errors';
import {
  hapticLight,
  hapticMedium,
  hapticSuccess,
  hapticWarning,
} from '@/lib/haptics';

type GroupTypeValue = (typeof GroupType)[keyof typeof GroupType];

type CreatedGroupState = {
  id: string;
  name: string;
  type: GroupTypeValue;
  subtype: string | null;
};

type StepKey = 'type' | 'name' | 'invite' | 'done';

const TYPE_OPTIONS: Array<{
  value: GroupTypeValue;
  label: string;
  caption: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  accent: string;
  bg: string;
}> = [
  {
    value: GroupType.HOME,
    label: 'Shared home',
    caption: 'Flatmates, rent, bills, and the everyday run of the house.',
    icon: 'home-outline',
    accent: colors.typeHome.accent,
    bg: colors.typeHome.bg,
  },
  {
    value: GroupType.COUPLE,
    label: 'Couple',
    caption: 'Two-person finances, shared goals, the joint budget.',
    icon: 'heart-outline',
    accent: colors.typeCouple.accent,
    bg: colors.typeCouple.bg,
  },
  {
    value: GroupType.TRIP,
    label: 'Trip',
    caption: 'A holiday or trip with shared costs to settle at the end.',
    icon: 'airplane-outline',
    accent: colors.typeTrip.accent,
    bg: colors.typeTrip.bg,
  },
  {
    value: GroupType.PROJECT,
    label: 'Project / Business',
    caption: 'A side project, pop-up, or small team with shared operations.',
    icon: 'briefcase-outline',
    accent: colors.typeProject.accent,
    bg: colors.typeProject.bg,
  },
];

const STEP_ORDER: StepKey[] = ['type', 'name', 'invite', 'done'];

function Header({
  step,
  onBack,
  onSkip,
  skipLabel = 'Skip',
}: {
  step: StepKey;
  onBack: () => void;
  onSkip?: () => void;
  skipLabel?: string;
}) {
  const isFirst = step === 'type';
  const isFinal = step === 'done';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        height: 44,
        marginBottom: space.base,
      }}
    >
      <View style={{ width: 44, alignItems: 'flex-start' }}>
        {!isFirst && !isFinal ? (
          <Pressable
            hitSlop={10}
            onPress={() => {
              hapticLight();
              onBack();
            }}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}
          >
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </Pressable>
        ) : null}
      </View>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textPrimary }}>
          Set up
        </Text>
      </View>
      <View style={{ width: 44, alignItems: 'flex-end' }}>
        {onSkip && !isFirst && !isFinal ? (
          <Pressable
            hitSlop={10}
            onPress={() => {
              hapticLight();
              onSkip();
            }}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted }}>
              {skipLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function Hero({
  emoji,
  title,
  caption,
  activeIndex,
  totalDots,
}: {
  emoji: string;
  title: string;
  caption: string;
  activeIndex: number;
  totalDots: number;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.bgInk,
        borderRadius: radius.hero,
        paddingVertical: 28,
        paddingHorizontal: 22,
        marginBottom: space.lg,
      }}
    >
      <View style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: 48, lineHeight: 56, marginBottom: 8 }}>{emoji}</Text>
        <Text
          style={{
            fontSize: 22,
            fontWeight: '700',
            lineHeight: 28,
            letterSpacing: -0.3,
            color: colors.textInverse,
            textAlign: 'center',
            marginBottom: 6,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontSize: 13,
            lineHeight: 20,
            color: 'rgba(255,255,255,0.65)',
            textAlign: 'center',
          }}
        >
          {caption}
        </Text>

        <View
          style={{
            flexDirection: 'row',
            gap: 6,
            justifyContent: 'center',
            marginTop: 16,
          }}
        >
          {Array.from({ length: totalDots }, (_, i) => {
            const active = i === activeIndex;
            return (
              <View
                key={i}
                style={{
                  height: 4,
                  width: active ? 32 : 24,
                  borderRadius: 2,
                  backgroundColor: active
                    ? colors.textInverse
                    : 'rgba(255,255,255,0.2)',
                }}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

function TypeTile({
  option,
  selected,
  onPress,
}: {
  option: (typeof TYPE_OPTIONS)[number];
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: colors.bgSurface,
        borderRadius: radius.card,
        borderWidth: selected ? 1.5 : 1,
        borderColor: selected ? colors.sage : colors.borderSubtle,
        padding: space.base,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        opacity: pressed ? 0.92 : 1,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: option.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={option.icon} size={20} color={option.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
          {option.label}
        </Text>
        <Text
          style={{
            fontSize: 12,
            lineHeight: 18,
            color: colors.textTertiary,
            marginTop: 2,
          }}
        >
          {option.caption}
        </Text>
      </View>
      {selected ? (
        <View
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: colors.sage,
          }}
        />
      ) : null}
    </Pressable>
  );
}

function EmailChip({ email, onRemove }: { email: string; onRemove: () => void }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.sageSoft,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: radius.pill,
      }}
    >
      <Ionicons name="checkmark-circle" size={14} color={colors.sage} />
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.sage }}>
        {email}
      </Text>
      <Pressable hitSlop={8} onPress={onRemove}>
        <Ionicons name="close" size={14} color={colors.sage} />
      </Pressable>
    </View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
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
  const [createdGroup, setCreatedGroup] = useState<CreatedGroupState | null>(null);
  const [starterApplied, setStarterApplied] = useState(false);

  const [step, setStep] = useState<StepKey>('type');
  const [type, setType] = useState<GroupTypeValue>(GroupType.HOME);
  const [name, setName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitedEmails, setInvitedEmails] = useState<string[]>([]);

  const inviteMember = useInviteMember(createdGroup?.id ?? '');
  const applyStarterPack = useApplyGroupStarterPack(createdGroup?.id ?? '');

  const resolvedGroupId = useMemo(() => {
    if (activeGroupId && groups?.some((group) => group.id === activeGroupId)) {
      return activeGroupId;
    }
    return groups?.[0]?.id ?? null;
  }, [activeGroupId, groups]);

  // Start on invite step when group already created but starter pending,
  // and skip straight to done when everything's applied.
  useEffect(() => {
    if (!createdGroup) return;
    if (!starterApplied) {
      setStep('invite');
    }
  }, [createdGroup, starterApplied]);

  // If the user already has a group, bypass onboarding entirely.
  useEffect(() => {
    if (groupsLoading || invitesLoading || groupsError || invitesError) return;
    if (createdGroup) return;

    if (resolvedGroupId) {
      if (resolvedGroupId !== activeGroupId) {
        setActiveGroupId(resolvedGroupId);
      }
      router.replace('/(tabs)');
      return;
    }

    if ((pendingInvites?.length ?? 0) === 0) {
      setShowCreateFlow(true);
    }
  }, [
    activeGroupId,
    createdGroup,
    groupsError,
    groupsLoading,
    invitesError,
    invitesLoading,
    pendingInvites?.length,
    resolvedGroupId,
    router,
    setActiveGroupId,
  ]);

  const stepIndex = STEP_ORDER.indexOf(step);

  function goBack() {
    if (step === 'name') setStep('type');
    else if (step === 'invite') setStep('name');
  }

  async function handleCreateGroupAndStarter() {
    hapticMedium();

    if (!canCreateGroup) {
      hapticWarning();
      Alert.alert(
        'Group limit reached',
        `You've reached the group limit for your plan (${currentGroups}/${groupLimit === Infinity ? 'unlimited' : groupLimit}). Upgrade your plan to create more groups.`,
      );
      return;
    }

    const trimmedName = name.trim();
    const result = createGroupSchema.safeParse({
      name: trimmedName,
      type,
      subtype: null,
      currency: 'GBP',
      cycle_date: 1,
    });

    if (!result.success) {
      hapticWarning();
      Alert.alert(
        'Check your details',
        result.error.issues[0]?.message ?? 'Group details are invalid.',
      );
      return;
    }

    try {
      const group = await createGroup.mutateAsync(result.data);
      hapticSuccess();
      const nextCreated: CreatedGroupState = {
        id: group.id,
        name: group.name,
        type: result.data.type as GroupTypeValue,
        subtype: result.data.subtype ?? null,
      };
      setCreatedGroup(nextCreated);
      setActiveGroupId(group.id);

      // Apply default starter pack silently — preserves the starter-pack mutation
      // from the prior multi-step flow so new groups aren't left empty.
      try {
        const defs = getSpaceEssentialDefinitions(nextCreated.type);
        const preset = getSpacePreset(nextCreated.type, nextCreated.subtype);
        const spaceEssentials = defs.reduce<SpaceEssentials>((acc, def) => {
          const seed = preset.essentialSeeds[def.key]?.trim();
          if (seed) {
            acc[def.key] = {
              label: def.label,
              value: seed,
              visible: def.defaultVisible !== false,
            };
          }
          return acc;
        }, {});

        await applyStarterPack.mutateAsync({
          groupType: nextCreated.type,
          subtype: nextCreated.subtype,
          includeStarterOperations: true,
          spaceEssentials,
        });
      } catch {
        // Starter pack is non-blocking; surface via Alert only on primary flow issues.
      }
      setStarterApplied(true);
      setStep('invite');
    } catch (error) {
      hapticWarning();
      Alert.alert('Could not create group', getErrorMessage(error));
    }
  }

  async function handleInvite() {
    hapticMedium();

    const result = inviteMemberSchema.safeParse({ email: inviteEmail.trim() });
    if (!result.success || !createdGroup) {
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

  function handleFinish() {
    hapticMedium();
    if (!createdGroup && !resolvedGroupId) {
      Alert.alert('Setup incomplete', 'Create or join a group before continuing.');
      return;
    }
    router.replace('/(tabs)');
  }

  function handlePrimary() {
    if (step === 'type') {
      hapticLight();
      setStep('name');
      return;
    }
    if (step === 'name') {
      if (!name.trim()) {
        hapticWarning();
        Alert.alert('Give it a name', 'Enter a name to continue.');
        return;
      }
      void handleCreateGroupAndStarter();
      return;
    }
    if (step === 'invite') {
      hapticLight();
      setStep('done');
      return;
    }
    handleFinish();
  }

  // Loading / error / invite-landing states render early — still apply the header
  // chrome so the design language is consistent.
  if (groupsLoading || invitesLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <Screen>
          <ScrollView
            contentContainerStyle={{
              paddingTop: 12,
              paddingBottom: 120,
              paddingHorizontal: space.gutter,
            }}
          >
            <Header step="type" onBack={() => {}} />
            <View style={{ paddingVertical: 48, alignItems: 'center' }}>
              <Text style={{ color: colors.textTertiary, fontSize: 14 }}>Loading…</Text>
            </View>
          </ScrollView>
        </Screen>
      </>
    );
  }

  const loadError = groupsError ?? invitesError;
  if (loadError) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <Screen>
          <ScrollView
            contentContainerStyle={{
              paddingTop: 12,
              paddingBottom: 120,
              paddingHorizontal: space.gutter,
            }}
          >
            <Header step="type" onBack={() => {}} />
            <EmptyState
              icon="alert-circle-outline"
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
        </Screen>
      </>
    );
  }

  if ((pendingInvites?.length ?? 0) > 0 && !showCreateFlow && !createdGroup) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <Screen>
          <ScrollView
            contentContainerStyle={{
              paddingTop: 12,
              paddingBottom: 120,
              paddingHorizontal: space.gutter,
            }}
            showsVerticalScrollIndicator={false}
          >
            <Header step="type" onBack={() => {}} />
            <Hero
              emoji="✉️"
              title="You have an invite waiting"
              caption="Join the right shared space instead of starting from scratch."
              activeIndex={0}
              totalDots={1}
            />

            {(pendingInvites ?? []).map((invite) => (
              <View
                key={invite.id}
                style={{
                  backgroundColor: colors.bgSurface,
                  borderRadius: radius.card,
                  borderWidth: 1,
                  borderColor: colors.borderSubtle,
                  padding: space.base,
                  marginBottom: 10,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: colors.sageSoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="people-outline" size={20} color={colors.sage} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                      {invite.group.name}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        lineHeight: 18,
                        color: colors.textTertiary,
                        marginTop: 2,
                      }}
                    >
                      {invite.group.type} group
                      {invite.group.description ? ` · ${invite.group.description}` : ''}
                    </Text>
                  </View>
                </View>
                <Button
                  label="Accept invite"
                  variant="primary"
                  fullWidth
                  onPress={() => handleAcceptInvite(invite.group_id)}
                  style={{ marginTop: space.md }}
                />
              </View>
            ))}

            <Button
              label="Create a different group"
              variant="secondary"
              fullWidth
              onPress={() => {
                hapticLight();
                setShowCreateFlow(true);
              }}
              style={{ marginTop: space.sm }}
            />
          </ScrollView>
        </Screen>
      </>
    );
  }

  const totalDots = 4;
  const selectedTypeOption = TYPE_OPTIONS.find((o) => o.value === type) ?? TYPE_OPTIONS[0]!;

  const primaryDisabled =
    (step === 'name' && (!name.trim() || createGroup.isPending || !canCreateGroup)) ||
    (step === 'invite' && inviteMember.isPending);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen>
        <ScrollView
          contentContainerStyle={{
            paddingTop: 12,
            paddingBottom: 120,
            paddingHorizontal: space.gutter,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Header
            step={step}
            onBack={goBack}
            onSkip={step === 'invite' ? () => setStep('done') : undefined}
            skipLabel="Skip"
          />

          {step === 'type' ? (
            <>
              <Hero
                emoji="🏠"
                title="Let's set up your group"
                caption="Pick the shape that fits best. You can fine-tune it later."
                activeIndex={0}
                totalDots={totalDots}
              />
              {TYPE_OPTIONS.map((option) => (
                <TypeTile
                  key={option.value}
                  option={option}
                  selected={option.value === type}
                  onPress={() => {
                    hapticLight();
                    setType(option.value);
                  }}
                />
              ))}
              {!canCreateGroup ? (
                <View
                  style={{
                    backgroundColor: colors.warnBg,
                    borderRadius: radius.card,
                    padding: space.base,
                    marginTop: space.sm,
                  }}
                >
                  <Text style={{ fontSize: 13, lineHeight: 20, color: colors.warnText }}>
                    You've reached the group limit for your plan ({currentGroups}/
                    {groupLimit === Infinity ? 'unlimited' : groupLimit}). Upgrade to create more.
                  </Text>
                </View>
              ) : null}
            </>
          ) : null}

          {step === 'name' ? (
            <>
              <Hero
                emoji="✍️"
                title="Give it a name"
                caption={`What do you call your ${selectedTypeOption.label.toLowerCase()}? This is just for your crew.`}
                activeIndex={1}
                totalDots={totalDots}
              />
              <View
                style={{
                  backgroundColor: colors.bgSurface,
                  borderRadius: radius.card,
                  borderWidth: 1,
                  borderColor: colors.borderSubtle,
                  paddingHorizontal: space.base,
                  paddingVertical: space.lg,
                }}
              >
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Shared Flat"
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={handlePrimary}
                  style={{
                    fontSize: 20,
                    fontWeight: '700',
                    color: colors.textPrimary,
                    paddingVertical: 8,
                  }}
                />
              </View>
            </>
          ) : null}

          {step === 'invite' ? (
            <>
              <Hero
                emoji="👋"
                title="Bring everyone in"
                caption="Add members by email — they'll get an invite. Or skip and do this later."
                activeIndex={2}
                totalDots={totalDots}
              />

              <View
                style={{
                  backgroundColor: colors.bgSurface,
                  borderRadius: radius.card,
                  borderWidth: 1,
                  borderColor: colors.borderSubtle,
                  padding: space.base,
                  marginBottom: 10,
                }}
              >
                <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
                  <TextInput
                    value={inviteEmail}
                    onChangeText={setInviteEmail}
                    placeholder="member@example.com"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    returnKeyType="done"
                    onSubmitEditing={handleInvite}
                    style={{
                      flex: 1,
                      fontSize: 15,
                      color: colors.textPrimary,
                      paddingVertical: 10,
                    }}
                  />
                  <Button
                    label={inviteMember.isPending ? '...' : 'Add'}
                    size="sm"
                    variant="primary"
                    onPress={handleInvite}
                    disabled={inviteMember.isPending || !inviteEmail.trim()}
                  />
                </View>
              </View>

              {invitedEmails.length > 0 ? (
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginBottom: space.sm,
                  }}
                >
                  {invitedEmails.map((email) => (
                    <EmailChip
                      key={email}
                      email={email}
                      onRemove={() =>
                        setInvitedEmails((current) => current.filter((e) => e !== email))
                      }
                    />
                  ))}
                </View>
              ) : null}
            </>
          ) : null}

          {step === 'done' ? (
            <>
              <Hero
                emoji="🎉"
                title="You're ready!"
                caption={
                  createdGroup
                    ? `${createdGroup.name} is set up${invitedEmails.length ? ` with ${invitedEmails.length} invite${invitedEmails.length === 1 ? '' : 's'} sent` : ''}. Jump in.`
                    : "Your group is set up. Jump in."
                }
                activeIndex={3}
                totalDots={totalDots}
              />
            </>
          ) : null}

          <View style={{ marginTop: space.lg }}>
            <Pressable
              onPress={handlePrimary}
              disabled={primaryDisabled}
              style={({ pressed }) => ({
                height: 56,
                borderRadius: 16,
                backgroundColor: colors.sage,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: primaryDisabled ? 0.5 : pressed ? 0.9 : 1,
              })}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: colors.textInverse,
                }}
              >
                {step === 'done'
                  ? 'Open Commune'
                  : step === 'name' && createGroup.isPending
                  ? 'Creating…'
                  : step === 'invite'
                  ? (invitedEmails.length > 0 ? 'Finish' : 'Continue')
                  : 'Continue →'}
              </Text>
            </Pressable>

            {step === 'name' && !canCreateGroup ? (
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textTertiary,
                  textAlign: 'center',
                  marginTop: space.sm,
                }}
              >
                Upgrade your plan to create a new group.
              </Text>
            ) : null}
          </View>
        </ScrollView>
      </Screen>
    </>
  );
}
