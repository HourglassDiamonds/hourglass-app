import { createHash } from "node:crypto";
import { scopeDefinition, scopeMatchesOperationalIdentifier } from "./scope";
import type { SterlingTodayWorkingSet } from "./types";

export type SterlingPreModelSuppressionReason =
  | "known_newsletter_source"
  | "known_solicitation_source"
  | "historical_case_without_current_qualification";

const CURRENT_QUALIFICATION_MS = 14 * 86_400_000;

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function sterlingPreModelSuppressions(
  workingSet: SterlingTodayWorkingSet,
  now = new Date(workingSet.generatedAt),
): Readonly<Record<string, SterlingPreModelSuppressionReason>> {
  const evidence = new Map(workingSet.evidence.map((row) => [row.evidenceId, row]));
  const newsletterThreads = new Set(scopeDefinition("noiseNewsletter")?.exactThreadIds ?? []);
  const solicitationThreads = new Set(scopeDefinition("noiseSolicitation")?.exactThreadIds ?? []);
  const duane = scopeDefinition("duane")!;
  const entries: Array<[string, SterlingPreModelSuppressionReason]> = [];
  for (const unit of workingSet.workUnits) {
    if (unit.threadIds.some((threadId) => newsletterThreads.has(threadId))) {
      entries.push([unit.workUnitId, "known_newsletter_source"]);
      continue;
    }
    if (unit.threadIds.some((threadId) => solicitationThreads.has(threadId))) {
      entries.push([unit.workUnitId, "known_solicitation_source"]);
      continue;
    }
    if (!scopeMatchesOperationalIdentifier(duane, unit.observedIdentifiers) || unit.kind === "canonical_project") continue;
    const rows = unit.evidenceRefs.flatMap((ref) => {
      const row = evidence.get(ref);
      return row ? [row] : [];
    });
    const hasCurrentCanonicalJob = rows.some((row) => row.sourceType === "canonical" && row.evidenceId.startsWith("canonical:job:"));
    const hasFounderCorrection = rows.some((row) => row.sourceType === "founder_directive");
    const latestOperationalAt = rows.filter((row) => row.sourceType === "gmail" || row.sourceType === "candidate")
      .map((row) => Date.parse(row.timestamp)).filter(Number.isFinite).sort((a, b) => b - a)[0];
    const fresh = latestOperationalAt != null && now.getTime() - latestOperationalAt <= CURRENT_QUALIFICATION_MS;
    if (!hasCurrentCanonicalJob && !hasFounderCorrection && !fresh) {
      entries.push([unit.workUnitId, "historical_case_without_current_qualification"]);
    }
  }
  return Object.fromEntries(entries);
}

export function excludeSterlingSuppressedWorkUnits(
  workingSet: SterlingTodayWorkingSet,
  suppressions: Readonly<Record<string, SterlingPreModelSuppressionReason>>,
): SterlingTodayWorkingSet {
  const workUnits = workingSet.workUnits.filter((unit) => suppressions[unit.workUnitId] == null);
  if (workUnits.length === workingSet.workUnits.length) return workingSet;
  const evidenceIds = new Set(workUnits.flatMap((unit) => unit.evidenceRefs));
  const projectIds = new Set(workUnits.flatMap((unit) => unit.projectId ? [unit.projectId] : []));
  const evidence = workingSet.evidence.filter((row) => evidenceIds.has(row.evidenceId));
  const projects = workingSet.projects.filter((row) => projectIds.has(row.projectId));
  const jobs = workingSet.jobs.filter((row) => row.projectId != null && projectIds.has(row.projectId));
  const personIds = new Set([
    ...projects.flatMap((project) => project.people.map((person) => person.personId)),
    ...jobs.flatMap((job) => job.associatedPersonId ? [job.associatedPersonId] : []),
    ...evidence.flatMap((row) => row.personIds),
  ]);
  const material = { sourceSnapshotId: workingSet.evidenceSnapshotId, workUnits, projects, jobs, evidence };
  return {
    ...workingSet,
    runId: `${workingSet.runId}:suppressed:${digest(material).slice(0, 16)}`,
    evidenceSnapshotId: digest(material),
    workUnits,
    projects,
    jobs,
    people: workingSet.people.filter((row) => personIds.has(row.personId)),
    evidence,
    calendar: workingSet.calendar.filter((row) => evidenceIds.has(row.evidenceId)),
    previousToday: workingSet.previousToday.filter((row) => row.projectId != null && projectIds.has(row.projectId)),
  };
}

