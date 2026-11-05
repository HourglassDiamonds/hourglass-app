import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hashStoredPersonEmail } from "@/lib/continuum/client-memory/hashes";
import { coerceGmailThreadId } from "@/lib/continuum/client-memory/gmail";
import { PROJECT_EVIDENCE_TABLE } from "@/lib/continuum/project-evidence/types";
import { founderAssociationReviewKey, isFixtureAssociationSource } from "./real-client-association";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type FounderAssociationDecision = "confirm" | "reject";
export type FounderAssociationStatus = "trusted" | "rejected";

export type FounderAssociationRecord = {
  id: string;
  projectId: string;
  threadId: string;
  status: FounderAssociationStatus;
  updatedAt: string;
};

export type FounderAssociationFacts = {
  threadId: string;
  postAuthorizationMessageCount: number;
  participantHashes: readonly string[];
  projectNumbers: readonly string[];
  person: { id: string; label: string; email: string | null; sourceSystem: string } | null;
  project: { id: string; label: string; sourceSystem: string } | null;
  job: { id: string; projectId: string | null; associatedPersonId: string | null; sourceSystem: string } | null;
  activeRelationship: boolean;
  current: FounderAssociationRecord | null;
  trustedOtherProjectId: string | null;
};

export type FounderAssociationDecisionStore = {
  loadFacts(input: {
    threadId: string;
    personId: string;
    projectId: string;
    jobId: string | null;
  }): Promise<FounderAssociationFacts | null | "not-activated">;
  insert(input: {
    id: string;
    projectId: string;
    threadId: string;
    status: FounderAssociationStatus;
    basis: Record<string, unknown>;
    reviewedAt: string;
    reviewedBy: string;
  }): Promise<"saved" | "conflict" | "unavailable">;
  updateIfUnchanged(input: {
    id: string;
    expectedUpdatedAt: string;
    status: FounderAssociationStatus;
    basis: Record<string, unknown>;
    reviewedAt: string;
    reviewedBy: string;
  }): Promise<"saved" | "conflict" | "unavailable">;
};

export type PersistFounderAssociationResult =
  | { ok: true; status: FounderAssociationStatus }
  | {
      ok: false;
      reason:
        | "invalid"
        | "not-activated"
        | "not-found"
        | "fixture"
        | "identity-unverified"
        | "relationship-unverified"
        | "job-unverified"
        | "conflict"
        | "replayed"
        | "unavailable";
    };

function cleanActor(value: string): string | null {
  const next = value.replace(/\s+/g, " ").trim();
  return next && next.length <= 80 && !/[\u0000-\u001f]/.test(next) ? next : null;
}

function cleanId(value: string): string | null {
  const next = value.trim();
  return UUID.test(next) ? next : null;
}

