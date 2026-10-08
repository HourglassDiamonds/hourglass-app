import type { CurrentWorkProjection } from "../../chief-of-staff/operating-loop/current-work";
import type { AttentionTargetAssessment } from "./attention-eligibility";
import type { ProjectJob } from "./types";
import type { SourceCommunicationEvent } from "../../source-events/types";

const UNKNOWN: AttentionTargetAssessment = { status: "unknown", authoritative: false };

/**
 * Matches only explicit persisted target identities to Current Truth evidence.
 * A missing match is unknown, never proof that a dependency remains unresolved.
 */
export function assessAttentionTarget(
  job: Pick<ProjectJob, "attentionMetadata">,
  projections: readonly CurrentWorkProjection[],
): AttentionTargetAssessment {
  const metadata = job.attentionMetadata;
  if (!metadata) return UNKNOWN;
  for (const projection of projections) {
    if (metadata.obligationIdentity) {
      const active = projection.activeObligations.find((row) => row.identity === metadata.obligationIdentity);
      if (active) return { status: "valid", authoritative: true };
      const historical = projection.historicalObligations.find((row) => row.identity === metadata.obligationIdentity);
      if (historical) return { status: historical.status === "active" ? "valid" : historical.status, authoritative: true };
    }
    if (metadata.sourceReference) {
      const matches = (row: CurrentWorkProjection["activeObligations"][number]) =>
        row.openedBy === metadata.sourceReference &&
        (!metadata.revisionReference || row.revision === metadata.revisionReference);
      if (projection.activeObligations.some(matches)) return { status: "valid", authoritative: true };
      const historical = projection.historicalObligations.find(matches);
      if (historical) return { status: historical.status === "active" ? "valid" : historical.status, authoritative: true };
    }
    if (metadata.commitmentReference && projection.commitment?.sourceRef === metadata.commitmentReference) {
      return { status: "valid", authoritative: true };
    }
  }
  return UNKNOWN;
}

const PHASE_ADVANCEMENT_ORIGINS = new Set([
  "founder_requests_vendor",
  "vendor_order_confirmation",
  "workshop_started",
  "work_ready",
  "work_complete",
]);

const PHASE_ACTION =
  /\b(?:(?:stone|center|cad|design|render|sample)\b.{0,48}\b(?:review|selection|select|approve|approval)|(?:review|selection|select|approve|approval)\b.{0,48}\b(?:stone|center|cad|design|render|sample)|(?:in[- ]person|client)\b.{0,32}\b(?:appointment|consultation)|place (?:the )?order)\b/i;

/**
 * A later, project-bound phase transition can retire a phase action from the
 * read model even before the canonical Job mutation is written. This is
 * deliberately narrow: unrelated founder obligations on the same Project do
 * not disappear merely because some other work advanced.
 */
export function actionJobAdvancedByCurrentTruth(
  job: Pick<ProjectJob, "projectId" | "subject" | "detail" | "updatedAt">,
  projections: readonly {
    projectId: string | null;
    projection: CurrentWorkProjection;
    sourceEvents?: readonly SourceCommunicationEvent[];
  }[],
): boolean {
  if (!job.projectId) return false;
  if (!PHASE_ACTION.test(`${job.subject} ${job.detail ?? ""}`)) return false;
  const updatedAt = Date.parse(job.updatedAt);
  if (!Number.isFinite(updatedAt)) return false;
  return projections.some(({ projectId, projection, sourceEvents }) => {
    if (projectId !== job.projectId || projection.ballHolder === "founder") return false;
    return (sourceEvents ?? []).some((event) => {
      const timestamp = Date.parse(event.timestamp);
      return (
        PHASE_ADVANCEMENT_ORIGINS.has(event.semanticClass) &&
        Number.isFinite(timestamp) &&
        timestamp > updatedAt
      );
    });
  });
}
