import type { SendEmailPayload } from "./email";

export const DEFAULT_TRANSACTIONAL_EMAIL_FROM = "DS Racing Karts <noreply@dsracingkarts.com.au>";
const DEFAULT_CONTACT_EMAIL_TO = "dsracing@bigpond.com";

type EmailEnv = Record<string, string | undefined>;

export interface ContactEmailInput {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export function getContactEmailConfig(env: EmailEnv = process.env) {
  return {
    from: env.CONTACT_EMAIL_FROM?.trim() || DEFAULT_TRANSACTIONAL_EMAIL_FROM,
    to: env.CONTACT_EMAIL_TO?.trim() || env.ORDER_NOTIFICATION_EMAIL?.trim() || DEFAULT_CONTACT_EMAIL_TO,
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeHeaderValue(str: string): string {
  return str.replace(/[\r\n]+/g, " ").trim();
}

export function buildContactEmailPayload(
  input: ContactEmailInput,
  env: EmailEnv = process.env
): SendEmailPayload {
  const { from, to } = getContactEmailConfig(env);
  const safeName = escapeHtml(input.name);
  const safeEmail = escapeHtml(input.email);
  const safeSubject = escapeHtml(input.subject);
  const safeMessage = escapeHtml(input.message);

  return {
    from,
    to,
    replyTo: input.email,
    subject: `[${normalizeHeaderValue(input.subject)}] Contact from ${normalizeHeaderValue(input.name)}`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2 style="color: #e11d48;">New Contact Form Submission</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #eee;">Name</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${safeName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #eee;">Email</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${safeEmail}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #eee;">Subject</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${safeSubject}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; font-weight: bold; vertical-align: top;">Message</td>
              <td style="padding: 8px 12px; white-space: pre-wrap;">${safeMessage}</td>
            </tr>
          </table>
          <hr style="margin-top: 24px; border: none; border-top: 1px solid #eee;" />
          <p style="font-size: 12px; color: #888;">Sent from the DS Racing Karts website contact form.</p>
        </div>
      `,
  };
}
