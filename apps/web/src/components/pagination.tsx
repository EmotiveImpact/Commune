import { Group, Pagination as MantinePagination, Text } from '@mantine/core';

export const PAGE_SIZE = 20;

interface PaginationBarProps {
  page: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
}

export function PaginationBar({
  page,
  totalItems,
  pageSize = PAGE_SIZE,
  onPageChange,
}: PaginationBarProps) {
  const totalPages = Math.ceil(totalItems / pageSize);

  if (totalPages <= 1) return null;

  const start = page * pageSize + 1;
  const end = Math.min((page + 1) * pageSize, totalItems);

  return (
    <Group justify="space-between" mt="md" py="xs">
      <Text size="sm" c="dimmed">
        Showing {start}–{end} of {totalItems}
      </Text>
      <MantinePagination
        value={page + 1}
        onChange={(v) => onPageChange(v - 1)}
        total={totalPages}
        size="sm"
        radius="md"
        withEdges
        siblings={1}
        boundaries={1}
        styles={{
          control: {
            fontSize: '0.8rem',
            minWidth: 32,
            height: 32,
          },
        }}
      />
    </Group>
  );
}

export function paginate<T>(items: T[], page: number, pageSize = PAGE_SIZE): T[] {
  return items.slice(page * pageSize, (page + 1) * pageSize);
}
