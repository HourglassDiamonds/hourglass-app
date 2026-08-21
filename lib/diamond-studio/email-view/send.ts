/**
 * Visitor-facing Email This View sender.
 *
 * Distinct from Agent OS / Concierge alert mail (those are founder-facing).
 * Requires RESEND_API_KEY and STUDIO_VIEW_EMAIL_FROM. Do not invent a From
 * address if the verified sender is missing.
 */

import { getResendApiKey } from "@/lib/intelligence/env";
import { hasHeaderInjection } from "./validate";
import type { StudioViewEmailSender } from "./types";

export const STUDIO_VIEW_EMAIL_FROM_ENV = "STUDIO_VIEW_EMAIL_FROM";

export const PREFERRED_STUDIO_VIEW_FROM =
  "Hourglass Diamonds <concierge@hourglassdiamonds.com>";

export function resolveStudioViewEmailFrom(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const from = env[STUDIO_VIEW_EMAIL_FROM_ENV]?.trim();
  if (!from) return null;
  if (hasHeaderInjection(from)) return null;
  if (!/@/.test(from)) return null;
  return from;
}

export function isStudioViewEmailConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const apiKey =
    env.RESEND_API_KEY?.trim() || getResendApiKey() || "";
  return Boolean(apiKey && resolveStudioViewEmailFrom(env));
}

export const resendStudioViewEmailSender: StudioViewEmailSender = async ({
  from,
  to,
  subject,
  html,
  text,
  attachments,
}) => {
  try {
    const apiKey = getResendApiKey();
    if (!apiKey) {
      return { ok: false, error: "resend_unconfigured" };
    }
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from,
      to: [to],
      subject,
      html,
      text,
      attachments: attachments.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType,
        contentId: attachment.contentId,
      })),
    });
    if (error) {
      return { ok: false, error: error.message || "resend error" };
    }
    return { ok: true, providerMessageId: data?.id ?? null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "send_failed";
    return { ok: false, error: message };
  }
};

export function createFakeStudioViewEmailSender(options?: {
  fail?: boolean;
}): StudioViewEmailSender & {
  calls: Array<{
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
    attachmentCount: number;
    attachmentNames: string[];
  }>;
} {
  const calls: Array<{
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
    attachmentCount: number;
    attachmentNames: string[];
  }> = [];
  const sender: StudioViewEmailSender & { calls: typeof calls } = async (
    input,
  ) => {
    calls.push({
      from: input.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      attachmentCount: input.attachments.length,
      attachmentNames: input.attachments.map((a) => a.filename),
    });
    if (options?.fail) return { ok: false, error: "fake_send_failed" };
    return { ok: true, providerMessageId: "fake-msg-1" };
  };
  sender.calls = calls;
  return sender;
}
