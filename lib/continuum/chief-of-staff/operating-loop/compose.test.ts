import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { composeCosOperatingLoop } from "./compose";
import { collectCanonicalActionables, selectTopRanked } from "./collect";
import { COS_RANKING_MODEL_ID, rankActionableWork } from "./rank";
import { COS_TOP_5_LIMIT } from "./types";
import {
  COS_LOOP_NOW,
  fixtureJob as job,
  fixtureProjects as projects,
} from "./fixtures";

describe("CoS operating loop Top 5", () => {
  it("returns at most five ranked Open Jobs from canonical rows", () => {
    const jobs = Array.from({ length: 8 }, (_, index) =>
      job({
        jobId: `cccccccc-cccc-4ccc-8ccc-ccccccccccc${index}`,
        subject: `Action ${index}`,
        createdAt: `2026-09-0${index + 1}T12:00:00.000Z`,
      }),
    );
    const view = composeCosOperatingLoop({
      jobs,
      projects: projects(),
      nowIso: COS_LOOP_NOW,
      newMutationId: () => "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    });
    assert.equal(view.status, "active");
    assert.equal(view.top5.length, COS_TOP_5_LIMIT);
    assert.equal(view.remainingCount, 3);
    assert.equal(new Set(view.top5.map((row) => row.id)).size, 5);
    assert.doesNotMatch(JSON.stringify(view.top5), /"score"|%/);
    assert.equal(
      view.top5.every((row) => row.writer === "open_job.resolve"),
      true,
    );
  });

  it("does not invent a second task store or duplicate jobs", () => {
    const rows = [
      job({ jobId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", subject: "Send CAD" }),
      job({ jobId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", subject: "Send CAD" }),
    ];
    const actionables = collectCanonicalActionables({
      jobs: rows,
      projects: projects(),
      nowIso: COS_LOOP_NOW,
    });
    assert.equal(actionables.length, 1);
    const view = composeCosOperatingLoop({
      jobs: rows,
      projects: projects(),
      nowIso: COS_LOOP_NOW,
    });
    assert.equal(view.top5.length, 1);
    assert.equal(view.contractVersion, "cos-operating-loop-v1");
  });

  it("keeps ranking stable across repeated composition", () => {
    const jobs = [
      job({
        jobId: "aa000000-cccc-4ccc-8ccc-cccccccccccc",
        subject: "Old client wait",
        waitingOnActor: "client",
        createdAt: "2026-08-01T12:00:00.000Z",
      }),
      job({
        jobId: "bb000000-cccc-4ccc-8ccc-cccccccccccc",
        subject: "Overdue blocked CAD",
        kind: "blocked_issue",
        dueAt: "2026-09-01T12:00:00.000Z",
        createdAt: "2026-09-02T12:00:00.000Z",
      }),
      job({
        jobId: "cc000000-cccc-4ccc-8ccc-cccccccccccc",
        subject: "Founder commitment",
        kind: "commitment",
        createdAt: "2026-09-03T12:00:00.000Z",
      }),
    ];
    const first = composeCosOperatingLoop({ jobs, projects: projects(), nowIso: COS_LOOP_NOW });
    const second = composeCosOperatingLoop({ jobs, projects: projects(), nowIso: COS_LOOP_NOW });
    assert.deepEqual(
      first.top5.map((row) => row.id),
      second.top5.map((row) => row.id),
    );
    assert.equal(first.top5[0]?.id, "bb000000-cccc-4ccc-8ccc-cccccccccccc");
    assert.match(first.top5[0]?.why ?? "", /Past due|Blocking/);
    assert.equal(first.top5[0]?.writer, "open_job.resolve");
    const ranked = rankActionableWork(
      collectCanonicalActionables({ jobs, projects: projects(), nowIso: COS_LOOP_NOW }),
      COS_LOOP_NOW,
    );
    assert.equal(ranked[0]?.rankingModelId, COS_RANKING_MODEL_ID);
    assert.ok((ranked[0]?.score ?? 0) > (ranked[1]?.score ?? 0));
  });

  it("orders overdue and blocked work ahead of quiet client-waiting work", () => {
    const jobs = [
      job({
        jobId: "aa000000-cccc-4ccc-8ccc-cccccccccccc",
        subject: "Waiting on Sarah",
        waitingOnActor: "client",
        createdAt: "2026-07-01T12:00:00.000Z",
      }),
      job({
        jobId: "bb000000-cccc-4ccc-8ccc-cccccccccccc",
        subject: "Unblock CAD file",
        kind: "blocked_issue",
        dueAt: "2026-09-01T00:00:00.000Z",
      }),
    ];
    const view = composeCosOperatingLoop({ jobs, projects: projects(), nowIso: COS_LOOP_NOW });
    assert.equal(view.top5[0]?.id, "bb000000-cccc-4ccc-8ccc-cccccccccccc");
    assert.equal(view.top5[1]?.id, "aa000000-cccc-4ccc-8ccc-cccccccccccc");
  });

  it("excludes resolved, cancelled, and still-deferred snoozed jobs", () => {
    const jobs = [
      job({
        jobId: "aa000000-cccc-4ccc-8ccc-cccccccccccc",
        subject: "Done",
        state: "resolved",
        resolvedAt: COS_LOOP_NOW,
      }),
      job({
        jobId: "bb000000-cccc-4ccc-8ccc-cccccccccccc",
        subject: "Cancelled",
        state: "cancelled",
        cancelledAt: COS_LOOP_NOW,
      }),
      job({
        jobId: "cc000000-cccc-4ccc-8ccc-cccccccccccc",
        subject: "Snoozed",
        state: "snoozed",
        deferredUntil: "2026-10-01T00:00:00.000Z",
      }),
      job({
        jobId: "dd000000-cccc-4ccc-8ccc-cccccccccccc",
        subject: "Still open",
      }),
    ];
    const view = composeCosOperatingLoop({ jobs, projects: projects(), nowIso: COS_LOOP_NOW });
    assert.deepEqual(view.top5.map((row) => row.id), [
      "dd000000-cccc-4ccc-8ccc-cccccccccccc",
    ]);
  });

  it("shows a quiet caught-up state when nothing actionable remains", () => {
    const view = composeCosOperatingLoop({
      jobs: [],
      projects: projects(),
      nowIso: COS_LOOP_NOW,
    });
    assert.equal(view.status, "caught-up");
    assert.equal(view.top5.length, 0);
    assert.equal(view.anomalies.length, 0);
    assert.match(view.heading, /caught up/i);
  });

  it("stays disconnected when Open Jobs are unavailable rather than inventing an empty book", () => {
    const view = composeCosOperatingLoop({
      jobs: null,
      projects: projects(),
      nowIso: COS_LOOP_NOW,
    });
    assert.equal(view.status, "disconnected");
    assert.equal(view.top5.length, 0);
  });

  it("replenishes the fifth slot from the next-highest remaining job", () => {
    const jobs = Array.from({ length: 6 }, (_, index) =>
      job({
        jobId: `cccccccc-cccc-4ccc-8ccc-ccccccccccc${index}`,
        subject: `Action ${index}`,
        dueAt: `2026-09-0${index + 1}T00:00:00.000Z`,
      }),
    );
    const first = composeCosOperatingLoop({ jobs, projects: projects(), nowIso: COS_LOOP_NOW });
    assert.equal(first.top5.length, 5);
    const completedId = first.top5[0]!.id;
    const remaining = jobs.filter((row) => row.jobId !== completedId);
    const next = composeCosOperatingLoop({
      jobs: remaining,
      projects: projects(),
      nowIso: COS_LOOP_NOW,
    });
    assert.equal(next.top5.some((row) => row.id === completedId), false);
    assert.equal(next.top5.length, 5);
    const sixth = jobs[5]!.jobId;
    assert.equal(next.top5.some((row) => row.id === sixth), true);
  });

  it("drains the full actionable backlog through repeated completion", () => {
    let jobs = Array.from({ length: 7 }, (_, index) =>
      job({
        jobId: `cccccccc-cccc-4ccc-8ccc-ccccccccccc${index}`,
        subject: `Action ${index}`,
        createdAt: `2026-09-01T0${index}:00:00.000Z`,
      }),
    );
    const seen: string[] = [];
    for (let step = 0; step < 10; step += 1) {
      const view = composeCosOperatingLoop({
        jobs,
        projects: projects(),
        nowIso: COS_LOOP_NOW,
      });
      if (view.status === "caught-up") {
        assert.equal(view.top5.length, 0);
        break;
      }
      const current = view.top5[0]!;
      assert.equal(seen.includes(current.id), false);
      seen.push(current.id);
      jobs = jobs.filter((row) => row.jobId !== current.id);
    }
    assert.equal(seen.length, 7);
    const caught = composeCosOperatingLoop({
      jobs,
      projects: projects(),
      nowIso: COS_LOOP_NOW,
    });
    assert.equal(caught.status, "caught-up");
  });

  it("selectTopRanked never exceeds the limit and skips excluded ids", () => {
    const ranked = [1, 2, 3, 4, 5, 6].map((value) => ({ id: String(value) }));
    assert.deepEqual(
      selectTopRanked(ranked, 5).map((row) => row.id),
      ["1", "2", "3", "4", "5"],
    );
    assert.deepEqual(
      selectTopRanked(ranked, 5, new Set(["1"])).map((row) => row.id),
      ["2", "3", "4", "5", "6"],
    );
  });
});
