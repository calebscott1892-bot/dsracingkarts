import { Resend } from "resend";

type SendEmailPayload = Parameters<Resend["emails"]["send"]>[0];
type ResendSendResult = Awaited<ReturnType<Resend["emails"]["send"]>>;

function formatResendError(error: NonNullable<ResendSendResult["error"]>) {
  const status = error.statusCode ? ` (${error.statusCode})` : "";
  return `${error.name || "error"}${status}: ${error.message}`;
}

export function assertResendSuccess(result: ResendSendResult) {
  if (result.error) {
    throw new Error(`Resend email failed - ${formatResendError(result.error)}`);
  }
  return result.data;
}

export async function sendEmail(payload: SendEmailPayload) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const result = await resend.emails.send(payload);
  return assertResendSuccess(result);
}
