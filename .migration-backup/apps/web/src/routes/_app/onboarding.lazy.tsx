import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';
import {
  Badge,
  Button,
  Group,
  Paper,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Transition,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowRight,
  IconBriefcase,
  IconBrandInstagram,
  IconBrandReddit,
  IconBrandTiktok,
  IconBrandYoutube,
  IconCategory,
  IconCheck,
  IconChevronLeft,
  IconCoin,
  IconDeviceMobile,
  IconHeart,
  IconHome2,
  IconPlane,
  IconReceipt,
  IconSearch,
  IconSparkles,
  IconUsers,
} from '@tabler/icons-react';
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  ACQUISITION_SOURCE_OPTIONS,
  SUBTYPE_OPTIONS_BY_TYPE,
  getContextualSellCopy,
  type AcquisitionSource,
} from '@commune/core';
import { GroupType } from '@commune/types';
import {
  useCreateGroup,
  usePendingInvites,
  useUserGroupSummaries,
} from '../../hooks/use-groups';
import { useApplyGroupStarterPack } from '../../hooks/use-onboarding';
import { useUpdateProfile } from '../../hooks/use-profile';
import { useAuthStore } from '../../stores/auth';
import { useGroupStore } from '../../stores/group';
import { OnboardingSkeleton } from '../../components/page-skeleton';
import {
  shouldRedirectFromOnboarding,
  shouldResumeExistingGroup,
} from './-onboarding-helpers';

export const Route = createLazyFileRoute('/_app/onboarding')({
  component: OnboardingPage,
});

/* ────────────────────────────────────────────────────────────────────────────
 * Constants & meta
 * ────────────────────────────────────────────────────────────────────────── */

const TOTAL_STEPS = 10;

type GradientKey = 'peach' | 'mint' | 'plum' | 'sage' | 'sky' | 'gold';

const GRADIENTS: Record<GradientKey, string> = {
  peach: 'linear-gradient(135deg,#FFE8D8 0%,#F8C9A8 100%)',
  mint: 'linear-gradient(135deg,#D4F1E5 0%,#9ED9BD 100%)',
  plum: 'linear-gradient(135deg,#EAE0FA 0%,#C4ACE9 100%)',
  sage: 'linear-gradient(135deg,#E8F3EC 0%,#A6CDB1 100%)',
  sky: 'linear-gradient(135deg,#DAE9FA 0%,#A8C7EE 100%)',
  gold: 'linear-gradient(135deg,#FFF1B5 0%,#F5D976 100%)',
};

interface SidePaneCopy {
  title: string;
  subtitle: string;
  gradient: GradientKey;
}

interface GroupTypeTile {
  value: GroupType;
  label: string;
  caption: string;
  icon: typeof IconHome2;
  iconColor: string;
  iconBg: string;
}

const GROUP_TYPE_TILES: GroupTypeTile[] = [
  {
    value: GroupType.HOME,
    label: 'Flatmates',
    caption: 'Rent, bills, chores. Roll over month-to-month.',
    icon: IconHome2,
    iconColor: '#14594e',
    iconBg: '#E8F3EC',
  },
  {
    value: GroupType.COUPLE,
    label: 'Partners',
    caption: 'Shared life — recurring bills, savings goals.',
    icon: IconHeart,
    iconColor: '#9d174d',
    iconBg: '#FCE7F3',
  },
  {
    value: GroupType.TRIP,
    label: 'Travel',
    caption: 'Trips with one-off expenses. Auto-archive on close.',
    icon: IconPlane,
    iconColor: '#a16207',
    iconBg: '#FFF3D9',
  },
  {
    value: GroupType.PROJECT,
    label: 'Workspace',
    caption: 'Vendors, invoices, approval thresholds.',
    icon: IconBriefcase,
    iconColor: '#4338ca',
    iconBg: '#E0E7FF',
  },
];

interface AcquisitionTile {
  value: AcquisitionSource;
  label: string;
  icon: typeof IconHome2;
  iconColor: string;
  iconBg: string;
}

