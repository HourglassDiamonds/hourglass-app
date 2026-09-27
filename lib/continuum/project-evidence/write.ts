/**
 * Persist founder review of one evidence association.
 * Writes membership only. Does not change message text, Persons, Projects,
 * Today, work loops, Gmail, Calendar, or SMS.
 */

import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isProjectIdParam } from "@/lib/continuum/client-memory/read/presentation";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { projectEvidenceReviewKey } from "./discover";
import { readProjectEvidence } from "./load";
import { PROJECT_EVIDENCE_TABLE } from "./types";

export type ProjectEvidenceDecision = "trust" | "reject";

export type PersistProjectEvidenceResult =
  | { ok: true; status: "trusted" | "rejected" }
  | { ok: false; reason: "invalid" | "not-found" | "unavailable" | "not-activated" };

function reviewer(value: string): string | null {
  const next = value.replace(/\s+/g, " ").trim();
  if (!next || next.length > 80 || /[\u0000-\u001f]/.test(next)) return null;
  return next;
}

function missingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    (message.includes(PROJECT_EVIDENCE_TABLE) &&
      (message.includes("does not exist") ||
        message.includes("schema cache") ||
        message.includes("could not find")))
  );
}

export async function persistProjectEvidenceReview(input: {
  projectId: string;
  reviewKey: string;
  decision: ProjectEvidenceDecision;
  reviewedBy: string;
  client?: SupabaseClient | null;
}): Promise<PersistProjectEvidenceResult> {
  const projectId = input.projectId.trim();
  const reviewKey = input.reviewKey.trim();
  const actor = reviewer(input.reviewedBy);
  if (!isProjectIdParam(projectId) || !/^[a-f0-9]{64}$/.test(reviewKey) || !actor) {
    return { ok: false, reason: "invalid" };
  }
  if (input.decision !== "trust" && input.decision !== "reject") {
    return { ok: false, reason: "invalid" };
  }
  const client = input.client === undefined ? getSupabaseAdmin() : input.client;
  if (!client) return { ok: false, reason: "unavailable" };

  const profile = await client
    .from("continuum_project_profiles")
    .select("project_id, display_title")
    .eq("project_id", projectId)
    .limit(1);
  if (profile.error || !profile.data?.length) return { ok: false, reason: "not-found" };
  const history = await client
    .from("continuum_project_history")
    .select("cad_job_number, order_number, gmail_thread_id, match_judgment, match_judgment_raw")
    .eq("project_id", projectId)
    .limit(1);
  if (history.error) return { ok: false, reason: "unavailable" };
  const notes = await client
    .from("continuum_source_notes")
    .select("note_text")
    .eq("project_id", projectId)
    .limit(16);
  const row = history.data?.[0];
  const evidence = await readProjectEvidence(client, {
    projectId,
    projectLabel: String(profile.data[0]?.display_title ?? "Project"),
    history: row
      ? {
          cadJobNumber: row.cad_job_number == null ? null : String(row.cad_job_number),
          orderNumber: row.order_number == null ? null : String(row.order_number),
          gmailThreadId: row.gmail_thread_id == null ? null : String(row.gmail_thread_id),
          matchJudgment: row.match_judgment == null ? null : String(row.match_judgment),
          matchJudgmentRaw: row.match_judgment_raw == null ? null : String(row.match_judgment_raw),
        }
      : null,
    noteTexts: notes.error || !notes.data ? [] : notes.data.map((item) => String(item.note_text ?? "")),
  });
  const target = evidence.discovered.find(
    (item) =>
      (item.status === "candidate" || item.status === "ambiguous") &&
      projectEvidenceReviewKey(projectId, item.sourceIdentity) === reviewKey,
  );
  if (!target) return { ok: false, reason: "not-found" };

  const now = new Date().toISOString();
  const status = input.decision === "trust" ? "trusted" : "rejected";
  const flags = [
    ...target.basis.flags.filter((flag) => flag !== "founder_approval" && flag !== "founder_rejection"),
    status === "trusted" ? "founder_approval" : "founder_rejection",
  ];
  const basis = {
    flags,
    projectNumbers: target.basis.projectNumbers,
    conflictingProjectNumbers: target.basis.conflictingProjectNumbers,
    attachmentNames: target.basis.attachmentNames,
  };
  const existing = await client
    .from(PROJECT_EVIDENCE_TABLE)
    .select("id")
    .eq("project_id", projectId)
    .eq("source_type", "gmail")
    .eq("source_identity", target.sourceIdentity)
    .limit(1);
  if (existing.error) {
    if (missingTable(existing.error)) return { ok: false, reason: "not-activated" };
    return { ok: false, reason: "unavailable" };
  }
  const saved = existing.data?.length
    ? await client
        .from(PROJECT_EVIDENCE_TABLE)
        .update({
          status,
          basis,
          source_thread_id: target.sourceThreadId,
          reviewed_at: now,
          reviewed_by: actor,
          updated_at: now,
        })
        .eq("id", existing.data[0]?.id)
    : await client.from(PROJECT_EVIDENCE_TABLE).insert({
        id: randomUUID(),
        project_id: projectId,
        source_type: "gmail",
        source_identity: target.sourceIdentity,
        source_thread_id: target.sourceThreadId,
        status,
        basis,
        proposed_at: now,
        reviewed_at: now,
        reviewed_by: actor,
        created_at: now,
        updated_at: now,
      });
  if (saved.error) {
    if (missingTable(saved.error)) return { ok: false, reason: "not-activated" };
    return { ok: false, reason: "unavailable" };
  }
  return { ok: true, status };
}
