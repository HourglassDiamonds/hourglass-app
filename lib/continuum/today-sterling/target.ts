import { createHash } from "node:crypto";
import type { SterlingTodayWorkingSet } from "./types";

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function buildSterlingTodayTargetWorkingSet(
  workingSet: SterlingTodayWorkingSet,
  workUnitId: string,
  options: { reviewedRequiredThreadIds?: readonly string[] } = {},
): SterlingTodayWorkingSet {
  const workUnit = workingSet.workUnits.find(row => row.workUnitId === workUnitId);
  if (!workUnit) throw new Error(`sterling-target-unknown-work-unit:${workUnitId}`);

  const reviewedRequiredThreadIds = [...new Set(
    (options.reviewedRequiredThreadIds ?? []).map((threadId) => threadId.trim()).filter(Boolean),
  )];
  const reviewedThreadSet = new Set(reviewedRequiredThreadIds);
  const reviewedEvidence = workingSet.evidence.filter((row) =>
    row.sourceType === "gmail" && row.threadId != null && reviewedThreadSet.has(row.threadId));
  const evidenceIds = new Set([...workUnit.evidenceRefs, ...reviewedEvidence.map((row) => row.evidenceId)]);
  const evidence = workingSet.evidence.filter(row => evidenceIds.has(row.evidenceId));
  const targetWorkUnit = reviewedRequiredThreadIds.length === 0 ? workUnit : {
    ...workUnit,
    threadIds: [...new Set([...workUnit.threadIds, ...reviewedRequiredThreadIds])],
    sourceRefs: [...new Set([...workUnit.sourceRefs, ...reviewedEvidence.map((row) => row.sourceRef)])],
    evidenceRefs: [...new Set([...workUnit.evidenceRefs, ...reviewedEvidence.map((row) => row.evidenceId)])],
    targetThreadBindings: reviewedRequiredThreadIds.map((threadId) => {
      const persistedCanonicalAssociation = workUnit.threadIds.includes(threadId);
      return {
        threadId,
        associationBasis: persistedCanonicalAssociation
          ? "persisted_work_unit" as const : "server_reviewed_target" as const,
        persistedCanonicalAssociation,
      };
    }),
  };
  const projectIds = new Set(workUnit.projectId ? [workUnit.projectId] : []);
  const projects = workingSet.projects.filter(row => projectIds.has(row.projectId));
  const jobs = workingSet.jobs.filter(row => row.projectId != null && projectIds.has(row.projectId));
  const personIds = new Set([
    ...projects.flatMap(project => project.people.map(person => person.personId)),
    ...jobs.flatMap(job => job.associatedPersonId ? [job.associatedPersonId] : []),
    ...evidence.flatMap(row => row.personIds),
  ]);
  const people = workingSet.people.filter(row => personIds.has(row.personId));
  const calendar = workingSet.calendar.filter(row => evidenceIds.has(row.evidenceId));
  const previousToday = workingSet.previousToday.filter(row =>
    workUnit.projectId != null && row.projectId === workUnit.projectId);
  const material = { sourceSnapshotId: workingSet.evidenceSnapshotId, workUnit: targetWorkUnit, projects, jobs, people,
    evidence, calendarAvailability: workingSet.calendarAvailability, calendar, previousToday };
  const targetDigest = digest(material);

  return {
    ...workingSet,
    runId: `${workingSet.runId}:target:${targetDigest.slice(0, 16)}`,
    evidenceSnapshotId: targetDigest,
    people,
    projects,
    jobs,
    evidence,
    workUnits: [targetWorkUnit],
    calendar,
    previousToday,
  };
}

export function summarizeSterlingTodayTargetPackage(workingSet: SterlingTodayWorkingSet) {
  if (workingSet.workUnits.length !== 1) throw new Error("sterling-target-summary-requires-one-work-unit");
  const workUnit = workingSet.workUnits[0]!;
  return {
    workUnit: {
      workUnitId: workUnit.workUnitId,
      kind: workUnit.kind,
      identityBasis: workUnit.identityBasis,
      projectId: workUnit.projectId,
      observedIdentifiers: workUnit.observedIdentifiers,
      typedIdentifiers: workUnit.typedIdentifiers,
      threadIds: workUnit.threadIds,
      targetThreadBindings: workUnit.targetThreadBindings ?? [],
      sourceRefs: workUnit.sourceRefs,
    },
    canonicalProjects: workingSet.projects.map(project => ({
      projectId: project.projectId,
      projectKind: project.projectKind,
      lifecycleStage: project.lifecycleStage,
      openJobIds: project.openJobIds,
      gmailThreadIds: project.gmailThreadIds,
    })),
    canonicalJobs: workingSet.jobs.map(job => ({
      jobId: job.jobId,
      projectId: job.projectId,
      kind: job.kind,
      responsibleParty: job.responsibleParty,
      state: job.state,
      dueAt: job.dueAt,
      deferredUntil: job.deferredUntil,
      sourceRef: job.sourceRef,
    })),
    chronology: workingSet.evidence.map(row => ({
      evidenceId: row.evidenceId,
      sourceRef: row.sourceRef,
      timestamp: row.timestamp,
      direction: row.direction,
      sourceType: row.sourceType,
      provenance: row.provenance,
      hasOperationalExcerpt: Boolean(row.excerpt),
      attachmentCount: row.attachmentFilenames.length,
    })),
    calendarAvailability: workingSet.calendarAvailability,
    unresolved: {
      canonicalProjectMissing: workUnit.projectId === null,
      canonicalPersonLinksMissing: workingSet.people.length === 0,
      exactEvidenceCount: workingSet.evidence.length,
    },
  };
}
