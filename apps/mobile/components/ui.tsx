/**
 * @deprecated — folded into `@/components/primitives`.
 *
 * Only retained because three screens (members.tsx, operations.tsx,
 * group-close.tsx) still import `Screen` / `EmptyState` / `DateField`
 * from here while parallel agents migrate them off this module.
 *
 * `EmptyState` and `DateField` are re-exported directly from primitives.
 * `Screen` is kept as a local scrolling wrapper because the primitives
 * `Screen` is non-scrolling (existing callers depend on the scroll behavior).
 *
 * Once the three remaining files import from `@/components/primitives`,
 * delete this file.
 */
import { type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { colors, space } from '@/constants/design';

export { DateField, EmptyState } from '@/components/primitives';

/* ---------------------------------------------------------------------------
 * Screen — scrolling wrapper (legacy default).
 * --------------------------------------------------------------------------- */

export function Screen({
  children,
  scroll = true,
}: {
  children: ReactNode;
  scroll?: boolean;
}) {
  if (!scroll) {
    return <View style={{ flex: 1, backgroundColor: colors.bgBase }}>{children}</View>;
  }
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bgBase }}
      contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}
