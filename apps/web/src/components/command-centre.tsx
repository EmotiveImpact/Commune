import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import {
  Badge,
  Button,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import {
  IconArrowRight,
  IconBriefcase,
  IconCash,
  IconCheck,
  IconHeart,
  IconHome,
  IconMapPin,
  IconPlane,
  IconPlus,
  IconUsers,
  IconUsersGroup,
  IconWallet,
} from '@tabler/icons-react';
import { formatCurrency } from '@commune/utils';
import type { UserGroupSummary } from '@commune/api';
import type { CrossGroupGroupSummary } from '@commune/types';
import { useAuthStore } from '../stores/auth';
import { useGroupStore } from '../stores/group';
import { useCrossGroupOverview } from '../hooks/use-cross-group';
import { ContentSkeleton } from './page-skeleton';
import { QueryErrorState } from './query-error-state';

/* -------------------------------------------------------------------------- */
/*  Group-type visuals (compact — mirrors the group hub's map)                */
/* -------------------------------------------------------------------------- */

const GROUP_VISUALS: Record<
  string,
  { icon: typeof IconHome; gradient: string }
> = {
  home: { icon: IconHome, gradient: 'linear-gradient(135deg,#d7e6dd,#e8f0eb)' },
  couple: { icon: IconHeart, gradient: 'linear-gradient(135deg,#f2d0e9,#f5e0f0)' },
  workspace: { icon: IconBriefcase, gradient: 'linear-gradient(135deg,#d0e8f2,#e0f0f7)' },
  project: { icon: IconUsersGroup, gradient: 'linear-gradient(135deg,#f1e5bf,#f5edda)' },
  trip: { icon: IconPlane, gradient: 'linear-gradient(135deg,#fde2d4,#fdeee6)' },
  other: { icon: IconMapPin, gradient: 'linear-gradient(135deg,#e8e1ef,#f0ecf3)' },
};

function visualFor(type: string) {
  return GROUP_VISUALS[type] ?? GROUP_VISUALS.other!;
}

function greetingFor(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Sum amounts grouped by currency, returning the dominant currency + total. */
function dominantTotal(
  summaries: CrossGroupGroupSummary[],
  pick: (s: CrossGroupGroupSummary) => number,
): { currency: string; total: number; otherCurrencies: number } {
  const byCurrency = new Map<string, { total: number; groups: number }>();
  for (const s of summaries) {
    const amount = pick(s);
    if (amount <= 0) continue;
    const entry = byCurrency.get(s.currency) ?? { total: 0, groups: 0 };
    entry.total += amount;
    entry.groups += 1;
    byCurrency.set(s.currency, entry);
  }
  if (byCurrency.size === 0) {
    return { currency: 'GBP', total: 0, otherCurrencies: 0 };
  }
  const sorted = [...byCurrency.entries()].sort((a, b) => b[1].groups - a[1].groups);
  const [currency, entry] = sorted[0]!;
  return { currency, total: entry.total, otherCurrencies: sorted.length - 1 };
}

/* -------------------------------------------------------------------------- */
/*  Command Centre — the home for users in 2+ groups                          */
/* -------------------------------------------------------------------------- */

export function CommandCentre({ groups }: { groups: UserGroupSummary[] }) {
  const { user } = useAuthStore();
  const { setActiveGroupId } = useGroupStore();
  const {
    data: overview,
    isLoading,
    isError,
    error,
    refetch,
  } = useCrossGroupOverview(user?.id ?? '');

  const firstName = useMemo(() => {
    const fromProfile = (user as { first_name?: string } | null)?.first_name;
    if (fromProfile) return fromProfile;
    const fromName = (user as { name?: string } | null)?.name;
    return fromName?.split(' ')[0] ?? 'there';
  }, [user]);

  // Merge identity (from group list) with financial rollups (from overview).
  const summaryById = useMemo(() => {
    const map = new Map<string, CrossGroupGroupSummary>();
    for (const s of overview?.groupSummaries ?? []) map.set(s.groupId, s);
    return map;
  }, [overview]);

  const owe = useMemo(
    () => dominantTotal(overview?.groupSummaries ?? [], (s) => s.owesAmount),
    [overview],
  );
  const owed = useMemo(
    () => dominantTotal(overview?.groupSummaries ?? [], (s) => s.owedAmount),
    [overview],
  );

  const groupsNeedingAttention = useMemo(
    () =>
      (overview?.groupSummaries ?? []).filter(
        (s) => s.owesAmount > 0 || s.waitingCount > 0,
      ).length,
    [overview],
  );

  if (isLoading) return <ContentSkeleton />;

  if (isError) {
    return (
      <QueryErrorState
        title="Couldn't load your groups"
        error={error}
        onRetry={() => {
          void refetch();
        }}
        icon={IconUsers}
      />
    );
  }

  const transactions = overview?.transactions ?? [];
  const youPay = transactions.filter((t) => t.fromUserId === user?.id);

  const oweLabel =
    owe.total > 0
      ? `You owe ${formatCurrency(owe.total, owe.currency)}${owe.otherCurrencies > 0 ? ' +' : ''} across ${groupsNeedingAttention} group${groupsNeedingAttention === 1 ? '' : 's'}`
      : "You're all settled across every group";

  return (
    <Stack gap="xl" className="commune-page-stack">
      {/* Greeting */}
      <div>
        <Text className="commune-page-title">
          {greetingFor(new Date().getHours())}, {firstName}
        </Text>
        <Text size="sm" c="dimmed" mt={4}>
          {oweLabel}
          {youPay.length > 0
            ? ` · ${youPay.length} payment${youPay.length === 1 ? '' : 's'} to make`
            : ''}
        </Text>
      </div>

      {/* KPI row */}
      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
        <Paper className="commune-kpi-card" data-tone="peach" p="md">
          <Group justify="space-between" align="flex-start">
            <div>
              <Text size="sm" c="dimmed">You owe</Text>
              <Text className="commune-metric-value">
                {formatCurrency(owe.total, owe.currency)}
              </Text>
              <Text size="xs" c="dimmed">
                {owe.otherCurrencies > 0
                  ? `+ ${owe.otherCurrencies} other currency`
                  : owe.total > 0
                    ? `across ${groupsNeedingAttention} group${groupsNeedingAttention === 1 ? '' : 's'}`
                    : 'nothing outstanding'}
              </Text>
            </div>
            <IconWallet size={20} style={{ color: 'var(--commune-ink-soft)', opacity: 0.5 }} />
          </Group>
        </Paper>

        <Paper className="commune-kpi-card" data-tone="sage" p="md">
          <Group justify="space-between" align="flex-start">
            <div>
              <Text size="sm" c="dimmed">Owed to you</Text>
              <Text className="commune-metric-value">
                {formatCurrency(owed.total, owed.currency)}
              </Text>
              <Text size="xs" c="dimmed">
                {owed.total > 0 ? 'people owe you' : 'nothing pending'}
              </Text>
            </div>
            <IconCash size={20} style={{ color: 'var(--commune-ink-soft)', opacity: 0.5 }} />
          </Group>
        </Paper>

        <Paper className="commune-kpi-card" data-tone="lilac" p="md">
          <Group justify="space-between" align="flex-start">
            <div>
              <Text size="sm" c="dimmed">Active groups</Text>
              <Text className="commune-metric-value">{groups.length}</Text>
              <Text size="xs" c="dimmed">you're a member of</Text>
            </div>
            <IconUsersGroup size={20} style={{ color: 'var(--commune-ink-soft)', opacity: 0.5 }} />
          </Group>
        </Paper>

        <Paper className="commune-kpi-card" data-tone="gold" p="md">
          <Group justify="space-between" align="flex-start">
            <div>
              <Text size="sm" c="dimmed">Need attention</Text>
              <Text className="commune-metric-value">{groupsNeedingAttention}</Text>
              <Text size="xs" c="dimmed">
                {groupsNeedingAttention === 0 ? 'all calm' : 'groups to review'}
              </Text>
            </div>
            <IconArrowRight size={20} style={{ color: 'var(--commune-ink-soft)', opacity: 0.5 }} />
          </Group>
        </Paper>
      </SimpleGrid>

      <div className="commune-dashboard-grid">
        {/* LEFT — what needs you */}
        <Stack gap="md">
          <Paper className="commune-soft-panel" p="lg">
            <Group justify="space-between" mb="sm">
              <Text className="commune-section-heading">What needs you</Text>
              {transactions.length > 0 && (
                <Button
                  component={Link}
                  to="/overview"
                  variant="subtle"
                  size="xs"
                  rightSection={<IconArrowRight size={14} />}
                >
                  Balances
                </Button>
              )}
            </Group>

            {youPay.length === 0 ? (
              <Stack align="center" gap="xs" py="lg">
                <ThemeIcon size={44} radius="xl" variant="light" color="green">
                  <IconCheck size={24} />
                </ThemeIcon>
                <Text fw={600}>You're all settled</Text>
                <Text size="sm" c="dimmed" ta="center">
                  Nothing to pay across your groups right now.
                </Text>
              </Stack>
            ) : (
              <Stack gap={0}>
                {youPay.map((t, i) => (
                  <Group
                    key={`${t.toUserId}-${i}`}
                    justify="space-between"
                    wrap="nowrap"
                    py="sm"
                    style={{
                      borderBottom:
                        i < youPay.length - 1
                          ? '1px solid rgba(22,19,29,0.06)'
                          : undefined,
                    }}
                  >
                    <Group gap="sm" wrap="nowrap">
                      <ThemeIcon size={34} radius="md" variant="light" color="orange">
                        <IconWallet size={16} />
                      </ThemeIcon>
                      <div>
                        <Text size="sm" fw={600}>
                          Pay {t.toName} {formatCurrency(t.netAmount, t.currency)}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {t.groups.length === 1
                            ? t.groups[0]
                            : `across ${t.groups.length} groups`}
                        </Text>
                      </div>
                    </Group>
                    {t.paymentLink ? (
                      <Button
                        component="a"
                        href={t.paymentLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="xs"
                        variant="light"
                        color="orange"
                      >
                        Pay
                      </Button>
                    ) : (
                      <Badge variant="light" color="orange" radius="sm">
                        Settle
                      </Badge>
                    )}
                  </Group>
                ))}
              </Stack>
            )}
          </Paper>
        </Stack>

        {/* RIGHT — your groups */}
        <Stack gap="md">
          <Text className="commune-section-heading">Your groups</Text>
          <Stack gap="sm">
            {groups.map((g) => {
              const v = visualFor(g.type);
              const Icon = v.icon;
              const s = summaryById.get(g.id);
              const oweHere = s?.owesAmount ?? 0;
              const owedHere = s?.owedAmount ?? 0;
              return (
                <Paper
                  key={g.id}
                  component={Link}
                  to={`/groups/${g.id}`}
                  className="commune-group-card"
                  p="md"
                  radius="lg"
                  style={{ textDecoration: 'none' }}
                  onClick={() => setActiveGroupId(g.id)}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="sm" wrap="nowrap">
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          background: v.gradient,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Icon size={22} style={{ color: 'rgba(26,30,43,0.55)' }} />
                      </div>
                      <div>
                        <Text fw={700} size="sm">{g.name}</Text>
                        <Text size="xs" c="dimmed">
                          {g.active_member_count} member
                          {g.active_member_count === 1 ? '' : 's'}
                        </Text>
                      </div>
                    </Group>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {oweHere > 0 ? (
                        <Badge variant="light" color="orange" radius="sm">
                          Owe {formatCurrency(oweHere, g.currency)}
                        </Badge>
                      ) : owedHere > 0 ? (
                        <Badge variant="light" color="blue" radius="sm">
                          Owed {formatCurrency(owedHere, g.currency)}
                        </Badge>
                      ) : (
                        <Badge variant="dot" color="green" radius="sm">
                          Settled
                        </Badge>
                      )}
                    </div>
                  </Group>
                </Paper>
              );
            })}
          </Stack>
          <Button
            component={Link}
            to="/groups"
            variant="light"
            leftSection={<IconPlus size={16} />}
            fullWidth
          >
            New group
          </Button>
        </Stack>
      </div>
    </Stack>
  );
}
