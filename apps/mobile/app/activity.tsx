import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { IconChevronLeft } from '@tabler/icons-react-native';
import type { ActivityEntry } from '@commune/api';
import { colors, font, radius, space } from '@/constants/design';
import { EmptyState, Screen } from '@/components/primitives';
import { useActivityLog } from '@/hooks/use-activity';
import { useGroupStore } from '@/stores/group';
import { useAuthStore } from '@/stores/auth';
import { hapticLight } from '@/lib/haptics';

/* ============================================================================
 * Person avatar colours — seeded on user id so the same person is consistent.
 * ============================================================================ */

const PERSON_PALETTE: Array<{ bg: string; fg: string }> = [
  { bg: '#E4EDFD', fg: '#1A56DB' }, // people-blue
  { bg: '#F3E4D8', fg: '#8A593B' }, // warm beige
  { bg: '#ECE7F5', fg: '#6D5DC7' }, // lilac
];

function hashUserId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function getPersonColors(userId: string | null | undefined, isYou: boolean, isSystem: boolean) {
  if (isSystem) return { bg: colors.bgSubtle, fg: colors.textSecondary };
  if (isYou) return { bg: colors.sageSoft, fg: colors.sageInk };
  if (!userId) return PERSON_PALETTE[0]!;
  return PERSON_PALETTE[hashUserId(userId) % PERSON_PALETTE.length]!;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/* ============================================================================
 * Time helpers
 * ============================================================================ */

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

type DateBucket = 'Today' | 'Yesterday' | 'This week' | 'Earlier';

function getDateBucket(dateStr: string): DateBucket {
  const now = new Date();
  const date = new Date(dateStr);

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOfWeekWindow = startOfToday - 6 * 24 * 60 * 60 * 1000;

  const t = date.getTime();
  if (t >= startOfToday) return 'Today';
  if (t >= startOfYesterday) return 'Yesterday';
  if (t >= startOfWeekWindow) return 'This week';
  return 'Earlier';
}

const BUCKET_ORDER: DateBucket[] = ['Today', 'Yesterday', 'This week', 'Earlier'];

/* ============================================================================
 * Amount / currency helpers
 * ============================================================================ */

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: '£',
  USD: '$',
  EUR: '€',
};

function formatAmount(amount: unknown, currency: unknown): string | null {
  if (amount === null || amount === undefined || amount === '') return null;
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(n)) return null;
  const symbol = typeof currency === 'string' ? CURRENCY_SYMBOLS[currency] ?? currency : '';
  return `${symbol}${n.toFixed(2)}`;
}

/* ============================================================================
 * Describe entry — turns an ActivityEntry into a humanised row.
 * ============================================================================ */

type EntryTone = 'owe' | 'owed' | 'settled';

interface DescribedEntry {
  title: ReactNode;
  caption: string;
  tone?: EntryTone;
  trailingLabel?: string;
  isSystem: boolean;
}

function Bold({ children }: { children: ReactNode }) {
  return <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{children}</Text>;
}

function actorLabel(entry: ActivityEntry, currentUserId: string | null): string {
  if (currentUserId && entry.user_id === currentUserId) return 'You';
  return entry.user?.name ?? 'Someone';
}

