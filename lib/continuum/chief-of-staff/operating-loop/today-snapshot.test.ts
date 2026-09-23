import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";
import type { CosTodayDocketView } from "./docket";
import { COS_DOCKET_TITLE, TODAY_DOCKET_VERSION } from "./docket";
import {
  CONTINUUM_TODAY_READ_MODEL_VERSION,
  TODAY_SNAPSHOT_KEY,
  decideSnapshotUse,
  projectTodaySnapshot,
  publishWinsRace,
  serializedTodaySnapshotBytes,
  type TodaySnapshotRecord,
} from "@/lib/continuum/today-snapshot";

const ROOT = resolve(process.cwd());

function docket(): CosTodayDocketView {
  return {
    todayDocketVersion: TODAY_DOCKET_VERSION,
    title: COS_DOCKET_TITLE,
    items: [
      {
        id: "abbey",
        lane: "live_work",
        origin: "brief",
        subject: "Abbey",
        headline: "Ship the huggies",
        context: null,
        job: null,
        brief: {
          id: "abbey",
          rank: 1,
          rankClass: "founder_commitment",
          personLabel: "Abbey",
          organizationLabel: null,
          projectTitle: "Huggies",
          projectId: "proj-abbey",
          canonicalGmailThreadId: "thread-abbey",
          headline: "Ship the huggies",
          explanation: "Printed and ready.",
          recommended: "Ship them.",
          stateLabel: null,
          urgencyLabel: null,
          actions: [{ kind: "open_email", label: "View email", href: "https://mail.google.com/mail/u/0/#inbox/thread-abbey" }],
          evidence: [
            {
              at: "2026-09-21T22:00:00.000Z",
              label: "Abbey",
              summary: "Printed and ready.\n> older quoted thread history that must not persist",
              speaker: "client",
              sourceHref: "https://mail.google.com/mail/u/0/#inbox/thread-abbey",
              candidateId: "cand-abbey",
            },
          ],
          openJobLabel: null,
          projectStateLabel: null,
          candidateIds: ["cand-abbey"],
          proposedAction: null,
          specConflict: null,
          sourceEvents: [
            {
              sourceType: "gmail",
              sourceRef: "gmail:thread-abbey",
              messageId: "msg-1",
              threadId: "thread-abbey",
              timestamp: "2026-09-21T22:00:00.000Z",
              direction: "inbound",
              actor: "client",
              subject: "Huggies",
              authorOwnedText: "RAW GMAIL BODY that must not persist",
              quotedText: "RAW QUOTED HISTORY that must not persist",
              attachmentFilenames: ["cad.stl"],
              hasAttachments: true,
              cadIds: [],
              orderIds: [],
              productionJobIds: [],
              personLabel: "Abbey",
              projectId: "proj-abbey",
              workLoopId: "abbey",
              semanticClass: "client_requests",
              provenance: "indexed_gmail",
            },
          ],
        },
        decision: null,
        anomaly: null,
        cosBriefing: {
          modelId: "cos-briefing-v1",
          currentState: "Printed and ready.",
          timingFacts: [],
          timingProse: null,
          checkpoint: {
            condition: "When the package is shipped",
            action: "Mark the job done",
            reason: null,
            sourceRefs: ["gmail:thread-abbey"],
            status: "open",
            basis: "recommendation",
          },
          checkpointProse: "Ship them.",
          why: null,
          currentFounderAction: true,
        },
        briefingPacket: {
          itemId: "abbey",
          displayName: "Abbey",
          entityType: "client",
          briefingKind: "client_work",
          projectName: "Huggies",
          projectId: "proj-abbey",
          personId: "person-abbey",
          organizationLabel: null,
          vendorContactName: null,
          identifiers: [],
          lifecycle: "production",
          latestMeaningfulExternalEvent: {
            summary: "Printed and ready.",
            speaker: "client",
            at: "2026-09-21T22:00:00.000Z",
            sourceRef: "gmail:thread-abbey",
          },
          latestMeaningfulFounderAction: null,
          ballHolder: "founder",
          unresolvedFounderObligation: "Ship them",
          externalCommitment: null,
          nextExpectedEvent: null,
          candidateNextAction: "Ship them",
          uncertainty: [],
          mustNotState: [],
          sourceRefs: ["gmail:thread-abbey"],
        },
      },
    ],
    queuedCount: 0,
    watchingCount: 1,
    watching: [],
    showCaughtUp: false,
    showDisconnected: false,
    caughtUpHeading: "You're caught up",
    caughtUpDetail: null,
    disconnectedHeading: null,
    disconnectedDetail: null,
  } as unknown as CosTodayDocketView;
}

function record(sourceWatermark: string, version = CONTINUUM_TODAY_READ_MODEL_VERSION): TodaySnapshotRecord {
  return {
    snapshotKey: TODAY_SNAPSHOT_KEY,
    readModelVersion: version,
    sourceWatermark,
    payload: projectTodaySnapshot(docket()),
    composedAt: "2026-09-23T16:00:00.000Z",
    updatedAt: "2026-09-23T16:00:00.000Z",
  };
}

