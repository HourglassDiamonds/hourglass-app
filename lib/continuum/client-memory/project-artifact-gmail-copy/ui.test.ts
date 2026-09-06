import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";
import { resolve } from "node:path";
import { ProjectDeskView } from "../../../../app/executive-dashboard/concierge/components/project-desk-view";
import type { ProjectDeskRead } from "../project-desk/types";
import { compactLifecycleView } from "../project-lifecycle/view";
import {
  conciergeCopyGmailProjectArtifactPath,
  conciergeProjectArtifactFilePath,
} from "../read/presentation";
import { GMAIL_COPY_APPROVAL } from "./constants";

const PROJECT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ARTIFACT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function desk(extra: Partial<ProjectDeskRead> = {}): ProjectDeskRead {
  return {
    projectId: PROJECT_ID,
    title: "Achedekal ring",
    projectKind: null,
    recordCreatedAt: "2026-08-01T00:00:00.000Z",
    people: [],
    specs: [],
    specCorrections: [],
    notes: [],
    latestNoteAt: null,
    latestNotePreview: null,
    coverage: {
      people: "none",
      specs: "none",
      notes: "none",
      jobs: "none",
      files: "available",
      email: "available",
    },
    operationalStatus: {
      kind: "unknown",
      evidence: "Email is connected.",
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
          createdAt: "2026-09-06T16:00:00.000Z",
          sourceSystem: "gmail",
          href: conciergeProjectArtifactFilePath(PROJECT_ID, ARTIFACT_ID),
        },
      ],
    },
    ...extra,
  };
}

describe("Gmail copy-in UI", () => {
  it("shows attachment, source email, destination Project, and COPY TO PROJECT", () => {
    const form = readFileSync(
      resolve(
        process.cwd(),
        "app/executive-dashboard/concierge/components/copy-gmail-attachment-to-project-form.tsx",
      ),
      "utf8",
    );
    assert.match(form, /preview\.filename/);
    assert.match(form, /preview\.subject/);
    assert.match(form, /projectTitle/);
    assert.match(form, /Copy to project/);
    assert.match(form, /Destination project/);
    assert.match(form, /name="approval"/);
    assert.match(form, /GMAIL_COPY_APPROVAL/);
    assert.equal(GMAIL_COPY_APPROVAL, "COPY_TO_PROJECT");
    assert.doesNotMatch(form, /getPublicUrl|Attach automatically|Apply automatically/);
  });

  it("shows a successful Gmail copy on Project Desk Files", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectDeskView, { desk: desk() }),
    );
    assert.match(html, /Render 1/);
    assert.match(html, /Gmail copy/);
    assert.match(html, new RegExp(conciergeProjectArtifactFilePath(PROJECT_ID, ARTIFACT_ID)));
    assert.doesNotMatch(html, /Attach automatically/);
  });

  it("exposes copy-in from Gmail evidence without opening bytes", () => {
    const hunt = readFileSync(
      resolve(
        process.cwd(),
        "app/executive-dashboard/concierge/components/artifact-hunt.tsx",
      ),
      "utf8",
    );
    assert.match(hunt, /Copy to project/);
    assert.match(hunt, /conciergeCopyGmailProjectArtifactPath/);
    assert.doesNotMatch(hunt, /getAttachment|createLiveKnownArtifactGmailApi/);
    assert.match(
      conciergeCopyGmailProjectArtifactPath(PROJECT_ID, {
        messageId: "msg-copy-1",
        attachmentId: "att-copy-1",
      }),
      /copy-from-gmail/,
    );
  });
});
