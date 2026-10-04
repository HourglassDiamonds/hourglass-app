import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";
import { detectFindings, nextThree, runSterling } from "./engine";
import {
  cleanupSummary,
  commercialPriorityOf,
  sourceFreshness,
} from "./cos-beta";
import type { SterlingTodayItem, SterlingTruth } from "./types";

const NOW = new Date("2026-10-04T16:00:00.000Z");
const PROJECT = "22222222-2222-4222-8222-222222222222";

describe("Sterling Chief of Staff beta", () => {
  it("ranks Abbey's fresh rendering request above receipt noise", () => {
    const abbey = item("abbey", {
      title: "Send Abbey the revised rendering",
      why: "Abbey says #2 is good, wants more movement for the marquise, and asks for a rendering.",
      proposedNextAction: "Send/review revised rendering for Abbey.",
      activityAt: "2026-10-04T15:59:00.000Z",
    });
    const dell = item("dell", {
      title: "Dell Technology Services receipt",
      why: "Automated receipt available.",
      clientFacing: false,
      projectId: null,
      activityAt: "2026-10-04T15:59:30.000Z",
    });
    assert.equal(commercialPriorityOf(abbey), "revenue_blocking_decision");
    assert.deepEqual(nextThree(truth([dell, abbey]), NOW).map((row) => row.id), ["abbey"]);
  });

  it("puts a fresh hot lead above operational admin", () => {
    const lead = item("lead", { title: "New engagement ring inquiry", why: "Client is interested in a custom ring and asks for pricing.", activityAt: "2026-10-04T15:58:00.000Z" });
    const admin = item("admin", { title: "Update internal inventory", why: "Routine operational admin.", clientFacing: false, activityAt: "2026-10-04T15:59:00.000Z" });
    assert.equal(nextThree(truth([admin, lead]), NOW)[0]?.id, "lead");
  });

  it("classifies an eight-week-old ordinary production item as likely complete without mutating it", () => {
    const niurka = item("niurka-job", {
      title: "Niurka production job",
      why: "Ordinary shop production cycle.", owner: "shop",
      activityAt: "2026-07-30T12:00:00.000Z",
    });
    const input = truth([niurka], [job("niurka-job", "Niurka production job", "2026-07-30T12:00:00.000Z")]);
    const finding = detectFindings(input, NOW).find((row) => row.reviewGroup === "likely_complete");
    assert.ok(finding);
    assert.equal(finding?.inferredFromAbsence, true);
    assert.equal(finding?.proposal, null);
    assert.equal(input.openJobs[0]?.state, "open");
  });

  it("flags a recent unanswered client question as possibly missed", () => {
    const missed = item("missed", {
      title: "Reply to Maya",
      why: "Maya asked: Can you send the updated quote?",
      activityAt: "2026-09-20T16:00:00.000Z",
    });
    const finding = detectFindings(truth([missed]), NOW).find((row) => row.id === "possibly-missed:missed");
    assert.ok(finding);
    assert.equal(finding?.reviewGroup, "high_value_likely_miss");
    assert.equal(finding?.inferredFromAbsence, true);
  });

  it("lets fresh evidence supersede an old quiet conclusion", () => {
    const refreshed = item("project", {
      title: "Review new client rendering request",
      why: "Client asks for a new rendering.",
      activityAt: "2026-10-04T15:50:00.000Z",
    });
    assert.equal(detectFindings(truth([refreshed]), NOW).some((row) => row.reviewGroup === "likely_complete"), false);
    assert.equal(nextThree(truth([refreshed]), NOW)[0]?.id, "project");
  });

  it("keeps a genuinely quiet day quiet", () => {
    const response = runSterling({ truth: truth([]), intent: "next-three", now: NOW });
    assert.equal(response.priorities.length, 0);
    assert.match(response.summary, /Nothing authoritative/);
  });

  it("warns when Gmail is outside the 1–2 minute target", () => {
    const freshness = sourceFreshness({ status: "current", lastSuccessfulSyncAt: "2026-10-04T15:55:00.000Z", now: NOW });
    assert.equal(freshness.status, "delayed");
    const response = runSterling({ truth: { ...truth([]), sourceFreshness: freshness }, intent: "missing", now: NOW });
    assert.equal(response.uncertainty.some((line) => /delayed beyond the 1–2 minute target/i.test(line)), true);
  });

  it("uses the completed Gmail checkpoint as the successful-sync clock", () => {
    const server = readFileSync(new URL("./server.ts", import.meta.url), "utf8");
    assert.match(server, /readGmailCurrentState\(createSupabaseGmailIndexStore\(client\)\)/);
    assert.doesNotMatch(server, /getFounderConnection\(\)\)\?\.lastSyncAt/);
  });

  it("summarizes cleanup as an approval-first batch", () => {
    const findings = detectFindings(truth([
      item("old", { owner: "shop", activityAt: "2026-07-01T00:00:00.000Z" }),
      item("miss", { why: "Could you send a rendering?", activityAt: "2026-09-20T00:00:00.000Z" }),
      item("noise", { title: "System receipt", why: "Automated receipt", clientFacing: false }),
    ]), NOW);
    assert.deepEqual(cleanupSummary(findings), {
      total: 3,
      likelyComplete: 1,
      possiblyMissed: 1,
      stillActive: 0,
      needsReview: 1,
    });
  });
});

function truth(today: SterlingTodayItem[], openJobs: ProjectJob[] = []): SterlingTruth {
  return { generatedAt: NOW.toISOString(), sourceWatermark: "wm", sourceStatus: "current", today, openJobs, candidates: [], anomalies: [] };
}

function item(id: string, extra: Partial<SterlingTodayItem> = {}): SterlingTodayItem {
  return {
    id, title: `Task ${id}`, why: `Evidence for ${id}`, projectId: PROJECT,
    projectTitle: "Project", personName: "Client", owner: "founder", state: "Up next",
    proposedNextAction: `Do ${id}`, dueAt: null, sourceRefs: [`gmail:${id}`],
    authoritative: true, clientFacing: true, productionBlocker: false,
    activityAt: "2026-10-04T15:00:00.000Z", ...extra,
  };
}

function job(jobId: string, subject: string, updatedAt: string): ProjectJob {
  return {
    jobId, projectId: PROJECT, kind: "required_action", subject, detail: null,
    waitingOnActor: "vendor", associatedPersonId: null, state: "open", dueAt: null,
    deferredUntil: null, resolvedAt: null, cancelledAt: null, createdAt: updatedAt,
    updatedAt, createdBy: "fixture", sourceSystem: "continuum", sourceRef: `job:${jobId}`,
    createdMutationId: "44444444-4444-4444-8444-444444444444", attentionMode: "action",
    activationAt: null, checkpointAt: null, attentionMetadata: null,
  };
}
