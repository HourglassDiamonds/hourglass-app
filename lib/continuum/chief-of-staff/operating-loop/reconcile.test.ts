import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { composeCosOperatingLoop } from "./compose";
import { proposeRecapItems, detectAnomalies, recapJobIds } from "./reconcile";
import { completeFounderActionable } from "./complete";
import {
  COS_LOOP_NOW,
  COS_LOOP_PROJECT_A,
  fixtureCandidate as candidate,
  fixtureJob as job,
  fixtureProjects as projects,
} from "./fixtures";

const JOB_OPEN = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const JOB_DONE = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

describe("CoS evidence reconciliation", () => {
  it("turns likely-complete evidence into a recap suggestion only", () => {
    const jobs = [
      job({
        jobId: JOB_OPEN,
        subject: "Send Travis the revision",
        kind: "commitment",
        createdAt: "2026-09-01T12:00:00.000Z",
      }),
    ];
    const recap = proposeRecapItems({
      jobs,
      candidates: [
        candidate({
          candidateId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          sourceTimestamp: "2026-09-06T12:00:00.000Z",
          evidenceBasis: {
            ruleIds: ["explicit_sent"],
            matchedText: "I sent the revision",
          },
          payload: {
            kind: "note",
            text: "I sent the revision this morning.",
            contextLayer: null,
          },
          candidateType: "note",
        }),
      ],
      projects: projects(),
      newMutationId: () => "ffffffff-ffff-4fff-8fff-ffffffffffff",
    });
    assert.equal(recap.length, 1);
    assert.equal(recap[0]?.kind, "likely-complete");
    assert.match(recap[0]?.question ?? "", /Mark complete/);
    assert.equal(recap[0]?.sourceHref.includes("gmail/candidates"), true);
    assert.equal(recap[0]?.writer, "open_job.resolve");
    assert.equal(jobs[0]?.state, "open");
  });

  it("does not let inference resolve a task", async () => {
    const jobs = [
      job({
        jobId: JOB_OPEN,
        subject: "Send CAD",
        kind: "commitment",
      }),
    ];
    const view = composeCosOperatingLoop({
      jobs,
      candidates: [
        candidate({
          candidateId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          payload: {
            kind: "project_context",
            topic: "client_approval",
            value: "CAD looks great",
          },
        }),
      ],
      projects: projects(),
      nowIso: COS_LOOP_NOW,
    });
    assert.equal(view.recap.length, 1);
    assert.equal(jobs[0]?.state, "open");
    assert.equal(view.top5.some((row) => row.id === JOB_OPEN), true);
    const inferred = completeFounderActionable as unknown as {
      name: string;
    };
    assert.equal(inferred.name, "completeFounderActionable");
  });

  it("asks an ambiguous confirmation without a completion writer", () => {
    const jobs = [
      job({
        jobId: JOB_OPEN,
        subject: "Send Lee the render",
        kind: "commitment",
      }),
    ];
    const recap = proposeRecapItems({
      jobs,
      candidates: [
        candidate({
          candidateId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          candidateType: "follow_up",
          payload: {
            kind: "follow_up",
            text: "I replied to Lee this afternoon.",
            dueAt: null,
            sourceTimestamp: "2026-09-07T18:00:00.000Z",
          },
          evidenceBasis: {
            ruleIds: ["explicit_follow_up"],
            matchedText: "I replied to Lee",
          },
        }),
      ],
      projects: projects(),
      newMutationId: () => "ffffffff-ffff-4fff-8fff-ffffffffffff",
    });
    assert.equal(recap[0]?.kind, "ambiguous-complete");
    assert.match(recap[0]?.question ?? "", /can't tell whether this was actually sent/);
    assert.equal(recap[0]?.completable, false);
    assert.equal(recap[0]?.writer, null);
  });

  it("creates an anomaly when newer evidence contradicts completion", () => {
    const jobs = [
      job({
        jobId: JOB_DONE,
        subject: "Send CAD",
        state: "resolved",
        resolvedAt: "2026-09-05T12:00:00.000Z",
        updatedAt: "2026-09-05T12:00:00.000Z",
      }),
    ];
    const anomalies = detectAnomalies({
      jobs,
      candidates: [
        candidate({
          candidateId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          sourceTimestamp: "2026-09-07T12:00:00.000Z",
          candidateType: "open_job",
          proposedTarget: { kind: "open_job", projectId: COS_LOOP_PROJECT_A },
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "Can you send the CAD again",
            detail: null,
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_client_request"],
            matchedText: "Can you send the CAD again",
          },
        }),
      ],
      recapJobIds: new Set(),
      nowIso: COS_LOOP_NOW,
      projects: projects(),
    });
    assert.equal(anomalies[0]?.kind, "contradicts-completion");
  });

  it("creates an overdue no-action anomaly and stays quiet when nothing is wrong", () => {
    const overdue = job({
      jobId: JOB_OPEN,
      subject: "Call vendor",
      dueAt: "2026-08-01T00:00:00.000Z",
      createdAt: "2026-07-01T00:00:00.000Z",
    });
    const healthy = job({
      jobId: JOB_DONE,
      subject: "Confirm size",
      createdAt: COS_LOOP_NOW,
      updatedAt: COS_LOOP_NOW,
    });
    const overdueAnomalies = detectAnomalies({
      jobs: [overdue],
      candidates: [],
      recapJobIds: new Set(),
      nowIso: COS_LOOP_NOW,
      projects: projects(),
    });
    assert.equal(overdueAnomalies[0]?.kind, "overdue-no-action");
    const quiet = composeCosOperatingLoop({
      jobs: [healthy],
      candidates: [],
      projects: projects(),
      nowIso: COS_LOOP_NOW,
    });
    assert.equal(quiet.anomalies.length, 0);
    assert.equal(quiet.recap.length, 0);
  });

  it("flags waiting-on-client work after a client response", () => {
    const waiting = job({
      jobId: JOB_OPEN,
      subject: "Waiting on Revision D",
      waitingOnActor: "client",
      updatedAt: "2026-08-01T12:00:00.000Z",
    });
    const anomalies = detectAnomalies({
      jobs: [waiting],
      candidates: [
        candidate({
          candidateId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          sourceTimestamp: "2026-09-06T12:00:00.000Z",
        }),
      ],
      recapJobIds: recapJobIds([]),
      nowIso: COS_LOOP_NOW,
      projects: projects(),
    });
    assert.equal(anomalies[0]?.kind, "client-responded");
  });

  it("does not emit an anomaly section model when the book is clean", () => {
    const view = composeCosOperatingLoop({
      jobs: [],
      candidates: [],
      projects: projects(),
      nowIso: COS_LOOP_NOW,
    });
    assert.deepEqual(view.anomalies, []);
    assert.deepEqual(view.recap, []);
  });
});