const ACQUISITION_ICONS: Record<AcquisitionSource, AcquisitionTile> = {
  tiktok: {
    value: 'tiktok',
    label: 'TikTok',
    icon: IconBrandTiktok,
    iconColor: '#ffffff',
    iconBg: '#000000',
  },
  instagram: {
    value: 'instagram',
    label: 'Instagram',
    icon: IconBrandInstagram,
    iconColor: '#E1306C',
    iconBg: '#FFF1F4',
  },
  search: {
    value: 'search',
    label: 'Search',
    icon: IconSearch,
    iconColor: '#1A73E8',
    iconBg: '#E8F0FE',
  },
  reddit: {
    value: 'reddit',
    label: 'Reddit',
    icon: IconBrandReddit,
    iconColor: '#FF4500',
    iconBg: '#FFF0E5',
  },
  friend: {
    value: 'friend',
    label: 'Friend or family',
    icon: IconUsers,
    iconColor: '#14594e',
    iconBg: '#E8F3EC',
  },
  app_store: {
    value: 'app_store',
    label: 'App Store',
    icon: IconDeviceMobile,
    iconColor: '#4338ca',
    iconBg: '#E0E7FF',
  },
  youtube: {
    value: 'youtube',
    label: 'YouTube',
    icon: IconBrandYoutube,
    iconColor: '#FF0000',
    iconBg: '#FFE4E4',
  },
  other: {
    value: 'other',
    label: 'Other',
    icon: IconCategory,
    iconColor: '#6b7280',
    iconBg: '#F3F2EE',
  },
};

const ACQUISITION_TILES: AcquisitionTile[] = ACQUISITION_SOURCE_OPTIONS.map(
  (option) => ACQUISITION_ICONS[option.value],
);

const CURRENCY_OPTIONS = [
  { value: 'GBP', label: '£ GBP' },
  { value: 'USD', label: '$ USD' },
  { value: 'EUR', label: '€ EUR' },
  { value: 'CAD', label: '$ CAD' },
  { value: 'AUD', label: '$ AUD' },
];

/* ────────────────────────────────────────────────────────────────────────────
 * Page
 * ────────────────────────────────────────────────────────────────────────── */

