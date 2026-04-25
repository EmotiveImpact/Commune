import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  IconBrandCashapp,
  IconBrandPaypal,
  IconBrandRevolut,
  IconBuildingBank,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconDots,
  IconPlus,
  IconTrash,
  IconWallet,
  IconX,
} from '@tabler/icons-react-native';
import { isClickableProvider, getProviderDisplayName } from '@commune/core';
import type { PaymentProvider, UserPaymentMethod } from '@commune/types';

import {
  Button,
  Card,
  EmptyState,
  IconTile,
  Pressable,
  Screen,
  type TablerIcon,
} from '@/components/primitives';
import { BottomSheet, SheetRow } from '@/components/bottom-sheet';
import { colors, font, height, radius, space } from '@/constants/design';
import { useAuthStore } from '@/stores/auth';
import {
  useCreatePaymentMethod,
  useDeletePaymentMethod,
  usePaymentMethods,
  useUpdatePaymentMethod,
} from '@/hooks/use-payment-methods';
import {
  hapticHeavy,
  hapticLight,
  hapticMedium,
  hapticSuccess,
  hapticWarning,
} from '@/lib/haptics';
import { getErrorMessage } from '@/lib/errors';

/* ---------------------------------------------------------------------------
 * Provider visual map
 * Brand icons exist for paypal, revolut, cashapp; everything else falls back
 * to a coloured tile with the provider's initial.
 * --------------------------------------------------------------------------- */

type ProviderVisual = {
  icon?: TablerIcon;
  initial: string;
  color: string;
  bg: string;
};

const PROVIDER_VISUALS: Record<PaymentProvider, ProviderVisual> = {
  revolut: { icon: IconBrandRevolut, initial: 'R', color: '#0066FF', bg: '#E2ECFE' },
  monzo: { initial: 'M', color: '#FF3B30', bg: '#FBE4DF' },
  paypal: { icon: IconBrandPaypal, initial: 'P', color: '#003087', bg: '#DDE6F4' },
  wise: { initial: 'W', color: '#163300', bg: '#E2EBD9' },
  starling: { initial: 'S', color: '#7E2D8C', bg: '#EFE2F4' },
  venmo: { initial: 'V', color: '#3D95CE', bg: '#DEECF7' },
  cash_app: { icon: IconBrandCashapp, initial: 'C', color: '#00D632', bg: '#DDF6E1' },
  bank_transfer: { icon: IconBuildingBank, initial: 'B', color: colors.textSecondary, bg: colors.bgSubtle },
  other: { icon: IconWallet, initial: 'O', color: colors.textSecondary, bg: colors.bgSubtle },
};

const PROVIDER_ORDER: PaymentProvider[] = [
  'revolut',
  'monzo',
  'paypal',
  'wise',
  'starling',
  'venmo',
  'cash_app',
  'bank_transfer',
  'other',
];

const HANDLE_PLACEHOLDER: Record<PaymentProvider, string> = {
  revolut: '@yourname or revolut.me/yourname',
  monzo: 'monzo.me/yourname',
  paypal: 'paypal.me/yourname',
  wise: 'wise.com/pay/yourname',
  starling: 'settleup.starlingbank.com/yourname',
  venmo: '@yourname',
  cash_app: '$yourtag',
  bank_transfer: 'Sort code, account number, name…',
  other: 'How should they pay you?',
};

function ProviderGlyph({ provider, size = 36 }: { provider: PaymentProvider; size?: number }) {
  const visual = PROVIDER_VISUALS[provider];
  if (visual.icon) {
    return <IconTile icon={visual.icon} color={visual.color} bg={visual.bg} size={size} />;
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        backgroundColor: visual.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: Math.round(size * 0.42), fontWeight: '700', color: visual.color }}>
        {visual.initial}
      </Text>
    </View>
  );
}

/* ---------------------------------------------------------------------------
 * In-body header — matches notifications.tsx pattern
 * --------------------------------------------------------------------------- */

