import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const EXTRACTION_PROMPT = `Extract the following from this receipt image. Return ONLY valid JSON, no markdown or code fences:
{
  "amount": <total amount as number>,
  "currency": "<3-letter currency code, e.g. GBP, USD, EUR>",
  "vendor": "<merchant/store name>",
  "date": "<YYYY-MM-DD format>",
  "category": "<one of: rent, utilities, internet, cleaning, groceries, entertainment, household_supplies, transport, work_tools, miscellaneous>",
  "line_items": [{"description": "<item name>", "amount": <price as number>}]
}
If you cannot determine a field, use null.`;

interface ParseReceiptRequest {
  image_base64: string;
  mime_type?: string;
}

interface ParsedReceipt {
  amount: number | null;
  currency: string | null;
  vendor: string | null;
  date: string | null;
  category: string | null;
  line_items: { description: string; amount: number }[];
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: corsHeaders },
      );
    }

    // Verify user via Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: corsHeaders },
      );
    }

    // Check scan limits
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan, receipt_scan_count, receipt_scan_reset_at')
      .eq('user_id', user.id)
      .single();

    const plan = sub?.plan ?? 'standard';
    const limits: Record<string, number> = {
      standard: 10,
      pro: 50,
      agency: 999999,
    };
    const maxScans = limits[plan] ?? 10;

    // Reset count if it's a new month
    let scanCount = sub?.receipt_scan_count ?? 0;
    const resetAt = sub?.receipt_scan_reset_at ? new Date(sub.receipt_scan_reset_at) : new Date(0);
    const now = new Date();
    if (now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear()) {
      scanCount = 0;
      await supabase
        .from('subscriptions')
        .update({ receipt_scan_count: 0, receipt_scan_reset_at: now.toISOString() })
        .eq('user_id', user.id);
    }

    if (scanCount >= maxScans) {
      return new Response(
        JSON.stringify({
          error: 'Scan limit reached',
          message: `You've used all ${maxScans} receipt scans this month. Upgrade your plan for more.`,
          scans_used: scanCount,
          scans_limit: maxScans,
        }),
        { status: 429, headers: corsHeaders },
      );
    }

    // Parse request body
    const body: ParseReceiptRequest = await req.json();
    if (!body.image_base64) {
      return new Response(
        JSON.stringify({ error: 'Missing image_base64 field' }),
        { status: 400, headers: corsHeaders },
      );
    }

    // Call Gemini Vision API
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) {
      return new Response(
        JSON.stringify({ error: 'Receipt scanning not configured. GEMINI_API_KEY missing.' }),
        { status: 503, headers: corsHeaders },
      );
    }

    const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: EXTRACTION_PROMPT },
            {
              inline_data: {
                mime_type: body.mime_type ?? 'image/jpeg',
                data: body.image_base64,
              },
            },
          ],
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error('Gemini API error:', errText);
      return new Response(
        JSON.stringify({ error: 'Failed to process receipt image' }),
        { status: 502, headers: corsHeaders },
      );
    }

    const geminiData = await geminiResponse.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    // Parse the JSON from Gemini's response (strip any markdown fences)
    const jsonMatch = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    let parsed: ParsedReceipt;
    try {
      parsed = JSON.parse(jsonMatch);
    } catch {
      console.error('Failed to parse Gemini response:', rawText);
      return new Response(
        JSON.stringify({ error: 'Could not extract structured data from receipt' }),
        { status: 422, headers: corsHeaders },
      );
    }

    // Increment scan count
    await supabase
      .from('subscriptions')
      .update({ receipt_scan_count: scanCount + 1 })
      .eq('user_id', user.id);

    return new Response(
      JSON.stringify({
        ...parsed,
        scans_used: scanCount + 1,
        scans_limit: maxScans,
      }),
      { status: 200, headers: corsHeaders },
    );
  } catch (err) {
    console.error('parse-receipt error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders },
    );
  }
});
