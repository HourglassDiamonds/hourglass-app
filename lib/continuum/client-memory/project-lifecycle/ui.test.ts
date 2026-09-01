import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";
import { ProjectDeskView } from "../../../../app/executive-dashboard/concierge/components/project-desk-view";
import { PersonProjectBooksSection } from "../../../../app/executive-dashboard/concierge/components/person-project-books";
import type { ProjectDeskRead } from "../project-desk/types";
import type { PersonProjectBook } from "../project-books/types";
import { conciergeCorrectProjectLifecyclePath } from "../read/presentation";
import { compactLifecycleView, activeLifecycleView } from "./view";
import { activeOperatingLayer } from "../project-operating/layer";

const PROJECT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PERSON_A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

function desk(extra: Partial<ProjectDeskRead> = {}): ProjectDeskRead {
  const projectKind = extra.projectKind ?? null;
  return {
    projectId: PROJECT_ID,
    title: "Achedekal ring",
    projectKind,
    recordCreatedAt: "2026-08-01T00:00:00.000Z",
    people: [{ personId: PERSON_A, displayName: "A. Achedekal" }],
    specs: [{ fieldName: "cad_job_number", label: "CAD", value: "C010657" }],
    specCorrections: [],
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
      evidence:
        "Open jobs, files, and email are not connected yet. Current operating state is unknown.",
    },
    operatingLayer: { kind: "none" },
    lifecycle: compactLifecycleView({ projectKind }),
    openJobs: { connected: false },
    artifacts: { connected: false },
    ...extra,
  };
}

function book(extra: Partial<PersonProjectBook> = {}): PersonProjectBook {
  const projectKind = extra.projectKind ?? null;
  return {
    projectId: PROJECT_ID,
    title: "Achedekal ring",
    projectKind,
    cadIdentifier: "C010657",
    storedOrderIdentifier: null,
    lastMeaningfulAt: "2026-08-22T00:00:00.000Z",
    sourceCount: 0,
    indexedEmailOnFile: false,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-22T00:00:00.000Z",
    overview: {
      title: "Achedekal ring",
      projectKind,
      cadIdentifier: "C010657",
      storedOrderIdentifier: null,
      fingerSize: null,
      metal: null,
      centerStone: null,
      linkedPeople: [],
      indexedEmailOnFile: false,
    },
    itemsAndSpecs: { itemType: null, specs: [] },
    communication: { indexedEmailOnFile: false, sourceCount: 0 },
    decisionsAndApprovals: [],
    cadDesign: { cadIdentifier: "C010657" },
    artifacts: { connected: false, canonicalCount: 0 },
    commercial: { storedOrderIdentifier: null, founderReviewRequired: false },
    operatingLayer: { kind: "none" },
    lifecycle: compactLifecycleView({ projectKind }),
    history: [],
    ...extra,
  };
}

