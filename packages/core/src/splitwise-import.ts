import { z } from 'zod';
import { ExpenseCategory } from '@commune/types';

// ─── Splitwise CSV Parsing ──────────────────────────────────────────────────

/**
 * Splitwise CSV format:
 * Date, Description, Category, Cost, Currency, [ParticipantName, ParticipantShare]...
 *
 * Each participant gets two columns: their name and their share amount.
 * Shares are positive numbers. A share of 0 means the participant is not involved.
 */

export interface SplitwiseParticipantShare {
  name: string;
  share: number;
}

export interface SplitwiseExpenseRow {
  date: string; // YYYY-MM-DD
  description: string;
  category: string;
  cost: number;
  currency: string;
  participants: SplitwiseParticipantShare[];
}

export interface SplitwiseParseResult {
  expenses: SplitwiseExpenseRow[];
  participantNames: string[];
  errors: { row: number; message: string }[];
}

// ─── Category Mapping ───────────────────────────────────────────────────────

const SPLITWISE_CATEGORY_MAP: Record<string, string> = {
  // Splitwise categories → Commune categories
  rent: ExpenseCategory.RENT,
  mortgage: ExpenseCategory.RENT,
  utilities: ExpenseCategory.UTILITIES,
  electricity: ExpenseCategory.UTILITIES,
  gas: ExpenseCategory.UTILITIES,
  water: ExpenseCategory.UTILITIES,
  heating: ExpenseCategory.UTILITIES,
  internet: ExpenseCategory.INTERNET,
  wifi: ExpenseCategory.INTERNET,
  phone: ExpenseCategory.INTERNET,
  cleaning: ExpenseCategory.CLEANING,
  'cleaning supplies': ExpenseCategory.CLEANING,
  groceries: ExpenseCategory.GROCERIES,
  food: ExpenseCategory.GROCERIES,
  'food and drink': ExpenseCategory.GROCERIES,
  dining: ExpenseCategory.GROCERIES,
  restaurant: ExpenseCategory.GROCERIES,
  entertainment: ExpenseCategory.ENTERTAINMENT,
  games: ExpenseCategory.ENTERTAINMENT,
  movies: ExpenseCategory.ENTERTAINMENT,
  music: ExpenseCategory.ENTERTAINMENT,
  sports: ExpenseCategory.ENTERTAINMENT,
  household: ExpenseCategory.HOUSEHOLD_SUPPLIES,
  'household supplies': ExpenseCategory.HOUSEHOLD_SUPPLIES,
  furniture: ExpenseCategory.HOUSEHOLD_SUPPLIES,
  maintenance: ExpenseCategory.HOUSEHOLD_SUPPLIES,
  transportation: ExpenseCategory.TRANSPORT,
  transport: ExpenseCategory.TRANSPORT,
  taxi: ExpenseCategory.TRANSPORT,
  bus: ExpenseCategory.TRANSPORT,
  parking: ExpenseCategory.TRANSPORT,
  car: ExpenseCategory.TRANSPORT,
  'work tools': ExpenseCategory.WORK_TOOLS,
  office: ExpenseCategory.WORK_TOOLS,
  software: ExpenseCategory.WORK_TOOLS,
  general: ExpenseCategory.MISCELLANEOUS,
  other: ExpenseCategory.MISCELLANEOUS,
  uncategorized: ExpenseCategory.MISCELLANEOUS,
};

export function mapSplitwiseCategory(category: string): string {
  const normalised = category.trim().toLowerCase();
  return SPLITWISE_CATEGORY_MAP[normalised] ?? ExpenseCategory.MISCELLANEOUS;
}

// ─── CSV Parser ─────────────────────────────────────────────────────────────

/**
 * Parse a raw CSV string to an array of string arrays, handling quoted fields.
 */
function parseCSVLines(csv: string): string[][] {
  const lines: string[][] = [];
  const rows = csv.split(/\r?\n/);

  for (const row of rows) {
    if (row.trim() === '') continue;

    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
      const ch = row[i]!;
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < row.length && row[i + 1] === '"') {
            current += '"';
            i++; // skip escaped quote
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          fields.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
    }
    fields.push(current.trim());
    lines.push(fields);
  }

  return lines;
}

