/**
 * Concierge SLA founder alerts via Resend.
 * Operational emails only — no customer PII.
 *
 * Uses dedicated Concierge alert envs (preferred) with documented founder fallbacks.
 */

import {
  resendAgentOsEmailSender,
  type AgentOsEmailSender,
} from "@/lib/agent-os/cadence-delivery/send-email";
import {
  ConciergeAlertConfigError,
  resolveConciergeAlertEmailConfig,
  type ConciergeAlertEmailConfig,
} from "./email-config";
import { buildHubSpotDealUrl, getConfiguredHubSpotPortalId } from "./hubspot-tasks";
import { formatFounderLocal } from "./time";

export type ConciergeSlaAlertKind =
  | "immediate"
  | "due_soon"
  | "overdue"
  | "setup_failure";

export type ConciergeSlaAlertInput = {
  kind: ConciergeSlaAlertKind;
  dealId: string;
  submittedAt: string;
  dueAt: string;
  taskId?: string | null;
  failedComponent?: string | null;
  portalId?: string | null;
};

export type ConciergeSlaAlertResult =
  | {
      ok: true;
      providerMessageId: string | null;
      configSource: ConciergeAlertEmailConfig["alertConfigSource"];
    }
  | { ok: false; error: string; uncertain?: boolean };

function subjectFor(kind: ConciergeSlaAlertKind): string {
  switch (kind) {
    case "immediate":
      return "New Concierge inquiry received";
    case "due_soon":
      return "Concierge follow-up due soon";
    case "overdue":
      return "OVERDUE CONCIERGE LEAD";
    case "setup_failure":
      return "CONCIERGE SLA SETUP FAILURE";
  }
}

function bodyFor(input: ConciergeSlaAlertInput): { text: string; html: string } {
  const received = formatFounderLocal(input.submittedAt);
  const deadline = formatFounderLocal(input.dueAt);
  const link = buildHubSpotDealUrl(
    input.dealId,
    input.portalId ?? getConfiguredHubSpotPortalId(),
  );

  const lines: string[] = [];
  if (input.kind === "immediate") {
    lines.push(`New Concierge lead received at ${received}.`);
    lines.push(`24-hour contact deadline: ${deadline}.`);
    lines.push(`Deal ID: ${input.dealId}.`);
    if (input.taskId) {
      lines.push(
        "Follow-up task / SLA protection was created in HubSpot.",
      );
    } else {
      lines.push(
        "SLA protection setup may be incomplete — check HubSpot deal and Vercel logs.",
      );
    }
  } else if (input.kind === "due_soon") {
    lines.push(
      `Deal ${input.dealId} has approximately 4 hours remaining before the 24-hour response window.`,
    );
    lines.push(`Deadline: ${deadline}.`);
  } else if (input.kind === "overdue") {
    lines.push(
      `Deal ${input.dealId} has passed the 24-hour response window without confirmed first contact.`,
    );
    lines.push(`Deadline was: ${deadline}.`);
    lines.push("Mark the Concierge SLA task COMPLETED after first contact.");
  } else {
    lines.push(
      `Concierge SLA setup failed for deal ${input.dealId}.`,
    );
    lines.push(`Received: ${received}.`);
    if (input.failedComponent) {
      lines.push(`Failed component: ${input.failedComponent}.`);
    }
    lines.push("Customer inquiry may already exist in HubSpot — investigate immediately.");
  }

  if (link) {
    lines.push(`Open in HubSpot: ${link}`);
  }

  const text = lines.join("\n");
  const html = `<p>${lines.map((l) => escapeHtml(l)).join("</p><p>")}</p>`;
  return { text, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function conciergeSlaAlertIdempotencyKey(
  kind: ConciergeSlaAlertKind,
  dealId: string,
): string {
  switch (kind) {
    case "immediate":
      return `concierge-immediate:${dealId}`;
    case "due_soon":
      return `concierge-due-soon:${dealId}`;
    case "overdue":
      return `concierge-overdue:${dealId}`;
    case "setup_failure":
      return `concierge-setup-failure:${dealId}`;
  }
}

export async function sendConciergeSlaAlert(
  input: ConciergeSlaAlertInput,
  options?: {
    sender?: AgentOsEmailSender;
    config?: ConciergeAlertEmailConfig;
    env?: NodeJS.ProcessEnv;
  },
): Promise<ConciergeSlaAlertResult> {
  let config: ConciergeAlertEmailConfig;
  try {
    config = options?.config ?? resolveConciergeAlertEmailConfig(options?.env);
  } catch (error) {
    const message =
      error instanceof ConciergeAlertConfigError
        ? error.message
        : error instanceof Error
          ? error.message
          : "email_config_unavailable";
    console.error("[concierge_sla_alert_config_missing]", {
      event: "concierge_sla_alert_config_missing",
      severity: "high",
      deal_id: input.dealId,
      kind: input.kind,
      error: message,
    });
    return { ok: false, error: message };
  }

  const sender = options?.sender ?? resendAgentOsEmailSender;
  const subject = subjectFor(input.kind);
  const { text, html } = bodyFor(input);

  const result = await sender({
    config,
    rendered: { subject, text, html },
    idempotencyKey: conciergeSlaAlertIdempotencyKey(input.kind, input.dealId),
  });

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      uncertain: result.uncertain,
    };
  }
  return {
    ok: true,
    providerMessageId: result.providerMessageId,
    configSource: config.alertConfigSource,
  };
}
