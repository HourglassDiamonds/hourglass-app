/**
 * Stable Candidate identity. Same evidence + same proposal = same id.
 * Different Project proposals from the same evidence stay distinct.
 * Does not truncate source_ref.
 */

import { createHash } from "node:crypto";
import type {
  CandidateIdentityKey,
  CandidatePayload,
  ContinuumCandidate,
  ContinuumCandidateDraft,
  ProposedCanonicalTarget,
} from "./types";

export function sha256Utf8(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function clipMatchedText(text: string, max = 80): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= max) return collapsed;
  return collapsed.slice(0, max);
}

function targetIdOf(target: ProposedCanonicalTarget): string | null {
  if (target.kind === "none") return null;
  if (target.kind === "person") return target.personId;
  if (target.kind === "project") return target.projectId;
  if (target.kind === "project_spec") return target.projectId;
  return target.projectId;
}

function targetFieldOf(target: ProposedCanonicalTarget): string | null {
  if (target.kind === "project_spec") return target.fieldName;
  return null;
}

export function proposalKeyOf(payload: CandidatePayload): string {
  switch (payload.kind) {
    case "person_association":
      return `person:${(payload.emailHash ?? "").toLowerCase()}:${(payload.displayName ?? "").trim().toLowerCase()}`;
    case "project_association":
      return `project:${(payload.token ?? payload.title ?? "").trim().toLowerCase()}`;
    case "project_context":
      return `ctx:${payload.topic.trim().toLowerCase()}:${payload.value.trim().toLowerCase()}`;
    case "note":
      return `note:${payload.text.trim().toLowerCase()}`;
    case "structured_spec":
      return `spec:${payload.fieldName}:${payload.proposedValue.trim().toLowerCase()}`;
    case "open_job":
      return `job:${payload.jobKind}:${payload.waitingOnActor}:${payload.subject.trim().toLowerCase()}`;
    case "date":
      return `date:${payload.raw.trim().toLowerCase()}:${payload.isoDate ?? ""}`;
    case "follow_up":
      return `follow:${payload.text.trim().toLowerCase()}:${payload.dueAt ?? ""}`;
  }
}

export function candidateIdentityKey(
  row: Pick<
    ContinuumCandidateDraft,
    "sourceSystem" | "sourceRef" | "candidateType" | "proposedTarget" | "payload"
  >,
): CandidateIdentityKey {
  return {
    sourceSystem: row.sourceSystem,
    sourceRef: row.sourceRef,
    candidateType: row.candidateType,
    targetKind: row.proposedTarget.kind,
    targetId: targetIdOf(row.proposedTarget),
    targetField: targetFieldOf(row.proposedTarget),
    proposalKey: proposalKeyOf(row.payload),
  };
}

export function candidateIdFromIdentity(key: CandidateIdentityKey): string {
  return sha256Utf8(
    JSON.stringify([
      key.sourceSystem,
      key.sourceRef,
      key.candidateType,
      key.targetKind,
      key.targetId ?? "",
      key.targetField ?? "",
      key.proposalKey,
    ]),
  );
}

export function assignCandidateId(
  draft: ContinuumCandidateDraft,
): ContinuumCandidate {
  const candidateId = candidateIdFromIdentity(candidateIdentityKey(draft));
  return {
    ...draft,
    candidateId,
    createdAt: draft.createdAt ?? draft.sourceTimestamp,
    canonical: false,
    automaticApply: false,
    supersedesCandidateId: draft.supersedesCandidateId ?? null,
    supersededByCandidateId: draft.supersededByCandidateId ?? null,
  };
}

export function logicalProposalKey(row: ContinuumCandidate): string {
  const target = candidateIdentityKey(row);
  return [
    row.candidateType,
    target.targetKind,
    target.targetId ?? "",
    target.targetField ?? "",
    target.proposalKey,
  ].join("|");
}