/**
 * Parse a date string from Splitwise CSV.
 * Splitwise typically uses YYYY-MM-DD or MM/DD/YYYY formats.
 */
function parseDate(dateStr: string): string | null {
  const trimmed = dateStr.trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return trimmed;
  }

  // MM/DD/YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    const iso = `${year}-${month!.padStart(2, '0')}-${day!.padStart(2, '0')}`;
    const d = new Date(iso);
    if (!isNaN(d.getTime())) return iso;
  }

  // DD/MM/YYYY (common in UK exports)
  const ukMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ukMatch) {
    const [, day, month, year] = ukMatch;
    const dayNum = parseInt(day!, 10);
    const monthNum = parseInt(month!, 10);
    // If day > 12, it must be DD/MM/YYYY
    if (dayNum > 12) {
      const iso = `${year}-${month!.padStart(2, '0')}-${day!.padStart(2, '0')}`;
      const d = new Date(iso);
      if (!isNaN(d.getTime())) return iso;
    }
  }

  return null;
}

/**
 * Parse a Splitwise CSV export into structured expense data.
 *
 * Expected header: Date, Description, Category, Cost, Currency, [Name1, Name1, Name2, Name2, ...]
 * The participant columns come in pairs: the first is the participant's name (repeated
 * as header), and the cell value is their share amount.
 */
export function parseSplitwiseCSV(csvText: string): SplitwiseParseResult {
  const lines = parseCSVLines(csvText);
  const errors: { row: number; message: string }[] = [];
  const expenses: SplitwiseExpenseRow[] = [];

  if (lines.length === 0) {
    return { expenses: [], participantNames: [], errors: [{ row: 0, message: 'CSV file is empty' }] };
  }

  const header = lines[0]!;

  // Validate required columns
  const dateIdx = header.findIndex((h) => /^date$/i.test(h));
  const descIdx = header.findIndex((h) => /^description$/i.test(h));
  const catIdx = header.findIndex((h) => /^category$/i.test(h));
  const costIdx = header.findIndex((h) => /^cost$/i.test(h));
  const currIdx = header.findIndex((h) => /^currency$/i.test(h));

  if (dateIdx === -1 || descIdx === -1 || costIdx === -1) {
    return {
      expenses: [],
      participantNames: [],
      errors: [{ row: 1, message: 'Missing required columns: Date, Description, Cost' }],
    };
  }

  // Extract participant names from remaining header columns
  // Splitwise puts participant columns after the standard ones
  const standardIdxs = new Set([dateIdx, descIdx, catIdx, costIdx, currIdx]);
  const participantNames: string[] = [];
  const participantColIdxs: number[] = [];

  for (let i = 0; i < header.length; i++) {
    if (standardIdxs.has(i)) continue;
    const name = header[i]!.trim();
    if (!name) continue;
    // Splitwise sometimes has duplicate column names for each participant — deduplicate
    if (!participantNames.includes(name)) {
      participantNames.push(name);
    }
    participantColIdxs.push(i);
  }

  // Group participant columns by name (pairs: first is their share)
  const participantCols: Map<string, number[]> = new Map();
  for (const idx of participantColIdxs) {
    const name = header[idx]!.trim();
    if (!name) continue;
    const existing = participantCols.get(name) ?? [];
    existing.push(idx);
    participantCols.set(name, existing);
  }

  // Parse data rows
  for (let rowIdx = 1; rowIdx < lines.length; rowIdx++) {
    const row = lines[rowIdx]!;

    // Skip empty rows
    if (row.length === 0 || (row.length === 1 && row[0]!.trim() === '')) continue;

    // Skip Splitwise summary/total rows
    const firstCell = (row[dateIdx] ?? '').trim().toLowerCase();
    if (firstCell === 'total' || firstCell === 'total balance' || firstCell === '') continue;

    // Parse date
    const dateStr = row[dateIdx] ?? '';
    const parsedDate = parseDate(dateStr);
    if (!parsedDate) {
      errors.push({ row: rowIdx + 1, message: `Invalid date: "${dateStr}"` });
      continue;
    }

    // Parse description
    const description = (row[descIdx] ?? '').trim();
    if (!description) {
      errors.push({ row: rowIdx + 1, message: 'Missing description' });
      continue;
    }

    // Parse cost
    const costStr = (row[costIdx] ?? '').replace(/[^0-9.\-]/g, '');
    const cost = parseFloat(costStr);
    if (isNaN(cost) || cost <= 0) {
      // Skip zero/negative costs (settlements, payments)
      continue;
    }

    // Parse category
    const category = catIdx !== -1 ? (row[catIdx] ?? '').trim() : '';

    // Parse currency
    const currency = currIdx !== -1 ? (row[currIdx] ?? 'GBP').trim() : 'GBP';

    // Parse participant shares
    const participants: SplitwiseParticipantShare[] = [];
    for (const [name, colIdxs] of participantCols) {
      // Try each column for this participant to find the share value
      let share = 0;
      for (const ci of colIdxs) {
        const cellVal = (row[ci] ?? '').trim().replace(/[^0-9.\-]/g, '');
        const parsed = parseFloat(cellVal);
        if (!isNaN(parsed) && parsed !== 0) {
          share = Math.abs(parsed); // shares are always positive
          break;
        }
      }
      if (share > 0) {
        participants.push({ name, share });
      }
    }

    if (participants.length === 0) {
      errors.push({ row: rowIdx + 1, message: 'No participant shares found' });
      continue;
    }

    expenses.push({
      date: parsedDate,
      description,
      category,
      cost,
      currency: currency.toUpperCase(),
      participants,
    });
  }

  return { expenses, participantNames, errors };
}

