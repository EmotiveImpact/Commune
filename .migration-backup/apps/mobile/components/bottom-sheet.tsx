/**
 * Commune BottomSheet — canonical bottom-sheet pattern
 *
 * Spec (designs/final-v2.html § "Bottom sheet · canonical pattern"):
 *  - 40×4 grab handle, neutral grey, centered, ~10px below the top edge.
 *  - White sheet card, top-corners 18px radius, no decorative close button.
 *  - Backdrop is black at 35% opacity, tappable to dismiss.
 *  - Rows are dividers (borderBottomWidth: 1, borderBottomColor: borderSubtle),
 *    last row has no border. Row padding ≈ 13px vertical, 4px horizontal.
 *  - Destructive rows use the warn palette (warnText / warnBg).
 *  - Sheet container respects useSafeAreaInsets().bottom so the last row
 *    never sits under the home indicator.
 *
 * All five hand-rolled <Modal> sheets in the app should consume <BottomSheet>
 * + <SheetRow> instead of building their own chrome.
 */

import { useState, type ReactNode } from 'react';
import { Modal, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconCheck, IconChevronRight } from '@tabler/icons-react-native';

import { colors, font, radius, space } from '@/constants/design';
import { IconTile, Pressable, type TablerIcon } from '@/components/primitives';
import { hapticSelection } from '@/lib/haptics';

const BACKDROP_COLOR = 'rgba(0,0,0,0.35)';
const SHEET_RADIUS = 18;
const GRAB_WIDTH = 40;
const GRAB_HEIGHT = 4;
const GRAB_TOP_OFFSET = 10;
const ROW_VERTICAL_PADDING = 13;
const ROW_HORIZONTAL_PADDING = 4;

/* ============================================================================
 * BottomSheet
 * ============================================================================ */

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Optional title row rendered above the sheet rows. */
  title?: string;
  /** Optional subtitle shown below the title. */
  subtitle?: string;
  /** Optional style overrides for the sheet card. Use sparingly. */
  contentStyle?: StyleProp<ViewStyle>;
};

export function BottomSheet({
  visible,
  onClose,
  children,
  title,
  subtitle,
  contentStyle,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        accessibilityLabel="Dismiss sheet"
        style={{
          flex: 1,
          backgroundColor: BACKDROP_COLOR,
          justifyContent: 'flex-end',
        }}
      >
        {/* Inner pressable swallows taps so they don't propagate to backdrop. */}
        <Pressable
          onPress={() => {}}
          style={[
            {
              backgroundColor: colors.bgSurface,
              borderTopLeftRadius: SHEET_RADIUS,
              borderTopRightRadius: SHEET_RADIUS,
              paddingTop: GRAB_TOP_OFFSET,
              paddingHorizontal: space.base,
              // Ensures the last row clears the home indicator.
              paddingBottom: Math.max(insets.bottom, space.md),
            },
            contentStyle,
          ]}
        >
          <View
            style={{
              alignSelf: 'center',
              width: GRAB_WIDTH,
              height: GRAB_HEIGHT,
              borderRadius: GRAB_HEIGHT / 2,
              backgroundColor: colors.borderSubtle,
              marginBottom: space.md,
            }}
          />
          {title ? (
            <View style={{ paddingHorizontal: ROW_HORIZONTAL_PADDING, paddingBottom: space.sm }}>
              <Text style={[font.h3, { color: colors.textPrimary }]} numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text
                  style={[font.caption, { color: colors.textTertiary, marginTop: 2 }]}
                  numberOfLines={2}
                >
                  {subtitle}
                </Text>
              ) : null}
            </View>
          ) : null}
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ============================================================================
 * SheetRow — one tappable row inside a BottomSheet
 * ============================================================================ */

export type SheetRowProps = {
  /** Tabler icon component rendered inside the leading IconTile. */
  icon?: TablerIcon;
  /**
   * Custom leading element. When supplied, replaces the default IconTile.
   * Useful for currency symbols, avatars, or other non-icon affordances.
   */
  leading?: ReactNode;
  /** Override the icon tile foreground colour. Defaults to the row palette. */
  iconColor?: string;
  /** Override the icon tile background colour. Defaults to the row palette. */
  iconBg?: string;
  title: string;
  subtitle?: string;
  /** Custom trailing element (e.g. a checkmark or chevron). */
  trailing?: ReactNode;
  /** Use the warn palette for the icon tile and title. */
  destructive?: boolean;
  /** When true, the row is greyed out and not pressable. */
  disabled?: boolean;
  /** Hide the bottom divider — set on the last row. */
  isLast?: boolean;
  onPress?: () => void;
};

