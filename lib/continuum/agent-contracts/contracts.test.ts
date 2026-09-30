import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { createTravisSolWorld, TRAVIS_PERSON_ID, TRAVIS_PROJECT_ID } from "@/lib/continuum/concierge-sol/travis-world";
import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";
import { executeContinuumAgentContract } from "./execute";
import {
  CONTINUUM_AGENT_CAPABILITIES,
  CONTINUUM_AGENT_CONTRACT_VERSION,
  CONTINUUM_AGENT_READ_OPERATIONS,
} from "./types";
import type { ContinuumAgentWorld } from "./world";

const NOW = new Date("2026-09-30T14:00:00.000Z");
const PROJECTLESS_JOB_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_JOB_ID = "22222222-2222-4222-8222-222222222222";

function canonicalJob(extra: Partial<ProjectJob> = {}): ProjectJob {
  return {
    jobId: PROJECTLESS_JOB_ID,
    projectId: null,
    kind: "required_action",
    subject: "Review website inquiry and decide the next action",
    detail: "Canonical projectless founder work from website intake.",
    waitingOnActor: "unknown",
    associatedPersonId: null,
    state: "open",
    dueAt: null,
    deferredUntil: null,
    resolvedAt: null,
    cancelledAt: null,
    createdAt: "2026-09-30T13:00:00.000Z",
    updatedAt: "2026-09-30T13:00:00.000Z",
    createdBy: "website-intake",
    sourceSystem: "human-intake",
    sourceRef: "website-inquiry:example",
    createdMutationId: "33333333-3333-4333-8333-333333333333",
    ...extra,
  };
}

function createAgentWorld(
  projectlessJobs: readonly ProjectJob[] = [],
  base = createTravisSolWorld(),
): ContinuumAgentWorld {
  return {
    ...base,
    async listProjectlessJobs() {
      return [...projectlessJobs];
    },
    async loadTodayItems(limit) {
      return (await base.loadTodayItems(limit)).map((item) => ({
        ...item,
        jobId: null,
      }));
    },
  };
}