export async function persistFounderAssociationDecision(input: {
  threadId: string;
  personId: string;
  projectId: string;
  jobId: string | null;
  reviewKey: string;
  decision: FounderAssociationDecision;
  reviewedBy: string;
  store: FounderAssociationDecisionStore;
  now?: Date;
}): Promise<PersistFounderAssociationResult> {
  const canonicalThread = coerceGmailThreadId(input.threadId);
  const personId = cleanId(input.personId);
  const projectId = cleanId(input.projectId);
  const jobId = input.jobId ? cleanId(input.jobId) : null;
  const actor = cleanActor(input.reviewedBy);
  if (
    canonicalThread.status !== "canonical" ||
    !personId ||
    !projectId ||
    (input.jobId && !jobId) ||
    !/^[a-f0-9]{64}$/.test(input.reviewKey) ||
    !actor ||
    (input.decision !== "confirm" && input.decision !== "reject")
  ) {
    return { ok: false, reason: "invalid" };
  }
  const facts = await input.store.loadFacts({
    threadId: canonicalThread.value,
    personId,
    projectId,
    jobId,
  });
  if (facts === "not-activated") return { ok: false, reason: "not-activated" };
  if (!facts || facts.postAuthorizationMessageCount < 1 || !facts.person || !facts.project) {
    return { ok: false, reason: "not-found" };
  }
  if (
    isFixtureAssociationSource(facts.person.sourceSystem, facts.person.label) ||
    isFixtureAssociationSource(facts.project.sourceSystem, facts.project.label) ||
    (facts.job && isFixtureAssociationSource(facts.job.sourceSystem))
  ) {
    return { ok: false, reason: "fixture" };
  }
  const personHash = hashStoredPersonEmail(facts.person.email);
  if (!personHash || !facts.participantHashes.includes(personHash)) {
    return { ok: false, reason: "identity-unverified" };
  }
  if (!facts.activeRelationship) return { ok: false, reason: "relationship-unverified" };
  if (
    jobId &&
    (!facts.job ||
      facts.job.id !== jobId ||
      facts.job.projectId !== projectId ||
      (facts.job.associatedPersonId != null && facts.job.associatedPersonId !== personId))
  ) {
    return { ok: false, reason: "job-unverified" };
  }
  const expectedKey = founderAssociationReviewKey({
    threadId: facts.threadId,
    personId,
    projectId,
    jobId,
    current: facts.current,
  });
  if (expectedKey !== input.reviewKey) return { ok: false, reason: "replayed" };
  if (input.decision === "confirm" && facts.trustedOtherProjectId) {
    return { ok: false, reason: "conflict" };
  }

  const status: FounderAssociationStatus = input.decision === "confirm" ? "trusted" : "rejected";
  const reviewedAt = (input.now ?? new Date()).toISOString();
  const basis = {
    flags: [
      status === "trusted" ? "founder_approval" : "founder_rejection",
      "exact_canonical_email",
      "founder_explicit_linkage",
    ],
    projectNumbers: [...new Set(facts.projectNumbers)].slice(0, 12),
    conflictingProjectNumbers: [],
    attachmentNames: [],
    targetPersonId: personId,
    targetJobId: jobId,
  };
  const saved = facts.current
    ? await input.store.updateIfUnchanged({
        id: facts.current.id,
        expectedUpdatedAt: facts.current.updatedAt,
        status,
        basis,
        reviewedAt,
        reviewedBy: actor,
      })
    : await input.store.insert({
        id: randomUUID(),
        projectId,
        threadId: facts.threadId,
        status,
        basis,
        reviewedAt,
        reviewedBy: actor,
      });
  if (saved === "conflict") return { ok: false, reason: "replayed" };
  if (saved !== "saved") return { ok: false, reason: "unavailable" };
  return { ok: true, status };
}

function missingTable(error: { code?: string; message?: string } | null): boolean {
  const message = (error?.message ?? "").toLowerCase();
  return error?.code === "42P01" || error?.code === "PGRST205" || message.includes("schema cache") || message.includes("does not exist");
}

function text(value: unknown): string | null {
  const next = value == null ? "" : String(value).trim();
  return next || null;
}