describe("persisted Today snapshot", () => {
  it("renders a compatible snapshot when the watermark matches", () => {
    assert.equal(
      decideSnapshotUse({ record: record("v1"), liveWatermark: "v1" }),
      "current",
    );
  });

  it("renders a compatible snapshot immediately when the watermark changed", () => {
    assert.equal(
      decideSnapshotUse({ record: record("v1"), liveWatermark: "v2" }),
      "refreshing",
    );
  });

  it("rebuilds when no snapshot exists", () => {
    assert.equal(decideSnapshotUse({ record: null, liveWatermark: "v1" }), "miss");
  });

  it("ignores an incompatible snapshot version", () => {
    assert.equal(
      decideSnapshotUse({
        record: record("v1", "continuum-today-read-model-v0"),
        liveWatermark: "v1",
      }),
      "miss",
    );
  });

  it("does not let an older compose overwrite a newer snapshot", () => {
    assert.equal(
      publishWinsRace({
        composedWatermark: "A",
        liveWatermark: "B",
        storedWatermarkAtRead: "older",
        storedWatermarkAtWrite: "B",
      }),
      false,
    );
    assert.equal(
      publishWinsRace({
        composedWatermark: "A",
        liveWatermark: "A",
        storedWatermarkAtRead: "older",
        storedWatermarkAtWrite: "B",
      }),
      false,
    );
    assert.equal(
      publishWinsRace({
        composedWatermark: "B",
        liveWatermark: "B",
        storedWatermarkAtRead: "A",
        storedWatermarkAtWrite: "A",
      }),
      true,
    );
  });

  it("keeps the previous snapshot when background composition fails", () => {
    const load = readFileSync(
      join(ROOT, "lib/continuum/chief-of-staff/operating-loop/load.ts"),
      "utf8",
    );
    const run = load.slice(load.indexOf("const run = async ()"));
    const failure = run.indexOf('throw new Error("today recompute disconnected")');
    const commit = run.indexOf("commitComposedLoop");
    assert.ok(failure > 0);
    assert.ok(commit > failure);
    assert.match(load, /publishPersistedTodaySnapshot/);
  });

  it("drops raw Gmail body and quoted history from the snapshot", () => {
    const payload = projectTodaySnapshot(docket());
    const serialized = JSON.stringify(payload);
    assert.equal(serialized.includes("authorOwnedText"), false);
    assert.equal(serialized.includes("quotedText"), false);
    assert.equal(serialized.includes("RAW GMAIL BODY"), false);
    assert.equal(serialized.includes("RAW QUOTED HISTORY"), false);
    assert.equal(serialized.includes("quoted thread history"), false);
    assert.equal(serialized.includes("sourceEvents"), false);
    assert.match(serialized, /Ship them/);
    assert.match(serialized, /proj-abbey/);
    assert.match(serialized, /gmail:thread-abbey/);
    assert.match(serialized, /founder/);
    const bytes = serializedTodaySnapshotBytes(payload);
    const card = payload.docket.items[0];
    const board = projectTodaySnapshot({
      ...payload.docket,
      items: [0, 1, 2].map((index) => ({ ...card, id: `up-${index}` })),
      watching: [0, 1, 2, 3].map((index) => ({
        id: `watch-${index}`,
        title: "Watching",
        detail: "Shop still owes the CAD.",
        projectId: "proj-abbey",
        briefingPacket: card.briefingPacket,
        cosBriefing: card.cosBriefing,
        todayDocketVersion: payload.docket.todayDocketVersion,
      })),
    } as CosTodayDocketView);
    const boardBytes = serializedTodaySnapshotBytes(board);
    assert.ok(bytes < 16_000, `snapshot bytes ${bytes}`);
    assert.ok(boardBytes < 64_000, `board bytes ${boardBytes}`);
    assert.ok(boardBytes < 653_000);
  });

  it("covers source events, candidate review, and project job state in the watermark", () => {
    const watermark = readFileSync(join(ROOT, "lib/continuum/today-source-watermark.ts"), "utf8");
    const review = readFileSync(join(ROOT, "lib/continuum/candidates/review.ts"), "utf8");
    assert.match(watermark, /continuum_gmail_messages/);
    assert.match(watermark, /indexed_at/);
    assert.match(watermark, /continuum_candidates/);
    assert.match(watermark, /reviewed_at/);
    assert.match(watermark, /created_at/);
    assert.match(watermark, /continuum_project_jobs/);
    assert.match(watermark, /continuum_project_profiles/);
    assert.match(watermark, /updated_at/);
    assert.match(review, /reviewedAt/);
  });

  it("is an unapplied service-role table with no public policies", () => {
    const sql = readFileSync(
      join(ROOT, "lib/supabase/continuum-today-snapshots-schema.sql"),
      "utf8",
    );
    assert.match(sql, /UNAPPLIED/);
    assert.match(sql, /DO NOT RUN AGAINST PRODUCTION/);
    assert.match(sql, /create table if not exists public\.continuum_today_snapshots/);
    assert.match(sql, /snapshot_key text primary key/);
    assert.match(sql, /founder_today_v1/);
    assert.match(sql, /read_model_version text not null/);
    assert.match(sql, /source_watermark jsonb not null/);
    assert.match(sql, /payload jsonb not null/);
    assert.match(sql, /composed_at timestamptz not null/);
    assert.match(sql, /updated_at timestamptz not null/);
    assert.doesNotMatch(sql, /tenant_id/);
    assert.equal((sql.match(/enable row level security/g) ?? []).length, 1);
    assert.doesNotMatch(sql, /create policy/i);
    assert.doesNotMatch(sql, /grant .* to anon/i);
    assert.doesNotMatch(sql, /grant .* to authenticated/i);
    assert.doesNotMatch(sql, /grant .* to public/i);
    assert.match(sql, /revoke all on table public\.continuum_today_snapshots from public;/);
    assert.match(sql, /grant select, insert, update on table public\.continuum_today_snapshots to service_role;/);
    assert.doesNotMatch(sql, /authorOwnedText|quotedText|body text|snippet text/);
  });
});
