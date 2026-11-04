import type { ConciergeFunnelRecord } from "./types";
import { createHash } from "node:crypto";

export const CONCIERGE_ACCEPTANCE_RPC =
  "continuum_accept_concierge_funnel_v1" as const;

export type SupabaseConciergeAcceptanceParams = {
  p_intake_id: string;
  p_expected_website_idempotency_key_hash: string;
  p_acceptance_payload_hash: string;
  p_candidate: ConciergeFunnelRecord["nextAction"]["candidate"];
  p_acknowledgement: ConciergeFunnelRecord["acknowledgement"] & {
    eventId: string;
    leadId: string;
    actionId: string;
    conciergeIdempotencyKey: string;
    conciergePayloadHash: string;
    emailVerification: ConciergeFunnelRecord["intake"]["emailVerification"];
    qualification: ConciergeFunnelRecord["lead"]["qualification"];
  };
  p_follow_up_policy: ConciergeFunnelRecord["followUp"];
};

export type SupabaseConciergeAcceptanceResult = {
  status: "created" | "already-present";
  intake_id: string;
  candidate_id: string;
  outbox_id: string;
};

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function conciergeAcceptancePayloadHash(record: ConciergeFunnelRecord): string {
  return createHash("sha256")
    .update(stableJson({
      intakeId: record.intake.intakeId,
      payloadHash: record.intake.payloadHash,
      identity: record.intake.identity,
      emailVerification: record.intake.emailVerification,
      lead: record.lead,
      nextAction: record.nextAction,
      acknowledgement: record.acknowledgement,
      followUp: record.followUp,
    }))
    .digest("hex");
}

/**
 * Pure adapter boundary for the future service-role RPC. It performs no I/O.
 * The RPC must lock and verify the existing intake, then atomically persist the
 * Candidate and outbox record. It must reject synthetic or payload-mismatched
 * intake rows and return the existing identities on an exact replay.
 */
export function toSupabaseConciergeAcceptanceParams(
  record: ConciergeFunnelRecord,
): SupabaseConciergeAcceptanceParams {
  if (!/^[0-9a-f-]{36}$/i.test(record.intake.intakeId)) {
    throw new Error("invalid-intake-id");
  }
  if (!/^[a-f0-9]{64}$/.test(record.nextAction.candidate.candidateId)) {
    throw new Error("invalid-candidate-id");
  }
  if (record.intake.inquiry.synthetic) throw new Error("synthetic-intake-forbidden");
  return {
    p_intake_id: record.intake.intakeId,
    p_expected_website_idempotency_key_hash: createHash("sha256")
      .update(`hourglass:website-intake:v1:${record.intake.submissionId}`)
      .digest("hex"),
    p_acceptance_payload_hash: conciergeAcceptancePayloadHash(record),
    p_candidate: record.nextAction.candidate,
    p_acknowledgement: {
      ...record.acknowledgement,
      eventId: record.intake.eventId,
      leadId: record.lead.leadId,
      actionId: record.nextAction.actionId,
      conciergeIdempotencyKey: record.intake.idempotencyKey,
      conciergePayloadHash: record.intake.payloadHash,
      emailVerification: record.intake.emailVerification,
      qualification: record.lead.qualification,
    },
    p_follow_up_policy: record.followUp,
  };
}
