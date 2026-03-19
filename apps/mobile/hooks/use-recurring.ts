import { useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@commune/api';
import { dashboardKeys } from './use-dashboard';
import { expenseKeys } from './use-expenses';

/**
 * Generates any due recurring expenses for the given group by calling the
 * `generate_recurring_expenses` Supabase RPC. If the function does not exist
 * yet on the backend the call fails silently so the rest of the app is not
 * affected.
 */
async function generateRecurringExpenses(groupId: string): Promise<void> {
  const { error } = await supabase.rpc('generate_recurring_expenses', {
    p_group_id: groupId,
  });

  if (error) {
    // The RPC may not be deployed yet -- swallow the error so the app keeps
    // working. Once the backend function ships this will start working
    // automatically.
    if (
      error.message.includes('function') &&
      error.message.includes('does not exist')
    ) {
      return;
    }
    throw error;
  }
}

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
 * Fires recurring generation once per mount. Safe to call on every render --
 * it will only trigger the mutation the first time.
 */
export function useRecurringGenerationOnMount(groupId: string) {
  const generation = useRecurringGeneration(groupId);
  const hasRun = useRef(false);

  useEffect(() => {
    if (groupId && !hasRun.current) {
      hasRun.current = true;
      generation.mutate();
    }
  }, [groupId]);

  return generation;
}
