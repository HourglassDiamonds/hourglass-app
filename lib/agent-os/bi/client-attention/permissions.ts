/**
 * GREEN / YELLOW / RED vocabulary for Client Ops / Client Attention.
 * Thin specialist mapping — not a second security system.
 * P1-CLIENT-1 executes GREEN only. No send, CRM mutation, or calendar writes.
 */

import {
  isActionProhibited,
  proposedActionImpliesWrite,
} from "../../permissions";

export type ClientOpsPermissionTier = "green" | "yellow" | "red";

export const CLIENT_OPS_GREEN_CAPABILITIES = [
  "read-shared-hubspot-evidence",
  "classify-client-attention-state",
  "rank-exceptions",
  "redact-summarize",
  "report-to-chief-of-staff",
  "draft-suggested-next-action-internally",
] as const;

export const CLIENT_OPS_YELLOW_CAPABILITIES = [
  "draft-client-email-for-founder-review",
  "draft-client-text-for-founder-review",
  "propose-crm-field-or-task-updates",
  "propose-follow-up-scheduling",
] as const;

export const CLIENT_OPS_RED_CAPABILITIES = [
  "send-client-email",
  "send-client-text",
  "make-phone-call",
  "create-crm-records",
  "update-crm-records",
  "delete-crm-records",
  "mark-tasks-complete",
  "change-deal-stages",
  "schedule-calendar-events",
  "spend",
  "deploy",
] as const;

const RED_ACTION_PATTERNS: RegExp[] = [
  /\bsend\b.+\b(email|text|sms|message)\b/i,
  /\bemail\b.+\b(client|customer|inquiry)\b/i,
  /\btext\b.+\b(client|customer)\b/i,
  /\b(call|phone)\b.+\b(client|customer)\b/i,
  /\bcreate\b.+\b(hubspot|crm|deal|contact|task)\b/i,
  /\bupdate\b.+\b(hubspot|crm|deal|contact|stage)\b/i,
  /\bdelete\b.+\b(hubspot|crm|deal|contact|task)\b/i,
  /\bmark\b.+\b(complete|completed)\b/i,
  /\bchange\b.+\bdeal\s*stage\b/i,
  /\bschedule\b.+\b(calendar|appointment|meeting)\b/i,
  /\bdeploy\b/i,
  /\bspend\b|\bpurchase\b/i,
  /\bmutate\b.+\b(crm|hubspot|calendar)\b/i,
];

const YELLOW_ACTION_PATTERNS: RegExp[] = [
  /\bdraft\b.+\b(email|text|sms|reply)\b/i,
  /\bpropose\b.+\b(crm|hubspot|task|follow-?up|schedul)/i,
];

export function classifyClientOpsPermissionTier(
  proposedAction: string,
): ClientOpsPermissionTier {
  if (
    RED_ACTION_PATTERNS.some((re) => re.test(proposedAction)) ||
    proposedActionImpliesWrite(proposedAction) ||
    isActionProhibited(proposedAction)
  ) {
    return "red";
  }
  if (YELLOW_ACTION_PATTERNS.some((re) => re.test(proposedAction))) {
    return "yellow";
  }
  return "green";
}

/** P1-CLIENT-1 executes GREEN only. */
export function clientOpsMayExecute(proposedAction: string): boolean {
  return classifyClientOpsPermissionTier(proposedAction) === "green";
}