function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { setActiveGroupId } = useGroupStore();
  const { activeGroupId } = useGroupStore();

  const createGroup = useCreateGroup();
  const updateProfile = useUpdateProfile();

  const {
    data: groups,
    isLoading: groupsLoading,
  } = useUserGroupSummaries();
  const {
    data: pendingInvites,
    isLoading: invitesLoading,
  } = usePendingInvites();

  // Step state (1-indexed for clarity in copy/comments)
  const [step, setStep] = useState<number>(1);

  // Auto-redirect logic — preserve original behaviour
  // (?preview=true keeps onboarding open even when user has a group)
  const isPreview = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('preview') === 'true';
  }, []);

  // Onboarding answers
  const [acquisition, setAcquisition] = useState<AcquisitionSource | null>(null);
  const [groupType, setGroupType] = useState<GroupType | null>(null);
  const [groupSubtype, setGroupSubtype] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string>('');
  const [groupCurrency, setGroupCurrency] = useState<string>('GBP');
  const [includeStarterPack, setIncludeStarterPack] = useState<boolean>(true);
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);

  const applyStarterPack = useApplyGroupStarterPack(createdGroupId ?? '');

  // Subtype options for the chosen type (empty array → step 7 auto-skips)
  const subtypeOptions = groupType ? SUBTYPE_OPTIONS_BY_TYPE[groupType] ?? [] : [];

  // Effect: redirect if user already has a group and we're not in preview mode
  useEffect(() => {
    if (isPreview) return;
    if (groupsLoading || invitesLoading) return;
    if (createdGroupId) return; // Mid-flow, don't redirect

    if (shouldRedirectFromOnboarding(activeGroupId, createdGroupId)) {
      navigate({ to: '/', replace: true });
      return;
    }

    const existingGroupId = groups?.[0]?.id ?? null;
    if (shouldResumeExistingGroup(existingGroupId, createdGroupId)) {
      setActiveGroupId(existingGroupId);
      navigate({ to: '/', replace: true });
    }
  }, [
    activeGroupId,
    createdGroupId,
    groups,
    groupsLoading,
    invitesLoading,
    isPreview,
    navigate,
    pendingInvites?.length,
    setActiveGroupId,
  ]);

  if ((groupsLoading || invitesLoading) && !isPreview) {
    return <OnboardingSkeleton />;
  }

  // ─── Step navigation helpers ─────────────────────────────────────────────

  const firstName = user?.first_name?.trim() || 'there';

  function goNext() {
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 1));
  }

  function skipTour() {
    // Skip the sell pages — jump straight to acquisition
    setStep(5);
  }

  async function handleAcquisitionContinue() {
    if (acquisition && user?.id) {
      try {
        await updateProfile.mutateAsync({
          userId: user.id,
          data: { acquisition_source: acquisition },
        });
      } catch (err) {
        // Don't block onboarding on acquisition save failure — just log a notification
        notifications.show({
          title: 'Heads up',
          message:
            err instanceof Error
              ? `Couldn't save acquisition source: ${err.message}`
              : "Couldn't save acquisition source — moving on anyway.",
          color: 'yellow',
        });
      }
    }
    goNext();
  }

  function handleAcquisitionSkip() {
    setAcquisition(null);
    goNext();
  }

  function handleTypeContinue() {
    if (!groupType) return;
    if (subtypeOptions.length === 0) {
      // Auto-skip the subtype step
      setGroupSubtype(null);
      setStep(8);
      return;
    }
    goNext();
  }

  async function handleCreateGroup() {
    if (!groupType || !groupName.trim()) return;
    try {
      const group = await createGroup.mutateAsync({
        name: groupName.trim(),
        type: groupType,
        subtype: groupSubtype,
        description: '',
        cycle_date: 1,
        currency: groupCurrency,
      });
      setCreatedGroupId(group.id);
      setActiveGroupId(group.id);

      if (includeStarterPack) {
        try {
          await applyStarterPack.mutateAsync({
            groupType,
            subtype: groupSubtype,
            includeStarterOperations: true,
            spaceEssentials: {},
          });
        } catch (err) {
          // Starter pack failure is non-fatal — group is still created
          notifications.show({
            title: 'Starter pack skipped',
            message:
              err instanceof Error
                ? err.message
                : "Starter setup couldn't be applied — you can still customise the group.",
            color: 'yellow',
          });
        }
      }

      setStep(10);
    } catch (err) {
      notifications.show({
        title: 'Could not create group',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  function handleOpenCommune() {
    navigate({ to: '/' });
  }

  // ─── Step 7 special-case: Back from contextual sell needs to land on subtype if exists, else type ─

  function backFromContextualSell() {
    if (subtypeOptions.length > 0) {
      setStep(7);
    } else {
      setStep(6);
    }
  }

  // ─── Side pane copy per step ─────────────────────────────────────────────

  const sideCopy = getSidePaneCopy(step, firstName, groupName);

  // ─── Top bar visibility rules ────────────────────────────────────────────

  const showBack = step > 1 && step !== 10;
  const showSkip =
    step === 1
      || step === 2
      || step === 3
      || step === 4
      || step === 5
      || step === 8;
  const skipLabel = step <= 4 ? 'Skip tour' : 'Skip';

  function handleSkipPress() {
    if (step >= 1 && step <= 4) {
      skipTour();
    } else if (step === 5) {
      handleAcquisitionSkip();
    } else if (step === 8) {
      goNext();
    }
  }

  function handleBackPress() {
    if (step === 8) {
      backFromContextualSell();
      return;
    }
    if (step === 6) {
      // Back from type → acquisition
      setStep(5);
      return;
    }
    goBack();
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={pageStyles.outer}>
      <div style={pageStyles.frame}>
        {/* LEFT — illustrated/coloured panel */}
        <SidePane copy={sideCopy} step={step} firstName={firstName} groupName={groupName} />

        {/* RIGHT — active step UI */}
        <div style={pageStyles.right}>
          {/* Top bar */}
          <div style={pageStyles.topBar}>
            {showBack ? (
              <button
                type="button"
                onClick={handleBackPress}
                style={pageStyles.backButton}
                aria-label="Back"
              >
                <IconChevronLeft size={18} />
                <span>Back</span>
              </button>
            ) : (
              <span style={{ width: 1 }} />
            )}
            {showSkip ? (
              <button
                type="button"
                onClick={handleSkipPress}
                style={pageStyles.skipButton}
              >
                {skipLabel}
              </button>
            ) : (
              <span style={{ width: 1 }} />
            )}
          </div>

          {/* Body */}
          <div style={pageStyles.body}>
            {step === 1 && <StepWelcome firstName={firstName} />}
            {step === 2 && <StepSellSplit />}
            {step === 3 && <StepSellSettle />}
            {step === 4 && <StepSellSee />}
            {step === 5 && (
              <StepAcquisition
                value={acquisition}
                onChange={setAcquisition}
              />
            )}
            {step === 6 && (
              <StepType
                value={groupType}
                onChange={(value) => {
                  setGroupType(value);
                  // Reset subtype if it's no longer valid
                  const nextOptions = SUBTYPE_OPTIONS_BY_TYPE[value] ?? [];
                  if (!nextOptions.some((o) => o.value === groupSubtype)) {
                    setGroupSubtype(null);
                  }
                }}
              />
            )}
            {step === 7 && groupType && (
              <StepSubtype
                groupType={groupType}
                value={groupSubtype}
                onChange={setGroupSubtype}
              />
            )}
            {step === 8 && (
              <StepContextualSell
                groupType={groupType}
                subtype={groupSubtype}
              />
            )}
            {step === 9 && (
              <StepForm
                groupName={groupName}
                onGroupNameChange={setGroupName}
                currency={groupCurrency}
                onCurrencyChange={setGroupCurrency}
                includeStarterPack={includeStarterPack}
                onIncludeStarterPackChange={setIncludeStarterPack}
              />
            )}
            {step === 10 && (
              <StepCelebration
                firstName={firstName}
                groupName={groupName}
              />
            )}
          </div>

          {/* Pinned footer with primary CTA */}
          <div style={pageStyles.footer}>
            {step === 1 && (
              <PrimaryButton onClick={goNext}>Continue</PrimaryButton>
            )}
            {step === 2 && (
              <PrimaryButton onClick={goNext}>Continue</PrimaryButton>
            )}
            {step === 3 && (
              <PrimaryButton onClick={goNext}>Continue</PrimaryButton>
            )}
            {step === 4 && (
              <PrimaryButton onClick={goNext}>Continue</PrimaryButton>
            )}
            {step === 5 && (
              <PrimaryButton
                onClick={handleAcquisitionContinue}
                loading={updateProfile.isPending}
                disabled={!acquisition && !updateProfile.isPending}
              >
                Continue
              </PrimaryButton>
            )}
            {step === 6 && (
              <PrimaryButton
                onClick={handleTypeContinue}
                disabled={!groupType}
              >
                Continue
              </PrimaryButton>
            )}
            {step === 7 && (
              <PrimaryButton onClick={goNext} disabled={!groupSubtype}>
                Continue
              </PrimaryButton>
            )}
            {step === 8 && (
              <PrimaryButton onClick={goNext} variant="sage">
                Sounds good — set it up
              </PrimaryButton>
            )}
            {step === 9 && (
              <PrimaryButton
                onClick={handleCreateGroup}
                loading={createGroup.isPending || applyStarterPack.isPending}
                disabled={!groupName.trim()}
              >
                Create group
              </PrimaryButton>
            )}
            {step === 10 && (
              <PrimaryButton onClick={handleOpenCommune} variant="sage">
                Open Commune
              </PrimaryButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Side pane (left)
 * ────────────────────────────────────────────────────────────────────────── */

function getSidePaneCopy(step: number, firstName: string, groupName: string): SidePaneCopy {
  switch (step) {
    case 1:
      return {
        title: `Welcome, ${firstName}.`,
        subtitle: "Let's set up your first group. Takes about a minute — change anything later.",
        gradient: 'peach',
      };
    case 2:
      return {
        title: 'Split anything fairly.',
        subtitle:
          'Equal, percentages, fixed amounts, or one person paid. Commune does the maths.',
        gradient: 'mint',
      };
    case 3:
      return {
        title: 'Settle in one tap.',
        subtitle:
          'Pay through Revolut, Monzo, PayPal, Venmo — directly. Commune never holds your money.',
        gradient: 'plum',
      };
    case 4:
      return {
        title: 'See everything in one place.',
        subtitle:
          'Recurring bills, who owes whom, monthly rhythm, analytics — one dashboard.',
        gradient: 'sage',
      };
    case 5:
      return {
        title: 'A quick favour.',
        subtitle: 'Where did you hear about us? Helps us know what is working.',
        gradient: 'sky',
      };
    case 6:
      return {
        title: 'What kind of group?',
        subtitle: 'We tailor categories and starter pack to your shape.',
        gradient: 'peach',
      };
    case 7:
      return {
        title: 'A bit more about your group.',
        subtitle: 'The more we know, the sharper your starter setup.',
        gradient: 'sage',
      };
    case 8:
      return {
        title: "Here's how Commune works for you.",
        subtitle: 'Tailored for your group. The rhythm changes for couples, trips, or workspaces.',
        gradient: 'sage',
      };
    case 9:
      return {
        title: 'Name your group.',
        subtitle: 'You can change this any time. Pick something that feels like home.',
        gradient: 'peach',
      };
    case 10:
      return {
        title: `You're all set, ${firstName}.`,
        subtitle: `${groupName || 'Your group'} is ready. Let's add your first expense.`,
        gradient: 'gold',
      };
    default:
      return { title: '', subtitle: '', gradient: 'peach' };
  }
}

function SidePane({
  copy,
  step,
  firstName: _firstName,
  groupName: _groupName,
}: {
  copy: SidePaneCopy;
  step: number;
  firstName: string;
  groupName: string;
}) {
  const isCelebration = step === 10;

  return (
    <div
      style={{
        ...pageStyles.left,
        background: GRADIENTS[copy.gradient],
      }}
    >
      {isCelebration && <ConfettiOverlay />}
      <div style={pageStyles.brand}>Commune</div>

      <Stack gap="sm" style={{ position: 'relative', zIndex: 2 }}>
        {isCelebration && (
          <div style={pageStyles.celebrationIconWrap}>
            <Transition mounted transition="scale" duration={500} timingFunction="ease">
              {(transitionStyle) => (
                <div style={{ ...pageStyles.celebrationIcon, ...transitionStyle }}>
                  <IconCheck size={40} stroke={2.5} />
                </div>
              )}
            </Transition>
          </div>
        )}
        <Text
          style={{
            fontSize: isCelebration ? 30 : 32,
            fontWeight: 700,
            letterSpacing: '-0.6px',
            lineHeight: 1.15,
            color: '#171b24',
            margin: 0,
          }}
        >
          {copy.title}
        </Text>
        <Text
          style={{
            fontSize: 14,
            lineHeight: 1.55,
            color: '#171b24',
            opacity: 0.7,
            maxWidth: 320,
          }}
        >
          {copy.subtitle}
        </Text>
      </Stack>

      <DotIndicator current={step} total={TOTAL_STEPS} />
    </div>
  );
}

function DotIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div style={pageStyles.dotsRow}>
      {Array.from({ length: total }).map((_, idx) => {
        const active = idx + 1 === current;
        return (
          <span
            key={idx}
            style={{
              width: active ? 26 : 8,
              height: 8,
              borderRadius: 4,
              background: active ? '#171b24' : 'rgba(20,20,30,0.18)',
              transition: 'all 0.25s ease',
            }}
          />
        );
      })}
    </div>
  );
}

function ConfettiOverlay() {
  const pieces = useMemo(
    () =>
      [
        { left: '12%', top: '10%', color: '#1f7a6a', rotate: 20 },
        { left: '78%', top: '14%', color: '#8C4F2F', rotate: -30 },
        { left: '32%', top: '46%', color: '#9d174d', rotate: 45 },
        { left: '68%', top: '58%', color: '#7A5C00', rotate: -15 },
        { left: '24%', top: '74%', color: '#4FB3A0', rotate: 60 },
        { left: '82%', top: '78%', color: '#a16207', rotate: -40 },
        { left: '50%', top: '32%', color: '#6B3FA0', rotate: 12 },
        { left: '14%', top: '32%', color: '#1f7a6a', rotate: -50 },
      ] as const,
    [],
  );

  return (
    <div style={pageStyles.confettiOverlay}>
      <style>
        {`
          @keyframes commune-onb-confetti-fall {
            0% { transform: translateY(-40px) rotate(var(--rot, 0deg)); opacity: 0; }
            20% { opacity: 1; }
            100% { transform: translateY(420px) rotate(calc(var(--rot, 0deg) + 180deg)); opacity: 0.85; }
          }
        `}
      </style>
      {pieces.map((p, idx) => (
        <span
          key={idx}
          style={{
            position: 'absolute',
            width: 9,
            height: 16,
            left: p.left,
            top: p.top,
            background: p.color,
            borderRadius: 2,
            ['--rot' as never]: `${p.rotate}deg`,
            animation: `commune-onb-confetti-fall 1.6s ${idx * 0.12}s ease-out forwards`,
          }}
        />
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Step components (right pane bodies)
 * ────────────────────────────────────────────────────────────────────────── */

function StepWelcome({ firstName }: { firstName: string }) {
  return (
    <Stack gap="md">
      <div>
        <Text style={styles.headline}>Let's get started</Text>
        <Text style={styles.helper}>
          A quick tour of how Commune works, then we'll set up your first group, {firstName}.
        </Text>
      </div>

      <Paper p="lg" radius="lg" withBorder>
        <Group gap="xs" mb="xs">
          <IconCheck size={18} color="#1f7a6a" stroke={1.7} />
          <Text fw={600} size="sm">
            What we'll cover
          </Text>
        </Group>
        <Stack gap={6} pl={26}>
          <BulletLine>3 quick screens — how Commune works</BulletLine>
          <BulletLine>Pick your group type and rhythm</BulletLine>
          <BulletLine>Name it and you're done — under a minute</BulletLine>
        </Stack>
      </Paper>
    </Stack>
  );
}

function StepSellSplit() {
  return (
    <Stack gap="md">
      <div>
        <Text style={styles.headline}>Three ways to split — fast.</Text>
        <Text style={styles.helper}>
          Equal, percentages, fixed amounts, or one person paid. Receipts attached, recurring
          bills auto-split.
        </Text>
      </div>
      <Paper p="lg" radius="lg" withBorder>
        <BulletList
          items={[
            'No more "what did I owe again?"',
            'Receipts attached, vendor + invoice when you need it',
            'Recurring bills auto-split every month',
          ]}
        />
      </Paper>
    </Stack>
  );
}

function StepSellSettle() {
  return (
    <Stack gap="md">
      <div>
        <Text style={styles.headline}>Pay directly. Skip the awkward.</Text>
        <Text style={styles.helper}>
          Smart-suggest minimises payments. Pay through Revolut, Monzo, PayPal, Venmo — Commune
          never holds your money.
        </Text>
      </div>
      <Paper p="lg" radius="lg" withBorder>
        <BulletList
          items={[
            'Smart-suggest minimises payments',
            'Free P2P on most rails',
            'Mark-as-paid for offline transfers too',
          ]}
        />
      </Paper>
    </Stack>
  );
}

function StepSellSee() {
  return (
    <Stack gap="md">
      <div>
        <Text style={styles.headline}>One dashboard. Full picture.</Text>
        <Text style={styles.helper}>
          Recurring bills, who owes whom, monthly rhythm, analytics — all in one place.
        </Text>
      </div>
      <Paper p="lg" radius="lg" withBorder>
        <BulletList
          items={[
            'Spending breakdown by category',
            'Cycle close, archive, restore — full lifecycle',
            'Workspace mode for vendors + invoices',
          ]}
        />
      </Paper>
    </Stack>
  );
}

function StepAcquisition({
  value,
  onChange,
}: {
  value: AcquisitionSource | null;
  onChange: (next: AcquisitionSource) => void;
}) {
  return (
    <Stack gap="md">
      <div>
        <Text style={styles.headline}>Where did you hear about us?</Text>
        <Text style={styles.helper}>Helps us know what's working. Pick one — or skip.</Text>
      </div>
      <div style={styles.acqGrid}>
        {ACQUISITION_TILES.map((tile) => {
          const Icon = tile.icon;
          const selected = value === tile.value;
          return (
            <button
              key={tile.value}
              type="button"
              onClick={() => onChange(tile.value)}
              style={{
                ...styles.acqTile,
                ...(selected ? styles.acqTileSelected : null),
              }}
            >
              <span
                style={{
                  ...styles.acqIconWrap,
                  background: tile.iconBg,
                  color: tile.iconColor,
                }}
              >
                <Icon size={18} stroke={1.7} />
              </span>
              <span style={styles.acqLabel}>{tile.label}</span>
            </button>
          );
        })}
      </div>
    </Stack>
  );
}

function StepType({
  value,
  onChange,
}: {
  value: GroupType | null;
  onChange: (next: GroupType) => void;
}) {
  return (
    <Stack gap="md">
      <div>
        <Text style={styles.headline}>What kind of group?</Text>
        <Text style={styles.helper}>
          We'll set up suggested categories so you can hit the ground running.
        </Text>
      </div>
      <div style={styles.typeGrid}>
        {GROUP_TYPE_TILES.map((tile) => {
          const Icon = tile.icon;
          const selected = value === tile.value;
          return (
            <button
              key={tile.value}
              type="button"
              onClick={() => onChange(tile.value)}
              style={{
                ...styles.typeTile,
                ...(selected ? styles.typeTileSelected : null),
              }}
            >
              <span
                style={{
                  ...styles.typeIconWrap,
                  background: tile.iconBg,
                  color: tile.iconColor,
                }}
              >
                <Icon size={22} stroke={1.7} />
              </span>
              <span style={styles.typeBody}>
                <span style={styles.typeTitle}>{tile.label}</span>
                <span style={styles.typeCaption}>{tile.caption}</span>
              </span>
              {selected && (
                <span style={styles.typeCheck}>
                  <IconCheck size={14} stroke={2.5} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </Stack>
  );
}

function StepSubtype({
  groupType,
  value,
  onChange,
}: {
  groupType: GroupType;
  value: string | null;
  onChange: (next: string) => void;
}) {
  const options = SUBTYPE_OPTIONS_BY_TYPE[groupType] ?? [];
  const typeLabel = GROUP_TYPE_TILES.find((t) => t.value === groupType)?.label ?? 'group';

  return (
    <Stack gap="md">
      <div>
        <Text style={styles.headline}>A bit more about your {typeLabel.toLowerCase()} group</Text>
        <Text style={styles.helper}>
          We'll tune categories and starter pack to match.
        </Text>
      </div>
      <div style={styles.typeGrid}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              style={{
                ...styles.typeTile,
                ...(selected ? styles.typeTileSelected : null),
              }}
            >
              <span
                style={{
                  ...styles.typeIconWrap,
                  background: '#E8F3EC',
                  color: '#14594e',
                }}
              >
                <IconSparkles size={20} stroke={1.7} />
              </span>
              <span style={styles.typeBody}>
                <span style={styles.typeTitle}>{option.label}</span>
                <span style={styles.typeCaption}>{option.caption}</span>
              </span>
              {selected && (
                <span style={styles.typeCheck}>
                  <IconCheck size={14} stroke={2.5} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </Stack>
  );
}

function StepContextualSell({
  groupType,
  subtype,
}: {
  groupType: GroupType | null;
  subtype: string | null;
}) {
  const copy = getContextualSellCopy(groupType, subtype);
  return (
    <Stack gap="md">
      <div>
        <Badge
          variant="light"
          color="teal"
          radius="xl"
          style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}
        >
          {copy.tag}
        </Badge>
        <Text style={{ ...styles.headline, marginTop: 12 }}>
          Three things that just work
        </Text>
      </div>
      <Stack gap="xs">
        {copy.points.map((point, idx) => (
          <Paper key={idx} p="md" radius="lg" withBorder>
            <Group align="flex-start" gap="md" wrap="nowrap">
              <span style={styles.numberBadge}>{idx + 1}</span>
              <div style={{ flex: 1 }}>
                <Text fw={700} size="sm" c="#171b24">
                  {point.title}
                </Text>
                <Text size="sm" c="dimmed" mt={4}>
                  {point.caption}
                </Text>
              </div>
            </Group>
          </Paper>
        ))}
      </Stack>
      {copy.reassurance && (
        <Text size="xs" c="dimmed" ta="center">
          {copy.reassurance}
        </Text>
      )}
    </Stack>
  );
}

function StepForm({
  groupName,
  onGroupNameChange,
  currency,
  onCurrencyChange,
  includeStarterPack,
  onIncludeStarterPackChange,
}: {
  groupName: string;
  onGroupNameChange: (next: string) => void;
  currency: string;
  onCurrencyChange: (next: string) => void;
  includeStarterPack: boolean;
  onIncludeStarterPackChange: (next: boolean) => void;
}) {
  return (
    <Stack gap="md">
      <div>
        <Text style={styles.headline}>Name your group</Text>
        <Text style={styles.helper}>You can change this any time.</Text>
      </div>
      <Stack gap="sm">
        <TextInput
          label="Name"
          placeholder="e.g. Sunset Drive"
          value={groupName}
          onChange={(event) => onGroupNameChange(event.currentTarget.value)}
          size="md"
          radius="md"
        />
        <Select
          label="Currency"
          data={CURRENCY_OPTIONS}
          value={currency}
          onChange={(next) => onCurrencyChange(next ?? 'GBP')}
          size="md"
          radius="md"
          allowDeselect={false}
        />
      </Stack>
      <Paper p="md" radius="lg" withBorder>
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <div style={{ flex: 1 }}>
            <Text fw={700} size="sm">
              Skip the empty start
            </Text>
            <Text size="xs" c="dimmed" mt={4}>
              Add suggested categories + first-expense ideas. Rename or remove any of them later.
            </Text>
          </div>
          <Switch
            checked={includeStarterPack}
            onChange={(event) =>
              onIncludeStarterPackChange(event.currentTarget.checked)
            }
            color="teal"
            size="md"
          />
        </Group>
      </Paper>
      <Text size="xs" c="dimmed" ta="center">
        No expenses are created until you log them. Just suggestions.
      </Text>
    </Stack>
  );
}

function StepCelebration({
  firstName,
  groupName,
}: {
  firstName: string;
  groupName: string;
}) {
  return (
    <Stack gap="lg" align="center" justify="center" style={{ minHeight: '100%' }}>
      <Stack gap="xs" align="center">
        <Text
          style={{
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: '-0.7px',
            lineHeight: 1.1,
            textAlign: 'center',
          }}
        >
          You're all set, {firstName}.
        </Text>
        <Text size="sm" c="dimmed" ta="center" maw={360}>
          <Text component="span" fw={700} c="#171b24">
            {groupName || 'Your group'}
          </Text>{' '}
          is ready. Let's add your first expense — rent, groceries, anything you've already paid
          for.
        </Text>
      </Stack>
      <Paper p="md" radius="lg" withBorder shadow="sm" w="100%" maw={360}>
        <Group gap="md" align="center" wrap="nowrap">
          <span
            style={{
              ...pageStyles.celebrationNextIcon,
              background: '#E8F3EC',
              color: '#14594e',
            }}
          >
            <IconReceipt size={20} stroke={1.7} />
          </span>
          <div style={{ flex: 1 }}>
            <Text fw={700} size="sm">
              Add your first expense
            </Text>
            <Text size="xs" c="dimmed" mt={2}>
              ~30 seconds · the most important step
            </Text>
          </div>
          <IconArrowRight size={18} color="#9aa0aa" />
        </Group>
      </Paper>
      <Group gap="xs">
        <IconCoin size={16} color="#9aa0aa" />
        <Text size="xs" c="dimmed">
          Currency tracked, splits ready — go.
        </Text>
      </Group>
    </Stack>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Small primitives
 * ────────────────────────────────────────────────────────────────────────── */

function PrimaryButton({
  children,
  onClick,
  loading,
  disabled,
  variant = 'ink',
}: {
  children: ReactNode;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'ink' | 'sage';
}) {
  const color = variant === 'sage' ? '#1f7a6a' : '#171b24';
  return (
    <Group justify="flex-end">
      <Button
        size="md"
        radius="md"
        onClick={onClick}
        loading={loading}
        disabled={disabled}
        styles={{
          root: {
            backgroundColor: color,
            color: '#fff',
            fontWeight: 700,
            paddingInline: 28,
          },
        }}
      >
        {children}
      </Button>
    </Group>
  );
}

function BulletLine({ children }: { children: ReactNode }) {
  return (
    <Text size="sm" c="dimmed" style={{ lineHeight: 1.55 }}>
      {children}
    </Text>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <Stack gap="xs">
      {items.map((item) => (
        <Group key={item} gap="xs" align="flex-start" wrap="nowrap">
          <span style={styles.bulletIcon}>
            <IconCheck size={14} stroke={2.2} />
          </span>
          <Text size="sm" c="#171b24" style={{ flex: 1, lineHeight: 1.45 }}>
            {item}
          </Text>
        </Group>
      ))}
    </Stack>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Inline styles
 * ────────────────────────────────────────────────────────────────────────── */

const pageStyles = {
  outer: {
    minHeight: '100vh',
    width: '100%',
    background: '#efece6',
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'center',
    padding: 0,
  } satisfies CSSProperties,
  frame: {
    width: '100%',
    minHeight: '100vh',
    display: 'grid',
    gridTemplateColumns: '42% 58%',
    background: '#FAF9F7',
    overflow: 'hidden',
    position: 'relative',
  } satisfies CSSProperties,
  left: {
    padding: '48px 48px 36px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: '100vh',
    position: 'relative',
    overflow: 'hidden',
  } satisfies CSSProperties,
  right: {
    padding: '32px 56px 28px',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    background: '#FAF9F7',
  } satisfies CSSProperties,
  brand: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    color: '#171b24',
  } satisfies CSSProperties,
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 36,
    marginBottom: 24,
  } satisfies CSSProperties,
  backButton: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: '#171b24',
    fontSize: 13,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 8px',
    borderRadius: 8,
  } satisfies CSSProperties,
  skipButton: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: '#6b7280',
    fontSize: 13,
    fontWeight: 600,
    padding: '6px 8px',
    borderRadius: 8,
  } satisfies CSSProperties,
  body: {
    flex: 1,
    overflow: 'auto',
    paddingBottom: 24,
  } satisfies CSSProperties,
  footer: {
    paddingTop: 16,
    borderTop: '1px solid #f1efe9',
  } satisfies CSSProperties,
  dotsRow: {
    display: 'flex',
    gap: 6,
    position: 'relative',
    zIndex: 2,
  } satisfies CSSProperties,
  confettiOverlay: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    overflow: 'hidden',
    zIndex: 1,
  } satisfies CSSProperties,
  celebrationIconWrap: {
    marginBottom: 12,
  } satisfies CSSProperties,
  celebrationIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    background: 'linear-gradient(135deg,#1f7a6a 0%,#3FA08D 100%)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 16px 40px rgba(31,122,106,0.35)',
  } satisfies CSSProperties,
  celebrationNextIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  } satisfies CSSProperties,
};

const styles = {
  headline: {
    fontSize: 26,
    fontWeight: 700,
    letterSpacing: '-0.4px',
    color: '#171b24',
    marginBottom: 6,
  } satisfies CSSProperties,
  helper: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 1.55,
  } satisfies CSSProperties,
  acqGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 10,
  } satisfies CSSProperties,
  acqTile: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '14px 12px',
    background: '#fff',
    border: '1px solid #f1efe9',
    borderRadius: 14,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'border-color 0.15s ease, transform 0.15s ease',
  } satisfies CSSProperties,
  acqTileSelected: {
    border: '2px solid #1f7a6a',
    padding: '13px 11px',
  } satisfies CSSProperties,
  acqIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  } satisfies CSSProperties,
  acqLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: '#171b24',
  } satisfies CSSProperties,
  typeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 10,
  } satisfies CSSProperties,
  typeTile: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
    padding: 16,
    background: '#fff',
    border: '1px solid #f1efe9',
    borderRadius: 16,
    cursor: 'pointer',
    textAlign: 'left',
    position: 'relative',
    transition: 'border-color 0.15s ease',
  } satisfies CSSProperties,
  typeTileSelected: {
    border: '2px solid #1f7a6a',
    padding: 15,
  } satisfies CSSProperties,
  typeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  } satisfies CSSProperties,
  typeBody: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  } satisfies CSSProperties,
  typeTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#171b24',
  } satisfies CSSProperties,
  typeCaption: {
    fontSize: 12.5,
    color: '#6b7280',
    lineHeight: 1.4,
  } satisfies CSSProperties,
  typeCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    background: '#1f7a6a',
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 12,
    right: 12,
  } satisfies CSSProperties,
  numberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    background: '#1f7a6a',
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
  } satisfies CSSProperties,
  bulletIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    background: '#E8F3EC',
    color: '#14594e',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  } satisfies CSSProperties,
};
