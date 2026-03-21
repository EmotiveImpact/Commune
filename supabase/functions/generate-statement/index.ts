import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';
import { createClient } from 'npm:@supabase/supabase-js@2';

// ── Rate Limiting ──────────────────────────────────────────────────────────────
// Max 10 requests per user per 60 seconds. Map resets on cold start (acceptable).
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimitMap = new Map<string, number[]>();

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of rateLimitMap) {
    const valid = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (valid.length === 0) {
      rateLimitMap.delete(key);
    } else {
      rateLimitMap.set(key, valid);
    }
  }
}, 300_000);

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const timestamps = (rateLimitMap.get(userId) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS,
  );
  if (timestamps.length >= RATE_LIMIT_MAX) {
    rateLimitMap.set(userId, timestamps);
    return false;
  }
  timestamps.push(now);
  rateLimitMap.set(userId, timestamps);
  return true;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── PDF helpers ───────────────────────────────────────────────────────────────
// pdf-lib uses points (1 pt = 1/72 inch). A4 is 595.28 x 841.89 pt.
const MM = 2.8346; // 1 mm in points
const A4_W = 595.28;
const A4_H = 841.89;
const MARGIN = 15 * MM;
const CONTENT_W = A4_W - MARGIN * 2;

function sanitizePdfText(value: unknown): string {
  if (typeof value !== 'string') {
    if (value == null) return '';
    return String(value);
  }

  // Standard PDF fonts in pdf-lib use WinAnsi. Strip characters that cause runtime encode failures.
  return value
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
    .trim();
}

