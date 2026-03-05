/* eslint-disable @typescript-eslint/no-explicit-any */
let resendClient: any = null;

if (process.env.RESEND_API_KEY) {
  try {
    const { Resend } = require('resend');
    resendClient = new Resend(process.env.RESEND_API_KEY);
  } catch {
    console.warn('[email] resend package not available');
  }
}

export async function sendAlertEmail(
  to: string,
  mountainName: string,
  score: number
): Promise<void> {
  if (!resendClient) {
    console.log(
      `[EMAIL STUB] Alert → ${to}: ${mountainName} scored ${score}/100`
    );
    return;
  }
  await resendClient.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'noreply@powderiq.com',
    to,
    subject: `❄️ PowderIQ Alert: ${mountainName} scored ${score}/100`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Powder Alert Triggered!</h2>
        <p>Your alert for <strong>${mountainName}</strong> fired with a score of <strong>${score}/100</strong>.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard"
           style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none">
          View Dashboard
        </a>
        <p style="color:#6b7280;font-size:12px;margin-top:24px">
          Manage your alerts in Account settings.
        </p>
      </div>
    `,
  });
}
