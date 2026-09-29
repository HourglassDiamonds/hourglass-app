import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fixtureJob, fixtureProjects } from "./fixtures";
import { composeCosOperatingLoop } from "./compose";
import { composeTodayDocket } from "./docket";
import { beginTodayRecomputeAttempt } from "./today-recompute-clock";

describe("Today recomposition logical clock", () => {
  it("refreshes the clock on retry and reactivates an expired snooze without a write", async () => {
    const boundary = "2026-09-13T16:00:00.000Z";
    const times = [
      new Date("2026-09-13T15:59:59.999Z"),
      new Date(boundary),
    ];
    const observed: string[] = [];
    const readWatermark = async (at: Date) => {
      observed.push(at.toISOString());
      return at.toISOString() < boundary ? "job:deferred" : "job:eligible";
    };
    const clock = () => times.shift()!;
    const job = fixtureJob({
      jobId: "snooze-boundary-job",
      subject: "Send client update",
      state: "snoozed",
      deferredUntil: boundary,
    });
    const evaluate = async () => {
      const attempt = await beginTodayRecomputeAttempt(readWatermark, clock);
      const docket = composeTodayDocket(
        composeCosOperatingLoop({
          jobs: [job],
          projects: fixtureProjects(),
          nowIso: attempt.evaluationTime.toISOString(),
        }),
      );
      return { attempt, docket };
    };

    const staleAttempt = await evaluate();
    const retry = await evaluate();
    assert.equal(staleAttempt.docket.items.length, 0);
    assert.equal(staleAttempt.attempt.watermark, "job:deferred");
    assert.equal(retry.docket.items.length, 1);
    assert.equal(retry.attempt.watermark, "job:eligible");
    assert.deepEqual(observed, [
      "2026-09-13T15:59:59.999Z",
      "2026-09-13T16:00:00.000Z",
    ]);
  });
});
