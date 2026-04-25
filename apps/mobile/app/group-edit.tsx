import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  IconArchive,
  IconBriefcase,
  IconChecks,
  IconChevronLeft,
  IconChevronRight,
  IconCircle,
  IconCircleCheck,
  IconClipboardList,
  IconHeart,
  IconHome2,
  IconLock,
  IconPencil,
  IconPhoto,
  IconPlane,
  IconRefresh,
  IconShieldCheck,
  IconSparkles,
  IconTrash,
} from '@tabler/icons-react-native';
import type { ComponentType } from 'react';

import { Pressable, Picker } from '@/components/primitives';
import {
  colors,
  font,
  getGroupTypeMeta,
  height as heightTokens,
  space,
} from '@/constants/design';
import { GroupType, type SetupChecklistProgress, type SpaceEssentials } from '@commune/types';
import {
  countCompletedSetupChecklistItems,
  createSetupChecklistProgress,
  getGroupSubtypeOptions,
  getSpaceEssentialDefinitions,
  normalizeSpaceEssentials,
  type SpaceEssentialDefinition,
} from '@commune/core';
import { formatCurrency } from '@commune/utils';
import { getSupabase } from '@commune/api';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import {
  useArchiveGroup,
  useDeleteGroup,
  useGroup,
  useUpdateGroup,
} from '@/hooks/use-groups';
import { getErrorMessage } from '@/lib/errors';
import {
  hapticHeavy,
  hapticMedium,
  hapticSelection,
  hapticSuccess,
  hapticWarning,
} from '@/lib/haptics';

type TablerIcon = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

type GroupTypeValue = (typeof GroupType)[keyof typeof GroupType];

type TypePillOption = {
  value: GroupTypeValue;
  label: string;
  icon: TablerIcon;
};

const TYPE_PILLS: TypePillOption[] = [
  { value: GroupType.HOME, label: 'Flatmates', icon: IconHome2 },
  { value: GroupType.COUPLE, label: 'Partners', icon: IconHeart },
  { value: GroupType.TRIP, label: 'Travel', icon: IconPlane },
  { value: GroupType.WORKSPACE, label: 'Workspace', icon: IconBriefcase },
];

const CURRENCY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'GBP', label: '£ GBP' },
  { value: 'USD', label: '$ USD' },
  { value: 'EUR', label: '€ EUR' },
  { value: 'CAD', label: '$ CAD' },
  { value: 'AUD', label: '$ AUD' },
  { value: 'NGN', label: '₦ NGN' },
  { value: 'GHS', label: '₵ GHS' },
  { value: 'ZAR', label: 'R ZAR' },
  { value: 'INR', label: '₹ INR' },
  { value: 'JPY', label: '¥ JPY' },
];

type CycleValue = 'monthly' | 'weekly' | 'custom';

const CYCLE_OPTIONS: Array<{ value: CycleValue; label: string }> = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'custom', label: 'Custom' },
];

function cycleFromCycleDate(cycleDate: number | null | undefined): CycleValue {
  if (cycleDate === 7) return 'weekly';
  if (cycleDate === 1) return 'monthly';
  return 'custom';
}

function cycleDateFromCycle(cycle: CycleValue, fallback: number): number {
  if (cycle === 'weekly') return 7;
  if (cycle === 'monthly') return 1;
  return fallback;
}

type Draft = {
  name: string;
  description: string;
  type: GroupTypeValue;
  subtype: string | null;
  currency: string;
  cycle: CycleValue;
  cycleDate: number;
  avatarUrl: string | null;
  coverUrl: string | null;
  approvalThreshold: string;
  spaceEssentials: SpaceEssentials;
  setupChecklistProgress: SetupChecklistProgress;
};

/**
 * Upload a local image URI to Supabase Storage and return its public URL.
 * Path is namespaced by user id so it satisfies the avatars-bucket RLS policy
 * (`storage.foldername(name)[1] = auth.uid()::text`).
 */
async function uploadGroupImageAsset(
  uri: string,
  userId: string,
  groupId: string,
  kind: 'avatar' | 'cover',
): Promise<string> {
  const supabase = getSupabase();
  const ts = Date.now();
  const path = `${userId}/groups/${groupId}/${kind}-${ts}.jpg`;

  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, arrayBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return `${data.publicUrl}?t=${ts}`;
}

