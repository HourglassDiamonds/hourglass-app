import "server-only";

import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import {
  CONTROLLED_ACCEPTANCE_RULE,
  CONTROLLED_ACCEPTANCE_SUBMISSION_ID,
} from "./controlled-acceptance";
import {
  createBookingRequest,
  prepareSterlingTodayNextAction,
} from "./preview-acceptance";
import { createSupabaseConciergeFunnelStore } from "./server";

function submissionHash(submissionId: string): string {
  return createHash("sha256")
    .update(`hourglass:website-intake:v1:${submissionId}`)
    .digest("hex");
}
function databaseError(
  error: { message?: string; code?: string } | null,
  fallback: string,
): void {
  if (error) throw new Error(error.message || error.code || fallback);
}

async function exactCount(
  query: PromiseLike<{ count: number | null; error: { message?: string; code?: string } | null }>,
  label: string,
): Promise<number> {
  const result = await query;
  databaseError(result.error, `${label}-count-failed`);
  return result.count ?? 0;
}

/** Fixed-fixture, server-only reload used by the authenticated control. */
export async function verifyControlledAcceptanceServer() {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("supabase-admin-unavailable");

  const record = await createSupabaseConciergeFunnelStore(admin).getBySubmissionId(
    CONTROLLED_ACCEPTANCE_SUBMISSION_ID,
  );
  if (!record) throw new Error("controlled-acceptance-not-found");

  const hash = submissionHash(CONTROLLED_ACCEPTANCE_SUBMISSION_ID);
  const { data: intake, error: intakeError } = await admin
    .from("continuum_website_intakes")
    .select(
      "intake_id,person_id,job_id,source,identity_status,attribution,synthetic,acknowledgement_state,hubspot_status,hubspot_contact_id,hubspot_deal_id",
    )
    .eq("idempotency_key_hash", hash)
    .single();
  databaseError(intakeError, "controlled-acceptance-intake-load-failed");
  if (!intake) throw new Error("controlled-acceptance-intake-not-found");

  const sourceRef = `website-intake:${String(intake.intake_id)}`;
  const [intakes, people, jobs, candidates, outbox] = await Promise.all([
    exactCount(
      admin
        .from("continuum_website_intakes")
        .select("intake_id", { count: "exact", head: true })
        .eq("idempotency_key_hash", hash),
      "intake",
    ),
    exactCount(
      admin
        .from("continuum_person_profiles")
        .select("person_id", { count: "exact", head: true })
        .eq("person_id", String(intake.person_id)),
      "person",
    ),
    exactCount(
      admin
        .from("continuum_project_jobs")
        .select("job_id", { count: "exact", head: true })
        .eq("job_id", String(intake.job_id)),
      "job",
    ),
    exactCount(
      admin
        .from("continuum_candidates")
        .select("candidate_id", { count: "exact", head: true })
        .eq("source_ref", sourceRef),
      "candidate",
    ),
    exactCount(
      admin
        .from("continuum_concierge_ack_outbox")
        .select("outbox_id", { count: "exact", head: true })
        .eq("intake_id", String(intake.intake_id)),
      "outbox",
    ),
  ]);

  const candidate = record.nextAction.candidate;
  const acceptanceFixture = candidate.evidenceBasis.ruleIds.includes(
    CONTROLLED_ACCEPTANCE_RULE,
  );
  const todayAction = prepareSterlingTodayNextAction(record);
  const booking = createBookingRequest(
    record,
    {
      start: "2026-11-12T18:00:00.000Z",
      end: "2026-11-12T19:00:00.000Z",
    },
    record.intake.occurredAt,
  );

  return {
    ok: true as const,
    identifiers: {
      intakeId: String(intake.intake_id),
      personId: intake.person_id == null ? null : String(intake.person_id),
      jobId: intake.job_id == null ? null : String(intake.job_id),
      candidateId: candidate.candidateId,
      outboxId: record.acknowledgement.outboxId,
    },
    counts: { intakes, people, jobs, candidates, outbox },
    attribution: intake.attribution,
    source: String(intake.source),
    sourceLabel: todayAction.sourceLabel,
    identityStatus: String(intake.identity_status),
    founderReview: {
      status: record.nextAction.reviewStatus,
      title: todayAction.title,
      headline: todayAction.headline,
      persistsAcrossReload: true,
      writesCanonicalProject: todayAction.writesCanonicalProject,
    },
    syntheticClassification: {
      acceptanceFixture,
      websiteIntakeSynthetic: Boolean(intake.synthetic),
      rule: CONTROLLED_ACCEPTANCE_RULE,
      compatibilityNote:
        "website-intake synthetic=true suppresses Person/Job persistence; this fixture is durably classified through reserved identity, attribution, notes and Candidate evidence.",
    },
    acknowledgement: {
      state: record.acknowledgement.state,
      attemptCount: record.acknowledgement.attemptCount,
      providerMessageId: record.acknowledgement.providerMessageId,
      reconciliationRequired: record.acknowledgement.reconciliationRequired,
    },
    booking,
    providerSafety: {
      hubspotContactId: intake.hubspot_contact_id,
      hubspotDealId: intake.hubspot_deal_id,
      hubspotStatus: intake.hubspot_status,
      outboundDeliveryAttempted: record.acknowledgement.attemptCount > 0,
    },
  };
}