function ScreenHeader({
  onBack,
  onAdd,
  showAdd,
}: {
  onBack: () => void;
  onAdd: () => void;
  showAdd: boolean;
}) {
  return (
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
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
          height: 36,
          paddingRight: space.sm,
          marginLeft: -6,
          zIndex: 2,
        }}
      >
        <IconChevronLeft size={24} color={colors.textPrimary} strokeWidth={1.7} />
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>Back</Text>
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
        <Text style={[font.h3, { color: colors.textPrimary }]}>Payment methods</Text>
      </View>

      <Pressable
        onPress={onAdd}
        disabled={!showAdd}
        accessibilityRole="button"
        accessibilityLabel="Add payment method"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={{
          minWidth: 48,
          alignItems: 'flex-end',
          opacity: showAdd ? 1 : 0,
          zIndex: 2,
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.sageInk }}>+ Add</Text>
      </Pressable>
    </View>
  );
}

/* ---------------------------------------------------------------------------
 * Method row
 * --------------------------------------------------------------------------- */

function MethodRow({
  method,
  onPress,
  onMore,
}: {
  method: UserPaymentMethod;
  onPress: () => void;
  onMore: () => void;
}) {
  const provider = method.provider;
  const display = getProviderDisplayName(provider);
  const handle =
    method.payment_link?.trim() ||
    method.payment_info?.trim() ||
    'No details yet';
  const subtitle = method.label?.trim() ? `${display} · ${method.label.trim()}` : display;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onMore}
      accessibilityRole="button"
      accessibilityLabel={`${display} payment method`}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          paddingVertical: space.md + 2,
          paddingHorizontal: space.base,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <ProviderGlyph provider={provider} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Text
            style={[font.bodyStrong, { color: colors.textPrimary, flexShrink: 1 }]}
            numberOfLines={1}
          >
            {handle}
          </Text>
          {method.is_default ? (
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: radius.chip,
                backgroundColor: colors.sageSoft,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '700', color: colors.sage, letterSpacing: 0.4 }}>
                DEFAULT
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          style={[font.caption, { color: colors.textTertiary, marginTop: 2 }]}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      </View>
      <Pressable
        onPress={onMore}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="More options"
        style={({ pressed }) => [
          {
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.6 : 1,
          },
        ]}
      >
        <IconDots size={20} color={colors.textTertiary} strokeWidth={1.7} />
      </Pressable>
    </Pressable>
  );
}

/* ---------------------------------------------------------------------------
 * Provider picker bottom sheet
 * --------------------------------------------------------------------------- */

function ProviderPickerSheet({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: PaymentProvider | null;
  onSelect: (p: PaymentProvider) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Select provider">
      {PROVIDER_ORDER.map((provider, idx) => {
        const isLast = idx === PROVIDER_ORDER.length - 1;
        const isSelected = selected === provider;
        return (
          <SheetRow
            key={provider}
            leading={<ProviderGlyph provider={provider} size={36} />}
            title={getProviderDisplayName(provider)}
            subtitle={
              isClickableProvider(provider)
                ? 'Opens directly in the app'
                : 'Manual details only'
            }
            isLast={isLast}
            trailing={
              isSelected ? (
                <IconCheck size={20} color={colors.sage} strokeWidth={2} />
              ) : (
                <IconChevronRight size={18} color={colors.textTertiary} strokeWidth={1.7} />
              )
            }
            onPress={() => {
              hapticLight();
              onSelect(provider);
            }}
          />
        );
      })}
    </BottomSheet>
  );
}

/* ---------------------------------------------------------------------------
 * Add / Edit form (fullscreen Modal — needs more vertical room than a sheet)
 * --------------------------------------------------------------------------- */

type FormMode =
  | { kind: 'add' }
  | { kind: 'edit'; method: UserPaymentMethod };

