import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";
import { ProjectDeskView } from "../../../../app/executive-dashboard/concierge/components/project-desk-view";
import type { ProjectDeskRead } from "../project-desk/types";
import { compactLifecycleView } from "../project-lifecycle/view";
import {
  PROJECT_ARTIFACT_ADD_LABEL,
  PROJECT_ARTIFACT_DELETION_LABEL,
  PROJECT_ARTIFACTS_NONE_LABEL,
  PROJECT_ARTIFACTS_NOT_CONNECTED_LABEL,
} from "./present";
import { conciergeProjectArtifactFilePath } from "../read/presentation";

const PROJECT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PERSON_A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ARTIFACT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function desk(extra: Partial<ProjectDeskRead> = {}): ProjectDeskRead {
  return {
    projectId: PROJECT_ID,
    title: "Achedekal ring",
    projectKind: null,
    recordCreatedAt: "2026-08-01T00:00:00.000Z",
    people: [{ personId: PERSON_A, displayName: "A. Achedekal" }],
    specs: [{ fieldName: "finger_size", label: "Finger size", value: "6.5" }],
    specCorrections: [],
    notes: [],
    latestNoteAt: null,
    latestNotePreview: null,
    coverage: {
      people: "available",
      specs: "available",
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
    lifecycle: compactLifecycleView({ projectKind: null }),
    openJobs: { connected: true, unresolved: [], unresolvedCount: 0 },
    projectWork: {
      connected: true,
      unresolvedCount: 0,
      activeCount: 0,
      deferredCount: 0,
      waitingOn: { founder: 0, hourglass: 0, client: 0, vendor: 0, unknown: 0 },
      blocked: false,
      dueSoonCount: 0,
      pastDueCount: 0,
      forgottenRiskCount: 0,
      nextDueAt: null,
    },
    artifacts: { connected: true, items: [], count: 0 },
    ...extra,
  };
}

describe("Project Artifacts Project Desk UI", () => {
  it("shows none, one, multiple, and disconnected coverage", () => {
    const none = renderToStaticMarkup(createElement(ProjectDeskView, { desk: desk() }));
    assert.match(none, new RegExp(PROJECT_ARTIFACTS_NONE_LABEL.replace(".", "\\.")));
    assert.match(none, new RegExp(PROJECT_ARTIFACT_ADD_LABEL));
    assert.match(none, new RegExp(PROJECT_ARTIFACT_DELETION_LABEL));
    assert.match(
      none,
      /\/executive-dashboard\/concierge\/projects\/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\/artifacts\/new/,
    );
    assert.doesNotMatch(none, /Today 5|Chief of Staff|getPublicUrl|shape-studio/);
    const disconnected = renderToStaticMarkup(
      createElement(ProjectDeskView, {
        desk: desk({
          coverage: {
            people: "available",
            specs: "available",
            notes: "none",
            jobs: "none",
            files: "not-connected",
            email: "not-connected",
          },
          artifacts: { connected: false },
        }),
      }),
    );
    assert.match(disconnected, new RegExp(PROJECT_ARTIFACTS_NOT_CONNECTED_LABEL));
    assert.doesNotMatch(disconnected, /Add project file/);
    const one = renderToStaticMarkup(
      createElement(ProjectDeskView, {
        desk: desk({
          coverage: {
            people: "available",
            specs: "available",
            notes: "none",
            jobs: "none",
            files: "available",
            email: "not-connected",
          },
          artifacts: {
            connected: true,
            count: 1,
            items: [
              {
                artifactId: ARTIFACT_ID,
                kind: "render",
                title: "Render 1",
                originalFilename: "render-1.png",
                mimeType: "image/png",
                byteSize: 2048,
                createdAt: "2026-09-05T16:00:00.000Z",
                sourceSystem: "concierge-manual",
                href: conciergeProjectArtifactFilePath(PROJECT_ID, ARTIFACT_ID),
              },
            ],
          },
        }),
      }),
    );
    assert.match(one, /Render 1/);
    assert.match(one, /Render/);
    assert.match(one, new RegExp(conciergeProjectArtifactFilePath(PROJECT_ID, ARTIFACT_ID)));
    const many = renderToStaticMarkup(
      createElement(ProjectDeskView, {
        desk: desk({
          artifacts: {
            connected: true,
            count: 2,
            items: [
              {
                artifactId: ARTIFACT_ID,
                kind: "render",
                title: "Render 1",
                originalFilename: "render-1.png",
                mimeType: "image/png",
                byteSize: 2048,
                createdAt: "2026-09-05T16:00:00.000Z",
                sourceSystem: "concierge-manual",
                href: conciergeProjectArtifactFilePath(PROJECT_ID, ARTIFACT_ID),
              },
              {
                artifactId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
                kind: "cad",
                title: "CAD",
                originalFilename: "cad.pdf",
                mimeType: "application/pdf",
                byteSize: 4096,
                createdAt: "2026-09-04T16:00:00.000Z",
                sourceSystem: "continuum",
                href: conciergeProjectArtifactFilePath(
                  PROJECT_ID,
                  "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
                ),
              },
            ],
          },
        }),
      }),
    );
    assert.match(many, /Render 1/);
    assert.match(many, /CAD/);
    assert.match(many, /Open file/);
  });
});