function describeEntry(entry: ActivityEntry, currentUserId: string | null): DescribedEntry {
  const meta = entry.metadata as Record<string, unknown>;
  const actor = actorLabel(entry, currentUserId);
  const isSystem = !entry.user_id || entry.action.startsWith('recurring_') || entry.action.startsWith('system_');
  const relTime = formatRelativeTime(entry.created_at);

  const title = (noun: ReactNode, prefix: string = actor, suffix?: string): ReactNode => (
    <Text style={{ fontSize: 15, lineHeight: 22, color: colors.textPrimary }}>
      {prefix}
      {prefix ? ' ' : ''}
      {noun}
      {suffix ? ` ${suffix}` : ''}
    </Text>
  );

  const amountStr = formatAmount(meta.amount, meta.currency);

  switch (entry.action) {
    case 'expense_created': {
      const name = String(meta.title ?? 'an expense');
      return {
        title: title(<>added <Bold>{name}</Bold></>),
        caption: amountStr ? `${amountStr} · ${relTime}` : relTime,
        isSystem: false,
      };
    }
    case 'expense_updated': {
      const name = String(meta.title ?? 'an expense');
      return {
        title: title(<>updated <Bold>{name}</Bold></>),
        caption: relTime,
        isSystem: false,
      };
    }
    case 'expense_deleted': {
      const name = String(meta.title ?? 'an expense');
      return {
        title: title(<>archived <Bold>{name}</Bold></>),
        caption: relTime,
        isSystem: false,
      };
    }
    case 'payment_marked': {
      const name = String(meta.expense_title ?? 'an expense');
      return {
        title: title(<>paid <Bold>{name}</Bold></>),
        caption: amountStr ? `${amountStr} · ${relTime}` : relTime,
        tone: 'settled',
        trailingLabel: 'Pending',
        isSystem: false,
      };
    }
    case 'payment_confirmed': {
      const name = String(meta.expense_title ?? 'an expense');
      return {
        title: title(<>confirmed <Bold>{name}</Bold></>),
        caption: amountStr ? `${amountStr} · ${relTime}` : relTime,
        tone: 'settled',
        trailingLabel: 'Settled',
        isSystem: false,
      };
    }
    case 'member_invited': {
      const who = String(meta.member_name ?? 'a new member');
      return {
        title: title(<>invited <Bold>{who}</Bold></>),
        caption: relTime,
        isSystem: false,
      };
    }
    case 'member_joined': {
      const who = String(meta.member_name ?? (actor === 'You' ? 'You' : actor));
      const prefix = who === 'You' ? 'You' : who;
      return {
        title: (
          <Text style={{ fontSize: 15, lineHeight: 22, color: colors.textPrimary }}>
            <Bold>{prefix}</Bold> joined the group
          </Text>
        ),
        caption: relTime,
        isSystem: false,
      };
    }
    case 'member_left': {
      const who = String(meta.member_name ?? actor);
      return {
        title: (
          <Text style={{ fontSize: 15, lineHeight: 22, color: colors.textPrimary }}>
            <Bold>{who}</Bold> left the group
          </Text>
        ),
        caption: relTime,
        isSystem: false,
      };
    }
    case 'member_removed': {
      const who = String(meta.member_name ?? 'a member');
      return {
        title: title(<>removed <Bold>{who}</Bold></>),
        caption: relTime,
        isSystem: false,
      };
    }
    case 'group_updated':
      return {
        title: title(<>updated <Bold>group settings</Bold></>),
        caption: relTime,
        isSystem: false,
      };
    case 'ownership_transferred': {
      const who = String(meta.new_owner_name ?? 'another member');
      return {
        title: title(<>transferred ownership to <Bold>{who}</Bold></>),
        caption: relTime,
        isSystem: false,
      };
    }
    case 'chore_completed':
    case 'complete_chore': {
      const name = String(meta.chore_title ?? meta.title ?? 'a chore');
      return {
        title: title(<>completed <Bold>{name}</Bold></>),
        caption: relTime,
        tone: 'settled',
        isSystem: false,
      };
    }
    case 'recurring_generated':
    case 'system_recurring_generated':
      return {
        title: (
          <Text style={{ fontSize: 15, lineHeight: 22, color: colors.textPrimary }}>
            System generated <Bold>recurring bills</Bold>
          </Text>
        ),
        caption: relTime,
        isSystem: true,
      };
    default: {
      const humanAction = entry.action.replace(/_/g, ' ');
      return {
        title: title(<Bold>{humanAction}</Bold>),
        caption: relTime,
        isSystem,
      };
    }
  }
}

/* ============================================================================
 * Components
 * ============================================================================ */

