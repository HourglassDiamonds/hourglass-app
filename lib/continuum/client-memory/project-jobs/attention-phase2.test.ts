import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { assessAttentionTarget } from "./attention-evidence";
import { applyAttentionDisposition } from "./attention-application";
import { createInMemoryProjectJobStore } from "./store";
import { createInMemoryProjectJobWriter } from "./writer";
import { InMemoryClientMemoryStore } from "../store";
import type { AttentionMetadataV1, ProjectJob } from "./types";
import type { CurrentWorkProjection } from "../../chief-of-staff/operating-loop/current-work";
import { createProjectJob } from "./create";
import { disposeDocketItem } from "../../chief-of-staff/operating-loop/disposition";

const metadata = (extra: Partial<AttentionMetadataV1> = {}): AttentionMetadataV1 => ({ version: 1,
  timingPrecision: "exact-instant", timezone: "America/New_York", originalWording: "check Friday",
  referenceInstant: "2026-09-30T18:00:00Z", originalLocalDateTime: "2026-10-02T00:00:00",
  conditionPolicy: "review-only", assumptions: [], ...extra });
const job = (extra: Partial<ProjectJob> = {}): ProjectJob => ({ jobId: randomUUID(), projectId: null,
  kind: "commitment", subject: "Dylan approves revision", detail: null, waitingOnActor: "client", state: "open",
  associatedPersonId: null, dueAt: null, deferredUntil: null, resolvedAt: null, cancelledAt: null,
  createdAt: "2026-09-30T18:00:00Z", updatedAt: "2026-09-30T18:00:00Z", createdBy: "founder",
  sourceSystem: "concierge-manual", sourceRef: "capture:w1", createdMutationId: randomUUID(),
  attentionMode: "watching", activationAt: null, checkpointAt: "2026-10-02T04:00:00Z",
  attentionMetadata: metadata({ obligationIdentity: "obligation:revision-2" }), ...extra });
const projection = (status: "active" | "satisfied" | "superseded"): CurrentWorkProjection => ({
  workstreamId: "project:1", stage: "cad_review", dependency: "revision approval", ballHolder: "client",
  activeObligations: status === "active" ? [{ id: "o", identity: "obligation:revision-2", scope: "cad:C1",
    kind: "cad", deliverable: "revision approval", revision: "2", actor: "client", openedBy: "gmail:1",
    closedBy: null, status: "active" }] : [],
  historicalObligations: status === "active" ? [] : [{ id: "o", identity: "obligation:revision-2", scope: "cad:C1",
    kind: "cad", deliverable: "revision approval", revision: "2", actor: "client", openedBy: "gmail:1",
    closedBy: "gmail:2", status }], commitment: null, controllingSourceRefs: [], asOf: "2026-10-01T12:00:00Z",
  provenance: [],
});

test("authoritative target matching never converts missing evidence into non-response", () => {
  assert.deepEqual(assessAttentionTarget(job(), []), { status: "unknown", authoritative: false });
  assert.deepEqual(assessAttentionTarget(job(), [projection("active")]), { status: "valid", authoritative: true });
  assert.deepEqual(assessAttentionTarget(job(), [projection("satisfied")]), { status: "satisfied", authoritative: true });
  assert.deepEqual(assessAttentionTarget(job(), [projection("superseded")]), { status: "superseded", authoritative: true });
  assert.deepEqual(assessAttentionTarget(job({ attentionMetadata: metadata({ obligationIdentity: "different" }) }),
    [projection("satisfied")]), { status: "unknown", authoritative: false });
});

test("typed Watching dispositions preserve ball-holder and append explicit operation history", async () => {
  const memory = new InMemoryClientMemoryStore();
  const store = createInMemoryProjectJobStore();
  const initial = job();
  store.insertJob(initial, { operation: "create" });
  const writer = createInMemoryProjectJobWriter(memory, store, () => "2026-10-02T04:00:00Z");
  const checked = await applyAttentionDisposition(writer, { mode: "watching", mutationId: randomUUID(),
    projectId: null, jobId: initial.jobId, actor: "founder", disposition: { kind: "checked-still-waiting" } });
  assert.equal(checked.ok, true);
  if (checked.ok) {
    assert.equal(checked.job.waitingOnActor, "client");
    assert.equal(checked.job.checkpointAt, null);
    assert.equal(checked.job.attentionMetadata?.unscheduledConfirmed, true);
  }
  assert.deepEqual(store.listMutations().map((row) => row.action), ["create", "watch_checked"]);
  const stopped = await applyAttentionDisposition(writer, { mode: "watching", mutationId: randomUUID(),
    projectId: null, jobId: initial.jobId, actor: "founder", disposition: { kind: "stop-watching" } });
  assert.equal(stopped.ok && stopped.job.state, "cancelled");
  assert.deepEqual(store.listMutations().map((row) => row.action), ["create", "watch_checked", "stop_watching"]);
});

