import { isExactGmailHexId } from "@/lib/continuum/candidates/exact-gmail-ids";
import type { SterlingTodayWorkingSet } from "./types";
import type { SterlingTodayScopeDefinition } from "./scope";

type WorkUnit = SterlingTodayWorkingSet["workUnits"][number];

export type SterlingTargetResolution = {
  selected: WorkUnit | null;
  secondary: readonly WorkUnit[];
  requiredThreadIds: readonly string[];
  blockedReason:
    | "no-matching-work-unit"
    | "ambiguous-work-unit"
    | "target-required-evidence-exceeds-budget"
    | "target-required-evidence-missing"
    | null;
};

/**
 * Resolves a fixed server-owned target without letting loosely matching
 * provisional units expand its retrieval frontier.
 */
export function resolveSterlingTarget(input: {
  workingSet: SterlingTodayWorkingSet;
  definition: SterlingTodayScopeDefinition;
  matchingUnits: readonly WorkUnit[];
  canonicalProjectIds: ReadonlySet<string>;
  requestBudget?: number;
}): SterlingTargetResolution {
  const exactProjectIds = new Set(input.definition.exactProjectIds ?? []);
  const canonical = input.matchingUnits.filter((unit) =>
    unit.kind === "canonical_project" && unit.projectId != null &&
    (exactProjectIds.has(unit.projectId) || input.canonicalProjectIds.has(unit.projectId)));
  const exactSource = input.matchingUnits.filter((unit) =>
    (input.definition.exactJobIds ?? []).some((jobId) => unit.evidenceRefs.includes(`canonical:job:${jobId}`)));
  const exactThread = input.matchingUnits.filter((unit) =>
    (input.definition.exactThreadIds ?? []).some((threadId) => unit.threadIds.includes(threadId)));
  const selected = canonical.length === 1 ? canonical[0]!
    : exactSource.length === 1 ? exactSource[0]!
      : exactThread.length === 1 ? exactThread[0]!
        : input.matchingUnits.length === 1 ? input.matchingUnits[0]! : null;
  if (!selected) {
    return { selected: null, secondary: input.matchingUnits, requiredThreadIds: [],
      blockedReason: input.matchingUnits.length === 0 ? "no-matching-work-unit" : "ambiguous-work-unit" };
  }

  const secondary = input.matchingUnits.filter((unit) => unit.workUnitId !== selected.workUnitId);
  const requiredThreadIds = [...new Set([
    ...(input.definition.exactThreadIds ?? []),
    ...selected.threadIds,
  ])];
  const indexedThreadIds = new Set(input.workingSet.evidence.flatMap((row) => row.threadId ? [row.threadId] : []));
  if (requiredThreadIds.some((threadId) => !isExactGmailHexId(threadId) || !indexedThreadIds.has(threadId))) {
    return { selected, secondary, requiredThreadIds, blockedReason: "target-required-evidence-missing" };
  }
  if (requiredThreadIds.length > (input.requestBudget ?? 48)) {
    return { selected, secondary, requiredThreadIds, blockedReason: "target-required-evidence-exceeds-budget" };
  }
  return { selected, secondary, requiredThreadIds, blockedReason: null };
}