export function createSupabaseFounderAssociationDecisionStore(
  client: SupabaseClient,
): FounderAssociationDecisionStore {
  return {
    async loadFacts(input) {
      const [messages, connection, person, project, relationship, job, decisions, attachments] = await Promise.all([
        client.from("continuum_gmail_messages")
          .select("indexed_at,from_email_hash,to_email_hashes,cc_email_hashes,bcc_email_hashes")
          .eq("thread_id", input.threadId).limit(100),
        client.from("continuum_gmail_connections").select("connected_at").eq("mailbox_slot", "founder-v1").limit(1).maybeSingle(),
        client.from("continuum_person_profiles").select("person_id,display_name,email,source_system").eq("person_id", input.personId).limit(1).maybeSingle(),
        client.from("continuum_project_profiles").select("project_id,display_title,source_system").eq("project_id", input.projectId).limit(1).maybeSingle(),
        client.from("continuum_relationships").select("id").eq("from_entity_id", input.personId).eq("to_entity_id", input.projectId).eq("kind", "client-project").eq("status", "active").limit(1),
        input.jobId
          ? client.from("continuum_project_jobs").select("job_id,project_id,associated_person_id,source_system").eq("job_id", input.jobId).limit(1).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        client.from(PROJECT_EVIDENCE_TABLE).select("id,project_id,source_identity,status,updated_at").eq("source_type", "gmail").eq("source_identity", input.threadId).limit(20),
        client.from("continuum_gmail_attachments").select("filename").eq("thread_id", input.threadId).limit(100),
      ]);
      if (decisions.error && missingTable(decisions.error)) return "not-activated";
      if ([messages, connection, person, project, relationship, job, decisions, attachments].some((result) => result.error)) return null;
      const authorizationAt = Date.parse(text(connection.data?.connected_at) ?? "");
      const postAuthorization = (messages.data ?? []).filter((row) => Date.parse(String(row.indexed_at)) > authorizationAt);
      const participantHashes = new Set<string>();
      for (const row of messages.data ?? []) {
        for (const value of [row.from_email_hash, ...(row.to_email_hashes ?? []), ...(row.cc_email_hashes ?? []), ...(row.bcc_email_hashes ?? [])]) {
          const hash = text(value);
          if (hash) participantHashes.add(hash);
        }
      }
      const records: FounderAssociationRecord[] = (decisions.data ?? [])
        .filter((row) => row.status === "trusted" || row.status === "rejected")
        .map((row) => ({
          id: String(row.id), projectId: String(row.project_id), threadId: String(row.source_identity),
          status: row.status as FounderAssociationStatus, updatedAt: String(row.updated_at),
        }));
      const current = records.find((row) => row.projectId === input.projectId) ?? null;
      const trustedOtherProjectId = records.find((row) => row.status === "trusted" && row.projectId !== input.projectId)?.projectId ?? null;
      const numberPattern = /(?<![A-Za-z0-9])(C\d{5,}|SP\d{4,}|RN\d{4,})(?![A-Za-z0-9])/gi;
      const projectNumbers = [...new Set((attachments.data ?? []).flatMap((row) => String(row.filename ?? "").match(numberPattern) ?? []).map((value) => value.toUpperCase()))];
      return {
        threadId: input.threadId,
        postAuthorizationMessageCount: postAuthorization.length,
        participantHashes: [...participantHashes],
        projectNumbers,
        person: person.data ? { id: String(person.data.person_id), label: String(person.data.display_name), email: text(person.data.email), sourceSystem: String(person.data.source_system) } : null,
        project: project.data ? { id: String(project.data.project_id), label: String(project.data.display_title), sourceSystem: String(project.data.source_system) } : null,
        job: job.data ? { id: String(job.data.job_id), projectId: text(job.data.project_id), associatedPersonId: text(job.data.associated_person_id), sourceSystem: String(job.data.source_system) } : null,
        activeRelationship: Boolean(relationship.data?.length),
        current,
        trustedOtherProjectId,
      };
    },
    async insert(input) {
      const result = await client.from(PROJECT_EVIDENCE_TABLE).insert({
        id: input.id, project_id: input.projectId, source_type: "gmail", source_identity: input.threadId,
        source_thread_id: input.threadId, status: input.status, basis: input.basis,
        proposed_at: input.reviewedAt, reviewed_at: input.reviewedAt, reviewed_by: input.reviewedBy,
        created_at: input.reviewedAt, updated_at: input.reviewedAt,
      });
      if (!result.error) return "saved";
      return result.error.code === "23505" ? "conflict" : "unavailable";
    },
    async updateIfUnchanged(input) {
      const result = await client.from(PROJECT_EVIDENCE_TABLE).update({
        status: input.status, basis: input.basis, reviewed_at: input.reviewedAt,
        reviewed_by: input.reviewedBy, updated_at: input.reviewedAt,
      }).eq("id", input.id).eq("updated_at", input.expectedUpdatedAt).select("id");
      if (result.error) return result.error.code === "23505" ? "conflict" : "unavailable";
      return result.data?.length === 1 ? "saved" : "conflict";
    },
  };
}
