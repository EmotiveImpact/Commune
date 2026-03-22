import type { SplitwiseImportExpense } from '@commune/core';
import { supabase } from './client';

interface BulkCreateExpensesOptions {
  groupId: string;
  expenses: SplitwiseImportExpense[];
  onProgress?: (completed: number, total: number) => void;
}

interface BulkCreateResult {
  created: number;
  failed: number;
  errors: { index: number; message: string }[];
}

const BATCH_SIZE = 50;

/**
 * Bulk-create imported expenses with their participant shares.
 *
 * - Marks each expense with description prefix "[Imported]" so they're identifiable.
 * - Does NOT create payment records (these are historical imports).
 * - Processes in batches to avoid hitting Supabase payload limits.
 */
export async function bulkCreateExpenses({
  groupId,
  expenses,
  onProgress,
}: BulkCreateExpensesOptions): Promise<BulkCreateResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  let created = 0;
  let failed = 0;
  const errors: { index: number; message: string }[] = [];
  const total = expenses.length;

  // Process in batches
  for (let batchStart = 0; batchStart < total; batchStart += BATCH_SIZE) {
    const batch = expenses.slice(batchStart, batchStart + BATCH_SIZE);

    // Insert all expenses in this batch
    const expenseRows = batch.map((exp) => ({
      group_id: groupId,
      title: exp.description,
      description: '[Imported from Splitwise]',
      category: exp.category,
      amount: exp.cost,
      currency: exp.currency,
      due_date: exp.date,
      recurrence_type: 'none',
      recurrence_interval: 0,
      paid_by_user_id: null,
      split_method: 'custom' as const,
      is_active: true,
      created_by: user.id,
    }));

    const { data: insertedExpenses, error: insertError } = await supabase
      .from('expenses')
      .insert(expenseRows)
      .select('id');

    if (insertError) {
      // Mark entire batch as failed
      for (let i = 0; i < batch.length; i++) {
        failed++;
        errors.push({
          index: batchStart + i,
          message: insertError.message,
        });
      }
      onProgress?.(created + failed, total);
      continue;
    }

    const insertedIds = (insertedExpenses as { id: string }[]).map((e) => e.id);

    // Build participant rows for the whole batch
    const participantRows: {
      expense_id: string;
      user_id: string;
      share_amount: number;
      share_percentage: null;
    }[] = [];

    for (let i = 0; i < batch.length; i++) {
      const exp = batch[i]!;
      const expenseId = insertedIds[i];
      if (!expenseId) {
        failed++;
        errors.push({ index: batchStart + i, message: 'Missing expense ID after insert' });
        continue;
      }

      for (const p of exp.participants) {
        participantRows.push({
          expense_id: expenseId,
          user_id: p.userId,
          share_amount: p.share,
          share_percentage: null,
        });
      }
    }

    if (participantRows.length > 0) {
      const { error: partError } = await supabase
        .from('expense_participants')
        .insert(participantRows);

      if (partError) {
        // Participants failed — mark expenses as inactive to prevent orphans
        await supabase
          .from('expenses')
          .update({ is_active: false })
          .in('id', insertedIds);

        for (let i = 0; i < batch.length; i++) {
          failed++;
          errors.push({
            index: batchStart + i,
            message: `Participant insert failed: ${partError.message}`,
          });
        }
      } else {
        created += batch.length;
      }
    }

    onProgress?.(created + failed, total);
  }

  return { created, failed, errors };
}
