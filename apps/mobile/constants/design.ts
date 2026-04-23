/**
 * Commune Design System — Light, editorial, warm
 *
 * Single source of truth for all visual tokens.
 * No screen should define its own colors, sizes, or spacing.
 */

import { Platform } from 'react-native';

/* ============================================================================
 * COLORS
 * ============================================================================ */

export const colors = {
  // Backgrounds (warm cream → white)
  bgBase: '#FAF9F7',
  bgSurface: '#FFFFFF',
  bgSubtle: '#F5F3EF',
  bgElevated: '#FFFFFF',
  bgInk: '#1A1E2B',      // dark hero card bg only

  // Text (ink hierarchy)
  textPrimary: '#1A1E2B',
  textSecondary: '#3D4152',
  textTertiary: '#6B6D73',
  textMuted: '#8A8D9A',
  textInverse: '#FFFFFF',

  // Borders
  border: '#E8E6E1',
  borderSubtle: '#F0EEEA',

  // Brand
  sage: '#2D6A4F',
  sageSoft: '#E8F0EB',
  sageInk: '#1F4D38',
  lime: '#96E85F',
  limeSoft: '#E8F7D4',

  // Semantic states
  oweText: '#C74A3A',
  oweBg: '#FBE4DF',
  owedText: '#2D6A4F',
  owedBg: '#E8F0EB',
  warnText: '#C9821A',
  warnBg: '#FBF0D9',
  settledText: '#6B6D73',
  settledBg: '#F0EEEA',
  infoText: '#2B5F8C',
  infoBg: '#DEECF7',
  dangerText: '#C74A3A',
  dangerBg: '#FBE4DF',

  // Type palette (per group type)
  typeHome: { accent: '#2D6A4F', bg: '#E8F0EB' },
  typeCouple: { accent: '#B84870', bg: '#FBE3ED' },
  typeWorkspace: { accent: '#2B5F8C', bg: '#DEECF7' },
  typeProject: { accent: '#8B5A3C', bg: '#F5E8DD' },
  typeTrip: { accent: '#C9821A', bg: '#FBF0D9' },
  typeOther: { accent: '#6B6D73', bg: '#F0EEEA' },
} as const;

/* ============================================================================
 * TYPOGRAPHY
 * ============================================================================ */

export const font = {
  display: { fontSize: 34, fontWeight: '700' as const, lineHeight: 40, letterSpacing: -0.5 },
  h1: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34, letterSpacing: -0.3 },
  h2: { fontSize: 22, fontWeight: '700' as const, lineHeight: 28, letterSpacing: -0.2 },
  h3: { fontSize: 17, fontWeight: '600' as const, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodyStrong: { fontSize: 15, fontWeight: '600' as const, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '500' as const, lineHeight: 18 },
  label: { fontSize: 11, fontWeight: '700' as const, lineHeight: 14, letterSpacing: 0.6, textTransform: 'uppercase' as const },
  monoAmount: {
    fontSize: 17,
    fontWeight: '600' as const,
    lineHeight: 22,
    fontVariant: ['tabular-nums'] as const,
  },
} as const;

/* ============================================================================
 * SPACING
 * ============================================================================ */

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  gutter: 20,
} as const;

/* ============================================================================
 * RADIUS
 * ============================================================================ */

export const radius = {
  pill: 999,
  chip: 8,
  button: 16,
  card: 16,
  sheet: 24,
  hero: 28,
} as const;

/* ============================================================================
 * SHADOW / ELEVATION
 * Warm shadows — use text-primary ink at low alpha, never pure black.
 * ============================================================================ */

export const elevation = {
  none: {},
  card: Platform.select({
    ios: {
      shadowColor: '#1A1E2B',
      shadowOpacity: 0.04,
      shadowRadius: 2,
      shadowOffset: { width: 0, height: 1 },
    },
    android: { elevation: 1 },
    default: {},
  }) ?? {},
  raised: Platform.select({
    ios: {
      shadowColor: '#1A1E2B',
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: 3 },
    default: {},
  }) ?? {},
  fab: Platform.select({
    ios: {
      shadowColor: '#1A1E2B',
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 8 },
    default: {},
  }) ?? {},
  sheet: Platform.select({
    ios: {
      shadowColor: '#1A1E2B',
      shadowOpacity: 0.12,
      shadowRadius: 32,
      shadowOffset: { width: 0, height: 12 },
    },
    android: { elevation: 12 },
    default: {},
  }) ?? {},
} as const;

