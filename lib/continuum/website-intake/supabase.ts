import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import type { HubSpotIntakeOutcome, WebsiteIntakeCommand, WebsiteIntakeResult, WebsiteIntakeStore } from "./types";
import { splitInquiryName } from "./validation";

function resultFromRpc(data: unknown): WebsiteIntakeResult {
  if (!data || typeof data !== "object") return { ok: false, reason: "unavailable" };
  const row = data as Record<string, unknown>;
  if (row.status !== "created" && row.status !== "already-present") return { ok: false, reason: "unavailable" };
  const identityStatus = row.identity_status;
  if (identityStatus !== "matched" && identityStatus !== "new" && identityStatus !== "needs_review" && identityStatus !== "synthetic") return { ok: false, reason: "unavailable" };
  const hubspotStatus = row.hubspot_status;
  if (hubspotStatus !== "pending" && hubspotStatus !== "succeeded" && hubspotStatus !== "failed" && hubspotStatus !== "skipped") return { ok: false, reason: "unavailable" };
  return {
    ok: true,
    status: row.status,
    intakeId: String(row.intake_id),
    identityStatus,
    personId: row.person_id == null ? null : String(row.person_id),
    jobId: row.job_id == null ? null : String(row.job_id),
    hubspotStatus,
  };
}

export class SupabaseWebsiteIntakeStore implements WebsiteIntakeStore {
  constructor(private readonly client: SupabaseClient) {}

  async ingest(command: WebsiteIntakeCommand): Promise<WebsiteIntakeResult> {
    const name = splitInquiryName(command.fullName);
    const { data, error } = await this.client.rpc("continuum_ingest_website_inquiry", {
      p_intake_id: command.intakeId,
      p_person_id: command.personId,
      p_email_identity_id: command.emailIdentityId,
      p_phone_identity_id: command.phoneIdentityId,
      p_identity_review_id: command.identityReviewId,
      p_job_id: command.jobId,
      p_job_mutation_id: command.jobMutationId,
      p_idempotency_key_hash: command.idempotencyKeyHash,
      p_payload_hash: command.payloadHash,
      p_payload: {
        full_name: command.fullName,
        given_name: name.givenName,
        family_name: name.familyName,
        email: command.email,
        phone: command.phone || null,
        email_hash: command.emailHash,
        phone_hash: command.phoneHash,
        preferred_contact_method: command.preferredContactMethod,
        category: command.category,
        project_type: command.projectType,
        shape_interest: command.shapeInterest,
        design_direction: command.designDirection,
        ring_presence: command.ringPresence,
        timeline: command.timeline,
        budget_range: command.budgetRange,
        inspiration_notes: command.inspirationNotes,
        attribution: command.attribution,
        source: command.source,
        acknowledgement_expected: command.acknowledgementExpected,
        synthetic: command.synthetic,
        submitted_at: command.submittedAt,
      },
    });
    if (error) {
      if ((error.message ?? "").includes("idempotency-conflict")) return { ok: false, reason: "idempotency-conflict" };
      return { ok: false, reason: "unavailable" };
    }
    return resultFromRpc(data);
  }

  async recordHubSpotOutcome(outcome: HubSpotIntakeOutcome): Promise<void> {
    const { error } = await this.client.rpc("continuum_record_website_intake_hubspot", {
      p_intake_id: outcome.intakeId,
      p_status: outcome.status,
      p_contact_id: outcome.contactId ?? null,
      p_deal_id: outcome.dealId ?? null,
      p_error_code: outcome.errorCode ?? null,
    });
    if (error) throw error;
  }
}

export function createSupabaseWebsiteIntakeStore(): SupabaseWebsiteIntakeStore | null {
  const client = getSupabaseAdmin();
  return client ? new SupabaseWebsiteIntakeStore(client) : null;
}
