import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";
import { OpenProjectsHome } from "../../../../app/executive-dashboard/concierge/components/open-projects-home";
import { ChiefOfStaffToday } from "../../../../app/executive-dashboard/concierge/components/chief-of-staff-today";
import { composeContinuumHome } from "../../dashboard/compose";
import type { OpenProjectWorkItem } from "./select";
import type { ProjectWorkSummary } from "../project-jobs/intelligence";

const PROJECT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CONCIERGE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../app/executive-dashboard/concierge",
);

function work(
  extra: Partial<Extract<ProjectWorkSummary, { connected: true }>> = {},
): Extract<ProjectWorkSummary, { connected: true }> {
  return {
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
    dueSoonCount: 0,
    pastDueCount: 0,
    forgottenRiskCount: 0,
    nextDueAt: null,
    ...extra,
  };
}

function item(extra: Partial<OpenProjectWorkItem> = {}): OpenProjectWorkItem {
  return {
    projectId: PROJECT_A,
    title: "Oval ring",
    people: [{ personId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", displayName: "Ada" }],
    lifecycleStage: "production",
    lifecycleLabel: "Production",
    projectWork: work(),
    href: `/executive-dashboard/concierge/projects/${PROJECT_A}`,
    ...extra,
  };
}

describe("Open Project work Command Center UI", () => {
  it("renders zero, one, and lifecycle plus jobs without CoS ranking", () => {
    const empty = renderToStaticMarkup(createElement(OpenProjectsHome, { projects: [] }));
    assert.match(empty, /Project work/);
    assert.match(empty, /No current project work/);
    assert.doesNotMatch(empty, /Today 5|Chief of Staff|priority|Agent OS/i);
    const html = renderToStaticMarkup(
      createElement(OpenProjectsHome, {
        projects: [
          item({
            projectWork: work({
              nextDueAt: "2026-09-12T00:00:00.000Z",
              dueSoonCount: 1,
            }),
          }),
        ],
      }),
    );
    assert.match(html, /Oval ring/);
    assert.match(html, /Ada/);
    assert.match(html, /Production/);
    assert.match(html, /1 unresolved/);
    assert.match(html, /Founder action/);
    assert.match(html, /Next due/);
    assert.match(
      html,
      /\/executive-dashboard\/concierge\/projects\/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/,
    );
    assert.doesNotMatch(html, /Waiting on Client|kanban|Trello|Jira/);
    assert.doesNotMatch(html, /<table/i);
  });

  it("keeps Command Center CoS quiet and does not replace it with Project work", () => {
    const model = composeContinuumHome({
      now: new Date("2026-08-24T18:00:00.000Z"),
    });
    const cos = renderToStaticMarkup(
      createElement(ChiefOfStaffToday, { chiefOfStaff: model.chiefOfStaff }),
    );
    const command = readFileSync(
      join(CONCIERGE_DIR, "components", "command-center-home.tsx"),
      "utf8",
    );
    const work = renderToStaticMarkup(createElement(OpenProjectsHome, { projects: [item()] }));
    assert.match(cos, /Chief of Staff/);
    assert.match(cos, /Nothing in memory needs your attention yet/);
    assert.match(command, /ChiefOfStaffToday/);
    assert.match(command, /OpenProjectsHome/);
    assert.doesNotMatch(command, /composeChiefOfStaffBrief|activateCoS|agent-os/);
    assert.match(work, /Project work/);
    assert.match(work, /Oval ring/);
    assert.doesNotMatch(work, /Today 5|Chief of Staff/);
  });
});
