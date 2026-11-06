import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { ProjectDeskSummary } from "@/lib/continuum/client-memory/project-desk/types";
import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";
import type { ClientWebsiteIntake } from "@/lib/continuum/client-memory/read/website-intake";
import { parseGmailCandidateSourceRef } from "@/lib/continuum/gmail/candidates/source-ref";
import type { ConditionalHoldRecord } from "@/lib/continuum/sterling/holds/types";

const FIXTURE_MARKERS = [
  "continuum-preview-acceptance",
  "sterling-preview-acceptance",
  "preview_test",
  "preview fixture",
  "preview client —",
  "preview project —",
  "synthetic acceptance",
  "synthetic fixture",
  "sterling acceptance sandbox",
  "test client alpha",
  "test client beta",
  "test engagement ring",
  "test wedding band",
  "sandbox cad-design",
  "sandbox wedding band",
  "sandbox repair/service",
  "cad-900001",
  "@healthcheck.invalid",
] as const;

export function containsOperationalFixtureMarker(...values: readonly unknown[]): boolean {
  const text = values
    .filter((value): value is string => typeof value === "string")
    .join("\n")
    .toLowerCase();
  return FIXTURE_MARKERS.some((marker) => text.includes(marker));
}

export function isOperationalProjectSummary(summary: ProjectDeskSummary): boolean {
  return !containsOperationalFixtureMarker(
    summary.sourceSystem,
    summary.title,
    summary.latestNotePreview,
    ...summary.people.map((person) => person.displayName),
  );
}

export function isOperationalProjectJob(job: ProjectJob, operationalProjectIds: ReadonlySet<string>): boolean {
  if (job.projectId && !operationalProjectIds.has(job.projectId)) return false;
  return !containsOperationalFixtureMarker(
    job.createdBy,
    job.sourceSystem,
    job.sourceRef,
    job.subject,
    job.detail,
    job.attentionMetadata?.originalWording,
  );
}

export function isOperationalCandidate(
  candidate: ContinuumCandidate,
  currentOrTrustedGmailThreadIds: ReadonlySet<string>,
): boolean {
  if (containsOperationalFixtureMarker(
    candidate.sourceRef,
    candidate.parserVersion,
    candidate.evidenceBasis.matchedText,
    JSON.stringify(candidate.payload),
    JSON.stringify(candidate.proposedTarget),
  )) return false;
  if (candidate.sourceSystem !== "gmail") return true;
  const threadId = parseGmailCandidateSourceRef(candidate.sourceRef)?.threadId ?? null;
  return Boolean(threadId && currentOrTrustedGmailThreadIds.has(threadId));
}

export function isOperationalWebsiteIntake(intake: ClientWebsiteIntake): boolean {
  return !containsOperationalFixtureMarker(
    intake.fullName,
    intake.email,
    intake.inspirationNotes,
    intake.source,
    intake.lifecycle.projectTitle,
  );
}

export function isOperationalConditionalHold(hold: ConditionalHoldRecord): boolean {
  return !containsOperationalFixtureMarker(
    hold.entityId,
    hold.projectId,
    hold.createdBy,
    hold.reason,
    ...hold.sourceRefs,
    JSON.stringify(hold.condition),
  );
}