function ScreenHeader({
  title,
  topInset,
  onBack,
  onSave,
  saveEnabled,
  saving,
}: {
  title: string;
  topInset: number;
  onBack: () => void;
  onSave: () => void;
  saveEnabled: boolean;
  saving: boolean;
}) {
  return (
    <View
      style={{
        paddingTop: topInset + 12,
        paddingHorizontal: space.gutter,
        backgroundColor: colors.bgBase,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 48,
          position: 'relative',
        }}
      >
        <Pressable
          onPress={onBack}
          hitSlop={10}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 2,
            paddingVertical: 6,
            paddingRight: 10,
            marginLeft: -4,
            opacity: pressed ? 0.6 : 1,
            zIndex: 2,
          })}
        >
          <IconChevronLeft size={22} color={colors.textPrimary} strokeWidth={2} />
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>
            Back
          </Text>
        </Pressable>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={[font.h3, { color: colors.textPrimary }]}>{title}</Text>
        </View>
        <Pressable
          onPress={onSave}
          disabled={!saveEnabled || saving}
          hitSlop={10}
          style={({ pressed }) => ({
            paddingVertical: 6,
            paddingLeft: 10,
            opacity: pressed && saveEnabled ? 0.6 : 1,
            zIndex: 2,
          })}
        >
          {saving ? (
            <ActivityIndicator color={colors.sage} size="small" />
          ) : (
            <Text
              style={{
                fontSize: 13,
                fontWeight: saveEnabled ? '700' : '600',
                color: saveEnabled ? colors.sageInk : colors.textMuted,
              }}
            >
              Save
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontSize: 10.5,
        fontWeight: '700',
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        paddingHorizontal: 4,
        paddingTop: 18,
        paddingBottom: 8,
      }}
    >
      {children}
    </Text>
  );
}

function FormGroup({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: colors.bgSurface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        overflow: 'hidden',
        marginBottom: 8,
      }}
    >
      {children}
    </View>
  );
}

