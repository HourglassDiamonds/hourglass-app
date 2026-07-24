/**
 * Agent OS email transport via existing Resend dependency.
 * Never fabricates success; tests inject a fake sender.
 * Resend is loaded lazily so fixture/unit tests without node_modules/resend
 * can still exercise delivery with fakes.
 */

import { redactError, redactSecretsAndPii } from "../redaction";
import type { AgentOsEmailConfig } from "./email-config";
import type { RenderedAgentOsEmail } from "./render-email";

export type EmailSendResult =
  | { ok: true; providerMessageId: string | null }
  | { ok: false; uncertain: boolean; error: string };

export type AgentOsEmailSender = (input: {
  config: AgentOsEmailConfig;
  rendered: RenderedAgentOsEmail;
  /**
   * Stable internal delivery idempotency key (no recipients/secrets).
   * Passed to Resend as documented Idempotency-Key (defense in depth; 24h TTL).
   */
  idempotencyKey?: string;
}) => Promise<EmailSendResult>;

/** Production Resend sender — no fabricated success. */
export const resendAgentOsEmailSender: AgentOsEmailSender = async ({
  config,
  rendered,
  idempotencyKey,
}) => {
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(config.apiKey);
    const sendOptions =
      idempotencyKey && idempotencyKey.length > 0 && idempotencyKey.length <= 256
        ? { idempotencyKey }
        : undefined;
    const { data, error } = await resend.emails.send(
      {
        from: config.from,
        to: [config.to],
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      },
      sendOptions,
    );
    if (error) {
      return {
        ok: false,
        uncertain: false,
        error: redactSecretsAndPii(error.message || "resend error"),
      };
    }
    return {
      ok: true,
      providerMessageId: data?.id ?? null,
    };
  } catch (err) {
    const message = redactError(err);
    const uncertain =
      /timeout|network|ECONNRESET|ETIMEDOUT|fetch failed|socket/i.test(
        message,
      );
    return { ok: false, uncertain, error: message };
  }
};

/** Test fake — records calls; never touches network. */
export function createFakeEmailSender(options?: {
  fail?: boolean;
  uncertain?: boolean;
  messageId?: string;
  /** Simulate provider returning same message id on duplicate idempotency key. */
  honorIdempotencyKey?: boolean;
}): AgentOsEmailSender & {
  calls: Array<{ subject: string; toAlias: string; idempotencyKey?: string }>;
} {
  const calls: Array<{
    subject: string;
    toAlias: string;
    idempotencyKey?: string;
  }> = [];
  const seenKeys = new Map<string, string>();
  const sender: AgentOsEmailSender & {
    calls: Array<{ subject: string; toAlias: string; idempotencyKey?: string }>;
  } = async ({ config, rendered, idempotencyKey }) => {
    calls.push({
      subject: rendered.subject,
      toAlias: config.recipientAlias,
      idempotencyKey,
    });
    if (
      options?.honorIdempotencyKey &&
      idempotencyKey &&
      seenKeys.has(idempotencyKey)
    ) {
      return {
        ok: true,
        providerMessageId: seenKeys.get(idempotencyKey)!,
      };
    }
    if (options?.uncertain) {
      return { ok: false, uncertain: true, error: "simulated-uncertain" };
    }
    if (options?.fail) {
      return { ok: false, uncertain: false, error: "simulated-failure" };
    }
    const id = options?.messageId ?? `fake-msg-${calls.length}`;
    if (options?.honorIdempotencyKey && idempotencyKey) {
      seenKeys.set(idempotencyKey, id);
    }
    return {
      ok: true,
      providerMessageId: id,
    };
  };
  sender.calls = calls;
  return sender;
}