describe("provider-neutral Continuum agent contracts", () => {
  it("publishes a closed, versioned capability surface", () => {
    assert.equal(CONTINUUM_AGENT_CONTRACT_VERSION, "continuum-agent-contracts-v1");
    assert.deepEqual(CONTINUUM_AGENT_CAPABILITIES, {
      read: "allowed",
      proposal: "proposal-only",
      approvedMutation: "not-exposed",
    });
    assert.deepEqual(CONTINUUM_AGENT_READ_OPERATIONS, [
      "get_current_truth",
      "get_client_context",
      "get_open_jobs",
      "get_waiting_on",
      "get_commitments",
      "get_today",
      "get_next_three",
    ]);
  });

  it("reuses canonical grouping and Today readers with bounded structured output", async () => {
    const base = createAgentWorld();
    let grouped = 0;
    let todayLimit = 0;
    const world: ContinuumAgentWorld = {
      ...base,
      async groupCurrentProjects(nowIso) {
        grouped += 1;
        return base.groupCurrentProjects(nowIso);
      },
      async loadTodayItems(limit) {
        todayLimit = limit;
        return base.loadTodayItems(limit);
      },
    };
    const truth = await executeContinuumAgentContract(
      world,
      { requestId: "truth-1", operation: "get_current_truth" },
      NOW,
    );
    assert.equal(truth.ok, true);
    assert.equal(grouped, 1);
    if (truth.ok && "groups" in truth.data) {
      assert.equal(truth.data.groups[0]?.projects[0]?.projectId, TRAVIS_PROJECT_ID);
      assert.equal(JSON.stringify(truth.data).includes("currentAction"), true);
    }

    const next = await executeContinuumAgentContract(
      world,
      { requestId: "next-1", operation: "get_next_three" },
      NOW,
    );
    assert.equal(next.ok, true);
    assert.equal(todayLimit, 3);
    if (next.ok && "items" in next.data) assert.equal(next.data.items.length, 3);
  });

  it("fails closed when identity search is ambiguous", async () => {
    const base = createAgentWorld();
    const world: ContinuumAgentWorld = {
      ...base,
      async searchPeople(query) {
        const rows = await base.searchPeople(query);
        return [
          ...rows,
          {
            ...rows[0]!,
            personId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            displayName: "Travis M.",
          },
        ];
      },
    };
    const result = await executeContinuumAgentContract(
      world,
      { requestId: "person-ambiguous", operation: "get_client_context", query: "Travis" },
      NOW,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, "ambiguous_identity");
  });

  it("preserves needs-review state when translating canonical client context", async () => {
    const base = createAgentWorld();
    const world: ContinuumAgentWorld = {
      ...base,
      async getPersonProfile(personId) {
        const result = await base.getPersonProfile(personId);
        if (!result.ok) return result;
        return {
          ...result,
          profile: {
            ...result.profile,
            facts: { ...result.profile.facts, conflictingCount: 1 },
            reviews: { ...result.profile.reviews, openCount: 2 },
          },
        };
      },
    };
    const result = await executeContinuumAgentContract(
      world,
      { requestId: "person-review", operation: "get_client_context", personId: TRAVIS_PERSON_ID },
      NOW,
    );
    assert.equal(result.ok, true);
    assert.equal(result.review.status, "needs_review");
    assert.deepEqual(result.review.reasons, ["identity_review_open", "conflicting_facts"]);
  });

  it("bounds nested canonical fact values before returning model-facing context", async () => {
    const base = createAgentWorld();
    const world: ContinuumAgentWorld = {
      ...base,
      async getPersonProfile(personId) {
        const result = await base.getPersonProfile(personId);
        if (!result.ok) return result;
        return {
          ...result,
          profile: {
            ...result.profile,
            facts: {
              ...result.profile.facts,
              current: [{
                id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
                personId,
                factType: "bounded-proof",
                value: { long: "x".repeat(2_000) },
                confidence: 1,
                verification: "manual",
                approvalStatus: "approved" as const,
                status: "current" as const,
                visibility: "internal-only" as const,
                usagePermission: "unset" as const,
                validFrom: null,
                validUntil: null,
                supersedesId: null,
                sourceSystem: "continuum" as const,
                createdAt: NOW.toISOString(),
                createdBy: "test",
              }],
            },
          },
        };
      },
    };
    const result = await executeContinuumAgentContract(
      world,
      { requestId: "bounded-fact", operation: "get_client_context", personId: TRAVIS_PERSON_ID },
      NOW,
    );
    assert.equal(result.ok, true);
    assert.equal(result.truncated, true);
    if (result.ok && "facts" in result.data) {
      const value = result.data.facts[0]?.value as { long?: string };
      assert.equal(value.long?.length, 500);
    }
  });

  it("unions canonical projectless and Project Jobs without inventing Project identity", async () => {
    const base = createTravisSolWorld();
    const openProjectless = canonicalJob();
    const resolvedProjectless = canonicalJob({
      jobId: "44444444-4444-4444-8444-444444444444",
      subject: "Resolved website inquiry",
      state: "resolved",
      resolvedAt: "2026-09-30T13:30:00.000Z",
      createdAt: "2026-09-30T13:30:00.000Z",
      updatedAt: "2026-09-30T13:30:00.000Z",
      createdMutationId: "55555555-5555-4555-8555-555555555555",
    });
    const cancelledProjectless = canonicalJob({
      jobId: "66666666-6666-4666-8666-666666666666",
      subject: "Cancelled website inquiry",
      state: "cancelled",
      cancelledAt: "2026-09-30T13:45:00.000Z",
      createdAt: "2026-09-30T13:45:00.000Z",
      updatedAt: "2026-09-30T13:45:00.000Z",
      createdMutationId: "77777777-7777-4777-8777-777777777777",
    });
    const projectless = [cancelledProjectless, openProjectless, resolvedProjectless];
    const world: ContinuumAgentWorld = {
      ...createAgentWorld(projectless, base),
      async getProjectDesk(projectId) {
        const result = await base.getProjectDesk(projectId);
        if (!result.ok) return result;
        return {
          ...result,
          desk: {
            ...result.desk,
            openJobs: {
              connected: true as const,
              unresolved: [{
                jobId: PROJECT_JOB_ID,
                kind: "commitment" as const,
                subject: "Send the Project CAD",
                detail: null,
                waitingOnActor: "founder" as const,
                associatedPersonId: TRAVIS_PERSON_ID,
                associatedPersonName: "Travis Morse",
                state: "open" as const,
                dueAt: null,
                deferredUntil: null,
                createdAt: "2026-09-30T12:00:00.000Z",
                sourceSystem: "concierge-manual" as const,
              }],
              unresolvedCount: 1,
            },
          },
        };
      },
      async loadTodayItems() {
        return [{
          jobId: PROJECTLESS_JOB_ID,
          title: "Handle the new website inquiry",
          detail: "Today ranks this founder action first.",
          projectTitle: null,
          personName: null,
        }];
      },
    };
    const before = JSON.stringify(projectless);

    const open = await executeContinuumAgentContract(
      world,
      { requestId: "open-union", operation: "get_open_jobs" },
      NOW,
    );
    assert.equal(open.ok, true);
    assert.equal(open.review.status, "needs_review");
    assert.deepEqual(open.review.reasons, ["job_owner_unknown"]);
    if (!open.ok || !("jobs" in open.data)) return;
    assert.deepEqual(open.data.jobs.map((job) => job.jobId), [
      PROJECT_JOB_ID,
      PROJECTLESS_JOB_ID,
    ]);
    const founderJob = open.data.jobs.find((job) => job.jobId === PROJECTLESS_JOB_ID);
    assert.equal(founderJob?.kind, "required_action");
    assert.equal(founderJob?.state, "open");
    assert.equal(founderJob?.projectId, null);
    assert.equal(founderJob?.projectTitle, null);
    assert.equal(open.data.jobs.some((job) => job.jobId === resolvedProjectless.jobId), false);
    assert.equal(open.data.jobs.some((job) => job.jobId === cancelledProjectless.jobId), false);
    assert.equal(
      open.data.jobs.find((job) => job.jobId === PROJECT_JOB_ID)?.projectId,
      TRAVIS_PROJECT_ID,
    );

    const today = await executeContinuumAgentContract(
      world,
      { requestId: "today-same-job", operation: "get_today" },
      NOW,
    );
    assert.equal(today.ok, true);
    if (today.ok && "items" in today.data) {
      assert.equal(today.data.items[0]?.jobId, founderJob?.jobId);
      assert.notEqual(today.data.items[0]?.title, founderJob?.subject);
      assert.equal(founderJob?.state, "open");
    }
    assert.equal(JSON.stringify(projectless), before);
  });

  it("keeps reads observational and leaves the source world unchanged", async () => {
    const base = createTravisSolWorld();
    const projectless = [canonicalJob()];
    const world = createAgentWorld(projectless, base);
    const before = JSON.stringify({
      cards: await base.listCurrentProjectCards(),
      projectless,
    });
    const operations = [
      { requestId: "r1", operation: "get_current_truth" },
      { requestId: "r2", operation: "get_open_jobs" },
      { requestId: "r3", operation: "get_waiting_on" },
      { requestId: "r4", operation: "get_commitments" },
      { requestId: "r5", operation: "get_today" },
    ] as const;
    for (const request of operations) {
      const result = await executeContinuumAgentContract(world, request, NOW);
      assert.equal(result.ok, true);
      assert.equal(result.capability, "read");
    }
    assert.equal(JSON.stringify({
      cards: await base.listCurrentProjectCards(),
      projectless,
    }), before);
  });

  it("returns a proposal receipt without persistence or approved mutation authority", async () => {
    const world = createAgentWorld();
    const result = await executeContinuumAgentContract(
      world,
      {
        requestId: "proposal-1",
        operation: "propose_state_change",
        change: {
          kind: "set_project_spec",
          projectId: TRAVIS_PROJECT_ID,
          fieldName: "finger_size",
          proposedValue: "12.75",
        },
        provenance: {
          sourceSystem: "gmail",
          sourceRef: "gc1|thread|message|finger-size",
          observedAt: NOW.toISOString(),
        },
      },
      NOW,
    );
    assert.equal(result.ok, true);
    assert.equal(result.capability, "proposal");
    assert.equal(result.review.status, "needs_review");
    if (result.ok && "proposalId" in result.data) {
      assert.equal(result.data.persist, false);
      assert.equal(result.data.canonical, false);
      assert.equal(result.data.automaticApply, false);
      assert.equal(result.data.requiresFounderApproval, true);
      assert.equal(result.data.approvedMutation, null);
    }
  });

  it("rejects missing provenance, uncertain targets, and unapproved mutation operations", async () => {
    const world = createAgentWorld();
    const noProvenance = await executeContinuumAgentContract(
      world,
      {
        requestId: "proposal-no-source",
        operation: "propose_state_change",
        change: {
          kind: "set_project_spec",
          projectId: TRAVIS_PROJECT_ID,
          fieldName: "metal",
          proposedValue: "platinum",
        },
      } as never,
      NOW,
    );
    assert.equal(noProvenance.ok, false);
    if (!noProvenance.ok) assert.equal(noProvenance.error.code, "provenance_required");

    const unknownProject = await executeContinuumAgentContract(
      world,
      {
        requestId: "proposal-unknown-target",
        operation: "propose_state_change",
        change: {
          kind: "set_project_spec",
          projectId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          fieldName: "metal",
          proposedValue: "platinum",
        },
        provenance: { sourceSystem: "gmail", sourceRef: "gc1|source" },
      },
      NOW,
    );
    assert.equal(unknownProject.ok, false);
    if (!unknownProject.ok) assert.equal(unknownProject.error.code, "not_found");

    const unauthorized = await executeContinuumAgentContract(
      world,
      { requestId: "approve-1", operation: "approve_state_change" },
      NOW,
    );
    assert.equal(unauthorized.ok, false);
    if (!unauthorized.ok) assert.equal(unauthorized.error.code, "operation_not_allowed");
  });

  it("contains no database or canonical writer imports in the contract executor", async () => {
    const source = await readFile(new URL("./execute.ts", import.meta.url), "utf8");
    const load = await readFile(new URL("./load.ts", import.meta.url), "utf8");
    assert.doesNotMatch(source, /getSupabaseAdmin|createProjectJob|correctProjectSpec|addManualNote|applyReview/);
    assert.doesNotMatch(source, /@supabase|\.from\(|\.insert\(|\.update\(|\.delete\(/);
    assert.match(load, /loadTodaySurface/);
    assert.match(load, /loadProjectJobs\(client, null\)/);
    assert.doesNotMatch(load, /\.from\(|\.insert\(|\.update\(|\.delete\(/);
    assert.doesNotMatch(load, /loadCosOperatingLoop/);
  });
});
