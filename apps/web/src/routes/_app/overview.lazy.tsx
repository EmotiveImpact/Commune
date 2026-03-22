import { createLazyFileRoute } from '@tanstack/react-router';
import {
  Badge,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconArrowRight,
  IconArrowsExchange,
  IconCash,
  IconExternalLink,
} from '@tabler/icons-react';
import { useEffect } from 'react';
import { formatCurrency } from '@commune/utils';
import { setPageTitle } from '../../utils/seo';
import { useAuthStore } from '../../stores/auth';
import { useCrossGroupSettlements } from '../../hooks/use-cross-group';
import { PageHeader } from '../../components/page-header';
import { EmptyState } from '../../components/empty-state';
import { PageLoader } from '../../components/page-loader';

export const Route = createLazyFileRoute('/_app/overview')({
  component: CrossGroupOverviewPage,
});

function CrossGroupOverviewPage() {
  useEffect(() => {
    setPageTitle('Cross-Group Overview');
  }, []);

  const { user } = useAuthStore();
  const { data: result, isLoading } = useCrossGroupSettlements(user?.id ?? '');

  if (isLoading) {
    return <PageLoader />;
  }

  if (!result || result.isSettled) {
    return (
      <Stack gap="lg">
        <PageHeader
          title="Cross-Group Overview"
          subtitle="Your netted balances across all groups"
        />
        <EmptyState
          icon={IconArrowsExchange}
          iconColor="emerald"
          title="All settled up!"
          description="You have no outstanding debts across any of your groups. When debts exist in multiple groups, they will be netted here to minimise transfers."
        />
      </Stack>
    );
  }

  // Separate into what you owe vs what others owe you
  const youOwe = result.transactions.filter((tx) => tx.fromUserId === user?.id);
  const owedToYou = result.transactions.filter((tx) => tx.toUserId === user?.id);
  const otherTransactions = result.transactions.filter(
    (tx) => tx.fromUserId !== user?.id && tx.toUserId !== user?.id,
  );

  return (
    <Stack gap="lg">
      <PageHeader
        title="Cross-Group Overview"
        subtitle="Your netted balances across all groups"
      />

      {/* Summary cards */}
      <Group gap="lg">
        <Paper className="commune-stat-card commune-kpi-card" p="lg" data-tone="peach" style={{ flex: 1 }}>
          <Text size="sm" c="dimmed">You owe (total)</Text>
          <Text fw={800} size="1.5rem">
            {youOwe.length > 0
              ? youOwe.map((tx) => formatCurrency(tx.netAmount, tx.currency)).join(' + ')
              : formatCurrency(0)
            }
          </Text>
          <Text size="xs" c="dimmed">
            {youOwe.length} payment{youOwe.length !== 1 ? 's' : ''} to make
          </Text>
        </Paper>

        <Paper className="commune-stat-card commune-kpi-card" p="lg" data-tone="sage" style={{ flex: 1 }}>
          <Text size="sm" c="dimmed">Owed to you (total)</Text>
          <Text fw={800} size="1.5rem">
            {owedToYou.length > 0
              ? owedToYou.map((tx) => formatCurrency(tx.netAmount, tx.currency)).join(' + ')
              : formatCurrency(0)
            }
          </Text>
          <Text size="xs" c="dimmed">
            {owedToYou.length} payment{owedToYou.length !== 1 ? 's' : ''} incoming
          </Text>
        </Paper>
      </Group>

      {/* You owe */}
      {youOwe.length > 0 && (
        <Paper className="commune-soft-panel" p="xl">
          <Text className="commune-section-heading" mb="xs">You owe</Text>
          <Text size="sm" c="dimmed" mb="lg">
            These debts have been netted across groups. One transfer per person settles everything.
          </Text>
          <Stack gap="sm">
            {youOwe.map((tx) => (
              <Paper key={`${tx.toUserId}-${tx.currency}`} className="commune-stat-card" p="md" radius="lg">
                <Group justify="space-between" align="center">
                  <Stack gap={4}>
                    <Group gap="xs">
                      <IconArrowRight size={16} color="var(--mantine-color-red-6)" />
                      <Text fw={600}>{tx.toName}</Text>
                    </Group>
                    <Group gap={4}>
                      {tx.groups.map((g) => (
                        <Badge key={g} size="xs" variant="light" color="gray">{g}</Badge>
                      ))}
                    </Group>
                  </Stack>

                  <Group gap="sm">
                    <Text fw={700} size="lg" c="red">
                      {formatCurrency(tx.netAmount, tx.currency)}
                    </Text>
                    {tx.paymentLink && (
                      <Tooltip label={`Pay via ${tx.paymentProvider ?? 'link'}`}>
                        <Button
                          component="a"
                          href={tx.paymentLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          size="xs"
                          variant="light"
                          leftSection={<IconExternalLink size={14} />}
                        >
                          Pay
                        </Button>
                      </Tooltip>
                    )}
                  </Group>
                </Group>
              </Paper>
            ))}
          </Stack>
        </Paper>
      )}

      {/* Owed to you */}
      {owedToYou.length > 0 && (
        <Paper className="commune-soft-panel" p="xl">
          <Text className="commune-section-heading" mb="xs">Owed to you</Text>
          <Text size="sm" c="dimmed" mb="lg">
            People who owe you money across your groups.
          </Text>
          <Stack gap="sm">
            {owedToYou.map((tx) => (
              <Paper key={`${tx.fromUserId}-${tx.currency}`} className="commune-stat-card" p="md" radius="lg">
                <Group justify="space-between" align="center">
                  <Stack gap={4}>
                    <Group gap="xs">
                      <ThemeIcon size={20} variant="light" color="green" radius="xl">
                        <IconCash size={12} />
                      </ThemeIcon>
                      <Text fw={600}>{tx.fromName}</Text>
                    </Group>
                    <Group gap={4}>
                      {tx.groups.map((g) => (
                        <Badge key={g} size="xs" variant="light" color="gray">{g}</Badge>
                      ))}
                    </Group>
                  </Stack>
                  <Text fw={700} size="lg" c="green">
                    {formatCurrency(tx.netAmount, tx.currency)}
                  </Text>
                </Group>
              </Paper>
            ))}
          </Stack>
        </Paper>
      )}

      {/* Other transactions (not involving the current user) */}
      {otherTransactions.length > 0 && (
        <Paper className="commune-soft-panel" p="xl">
          <Text className="commune-section-heading" mb="xs">Other balances</Text>
          <Text size="sm" c="dimmed" mb="lg">
            Cross-group debts between other members in your groups.
          </Text>
          <Stack gap="sm">
            {otherTransactions.map((tx) => (
              <Paper key={`${tx.fromUserId}-${tx.toUserId}-${tx.currency}`} className="commune-stat-card" p="md" radius="lg">
                <Group justify="space-between" align="center">
                  <Stack gap={4}>
                    <Text size="sm">
                      <Text span fw={600}>{tx.fromName}</Text>
                      {' owes '}
                      <Text span fw={600}>{tx.toName}</Text>
                    </Text>
                    <Group gap={4}>
                      {tx.groups.map((g) => (
                        <Badge key={g} size="xs" variant="light" color="gray">{g}</Badge>
                      ))}
                    </Group>
                  </Stack>
                  <Text fw={600} c="dimmed">
                    {formatCurrency(tx.netAmount, tx.currency)}
                  </Text>
                </Group>
              </Paper>
            ))}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
