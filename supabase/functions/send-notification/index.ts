const RESEND_API_URL = 'https://api.resend.com/emails';

interface NotificationRequest {
  to: string;
  subject: string;
  body: string;
  type: 'new_expense' | 'payment_received' | 'payment_reminder' | 'overdue';
}

interface ResendPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
  tags: { name: string; value: string }[];
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const apiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'Commune <noreply@commune.app>';

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const { to, subject, body, type } = (await req.json()) as NotificationRequest;

    if (!to || !subject || !body || !type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, subject, body, type' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const htmlBody = wrapInTemplate(subject, body);

    const payload: ResendPayload = {
      from: fromEmail,
      to: [to],
      subject,
      html: htmlBody,
      tags: [{ name: 'type', value: type }],
    };

    const resendResponse = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!resendResponse.ok) {
      const errorBody = await resendResponse.text();
      console.error('Resend API error:', resendResponse.status, errorBody);
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: errorBody }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const result = await resendResponse.json();
    return new Response(
      JSON.stringify({ success: true, id: result.id }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('send-notification error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

function wrapInTemplate(subject: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #ffffff; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { font-size: 14px; font-weight: 600; color: #6366f1; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; }
    .content { font-size: 15px; line-height: 1.6; color: #374151; }
    .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">Commune</div>
      <div class="content">${body}</div>
    </div>
    <div class="footer">
      You're receiving this because of your notification settings in Commune.
    </div>
  </div>
</body>
</html>`;
}
