import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  associatedGmailThreadsByProject,
  projectBySupportedAssociation,
} from "./attribution";
import type { CosProjectContext } from "./types";

const MORGAN_PROJECT = "17ef9d5b-39d2-48bf-85f6-93209a4c4e38";
const OTHER_PROJECT = "27ef9d5b-39d2-48bf-85f6-93209a4c4e39";
const MORGAN_THREAD = "1a15fb0c9b520621";

function project(projectId: string): CosProjectContext {
  return {
    projectId,
    title: projectId === MORGAN_PROJECT ? "Morgan Jines — Marquise" : "Unrelated Project",
    personName: null,
    isCurrent: true,
    lifecycleStage: "design",
    gmailThreadId: null,
  };
}

describe("founder-trusted thread attribution", () => {
  it("attaches exact membership without requiring a Candidate", () => {
    const projects = new Map([
      [MORGAN_PROJECT, project(MORGAN_PROJECT)],
      [OTHER_PROJECT, project(OTHER_PROJECT)],
    ]);
    const association = projectBySupportedAssociation(
      [],
      projects,
      new Map(),
      new Map([[MORGAN_THREAD, MORGAN_PROJECT]]),
    );
    assert.deepEqual(association.get(MORGAN_THREAD), {
      projectId: MORGAN_PROJECT,
      via: "founder_trusted",
    });
    const byProject = associatedGmailThreadsByProject(association, projects);
    assert.deepEqual(byProject.get(MORGAN_PROJECT), [MORGAN_THREAD]);
    assert.equal(byProject.has(OTHER_PROJECT), false);
  });

  it("ignores trusted membership whose Project is absent", () => {
    const projects = new Map([[OTHER_PROJECT, project(OTHER_PROJECT)]]);
    const association = projectBySupportedAssociation(
      [],
      projects,
      new Map(),
      new Map([[MORGAN_THREAD, MORGAN_PROJECT]]),
    );
    assert.equal(association.has(MORGAN_THREAD), false);
  });

  it("keeps founder-trusted ownership ahead of conflicting Candidate inference", () => {
    const projects = new Map([
      [MORGAN_PROJECT, project(MORGAN_PROJECT)],
      [OTHER_PROJECT, project(OTHER_PROJECT)],
    ]);
    const candidate = {
      candidateId: "candidate-conflict",
      sourceSystem: "gmail",
      sourceRef: `gc1|${MORGAN_THREAD}|1a15fb0c9b520622`,
      sourceTimestamp: "2026-11-05T14:49:47.000Z",
      candidateType: "project_context",
      proposedTarget: { kind: "project", projectId: OTHER_PROJECT },
      payload: { kind: "project_context", field: "gmail_thread_id", value: MORGAN_THREAD },
      confidence: "high",
      evidenceBasis: { ruleIds: ["test"], matchedText: "" },
      candidateState: "active",
      reviewStatus: "approved",
      lastReviewAction: null,
      founderEditedPayload: null,
      founderEditedTarget: null,
      reviewedAt: null,
      createdAt: "2026-11-05T14:49:47.000Z",
      canonical: false,
      automaticApply: false,
      parserVersion: "test",
      supersedesCandidateId: null,
      supersededByCandidateId: null,
    } as never;
    const association = projectBySupportedAssociation(
      [candidate],
      projects,
      new Map(),
      new Map([[MORGAN_THREAD, MORGAN_PROJECT]]),
    );
    assert.equal(association.get(MORGAN_THREAD)?.projectId, MORGAN_PROJECT);
  });
});
