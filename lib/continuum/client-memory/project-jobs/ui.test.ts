import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";
import { ProjectDeskView } from "../../../../app/executive-dashboard/concierge/components/project-desk-view";
import type { ProjectDeskRead } from "../project-desk/types";
import { compactLifecycleView } from "../project-lifecycle/view";
import {
  OPEN_JOBS_NONE_LABEL,
  OPEN_JOBS_NOT_CONNECTED_LABEL,
} from "./present";

const PROJECT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PERSON_A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const JOB_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

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
      files: "not-connected",
      email: "not-connected",
    },
    operationalStatus: {
      kind: "unknown",
      evidence:
        "Files and email are not connected yet. Current operating state is unknown.",
    },
    operatingLayer: { kind: "none" },
    lifecycle: compactLifecycleView({ projectKind: null }),
    openJobs: { connected: true, unresolved: [], unresolvedCount: 0 },
    projectWork: { connected: true, unresolvedCount: 0, activeCount: 0, deferredCount: 0, waitingOn: { founder: 0, hourglass: 0, client: 0, vendor: 0, unknown: 0 }, blocked: false, dueSoonCount: 0, pastDueCount: 0, forgottenRiskCount: 0, nextDueAt: null },
    artifacts: { connected: false },
    ...extra,
  };
}

describe("Open Jobs Project Desk UI", () => {
  it("shows none, one, and disconnected coverage with restrained founder controls", () => {
    const none = renderToStaticMarkup(createElement(ProjectDeskView, { desk: desk() }));
    assert.match(none, new RegExp(OPEN_JOBS_NONE_LABEL));
    assert.match(none, /Add open job/);
    assert.match(
      none,
      /\/executive-dashboard\/concierge\/projects\/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\/jobs\/new/,
    );
    assert.doesNotMatch(none, /Resolve|Snooze|Cancel job|Today 5|Chief of Staff/);
    const disconnected = renderToStaticMarkup(
      createElement(ProjectDeskView, {
        desk: desk({
          coverage: {
            people: "available",
            specs: "available",
            notes: "none",
            jobs: "not-connected",
            files: "not-connected",
            email: "not-connected",
          },
          openJobs: { connected: false },
        }),
      }),
    );
    assert.match(disconnected, new RegExp(OPEN_JOBS_NOT_CONNECTED_LABEL));
    assert.doesNotMatch(disconnected, /Add open job/);
    const html = renderToStaticMarkup(
      createElement(ProjectDeskView, {
        desk: desk({
          coverage: {
            people: "available",
            specs: "available",
            notes: "none",
            jobs: "available",
            files: "not-connected",
            email: "not-connected",
          },
          openJobs: {
            connected: true,
            unresolvedCount: 1,
            unresolved: [
              {
                jobId: JOB_ID,
                kind: "commitment",
                subject: "Revise CAD",
                detail: null,
                waitingOnActor: "founder",
                associatedPersonId: null,
                associatedPersonName: null,
                state: "open",
                dueAt: "2026-09-12T00:00:00.000Z",
                deferredUntil: null,
                createdAt: "2026-09-05T00:00:00.000Z",
                sourceSystem: "concierge-manual",
              },
            ],
          },
          projectWork: {
            connected: true,
            unresolvedCount: 1,
            activeCount: 1,
            deferredCount: 0,
            waitingOn: {
              founder: 1,
              hourglass: 0,
              client: 0,
              vendor: 0,
              unknown: 0,
            },
            blocked: false,
            dueSoonCount: 1,
            pastDueCount: 0,
            forgottenRiskCount: 0,
            nextDueAt: "2026-09-12T00:00:00.000Z",
          },
        }),
      }),
    );
    assert.match(html, /Revise CAD/);
    assert.match(html, /Commitment/);
    assert.match(html, /Actor/);
    assert.match(html, /Founder/);
    assert.match(html, /1 unresolved/);
    assert.match(html, /Founder action/);
    assert.match(html, /Due within 7 days/);
    assert.match(html, /Add open job/);
    assert.match(html, /Open job/);
    assert.match(
      html,
      /\/executive-dashboard\/concierge\/projects\/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\/jobs\/cccccccc-cccc-4ccc-8ccc-cccccccccccc/,
    );
    assert.doesNotMatch(html, /Waiting on Client/);
    assert.doesNotMatch(html, /secret-thread|gmail_thread/);
    assert.doesNotMatch(html, /Resolve job|Snooze|kanban|Trello|Jira/);
  });
});
