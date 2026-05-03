import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@/stores/theme';
import { useGroupStore } from '@/stores/group';
import { useTemplates } from '@/hooks/use-templates';

const SPLIT_METHOD_LABELS: Record<string, string> = {
  equal: 'Equal',
  percentage: 'Percentage',
  custom: 'Custom',
};

export default function TemplatesScreen() {
  const router = useRouter();
  const isDark = useThemeStore((s) => s.mode) === 'dark';
  const activeGroupId = useGroupStore((s) => s.activeGroupId);
  const { data: templates, isLoading } = useTemplates(activeGroupId ?? '');

  const bg = isDark ? '#0A0A0A' : '#FAFAFA';
  const surface = isDark ? '#18181B' : '#FFFFFF';
  const text = isDark ? '#FAFAFA' : '#171b24';
  const textSoft = isDark ? '#A1A1AA' : '#667085';
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(23,27,36,0.10)';
  const accent = '#2d6a4f';

  if (!activeGroupId) {
    return (
      <View style={{ flex: 1, backgroundColor: bg, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
        <Ionicons name="copy-outline" size={48} color={textSoft} />
        <Text style={{ fontSize: 16, fontWeight: '600', color: text, marginTop: 16 }}>Select a group first</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }}>
      <View style={{ padding: 20, gap: 16 }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: text }}>Split Templates</Text>
        <Text style={{ fontSize: 13, color: textSoft }}>
          Saved split configurations you can apply when adding expenses.
        </Text>

        {isLoading && (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Text style={{ color: textSoft }}>Loading...</Text>
          </View>
        )}

        {!isLoading && (!templates || templates.length === 0) && (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Ionicons name="copy-outline" size={40} color={textSoft} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: text, marginTop: 12 }}>No templates yet</Text>
            <Text style={{ fontSize: 13, color: textSoft, marginTop: 4, textAlign: 'center' }}>
              Create templates on the web app to save common split patterns.
            </Text>
          </View>
        )}

        {(templates ?? []).map((template: any) => (
          <TouchableOpacity
            key={template.id}
            onPress={() => router.push('/expenses/new')}
            activeOpacity={0.7}
            style={{
              backgroundColor: surface,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: border,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <View style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: isDark ? '#1f2330' : '#e8f0eb',
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 14,
            }}>
              <Ionicons name="copy-outline" size={20} color={accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: text }}>{template.name}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <View style={{ backgroundColor: 'rgba(45,106,79,0.12)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: accent }}>
                    {SPLIT_METHOD_LABELS[template.split_method] ?? template.split_method}
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: textSoft }}>
                  {template.participants?.length ?? 0} members
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={textSoft} />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}
