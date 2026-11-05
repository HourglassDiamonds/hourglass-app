/**
 * Private Concierge persistence adapter. Import through ./server from App Router
 * code so the service-role client can never enter a browser bundle.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { rowToCandidate } from "../candidates/rows";
import type { WebsiteInquiry } from "../website-intake/types";
import {
  CONCIERGE_ACCEPTANCE_RPC,
  conciergeAcceptancePayloadHash,
  toSupabaseConciergeAcceptanceParams,
  type SupabaseConciergeAcceptanceResult,
} from "./persistence-contract";
import {
  WEBSITE_CONCIERGE_SOURCE_LABEL,
  type SterlingTodayNextAction,
} from "./preview-acceptance";
import type {
  AcceptIntakeResult,
  AcknowledgementOutboxItem,
  ConciergeFunnelRecord,
  ConciergeFunnelStore,
  FollowUpPolicy,
  IdentityResolution,
} from "./types";
import { CONTROLLED_ACCEPTANCE_RULE } from "./controlled-acceptance";

const OUTBOX_TABLE = "continuum_concierge_ack_outbox";
const INTAKE_TABLE = "continuum_website_intakes";
const CANDIDATE_TABLE = "continuum_candidates";
const TRANSITION_RPC = "continuum_transition_concierge_ack_v1";

const INTAKE_COLUMNS = [
  "intake_id", "idempotency_key_hash", "payload_hash", "source", "identity_status",
  "person_id", "full_name", "email", "phone", "preferred_contact_method", "category",
  "project_type", "shape_interest", "design_direction", "ring_presence", "timeline",
  "budget_range", "inspiration_notes", "attribution", "synthetic", "acknowledgement_state",
  "submitted_at",
].join(",");

const OUTBOX_COLUMNS = [
  "outbox_id", "intake_id", "candidate_id", "event_id", "lead_id", "action_id",
  "concierge_idempotency_key", "concierge_payload_hash", "recipient_email",
  "email_verification", "qualification", "source_label", "copy_version",
  "copy_approval_status", "copy_subject", "copy_text", "acknowledgement_idempotency_key",
  "state", "attempt_count", "provider_message_id", "last_attempt_at",
  "reconciliation_required", "follow_up_policy", "created_at",
].join(",");

const CANDIDATE_COLUMNS = [
  "candidate_id", "source_system", "source_ref", "source_timestamp", "candidate_type",
  "proposed_target", "payload", "confidence", "evidence_basis", "candidate_state",
  "review_status", "last_review_action", "founder_edited_payload", "founder_edited_target",
  "reviewed_at", "created_at", "canonical", "automatic_apply", "parser_version",
  "supersedes_candidate_id", "superseded_by_candidate_id",
].join(",");

function websiteSubmissionHash(submissionId: string): string {
  // Kept local to avoid exporting raw public submission identifiers to storage.
  return createHash("sha256")
    .update(`hourglass:website-intake:v1:${submissionId}`)
    .digest("hex");
}

function requireRow(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object") throw new Error(`${label}-not-found`);
  return value as Record<string, unknown>;
}

function databaseError(error: { message?: string; code?: string } | null, fallback: string): void {
  if (!error) return;
  throw new Error(error.message || error.code || fallback);
}

function identityFromRow(row: Record<string, unknown>): IdentityResolution {
  if (row.identity_status === "matched" && row.person_id) {
    return { status: "matched", personId: String(row.person_id) };
  }
  if (row.identity_status === "new" && row.person_id) {
    return { status: "new", personId: String(row.person_id) };
  }
  return { status: "needs_review", personId: null };
}

function recordFromRows(
  submissionId: string,
  intake: Record<string, unknown>,
  outbox: Record<string, unknown>,
  candidateRow: Record<string, unknown>,
): ConciergeFunnelRecord {
  const candidate = rowToCandidate(candidateRow);
  if (candidate.payload.kind !== "open_job") throw new Error("invalid-concierge-candidate");
  const identity = identityFromRow(intake);
  const attribution = intake.attribution as WebsiteInquiry["attribution"];
  const inquiry: WebsiteInquiry = {
    submissionId,
    fullName: String(intake.full_name),
    email: String(intake.email),
    phone: intake.phone == null ? "" : String(intake.phone),
    preferredContactMethod: intake.preferred_contact_method as WebsiteInquiry["preferredContactMethod"],
    category: intake.category as WebsiteInquiry["category"],
    projectType: String(intake.project_type),
    shapeInterest: String(intake.shape_interest),
    designDirection: String(intake.design_direction),
    ringPresence: String(intake.ring_presence),
    timeline: String(intake.timeline),
    budgetRange: String(intake.budget_range),
    inspirationNotes: String(intake.inspiration_notes),
    attribution,
    source: String(intake.source),
    acknowledgementExpected: intake.acknowledgement_state !== "not_expected",
    synthetic: Boolean(intake.synthetic),
  };
  const createdAt = String(outbox.created_at);
  const intakeId = String(intake.intake_id);
  return {
    intake: {
      eventId: String(outbox.event_id),
      eventType: "concierge.intake.received",
      eventVersion: 1,
      intakeId,
      submissionId,
      idempotencyKey: String(outbox.concierge_idempotency_key),
      payloadHash: String(outbox.concierge_payload_hash),
      occurredAt: String(intake.submitted_at),
      inquiry,
      attribution,
      identity,
      emailVerification: outbox.email_verification as ConciergeFunnelRecord["intake"]["emailVerification"],
    },
    lead: {
      leadId: String(outbox.lead_id),
      intakeId,
      personId: identity.status === "needs_review" ? null : identity.personId,
      category: inquiry.category,
      qualification: outbox.qualification as ConciergeFunnelRecord["lead"]["qualification"],
      attribution,
      createdAt,
      canonicalProjectId: null,
    },
    nextAction: {
      actionId: String(outbox.action_id),
      intakeId,
      kind: "required_action",
      subject: candidate.payload.subject,
      detail: "Founder review is required before any canonical Project change or personal outreach.",
      waitingOnActor: "founder",
      reviewStatus: candidate.reviewStatus,
      writesCanonicalProject: false,
      candidate,
    },
    acknowledgement: {
      outboxId: String(outbox.outbox_id),
      intakeId,
      idempotencyKey: String(outbox.acknowledgement_idempotency_key),
      to: String(outbox.recipient_email),
      copy: {
        copyVersion: String(outbox.copy_version),
        approvalStatus: outbox.copy_approval_status as AcknowledgementOutboxItem["copy"]["approvalStatus"],
        subject: String(outbox.copy_subject),
        text: String(outbox.copy_text),
      },
      state: outbox.state as AcknowledgementOutboxItem["state"],
      attemptCount: Number(outbox.attempt_count),
      providerMessageId: outbox.provider_message_id == null ? null : String(outbox.provider_message_id),
      lastAttemptAt: outbox.last_attempt_at == null ? null : String(outbox.last_attempt_at),
      reconciliationRequired: Boolean(outbox.reconciliation_required),
      createdAt,
    },
    followUp: outbox.follow_up_policy as FollowUpPolicy,
  };
}

export class SupabaseConciergeFunnelStore implements ConciergeFunnelStore {
  constructor(private readonly client: SupabaseClient) {}

  async accept(record: ConciergeFunnelRecord): Promise<AcceptIntakeResult> {
    const existing = await this.getBySubmissionId(record.intake.submissionId);
    if (existing) {
      return conciergeAcceptancePayloadHash(existing) ===
        conciergeAcceptancePayloadHash(record)
        ? { status: "duplicate", record: existing }
        : { status: "idempotency_conflict" };
    }

    const { data, error } = await this.client.rpc(
      CONCIERGE_ACCEPTANCE_RPC,
      toSupabaseConciergeAcceptanceParams(record),
    );
    if (error) {
      if (error.message?.includes("idempotency-conflict")) {
        const raced = await this.getBySubmissionId(record.intake.submissionId);
        if (
          raced &&
          conciergeAcceptancePayloadHash(raced) ===
            conciergeAcceptancePayloadHash(record)
        ) {
          return { status: "duplicate", record: raced };
        }
        return { status: "idempotency_conflict" };
      }
      databaseError(error, "concierge-acceptance-failed");
    }
    const result = data as SupabaseConciergeAcceptanceResult | null;
    if (!result || !["created", "already-present"].includes(result.status)) {
      throw new Error("invalid-concierge-acceptance-result");
    }
    const stored = await this.getBySubmissionId(record.intake.submissionId);
    if (!stored) throw new Error("concierge-acceptance-reload-failed");
    return { status: result.status === "created" ? "created" : "duplicate", record: stored };
  }

  async getBySubmissionId(submissionId: string): Promise<ConciergeFunnelRecord | null> {
    const { data: intakeData, error: intakeError } = await this.client
      .from(INTAKE_TABLE)
      .select(INTAKE_COLUMNS)
      .eq("idempotency_key_hash", websiteSubmissionHash(submissionId))
      .maybeSingle();
    databaseError(intakeError, "concierge-intake-load-failed");
    if (!intakeData) return null;
    const intake = requireRow(intakeData, "website-intake");

    const { data: outboxData, error: outboxError } = await this.client
      .from(OUTBOX_TABLE)
      .select(OUTBOX_COLUMNS)
      .eq("intake_id", String(intake.intake_id))
      .maybeSingle();
    databaseError(outboxError, "concierge-outbox-load-failed");
    if (!outboxData) return null;
    const outbox = requireRow(outboxData, "concierge-outbox");

    const { data: candidateData, error: candidateError } = await this.client
      .from(CANDIDATE_TABLE)
      .select(CANDIDATE_COLUMNS)
      .eq("candidate_id", String(outbox.candidate_id))
      .maybeSingle();
    databaseError(candidateError, "concierge-candidate-load-failed");
    return recordFromRows(
      submissionId,
      intake,
      outbox,
      requireRow(candidateData, "concierge-candidate"),
    );
  }

  async updateAcknowledgement(item: AcknowledgementOutboxItem): Promise<void> {
    const { error } = await this.client.rpc(TRANSITION_RPC, {
      p_outbox_id: item.outboxId,
      p_acknowledgement_idempotency_key: item.idempotencyKey,
      p_state: item.state,
      p_attempt_count: item.attemptCount,
      p_provider_message_id: item.providerMessageId,
      p_last_attempt_at: item.lastAttemptAt,
      p_reconciliation_required: item.reconciliationRequired,
    });
    databaseError(error, "concierge-acknowledgement-transition-failed");
  }

  async listFounderActions(limit = 100): Promise<SterlingTodayNextAction[]> {
    const { data, error } = await this.client
      .from(OUTBOX_TABLE)
      .select("intake_id,candidate_id,source_label")
      .order("created_at", { ascending: true })
      .limit(limit);
    databaseError(error, "concierge-founder-actions-load-failed");
    const actions: SterlingTodayNextAction[] = [];
    for (const raw of data ?? []) {
      const row = requireRow(raw, "concierge-founder-action");
      const { data: candidateData, error: candidateError } = await this.client
        .from(CANDIDATE_TABLE)
        .select(CANDIDATE_COLUMNS)
        .eq("candidate_id", String(row.candidate_id))
        .eq("review_status", "pending")
        .maybeSingle();
      databaseError(candidateError, "concierge-founder-action-candidate-load-failed");
      if (!candidateData) continue;
      const candidate = rowToCandidate(requireRow(candidateData, "concierge-founder-action-candidate"));
      if (candidate.payload.kind !== "open_job") continue;
      const controlledAcceptance = candidate.evidenceBasis.ruleIds.includes(
        CONTROLLED_ACCEPTANCE_RULE,
      );
      actions.push({
        id: `attention:website-intake:${String(row.intake_id)}`,
        lane: "decision",
        title: controlledAcceptance
          ? "Synthetic Concierge acceptance"
          : "New Concierge inquiry",
        headline: candidate.payload.subject,
        detail: controlledAcceptance
          ? "Controlled Preview fixture only. Do not contact, book, or treat as customer work."
          : "Founder review is required before any canonical Project change or personal outreach.",
        projectId: null,
        projectTitle: null,
        sourceLabel: WEBSITE_CONCIERGE_SOURCE_LABEL,
        sourceHref: null,
        candidateIds: [candidate.candidateId],
        recap: null,
        proposedAction: null,
        specConflict: null,
        integrationSource: "concierge-funnel-preview",
        writesCanonicalProject: false,
      });
    }
    return actions;
  }
}
