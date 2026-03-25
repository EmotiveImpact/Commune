import { useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { generateRecurringExpenses } from '@commune/api';
import { dashboardKeys } from './use-dashboard';
import { expenseKeys } from './use-expenses';

/**
 * Hook that triggers recurring expense generation for a group.
 *
 * Returns a mutation you can fire imperatively. The dashboard calls this on
 * mount/focus so recurring expenses are auto-created when they fall due.
 */
export function useRecurringGeneration(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => generateRecurringExpenses(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}

/**
 * Fires recurring generation once per group. Resets when the user switches
 * to a different group so recurring expenses are generated for each group.
 */
export function useRecurringGenerationOnMount(groupId: string) {
  const generation = useRecurringGeneration(groupId);
  const prevGroupId = useRef<string | null>(null);

  useEffect(() => {
    if (groupId && groupId !== prevGroupId.current) {
      prevGroupId.current = groupId;
      generation.mutate();
    }
  }, [generation, groupId]);

  return generation;
}
