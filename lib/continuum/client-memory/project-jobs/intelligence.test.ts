import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { summarizeProjectWork } from "./intelligence";
import { projectWorkFacts } from "./present";
import type { ProjectJob } from "./types";

const NOW = "2026-09-05T16:00:00.000Z";
const PROJECT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROJECT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function job(
  extra: Partial<ProjectJob> & Pick<ProjectJob, "jobId" | "subject" | "kind" | "state">,
  projectId = PROJECT_A,
): ProjectJob {
  const row: ProjectJob = {
    projectId,
    detail: null,
    waitingOnActor: "founder",
    associatedPersonId: null,
    dueAt: null,
    deferredUntil: null,
    resolvedAt: null,
    cancelledAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: "justin",
    sourceSystem: "concierge-manual",
    sourceRef: null,
    createdMutationId: randomUUID(),
    ...extra,
  };
  if (row.state === "snoozed" && row.deferredUntil == null) {
    row.deferredUntil = "2026-09-20T00:00:00.000Z";
  }
  if (row.state === "resolved" && row.resolvedAt == null) {
    row.resolvedAt = NOW;
  }
  if (row.state === "cancelled" && row.cancelledAt == null) {
    row.cancelledAt = NOW;
  }
  return row;
}

describe("Open Jobs Project Desk intelligence", () => {
  it("returns disconnected when jobs were not loaded", () => {
    assert.deepEqual(summarizeProjectWork(null, PROJECT_A, NOW), {
      connected: false,
    });
    assert.deepEqual(summarizeProjectWork(undefined, PROJECT_A, NOW), {
      connected: false,
    });
    assert.deepEqual(projectWorkFacts({ connected: false }), []);
  });

  it("reports no open work when the Project has an empty connected book", () => {
    const summary = summarizeProjectWork([], PROJECT_A, NOW);
    assert.equal(summary.connected, true);
    if (!summary.connected) return;
    assert.equal(summary.unresolvedCount, 0);
    assert.equal(summary.blocked, false);
    assert.deepEqual(projectWorkFacts(summary), ["No open jobs recorded."]);
  });

  it("counts mixed kinds and waiting-on actors without inferring from prose", () => {
    const summary = summarizeProjectWork(
      [
        job({
          jobId: randomUUID(),
          kind: "request",
          subject: "Please send CAD urgently overdue",
          state: "open",
          waitingOnActor: "client",
        }),
        job({
          jobId: randomUUID(),
          kind: "commitment",
          subject: "Quote wax",
          state: "open",
          waitingOnActor: "hourglass",
        }),
        job({
          jobId: randomUUID(),
          kind: "question",
          subject: "Confirm metal",
          state: "open",
          waitingOnActor: "founder",
        }),
        job({
          jobId: randomUUID(),
          kind: "required_action",
          subject: "Ship to caster",
          state: "open",
          waitingOnActor: "vendor",
        }),
        job({
          jobId: randomUUID(),
          kind: "approval",
          subject: "Unknown next step",
          state: "open",
          waitingOnActor: "unknown",
        }),
      ],
      PROJECT_A,
      NOW,
    );
    assert.equal(summary.connected, true);
    if (!summary.connected) return;
    assert.equal(summary.unresolvedCount, 5);
    assert.equal(summary.waitingOn.client, 1);
    assert.equal(summary.waitingOn.hourglass, 1);
    assert.equal(summary.waitingOn.founder, 1);
    assert.equal(summary.waitingOn.vendor, 1);
    assert.equal(summary.waitingOn.unknown, 1);
    assert.equal(summary.blocked, false);
    assert.equal(summary.forgottenRiskCount, 0);
    const facts = projectWorkFacts(summary);
    assert.ok(facts.includes("5 unresolved"));
    assert.ok(facts.includes("Client action"));
    assert.ok(facts.includes("Hourglass action"));
    assert.ok(facts.includes("Founder action"));
    assert.ok(facts.includes("Vendor action"));
    assert.ok(facts.includes("Unknown actor"));
    assert.equal(facts.some((row) => /Waiting on Client/i.test(row)), false);
  });

  it("marks blocked from blocked_issue kind, not from vendor-waiting alone", () => {
    const vendor = summarizeProjectWork(
      [
        job({
          jobId: randomUUID(),
          kind: "required_action",
          subject: "Caster has metal",
          state: "open",
          waitingOnActor: "vendor",
        }),
      ],
      PROJECT_A,
      NOW,
    );
    assert.equal(vendor.connected && vendor.blocked, false);
    const blocked = summarizeProjectWork(
      [
        job({
          jobId: randomUUID(),
          kind: "blocked_issue",
          subject: "Caster waiting on metal",
          state: "open",
          waitingOnActor: "vendor",
        }),
      ],
      PROJECT_A,
      NOW,
    );
    assert.equal(blocked.connected && blocked.blocked, true);
    if (!blocked.connected) return;
    assert.ok(projectWorkFacts(blocked).includes("Blocked issue"));
  });

  it("uses explicit due dates only for past due and due soon", () => {
    const summary = summarizeProjectWork(
      [
        job({
          jobId: randomUUID(),
          kind: "commitment",
          subject: "Send quote",
          state: "open",
          waitingOnActor: "hourglass",
          dueAt: "2026-09-01T00:00:00.000Z",
        }),
        job({
          jobId: randomUUID(),
          kind: "request",
          subject: "Need size",
          state: "open",
          waitingOnActor: "client",
          dueAt: "2026-09-10T00:00:00.000Z",
        }),
        job({
          jobId: randomUUID(),
          kind: "question",
          subject: "Later check-in",
          state: "open",
          waitingOnActor: "founder",
          dueAt: "2026-10-01T00:00:00.000Z",
        }),
      ],
      PROJECT_A,
      NOW,
    );
    assert.equal(summary.connected, true);
    if (!summary.connected) return;
    assert.equal(summary.pastDueCount, 1);
    assert.equal(summary.dueSoonCount, 1);
    assert.equal(summary.nextDueAt, "2026-09-01T00:00:00.000Z");
    assert.ok(projectWorkFacts(summary).includes("Explicit due date has passed"));
    assert.ok(projectWorkFacts(summary).includes("Due within 7 days"));
    assert.equal(projectWorkFacts(summary).some((row) => /overdue/i.test(row)), false);
  });

  it("suppresses stale and due alarms while explicitly snoozed", () => {
    const summary = summarizeProjectWork(
      [
        job({
          jobId: randomUUID(),
          kind: "commitment",
          subject: "Old Hourglass promise",
          state: "snoozed",
          waitingOnActor: "hourglass",
          dueAt: "2026-08-01T00:00:00.000Z",
          deferredUntil: "2026-09-20T00:00:00.000Z",
          createdAt: "2026-07-01T00:00:00.000Z",
          updatedAt: "2026-07-01T00:00:00.000Z",
        }),
      ],
      PROJECT_A,
      NOW,
    );
    assert.equal(summary.connected, true);
    if (!summary.connected) return;
    assert.equal(summary.unresolvedCount, 1);
    assert.equal(summary.activeCount, 0);
    assert.equal(summary.deferredCount, 1);
    assert.equal(summary.pastDueCount, 0);
    assert.equal(summary.forgottenRiskCount, 0);
    assert.equal(summary.waitingOn.hourglass, 0);
    assert.equal(summary.nextDueAt, null);
    assert.ok(projectWorkFacts(summary).includes("Deferred only"));
  });

  it("treats elapsed defer as active again without writing state", () => {
    const summary = summarizeProjectWork(
      [
        job({
          jobId: randomUUID(),
          kind: "commitment",
          subject: "Deferred Hourglass promise",
          state: "snoozed",
          waitingOnActor: "hourglass",
          dueAt: "2026-08-01T00:00:00.000Z",
          deferredUntil: "2026-09-01T00:00:00.000Z",
          createdAt: "2026-07-01T00:00:00.000Z",
          updatedAt: "2026-07-01T00:00:00.000Z",
        }),
      ],
      PROJECT_A,
      NOW,
    );
    assert.equal(summary.connected, true);
    if (!summary.connected) return;
    assert.equal(summary.deferredCount, 0);
    assert.equal(summary.activeCount, 1);
    assert.equal(summary.pastDueCount, 1);
    assert.equal(summary.forgottenRiskCount, 1);
    assert.equal(summary.waitingOn.hourglass, 1);
  });

  it("excludes resolved and cancelled jobs", () => {
    const summary = summarizeProjectWork(
      [
        job({
          jobId: randomUUID(),
          kind: "blocked_issue",
          subject: "Resolved block",
          state: "resolved",
          waitingOnActor: "vendor",
        }),
        job({
          jobId: randomUUID(),
          kind: "commitment",
          subject: "Cancelled promise",
          state: "cancelled",
          waitingOnActor: "founder",
          dueAt: "2026-09-01T00:00:00.000Z",
        }),
      ],
      PROJECT_A,
      NOW,
    );
    assert.equal(summary.connected, true);
    if (!summary.connected) return;
    assert.equal(summary.unresolvedCount, 0);
    assert.equal(summary.blocked, false);
    assert.equal(summary.pastDueCount, 0);
  });

  it("keeps old client-waiting quiet and flags forgotten Hourglass work", () => {
    const client = summarizeProjectWork(
      [
        job({
          jobId: randomUUID(),
          kind: "request",
          subject: "Need stone photo",
          state: "open",
          waitingOnActor: "client",
          createdAt: "2026-06-01T00:00:00.000Z",
          updatedAt: "2026-06-01T00:00:00.000Z",
        }),
      ],
      PROJECT_A,
      NOW,
    );
    assert.equal(client.connected && client.forgottenRiskCount, 0);
    const ours = summarizeProjectWork(
      [
        job({
          jobId: randomUUID(),
          kind: "commitment",
          subject: "Send CAD revision",
          state: "open",
          waitingOnActor: "hourglass",
          createdAt: "2026-08-01T00:00:00.000Z",
          updatedAt: "2026-08-01T00:00:00.000Z",
        }),
      ],
      PROJECT_A,
      NOW,
    );
    assert.equal(ours.connected && ours.forgottenRiskCount, 1);
    if (!ours.connected) return;
    assert.ok(projectWorkFacts(ours).includes("Hourglass job may have gone quiet"));
  });

  it("keeps same-title Projects isolated", () => {
    const jobs = [
      job({
        jobId: randomUUID(),
        kind: "blocked_issue",
        subject: "Vendor wax delay",
        state: "open",
        waitingOnActor: "vendor",
      }),
      job(
        {
          jobId: randomUUID(),
          kind: "commitment",
          subject: "Other project quote",
          state: "open",
          waitingOnActor: "hourglass",
          dueAt: "2026-09-01T00:00:00.000Z",
        },
        PROJECT_B,
      ),
    ];
    const a = summarizeProjectWork(jobs, PROJECT_A, NOW);
    const b = summarizeProjectWork(jobs, PROJECT_B, NOW);
    assert.equal(a.connected && a.blocked, true);
    assert.equal(a.connected && a.pastDueCount, 0);
    assert.equal(b.connected && b.blocked, false);
    assert.equal(b.connected && b.pastDueCount, 1);
    assert.equal(a.connected && a.unresolvedCount, 1);
    assert.equal(b.connected && b.unresolvedCount, 1);
  });
});
