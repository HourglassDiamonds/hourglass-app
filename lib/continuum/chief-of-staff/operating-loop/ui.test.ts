import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";
import { ChiefOfStaffToday } from "../../../../app/executive-dashboard/concierge/components/chief-of-staff-today";
import { OpenProjectsHome } from "../../../../app/executive-dashboard/concierge/components/open-projects-home";
import { composeCosOperatingLoop } from "./compose";
import {
  COS_LOOP_NOW,
  fixtureCandidate,
  fixtureJob,
  fixtureProjects,
} from "./fixtures";
import type { CurrentProjectCard } from "../../client-memory/open-projects/card";

const CONCIERGE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../app/executive-dashboard/concierge",
);

function card(): CurrentProjectCard {
  return {
    projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    title: "Lee / Spiegel",
    href: "/executive-dashboard/concierge/projects/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    collapsedLine: "YOUR TURN — Send CAD",
    collapsedLineKind: "ownership",
    currentAction: {
      label: "YOUR TURN",
      detail: "Send CAD",
      source: "ownership",
    },
    snapshot: [],
    latestFile: null,
    files: [],
    fileCount: 0,
    progress: [],
  };
}

describe("CoS operating loop Command Center UI", () => {
  it("renders Top 5 with 44px checkboxes and no horizontal overflow classes", () => {
    const jobs = Array.from({ length: 3 }, (_, index) =>
      fixtureJob({
        jobId: `cccccccc-cccc-4ccc-8ccc-ccccccccccc${index}`,
        subject: `Send revision ${index} for a concise founder action`,
      }),
    );
    const loop = composeCosOperatingLoop({
      jobs,
      projects: fixtureProjects(),
      nowIso: COS_LOOP_NOW,
      newMutationId: () => "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    });
    const html = renderToStaticMarkup(createElement(ChiefOfStaffToday, { loop }));
    assert.match(html, /data-cos-operating-loop="active"/);
    assert.match(html, /Top 5/);
    assert.equal([...html.matchAll(/hg-cos-check/g)].length, 3);
    assert.match(html, /min-w-0/);
    assert.match(html, /overflow-x-hidden/);
    assert.match(html, /break-words/);
    assert.match(html, /Open project/);
    assert.match(html, /current-project-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-toggle/);
    assert.doesNotMatch(html, /score|percent|%/i);
    assert.doesNotMatch(html, /chain of thought|hidden reasoning/i);
    const css = readFileSync(join(CONCIERGE_DIR, "concierge.css"), "utf8");
    assert.match(css, /\.hg-cos-check[\s\S]*min-width:\s*2\.75rem/);
    assert.match(css, /\.hg-cos-check[\s\S]*min-height:\s*2\.75rem/);
    assert.match(css, /\.hg-cos-top5[\s\S]*overflow-x:\s*hidden/);
  });

  it("shows a quiet caught-up state and omits the anomaly section when nothing is wrong", () => {
    const loop = composeCosOperatingLoop({
      jobs: [],
      projects: fixtureProjects(),
      nowIso: COS_LOOP_NOW,
    });
    const html = renderToStaticMarkup(createElement(ChiefOfStaffToday, { loop }));
    assert.match(html, /caught up/);
    assert.doesNotMatch(html, /data-cos-anomalies/);
    assert.doesNotMatch(html, /Items that seem amiss/);
    assert.doesNotMatch(html, /hg-cos-check/);
  });

  it("renders recap and anomaly copy without auto-complete controls on ambiguous items", () => {
    const loop = composeCosOperatingLoop({
      jobs: [
        fixtureJob({
          jobId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          subject: "Send Lee the render",
          kind: "commitment",
        }),
        fixtureJob({
          jobId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          subject: "Call vendor",
          dueAt: "2026-08-01T00:00:00.000Z",
          createdAt: "2026-07-01T00:00:00.000Z",
        }),
      ],
      candidates: [
        fixtureCandidate({
          candidateId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          candidateType: "follow_up",
          payload: {
            kind: "follow_up",
            text: "I replied to Lee this afternoon.",
            dueAt: null,
            sourceTimestamp: "2026-09-07T18:00:00.000Z",
          },
          evidenceBasis: {
            ruleIds: ["explicit_follow_up"],
            matchedText: "I replied to Lee",
          },
        }),
      ],
      projects: fixtureProjects(),
      nowIso: COS_LOOP_NOW,
    });
    const html = renderToStaticMarkup(createElement(ChiefOfStaffToday, { loop }));
    assert.match(html, /End of day/);
    assert.match(html, /actually sent/);
    assert.match(html, /Confirmation only/);
    assert.match(html, /Items that seem amiss/);
    assert.match(html, /Past due, with no evidence of action/);
  });

  it("keeps Current Projects accordion as the only project operating surface", () => {
    const work = renderToStaticMarkup(
      createElement(OpenProjectsHome, { projects: [card()] }),
    );
    assert.match(work, /Current Projects/);
    assert.doesNotMatch(work, /aria-expanded/);
    const command = readFileSync(
      join(CONCIERGE_DIR, "components", "command-center-home.tsx"),
      "utf8",
    );
    const home = readFileSync(join(CONCIERGE_DIR, "page.tsx"), "utf8");
    assert.match(command, /OpenProjectsHome/);
    assert.match(command, /operatingLoop/);
    assert.match(command, /completeAction/);
    assert.doesNotMatch(command, /from "\.\/projects-home"/);
    assert.match(home, /completeTop5OpenJobAction/);
    assert.match(home, /loadCosOperatingLoop/);
    assert.match(home, /loadCurrentProjectCards/);
  });
});