function SegmentedControl({
  value,
  onChange,
}: {
  value: 'all' | 'you';
  onChange: (v: 'all' | 'you') => void;
}) {
  const pills: Array<{ key: 'all' | 'you'; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'you', label: 'Just you' },
  ];
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: '#F3F1EC',
        borderRadius: 12,
        padding: 4,
        alignSelf: 'stretch',
      }}
    >
      {pills.map((p) => {
        const active = p.key === value;
        return (
          <Pressable
            key={p.key}
            onPress={() => {
              hapticLight();
              onChange(p.key);
            }}
            style={{
              flex: 1,
              paddingVertical: 8,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              backgroundColor: active ? colors.bgSurface : 'transparent',
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: active ? colors.textPrimary : colors.textMuted,
              }}
            >
              {p.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SectionLabel({ title }: { title: string }) {
  return (
    <Text
      style={{
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        color: colors.textMuted,
        marginTop: space.lg,
        marginBottom: space.sm,
      }}
    >
      {title}
    </Text>
  );
}

function ActivityRow({
  entry,
  currentUserId,
}: {
  entry: ActivityEntry;
  currentUserId: string | null;
}) {
  const described = describeEntry(entry, currentUserId);
  const isYou = !!currentUserId && entry.user_id === currentUserId;
  const isSystem = described.isSystem;
  const avatar = getPersonColors(entry.user_id, isYou, isSystem);
  const initials = isSystem ? '•' : getInitials(entry.user?.name ?? (isYou ? 'You' : undefined));

  const toneColor =
    described.tone === 'owe'
      ? colors.oweText
      : described.tone === 'owed'
      ? colors.owedText
      : described.tone === 'settled'
      ? colors.settledText
      : undefined;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bgSurface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        padding: space.md,
        marginBottom: space.sm,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: avatar.bg,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: space.md,
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: '700', color: avatar.fg }}>{initials}</Text>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        {described.title}
        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }} numberOfLines={1}>
          {described.caption}
        </Text>
      </View>

      {described.trailingLabel ? (
        <Text
          style={{
            marginLeft: space.sm,
            fontSize: 12,
            fontWeight: '600',
            color: toneColor ?? colors.textMuted,
          }}
        >
          {described.trailingLabel}
        </Text>
      ) : null}
    </View>
  );
}

/* ============================================================================
 * Screen
 * ============================================================================ */

export default function ActivityScreen() {
  const router = useRouter();
  const activeGroupId = useGroupStore((s) => s.activeGroupId);
  const currentUser = useAuthStore((s) => s.user);
  const currentUserId = currentUser?.id ?? null;

  const [segment, setSegment] = useState<'all' | 'you'>('all');

  const { data: entries = [], isLoading } = useActivityLog(activeGroupId ?? '', 100);

  const filtered = useMemo(() => {
    if (segment === 'you' && currentUserId) {
      return entries.filter((e) => e.user_id === currentUserId);
    }
    return entries;
  }, [entries, segment, currentUserId]);

  const grouped = useMemo(() => {
    const buckets: Record<DateBucket, ActivityEntry[]> = {
      Today: [],
      Yesterday: [],
      'This week': [],
      Earlier: [],
    };
    for (const entry of filtered) {
      buckets[getDateBucket(entry.created_at)].push(entry);
    }
    return BUCKET_ORDER.filter((b) => buckets[b].length > 0).map((b) => ({
      title: b,
      data: buckets[b],
    }));
  }, [filtered]);

  return (
    <Screen>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: space.gutter,
          paddingTop: 8,
          paddingBottom: space.sm,
          height: 52,
        }}
      >
        <Pressable
          onPress={() => {
            hapticLight();
            router.back();
          }}
          hitSlop={12}
          style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
        >
          <IconChevronLeft size={24} strokeWidth={2} color={colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[font.h3, { color: colors.textPrimary }]}>Activity</Text>
        </View>
        <View style={{ width: 44, alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textTertiary }}>Filter</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: 120,
          paddingHorizontal: space.gutter,
        }}
        showsVerticalScrollIndicator={false}
      >
        <SegmentedControl value={segment} onChange={setSegment} />

        {isLoading ? (
          <View style={{ paddingTop: space.xl }}>
            {[1, 2, 3].map((i) => (
              <View
                key={i}
                style={{
                  height: 60,
                  borderRadius: 14,
                  backgroundColor: colors.bgSubtle,
                  marginBottom: space.sm,
                  opacity: 0.6,
                }}
              />
            ))}
          </View>
        ) : grouped.length === 0 ? (
          <EmptyState
            icon="pulse-outline"
            title="Nothing happening yet"
            description="Activity from you and the group will show up here."
          />
        ) : (
          grouped.map((section) => (
            <View key={section.title}>
              <SectionLabel title={section.title} />
              {section.data.map((entry) => (
                <ActivityRow key={entry.id} entry={entry} currentUserId={currentUserId} />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
