import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { conciergeProjectArtifactFilePath } from "../read/presentation";
import { activeLifecycleView } from "../project-lifecycle/view";
import type { ProjectDeskRead, ProjectDeskSummary } from "../project-desk/types";
import type { ProjectDeskOpenJob } from "../project-jobs/types";
import type { ProjectDeskArtifact } from "../project-artifacts/types";
import type { ProjectWorkSummary } from "../project-jobs/intelligence";
import type { ProjectKind } from "../project-kind";
import {
  composeCurrentProjectCard,
  composeCurrentProjectCards,
  pickCurrentOpenJob,
} from "./card";
import { selectOpenProjectWork } from "./select";
import { CURRENT_PROJECTS_ACTION_UNRECORDED } from "./present";

const PROJECT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROJECT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROJECT_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PERSON_A = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const PERSON_B = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const ARTIFACT_A = "11111111-1111-4111-8111-111111111111";
const ARTIFACT_B = "22222222-2222-4222-8222-222222222222";
const ARTIFACT_C = "33333333-3333-4333-8333-333333333333";
const JOB_A = "44444444-4444-4444-8444-444444444444";
const JOB_B = "55555555-5555-4555-8555-555555555555";
const NOW = "2026-09-06T16:00:00.000Z";

function emptyWork(): Extract<ProjectWorkSummary, { connected: true }> {
  return {
    connected: true,
    unresolvedCount: 0,
    activeCount: 0,
    deferredCount: 0,
    waitingOn: {
      founder: 0,
      hourglass: 0,
      client: 0,
      vendor: 0,
      unknown: 0,
    },
    blocked: false,
    dueSoonCount: 0,
    pastDueCount: 0,
    forgottenRiskCount: 0,
    nextDueAt: null,
  };
}

function summary(
  extra: Partial<ProjectDeskSummary> & Pick<ProjectDeskSummary, "projectId" | "title">,
): ProjectDeskSummary {
  return {
    projectKind: "custom_new_jewelry",
    people: [],
    latestNoteAt: null,
    latestNotePreview: null,
    coverage: {
      people: "missing",
      specs: "sparse",
      notes: "none",
      jobs: "none",
      files: "none",
      email: "not-connected",
    },
    recordCreatedAt: "2026-08-01T00:00:00.000Z",
    projectWork: emptyWork(),
    lifecycleStage: "production",
    lifecycleLabel: "Production",
    ...extra,
  };
}

function job(
  extra: Partial<ProjectDeskOpenJob> & Pick<ProjectDeskOpenJob, "jobId" | "subject">,
): ProjectDeskOpenJob {
  return {
    kind: "required_action",
    detail: null,
    waitingOnActor: "founder",
    associatedPersonId: null,
    associatedPersonName: null,
    state: "open",
    dueAt: null,
    deferredUntil: null,
    createdAt: NOW,
    sourceSystem: "concierge-manual",
    ...extra,
  };
}

function artifact(
  extra: Partial<ProjectDeskArtifact> & Pick<ProjectDeskArtifact, "artifactId" | "title">,
): ProjectDeskArtifact {
  return {
    kind: "cad",
    originalFilename: `${extra.title}.png`,
    mimeType: "image/png",
    byteSize: 1200,
    createdAt: NOW,
    sourceSystem: "gmail",
    href: conciergeProjectArtifactFilePath(PROJECT_A, extra.artifactId),
    ...extra,
  };
}

function desk(
  extra: Partial<ProjectDeskRead> & Pick<ProjectDeskRead, "projectId" | "title">,
): ProjectDeskRead {
  const projectKind = (extra.projectKind ?? "custom_new_jewelry") as ProjectKind | null;
  const stage =
    extra.lifecycle && extra.lifecycle.kind !== "none"
      ? extra.lifecycle.stage
      : extra.lifecycle === undefined
        ? "production"
        : null;
  return {
    projectKind,
    recordCreatedAt: "2026-08-01T00:00:00.000Z",
    people: [],
    specs: [],
    specCorrections: [],
    notes: [],
    latestNoteAt: null,
    latestNotePreview: null,
    coverage: {
      people: "missing",
      specs: "sparse",
      notes: "none",
      jobs: "none",
      files: "none",
      email: "not-connected",
    },
    operationalStatus: {
      kind: "unknown",
      evidence: "Email is not connected yet. Current operating state is unknown.",
    },
    operatingLayer: { kind: "none" },
    lifecycle: extra.lifecycle ??
      activeLifecycleView({
        projectKind,
        states: projectKind
          ? [
              {
                projectId: extra.projectId,
                projectKind: projectKind === "repair_service" ? "repair_service" : "custom_new_jewelry",
                stage,
                enteredAt: NOW,
                createdAt: NOW,
                updatedAt: NOW,
              },
            ]
          : [],
        events: [],
      }),
    openJobs: { connected: true, unresolved: [], unresolvedCount: 0 },
    projectWork: emptyWork(),
    artifacts: { connected: true, items: [], count: 0 },
    ...extra,
  };
}

