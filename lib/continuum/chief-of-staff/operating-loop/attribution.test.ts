import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import { fixtureCandidate } from "./fixtures";
import { projectBySupportedAssociation } from "./attribution";
import type { CosProjectContext } from "./types";
import type { TodayGmailThreadContext } from "@/lib/continuum/candidates/founder-attention";

const FOUNDER = hashEmail("founder@example.test")!;
const CLIENT = hashEmail("client@example.test")!;

function context(projectThread: string, sideThread: string) {
  return new Map<string, TodayGmailThreadContext>([
    [projectThread, {
      subject: "Re: active project",
      messages: [
        { messageId: "in", sentAt: "2026-10-01T12:00:00Z", direction: "inbound", fromEmailHash: CLIENT, toEmailHashes: [FOUNDER] },
        { messageId: "out", sentAt: "2026-10-01T13:00:00Z", direction: "outbound", fromEmailHash: FOUNDER, toEmailHashes: [CLIENT] },
      ],
    }],
    [sideThread, {
      subject: "Print update",
      messages: [
        { messageId: "promise", sentAt: "2026-10-02T13:00:00Z", direction: "outbound", fromEmailHash: FOUNDER, toEmailHashes: [CLIENT] },
      ],
    }],
  ]);
}

describe("thread-to-project participant provenance", () => {
  it("keeps Alex C026510 and Dylan C025610 bound to their exact identifiers", () => {
    const alexProject = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0510";
    const dylanProject = "dddddddd-dddd-4ddd-8ddd-dddddddd0610";
    const alexThread = "alex-thread";
    const dylanThread = "dylan-thread";
    const projects = new Map<string, CosProjectContext>([
      [alexProject, {
        projectId: alexProject,
        title: "Alex Miller — Engagement Ring",
        personName: "Alex Miller",
        people: [{ personId: "person-alex", displayName: "Alex Miller", role: "client" }],
        specs: [{ fieldName: "cad_job_number", value: "C026510" }],
        isCurrent: true,
      }],
      [dylanProject, {
        projectId: dylanProject,
        title: "D. Doerner",
        personName: "Dylan Doerner",
        people: [{ personId: "person-dylan", displayName: "Dylan Doerner", role: "client" }],
        specs: [{ fieldName: "cad_job_number", value: "C025610" }],
        isCurrent: true,
        lifecycleStage: "production",
      }],
    ]);
    const rows = [
      fixtureCandidate({
        candidateId: "alex-cad",
        sourceRef: `gc1|${alexThread}|alex-message`,
        proposedTarget: { kind: "none" },
        evidenceBasis: { ruleIds: ["exact_cad_job"], matchedText: "C026510" },
      }),
      fixtureCandidate({
        candidateId: "dylan-cad",
        sourceRef: `gc1|${dylanThread}|dylan-message`,
        proposedTarget: { kind: "none" },
        evidenceBasis: { ruleIds: ["exact_cad_job"], matchedText: "C025610" },
      }),
    ];
    const threads = new Map<string, TodayGmailThreadContext>([
      [alexThread, { subject: "HGD x A.Miller-C026510", messages: [] }],
      [dylanThread, { subject: "HGD x A.Miller-C025610", messages: [] }],
    ]);
    const association = projectBySupportedAssociation(rows, projects, threads);
    assert.deepEqual(association.get(alexThread), { projectId: alexProject, via: "identifier" });
    assert.deepEqual(association.get(dylanThread), { projectId: dylanProject, via: "identifier" });
  });

  it("links an outbound-only side thread through one exact recipient and one supported project", () => {
    const projectThread = "project-thread";
    const sideThread = "side-thread";
    const projectId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const projects = new Map<string, CosProjectContext>([[projectId, {
      projectId,
      title: "Active project",
      personName: null,
      isCurrent: true,
      gmailThreadId: projectThread,
    }]]);
    const rows = [fixtureCandidate({
      candidateId: "side-promise",
      sourceRef: `gc1|${sideThread}|promise`,
      proposedTarget: { kind: "open_job", projectId: null },
    })];
    assert.deepEqual(
      projectBySupportedAssociation(rows, projects, context(projectThread, sideThread)).get(sideThread),
      { projectId, via: "participant" },
    );
  });

  it("fails closed when the same participant maps to multiple projects", () => {
    const sideThread = "side-thread";
    const projects = new Map<string, CosProjectContext>([
      ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", {
        projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", title: "One", personName: null,
        isCurrent: true, gmailThreadId: "project-one",
      }],
      ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", {
        projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", title: "Two", personName: null,
        isCurrent: true, gmailThreadId: "project-two",
      }],
    ]);
    const threads = context("project-one", sideThread);
    threads.set("project-two", context("project-one", sideThread).get("project-one")!);
    const rows = [fixtureCandidate({
      candidateId: "side",
      sourceRef: `gc1|${sideThread}|promise`,
      proposedTarget: { kind: "open_job", projectId: null },
    })];
    assert.equal(projectBySupportedAssociation(rows, projects, threads).has(sideThread), false);
  });
});
