import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconChevronLeft, IconPlus } from '@tabler/icons-react-native';
import { EmptyState, IconTile, Screen } from '@/components/primitives';
import { colors, font, radius, space, getCategoryMeta } from '@/constants/design';
import { useGroupStore } from '@/stores/group';
import { useTemplates } from '@/hooks/use-templates';
import { hapticLight, hapticMedium } from '@/lib/haptics';

const SPLIT_METHOD_LABELS: Record<string, string> = {
  equal: 'Equal',
  percentage: 'Percentage',
  custom: 'Custom',
};

/**
 * Templates screen — saved split templates a user can reuse in the new-expense flow.
 *
 * Template entry shape (`SplitTemplate` in packages/types): id, group_id, name,
 * split_method, participants[], created_by, created_at. There is NO amount /
 * currency / frequency on the entry, so the row caption falls back to split-method
 * + participant count (preserving previous behavior).
 */

export default function TemplatesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const activeGroupId = useGroupStore((s) => s.activeGroupId);
  const { data: templates, isLoading } = useTemplates(activeGroupId ?? '');

  const list = templates ?? [];
  const count = list.length;

  const handleBack = () => {
    hapticLight();
    if (router.canGoBack()) router.back();
  };

  const handleNew = () => {
    hapticMedium();
    // New-template creation currently lives on the web app; the button is a
    // discoverable entry point for the mobile flow. Route to new-expense for now.
    router.push('/expenses/new');
  };

  const handleUse = (templateId: string) => {
    hapticMedium();
    router.push(`/expenses/new?template=${templateId}` as never);
  };

  const handleLearn = () => {
    // No-op placeholder; hooked up when docs/onboarding for templates ships.
  };

  const header = (
    <View
      style={{
        paddingTop: insets.top + space.sm,
        paddingBottom: space.md,
        paddingHorizontal: space.gutter,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bgBase,
      }}
    >
      <TouchableOpacity
        onPress={handleBack}
        hitSlop={12}
        activeOpacity={0.7}
        style={{ width: 32, height: 32, alignItems: 'flex-start', justifyContent: 'center' }}
      >
        <IconChevronLeft size={24} color={colors.textPrimary} strokeWidth={2} />
      </TouchableOpacity>
      <Text
        style={{
          flex: 1,
          textAlign: 'center',
          fontSize: 20,
          fontWeight: '700',
          color: colors.textPrimary,
          letterSpacing: -0.2,
        }}
      >
        Templates
      </Text>
      <TouchableOpacity
        onPress={handleNew}
        hitSlop={12}
        activeOpacity={0.7}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
          minWidth: 32,
          justifyContent: 'flex-end',
        }}
      >
        <IconPlus size={14} color={colors.sageInk} strokeWidth={2.5} />
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.sageInk, letterSpacing: 0.2 }}>
          New
        </Text>
      </TouchableOpacity>
    </View>
  );

  /* ---------------------------------------------------------------- No group */

  if (!activeGroupId) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        {header}
        <EmptyState
          icon="people-outline"
          title="Select a group first"
          description="Choose a group to see its saved templates."
        />
      </Screen>
    );
  }

  const empty = !isLoading && count === 0;

  /* ---------------------------------------------------------------- Render */

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      {header}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: space.md,
          paddingBottom: 120,
          paddingHorizontal: space.gutter,
          gap: space.base,
        }}
        showsVerticalScrollIndicator={false}
      >
        {empty ? (
          <EmptyState
            icon="copy-outline"
            title="No templates yet"
            description="Save an expense as a template to quickly reuse it later."
            actionLabel="Learn how"
            onAction={handleLearn}
          />
        ) : (
          <>
            {/* Dark-ink hero (compact) */}
            <View
              style={{
                backgroundColor: colors.bgInk,
                borderRadius: radius.hero,
                paddingVertical: space.lg,
                paddingHorizontal: space.xl,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  letterSpacing: 0.8,
                  color: 'rgba(255,255,255,0.55)',
                  textTransform: 'uppercase',
                }}
              >
                Saved templates
              </Text>
              <Text
                style={{
                  marginTop: space.xs,
                  fontSize: 28,
                  fontWeight: '700',
                  lineHeight: 34,
                  letterSpacing: -0.3,
                  color: colors.textInverse,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {count} {count === 1 ? 'template' : 'templates'}
              </Text>
              <Text
                style={{
                  marginTop: space.xs,
                  fontSize: 13,
                  lineHeight: 18,
                  color: 'rgba(255,255,255,0.75)',
                }}
              >
                Tap any template to quickly add the expense
              </Text>
            </View>

            {/* Rows */}
            {list.map((template) => {
              // Category isn't on SplitTemplate today — fall back to miscellaneous.
              const categoryKey =
                (template as unknown as { category?: string }).category ?? 'miscellaneous';
              const meta = getCategoryMeta(categoryKey);
              const methodLabel =
                SPLIT_METHOD_LABELS[template.split_method] ?? template.split_method;
              const members = template.participants?.length ?? 0;
              const caption = `${methodLabel} · ${members} ${members === 1 ? 'member' : 'members'}`;

              return (
                <TouchableOpacity
                  key={template.id}
                  onPress={() => handleUse(template.id)}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.md,
                    backgroundColor: colors.bgSurface,
                    borderRadius: 14,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: colors.borderSubtle,
                  }}
                >
                  <IconTile
                    icon={meta.icon as never}
                    color={meta.color}
                    bg={meta.bg}
                    size={40}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}
                      numberOfLines={1}
                    >
                      {template.name}
                    </Text>
                    <Text
                      style={{ marginTop: 2, fontSize: 12, color: colors.textMuted }}
                      numberOfLines={1}
                    >
                      {caption}
                    </Text>
                  </View>
                  <View
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      backgroundColor: colors.sageSoft,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: colors.sageInk,
                        letterSpacing: 0.2,
                      }}
                    >
                      Use
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
