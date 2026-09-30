import type { CurrentWorkProjection } from "../../chief-of-staff/operating-loop/current-work";
import type { AttentionTargetAssessment } from "./attention-eligibility";
import type { ProjectJob } from "./types";

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
