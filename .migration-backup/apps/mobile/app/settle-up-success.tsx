import { Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconCheck } from '@tabler/icons-react-native';

import { Pressable, Screen } from '@/components/primitives';
import { colors, elevation, font, height, radius, space } from '@/constants/design';

/* ---------------------------------------------------------------------------
 * Settle-up success — confirms a settlement has been logged.
 *
 * Presented after the Pay action in settle-up.tsx as a clean, focused
 * "receipt" screen: large sage check, headline, summary line, receipt rows
 * (From / To / Method / Reference), and a full-width Done CTA that returns
 * the user to the home tab.
 * --------------------------------------------------------------------------- */

type ReceiptRowProps = {
  label: string;
  value: string;
  isLast?: boolean;
};

function ReceiptRow({ label, value, isLast }: ReceiptRowProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: space.md + 2,
        gap: space.md,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.borderSubtle,
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: '500',
          color: colors.textMuted,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          flexShrink: 1,
          fontSize: 14,
          fontWeight: '600',
          color: colors.textPrimary,
          textAlign: 'right',
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

export default function SettleUpSuccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{
    toName?: string;
    amount?: string;
    description?: string;
    method?: string;
    reference?: string;
    fromName?: string;
  }>();

  const toName = params.toName?.trim() || 'them';
  const amount = params.amount?.trim() || '£0.00';
  const description = params.description?.trim() || 'the settlement';
  const method = params.method?.trim() || 'Bank transfer';
  const reference = params.reference?.trim() || '—';
  const fromName = params.fromName?.trim() || 'You';

  function handleDone() {
    // Returns the user to the home tab from any presentation depth.
    router.dismissAll();
    router.replace('/(tabs)');
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={{
          flex: 1,
          paddingHorizontal: space.gutter,
          paddingTop: insets.top + space.xxxl,
          paddingBottom: Math.max(insets.bottom, space.lg) + space.lg,
        }}
      >
        <View style={{ flex: 1, alignItems: 'stretch', justifyContent: 'flex-start' }}>
          {/* Hero check */}
          <View style={{ alignItems: 'center', marginBottom: space.xl }}>
            <View
              style={[
                {
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  backgroundColor: colors.sageSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                elevation.card,
              ]}
            >
              <IconCheck size={44} color={colors.sage} strokeWidth={2.2} />
            </View>
          </View>

          {/* Headline */}
          <Text
            style={{
              fontSize: 26,
              fontWeight: '700',
              letterSpacing: -0.4,
              color: colors.textPrimary,
              textAlign: 'center',
            }}
          >
            Settled!
          </Text>

          {/* Subhead */}
          <Text
            style={{
              fontSize: 15,
              fontWeight: '400',
              lineHeight: 23,
              color: colors.textTertiary,
              textAlign: 'center',
              marginTop: space.sm + 2,
              paddingHorizontal: space.sm,
            }}
          >
            You paid{' '}
            <Text style={{ fontWeight: '700', color: colors.textPrimary }}>
              {toName}
            </Text>{' '}
            <Text style={{ fontWeight: '700', color: colors.textPrimary }}>
              {amount}
            </Text>{' '}
            for {description}.
          </Text>

          {/* Receipt card */}
          <View
            style={[
              {
                marginTop: space.xl,
                backgroundColor: colors.bgSurface,
                borderRadius: radius.card,
                paddingHorizontal: space.base,
                paddingVertical: space.xs,
                borderWidth: 1,
                borderColor: colors.borderSubtle,
              },
              elevation.card,
            ]}
          >
            <ReceiptRow label="From" value={fromName} />
            <ReceiptRow label="To" value={toName} />
            <ReceiptRow label="Method" value={method} />
            <ReceiptRow label="Reference" value={reference} isLast />
          </View>
        </View>

        {/* Done CTA */}
        <Pressable
          onPress={handleDone}
          accessibilityRole="button"
          accessibilityLabel="Done"
          style={({ pressed }) => [
            {
              height: height.buttonLg,
              borderRadius: radius.button,
              backgroundColor: colors.sage,
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              opacity: pressed ? 0.9 : 1,
              transform: pressed ? [{ scale: 0.99 }] : undefined,
            },
          ]}
        >
          <Text
            style={[
              font.bodyStrong,
              { fontSize: 15.5, fontWeight: '700', color: colors.textInverse },
            ]}
          >
            Done
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