function InputRow({
  label,
  children,
  isLast,
}: {
  label?: string;
  children: React.ReactNode;
  isLast?: boolean;
}) {
  return (
    <View
      style={{
        paddingHorizontal: 14,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.borderSubtle,
      }}
    >
      {label ? (
        <Text
          style={{
            fontSize: 12,
            fontWeight: '700',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            width: 100,
          }}
        >
          {label}
        </Text>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
    </View>
  );
}

function HeroCover({
  typeMeta,
  coverUri,
  avatarUri,
  Icon,
  uploadingCover,
  uploadingAvatar,
  onChangeCover,
  onChangeAvatar,
}: {
  typeMeta: ReturnType<typeof getGroupTypeMeta>;
  coverUri: string | null;
  avatarUri: string | null;
  Icon: TablerIcon;
  uploadingCover: boolean;
  uploadingAvatar: boolean;
  onChangeCover: () => void;
  onChangeAvatar: () => void;
}) {
  return (
    <View
      style={{
        position: 'relative',
        height: 140,
        backgroundColor: typeMeta.bg,
        borderRadius: 18,
        marginBottom: 44,
      }}
    >
      {coverUri ? (
        <Image
          source={{ uri: coverUri }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: 18,
          }}
          resizeMode="cover"
        />
      ) : null}

      <Pressable
        onPress={onChangeCover}
        disabled={uploadingCover}
        hitSlop={6}
        style={({ pressed }) => ({
          position: 'absolute',
          top: 12,
          right: 12,
          backgroundColor: colors.bgInk,
          opacity: uploadingCover ? 0.7 : pressed ? 0.85 : 0.92,
          borderRadius: 999,
          paddingVertical: 6,
          paddingHorizontal: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        })}
      >
        {uploadingCover ? (
          <ActivityIndicator size="small" color={colors.textInverse} />
        ) : (
          <IconPhoto size={14} color={colors.textInverse} strokeWidth={1.8} />
        )}
        <Text
          style={{
            color: colors.textInverse,
            fontSize: 12,
            fontWeight: '600',
          }}
        >
          {uploadingCover ? 'Uploading…' : 'Change cover'}
        </Text>
      </Pressable>

      {/* Avatar tile (overlapping bottom-left) */}
      <View
        style={{
          position: 'absolute',
          bottom: -36,
          left: 16,
          width: 84,
          height: 84,
          borderRadius: 24,
          backgroundColor: typeMeta.bg,
          borderWidth: 4,
          borderColor: colors.bgBase,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {avatarUri ? (
          <Image
            source={{ uri: avatarUri }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        ) : (
          <Icon size={36} color={typeMeta.accent} strokeWidth={1.6} />
        )}
      </View>

      {/* Edit-avatar badge */}
      <Pressable
        onPress={onChangeAvatar}
        disabled={uploadingAvatar}
        hitSlop={8}
        style={({ pressed }) => ({
          position: 'absolute',
          bottom: -28,
          left: 80,
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: colors.bgInk,
          borderWidth: 3,
          borderColor: colors.bgBase,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: uploadingAvatar ? 0.7 : pressed ? 0.85 : 1,
        })}
      >
        {uploadingAvatar ? (
          <ActivityIndicator size="small" color={colors.textInverse} />
        ) : (
          <IconPencil size={14} color={colors.textInverse} strokeWidth={2} />
        )}
      </Pressable>
    </View>
  );
}

function TypePillRow({
  value,
  onChange,
}: {
  value: GroupTypeValue;
  onChange: (next: GroupTypeValue) => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        padding: 12,
        backgroundColor: colors.bgSurface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        marginBottom: 8,
      }}
    >
      {TYPE_PILLS.map((option) => {
        const selected = value === option.value;
        const Icon = option.icon;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              hapticSelection();
              onChange(option.value);
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingVertical: 7,
              paddingLeft: 11,
              paddingRight: 14,
              borderRadius: 999,
              backgroundColor: selected ? colors.bgInk : colors.bgBase,
              borderWidth: 1,
              borderColor: selected ? colors.bgInk : colors.borderSubtle,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Icon
              size={14}
              color={selected ? colors.textInverse : colors.textMuted}
              strokeWidth={1.8}
            />
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: selected ? colors.textInverse : colors.textMuted,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function DangerTile({
  icon: Icon,
  label,
  description,
  onPress,
  intense,
}: {
  icon: TablerIcon;
  label: string;
  description: string;
  onPress: () => void;
  intense?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: intense ? colors.dangerBg : colors.warnBg,
        borderRadius: 14,
        padding: 13,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 6,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Icon
        size={20}
        color={intense ? colors.dangerText : colors.warnText}
        strokeWidth={1.7}
      />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 13,
            fontWeight: '700',
            color: intense ? colors.dangerText : colors.warnText,
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            fontSize: 11.5,
            color: intense ? colors.dangerText : colors.warnText,
            opacity: 0.8,
            marginTop: 2,
          }}
        >
          {description}
        </Text>
      </View>
    </Pressable>
  );
}

function EmptyStateScreen({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: TablerIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bgBase,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
      }}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.bgSubtle,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <Icon size={24} color={colors.textTertiary} strokeWidth={1.7} />
      </View>
      <Text
        style={[
          font.h3,
          { color: colors.textPrimary, marginBottom: 6, textAlign: 'center' },
        ]}
      >
        {title}
      </Text>
      <Text
        style={[
          font.body,
          {
            color: colors.textTertiary,
            textAlign: 'center',
            maxWidth: 280,
            marginBottom: actionLabel ? 16 : 0,
          },
        ]}
      >
        {description}
      </Text>
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.sage }}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function GroupEditScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { activeGroupId } = useGroupStore();
  const {
    data: group,
    isLoading,
    error: groupError,
  } = useGroup(activeGroupId ?? '');
  const updateGroup = useUpdateGroup(activeGroupId ?? '');
  const archiveGroup = useArchiveGroup(activeGroupId ?? '');
  const deleteGroup = useDeleteGroup();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [baseline, setBaseline] = useState<Draft | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  useEffect(() => {
    if (!group) return;

    const cycleValue = cycleFromCycleDate(group.cycle_date);
    const groupType = (group.type ?? GroupType.HOME) as GroupTypeValue;
    const groupSubtype = (group as { subtype?: string | null }).subtype ?? null;
    const groupApprovalThreshold =
      (group as { approval_threshold?: number | null }).approval_threshold ?? null;
    const groupRawEssentials = (group as { space_essentials?: unknown }).space_essentials ?? null;
    const groupHouseInfo =
      (group as { house_info?: Record<string, string> | null }).house_info ?? null;
    const groupRawProgress =
      (group as { setup_checklist_progress?: SetupChecklistProgress | null })
        .setup_checklist_progress ?? null;

    const next: Draft = {
      name: group.name,
      description: group.description ?? '',
      type: groupType,
      subtype: groupSubtype,
      currency: group.currency ?? 'GBP',
      cycle: cycleValue,
      cycleDate: group.cycle_date ?? 1,
      avatarUrl: group.avatar_url ?? null,
      coverUrl: group.cover_url ?? null,
      approvalThreshold: groupApprovalThreshold != null ? String(groupApprovalThreshold) : '',
      spaceEssentials: normalizeSpaceEssentials(groupType, groupRawEssentials, groupHouseInfo),
      setupChecklistProgress: createSetupChecklistProgress(groupType, groupSubtype, groupRawProgress),
    };
    setDraft(next);
    setBaseline(next);
  }, [group]);

  const isAdmin = useMemo(
    () =>
      group?.members.some(
        (member) => member.user_id === user?.id && member.role === 'admin',
      ) ?? false,
    [group?.members, user?.id],
  );

  const isDirty = useMemo(() => {
    if (!draft || !baseline) return false;
    return JSON.stringify(draft) !== JSON.stringify(baseline);
  }, [draft, baseline]);

  if (!activeGroupId) {
    return (
      <EmptyStateScreen
        icon={IconLock}
        title="No group selected"
        description="Pick a group from the dashboard first."
        actionLabel="Go back"
        onAction={() => router.back()}
      />
    );
  }

  if (groupError) {
    return (
      <EmptyStateScreen
        icon={IconLock}
        title="Could not load group"
        description={getErrorMessage(groupError, 'Something went wrong loading group details.')}
        actionLabel="Go back"
        onAction={() => router.back()}
      />
    );
  }

  if (isLoading || !group || !draft) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgBase }}>
        <ScreenHeader
          title="Edit group"
          topInset={insets.top}
          onBack={() => router.back()}
          onSave={() => {}}
          saveEnabled={false}
          saving={false}
        />
        <View
          style={{
            paddingHorizontal: space.gutter,
            paddingTop: space.base,
            gap: space.md,
          }}
        >
          <View
            style={{
              height: 140,
              borderRadius: 18,
              backgroundColor: colors.bgSubtle,
              opacity: 0.6,
            }}
          />
          <View
            style={{
              height: 110,
              borderRadius: 14,
              backgroundColor: colors.bgSubtle,
              opacity: 0.6,
            }}
          />
          <View
            style={{
              height: 64,
              borderRadius: 14,
              backgroundColor: colors.bgSubtle,
              opacity: 0.6,
            }}
          />
        </View>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <EmptyStateScreen
        icon={IconLock}
        title="Admin access required"
        description="Only group admins can edit group settings."
        actionLabel="Go back"
        onAction={() => router.back()}
      />
    );
  }

  const typeMeta = getGroupTypeMeta(draft.type);
  const TypeIcon = typeMeta.icon as TablerIcon;
  const memberCount = group.members.length;

  const subtypeOptions = getGroupSubtypeOptions(draft.type);
  const essentialDefinitions = getSpaceEssentialDefinitions(draft.type);
  const checklistProgress = createSetupChecklistProgress(
    draft.type,
    draft.subtype,
    draft.setupChecklistProgress,
  );
  const checklistEntries = Object.entries(checklistProgress);
  const completedChecklistCount = countCompletedSetupChecklistItems(checklistProgress);

  const approvalThresholdInput = draft.approvalThreshold.trim();
  const approvalThresholdNumber =
    approvalThresholdInput.length > 0 && Number.isFinite(Number(approvalThresholdInput))
      ? Number(approvalThresholdInput)
      : null;
  const approvalThresholdLabel =
    approvalThresholdNumber != null
      ? formatCurrency(approvalThresholdNumber, draft.currency)
      : null;

  function patchDraft(patch: Partial<Draft>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }

  function handleTypeChange(nextType: GroupTypeValue) {
    setDraft((current) => {
      if (!current) return current;
      const nextSubtypeOptions = getGroupSubtypeOptions(nextType);
      const nextSubtype = nextSubtypeOptions.some((option) => option.value === current.subtype)
        ? current.subtype
        : null;
      return { ...current, type: nextType, subtype: nextSubtype };
    });
  }

  function setEssentialValue(definition: SpaceEssentialDefinition, value: string) {
    setDraft((current) => {
      if (!current) return current;
      const previousEntry = current.spaceEssentials[definition.key];
      return {
        ...current,
        spaceEssentials: {
          ...current.spaceEssentials,
          [definition.key]: {
            label: definition.label,
            value,
            visible: previousEntry?.visible ?? definition.defaultVisible !== false,
          },
        },
      };
    });
  }

  function setEssentialVisibility(definition: SpaceEssentialDefinition, visible: boolean) {
    setDraft((current) => {
      if (!current) return current;
      const previousEntry = current.spaceEssentials[definition.key];
      return {
        ...current,
        spaceEssentials: {
          ...current.spaceEssentials,
          [definition.key]: {
            label: definition.label,
            value: previousEntry?.value ?? '',
            visible,
          },
        },
      };
    });
  }

  function toggleChecklistItem(id: string) {
    setDraft((current) => {
      if (!current) return current;
      const next = createSetupChecklistProgress(current.type, current.subtype, current.setupChecklistProgress);
      const entry = next[id];
      if (!entry) return current;
      next[id] = {
        ...entry,
        completed: !entry.completed,
        completed_at: !entry.completed ? new Date().toISOString() : null,
      };
      return { ...current, setupChecklistProgress: next };
    });
  }

  function markAllChecklist(complete: boolean) {
    setDraft((current) => {
      if (!current) return current;
      const next = createSetupChecklistProgress(current.type, current.subtype, current.setupChecklistProgress);
      const stamp = new Date().toISOString();
      for (const id of Object.keys(next)) {
        const entry = next[id];
        if (!entry) continue;
        next[id] = {
          ...entry,
          completed: complete,
          completed_at: complete ? stamp : null,
        };
      }
      return { ...current, setupChecklistProgress: next };
    });
  }

  async function pickAndUpload(kind: 'avatar' | 'cover') {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      hapticWarning();
      Alert.alert('Permission needed', 'Allow access to your photo library to upload.');
      return;
    }

    let result: ImagePicker.ImagePickerResult;
    try {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: kind === 'cover' ? [16, 9] : [1, 1],
        quality: 0.85,
      });
    } catch (error) {
      hapticWarning();
      Alert.alert('Could not open photos', getErrorMessage(error));
      return;
    }

    if (result.canceled || !result.assets?.[0]?.uri) return;

    const uri = result.assets[0].uri;
    if (!user?.id || !activeGroupId) {
      hapticWarning();
      Alert.alert('Sign-in required', 'Please sign in again to upload images.');
      return;
    }

    if (kind === 'avatar') setUploadingAvatar(true);
    else setUploadingCover(true);

    try {
      const publicUrl = await uploadGroupImageAsset(uri, user.id, activeGroupId, kind);
      hapticSelection();
      if (kind === 'avatar') {
        patchDraft({ avatarUrl: publicUrl });
      } else {
        patchDraft({ coverUrl: publicUrl });
      }
    } catch (error) {
      hapticWarning();
      Alert.alert('Upload failed', getErrorMessage(error, 'Could not upload image.'));
    } finally {
      if (kind === 'avatar') setUploadingAvatar(false);
      else setUploadingCover(false);
    }
  }

  async function handleSave() {
    if (!draft || !baseline || !isDirty || !group) return;

    const trimmedName = draft.name.trim();
    if (!trimmedName) {
      hapticWarning();
      Alert.alert('Validation error', 'Group name is required.');
      return;
    }

    const nextCycleDate = cycleDateFromCycle(draft.cycle, draft.cycleDate);

    const trimmedThreshold = draft.approvalThreshold.trim();
    const parsedThreshold = trimmedThreshold.length > 0 ? Number(trimmedThreshold) : null;

    if (
      draft.type === GroupType.WORKSPACE
      && trimmedThreshold.length > 0
      && (!Number.isFinite(parsedThreshold) || (parsedThreshold ?? 0) < 0)
    ) {
      hapticWarning();
      Alert.alert(
        'Validation error',
        'Approval threshold must be a positive number or left blank to disable it.',
      );
      return;
    }

    const definitions = getSpaceEssentialDefinitions(draft.type);
    const normalizedEssentials = definitions.reduce<SpaceEssentials>((acc, definition) => {
      const current = draft.spaceEssentials[definition.key];
      const trimmedValue = current?.value?.trim();
      if (!trimmedValue) return acc;
      acc[definition.key] = {
        label: definition.label,
        value: trimmedValue,
        visible: current?.visible ?? definition.defaultVisible !== false,
      };
      return acc;
    }, {});

    const nextChecklistProgress = createSetupChecklistProgress(
      draft.type,
      draft.subtype,
      draft.setupChecklistProgress,
    );

    hapticMedium();
    try {
      await updateGroup.mutateAsync({
        name: trimmedName,
        type: draft.type,
        subtype: draft.subtype,
        currency: draft.currency,
        cycle_date: nextCycleDate,
        description: draft.description.trim() || null,
        avatar_url: draft.avatarUrl ?? undefined,
        cover_url: draft.coverUrl ?? undefined,
        approval_threshold:
          draft.type === GroupType.WORKSPACE
            ? parsedThreshold
            : (group as { approval_threshold?: number | null }).approval_threshold ?? null,
        house_info:
          draft.type === GroupType.HOME
            ? Object.fromEntries(
                Object.entries(normalizedEssentials).map(([key, entry]) => [key, entry.value]),
              )
            : null,
        space_essentials:
          Object.keys(normalizedEssentials).length > 0 ? normalizedEssentials : null,
        setup_checklist_progress: nextChecklistProgress,
      });
      hapticSuccess();
      setBaseline({
        ...draft,
        cycleDate: nextCycleDate,
        spaceEssentials: normalizedEssentials,
        setupChecklistProgress: nextChecklistProgress,
      });
      router.back();
    } catch (error) {
      hapticWarning();
      Alert.alert('Update failed', getErrorMessage(error, 'Could not save group settings.'));
    }
  }

  function handleArchive() {
    hapticHeavy();
    Alert.alert(
      'Archive group?',
      'The group will be hidden from your list. You can restore it later from settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            try {
              await archiveGroup.mutateAsync();
              hapticSuccess();
              router.replace('/(tabs)');
            } catch (error) {
              hapticWarning();
              Alert.alert(
                'Archive failed',
                getErrorMessage(error, 'Could not archive this group.'),
              );
            }
          },
        },
      ],
    );
  }

  function handleDelete() {
    hapticHeavy();
    Alert.alert(
      'Delete group permanently?',
      'This removes expenses, payments, and member data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!activeGroupId) return;
            try {
              await deleteGroup.mutateAsync(activeGroupId);
              hapticSuccess();
              router.replace('/(tabs)');
            } catch (error) {
              hapticWarning();
              Alert.alert(
                'Delete failed',
                getErrorMessage(error, 'Could not delete this group.'),
              );
            }
          },
        },
      ],
    );
  }

  const saving = updateGroup.isPending;
  const ctaDisabled = !isDirty || saving;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase }}>
      <ScreenHeader
        title="Edit group"
        topInset={insets.top}
        onBack={() => router.back()}
        onSave={handleSave}
        saveEnabled={isDirty}
        saving={saving}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: space.base,
          paddingTop: 4,
          paddingBottom: 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        <HeroCover
          typeMeta={typeMeta}
          coverUri={draft.coverUrl}
          avatarUri={draft.avatarUrl}
          Icon={TypeIcon}
          uploadingCover={uploadingCover}
          uploadingAvatar={uploadingAvatar}
          onChangeCover={() => void pickAndUpload('cover')}
          onChangeAvatar={() => void pickAndUpload('avatar')}
        />

        {/* About */}
        <SectionLabel>About</SectionLabel>
        <FormGroup>
          <InputRow label="Name">
            <TextInput
              value={draft.name}
              onChangeText={(text) => patchDraft({ name: text })}
              placeholder="Group name"
              placeholderTextColor={colors.textMuted}
              style={{
                fontSize: 15,
                fontWeight: '600',
                color: colors.textPrimary,
                paddingVertical: 0,
              }}
              maxLength={64}
            />
          </InputRow>
          <InputRow label="Description" isLast>
            <TextInput
              value={draft.description}
              onChangeText={(text) => patchDraft({ description: text })}
              placeholder='Optional — e.g. "Flat 3A"'
              placeholderTextColor={colors.textMuted}
              style={{
                fontSize: 15,
                fontWeight: '600',
                color: colors.textPrimary,
                paddingVertical: 0,
              }}
              maxLength={120}
            />
          </InputRow>
        </FormGroup>

        {/* Type pills */}
        <SectionLabel>Type</SectionLabel>
        <TypePillRow value={draft.type} onChange={handleTypeChange} />

        {/* Subtype — only when current type has subtype options */}
        {subtypeOptions.length > 0 ? (
          <>
            <SectionLabel>Subtype</SectionLabel>
            <View
              style={{
                padding: 12,
                backgroundColor: colors.bgSurface,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.borderSubtle,
                marginBottom: 8,
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 6,
              }}
            >
              {subtypeOptions.map((option) => {
                const selected = draft.subtype === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      hapticSelection();
                      patchDraft({ subtype: option.value });
                    }}
                    style={({ pressed }) => ({
                      paddingVertical: 7,
                      paddingHorizontal: 12,
                      borderRadius: 999,
                      backgroundColor: selected ? colors.sageSoft : colors.bgBase,
                      borderWidth: 1,
                      borderColor: selected ? colors.sageSoft : colors.borderSubtle,
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <Text
                      style={{
                        fontSize: 12.5,
                        fontWeight: '600',
                        color: selected ? colors.sageInk : colors.textTertiary,
                      }}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {/* Settings */}
        <SectionLabel>Settings</SectionLabel>
        <FormGroup>
          <InputRow label="Currency">
            <Picker
              value={draft.currency}
              options={CURRENCY_OPTIONS}
              onChange={(next) => patchDraft({ currency: next })}
            />
          </InputRow>
          <InputRow label="Cycle">
            <Picker<CycleValue>
              value={draft.cycle}
              options={CYCLE_OPTIONS}
              onChange={(next) => patchDraft({ cycle: next })}
            />
          </InputRow>
          <Pressable
            onPress={() => {
              hapticMedium();
              router.push('/members');
            }}
            style={({ pressed }) => ({
              paddingHorizontal: 14,
              paddingVertical: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              style={{
                flex: 1,
                fontSize: 15,
                fontWeight: '600',
                color: colors.textPrimary,
              }}
            >
              Members
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: colors.textTertiary,
                fontWeight: '500',
              }}
            >
              {memberCount}
            </Text>
            <IconChevronRight size={18} color={colors.textMuted} strokeWidth={2} />
          </Pressable>
        </FormGroup>

        {/* Workspace governance — only when type is workspace */}
        {draft.type === GroupType.WORKSPACE ? (
          <>
            <SectionLabel>Workspace governance</SectionLabel>
            <FormGroup>
              <View
                style={{
                  paddingHorizontal: 14,
                  paddingTop: 12,
                  paddingBottom: 6,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: colors.infoBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconShieldCheck
                    size={18}
                    color={colors.infoText}
                    strokeWidth={1.7}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 13.5,
                      fontWeight: '700',
                      color: colors.textPrimary,
                    }}
                  >
                    Approval threshold
                  </Text>
                  <Text
                    style={{
                      fontSize: 11.5,
                      color: colors.textTertiary,
                      marginTop: 2,
                    }}
                    numberOfLines={2}
                  >
                    Expenses above this need admin approval before they settle.
                  </Text>
                </View>
              </View>
              <View
                style={{
                  paddingHorizontal: 14,
                  paddingTop: 6,
                  paddingBottom: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <View
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    backgroundColor: colors.bgBase,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colors.borderSubtle,
                    paddingHorizontal: 12,
                    height: heightTokens.input,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '700',
                      color: colors.textTertiary,
                    }}
                  >
                    {draft.currency}
                  </Text>
                  <TextInput
                    value={draft.approvalThreshold}
                    onChangeText={(text) => patchDraft({ approvalThreshold: text })}
                    placeholder="Leave empty to disable"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                    style={{
                      flex: 1,
                      fontSize: 15,
                      fontWeight: '600',
                      color: colors.textPrimary,
                      paddingVertical: 0,
                    }}
                  />
                </View>
              </View>
              {approvalThresholdLabel ? (
                <View
                  style={{
                    paddingHorizontal: 14,
                    paddingBottom: 12,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11.5,
                      color: colors.textTertiary,
                      lineHeight: 16,
                    }}
                  >
                    Reviews kick in for expenses above {approvalThresholdLabel}.
                  </Text>
                </View>
              ) : null}
            </FormGroup>
          </>
        ) : null}

        {/* Space essentials */}
        <SectionLabel>Space essentials</SectionLabel>
        <FormGroup>
          <View
            style={{
              paddingHorizontal: 14,
              paddingTop: 12,
              paddingBottom: 4,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: colors.sageSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconSparkles size={18} color={colors.sage} strokeWidth={1.7} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 13.5,
                  fontWeight: '700',
                  color: colors.textPrimary,
                }}
              >
                Practical details
              </Text>
              <Text
                style={{
                  fontSize: 11.5,
                  color: colors.textTertiary,
                  marginTop: 2,
                }}
                numberOfLines={2}
              >
                Capture the things people should not have to ask for twice.
              </Text>
            </View>
          </View>
          {essentialDefinitions.map((definition, idx) => {
            const entry = draft.spaceEssentials[definition.key];
            const isLast = idx === essentialDefinitions.length - 1;
            return (
              <View
                key={definition.key}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  borderTopWidth: 1,
                  borderTopColor: colors.borderSubtle,
                  borderBottomWidth: isLast ? 0 : 0,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    marginBottom: 8,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: colors.textMuted,
                        textTransform: 'uppercase',
                        letterSpacing: 0.4,
                      }}
                    >
                      {definition.label}
                    </Text>
                  </View>
                  <Switch
                    value={entry?.visible ?? definition.defaultVisible !== false}
                    onValueChange={(visible) => {
                      hapticSelection();
                      setEssentialVisibility(definition, visible);
                    }}
                    trackColor={{ false: colors.border, true: colors.sage }}
                    thumbColor={colors.textInverse}
                    ios_backgroundColor={colors.border}
                  />
                </View>
                <TextInput
                  value={entry?.value ?? ''}
                  onChangeText={(text) => setEssentialValue(definition, text)}
                  placeholder={definition.placeholder}
                  placeholderTextColor={colors.textMuted}
                  multiline={definition.kind === 'textarea'}
                  textAlignVertical={definition.kind === 'textarea' ? 'top' : 'center'}
                  style={{
                    backgroundColor: colors.bgBase,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colors.borderSubtle,
                    paddingHorizontal: 12,
                    paddingVertical: definition.kind === 'textarea' ? 10 : 0,
                    minHeight: definition.kind === 'textarea' ? 76 : heightTokens.input,
                    fontSize: 14,
                    fontWeight: '500',
                    color: colors.textPrimary,
                  }}
                />
              </View>
            );
          })}
        </FormGroup>

        {/* Setup checklist */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 4,
            paddingTop: 18,
            paddingBottom: 8,
          }}
        >
          <Text
            style={{
              fontSize: 10.5,
              fontWeight: '700',
              color: colors.textMuted,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
            }}
          >
            Setup checklist
          </Text>
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 999,
              backgroundColor: colors.sageSoft,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: colors.sageInk,
                fontVariant: ['tabular-nums'],
              }}
            >
              {completedChecklistCount}/{checklistEntries.length}
            </Text>
          </View>
        </View>
        <FormGroup>
          <View
            style={{
              paddingHorizontal: 14,
              paddingTop: 12,
              paddingBottom: 4,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: colors.warnBg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconClipboardList size={18} color={colors.warnText} strokeWidth={1.7} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 13.5,
                  fontWeight: '700',
                  color: colors.textPrimary,
                }}
              >
                Onboarding basics
              </Text>
              <Text
                style={{
                  fontSize: 11.5,
                  color: colors.textTertiary,
                  marginTop: 2,
                }}
                numberOfLines={2}
              >
                Track what should be settled before handovers and cycle close.
              </Text>
            </View>
          </View>
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              paddingHorizontal: 14,
              paddingVertical: 8,
            }}
          >
            <Pressable
              onPress={() => {
                hapticSelection();
                markAllChecklist(true);
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 999,
                backgroundColor: colors.sageSoft,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <IconChecks size={13} color={colors.sageInk} strokeWidth={2} />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: colors.sageInk,
                }}
              >
                Mark all
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                hapticSelection();
                markAllChecklist(false);
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 999,
                backgroundColor: colors.bgBase,
                borderWidth: 1,
                borderColor: colors.borderSubtle,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <IconRefresh size={13} color={colors.textTertiary} strokeWidth={2} />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: colors.textTertiary,
                }}
              >
                Reset
              </Text>
            </Pressable>
          </View>
          {checklistEntries.map(([id, entry], idx) => {
            const isLast = idx === checklistEntries.length - 1;
            const ToggleIcon = entry.completed ? IconCircleCheck : IconCircle;
            return (
              <Pressable
                key={id}
                onPress={() => {
                  hapticSelection();
                  toggleChecklistItem(id);
                }}
                style={({ pressed }) => ({
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 10,
                  borderTopWidth: 1,
                  borderTopColor: colors.borderSubtle,
                  borderBottomWidth: isLast ? 0 : 0,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <ToggleIcon
                  size={20}
                  color={entry.completed ? colors.sage : colors.textMuted}
                  strokeWidth={1.8}
                />
                <Text
                  style={{
                    flex: 1,
                    fontSize: 13.5,
                    lineHeight: 19,
                    color: entry.completed ? colors.textTertiary : colors.textPrimary,
                    fontWeight: entry.completed ? '500' : '600',
                    textDecorationLine: entry.completed ? 'line-through' : 'none',
                  }}
                >
                  {entry.label}
                </Text>
              </Pressable>
            );
          })}
        </FormGroup>

        {/* Danger zone */}
        <SectionLabel>Danger zone</SectionLabel>
        <DangerTile
          icon={IconArchive}
          label="Archive group"
          description="Hide from list, keep history"
          onPress={handleArchive}
        />
        <DangerTile
          icon={IconTrash}
          label="Delete group"
          description="Permanent · cannot be undone"
          onPress={handleDelete}
          intense
        />
      </ScrollView>

      {/* Pinned CTA bar */}
      <View
        style={{
          paddingHorizontal: space.base,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 16) + 4,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.bgBase,
        }}
      >
        <TouchableOpacity
          onPress={handleSave}
          disabled={ctaDisabled}
          activeOpacity={0.85}
          style={{
            height: heightTokens.buttonLg,
            borderRadius: 14,
            backgroundColor: ctaDisabled ? colors.borderSubtle : colors.bgInk,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {saving ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <Text
              style={{
                fontSize: 15,
                fontWeight: '600',
                color: ctaDisabled ? colors.textMuted : colors.textInverse,
              }}
            >
              Save changes
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

