import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { composeTodayDocket } from "./docket";
import { presentAttentionJobs } from "./attention-presentation";
import type { AttentionMetadataV1, ProjectJob } from "../../client-memory/project-jobs/types";
import type { CosOperatingLoopView } from "./types";
import type { CurrentWorkProjection } from "./current-work";

const metadata: AttentionMetadataV1 = { version: 1, timingPrecision: "exact-instant", timezone: "America/New_York",
  originalWording: "Friday", referenceInstant: "2026-09-30T14:00:00Z", originalLocalDateTime: "2026-10-02T09:00:00",
  conditionPolicy: "review-only", assumptions: [] };
function job(extra: Partial<ProjectJob>): ProjectJob { return { jobId: randomUUID(), projectId: null, kind: "required_action",
  subject: "Follow up", detail: null, waitingOnActor: "founder", associatedPersonId: null, state: "open", dueAt: null,
  deferredUntil: null, resolvedAt: null, cancelledAt: null, createdAt: "2026-09-30T14:00:00Z",
  updatedAt: "2026-09-30T14:00:00Z", createdBy: "founder", sourceSystem: "concierge-manual", sourceRef: null,
  createdMutationId: randomUUID(), attentionMode: "action", activationAt: null, checkpointAt: null,
  attentionMetadata: null, ...extra }; }

test("Today attention presentation distinguishes now, later, due, waiting, and terminal", () => {
  const rows = presentAttentionJobs({ jobs: [
    job({ attentionMode: "reminder", activationAt: "2026-10-01T12:00:00Z", attentionMetadata: metadata }),
    job({ attentionMode: "reminder", activationAt: "2026-10-03T12:00:00Z", attentionMetadata: metadata }),
    job({ attentionMode: "watching", waitingOnActor: "client", checkpointAt: "2026-10-01T12:00:00Z", attentionMetadata: metadata }),
    job({ attentionMode: "watching", waitingOnActor: "client", checkpointAt: "2026-10-03T12:00:00Z", attentionMetadata: metadata }),
    job({ attentionMode: "watching", waitingOnActor: "client", state: "resolved", resolvedAt: "2026-10-01T10:00:00Z",
      checkpointAt: "2026-10-03T12:00:00Z", attentionMetadata: metadata }),
  ], projects: new Map(), nowIso: "2026-10-02T12:00:00Z", newMutationId: randomUUID });
  assert.deepEqual(rows.map((row) => row.status), ["actionable-now", "scheduled-later", "checkpoint-due", "still-waiting", "terminal-resolved"]);
});

test("Today keeps future Reminder and Watching rows visible without turning missing evidence into a fact", () => {
  const attentionItems = presentAttentionJobs({ jobs: [
    job({ attentionMode: "reminder", activationAt: "2026-10-03T12:00:00Z", attentionMetadata: metadata }),
    job({ attentionMode: "watching", waitingOnActor: "client", checkpointAt: null,
      attentionMetadata: { ...metadata, conditionText: "Dylan approves", unscheduledConfirmed: true } }),
  ], projects: new Map(), nowIso: "2026-10-02T12:00:00Z", newMutationId: randomUUID });
  const loop = { contractVersion: "cos-operating-loop-v1", status: "caught-up", heading: "Caught up", quietDetail: null,
    top5: [], remainingCount: 0, brief: [], watching: [], needsYourDecision: [], worthKnowing: [], recap: [], anomalies: [],
    proposedActions: [], attentionItems } as CosOperatingLoopView;
  const docket = composeTodayDocket(loop);
  assert.deepEqual(docket.watching.map((row) => row.attention?.status), ["scheduled-later", "still-waiting"]);
  assert.match(docket.watching[1].detail, /No authoritative resolution has been observed/);
  assert.doesNotMatch(docket.watching[1].detail, /has not responded/i);
});

test("Today retires a Watch only for an exact authoritative satisfied obligation", () => {
  const watched = job({ attentionMode: "watching", waitingOnActor: "client", checkpointAt: "2026-10-01T12:00:00Z",
    attentionMetadata: { ...metadata, obligationIdentity: "obligation:revision-2" } });
  const satisfied = { workstreamId: "project:1", stage: "cad_review", dependency: null, ballHolder: "unknown",
    activeObligations: [], historicalObligations: [{ id: "o", identity: "obligation:revision-2", scope: "cad:C1",
      kind: "cad", deliverable: "revision approval", revision: "2", actor: "client", openedBy: "gmail:1",
      closedBy: "gmail:2", status: "satisfied" }], commitment: null, controllingSourceRefs: [],
    asOf: "2026-10-02T10:00:00Z", provenance: [] } satisfies CurrentWorkProjection;
  const [row] = presentAttentionJobs({ jobs: [watched], projects: new Map(), nowIso: "2026-10-02T12:00:00Z",
    projections: [satisfied], newMutationId: randomUUID });
  assert.equal(row.status, "terminal-resolved");
});
