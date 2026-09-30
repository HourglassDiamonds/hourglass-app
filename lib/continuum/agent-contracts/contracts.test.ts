import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { createTravisSolWorld, TRAVIS_PERSON_ID, TRAVIS_PROJECT_ID } from "@/lib/continuum/concierge-sol/travis-world";
import { executeContinuumAgentContract } from "./execute";
import {
  CONTINUUM_AGENT_CAPABILITIES,
  CONTINUUM_AGENT_CONTRACT_VERSION,
  CONTINUUM_AGENT_READ_OPERATIONS,
} from "./types";
import type { ContinuumAgentWorld } from "./world";

const NOW = new Date("2026-09-30T14:00:00.000Z");

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
    const base = createTravisSolWorld();
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
    const base = createTravisSolWorld();
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
    const base = createTravisSolWorld();
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
    const base = createTravisSolWorld();
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

  it("keeps reads observational and leaves the source world unchanged", async () => {
    const world = createTravisSolWorld();
    const before = JSON.stringify(await world.listCurrentProjectCards());
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
    assert.equal(JSON.stringify(await world.listCurrentProjectCards()), before);
  });

  it("returns a proposal receipt without persistence or approved mutation authority", async () => {
    const world = createTravisSolWorld();
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
    const world = createTravisSolWorld();
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
    assert.doesNotMatch(load, /loadCosOperatingLoop/);
  });
});