function MethodFormModal({
  visible,
  mode,
  userId,
  onClose,
  hasAnyMethods,
}: {
  visible: boolean;
  mode: FormMode | null;
  userId: string;
  onClose: () => void;
  hasAnyMethods: boolean;
}) {
  const insets = useSafeAreaInsets();
  const createMutation = useCreatePaymentMethod(userId);
  const updateMutation = useUpdatePaymentMethod(userId);

  const [provider, setProvider] = useState<PaymentProvider | null>(null);
  const [linkOrInfo, setLinkOrInfo] = useState('');
  const [label, setLabel] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Reset form whenever the modal opens or the mode changes.
  useEffect(() => {
    if (!visible || !mode) return;
    if (mode.kind === 'edit') {
      const m = mode.method;
      setProvider(m.provider);
      setLinkOrInfo(
        (isClickableProvider(m.provider) ? m.payment_link : m.payment_info) ?? '',
      );
      setLabel(m.label ?? '');
      setIsDefault(m.is_default);
    } else {
      setProvider(null);
      setLinkOrInfo('');
      setLabel('');
      setIsDefault(!hasAnyMethods);
    }
    setFormError(null);
  }, [visible, mode, hasAnyMethods]);

  const isEditing = mode?.kind === 'edit';
  const submitting = createMutation.isPending || updateMutation.isPending;

  const clickable = provider ? isClickableProvider(provider) : false;
  const detailLabel = clickable ? 'Payment link or handle' : 'Payment details';
  const detailHint = clickable
    ? 'Friends will tap this and be sent straight to the app.'
    : 'Plain text — sort code, account number, anything you want shown.';

  async function handleSubmit() {
    if (!provider) {
      setFormError('Pick a provider first.');
      hapticWarning();
      return;
    }
    const trimmed = linkOrInfo.trim();
    if (!trimmed) {
      setFormError(
        clickable
          ? 'Payment link is required for this provider.'
          : 'Payment details are required for this provider.',
      );
      hapticWarning();
      return;
    }
    setFormError(null);

    const payload = {
      provider,
      label: label.trim() || null,
      payment_link: clickable ? trimmed : null,
      payment_info: clickable ? null : trimmed,
      is_default: isDefault,
    };

    try {
      hapticMedium();
      if (mode?.kind === 'edit') {
        await updateMutation.mutateAsync({ methodId: mode.method.id, data: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      hapticSuccess();
      onClose();
    } catch (err) {
      hapticWarning();
      setFormError(getErrorMessage(err, 'Could not save payment method.'));
    }
  }

  if (!mode) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bgBase }}>
        {/* Header */}
        <View
          style={{
            paddingTop: insets.top + 12,
            paddingHorizontal: space.gutter,
            paddingBottom: space.sm,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderSubtle,
            backgroundColor: colors.bgSurface,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Pressable
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={{ width: 36, height: 36, alignItems: 'flex-start', justifyContent: 'center' }}
          >
            <IconX size={22} color={colors.textPrimary} strokeWidth={1.7} />
          </Pressable>
          <Text style={[font.h3, { color: colors.textPrimary }]}>
            {isEditing ? 'Edit method' : 'Add payment method'}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: space.gutter,
            paddingTop: space.lg,
            paddingBottom: space.xxxl + insets.bottom,
            gap: space.lg,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Provider selector */}
          <View>
            <Text
              style={[
                font.caption,
                { marginBottom: space.sm, color: colors.textPrimary, fontWeight: '600' },
              ]}
            >
              Provider
            </Text>
            <Pressable
              onPress={() => {
                hapticLight();
                setPickerVisible(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Select provider"
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                  minHeight: height.input + 12,
                  paddingHorizontal: space.base,
                  paddingVertical: space.sm,
                  borderRadius: radius.button,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.bgSurface,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              {provider ? <ProviderGlyph provider={provider} size={36} /> : (
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    backgroundColor: colors.bgSubtle,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconWallet size={18} color={colors.textTertiary} strokeWidth={1.7} />
                </View>
              )}
              <Text
                style={{
                  flex: 1,
                  fontSize: 16,
                  fontWeight: provider ? '600' : '400',
                  color: provider ? colors.textPrimary : colors.textTertiary,
                }}
                numberOfLines={1}
              >
                {provider ? getProviderDisplayName(provider) : 'Choose a provider'}
              </Text>
              <IconChevronRight size={18} color={colors.textTertiary} strokeWidth={1.7} />
            </Pressable>
          </View>

          {/* Link / details */}
          <View>
            <Text
              style={[
                font.caption,
                { marginBottom: space.sm, color: colors.textPrimary, fontWeight: '600' },
              ]}
            >
              {detailLabel}
            </Text>
            <TextInput
              value={linkOrInfo}
              onChangeText={setLinkOrInfo}
              placeholder={provider ? HANDLE_PLACEHOLDER[provider] : '@yourname'}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              multiline={!clickable}
              numberOfLines={clickable ? 1 : 3}
              style={{
                minHeight: clickable ? height.input + 8 : height.input + 36,
                paddingHorizontal: space.base,
                paddingVertical: space.md,
                borderRadius: radius.button,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.bgSurface,
                fontSize: 16,
                color: colors.textPrimary,
                textAlignVertical: clickable ? 'center' : 'top',
              }}
            />
            <Text
              style={[
                font.caption,
                { marginTop: space.sm, color: colors.textTertiary },
              ]}
            >
              {detailHint}
            </Text>
          </View>

          {/* Label */}
          <View>
            <Text
              style={[
                font.caption,
                { marginBottom: space.sm, color: colors.textPrimary, fontWeight: '600' },
              ]}
            >
              Label <Text style={{ color: colors.textTertiary, fontWeight: '500' }}>(optional)</Text>
            </Text>
            <TextInput
              value={label}
              onChangeText={setLabel}
              placeholder='e.g. "Personal", "Work"'
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              style={{
                height: height.input + 8,
                paddingHorizontal: space.base,
                borderRadius: radius.button,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.bgSurface,
                fontSize: 16,
                color: colors.textPrimary,
              }}
            />
          </View>

          {/* Default toggle */}
          <Card padding={space.base}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.md,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[font.bodyStrong, { color: colors.textPrimary }]}>
                  Set as default
                </Text>
                <Text
                  style={[font.caption, { color: colors.textTertiary, marginTop: 2 }]}
                >
                  Used by friends when settling up.
                </Text>
              </View>
              <Switch
                value={isDefault}
                onValueChange={(v) => {
                  hapticLight();
                  setIsDefault(v);
                }}
                trackColor={{ false: colors.border, true: colors.sage }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={colors.border}
              />
            </View>
          </Card>

          {formError ? (
            <View
              style={{
                padding: space.md,
                borderRadius: radius.button,
                backgroundColor: colors.dangerBg,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.dangerText }}>
                {formError}
              </Text>
            </View>
          ) : null}
        </ScrollView>

        {/* Bottom actions */}
        <View
          style={{
            paddingHorizontal: space.gutter,
            paddingTop: space.md,
            paddingBottom: Math.max(insets.bottom, space.md),
            borderTopWidth: 1,
            borderTopColor: colors.borderSubtle,
            backgroundColor: colors.bgSurface,
            flexDirection: 'row',
            gap: space.md,
          }}
        >
          <TouchableOpacity
            onPress={onClose}
            disabled={submitting}
            accessibilityRole="button"
            activeOpacity={0.85}
            style={{
              flex: 1,
              height: height.buttonLg,
              borderRadius: radius.button,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.bgSurface,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: submitting ? 0.5 : 1,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>
              Cancel
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            accessibilityRole="button"
            activeOpacity={0.85}
            style={{
              flex: 1.4,
              height: height.buttonLg,
              borderRadius: radius.button,
              backgroundColor: colors.sage,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>
                {isEditing ? 'Save changes' : 'Add method'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ProviderPickerSheet
          visible={pickerVisible}
          selected={provider}
          onSelect={(p) => {
            setProvider(p);
            setPickerVisible(false);
          }}
          onClose={() => setPickerVisible(false)}
        />
      </View>
    </Modal>
  );
}

/* ---------------------------------------------------------------------------
 * Row actions sheet (edit / set default / delete)
 * --------------------------------------------------------------------------- */

function RowActionsSheet({
  visible,
  method,
  onClose,
  onEdit,
  onSetDefault,
  onDelete,
}: {
  visible: boolean;
  method: UserPaymentMethod | null;
  onClose: () => void;
  onEdit: () => void;
  onSetDefault: () => void;
  onDelete: () => void;
}) {
  if (!method) return null;
  const display = getProviderDisplayName(method.provider);
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={method.payment_link ?? method.payment_info ?? display}
      subtitle={display}
    >
      <SheetRow
        icon={IconWallet}
        title="Edit method"
        subtitle="Update link, label, or details"
        onPress={() => {
          onClose();
          setTimeout(onEdit, 120);
        }}
      />
      {!method.is_default ? (
        <SheetRow
          icon={IconCheck}
          title="Set as default"
          subtitle="Friends will use this when paying you"
          onPress={() => {
            onClose();
            setTimeout(onSetDefault, 120);
          }}
        />
      ) : null}
      <SheetRow
        icon={IconTrash}
        title="Delete method"
        destructive
        isLast
        onPress={() => {
          onClose();
          setTimeout(onDelete, 120);
        }}
      />
    </BottomSheet>
  );
}

/* ---------------------------------------------------------------------------
 * Screen
 * --------------------------------------------------------------------------- */

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? '';

  const { data: methods, isLoading } = usePaymentMethods(userId);
  const updateMutation = useUpdatePaymentMethod(userId);
  const deleteMutation = useDeletePaymentMethod(userId);

  const [formVisible, setFormVisible] = useState(false);
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [actionsTarget, setActionsTarget] = useState<UserPaymentMethod | null>(null);

  const list = useMemo<UserPaymentMethod[]>(() => methods ?? [], [methods]);
  const hasMethods = list.length > 0;

  function handleBack() {
    hapticLight();
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/settings');
  }

  function openAdd() {
    hapticLight();
    setFormMode({ kind: 'add' });
    setFormVisible(true);
  }

  function openEdit(method: UserPaymentMethod) {
    setFormMode({ kind: 'edit', method });
    setFormVisible(true);
  }

  function openMore(method: UserPaymentMethod) {
    hapticLight();
    setActionsTarget(method);
  }

  async function handleSetDefault(method: UserPaymentMethod) {
    try {
      hapticMedium();
      await updateMutation.mutateAsync({
        methodId: method.id,
        data: { is_default: true },
      });
      hapticSuccess();
    } catch (err) {
      Alert.alert('Could not update', getErrorMessage(err, 'Try again in a moment.'));
    }
  }

  function handleDelete(method: UserPaymentMethod) {
    const display = getProviderDisplayName(method.provider);
    Alert.alert(
      'Delete payment method',
      `Remove your ${display} method? Friends won't be able to pay you with it after this.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              hapticHeavy();
              await deleteMutation.mutateAsync(method.id);
            } catch (err) {
              Alert.alert('Could not delete', getErrorMessage(err, 'Try again in a moment.'));
            }
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: space.gutter,
          backgroundColor: colors.bgBase,
        }}
      >
        <ScreenHeader onBack={handleBack} onAdd={openAdd} showAdd={hasMethods} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingTop: space.md,
          paddingBottom: insets.bottom + space.xxxl,
          paddingHorizontal: space.gutter,
          gap: space.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading && !hasMethods ? (
          <View style={{ paddingTop: space.xxxl, alignItems: 'center' }}>
            <ActivityIndicator color={colors.sage} />
          </View>
        ) : !hasMethods ? (
          <EmptyState
            icon={IconWallet}
            title="Add a payment method"
            description="Friends use it to pay you when they owe — opens directly in Revolut, Monzo, PayPal, Venmo, etc."
            actionLabel="Add method"
            onAction={openAdd}
          />
        ) : (
          <>
            <Card padding={0}>
              {list.map((method, idx) => (
                <View key={method.id}>
                  <MethodRow
                    method={method}
                    onPress={() => openEdit(method)}
                    onMore={() => openMore(method)}
                  />
                  {idx < list.length - 1 ? (
                    <View
                      style={{
                        height: 1,
                        backgroundColor: colors.borderSubtle,
                        marginLeft: space.base + 36 + space.md,
                      }}
                    />
                  ) : null}
                </View>
              ))}
            </Card>

            <Button
              label="Add another method"
              icon={IconPlus}
              onPress={openAdd}
              variant="secondary"
              fullWidth
            />
          </>
        )}
      </ScrollView>

      <MethodFormModal
        visible={formVisible}
        mode={formMode}
        userId={userId}
        hasAnyMethods={hasMethods}
        onClose={() => {
          setFormVisible(false);
          setFormMode(null);
        }}
      />

      <RowActionsSheet
        visible={actionsTarget !== null}
        method={actionsTarget}
        onClose={() => setActionsTarget(null)}
        onEdit={() => {
          if (actionsTarget) openEdit(actionsTarget);
          setActionsTarget(null);
        }}
        onSetDefault={() => {
          if (actionsTarget) void handleSetDefault(actionsTarget);
          setActionsTarget(null);
        }}
        onDelete={() => {
          if (actionsTarget) handleDelete(actionsTarget);
          setActionsTarget(null);
        }}
      />
    </Screen>
  );
}
