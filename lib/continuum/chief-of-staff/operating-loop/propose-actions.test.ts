import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { composeCosOperatingLoop } from "./compose";
import { proposeExplicitActions } from "./propose-actions";
import {
  COS_LOOP_NOW,
  COS_LOOP_PROJECT_A,
  fixtureCandidate,
  fixtureJob,
  fixtureProjects,
} from "./fixtures";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, "../../../..");
const SOURCE_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const CANDIDATE_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function actionCandidate(
  extra: Partial<ContinuumCandidate> = {},
): ContinuumCandidate {
  return fixtureCandidate({
    candidateId: CANDIDATE_ID,
    sourceSystem: "human-intake",
    sourceRef: `he1|${SOURCE_ID}`,
    candidateType: "open_job",
    proposedTarget: { kind: "open_job", projectId: COS_LOOP_PROJECT_A },
    payload: {
      kind: "open_job",
      jobKind: "commitment",
      subject: "I'll send the CAD tomorrow.",
      detail: "I'll send the CAD tomorrow.",
      waitingOnActor: "founder",
      dueAt: null,
      createJob: false,
    },
    evidenceBasis: {
      ruleIds: ["explicit_founder_commitment"],
      matchedText: "I'll send the CAD tomorrow.",
    },
    ...extra,
  });
}

describe("CoS evidence-driven action proposals", () => {
  it("surfaces explicit founder, client, and follow-up language as proposed actions", () => {
    const proposed = proposeExplicitActions({
      jobs: [],
      projects: fixtureProjects(),
      newMutationId: () => "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      candidates: [
        actionCandidate(),
        actionCandidate({
          candidateId: "11111111-eeee-4eee-8eee-eeeeeeeeeeee",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "Can you send me the updated render?",
            detail: "Can you send me the updated render?",
            waitingOnActor: "hourglass",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_client_request"],
            matchedText: "Can you send me the updated render?",
          },
        }),
        actionCandidate({
          candidateId: "22222222-eeee-4eee-8eee-eeeeeeeeeeee",
          payload: {
            kind: "open_job",
            jobKind: "required_action",
            subject: "Follow up with Sarah next Tuesday.",
            detail: "Follow up with Sarah next Tuesday.",
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_follow_up"],
            matchedText: "Follow up with Sarah next Tuesday.",
          },
        }),
      ],
    });
    assert.equal(proposed.length, 3);
    assert.equal(proposed.every((row) => row.canAddToActions), true);
    assert.equal(
      proposed.every((row) => row.id.startsWith("proposed:")),
      true,
    );
  });

  it("does not propose from lifecycle, email age, unread, or approval language", () => {
    const proposed = proposeExplicitActions({
      jobs: [],
      projects: fixtureProjects(),
      newMutationId: () => "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      candidates: [
        fixtureCandidate({
          candidateId: "aaaaaaaa-eeee-4eee-8eee-eeeeeeeeeeee",
          evidenceBasis: {
            ruleIds: ["lifecycle"],
            matchedText: "IN PRODUCTION",
          },
        }),
        fixtureCandidate({
          candidateId: "bbbbbbbb-eeee-4eee-8eee-eeeeeeeeeeee",
          evidenceBasis: {
            ruleIds: ["email_age"],
            matchedText: "unread for 12 days",
          },
        }),
        fixtureCandidate({
          candidateId: "cccccccc-eeee-4eee-8eee-eeeeeeeeeeee",
          evidenceBasis: {
            ruleIds: ["unread"],
            matchedText: "INBOX",
          },
        }),
        fixtureCandidate({
          candidateId: "dddddddd-eeee-4eee-8eee-eeeeeeeeeeee",
        }),
      ],
    });
    assert.equal(proposed.length, 0);
  });

  it("suppresses a duplicate proposal when an unresolved Open Job already exists", () => {
    const proposed = proposeExplicitActions({
      jobs: [
        fixtureJob({
          jobId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          subject: "I'll send the CAD tomorrow.",
        }),
      ],
      candidates: [actionCandidate()],
      projects: fixtureProjects(),
      newMutationId: () => "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    });
    assert.equal(proposed.length, 0);
  });

  it("does not create an Open Job from a proposal until founder approval", () => {
    const view = composeCosOperatingLoop({
      jobs: [],
      candidates: [actionCandidate()],
      projects: fixtureProjects(),
      nowIso: COS_LOOP_NOW,
      newMutationId: () => "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    });
    assert.equal(view.status, "caught-up");
    assert.equal(view.top5.length, 0);
    assert.equal(view.proposedActions.length, 1);
    assert.equal(view.proposedActions[0]?.canAddToActions, true);
    const source = readFileSync(join(DIR, "propose-actions.ts"), "utf8");
    assert.doesNotMatch(source, /createProjectJob|applyReview|mutateJob/);
  });

  it("lets an approved Open Job enter Top 5 through createProjectJob and drop the proposal", () => {
    const job = fixtureJob({
      jobId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      subject: "I'll send the CAD tomorrow.",
      kind: "commitment",
    });
    const view = composeCosOperatingLoop({
      jobs: [job],
      candidates: [actionCandidate()],
      projects: fixtureProjects(),
      nowIso: COS_LOOP_NOW,
      newMutationId: () => "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    });
    assert.equal(view.top5.length, 1);
    assert.equal(view.top5[0]?.id, job.jobId);
    assert.equal(view.top5[0]?.action, "I'll send the CAD tomorrow.");
    assert.equal(view.proposedActions.length, 0);
    const apply = readFileSync(
      join(ROOT, "lib/continuum/human-intake/review/apply.ts"),
      "utf8",
    );
    const actions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/intake-review-actions.ts"),
      "utf8",
    );
    assert.match(apply, /createProjectJob/);
    assert.match(actions, /reviewHumanIntakeCandidate/);
    assert.match(actions, /createProjectJob: \(input\) => jobs\.writer\.createJob/);
  });
});