/* ============================================================================
 * MOTION
 * ============================================================================ */

export const motion = {
  fast: 150,
  base: 240,
  slow: 400,
  easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
} as const;

/* ============================================================================
 * HEIGHTS (touch targets)
 * ============================================================================ */

export const height = {
  buttonSm: 36,
  buttonMd: 44,
  buttonLg: 52,
  input: 44,
  listItem: 64,
  listItemLg: 72,
  fab: 56,
  tabBar: 62,
} as const;

/* ============================================================================
 * CATEGORY ICONS (Ionicons) + COLORS
 * Replaces emoji categories with a consistent icon system.
 * ============================================================================ */

export const categoryMeta = {
  rent: { icon: 'home-outline', color: '#8B5A3C', bg: '#F5E8DD' },
  utilities: { icon: 'flash-outline', color: '#C9821A', bg: '#FBF0D9' },
  internet: { icon: 'wifi-outline', color: '#2B5F8C', bg: '#DEECF7' },
  cleaning: { icon: 'sparkles-outline', color: '#2D6A4F', bg: '#E8F0EB' },
  groceries: { icon: 'basket-outline', color: '#C74A3A', bg: '#FBE4DF' },
  entertainment: { icon: 'film-outline', color: '#6D5DC7', bg: '#E9E5F7' },
  household_supplies: { icon: 'bag-outline', color: '#8B5A3C', bg: '#F5E8DD' },
  transport: { icon: 'car-outline', color: '#B84870', bg: '#FBE3ED' },
  work_tools: { icon: 'briefcase-outline', color: '#2B5F8C', bg: '#DEECF7' },
  food: { icon: 'restaurant-outline', color: '#C74A3A', bg: '#FBE4DF' },
  shopping: { icon: 'bag-handle-outline', color: '#B84870', bg: '#FBE3ED' },
  bills: { icon: 'document-text-outline', color: '#C9821A', bg: '#FBF0D9' },
  miscellaneous: { icon: 'ellipsis-horizontal-outline', color: '#6B6D73', bg: '#F0EEEA' },
} as const;

export function getCategoryMeta(category: string) {
  const key = category.toLowerCase().replace(/[\s-]/g, '_');
  return (categoryMeta as Record<string, { icon: string; color: string; bg: string }>)[key] ?? categoryMeta.miscellaneous;
}

/* ============================================================================
 * GROUP TYPE META
 * ============================================================================ */

export const groupTypeMeta = {
  home: { label: 'Home', icon: 'home-outline', accent: colors.typeHome.accent, bg: colors.typeHome.bg },
  couple: { label: 'Couple', icon: 'heart-outline', accent: colors.typeCouple.accent, bg: colors.typeCouple.bg },
  workspace: { label: 'Workspace', icon: 'briefcase-outline', accent: colors.typeWorkspace.accent, bg: colors.typeWorkspace.bg },
  project: { label: 'Project', icon: 'construct-outline', accent: colors.typeProject.accent, bg: colors.typeProject.bg },
  trip: { label: 'Trip', icon: 'airplane-outline', accent: colors.typeTrip.accent, bg: colors.typeTrip.bg },
  other: { label: 'Other', icon: 'grid-outline', accent: colors.typeOther.accent, bg: colors.typeOther.bg },
} as const;

type GroupTypeMeta = { label: string; icon: string; accent: string; bg: string };

export function getGroupTypeMeta(type?: string): GroupTypeMeta {
  const map = groupTypeMeta as unknown as Record<string, GroupTypeMeta>;
  return map[type ?? 'other'] ?? map.other!;
}

/* ============================================================================
 * Convenience re-exports
 * ============================================================================ */

export const design = { colors, font, space, radius, elevation, motion, height };
