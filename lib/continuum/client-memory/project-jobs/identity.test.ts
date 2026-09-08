import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findUnresolvedJobByActionIdentity,
  openJobActionIdentityKey,
} from "./identity";
import type { ProjectJob } from "./types";

const PROJECT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROJECT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function job(extra: Partial<ProjectJob> & Pick<ProjectJob, "jobId" | "subject">): ProjectJob {
  return {
    projectId: PROJECT_A,
    kind: "required_action",
    detail: null,
    waitingOnActor: "founder",
    associatedPersonId: null,
    state: "open",
    dueAt: null,
    deferredUntil: null,
    resolvedAt: null,
    cancelledAt: null,
    createdAt: "2026-09-08T12:00:00.000Z",
    updatedAt: "2026-09-08T12:00:00.000Z",
    createdBy: "justin",
    sourceSystem: "concierge-manual",
    sourceRef: null,
    createdMutationId: extra.jobId,
    ...extra,
  };
}

describe("Open Job action identity", () => {
  it("normalizes subject whitespace and case", () => {
    assert.equal(openJobActionIdentityKey("  Send   CAD "), "send cad");
    assert.equal(
      openJobActionIdentityKey("Send CAD"),
      openJobActionIdentityKey("send cad"),
    );
  });

  it("matches unresolved jobs on the same Project only", () => {
    const rows = [
      job({
        jobId: "11111111-1111-4111-8111-111111111111",
        subject: "Send CAD",
        state: "resolved",
        resolvedAt: "2026-09-08T12:00:00.000Z",
      }),
      job({
        jobId: "22222222-2222-4222-8222-222222222222",
        subject: "send cad",
        projectId: PROJECT_B,
      }),
      job({
        jobId: "33333333-3333-4333-8333-333333333333",
        subject: "Send CAD",
      }),
    ];
    const found = findUnresolvedJobByActionIdentity(rows, PROJECT_A, "  SEND cad");
    assert.equal(found?.jobId, "33333333-3333-4333-8333-333333333333");
    assert.equal(
      findUnresolvedJobByActionIdentity(rows, PROJECT_B, "Send CAD")?.jobId,
      "22222222-2222-4222-8222-222222222222",
    );
  });
});
