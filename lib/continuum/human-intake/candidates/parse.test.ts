import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { parseHumanIntakeEvidence } from "./parse";
import { proposeHumanIntakeCandidates } from "./propose";
import { uniquePersonMatch } from "./match";
import type { HumanIntakeWorld } from "./types";

const PERSON_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROJECT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const DUP_PERSON = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PARSER = join(dirname(fileURLToPath(import.meta.url)), "parse.ts");
const SOURCE_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const world: HumanIntakeWorld = {
  people: [{ personId: PERSON_ID, displayName: "Sarah Chen" }],
  projects: [{ projectId: PROJECT_ID, title: "Oval ring", cadJobNumber: "4412" }],
};

describe("Deterministic human intake extractor", () => {
  it("extracts dates, finger size, CAD, commitments, requests, and notes", () => {
    const text = `Call with Sarah Chen about Oval ring.
Finger size is 6.5.
CAD-4412 is ready.
I'll send the revision on March 15, 2026.
She wants the cathedral lower.
Can you send render 2?
Please follow up next week.
When can we confirm metal?`;
    const hits = parseHumanIntakeEvidence(
      {
        sourceId: SOURCE_ID,
        text,
        capturedAt: "2026-03-01T12:00:00.000Z",
        confirmedPersonIds: [],
        confirmedProjectIds: [],
      },
      world,
    );
    const types = new Set(hits.map((row) => row.kind));
    assert.ok(types.has("date"));
    assert.ok(types.has("structured_spec"));
    assert.ok(types.has("open_job"));
    assert.ok(types.has("note"));
    assert.ok(types.has("follow_up"));
    assert.ok(types.has("person_association"));
    assert.ok(types.has("project_association"));
    const finger = hits.find(
      (row) => row.kind === "structured_spec" && row.fieldName === "finger_size",
    );
    assert.ok(finger);
    assert.equal(finger?.kind === "structured_spec" && finger.proposedValue, "6.5");
    const commitment = hits.find(
      (row) => row.kind === "open_job" && row.jobKind === "commitment",
    );
    assert.ok(commitment);
    assert.ok(
      hits.some(
        (row) => row.kind === "open_job" && row.ruleIds.includes("explicit_follow_up"),
      ),
    );
    const person = hits.find((row) => row.kind === "person_association");
    assert.equal(person?.kind === "person_association" && person.personId, PERSON_ID);
    const project = hits.find(
      (row) => row.kind === "project_association" && row.title === "Oval ring",
    );
    assert.equal(
      project?.kind === "project_association" && project.projectId,
      PROJECT_ID,
    );
  });

  it("maps harvested observations onto the shared Continuum Candidate contract", () => {
    const proposed = proposeHumanIntakeCandidates({
      createdAt: "2026-03-01T12:00:00.000Z",
      world,
      evidence: {
        sourceId: SOURCE_ID,
        text: "Call with Sarah Chen about Oval ring. Finger size is 6.5.",
        capturedAt: "2026-03-01T12:00:00.000Z",
      },
    });
    assert.equal(proposed.liveModelCalls, false);
    assert.ok(proposed.candidates.length > 0);
    assert.ok(
      proposed.candidates.every((row) => row.sourceSystem === "human-intake"),
    );
    assert.ok(proposed.candidates.every((row) => row.reviewStatus === "pending"));
    assert.ok(proposed.candidates.every((row) => row.canonical === false));
    assert.ok(proposed.candidates.every((row) => row.automaticApply === false));
    const finger = proposed.candidates.find(
      (row) =>
        row.payload.kind === "structured_spec" &&
        row.payload.fieldName === "finger_size",
    );
    assert.ok(finger);
    assert.equal(finger?.candidateType, "structured_spec");
    assert.equal(finger?.payload.kind, "structured_spec");
    if (finger?.payload.kind === "structured_spec") {
      assert.equal(finger.payload.proposedValue, "6.5");
    }
    assert.ok(!proposed.candidates.some((row) => row.candidateType === "project_context"));
  });

  it("never treats email or phone as Person identity proof", () => {
    const hits = parseHumanIntakeEvidence(
      {
        sourceId: "source",
        text: "Contact Sarah Chen at sarah.chen@example.com or 305-555-0100.",
      },
      world,
    );
    assert.equal(hits.filter((row) => row.kind === "person_association").length, 0);
  });

  it("does not mint a Person and leaves duplicate names unmatched", () => {
    const match = uniquePersonMatch("Jordan Lee", [
      { personId: PERSON_ID, displayName: "Jordan Lee" },
      { personId: DUP_PERSON, displayName: "Jordan Lee" },
    ]);
    assert.equal(match.person, null);
    assert.equal(match.ambiguous, true);
    const hits = parseHumanIntakeEvidence(
      {
        sourceId: "source",
        text: "Jordan Lee asked about timing.",
      },
      {
        people: [
          { personId: PERSON_ID, displayName: "Jordan Lee" },
          { personId: DUP_PERSON, displayName: "Jordan Lee" },
        ],
        projects: [],
      },
    );
    const people = hits.filter((row) => row.kind === "person_association");
    assert.equal(people.length, 1);
    assert.equal(people[0]?.kind === "person_association" && people[0].personId, null);
    assert.equal(people[0]?.confidence, "ambiguous");
  });

  it("does not create Open Jobs from extraction", () => {
    const source = readFileSync(PARSER, "utf8");
    assert.doesNotMatch(source, /createProjectJob/);
    assert.doesNotMatch(source, /continuum_project_jobs/);
    assert.doesNotMatch(source, /sourceSystem/);
    assert.doesNotMatch(source, /sourceRef/);
    const hits = parseHumanIntakeEvidence(
      {
        sourceId: "source",
        text: "I'll get the revision tomorrow.",
      },
      { people: [], projects: [] },
    );
    const jobs = hits.filter((row) => row.kind === "open_job");
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0]?.kind === "open_job" && jobs[0].jobKind, "commitment");
    const followHits = parseHumanIntakeEvidence(
      {
        sourceId: SOURCE_ID,
        text: "Follow up with Sarah next Tuesday.",
        capturedAt: "2026-03-01T12:00:00.000Z",
        confirmedProjectIds: [PROJECT_ID],
      },
      world,
    );
    const followJob = followHits.find(
      (row) => row.kind === "open_job" && row.ruleIds.includes("explicit_follow_up"),
    );
    assert.ok(followJob);
    const vendorHits = parseHumanIntakeEvidence(
      {
        sourceId: SOURCE_ID,
        text: "We'll have it Friday.",
        capturedAt: "2026-03-01T12:00:00.000Z",
        confirmedProjectIds: [PROJECT_ID],
      },
      world,
    );
    const vendor = vendorHits.find(
      (row) => row.kind === "open_job" && row.ruleIds.includes("explicit_vendor_commitment"),
    );
    assert.ok(vendor);
    const lifecycleOnly = parseHumanIntakeEvidence(
      {
        sourceId: SOURCE_ID,
        text: "IN PRODUCTION. WAITING FOR CLIENT APPROVAL.",
        capturedAt: "2026-03-01T12:00:00.000Z",
      },
      world,
    );
    assert.equal(
      lifecycleOnly.some((row) => row.kind === "open_job"),
      false,
    );
    const proposed = proposeHumanIntakeCandidates({
      evidence: { sourceId: SOURCE_ID, text: "I'll get the revision tomorrow." },
      world: { people: [], projects: [] },
    });
    const job = proposed.candidates.find((row) => row.candidateType === "open_job");
    assert.ok(job);
    assert.equal(job?.payload.kind, "open_job");
    if (job?.payload.kind === "open_job") {
      assert.equal(job.payload.createJob, false);
    }
  });
});
