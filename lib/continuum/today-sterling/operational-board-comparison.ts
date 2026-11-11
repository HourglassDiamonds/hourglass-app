export type OperationalBoardDisposition =
  | "founder_action"
  | "waiting_on_client"
  | "waiting_on_shop"
  | "watching"
  | "resolved"
  | "cancelled"
  | "suppressed"
  | "ambiguous";

export type OperationalBoardOwner = "founder" | "client" | "vendor_shop" | "none" | "unknown";

export type OperationalBoardIdentity = {
  workUnitId: string;
  personId: string | null;
  projectId: string | null;
  jobId: string | null;
  exactSourceRefs: readonly string[];
};

export type ManualObligationAuditRow = OperationalBoardIdentity & {
  label: string;
  material: boolean;
  disposition: OperationalBoardDisposition;
  owner: OperationalBoardOwner;
  lifecycleStage: string | null;
  jobsExpectedClosed: readonly string[];
};

export type ShadowBoardAuditRow = OperationalBoardIdentity & {
  label: string;
  disposition: OperationalBoardDisposition;
  owner: OperationalBoardOwner;
  lifecycleStage: string | null;
  openJobIds: readonly string[];
};

export type OperationalBoardMismatch = {
  workUnitId: string;
  label: string;
  reason: string;
};

export type OperationalBoardComparison = {
  passed: boolean;
  missedMaterialObligations: readonly OperationalBoardMismatch[];
  falseFounderMoves: readonly OperationalBoardMismatch[];
  ownershipConflicts: readonly OperationalBoardMismatch[];
  unresolvedStaleJobs: readonly OperationalBoardMismatch[];
  staleActionsReappeared: readonly OperationalBoardMismatch[];
  duplicateWorkUnits: readonly OperationalBoardMismatch[];
};

const ACTIVE_DISPOSITIONS = new Set<OperationalBoardDisposition>([
  "founder_action",
  "waiting_on_client",
  "waiting_on_shop",
  "watching",
  "ambiguous",
]);

function normalized(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

function exactIdentityMatches(expected: ManualObligationAuditRow, actual: ShadowBoardAuditRow): boolean {
  if (expected.workUnitId !== actual.workUnitId) return false;
  if (expected.personId !== null && expected.personId !== actual.personId) return false;
  if (expected.projectId !== null && expected.projectId !== actual.projectId) return false;
  if (expected.jobId !== null && expected.jobId !== actual.jobId) return false;
  const actualSources = new Set(normalized(actual.exactSourceRefs));
  return normalized(expected.exactSourceRefs).every((sourceRef) => actualSources.has(sourceRef));
}

function mismatch(row: { workUnitId: string; label: string }, reason: string): OperationalBoardMismatch {
  return { workUnitId: row.workUnitId, label: row.label, reason };
}

function ordered(rows: readonly OperationalBoardMismatch[]): OperationalBoardMismatch[] {
  return [...rows].sort((left, right) =>
    left.workUnitId.localeCompare(right.workUnitId) || left.reason.localeCompare(right.reason));
}

/**
 * Compares an already-produced shadow board with a founder-reviewed manual audit.
 * This function does not infer identity, lifecycle, or ownership. Exact identity and
 * source bindings must be resolved before a row can satisfy an expected obligation.
 */
export function compareOperationalBoard(input: {
  expected: readonly ManualObligationAuditRow[];
  actual: readonly ShadowBoardAuditRow[];
}): OperationalBoardComparison {
  const expectedByWorkUnit = new Map(input.expected.map((row) => [row.workUnitId, row]));
  const actualByWorkUnit = new Map<string, ShadowBoardAuditRow[]>();
  for (const row of input.actual) {
    actualByWorkUnit.set(row.workUnitId, [...(actualByWorkUnit.get(row.workUnitId) ?? []), row]);
  }

  const duplicateWorkUnits = [...actualByWorkUnit.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([workUnitId, rows]) => mismatch(rows[0]!, `duplicate-shadow-rows:${workUnitId}:${rows.length}`));

  const missedMaterialObligations: OperationalBoardMismatch[] = [];
  const ownershipConflicts: OperationalBoardMismatch[] = [];
  const unresolvedStaleJobs: OperationalBoardMismatch[] = [];
  const staleActionsReappeared: OperationalBoardMismatch[] = [];

  for (const expected of input.expected) {
    const candidates = actualByWorkUnit.get(expected.workUnitId) ?? [];
    const exact = candidates.find((actual) => exactIdentityMatches(expected, actual));
    if (!exact) {
      if (expected.material && ACTIVE_DISPOSITIONS.has(expected.disposition)) {
        missedMaterialObligations.push(mismatch(expected,
          candidates.length === 0 ? "missing-shadow-row" : "identity-or-source-binding-mismatch"));
      }
      continue;
    }

    if (expected.owner !== exact.owner || expected.disposition !== exact.disposition) {
      ownershipConflicts.push(mismatch(expected,
        `expected:${expected.disposition}/${expected.owner};actual:${exact.disposition}/${exact.owner}`));
    }
    if (expected.lifecycleStage !== null && expected.lifecycleStage !== exact.lifecycleStage) {
      ownershipConflicts.push(mismatch(expected,
        `expected-lifecycle:${expected.lifecycleStage};actual:${exact.lifecycleStage ?? "absent"}`));
    }

    const staleJobs = normalized(expected.jobsExpectedClosed)
      .filter((jobId) => new Set(normalized(exact.openJobIds)).has(jobId));
    for (const jobId of staleJobs) {
      unresolvedStaleJobs.push(mismatch(expected, `expected-closed-job-remains-open:${jobId}`));
    }

    if (!ACTIVE_DISPOSITIONS.has(expected.disposition) && ACTIVE_DISPOSITIONS.has(exact.disposition)) {
      staleActionsReappeared.push(mismatch(expected,
        `terminal:${expected.disposition};reappeared:${exact.disposition}`));
    }
  }

  const falseFounderMoves = input.actual
    .filter((actual) => actual.disposition === "founder_action")
    .flatMap((actual) => {
      const expected = expectedByWorkUnit.get(actual.workUnitId);
      if (!expected) return [mismatch(actual, "no-founder-reviewed-obligation")];
      if (!exactIdentityMatches(expected, actual)) return [mismatch(actual, "identity-or-source-binding-mismatch")];
      if (expected.disposition !== "founder_action" || expected.owner !== "founder") {
        return [mismatch(actual, `expected:${expected.disposition}/${expected.owner}`)];
      }
      return [];
    });

  const result = {
    missedMaterialObligations: ordered(missedMaterialObligations),
    falseFounderMoves: ordered(falseFounderMoves),
    ownershipConflicts: ordered(ownershipConflicts),
    unresolvedStaleJobs: ordered(unresolvedStaleJobs),
    staleActionsReappeared: ordered(staleActionsReappeared),
    duplicateWorkUnits: ordered(duplicateWorkUnits),
  };
  return {
    passed: Object.values(result).every((rows) => rows.length === 0),
    ...result,
  };
}