test("Reminder reschedule retains the prior schedule in history and is idempotent", async () => {
  const memory = new InMemoryClientMemoryStore(); const store = createInMemoryProjectJobStore();
  const initial = job({ attentionMode: "reminder", waitingOnActor: "founder", activationAt: "2026-10-02T13:00:00Z",
    checkpointAt: null, attentionMetadata: metadata({ obligationIdentity: undefined }) });
  store.insertJob(initial, { operation: "create" });
  const writer = createInMemoryProjectJobWriter(memory, store, () => "2026-10-01T12:00:00Z");
  const mutationId = randomUUID();
  const input = { mode: "reminder" as const, mutationId, projectId: null, jobId: initial.jobId, actor: "founder",
    disposition: { kind: "reschedule" as const, activationAt: "2026-10-03T13:00:00Z",
      metadata: metadata({ originalWording: "Saturday at 9 AM", originalLocalDateTime: "2026-10-03T09:00:00" }) } };
  const first = await applyAttentionDisposition(writer, input); const retry = await applyAttentionDisposition(writer, input);
  assert.equal(first.ok && first.job.activationAt, "2026-10-03T13:00:00.000Z");
  assert.equal(retry.ok && retry.status, "already-present");
  const mutation = store.listMutations().at(-1)!;
  assert.equal(mutation.action, "reschedule_attention");
  assert.equal(mutation.operation?.prior?.activationAt, "2026-10-02T13:00:00Z");
});

test("the canonical create primitive persists Reminder and Watching only when the explicit gate dependency is true", async () => {
  const store = createInMemoryProjectJobStore();
  const deps = { findAppliedOperation: async (id: string) => store.findAppliedOperation(id),
    nowIso: () => "2026-09-30T18:00:00Z", newJobId: randomUUID,
    getEntity: async () => null, getProjectProfile: async () => null, getPersonProfile: async () => null,
    hasActiveClientProjectRelationship: async () => false,
    listUnresolvedJobs: async (projectId: string | null) => store.listUnresolvedJobs(projectId),
    applyCreate: async (row: ProjectJob, request?: Record<string, unknown>) => store.insertJob(row, request),
    attentionCreationEnabled: () => true };
  const reminderMutation = randomUUID();
  const reminderInput = { mutationId: reminderMutation, projectId: null, kind: "required_action", subject: "Call Dylan",
    waitingOnActor: "founder", actor: "founder", attentionMode: "reminder", activationAt: "2026-10-01T17:00:00Z",
    attentionMetadata: metadata() };
  const reminder = await createProjectJob(deps, reminderInput);
  const retry = await createProjectJob(deps, reminderInput);
  const watching = await createProjectJob(deps, { mutationId: randomUUID(), projectId: null, kind: "commitment",
    subject: "Dylan approves", waitingOnActor: "client", actor: "founder", attentionMode: "watching",
    checkpointAt: null, attentionMetadata: metadata({ unscheduledConfirmed: true }) });
  assert.equal(reminder.ok && reminder.job.attentionMode, "reminder");
  assert.equal(retry.ok && retry.status, "already-present");
  assert.equal(watching.ok && watching.job.attentionMode, "watching");
  assert.equal(store.listMutations().length, 2);
});

test("Today routes checked-still-waiting through the typed Watching disposition", async () => {
  const memory = new InMemoryClientMemoryStore(); const store = createInMemoryProjectJobStore(); const initial = job();
  store.insertJob(initial, { operation: "create" });
  const writer = createInMemoryProjectJobWriter(memory, store, () => "2026-10-02T04:00:00Z");
  const result = await disposeDocketItem({ nowIso: () => "2026-10-02T04:00:00Z", jobs: writer }, {
    verb: "still_waiting", origin: "open_job", itemId: initial.jobId, projectId: null, jobId: initial.jobId,
    candidateIds: [], mutationId: randomUUID(), actor: "founder",
  });
  assert.equal(result.ok && result.jobAction, "watch_checked");
  const updated = await writer.getJob(null, initial.jobId);
  assert.equal(updated?.waitingOnActor, "client");
  assert.equal(updated?.checkpointAt, null);
});
