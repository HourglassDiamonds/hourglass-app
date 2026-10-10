import { createHash } from "node:crypto";
import type { TodayLiveThreadOutcome } from "@/lib/continuum/gmail/today-thread-context";
import type { SterlingTodayWorkingSet } from "./types";

export const STERLING_EVIDENCE_COMPLETENESS_STATUSES = [
  "complete_live_evidence",
  "complete_independent_evidence",
  "indexed_excerpt_only",
  "unavailable_required_evidence",
  "legitimately_ambiguous_evidence",
] as const;

export type SterlingEvidenceCompletenessStatus =
  (typeof STERLING_EVIDENCE_COMPLETENESS_STATUSES)[number];

export type SterlingWorkUnitEvidenceCompleteness = {
  workUnitId: string;
  status: SterlingEvidenceCompletenessStatus;
  modelEligible: boolean;
  requiredThreadCount: number;
  completeLiveThreadCount: number;
  indexedOnlyThreadCount: number;
  unavailableThreadCount: number;
  safeErrorCategories: readonly string[];
  basis:
    | "live_gmail"
    | "canonical_facts"
    | "founder_correction"
    | "indexed_excerpt"
    | "unavailable_required"
    | "insufficient_evidence";
};

export type SterlingEvidenceCompletenessReport = {
  workUnits: readonly SterlingWorkUnitEvidenceCompleteness[];
  aggregate: {
    totalWorkUnitCount: number;
    modelEligibleWorkUnitCount: number;
    blockedWorkUnitCount: number;
    countsByStatus: Readonly<Record<SterlingEvidenceCompletenessStatus, number>>;
    safeErrorCategories: readonly string[];
  };
};

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function unique(values: readonly (string | null | undefined)[]): string[] {
  return [...new Set(values.map((value) => value?.trim() ?? "").filter(Boolean))].sort();
}

/**
 * Identifies required Gmail evidence only from existing exact work-unit
 * associations. Founder corrections take precedence, while canonical-only
 * units remain eligible without manufacturing a Gmail dependency.
 */
export function evaluateSterlingEvidenceCompleteness(input: {
  workingSet: SterlingTodayWorkingSet;
  threadOutcomes: readonly TodayLiveThreadOutcome[];
}): SterlingEvidenceCompletenessReport {
  const evidenceById = new Map(input.workingSet.evidence.map((row) => [row.evidenceId, row]));
  const outcomes = new Map(input.threadOutcomes.map((row) => [row.threadId, row]));
  const workUnits = input.workingSet.workUnits.map((unit): SterlingWorkUnitEvidenceCompleteness => {
    const evidence = unit.evidenceRefs.flatMap((ref) => {
      const row = evidenceById.get(ref);
      return row ? [row] : [];
    });
    const founderCorrection = evidence.some((row) => row.sourceType === "founder_directive");
    const nonCanonical = evidence.some((row) => row.sourceType !== "canonical");
    const canonicalFacts = evidence.some((row) => row.sourceType === "canonical");

    if (founderCorrection) {
      return {
        workUnitId: unit.workUnitId,
        status: "complete_independent_evidence",
        modelEligible: true,
        requiredThreadCount: 0,
        completeLiveThreadCount: 0,
        indexedOnlyThreadCount: 0,
        unavailableThreadCount: 0,
        safeErrorCategories: [],
        basis: "founder_correction",
      };
    }
    if (canonicalFacts && !nonCanonical) {
      return {
        workUnitId: unit.workUnitId,
        status: "complete_independent_evidence",
        modelEligible: true,
        requiredThreadCount: 0,
        completeLiveThreadCount: 0,
        indexedOnlyThreadCount: 0,
        unavailableThreadCount: 0,
        safeErrorCategories: [],
        basis: "canonical_facts",
      };
    }

    const requiredThreadIds = unique([
      ...unit.threadIds,
      ...evidence.map((row) => row.threadId),
    ]);
    if (requiredThreadIds.length === 0) {
      return {
        workUnitId: unit.workUnitId,
        status: "legitimately_ambiguous_evidence",
        modelEligible: false,
        requiredThreadCount: 0,
        completeLiveThreadCount: 0,
        indexedOnlyThreadCount: 0,
        unavailableThreadCount: 0,
        safeErrorCategories: [],
        basis: "insufficient_evidence",
      };
    }

    let completeLiveThreadCount = 0;
    let indexedOnlyThreadCount = 0;
    let unavailableThreadCount = 0;
    const safeErrorCategories = new Set<string>();
    for (const threadId of requiredThreadIds) {
      const outcome = outcomes.get(threadId);
      if (outcome?.status === "complete_live") {
        completeLiveThreadCount += 1;
      } else if (outcome?.status === "unavailable") {
        unavailableThreadCount += 1;
        if (outcome.safeErrorCategory) safeErrorCategories.add(outcome.safeErrorCategory);
      } else {
        indexedOnlyThreadCount += 1;
        if (outcome?.safeErrorCategory) safeErrorCategories.add(outcome.safeErrorCategory);
      }
    }
    if (unavailableThreadCount > 0) {
      return {
        workUnitId: unit.workUnitId,
        status: "unavailable_required_evidence",
        modelEligible: false,
        requiredThreadCount: requiredThreadIds.length,
        completeLiveThreadCount,
        indexedOnlyThreadCount,
        unavailableThreadCount,
        safeErrorCategories: [...safeErrorCategories].sort(),
        basis: "unavailable_required",
      };
    }
    if (indexedOnlyThreadCount > 0) {
      return {
        workUnitId: unit.workUnitId,
        status: "indexed_excerpt_only",
        modelEligible: false,
        requiredThreadCount: requiredThreadIds.length,
        completeLiveThreadCount,
        indexedOnlyThreadCount,
        unavailableThreadCount: 0,
        safeErrorCategories: [...safeErrorCategories].sort(),
        basis: "indexed_excerpt",
      };
    }
    return {
      workUnitId: unit.workUnitId,
      status: "complete_live_evidence",
      modelEligible: true,
      requiredThreadCount: requiredThreadIds.length,
      completeLiveThreadCount,
      indexedOnlyThreadCount: 0,
      unavailableThreadCount: 0,
      safeErrorCategories: [],
      basis: "live_gmail",
    };
  });

  const countsByStatus = Object.fromEntries(
    STERLING_EVIDENCE_COMPLETENESS_STATUSES.map((status) => [
      status,
      workUnits.filter((row) => row.status === status).length,
    ]),
  ) as Record<SterlingEvidenceCompletenessStatus, number>;
  return {
    workUnits,
    aggregate: {
      totalWorkUnitCount: workUnits.length,
      modelEligibleWorkUnitCount: workUnits.filter((row) => row.modelEligible).length,
      blockedWorkUnitCount: workUnits.filter((row) => !row.modelEligible).length,
      countsByStatus,
      safeErrorCategories: unique(workUnits.flatMap((row) => row.safeErrorCategories)),
    },
  };
}

