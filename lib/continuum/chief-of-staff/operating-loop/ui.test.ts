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
    currentJobId: null,
    snapshot: [],
    latestFile: null,
    files: [],
    fileCount: 0,
    progress: [],
    lifecycleStage: "cad",
    founderOwnedUnresolved: true,
    actionDueAt: null,
    waitingSince: null,
    updatedAt: null,
  };
}

describe("CoS operating loop Command Center UI", () => {
  it("renders Up next with 44px checkboxes and no horizontal overflow classes", () => {
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
    assert.match(html, /Up next/i);
    assert.doesNotMatch(html, /Concierge Brief|Recommended:|>Top 5</);
    assert.equal([...html.matchAll(/hg-cos-check/g)].length, 3);
    assert.match(html, /min-w-0/);
    assert.match(html, /overflow-x-hidden/);
    assert.match(html, /break-words/);
    assert.match(html, /Open project/);
    assert.match(html, />Edit<\/a>/);
    assert.match(
      html,
      /\/executive-dashboard\/concierge\/action\/cccccccc-cccc-4ccc-8ccc-ccccccccccc0\/edit/,
    );
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
    assert.doesNotMatch(html, /Something seems off/);
    assert.doesNotMatch(html, /Needs your decision/);
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
    assert.match(html, /actually sent/);
    assert.match(html, /Confirmation only/);
    assert.doesNotMatch(html, /Needs your decision/);
    assert.doesNotMatch(html, /End of day/);
    assert.doesNotMatch(html, /Proposed actions/);
  });

  it("renders a consequential anomaly without promoting ordinary lag", () => {
    const loop = composeCosOperatingLoop({
      jobs: [
        fixtureJob({
          jobId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          subject: "Send CAD",
          state: "resolved",
          resolvedAt: "2026-09-05T12:00:00.000Z",
          updatedAt: "2026-09-05T12:00:00.000Z",
        }),
      ],
      candidates: [
        fixtureCandidate({
          candidateId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          sourceTimestamp: "2026-09-07T12:00:00.000Z",
          candidateType: "open_job",
          proposedTarget: {
            kind: "open_job",
            projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          },
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "Can you send the CAD again",
            detail: null,
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["unread"],
            matchedText: "Can you send the CAD again",
          },
        }),
      ],
      projects: fixtureProjects(),
      nowIso: COS_LOOP_NOW,
    });
    const html = renderToStaticMarkup(createElement(ChiefOfStaffToday, { loop }));
    assert.match(html, /newer evidence disagrees/);
    assert.doesNotMatch(html, /Something seems off/);
    assert.doesNotMatch(html, /Needs your decision/);
  });

  it("renders Needs your decision and the founder Edit form without UUID fields", () => {
    const loop = composeCosOperatingLoop({
      jobs: [],
      candidates: [
        fixtureCandidate({
          candidateId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          sourceSystem: "human-intake",
          sourceRef: "he1|ffffffff-ffff-4fff-8fff-ffffffffffff",
          candidateType: "open_job",
          proposedTarget: {
            kind: "open_job",
            projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          },
          payload: {
            kind: "open_job",
            jobKind: "commitment",
            subject: "I'll send the CAD tomorrow.",
            detail: "I'll send the CAD tomorrow.",
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_founder_commitment"],
            matchedText: "I'll send the CAD tomorrow.",
          },
        }),
      ],
      projects: fixtureProjects(),
      nowIso: COS_LOOP_NOW,
      newMutationId: () => "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    });
    const html = renderToStaticMarkup(createElement(ChiefOfStaffToday, { loop }));
    assert.match(html, /Up next/i);
    assert.doesNotMatch(html, /Concierge Brief/);
    assert.doesNotMatch(html, /Add to Today/);
    assert.match(html, /send the CAD tomorrow/);
    assert.doesNotMatch(html, /Add to Top 5/);
    assert.match(html, /Dismiss/);
    assert.match(html, /Review/);
    assert.doesNotMatch(html, /Proposed actions/);
    assert.doesNotMatch(html, /caught up/);
    const editForm = readFileSync(
      join(CONCIERGE_DIR, "components", "edit-action-form.tsx"),
      "utf8",
    );
    assert.match(editForm, /type="date"/);
    assert.match(editForm, /Save/);
    assert.match(editForm, /Cancel/);
    assert.match(editForm, /min-h-12/);
    assert.doesNotMatch(editForm, /UUID|jobId field|Project ID/i);
    assert.match(editForm, /saveFounderEditAction/);
    const page = readFileSync(
      join(CONCIERGE_DIR, "action", "[jobId]", "edit", "page.tsx"),
      "utf8",
    );
    assert.match(page, /robots: \{ index: false/);
    assert.match(page, /EditActionForm/);
  });

  it("keeps Current Projects accordion as the Projects destination operating surface", () => {
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
    const projects = readFileSync(join(CONCIERGE_DIR, "projects", "page.tsx"), "utf8");
    assert.doesNotMatch(command, /OpenProjectsHome/);
    assert.match(command, /operatingLoop/);
    assert.match(command, /completeAction/);
    assert.doesNotMatch(command, /from "\.\/projects-home"/);
    assert.match(home, /completeTop5OpenJobAction/);
    assert.match(home, /loadCosOperatingLoop/);
    assert.doesNotMatch(home, /loadCurrentProjectCards/);
    assert.match(projects, /loadCurrentProjectCards/);
  });
});
