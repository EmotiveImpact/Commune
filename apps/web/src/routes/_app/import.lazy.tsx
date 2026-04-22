import { createLazyFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  Alert,
  Badge,
  Button,
  Group,
  Paper,
  Progress,
  Select,
  Stack,
  Stepper,
  Table,
  Text,
  Title,
  useMantineTheme,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IconCheck,
  IconCloudUpload,
  IconFileSpreadsheet,
  IconX,
  IconAlertCircle,
  IconArrowLeft,
} from '@tabler/icons-react';
import {
  parseSplitwiseCSV,
  transformForImport,
} from '@commune/core';
import type {
  SplitwiseImportExpense,
  SplitwiseParseResult,
} from '@commune/core';
import { bulkCreateExpenses } from '@commune/api';
import { formatCurrency } from '@commune/utils';
import { setPageTitle } from '../../utils/seo';
import { useGroupStore } from '../../stores/group';
import { useGroup } from '../../hooks/use-groups';
import { useAuthStore } from '../../stores/auth';
import { useSubscription } from '../../hooks/use-subscriptions';
import { EmptyState } from '../../components/empty-state';
import { PageHeader } from '../../components/page-header';
import { QueryErrorState } from '../../components/query-error-state';
import { expenseKeys } from '../../hooks/use-expenses';
import { dashboardKeys } from '../../hooks/use-dashboard';
import { useQueryClient } from '@tanstack/react-query';

export const Route = createLazyFileRoute('/_app/import')({
  component: ImportPage,
});