// ─── Zod Schemas ────────────────────────────────────────────────────────────

export const splitwiseParticipantMappingSchema = z.object({
  splitwiseName: z.string().min(1),
  communeUserId: z.string().min(1, 'Each participant must be mapped to a group member'),
});

export type SplitwiseParticipantMapping = z.infer<typeof splitwiseParticipantMappingSchema>;

export const splitwiseImportExpenseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
  description: z.string().min(1).max(200),
  category: z.string().min(1),
  cost: z.number().positive(),
  currency: z.string().length(3),
  participants: z.array(
    z.object({
      userId: z.string().min(1),
      share: z.number().positive(),
    }),
  ).min(1),
});

export type SplitwiseImportExpense = z.infer<typeof splitwiseImportExpenseSchema>;

export const splitwiseImportRequestSchema = z.object({
  groupId: z.string().min(1),
  expenses: z
    .array(splitwiseImportExpenseSchema)
    .min(1, 'At least one expense is required')
    .max(5000, 'Maximum 5000 expenses per import'),
});

export type SplitwiseImportRequest = z.infer<typeof splitwiseImportRequestSchema>;

// ─── Transform parsed rows to import-ready format ───────────────────────────

export function transformForImport(
  rows: SplitwiseExpenseRow[],
  nameToUserId: Map<string, string>,
): { expenses: SplitwiseImportExpense[]; unmapped: string[] } {
  const unmapped = new Set<string>();
  const expenses: SplitwiseImportExpense[] = [];

  for (const row of rows) {
    const participants: { userId: string; share: number }[] = [];
    let hasUnmapped = false;

    for (const p of row.participants) {
      const userId = nameToUserId.get(p.name);
      if (!userId) {
        unmapped.add(p.name);
        hasUnmapped = true;
        continue;
      }
      participants.push({ userId, share: p.share });
    }

    if (hasUnmapped || participants.length === 0) continue;

    expenses.push({
      date: row.date,
      description: row.description,
      category: mapSplitwiseCategory(row.category),
      cost: row.cost,
      currency: row.currency,
      participants,
    });
  }

  return { expenses, unmapped: Array.from(unmapped) };
}
