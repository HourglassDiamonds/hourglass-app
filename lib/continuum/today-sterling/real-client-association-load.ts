import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import { PROJECT_EVIDENCE_TABLE } from "@/lib/continuum/project-evidence/types";
import {
  buildRealClientAssociationBatch,
  type AssociationJob,
  type AssociationMessage,
  type AssociationPerson,
  type AssociationProject,
  type AssociationRelationship,
  type RealClientAssociationBatch,
  type ReviewedAssociation,
} from "./real-client-association";

const PAGE_SIZE = 1000;
const MAX_MESSAGE_ROWS = 10_000;

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function missingRelation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return error.code === "42P01" || error.code === "PGRST205" || message.includes("schema cache") || message.includes("does not exist");
}

async function loadAllMessages(client: SupabaseClient): Promise<AssociationMessage[]> {
  const rows: AssociationMessage[] = [];
  for (let from = 0; from < MAX_MESSAGE_ROWS; from += PAGE_SIZE) {
    const result = await client
      .from("continuum_gmail_messages")
      .select("message_id,thread_id,subject,sent_at,indexed_at,direction,from_email_hash,to_email_hashes,cc_email_hashes,bcc_email_hashes")
      .order("indexed_at", { ascending: true })
      .order("message_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (result.error) throw result.error;
    const page = result.data ?? [];
    for (const row of page) {
      const fromHash = row.from_email_hash == null ? [] : [String(row.from_email_hash)];
      rows.push({
        messageId: String(row.message_id),
        threadId: String(row.thread_id),
        subject: String(row.subject ?? ""),
        sentAt: String(row.sent_at),
        indexedAt: String(row.indexed_at),
        direction: row.direction === "inbound" || row.direction === "outbound" ? row.direction : "unknown",
        participantHashes: [...new Set([...fromHash, ...strings(row.to_email_hashes), ...strings(row.cc_email_hashes), ...strings(row.bcc_email_hashes)])],
      });
    }
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

export async function loadRealClientAssociationBatch(
  client: SupabaseClient,
  now = new Date(),
): Promise<RealClientAssociationBatch> {
  const [messages, peopleResult, projectsResult, jobsResult, relationshipsResult, connectionResult, associationResult] = await Promise.all([
    loadAllMessages(client),
    client.from("continuum_person_profiles").select("person_id,display_name,email,source_system").limit(500),
    client.from("continuum_project_profiles").select("project_id,display_title,source_system").limit(500),
    client.from("continuum_project_jobs").select("job_id,project_id,subject,state,waiting_on_actor,source_system").limit(1000),
    client.from("continuum_relationships").select("from_entity_id,to_entity_id,kind,status").eq("kind", "client-project").eq("status", "active").limit(1000),
    client.from("continuum_gmail_connections").select("connected_at").eq("mailbox_slot", "founder-v1").limit(1).maybeSingle(),
    client.from(PROJECT_EVIDENCE_TABLE).select("id,project_id,source_identity,status,updated_at").eq("source_type", "gmail").in("status", ["trusted", "rejected"]).limit(1000),
  ]);
  for (const result of [peopleResult, projectsResult, jobsResult, relationshipsResult, connectionResult]) {
    if (result.error) throw result.error;
  }
  const associationPersistence = associationResult.error
    ? missingRelation(associationResult.error) ? "missing" : "unavailable"
    : "available";
  const people: AssociationPerson[] = (peopleResult.data ?? []).map((row) => ({
    personId: String(row.person_id),
    label: String(row.display_name ?? "Person"),
    emailHash: hashEmail(row.email == null ? null : String(row.email)),
    sourceSystem: String(row.source_system ?? ""),
  }));
  const projects: AssociationProject[] = (projectsResult.data ?? []).map((row) => ({
    projectId: String(row.project_id),
    label: String(row.display_title ?? "Project"),
    sourceSystem: String(row.source_system ?? ""),
  }));
  const jobs: AssociationJob[] = (jobsResult.data ?? []).map((row) => ({
    jobId: String(row.job_id),
    projectId: row.project_id == null ? null : String(row.project_id),
    label: String(row.subject ?? "Job"),
    state: String(row.state ?? ""),
    waitingOn: String(row.waiting_on_actor ?? "unknown"),
    sourceSystem: String(row.source_system ?? ""),
  }));
  const relationships: AssociationRelationship[] = (relationshipsResult.data ?? []).map((row) => ({
    personId: String(row.from_entity_id),
    projectId: String(row.to_entity_id),
  }));
  const reviewedAssociations: ReviewedAssociation[] = associationResult.error ? [] : (associationResult.data ?? []).map((row) => ({
    id: String(row.id),
    projectId: String(row.project_id),
    threadId: String(row.source_identity),
    status: row.status === "trusted" ? "trusted" : "rejected",
    updatedAt: String(row.updated_at),
  }));
  return buildRealClientAssociationBatch({
    messages,
    people,
    projects,
    jobs,
    relationships,
    authorizationAt: connectionResult.data?.connected_at == null ? null : String(connectionResult.data.connected_at),
    trustedThreadIds: reviewedAssociations.filter((row) => row.status === "trusted").map((row) => row.threadId),
    reviewedAssociations,
    associationPersistence,
    nowIso: now.toISOString(),
  });
}
