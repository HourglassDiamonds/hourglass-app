import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";
import { ProjectDeskView } from "../../../../app/executive-dashboard/concierge/components/project-desk-view";
import { PersonProjectBooksSection } from "../../../../app/executive-dashboard/concierge/components/person-project-books";
import { OperatingLayerWrongKindNotice } from "../../../../app/executive-dashboard/concierge/components/operating-layer-page";
import type { ProjectDeskRead } from "../project-desk/types";
import type { PersonProjectBook } from "../project-books/types";
import {
  conciergeCorrectOperatingDetailPath,
  conciergeProjectCustomPath,
  conciergeProjectRepairPath,
} from "../read/presentation";
import { activeOperatingLayer } from "./layer";
import { emptyCustomDetails, emptyRepairDetails } from "./fields";

const PROJECT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PERSON_A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

function desk(extra: Partial<ProjectDeskRead> = {}): ProjectDeskRead {
  return {
    projectId: PROJECT_ID,
    title: "Achedekal ring",
    projectKind: null,
    recordCreatedAt: "2026-08-01T00:00:00.000Z",
    people: [{ personId: PERSON_A, displayName: "A. Achedekal" }],
    specs: [
      { fieldName: "finger_size", label: "Finger size", value: "6.5" },
    ],
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
    openJobs: { connected: false },
    artifacts: { connected: false },
    ...extra,
  };
}

function book(extra: Partial<PersonProjectBook> = {}): PersonProjectBook {
  return {
    projectId: PROJECT_ID,
    title: "Achedekal ring",
    projectKind: null,
    cadIdentifier: "C010657",
    storedOrderIdentifier: null,
    lastMeaningfulAt: "2026-08-22T00:00:00.000Z",
    sourceCount: 0,
    indexedEmailOnFile: false,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-22T00:00:00.000Z",
    overview: {
      title: "Achedekal ring",
      projectKind: null,
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
    history: [],
    ...extra,
  };
}

describe("Custom / Repair operating-layer UI", () => {
  it("A. shows Custom fields only for custom_new_jewelry", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectDeskView, {
        desk: desk({
          projectKind: "custom_new_jewelry",
          operatingLayer: activeOperatingLayer({
            projectKind: "custom_new_jewelry",
            customDetails: {
              ...emptyCustomDetails(PROJECT_ID, "2026-08-31T00:00:00.000Z"),
              designBrief: "Three-stone engagement ring",
            },
          }),
        }),
      }),
    );
    assert.match(html, /CUSTOM \/ NEW JEWELRY/);
    assert.match(html, /Design Brief/);
    assert.match(html, /Three-stone engagement ring/);
    assert.match(html, /Design Requirements/);
    assert.match(html, /Not set/);
    assert.match(html, /Manufacturing Notes/);
    assert.match(html, /Finger size/);
    assert.match(
      html,
      new RegExp(conciergeCorrectOperatingDetailPath(PROJECT_ID, "custom_design_brief")),
    );
    assert.doesNotMatch(html, /Item Description|Requested Service|Condition Notes/);
    assert.doesNotMatch(html, /repair stage|Received|Bench|QC/);
  });

  it("B. shows Repair fields only for repair_service", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectDeskView, {
        desk: desk({
          projectKind: "repair_service",
          operatingLayer: activeOperatingLayer({
            projectKind: "repair_service",
            repairDetails: {
              ...emptyRepairDetails(PROJECT_ID, "2026-08-31T00:00:00.000Z"),
              requestedService: "Replace head",
            },
          }),
        }),
      }),
    );
    assert.match(html, /REPAIR \/ SERVICE/);
    assert.match(html, /Item Description/);
    assert.match(html, /Requested Service/);
    assert.match(html, /Replace head/);
    assert.match(html, /Condition Notes/);
    assert.match(html, /Technical Notes/);
    assert.doesNotMatch(html, /Design Brief|Design Requirements/);
    assert.doesNotMatch(html, /workflow|Received|diagnosis|pickup/i);
  });

  it("C. hides both specialized layers when Kind is unset", () => {
    const html = renderToStaticMarkup(createElement(ProjectDeskView, { desk: desk() }));
    assert.doesNotMatch(html, /CUSTOM \/ NEW JEWELRY/);
    assert.doesNotMatch(html, /REPAIR \/ SERVICE/);
    assert.doesNotMatch(html, /Design Brief/);
    assert.doesNotMatch(html, /Requested Service/);
  });

  it("keeps Project Book header free of operating-detail clutter", () => {
    const html = renderToStaticMarkup(
      createElement(PersonProjectBooksSection, {
        books: [
          book({
            projectKind: "repair_service",
            operatingLayer: activeOperatingLayer({
              projectKind: "repair_service",
              repairDetails: {
                ...emptyRepairDetails(PROJECT_ID, "2026-08-31T00:00:00.000Z"),
                requestedService: "Replace head",
                conditionNotes: "Broken prong",
              },
            }),
          }),
        ],
      }),
    );
    assert.match(html, /Repair \/ Service Details/);
    assert.match(html, /Replace head/);
    assert.match(html, /Broken prong/);
    assert.match(html, /Open Project Desk/);
    const header = html.slice(0, html.indexOf("Overview"));
    assert.doesNotMatch(header, /Replace head|Broken prong|Design Brief/);
    assert.doesNotMatch(html, /textarea|Save correction/);
    assert.doesNotMatch(html, /aria-expanded/);
  });

  it("wrong-kind routes stay honest and do not change Kind", () => {
    const html = renderToStaticMarkup(
      createElement(OperatingLayerWrongKindNotice, {
        projectId: PROJECT_ID,
        projectTitle: "Achedekal ring",
        expected: "custom_new_jewelry",
        currentKind: "repair_service",
      }),
    );
    assert.match(html, /currently classified as Repair \/ Service/);
    assert.doesNotMatch(html, /Save correction/);
    const customPage = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/projects/[projectId]/custom/page.tsx"),
      "utf8",
    );
    const repairPage = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/projects/[projectId]/repair/page.tsx"),
      "utf8",
    );
    assert.match(customPage, /noindex|index: false/);
    assert.match(repairPage, /noindex|index: false/);
    assert.doesNotMatch(customPage, /correctProjectKind/);
    assert.doesNotMatch(repairPage, /correctProjectKind/);
    assert.match(customPage, new RegExp(conciergeProjectCustomPath(PROJECT_ID).split("/").pop()!));
    assert.match(repairPage, new RegExp(conciergeProjectRepairPath(PROJECT_ID).split("/").pop()!));
  });
});
