import { jsPDF } from 'npm:jspdf';
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
      const userName = p.users?.name || p.users?.email || 'Unknown';
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

    // ── Generate PDF ─────────────────────────────────────────────────────
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

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

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(`${group.name}`, margin, y);
    y += 8;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Statement for ${monthLabel}`, margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(`Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, margin, y);
    doc.setTextColor(0, 0, 0);
    y += 10;

    // Summary box
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(248, 249, 250);
    doc.roundedRect(margin, y, contentWidth, 28, 2, 2, 'FD');
    y += 7;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const colW = contentWidth / 4;
    const summaryLabels = ['Total Expenses', 'Total Amount', 'Amount Paid', 'Outstanding'];
    const summaryValues = [String(expenseCount), fmt(totalAmount), fmt(totalPaid), fmt(outstanding)];

    for (let i = 0; i < 4; i++) {
      const cx = margin + colW * i + colW / 2;
      doc.setTextColor(120, 120, 120);
      doc.text(summaryLabels[i], cx, y, { align: 'center' });
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.text(summaryValues[i], cx, y + 10, { align: 'center' });
      doc.setFontSize(9);
    }
    y += 25;

    // Expense table
    y += 5;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Expenses', margin, y);
    y += 6;

    if ((expenses ?? []).length === 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('No expenses for this period.', margin, y);
      y += 8;
    } else {
      // Table header
      const cols = [
        { label: 'Title', x: margin, w: 50 },
        { label: 'Category', x: margin + 50, w: 30 },
        { label: 'Due Date', x: margin + 80, w: 25 },
        { label: 'Amount', x: margin + 105, w: 30 },
        { label: 'Status', x: margin + 135, w: 25 },
      ];

      doc.setFillColor(240, 240, 240);
      doc.rect(margin, y - 4, contentWidth, 7, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      for (const col of cols) {
        doc.text(col.label, col.x + 1, y);
      }
      y += 5;

      doc.setFont('helvetica', 'normal');
      for (const expense of expenses ?? []) {
        if (y > 270) {
          doc.addPage();
          y = margin;
        }

        const status = getExpenseStatus(expense);
        const catLabel = (expense.category as string)
          .split('_')
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');

        doc.setFontSize(8);
        doc.text(String(expense.title).substring(0, 30), cols[0].x + 1, y);
        doc.text(catLabel.substring(0, 18), cols[1].x + 1, y);
        doc.text(expense.due_date, cols[2].x + 1, y);
        doc.text(fmt(Number(expense.amount)), cols[3].x + 1, y);

        // Status with colour
        if (status === 'Settled') doc.setTextColor(34, 139, 34);
        else if (status === 'Overdue') doc.setTextColor(200, 50, 50);
        else doc.setTextColor(200, 150, 0);
        doc.text(status, cols[4].x + 1, y);
        doc.setTextColor(0, 0, 0);

        y += 5;
      }
    }

    // Member breakdown
    y += 8;
    if (y > 250) {
      doc.addPage();
      y = margin;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Member Breakdown', margin, y);
    y += 6;

    const memberCols = [
      { label: 'Name', x: margin, w: 50 },
      { label: 'Total Owed', x: margin + 50, w: 35 },
      { label: 'Total Paid', x: margin + 85, w: 35 },
      { label: 'Balance', x: margin + 120, w: 35 },
    ];

    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y - 4, contentWidth, 7, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    for (const col of memberCols) {
      doc.text(col.label, col.x + 1, y);
    }
    y += 5;

    doc.setFont('helvetica', 'normal');
    for (const [, member] of memberMap) {
      if (y > 270) {
        doc.addPage();
        y = margin;
      }

      const balance = member.totalPaid - member.totalOwed;
      doc.setFontSize(8);
      doc.text(member.name.substring(0, 28), memberCols[0].x + 1, y);
      doc.text(fmt(member.totalOwed), memberCols[1].x + 1, y);
      doc.text(fmt(member.totalPaid), memberCols[2].x + 1, y);

      if (balance < 0) doc.setTextColor(200, 50, 50);
      else if (balance > 0) doc.setTextColor(34, 139, 34);
      doc.text(fmt(balance), memberCols[3].x + 1, y);
      doc.setTextColor(0, 0, 0);

      y += 5;
    }

    if (memberMap.size === 0) {
      doc.setFontSize(10);
      doc.text('No member data for this period.', margin, y);
    }

    // ── Return PDF ───────────────────────────────────────────────────────
    const pdfBytes = doc.output('arraybuffer');

    return new Response(pdfBytes, {
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=statement-${month}.pdf`,
      },
    });
  } catch (err) {
    console.error('Statement generation error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