function safeLabel(value: unknown, fallback: string): string {
  const text = sanitizePdfText(value);
  return text.length > 0 ? text : fallback;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Rate limit: max 10 requests per user per minute
    if (!checkRateLimit(user.id)) {
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again shortly.' }),
        { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Retry-After': '60' } },
      );
    }

    // ── Parse body ───────────────────────────────────────────────────────
    const { groupId, month } = await req.json();
    if (!groupId || !month) {
      return new Response(JSON.stringify({ error: 'groupId and month are required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return new Response(JSON.stringify({ error: 'month must use YYYY-MM format' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // ── Check subscription ───────────────────────────────────────────────
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (
      !subscription ||
      !['pro', 'agency'].includes(subscription.plan) ||
      !['active', 'trialing'].includes(subscription.status)
    ) {
      return new Response(JSON.stringify({ error: 'Pro or Agency subscription required' }), {
        status: 403,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // ── Group details ────────────────────────────────────────────────────
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('id, name, currency')
      .eq('id', groupId)
      .single();

    if (groupError || !group) {
      return new Response(JSON.stringify({ error: 'Group not found' }), {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // ── Date range for month ─────────────────────────────────────────────
    const [year, mon] = month.split('-').map(Number);
    if (!Number.isInteger(year) || !Number.isInteger(mon) || mon < 1 || mon > 12) {
      return new Response(JSON.stringify({ error: 'month must be a valid calendar month' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const startDate = `${year}-${String(mon).padStart(2, '0')}-01`;
    const endDate = new Date(year, mon, 0); // last day of month
    const endDateStr = `${year}-${String(mon).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    // ── Expenses for the month ───────────────────────────────────────────
    const { data: expenses, error: expError } = await supabase
      .from('expenses')
      .select('id, title, category, amount, currency, due_date, paid_by_user_id, is_active')
      .eq('group_id', groupId)
      .eq('is_active', true)
      .gte('due_date', startDate)
      .lte('due_date', endDateStr)
      .order('due_date', { ascending: true });

    if (expError) {
      console.error('Expenses query error:', expError);
      return new Response(JSON.stringify({ error: 'Failed to query expenses' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const expenseIds = (expenses ?? []).map((e: any) => e.id);

    // ── Participants with user details ───────────────────────────────────
    let participants: any[] = [];
    if (expenseIds.length > 0) {
      const { data: parts } = await supabase
        .from('expense_participants')
        .select('expense_id, user_id, share_amount, users:user_id (id, name, email)')
        .in('expense_id', expenseIds);
      participants = parts ?? [];
    }

    // ── Payment records ──────────────────────────────────────────────────
    let payments: any[] = [];
    if (expenseIds.length > 0) {
      const { data: pays } = await supabase
        .from('payment_records')
        .select('expense_id, user_id, amount, status')
        .in('expense_id', expenseIds);
      payments = pays ?? [];
    }

    // ── Compute summaries ────────────────────────────────────────────────
    const totalAmount = (expenses ?? []).reduce((sum: number, e: any) => sum + Number(e.amount), 0);
    const totalPaid = payments
      .filter((p: any) => p.status === 'paid' || p.status === 'confirmed')
      .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    const outstanding = totalAmount - totalPaid;
    const expenseCount = (expenses ?? []).length;

    // Build member breakdown
    const memberMap = new Map<string, { name: string; totalOwed: number; totalPaid: number }>();

    for (const p of participants) {
      const userName = safeLabel(p.users?.name || p.users?.email, 'Unknown');
      const userId = p.user_id;
      if (!memberMap.has(userId)) {
        memberMap.set(userId, { name: userName, totalOwed: 0, totalPaid: 0 });
      }
      const entry = memberMap.get(userId)!;
      entry.totalOwed += Number(p.share_amount);
    }

    for (const pay of payments) {
      if (pay.status === 'paid' || pay.status === 'confirmed') {
        const entry = memberMap.get(pay.user_id);
        if (entry) {
          entry.totalPaid += Number(pay.amount);
        }
      }
    }

    // Determine expense status
    const today = new Date().toISOString().split('T')[0];
    function getExpenseStatus(expense: any): string {
      const expPayments = payments.filter((p: any) => p.expense_id === expense.id);
      const allSettled = expPayments.length > 0 &&
        expPayments.every((p: any) => p.status === 'paid' || p.status === 'confirmed');
      if (allSettled) return 'Settled';
      if (expense.due_date < today) return 'Overdue';
      return 'Open';
    }

    const currency = group.currency || 'GBP';
    const fmt = (n: number) => {
      try {
        return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(n);
      } catch {
        return `${currency} ${n.toFixed(2)}`;
      }
    };

    const monthLabel = new Date(year, mon - 1).toLocaleDateString('en-GB', {
      month: 'long',
      year: 'numeric',
    });

    // ── Generate PDF with pdf-lib ─────────────────────────────────────────
    const pdfDoc = await PDFDocument.create();
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let page = pdfDoc.addPage([A4_W, A4_H]);
    // y tracks position from TOP of the page; pdf-lib draws from bottom,
    // so we convert with: drawY = A4_H - y
    let y = MARGIN;

    function drawY(yTop: number) {
      return A4_H - yTop;
    }

    function ensureSpace(needed: number) {
      if (y + needed > A4_H - MARGIN) {
        page = pdfDoc.addPage([A4_W, A4_H]);
        y = MARGIN;
      }
    }

    // ── Title ──────────────────────────────────────────────────────────
    page.drawText(safeLabel(group.name, 'Commune statement'), {
      x: MARGIN,
      y: drawY(y),
      size: 18,
      font: helveticaBold,
      color: rgb(0, 0, 0),
    });
    y += 22;

    page.drawText(`Statement for ${monthLabel}`, {
      x: MARGIN,
      y: drawY(y),
      size: 12,
      font: helvetica,
      color: rgb(0, 0, 0),
    });
    y += 16;

    const generatedDate = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    page.drawText(`Generated ${generatedDate}`, {
      x: MARGIN,
      y: drawY(y),
      size: 9,
      font: helvetica,
      color: rgb(0.47, 0.47, 0.47),
    });
    y += 24;

    // ── Summary box ──────────────────────────────────────────────────
    const boxH = 28 * MM;
    page.drawRectangle({
      x: MARGIN,
      y: drawY(y + boxH),
      width: CONTENT_W,
      height: boxH,
      color: rgb(0.973, 0.976, 0.984),
      borderColor: rgb(0.784, 0.784, 0.784),
      borderWidth: 0.5,
    });

    const colW = CONTENT_W / 4;
    const summaryLabels = ['Total Expenses', 'Total Amount', 'Amount Paid', 'Outstanding'];
    const summaryValues = [String(expenseCount), fmt(totalAmount), fmt(totalPaid), fmt(outstanding)];

    for (let i = 0; i < 4; i++) {
      const cx = MARGIN + colW * i + colW / 2;

      // Label
      const summaryLabel = safeLabel(summaryLabels[i], '');
      const labelWidth = helveticaBold.widthOfTextAtSize(summaryLabel, 9);
      page.drawText(summaryLabel, {
        x: cx - labelWidth / 2,
        y: drawY(y + 7 * MM),
        size: 9,
        font: helveticaBold,
        color: rgb(0.47, 0.47, 0.47),
      });

      // Value
      const summaryValue = safeLabel(summaryValues[i], '0');
      const valWidth = helveticaBold.widthOfTextAtSize(summaryValue, 11);
      page.drawText(summaryValue, {
        x: cx - valWidth / 2,
        y: drawY(y + 14 * MM),
        size: 11,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      });
    }
    y += boxH + 14;

    // ── Expenses table ──────────────────────────────────────────────
    page.drawText('Expenses', {
      x: MARGIN,
      y: drawY(y),
      size: 12,
      font: helveticaBold,
      color: rgb(0, 0, 0),
    });
    y += 16;

    const cols = [
      { label: 'Title', x: MARGIN, w: 50 * MM },
      { label: 'Category', x: MARGIN + 50 * MM, w: 30 * MM },
      { label: 'Due Date', x: MARGIN + 80 * MM, w: 25 * MM },
      { label: 'Amount', x: MARGIN + 105 * MM, w: 30 * MM },
      { label: 'Status', x: MARGIN + 135 * MM, w: 25 * MM },
    ];

    if ((expenses ?? []).length === 0) {
      page.drawText('No expenses for this period.', {
        x: MARGIN,
        y: drawY(y),
        size: 10,
        font: helvetica,
        color: rgb(0, 0, 0),
      });
      y += 20;
    } else {
      // Header row background
      const rowH = 7 * MM;
      page.drawRectangle({
        x: MARGIN,
        y: drawY(y + rowH - 3),
        width: CONTENT_W,
        height: rowH,
        color: rgb(0.941, 0.941, 0.941),
      });

      for (const col of cols) {
        page.drawText(col.label, {
          x: col.x + 2,
          y: drawY(y + 4),
          size: 8,
          font: helveticaBold,
          color: rgb(0, 0, 0),
        });
      }
      y += rowH + 2;

      for (const expense of expenses ?? []) {
        ensureSpace(5 * MM + 4);

        const status = getExpenseStatus(expense);
        const catLabel = safeLabel(expense.category, 'Uncategorised')
          .split('_')
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');

        const statusColor = status === 'Settled'
          ? rgb(0.133, 0.545, 0.133)
          : status === 'Overdue'
          ? rgb(0.784, 0.196, 0.196)
          : rgb(0.784, 0.588, 0);

        page.drawText(safeLabel(expense.title, 'Untitled expense').substring(0, 30), {
          x: cols[0].x + 2, y: drawY(y), size: 8, font: helvetica, color: rgb(0, 0, 0),
        });
        page.drawText(catLabel.substring(0, 18), {
          x: cols[1].x + 2, y: drawY(y), size: 8, font: helvetica, color: rgb(0, 0, 0),
        });
        page.drawText(safeLabel(expense.due_date, ''), {
          x: cols[2].x + 2, y: drawY(y), size: 8, font: helvetica, color: rgb(0, 0, 0),
        });
        page.drawText(fmt(Number(expense.amount)), {
          x: cols[3].x + 2, y: drawY(y), size: 8, font: helvetica, color: rgb(0, 0, 0),
        });
        page.drawText(status, {
          x: cols[4].x + 2, y: drawY(y), size: 8, font: helvetica, color: statusColor,
        });

        y += 5 * MM;
      }
    }

    // ── Member breakdown ──────────────────────────────────────────────
    y += 8 * MM;
    ensureSpace(30 * MM);

    page.drawText('Member Breakdown', {
      x: MARGIN,
      y: drawY(y),
      size: 12,
      font: helveticaBold,
      color: rgb(0, 0, 0),
    });
    y += 16;

    const memberCols = [
      { label: 'Name', x: MARGIN, w: 50 * MM },
      { label: 'Total Owed', x: MARGIN + 50 * MM, w: 35 * MM },
      { label: 'Total Paid', x: MARGIN + 85 * MM, w: 35 * MM },
      { label: 'Balance', x: MARGIN + 120 * MM, w: 35 * MM },
    ];

    // Header row
    const mRowH = 7 * MM;
    page.drawRectangle({
      x: MARGIN,
      y: drawY(y + mRowH - 3),
      width: CONTENT_W,
      height: mRowH,
      color: rgb(0.941, 0.941, 0.941),
    });

    for (const col of memberCols) {
      page.drawText(col.label, {
        x: col.x + 2,
        y: drawY(y + 4),
        size: 8,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      });
    }
    y += mRowH + 2;

    if (memberMap.size === 0) {
      page.drawText('No member data for this period.', {
        x: MARGIN,
        y: drawY(y),
        size: 10,
        font: helvetica,
        color: rgb(0, 0, 0),
      });
    } else {
      for (const [, member] of memberMap) {
        ensureSpace(5 * MM + 4);

        const balance = member.totalPaid - member.totalOwed;
        const balColor = balance < 0
          ? rgb(0.784, 0.196, 0.196)
          : balance > 0
          ? rgb(0.133, 0.545, 0.133)
          : rgb(0, 0, 0);

        page.drawText(safeLabel(member.name, 'Unknown').substring(0, 28), {
          x: memberCols[0].x + 2, y: drawY(y), size: 8, font: helvetica, color: rgb(0, 0, 0),
        });
        page.drawText(fmt(member.totalOwed), {
          x: memberCols[1].x + 2, y: drawY(y), size: 8, font: helvetica, color: rgb(0, 0, 0),
        });
        page.drawText(fmt(member.totalPaid), {
          x: memberCols[2].x + 2, y: drawY(y), size: 8, font: helvetica, color: rgb(0, 0, 0),
        });
        page.drawText(fmt(balance), {
          x: memberCols[3].x + 2, y: drawY(y), size: 8, font: helvetica, color: balColor,
        });

        y += 5 * MM;
      }
    }

    // ── Return PDF ───────────────────────────────────────────────────────
    const pdfBytes = await pdfDoc.save();

    return new Response(pdfBytes, {
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=statement-${month}.pdf`,
      },
    });
  } catch (err) {
    console.error('Statement generation error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message || 'Internal server error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
