/**
 * Optional transactional email via Resend.
 * Without RESEND_API_KEY + MAIL_FROM, sendEmail returns { sent: false }.
 */

export type MailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type MailResult =
  | { sent: true; id?: string }
  | { sent: false; reason: "not_configured" | "send_failed" };

export function isMailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.MAIL_FROM?.trim());
}

export function getAppBaseUrl(requestUrl?: string) {
  const configured = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.VERCEL_URL?.trim()) {
    return `https://${process.env.VERCEL_URL.trim().replace(/\/$/, "")}`;
  }
  if (requestUrl) {
    try {
      return new URL(requestUrl).origin;
    } catch {
      /* fall through */
    }
  }
  return "http://localhost:3000";
}

export async function sendEmail(payload: MailPayload): Promise<MailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.MAIL_FROM?.trim();
  if (!apiKey || !from) {
    return { sent: false, reason: "not_configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [payload.to],
        subject: payload.subject,
        text: payload.text,
        html: payload.html ?? `<pre style="font-family:sans-serif;white-space:pre-wrap">${escapeHtml(payload.text)}</pre>`,
      }),
    });

    if (!response.ok) {
      return { sent: false, reason: "send_failed" };
    }

    const data = (await response.json()) as { id?: string };
    return { sent: true, id: data.id };
  } catch {
    return { sent: false, reason: "send_failed" };
  }
}

export function buildPasswordResetEmail(input: {
  restaurantName: string;
  resetUrl: string;
}) {
  const subject = `Reset your ${input.restaurantName} rewards password`;
  const text = [
    `You requested a password reset for your optional rewards account at ${input.restaurantName}.`,
    "",
    `Open this link within one hour to choose a new password:`,
    input.resetUrl,
    "",
    `If you did not request this, you can ignore this email. Ordering never requires a rewards login.`,
  ].join("\n");

  const html = `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.5;color:#171717;max-width:480px;margin:0 auto;padding:24px">
      <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#a3a3a3">Rewards</p>
      <h1 style="margin:0 0 12px;font-size:24px;line-height:1.2">Reset your password</h1>
      <p style="margin:0 0 16px;color:#525252">You requested a password reset for your optional rewards account at <strong>${escapeHtml(input.restaurantName)}</strong>.</p>
      <p style="margin:0 0 24px">
        <a href="${escapeHtml(input.resetUrl)}" style="display:inline-block;background:#171717;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:999px">
          Choose a new password
        </a>
      </p>
      <p style="margin:0 0 8px;font-size:13px;color:#737373">This link expires in one hour. If the button does not work, copy and paste:</p>
      <p style="margin:0 0 16px;font-size:12px;word-break:break-all;color:#525252">${escapeHtml(input.resetUrl)}</p>
      <p style="margin:0;font-size:12px;color:#a3a3a3">If you did not request this, ignore this email. Ordering never requires a rewards login.</p>
    </div>
  `.trim();

  return { subject, text, html };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
