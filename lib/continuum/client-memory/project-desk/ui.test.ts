import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";
import { ProjectsHome } from "../../../../app/executive-dashboard/concierge/components/projects-home";
import { ProjectBookView } from "../../../../app/executive-dashboard/concierge/components/project-book-view";
import { conciergeProjectPath } from "../read/presentation";
import type { ProjectDeskSummary } from "./types";

const PROJECT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PERSON_A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function summary(overrides: Partial<ProjectDeskSummary> = {}): ProjectDeskSummary {
  return {
    projectId: PROJECT_ID,
    title: "Oval ring",
    projectKind: null,
    people: [{ personId: PERSON_A, displayName: "Ada Lovelace" }],
    latestNoteAt: "2026-08-22T00:00:00.000Z",
    latestNotePreview: "Prefers morning calls.",
    coverage: {
      people: "available",
      specs: "available",
      notes: "available",
      jobs: "not-connected",
      files: "not-connected",
      email: "not-connected",
    },
    recordCreatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function deskSource(): string {
  return readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "../../../../app/executive-dashboard/concierge/components/project-desk-view.tsx",
    ),
    "utf8",
  );
}

describe("Project Desk UI", () => {
  it("makes operating uncertainty explicit instead of claiming open/parked/closed", () => {
    const html = renderToStaticMarkup(createElement(ProjectsHome, { projects: [] }));
    assert.match(html, /Current operating state is unknown/);
    assert.doesNotMatch(html, /No projects are currently marked open/);
    assert.doesNotMatch(html, /marked open|Parked|Closed/);
    assert.match(html, /View all projects/);
  });

  it("keeps the desk free of lifecycle mutation and invented waiting-on", () => {
    const html = deskSource();
    assert.match(html, /Status unknown/);
    assert.match(html, /Project Details/);
    assert.match(html, /Project Kind/);
    assert.match(html, /conciergeCorrectProjectKindPath/);
    assert.match(html, /conciergeClientPath/);
    assert.match(html, /Not connected yet/);
    assert.match(html, /No project files stored yet/);
    assert.match(html, /Add a note/);
    assert.match(html, /Correct/);
    assert.match(html, /Correction history/);
    assert.doesNotMatch(html, /ProjectLifecycleForm|saveProjectLifecycle/);
    assert.doesNotMatch(html, /Waiting on Client|No Current Action|overdue/);
    assert.doesNotMatch(html, /gmail_thread|thread-secret|import_row/);
    assert.doesNotMatch(html, />History</);
    assert.doesNotMatch(html, /Parked|lifecycle/);
  });

  it("renders the project book without lifecycle tabs", () => {
    const empty = renderToStaticMarkup(createElement(ProjectBookView, { projects: [] }));
    assert.match(empty, /Current operating state is unknown/);
    assert.doesNotMatch(empty, /Review unknown|lifecycle=unknown|Parked/);
    const html = renderToStaticMarkup(
      createElement(ProjectBookView, { projects: [summary()] }),
    );
    assert.match(html, /Oval ring/);
    assert.match(html, /Ada Lovelace/);
    assert.match(html, new RegExp(conciergeProjectPath(PROJECT_ID)));
    assert.doesNotMatch(html, /Open\b|Parked|Closed/);
  });
});