function workItemFrom(row: ProjectDeskSummary) {
  return selectOpenProjectWork([row])[0];
}

function cardFor(row: ProjectDeskSummary, extraDesk: Partial<ProjectDeskRead> = {}) {
  const work = workItemFrom(row);
  assert.ok(work, "selector unexpectedly excluded fixture");
  return composeCurrentProjectCard(
    work,
    desk({
      projectId: row.projectId,
      title: row.title,
      projectKind: row.projectKind,
      people: row.people,
      projectWork: row.projectWork,
      ...extraDesk,
    }),
  );
}

describe("Current Projects accordion read model", () => {
  it("reuses the #13 selector for zero, one, and uncapped membership", () => {
    assert.deepEqual(composeCurrentProjectCards([], new Map()), []);
    const oneSummary = summary({
      projectId: PROJECT_A,
      title: "J.Pennock",
    });
    const one = composeCurrentProjectCards(
      [oneSummary],
      new Map([
        [PROJECT_A, desk({ projectId: PROJECT_A, title: "J.Pennock" })],
      ]),
    );
    assert.equal(one.length, 1);
    assert.equal(one[0]?.projectId, PROJECT_A);

    const rows = Array.from({ length: 8 }, (_, index) => {
      const projectId = `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${index}`;
      return summary({
        projectId,
        title: `Active ${index}`,
      });
    });
    const desks = new Map(
      rows.map((row) => [
        row.projectId,
        desk({ projectId: row.projectId, title: row.title }),
      ]),
    );
    const cards = composeCurrentProjectCards(rows, desks);
    assert.equal(cards.length, 8);
    assert.deepEqual(
      cards.map((row) => row.title),
      [...rows.map((row) => row.title)].sort((a, b) =>
        a.localeCompare(b, "en", { sensitivity: "base" }),
      ),
    );
  });

  it("excludes completed and unsupported Kind unless an Open Job exists", () => {
    const completed = summary({
      projectId: PROJECT_A,
      title: "Closed ring",
      lifecycleStage: "completed",
      lifecycleLabel: "Complete",
    });
    const kindOnly = summary({
      projectId: PROJECT_B,
      title: "Loose stone",
      projectKind: "loose_stone_sourcing",
      lifecycleStage: null,
      lifecycleLabel: null,
    });
    const cards = composeCurrentProjectCards(
      [completed, kindOnly],
      new Map([
        [PROJECT_A, desk({ projectId: PROJECT_A, title: "Closed ring" })],
        [PROJECT_B, desk({ projectId: PROJECT_B, title: "Loose stone", projectKind: "loose_stone_sourcing" })],
      ]),
    );
    assert.equal(cards.length, 0);
  });

  it("lets an unresolved Open Job take precedence over lifecycle display", () => {
    const row = summary({
      projectId: PROJECT_A,
      title: "J.Pennock",
      lifecycleStage: "production",
      lifecycleLabel: "Production",
      projectWork: { ...emptyWork(), unresolvedCount: 1, activeCount: 1 },
    });
    const composed = cardFor(row, {
      openJobs: {
        connected: true,
        unresolvedCount: 1,
        unresolved: [
          job({
            jobId: JOB_A,
            subject: "Confirm engraving",
            waitingOnActor: "founder",
          }),
        ],
      },
    });
    assert.equal(composed.collapsedLine, "YOUR TURN — Confirm engraving");
    assert.equal(composed.collapsedLineKind, "ownership");
    assert.equal(composed.currentAction.label, "YOUR TURN");
    assert.equal(composed.currentAction.detail, "Confirm engraving");
    assert.doesNotMatch(composed.collapsedLine, /IN PRODUCTION/);
  });

  it("falls back to lifecycle and does not invent ownership without a job", () => {
    const production = cardFor(
      summary({
        projectId: PROJECT_A,
        title: "J.Pennock",
        lifecycleStage: "production",
        lifecycleLabel: "Production",
      }),
    );
    assert.equal(production.collapsedLine, "IN PRODUCTION");
    assert.equal(production.collapsedLineKind, "lifecycle");
    assert.equal(production.currentAction.source, "lifecycle");
    assert.doesNotMatch(production.collapsedLine, /YOUR TURN|WAITING ON CLIENT|WAITING ON SHOP/);

    const cad = cardFor(
      summary({
        projectId: PROJECT_B,
        title: "Lee / Spiegel",
        lifecycleStage: "cad",
        lifecycleLabel: "CAD",
      }),
      {
        lifecycle: activeLifecycleView({
          projectKind: "custom_new_jewelry",
          states: [
            {
              projectId: PROJECT_B,
              projectKind: "custom_new_jewelry",
              stage: "cad",
              enteredAt: NOW,
              createdAt: NOW,
              updatedAt: NOW,
            },
          ],
        }),
      },
    );
    assert.equal(cad.collapsedLine, "CAD / DESIGN");

    const approval = cardFor(
      summary({
        projectId: PROJECT_C,
        title: "D. Doerner",
        lifecycleStage: "client_approval",
        lifecycleLabel: "Client Approval",
      }),
      {
        lifecycle: activeLifecycleView({
          projectKind: "custom_new_jewelry",
          states: [
            {
              projectId: PROJECT_C,
              projectKind: "custom_new_jewelry",
              stage: "client_approval",
              enteredAt: NOW,
              createdAt: NOW,
              updatedAt: NOW,
            },
          ],
        }),
      },
    );
    assert.equal(approval.collapsedLine, "WAITING FOR CLIENT APPROVAL");
    assert.notEqual(approval.collapsedLine, "WAITING ON CLIENT");
  });

  it("does not invent ownership from files, Gmail, or lifecycle alone", () => {
    const composed = cardFor(
      summary({
        projectId: PROJECT_A,
        title: "S. Leishman",
        lifecycleStage: "cad",
        lifecycleLabel: "CAD",
      }),
      {
        artifacts: {
          connected: true,
          count: 4,
          items: [
            artifact({ artifactId: ARTIFACT_A, title: "CAD 1", kind: "cad" }),
          ],
        },
        notes: [],
      },
    );
    assert.equal(composed.collapsedLineKind, "lifecycle");
    assert.doesNotMatch(composed.collapsedLine, /YOUR TURN|WAITING ON/);
    assert.equal(composed.fileCount, 1);
  });

  it("omits empty snapshot fields and lists real artifact kinds", () => {
    const composed = cardFor(
      summary({ projectId: PROJECT_A, title: "Chicken ring (his) / Travis" }),
      {
        specs: [
          { fieldName: "cad_job_number", label: "CAD", value: "C010657" },
          { fieldName: "finger_size", label: "Finger size", value: "12.5" },
        ],
        artifacts: {
          connected: true,
          count: 2,
          items: [
            artifact({
              artifactId: ARTIFACT_A,
              title: "CAD on finger",
              kind: "cad",
              createdAt: "2026-09-06T12:00:00.000Z",
            }),
            artifact({
              artifactId: ARTIFACT_B,
              title: "Order confirmation",
              kind: "document",
              mimeType: "application/pdf",
              createdAt: "2026-09-05T12:00:00.000Z",
            }),
          ],
        },
      },
    );
    assert.deepEqual(
      composed.snapshot.map((row) => row.fieldName),
      ["cad_job_number", "finger_size"],
    );
    assert.equal(composed.snapshot.some((row) => row.fieldName === "metal"), false);
    assert.equal(composed.latestFile?.title, "CAD on finger");
    assert.equal(composed.latestFile?.thumbnailSrc, composed.latestFile?.href);
    assert.match(composed.latestFile?.href ?? "", /\/artifacts\/11111111-1111-4111-8111-111111111111\/file/);
    assert.doesNotMatch(composed.latestFile?.href ?? "", /supabase|storage\/v1|public/i);
    assert.deepEqual(
      composed.files.map((row) => row.kindLabel),
      ["CAD", "Document"],
    );
  });

  it("keeps long names, same-person Projects, and same-title Projects isolated by Project ID", () => {
    const long =
      "K. West — wedding band with an unusually long private working title for mobile wrapping";
    const left = summary({
      projectId: PROJECT_A,
      title: "Wedding band",
      people: [{ personId: PERSON_A, displayName: "Madi" }],
    });
    const right = summary({
      projectId: PROJECT_B,
      title: "Wedding band",
      people: [{ personId: PERSON_A, displayName: "Madi" }],
    });
    const named = summary({
      projectId: PROJECT_C,
      title: long,
      people: [{ personId: PERSON_B, displayName: "Kaitlin" }],
    });
    const cards = composeCurrentProjectCards(
      [left, right, named],
      new Map([
        [PROJECT_A, desk({ projectId: PROJECT_A, title: "Wedding band", people: left.people })],
        [PROJECT_B, desk({ projectId: PROJECT_B, title: "Wedding band", people: right.people })],
        [PROJECT_C, desk({ projectId: PROJECT_C, title: long, people: named.people })],
      ]),
    );
    assert.equal(cards.length, 3);
    assert.equal(new Set(cards.map((row) => row.projectId)).size, 3);
    assert.equal(
      cards.filter((row) => row.title === "Wedding band").length,
      2,
    );
    assert.ok(cards.some((row) => row.title === long));
  });

  it("picks the due active Open Job before a snoozed job", () => {
    const selected = pickCurrentOpenJob([
      job({
        jobId: JOB_B,
        subject: "Later snooze",
        state: "snoozed",
        deferredUntil: "2026-10-01T00:00:00.000Z",
        waitingOnActor: "client",
      }),
      job({
        jobId: JOB_A,
        subject: "Send revised CAD",
        waitingOnActor: "founder",
        dueAt: "2026-09-08T00:00:00.000Z",
      }),
    ]);
    assert.equal(selected?.jobId, JOB_A);
  });

  it("records lifecycle history without manufacturing CAD-received from files", () => {
    const composed = cardFor(
      summary({ projectId: PROJECT_A, title: "Lee / Spiegel", lifecycleStage: "cad" }),
      {
        lifecycle: activeLifecycleView({
          projectKind: "custom_new_jewelry",
          states: [
            {
              projectId: PROJECT_A,
              projectKind: "custom_new_jewelry",
              stage: "cad",
              enteredAt: NOW,
              createdAt: NOW,
              updatedAt: NOW,
            },
          ],
          events: [
            {
              eventId: JOB_A,
              projectId: PROJECT_A,
              projectKind: "custom_new_jewelry",
              priorStage: null,
              newStage: "cad",
              changedAt: "2026-09-02T00:00:00.000Z",
              changedBy: "justin",
              sourceSystem: "continuum-reconciliation-v3",
              mutationId: JOB_B,
            },
          ],
        }),
        artifacts: {
          connected: true,
          count: 2,
          items: [
            artifact({ artifactId: ARTIFACT_A, title: "CAD A", kind: "cad" }),
            artifact({ artifactId: ARTIFACT_C, title: "Inspiration", kind: "inspiration" }),
          ],
        },
      },
    );
    assert.deepEqual(
      composed.progress.map((row) => row.label),
      ["Project created", "CAD"],
    );
    assert.equal(
      composed.progress.some((row) => /CAD received/i.test(row.label)),
      false,
    );
  });

  it("uses the unrecorded line when lifecycle is absent and no job exists", () => {
    const row = summary({
      projectId: PROJECT_A,
      title: "Deferred only",
      projectKind: null,
      lifecycleStage: null,
      lifecycleLabel: null,
      projectWork: { ...emptyWork(), unresolvedCount: 1, deferredCount: 1 },
    });
    const work = workItemFrom(row);
    assert.ok(work);
    const composed = composeCurrentProjectCard(
      work,
      desk({
        projectId: PROJECT_A,
        title: "Deferred only",
        projectKind: null,
        lifecycle: activeLifecycleView({ projectKind: null }),
        openJobs: { connected: true, unresolved: [], unresolvedCount: 0 },
        projectWork: { ...emptyWork(), unresolvedCount: 1, deferredCount: 1 },
      }),
    );
    assert.equal(composed.collapsedLine, CURRENT_PROJECTS_ACTION_UNRECORDED);
    assert.equal(composed.collapsedLineKind, "unrecorded");
  });
});