const MAX_EXPENSES = 5000;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function ImportPage() {
  useEffect(() => {
    setPageTitle('Import from Splitwise');
  }, []);

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const theme = useMantineTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { activeGroupId } = useGroupStore();
  const {
    data: group,
    error: groupError,
    isError: isGroupError,
    refetch: refetchGroup,
  } = useGroup(activeGroupId ?? '');
  const { user } = useAuthStore();
  const { data: subscription } = useSubscription(user?.id ?? '');

  // ─── Wizard state ──────────────────────────────────────────────────────────
  const [active, setActive] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  // Step 1: File upload
  const [parseResult, setParseResult] = useState<SplitwiseParseResult | null>(null);
  const [fileName, setFileName] = useState<string>('');

  // Step 2: Member mapping
  const [mapping, setMapping] = useState<Record<string, string>>({});

  // Step 3/4: Preview + Import
  const [importExpenses, setImportExpenses] = useState<SplitwiseImportExpense[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{
    created: number;
    failed: number;
  } | null>(null);

  // ─── Plan check ────────────────────────────────────────────────────────────
  const isPro = useMemo(() => {
    if (!subscription) return false;
    const activeSub =
      subscription.status === 'active' ||
      (subscription.status === 'trialing' &&
        new Date(subscription.trial_ends_at) > new Date());
    return activeSub && (subscription.plan === 'pro' || subscription.plan === 'agency');
  }, [subscription]);

  // ─── Group members for mapping ─────────────────────────────────────────────
  const members = useMemo(
    () =>
      (group?.members ?? [])
        .filter((m) => m.status === 'active' && m.user)
        .map((m) => ({
          userId: m.user_id,
          name: m.user.name,
          email: m.user.email,
        })),
    [group],
  );

  const memberOptions = useMemo(
    () => members.map((m) => ({ value: m.userId, label: `${m.name} (${m.email})` })),
    [members],
  );

  // ─── Step 1: Process a CSV file ────────────────────────────────────────────
  const processFile = useCallback(
    (file: File) => {
      if (file.size > MAX_FILE_SIZE) {
        notifications.show({
          title: 'File too large',
          message: 'Please choose a CSV file under 10 MB.',
          color: 'red',
        });
        return;
      }

      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext !== 'csv' && !file.type.includes('csv') && file.type !== 'text/plain') {
        notifications.show({
          title: 'Invalid file type',
          message: 'Please upload a CSV file.',
          color: 'red',
        });
        return;
      }

      setFileName(file.name);

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (!text || text.trim().length === 0) {
          notifications.show({
            title: 'Empty file',
            message: 'The CSV file appears to be empty.',
            color: 'red',
          });
          return;
        }

        const result = parseSplitwiseCSV(text);

        if (result.expenses.length === 0 && result.errors.length > 0) {
          notifications.show({
            title: 'Could not parse CSV',
            message: result.errors[0]?.message ?? 'Unknown error',
            color: 'red',
          });
          return;
        }

        if (result.expenses.length > MAX_EXPENSES) {
          notifications.show({
            title: 'Too many expenses',
            message: `This file has ${result.expenses.length} expenses. Maximum is ${MAX_EXPENSES} per import.`,
            color: 'red',
          });
          return;
        }

        setParseResult(result);

        // Auto-match participants by email or name
        const autoMapping: Record<string, string> = {};
        for (const name of result.participantNames) {
          const normalised = name.toLowerCase().trim();
          const match = members.find(
            (m) =>
              m.email.toLowerCase() === normalised ||
              m.name.toLowerCase() === normalised,
          );
          if (match) {
            autoMapping[name] = match.userId;
          }
        }
        setMapping(autoMapping);

        // Move to step 2
        setActive(1);
      };

      reader.onerror = () => {
        notifications.show({
          title: 'File read error',
          message: 'Could not read the selected file.',
          color: 'red',
        });
      };

      reader.readAsText(file);
    },
    [members],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      e.target.value = '';
    },
    [processFile],
  );

  // ─── Step 2: Validate mapping ──────────────────────────────────────────────
  const allMapped = useMemo(() => {
    if (!parseResult) return false;
    return parseResult.participantNames.every((name) => !!mapping[name]);
  }, [parseResult, mapping]);

  const handleMappingConfirm = useCallback(() => {
    if (!parseResult || !allMapped) return;

    const nameToUserId = new Map<string, string>();
    for (const [name, userId] of Object.entries(mapping)) {
      nameToUserId.set(name, userId);
    }

    const { expenses, unmapped } = transformForImport(parseResult.expenses, nameToUserId);

    if (unmapped.length > 0) {
      notifications.show({
        title: 'Unmapped participants',
        message: `Some participants could not be mapped: ${unmapped.join(', ')}`,
        color: 'orange',
      });
    }

    if (expenses.length === 0) {
      notifications.show({
        title: 'No expenses to import',
        message: 'After mapping, no valid expenses remain.',
        color: 'red',
      });
      return;
    }

    setImportExpenses(expenses);
    setActive(2);
  }, [parseResult, mapping, allMapped]);

  // ─── Step 4: Execute import ────────────────────────────────────────────────
  const handleImport = useCallback(async () => {
    if (!activeGroupId || importExpenses.length === 0) return;

    setImporting(true);
    setImportProgress(0);
    setActive(3);

    try {
      const result = await bulkCreateExpenses({
        groupId: activeGroupId,
        expenses: importExpenses,
        onProgress: (completed, total) => {
          setImportProgress(Math.round((completed / total) * 100));
        },
      });

      setImportResult({ created: result.created, failed: result.failed });
      setImportProgress(100);

      // Invalidate expense and dashboard queries. Use the 3-element prefix so
      // *all* filtered list variants refetch — expenseKeys.list(groupId) would
      // append an `undefined` tuple and only match the unfiltered list.
      queryClient.invalidateQueries({ queryKey: expenseKeys.groupLists(activeGroupId) });
      queryClient.invalidateQueries({ queryKey: expenseKeys.groupLedger(activeGroupId) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });

      if (result.failed === 0) {
        notifications.show({
          title: 'Import complete',
          message: `${result.created} expenses imported successfully.`,
          color: 'green',
        });
      } else {
        notifications.show({
          title: 'Import finished with errors',
          message: `${result.created} imported, ${result.failed} failed.`,
          color: 'orange',
        });
      }
    } catch (err) {
      notifications.show({
        title: 'Import failed',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    } finally {
      setImporting(false);
    }
  }, [activeGroupId, importExpenses, queryClient]);

  if (!activeGroupId) {
    return (
      <EmptyState
        icon={IconFileSpreadsheet}
        title="Select a group first"
        description="Choose a group in the sidebar before importing expenses."
      />
    );
  }

  if (isGroupError) {
    return (
      <QueryErrorState
        title="Failed to load import settings"
        error={groupError}
        onRetry={() => {
          void refetchGroup();
        }}
        icon={IconFileSpreadsheet}
      />
    );
  }

  // ─── Guard: not Pro+ ──────────────────────────────────────────────────────
  if (!isPro) {
    return (
      <Stack gap="xl">
        <PageHeader
          title="Import from Splitwise"
          subtitle="Bring your expense history into Commune"
        />
        <Paper className="commune-soft-panel" p="xl">
          <Stack gap="md" align="center">
            <IconAlertCircle size={48} color={theme.colors.orange[6]} />
            <Title order={3}>Pro plan required</Title>
            <Text c="dimmed" ta="center" maw={400}>
              Importing from Splitwise is available on Pro and Agency plans.
              Upgrade to unlock this feature.
            </Text>
            <Button component={Link} to="/pricing">
              View plans
            </Button>
          </Stack>
        </Paper>
      </Stack>
    );
  }

  return (
    <Stack gap="xl">
      <PageHeader
        title="Import from Splitwise"
        subtitle="Upload a Splitwise CSV export to bring your expense history into Commune"
      >
        {active > 0 && active < 3 && (
          <Button
            variant="default"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => setActive((s) => Math.max(0, s - 1))}
          >
            Back
          </Button>
        )}
      </PageHeader>

      <Stepper
        active={active}
        onStepClick={(step) => {
          // Only allow going back, not forward
          if (step < active) setActive(step);
        }}
      >
        {/* ─── Step 1: Upload ─── */}
        <Stepper.Step label="Upload" description="Select CSV file">
          <Paper className="commune-soft-panel" p="xl" mt="lg">
            <Stack gap="lg">
              <Text size="sm" c="dimmed">
                Export your data from Splitwise (Settings &rarr; Export as CSV),
                then upload the file here.
              </Text>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                style={{ display: 'none' }}
                onChange={handleInputChange}
              />
              <Paper
                p="xl"
                radius="lg"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? '#2d6a4f' : 'var(--commune-border-strong)'}`,
                  backgroundColor: dragOver
                    ? 'rgba(45, 106, 79, 0.06)'
                    : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  textAlign: 'center',
                  minHeight: 180,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Stack align="center" gap="xs">
                  {dragOver ? (
                    <IconCloudUpload
                      size={48}
                      style={{ color: 'var(--commune-primary-strong)' }}
                      stroke={1.5}
                    />
                  ) : (
                    <IconFileSpreadsheet
                      size={48}
                      style={{ color: 'var(--commune-ink-soft)' }}
                      stroke={1.5}
                    />
                  )}
                  <Text fw={600} size="sm" style={{ color: dragOver ? 'var(--commune-primary-strong)' : undefined }}>
                    {dragOver
                      ? 'Drop to upload'
                      : 'Drag a Splitwise CSV here or click to browse'}
                  </Text>
                  <Text size="xs" c="dimmed">
                    CSV files up to 10 MB
                  </Text>
                </Stack>
              </Paper>

              {parseResult && (
                <Alert color="green" icon={<IconCheck size={18} />}>
                  Parsed {parseResult.expenses.length} expenses from &quot;{fileName}&quot;
                  with {parseResult.participantNames.length} participants.
                  {parseResult.errors.length > 0 && (
                    <Text size="sm" mt={4}>
                      {parseResult.errors.length} row(s) skipped due to errors.
                    </Text>
                  )}
                </Alert>
              )}
            </Stack>
          </Paper>
        </Stepper.Step>

        {/* ─── Step 2: Member Mapping ─── */}
        <Stepper.Step label="Map members" description="Match participants">
          <Paper className="commune-soft-panel" p="xl" mt="lg">
            <Stack gap="lg">
              <Text size="sm" c="dimmed">
                Map each Splitwise participant to a member in your Commune group.
                We auto-matched where names or emails aligned.
              </Text>

              {parseResult?.participantNames.map((name) => (
                <Group key={name} align="flex-end" gap="md">
                  <Text fw={500} style={{ minWidth: 140 }}>
                    {name}
                  </Text>
                  <Select
                    placeholder="Select group member"
                    data={memberOptions}
                    value={mapping[name] ?? null}
                    onChange={(value) => {
                      setMapping((prev) => ({
                        ...prev,
                        [name]: value ?? '',
                      }));
                    }}
                    searchable
                    clearable
                    style={{ flex: 1 }}
                  />
                  {mapping[name] && (
                    <Badge color="green" variant="light">
                      Mapped
                    </Badge>
                  )}
                </Group>
              ))}

              <Group justify="flex-end">
                <Button onClick={handleMappingConfirm} disabled={!allMapped}>
                  Continue to preview
                </Button>
              </Group>

              {!allMapped && (
                <Text size="sm" c="orange">
                  All participants must be mapped before continuing.
                </Text>
              )}
            </Stack>
          </Paper>
        </Stepper.Step>

        {/* ─── Step 3: Preview ─── */}
        <Stepper.Step label="Preview" description="Review expenses">
          <Paper className="commune-soft-panel" p="xl" mt="lg">
            <Stack gap="lg">
              <Group justify="space-between">
                <Text fw={600}>
                  {importExpenses.length} expenses ready to import
                </Text>
                <Badge variant="light" color="blue">
                  {formatCurrency(
                    importExpenses.reduce((sum, e) => sum + e.cost, 0),
                    group?.currency,
                  )}{' '}
                  total
                </Badge>
              </Group>

              <div style={{ overflowX: 'auto', maxHeight: 500 }}>
                <Table verticalSpacing="sm" horizontalSpacing="sm" striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Date</Table.Th>
                      <Table.Th>Description</Table.Th>
                      <Table.Th>Category</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Amount</Table.Th>
                      <Table.Th>Participants</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {importExpenses.slice(0, 100).map((exp, i) => (
                      <Table.Tr key={i}>
                        <Table.Td>{exp.date}</Table.Td>
                        <Table.Td>{exp.description}</Table.Td>
                        <Table.Td>
                          <Badge variant="light" size="sm">
                            {exp.category}
                          </Badge>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          {formatCurrency(exp.cost, exp.currency)}
                        </Table.Td>
                        <Table.Td>
                          {exp.participants.length} member{exp.participants.length !== 1 ? 's' : ''}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </div>

              {importExpenses.length > 100 && (
                <Text size="sm" c="dimmed">
                  Showing first 100 of {importExpenses.length} expenses.
                </Text>
              )}

              <Alert color="blue" icon={<IconAlertCircle size={18} />}>
                Imported expenses will be marked as historical and will not create
                payment records. They will appear in your expense list and analytics.
              </Alert>

              <Group justify="flex-end">
                <Button onClick={handleImport} loading={importing}>
                  Import {importExpenses.length} expenses
                </Button>
              </Group>
            </Stack>
          </Paper>
        </Stepper.Step>

        {/* ─── Step 4: Import Progress ─── */}
        <Stepper.Step label="Import" description="Creating expenses">
          <Paper className="commune-soft-panel" p="xl" mt="lg">
            <Stack gap="lg" align="center">
              {importing ? (
                <>
                  <Title order={3}>Importing expenses...</Title>
                  <Progress
                    value={importProgress}
                    size="xl"
                    radius="xl"
                    striped
                    animated
                    style={{ width: '100%', maxWidth: 500 }}
                  />
                  <Text size="sm" c="dimmed">
                    {importProgress}% complete
                  </Text>
                </>
              ) : importResult ? (
                <>
                  <IconCheck size={48} color={theme.colors.green[6]} />
                  <Title order={3}>Import complete</Title>
                  <Text>
                    {importResult.created} expense{importResult.created !== 1 ? 's' : ''}{' '}
                    imported successfully.
                  </Text>
                  {importResult.failed > 0 && (
                    <Text c="orange">
                      {importResult.failed} expense{importResult.failed !== 1 ? 's' : ''}{' '}
                      failed to import.
                    </Text>
                  )}
                  <Group>
                    <Button onClick={() => navigate({ to: '/expenses' })}>
                      View expenses
                    </Button>
                    <Button
                      variant="default"
                      onClick={() => {
                        setActive(0);
                        setParseResult(null);
                        setFileName('');
                        setMapping({});
                        setImportExpenses([]);
                        setImportResult(null);
                        setImportProgress(0);
                      }}
                    >
                      Import another file
                    </Button>
                  </Group>
                </>
              ) : (
                <Text c="dimmed">Waiting to start import...</Text>
              )}
            </Stack>
          </Paper>
        </Stepper.Step>
      </Stepper>
    </Stack>
  );
}