export function buildSterlingEvidenceReadyWorkingSet(input: {
  workingSet: SterlingTodayWorkingSet;
  completeness: SterlingEvidenceCompletenessReport;
  requestedWorkUnitIds?: readonly string[];
}): { workingSet: SterlingTodayWorkingSet | null; blockedWorkUnitIds: readonly string[] } {
  const requested = new Set(input.requestedWorkUnitIds ?? input.workingSet.workUnits.map((row) => row.workUnitId));
  const eligible = new Set(input.completeness.workUnits
    .filter((row) => requested.has(row.workUnitId) && row.modelEligible)
    .map((row) => row.workUnitId));
  const blockedWorkUnitIds = input.completeness.workUnits
    .filter((row) => requested.has(row.workUnitId) && !row.modelEligible)
    .map((row) => row.workUnitId)
    .sort();
  if (eligible.size === 0) return { workingSet: null, blockedWorkUnitIds };

  const workUnits = input.workingSet.workUnits.filter((row) => eligible.has(row.workUnitId));
  if (workUnits.length === input.workingSet.workUnits.length) {
    return { workingSet: input.workingSet, blockedWorkUnitIds };
  }
  const evidenceIds = new Set(workUnits.flatMap((row) => row.evidenceRefs));
  const projectIds = new Set(workUnits.flatMap((row) => row.projectId ? [row.projectId] : []));
  const evidence = input.workingSet.evidence.filter((row) => evidenceIds.has(row.evidenceId));
  const projects = input.workingSet.projects.filter((row) => projectIds.has(row.projectId));
  const jobs = input.workingSet.jobs.filter((row) => row.projectId != null && projectIds.has(row.projectId));
  const personIds = new Set([
    ...projects.flatMap((project) => project.people.map((person) => person.personId)),
    ...jobs.flatMap((job) => job.associatedPersonId ? [job.associatedPersonId] : []),
    ...evidence.flatMap((row) => row.personIds),
  ]);
  const people = input.workingSet.people.filter((row) => personIds.has(row.personId));
  const calendar = input.workingSet.calendar.filter((row) => evidenceIds.has(row.evidenceId));
  const previousToday = input.workingSet.previousToday.filter((row) => row.projectId != null && projectIds.has(row.projectId));
  const material = {
    sourceSnapshotId: input.workingSet.evidenceSnapshotId,
    workUnits,
    projects,
    jobs,
    people,
    evidence,
    calendarAvailability: input.workingSet.calendarAvailability,
    calendar,
    previousToday,
  };
  const subsetDigest = digest(material);
  return {
    workingSet: {
      ...input.workingSet,
      runId: `${input.workingSet.runId}:evidence:${subsetDigest.slice(0, 16)}`,
      evidenceSnapshotId: subsetDigest,
      workUnits,
      projects,
      jobs,
      people,
      evidence,
      calendar,
      previousToday,
    },
    blockedWorkUnitIds,
  };
}

export async function executeSterlingEvidenceGatedRequest<T>(input: {
  workingSet: SterlingTodayWorkingSet;
  completeness: SterlingEvidenceCompletenessReport;
  requestedWorkUnitIds?: readonly string[];
  request: (workingSet: SterlingTodayWorkingSet) => Promise<T>;
}): Promise<{
  called: boolean;
  workingSet: SterlingTodayWorkingSet | null;
  blockedWorkUnitIds: readonly string[];
  result: T | null;
}> {
  const prepared = buildSterlingEvidenceReadyWorkingSet(input);
  if (!prepared.workingSet) return { called: false, workingSet: null, blockedWorkUnitIds: prepared.blockedWorkUnitIds, result: null };
  return {
    called: true,
    workingSet: prepared.workingSet,
    blockedWorkUnitIds: prepared.blockedWorkUnitIds,
    result: await input.request(prepared.workingSet),
  };
}
