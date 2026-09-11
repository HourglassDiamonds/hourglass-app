/**
 * Retain observed real Gmail provenance on generated operating-mail candidates.
 * Does not guess threads that were not ingested. Does not change sourceRef.
 */

import {
  CANDIDATE_SOURCE_REF_MAX,
  type ContinuumCandidate,
} from "@/lib/continuum/candidates/types";
import { proposalKeyOf } from "@/lib/continuum/candidates/identity";
import { candidateHasGeneratedOperatingMailRule } from "./generated-source";
import { parseGmailCandidateSourceRef } from "./source-ref";

export function cloneEvidenceBasis(
  basis: ContinuumCandidate["evidenceBasis"],
): ContinuumCandidate["evidenceBasis"] {
  return {
    ruleIds: [...basis.ruleIds],
    matchedText: basis.matchedText,
    supportingSourceRefs: basis.supportingSourceRefs?.length
      ? [...basis.supportingSourceRefs]
      : undefined,
  };
}

export function sanitizeSupportingGmailSourceRefs(
  raw: unknown,
): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed.startsWith("gc1|")) continue;
    if (trimmed.length > CANDIDATE_SOURCE_REF_MAX) continue;
    if (!parseGmailCandidateSourceRef(trimmed)) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out.length > 0 ? out : undefined;
}

function workFingerprint(row: ContinuumCandidate): string {
  const payload = row.founderEditedPayload ?? row.payload;
  return `${row.candidateType}|${payload.kind}|${proposalKeyOf(payload)}`;
}

function projectIdOf(row: ContinuumCandidate): string | null {
  const target = row.founderEditedTarget ?? row.proposedTarget;
  if (target.kind === "none" || target.kind === "person") return null;
  return target.projectId;
}

function isObservedRealGmail(row: ContinuumCandidate): boolean {
  if (row.sourceSystem !== "gmail") return false;
  if (row.reviewStatus === "discarded") return false;
  if (candidateHasGeneratedOperatingMailRule(row.evidenceBasis.ruleIds)) {
    return false;
  }
  return parseGmailCandidateSourceRef(row.sourceRef) != null;
}

function unionSourceRefs(
  existing: readonly string[] | undefined,
  incoming: readonly string[],
  exclude: string,
): string[] | undefined {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const ref of [...(existing ?? []), ...incoming]) {
    if (ref === exclude) continue;
    if (!parseGmailCandidateSourceRef(ref)) continue;
    if (seen.has(ref)) continue;
    seen.add(ref);
    out.push(ref);
  }
  return out.length > 0 ? out : undefined;
}

/**
 * Copy observed real Gmail sourceRefs onto generated restatements of the same work.
 * Ambiguous multi-project matches without a generated project stay unattached.
 */
export function attachObservedSupportingGmailProvenance(
  rows: readonly ContinuumCandidate[],
): ContinuumCandidate[] {
  const real = rows.filter(isObservedRealGmail);
  if (real.length === 0) return [...rows];

  return rows.map((row) => {
    if (row.sourceSystem !== "gmail") return row;
    if (!candidateHasGeneratedOperatingMailRule(row.evidenceBasis.ruleIds)) {
      return row;
    }
    const fingerprint = workFingerprint(row);
    const generatedProjectId = projectIdOf(row);
    let matches = real.filter(
      (other) =>
        other.candidateId !== row.candidateId &&
        other.sourceRef !== row.sourceRef &&
        workFingerprint(other) === fingerprint,
    );
    if (generatedProjectId) {
      matches = matches.filter(
        (other) => projectIdOf(other) === generatedProjectId,
      );
    } else {
      const projectIds = [
        ...new Set(
          matches.map(projectIdOf).filter((id): id is string => Boolean(id)),
        ),
      ];
      if (projectIds.length > 1) return row;
    }
    const supporting = unionSourceRefs(
      row.evidenceBasis.supportingSourceRefs,
      matches.map((other) => other.sourceRef),
      row.sourceRef,
    );
    if (!supporting) return row;
    const current = row.evidenceBasis.supportingSourceRefs ?? [];
    if (
      supporting.length === current.length &&
      supporting.every((ref, index) => ref === current[index])
    ) {
      return row;
    }
    return {
      ...row,
      evidenceBasis: {
        ...cloneEvidenceBasis(row.evidenceBasis),
        supportingSourceRefs: supporting,
      },
    };
  });
}

export function mergeSupportingGmailProvenance(
  existing: ContinuumCandidate,
  incoming: ContinuumCandidate,
): ContinuumCandidate | null {
  const merged = unionSourceRefs(
    existing.evidenceBasis.supportingSourceRefs,
    incoming.evidenceBasis.supportingSourceRefs ?? [],
    existing.sourceRef,
  );
  const current = existing.evidenceBasis.supportingSourceRefs ?? [];
  if (!merged) return null;
  if (
    merged.length === current.length &&
    merged.every((ref, index) => ref === current[index])
  ) {
    return null;
  }
  return {
    ...existing,
    evidenceBasis: {
      ...cloneEvidenceBasis(existing.evidenceBasis),
      supportingSourceRefs: merged,
    },
  };
}
