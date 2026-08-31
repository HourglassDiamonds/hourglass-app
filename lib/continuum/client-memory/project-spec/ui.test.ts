import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";
import { ProjectDeskView } from "../../../../app/executive-dashboard/concierge/components/project-desk-view";
import { ClientProjectCard } from "../../../../app/executive-dashboard/concierge/components/client-project-card";
import type { ProjectDeskRead } from "../project-desk/types";
import { conciergeCorrectProjectKindPath, conciergeCorrectProjectSpecPath } from "../read/presentation";

const PROJECT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PERSON_A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function desk(): ProjectDeskRead {
  return {
    projectId: PROJECT_ID,
    title: "Achedekal ring",
    projectKind: null,
    recordCreatedAt: "2026-08-01T00:00:00.000Z",
    people: [{ personId: PERSON_A, displayName: "A. Achedekal" }],
    specs: [
      { fieldName: "order_number", label: "Order", value: "140" },
      { fieldName: "finger_size", label: "Finger size", value: "141" },
    ],
    specCorrections: [
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        projectId: PROJECT_ID,
        mutationId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        fieldName: "finger_size",
        priorValue: "141",
        newValue: "6.5",
        sourceSystem: "concierge-manual",
        changedAt: "2026-08-27T16:00:00.000Z",
        changedBy: "justin",
      },
    ],
    notes: [],
    latestNoteAt: null,
    latestNotePreview: null,
    coverage: {
      people: "available",
      specs: "available",
      notes: "none",
      jobs: "not-connected",
      files: "not-connected",
      email: "not-connected",
    },
    operationalStatus: {
      kind: "unknown",
      evidence: "Open jobs, files, and email are not connected yet. Current operating state is unknown.",
    },
    operatingLayer: { kind: "none" },
    openJobs: { connected: false },
    artifacts: { connected: false },
  };
}

describe("Project spec correction UI", () => {
  it("exposes founder correction controls on Project Desk without opening jobs or lifecycle", () => {
    const html = renderToStaticMarkup(createElement(ProjectDeskView, { desk: desk() }));
    assert.match(html, /Finger size/);
    assert.match(html, /141/);
    assert.match(html, /Correct/);
    assert.match(html, new RegExp(conciergeCorrectProjectSpecPath(PROJECT_ID, "finger_size")));
    assert.match(html, /Correction history/);
    assert.match(html, /Show prior values/);
    assert.match(html, /141 → 6\.5/);
    assert.match(html, /Project Kind/);
    assert.match(html, /Not set/);
    assert.match(html, />Set</);
    assert.match(html, new RegExp(conciergeCorrectProjectKindPath(PROJECT_ID)));
    assert.match(html, /Status unknown/);
    assert.match(html, /Not connected yet/);
    assert.doesNotMatch(html, /Open Jobs connected|Parked|Waiting on Client/);
    assert.doesNotMatch(html, /saveProjectLifecycle/);
  });

  it("reuses the same correction path from the Person cockpit project card", () => {
    const html = renderToStaticMarkup(
      createElement(ClientProjectCard, {
        project: {
          profile: {
            projectId: PROJECT_ID,
            displayTitle: "Achedekal ring",
            visibility: "internal-only",
          },
          internalHistory: {
            cadJobNumber: null,
            orderNumber: "140",
            gmailThreadId: null,
            matchJudgment: "exact",
            fingerSize: "141",
            metal: null,
            centerStone: null,
            diamondSupplyNotes: null,
          },
        },
      }),
    );
    assert.match(html, /Finger size/);
    assert.match(html, /141/);
    assert.match(html, /Correct/);
    assert.match(html, new RegExp(conciergeCorrectProjectSpecPath(PROJECT_ID, "finger_size")));
    assert.doesNotMatch(html, /continuum-reconciliation-v3|thread-secret/);
  });

  it("requires explicit submit and shows current vs new value", () => {
    const source = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../../../../app/executive-dashboard/concierge/components/correct-project-spec-form.tsx",
      ),
      "utf8",
    );
    assert.match(source, /projectTitle/);
    assert.match(source, /Current:/);
    assert.match(source, /New value/);
    assert.match(source, /Save correction/);
    assert.match(source, /currentSourceLabel/);
    assert.doesNotMatch(source, /autoSave/);
  });

  it("uses a closed Project Kind choice list and explicit submit", () => {
    const source = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../../../../app/executive-dashboard/concierge/components/correct-project-kind-form.tsx",
      ),
      "utf8",
    );
    assert.match(source, /Choose a kind/);
    assert.match(source, /type="radio"/);
    assert.match(source, /PROJECT_KINDS/);
    assert.match(source, /PROJECT_KIND_CLEAR_LABEL/);
    assert.match(source, /Save correction/);
    assert.doesNotMatch(source, /autoSave|onMouseEnter|onMouseOver/);
    assert.doesNotMatch(source, /<textarea|<input type="text"/);
  });
});

describe("Project spec correction page wiring", () => {
  it("does not expose correction controls on public concierge", () => {
    const publicPage = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../../../../app/concierge/page.tsx",
      ),
      "utf8",
    );
    assert.doesNotMatch(publicPage, /correctProjectSpec|correctProjectKind|Save correction/);
  });
});