export function SheetRow({
  icon: Icon,
  leading,
  iconColor,
  iconBg,
  title,
  subtitle,
  trailing,
  destructive = false,
  disabled = false,
  isLast = false,
  onPress,
}: SheetRowProps) {
  const titleColor = destructive ? colors.warnText : colors.textPrimary;
  const tileColor = iconColor ?? (destructive ? colors.warnText : colors.sage);
  const tileBg = iconBg ?? (destructive ? colors.warnBg : colors.sageSoft);

  const leadingNode = leading ?? (Icon ? (
    <IconTile icon={Icon} color={tileColor} bg={tileBg} size={36} />
  ) : null);

  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: ROW_VERTICAL_PADDING,
        paddingHorizontal: ROW_HORIZONTAL_PADDING,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.borderSubtle,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {leadingNode}
      <View style={{ flex: 1 }}>
        <Text
          style={{ fontSize: 14, fontWeight: '600', color: titleColor }}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{ fontSize: 11.5, color: colors.textTertiary, marginTop: 1 }}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );

  if (!onPress || disabled) {
    return content;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {content}
    </Pressable>
  );
}

/* ============================================================================
 * SelectRow — iOS Settings-style row that opens a BottomSheet picker.
 *
 * Use this for "pick one of N options" fields like currency, country,
 * timezone, theme, group type, etc. Looks like an iOS Settings row
 * (uppercase label on the left, current value + chevron on the right);
 * tap opens a bottom-sheet with each option as a SheetRow. The current
 * selection has a sage IconCheck trailing it. Selecting a row dismisses
 * the sheet, fires onChange, and triggers a selection haptic.
 *
 * For 2–3 mutually-exclusive options where users frequently switch,
 * prefer the `SegmentedControl` primitive instead. For wheel-style
 * picking (date, time, big numeric ranges), use `Picker`.
 * ============================================================================ */

export type SelectOption<T extends string> = {
  value: T;
  label: string;
  /** Optional helper text shown beneath the label inside the sheet. */
  caption?: string;
  /** Optional icon shown on the left of the sheet row. */
  icon?: TablerIcon;
};

export type SelectRowProps<T extends string> = {
  /** Uppercase label rendered on the left of the field row. */
  label?: string;
  /** Current value. Falsy = render placeholder. */
  value: T | null | undefined;
  options: ReadonlyArray<SelectOption<T>>;
  onChange: (value: T) => void;
  /** Sheet header. Defaults to the field's label. */
  sheetTitle?: string;
  /** Placeholder shown when no value is selected. */
  placeholder?: string;
  /** Suffix appended to the displayed value (e.g. " GBP"). Optional. */
  valueSuffix?: string;
  /** Hide the field row's bottom divider — set on the last row in a form group. */
  isLast?: boolean;
  /** Disable the row entirely (greys out + non-pressable). */
  disabled?: boolean;
};

export function SelectRow<T extends string>({
  label,
  value,
  options,
  onChange,
  sheetTitle,
  placeholder = 'Select…',
  valueSuffix,
  isLast = false,
  disabled = false,
}: SelectRowProps<T>) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const displayLabel = selected
    ? `${selected.label}${valueSuffix ?? ''}`
    : placeholder;

  function handleSelect(next: T) {
    hapticSelection();
    onChange(next);
    setOpen(false);
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}: ${displayLabel}` : displayLabel}
        onPress={disabled ? undefined : () => setOpen(true)}
        disabled={disabled}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 14,
          paddingHorizontal: space.base,
          backgroundColor: colors.bgSurface,
          borderBottomWidth: isLast ? 0 : 1,
          borderBottomColor: colors.borderSubtle,
          opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
        })}
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
              flexShrink: 0,
            }}
          >
            {label}
          </Text>
        ) : null}
        <Text
          style={{
            flex: 1,
            fontSize: 15,
            fontWeight: selected ? '600' : '400',
            color: selected ? colors.textPrimary : colors.textTertiary,
          }}
          numberOfLines={1}
        >
          {displayLabel}
        </Text>
        <IconChevronRight size={18} color={colors.textTertiary} strokeWidth={1.7} />
      </Pressable>

      <BottomSheet
        visible={open}
        onClose={() => setOpen(false)}
        title={sheetTitle ?? label}
      >
        {options.map((opt, idx) => {
          const isSelected = opt.value === value;
          return (
            <SheetRow
              key={opt.value}
              icon={opt.icon}
              iconColor={isSelected ? colors.sage : colors.textTertiary}
              iconBg={isSelected ? colors.sageSoft : colors.bgSubtle}
              title={opt.label}
              subtitle={opt.caption}
              isLast={idx === options.length - 1}
              onPress={() => handleSelect(opt.value)}
              trailing={
                isSelected ? (
                  <IconCheck size={20} color={colors.sage} strokeWidth={2.2} />
                ) : null
              }
            />
          );
        })}
      </BottomSheet>
    </>
  );
}
