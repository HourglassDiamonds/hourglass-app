import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { it } from "node:test";
import { relatedToJob } from "./evidence";
import { proposeRecapItems, detectAnomalies } from "./reconcile";
import { composeCosOperatingLoop } from "./compose";
import { fixtureCandidate, fixtureJob, fixtureProjects, COS_LOOP_NOW, COS_LOOP_PROJECT_A, COS_LOOP_PROJECT_B } from "./fixtures";

for (const subject of ["Review support proposal", "Send CAD email"]) {
  it(`keeps Project evidence out of projectless ${subject}`, () => {
    const job = fixtureJob({ jobId: randomUUID(), projectId: null, associatedPersonId: null, subject });
    const candidate = fixtureCandidate({ candidateId: randomUUID(), candidateType: "note",
      payload: { kind: "note", text: `${subject} sent and approved`, contextLayer: null },
      evidenceBasis: { ruleIds: [], matchedText: subject } });
    assert.equal(relatedToJob(job, candidate), false);
    assert.deepEqual(proposeRecapItems({ jobs: [job], candidates: [candidate], projects: fixtureProjects(), newMutationId: randomUUID }), []);
    const view = composeCosOperatingLoop({ jobs: [job], candidates: [candidate], projects: fixtureProjects(), nowIso: COS_LOOP_NOW });
    assert.ok(view.top5.some(row => row.id === job.jobId));
    assert.equal(job.state, "open");
    assert.deepEqual(view.recap, []);
  });
}

it("preserves same-Project matches but rejects unscoped subject-token matches", () => {
  const job = fixtureJob({ jobId: randomUUID(), subject: "Review support proposal" });
  const candidate = fixtureCandidate({ candidateId: randomUUID(),
    payload: { kind: "project_context", topic: "client_approval", value: "Support proposal approved" } });
  assert.equal(relatedToJob(job, candidate), true);
  assert.equal(relatedToJob({ ...job, projectId: COS_LOOP_PROJECT_B }, candidate), false);
  assert.equal(relatedToJob({ ...job, projectId: null }, candidate), false);
  const unscoped = { ...candidate, proposedTarget: { kind: "none" as const } };
  assert.equal(relatedToJob({ ...job, projectId: null }, unscoped), false);
  assert.equal(proposeRecapItems({ jobs: [{ ...job, projectId: null }], candidates: [unscoped], projects: fixtureProjects(), newMutationId: randomUUID }).length, 0);
  assert.equal(relatedToJob({ ...job, projectId: null }, { ...unscoped, founderEditedTarget: { kind: "project", projectId: COS_LOOP_PROJECT_A } }), false);
});

it("does not revive terminal founder work or attach Project contradiction evidence", () => {
  const candidate = fixtureCandidate({ candidateId: randomUUID(), candidateType: "follow_up",
    payload: { kind: "follow_up", text: "Please send the support proposal", dueAt: null, sourceTimestamp: "2026-09-07T18:00:00.000Z" } });
  for (const state of ["resolved", "cancelled"] as const) {
    const job = fixtureJob({ jobId: randomUUID(), projectId: null, subject: "Review support proposal", state });
    assert.deepEqual(proposeRecapItems({ jobs: [job], candidates: [candidate], projects: fixtureProjects(), newMutationId: randomUUID }), []);
    assert.deepEqual(detectAnomalies({ jobs: [job], candidates: [candidate], projects: fixtureProjects(), recapJobIds: new Set(), nowIso: COS_LOOP_NOW }), []);
    assert.equal(composeCosOperatingLoop({ jobs: [job], candidates: [candidate], projects: fixtureProjects(), nowIso: COS_LOOP_NOW }).top5.some(row => row.id === job.jobId), false);
  }
});