describe("Project Lifecycle UI", () => {
  it("shows Custom lifecycle rail without fake progress", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectDeskView, {
        desk: desk({
          projectKind: "custom_new_jewelry",
          lifecycle: activeLifecycleView({
            projectKind: "custom_new_jewelry",
            states: [
              {
                projectId: PROJECT_ID,
                projectKind: "custom_new_jewelry",
                stage: "cad",
                enteredAt: "2026-08-31T00:00:00.000Z",
                createdAt: "2026-08-31T00:00:00.000Z",
                updatedAt: "2026-08-31T00:00:00.000Z",
              },
            ],
            events: [
              {
                eventId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
                projectId: PROJECT_ID,
                projectKind: "custom_new_jewelry",
                priorStage: "design",
                newStage: "cad",
                changedAt: "2026-08-31T12:00:00.000Z",
                changedBy: "justin",
                sourceSystem: "concierge-manual",
                mutationId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
              },
            ],
          }),
        }),
      }),
    );
    assert.match(html, />Lifecycle</);
    assert.match(html, /Current Stage/);
    assert.match(html, />CAD</);
    assert.match(html, /Discovery/);
    assert.match(html, /Client Approval/);
    assert.match(html, /Ready for Delivery/);
    assert.match(html, /Complete/);
    assert.match(html, /Current/);
    assert.match(html, /Lifecycle history/);
    assert.match(html, /Design → CAD/);
    assert.match(html, new RegExp(conciergeCorrectProjectLifecyclePath(PROJECT_ID)));
    assert.doesNotMatch(html, /37%|5 of 8|progress bar|% complete/);
    assert.doesNotMatch(html, /Intake|Bench|Ready for Return/);
    assert.doesNotMatch(html, /Waiting on|overdue|sold|deposit paid/);
  });

  it("shows Repair lifecycle and hides it for other kinds", () => {
    const repair = renderToStaticMarkup(
      createElement(ProjectDeskView, {
        desk: desk({
          projectKind: "repair_service",
          operatingLayer: activeOperatingLayer({ projectKind: "repair_service" }),
        }),
      }),
    );
    assert.match(repair, /Current Stage/);
    assert.match(repair, /Not set/);
    assert.match(repair, /Intake/);
    assert.match(repair, /Evaluation/);
    assert.match(repair, /Bench/);
    assert.match(repair, /Ready for Return/);
    assert.doesNotMatch(repair, /Discovery|Ready for Delivery/);
    const other = renderToStaticMarkup(
      createElement(ProjectDeskView, {
        desk: desk({ projectKind: "other" }),
      }),
    );
    assert.doesNotMatch(other, /Current Stage/);
    assert.doesNotMatch(other, /Discovery|Intake/);
    const unset = renderToStaticMarkup(createElement(ProjectDeskView, { desk: desk() }));
    assert.doesNotMatch(unset, /Current Stage/);
  });

  it("shows compact lifecycle in Project Book overview without header clutter or editor", () => {
    const html = renderToStaticMarkup(
      createElement(PersonProjectBooksSection, {
        books: [
          book({
            projectKind: "custom_new_jewelry",
            operatingLayer: activeOperatingLayer({
              projectKind: "custom_new_jewelry",
            }),
            lifecycle: compactLifecycleView({
              projectKind: "custom_new_jewelry",
              states: [
                {
                  projectId: PROJECT_ID,
                  projectKind: "custom_new_jewelry",
                  stage: "cad",
                  enteredAt: "2026-08-31T00:00:00.000Z",
                  createdAt: "2026-08-31T00:00:00.000Z",
                  updatedAt: "2026-08-31T00:00:00.000Z",
                },
              ],
            }),
          }),
        ],
      }),
    );
    assert.match(html, />Lifecycle</);
    assert.match(html, />CAD</);
    assert.match(html, /Open Project Desk/);
    const header = html.slice(0, html.indexOf("Overview"));
    assert.doesNotMatch(header, />Lifecycle</);
    assert.doesNotMatch(html, /textarea|Save correction|Choose a stage/);
    assert.doesNotMatch(html, /Design → CAD|Lifecycle history/);
    assert.doesNotMatch(html, /aria-expanded/);
  });

  it("keeps the lifecycle edit route noindexed and keyboard-accessible", () => {
    const page = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/projects/[projectId]/lifecycle/page.tsx"),
      "utf8",
    );
    const form = readFileSync(
      join(
        ROOT,
        "app/executive-dashboard/concierge/components/correct-project-lifecycle-form.tsx",
      ),
      "utf8",
    );
    const css = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/concierge.css"),
      "utf8",
    );
    assert.match(page, /index: false/);
    assert.match(page, /noarchive: true/);
    assert.match(form, /hg-project-kind-choice/);
    assert.match(form, /focus-visible/);
    assert.match(form, /PROJECT_LIFECYCLE_CLEAR_LABEL/);
    assert.match(css, /hg-lifecycle-rail/);
    assert.match(css, /flex-wrap/);
  });
});
