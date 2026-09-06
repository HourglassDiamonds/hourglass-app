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
import type { CurrentProjectCard } from "./card";
import {
  CURRENT_PROJECTS_OPEN_LABEL,
  currentProjectPanelId,
  currentProjectToggleId,
} from "./present";
import { conciergeProjectArtifactFilePath } from "../read/presentation";

const PROJECT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROJECT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CONCIERGE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../app/executive-dashboard/concierge",
);

function card(extra: Partial<CurrentProjectCard> = {}): CurrentProjectCard {
  return {
    projectId: PROJECT_A,
    title: "Oval ring",
    href: `/executive-dashboard/concierge/projects/${PROJECT_A}`,
    collapsedLine: "IN PRODUCTION",
    collapsedLineKind: "lifecycle",
    currentAction: {
      label: "IN PRODUCTION",
      detail: null,
      source: "lifecycle",
    },
    snapshot: [],
    latestFile: null,
    files: [],
    fileCount: 0,
    progress: [{ label: "Project created", at: "2026-08-01T00:00:00.000Z" }],
    ...extra,
  };
}

function assertNativeDisclosure(html: string, projectId: string) {
  const toggleId = currentProjectToggleId(projectId);
  const panelId = currentProjectPanelId(projectId);
  const outer = html.match(
    new RegExp(
      `<details class="group"><summary[^>]*id="${toggleId}"[\\s\\S]*?</summary>`,
    ),
  );
  assert.ok(outer, `missing native details/summary for ${projectId}`);
  assert.doesNotMatch(outer[0], / open(?:="")?/);
  assert.doesNotMatch(outer[0], /aria-expanded/);
  assert.doesNotMatch(outer[0], / name=/);
  assert.match(outer[0], new RegExp(`aria-controls="${panelId}"`));
  assert.doesNotMatch(outer[0], /<(?:a|button|input|select|textarea)\b/);
  assert.match(html, new RegExp(`id="${panelId}"`));
}

describe("Current Projects Command Center accordion UI", () => {
  it("renders zero, one, and all active Projects without a top-5 cap", () => {
    const empty = renderToStaticMarkup(createElement(OpenProjectsHome, { projects: [] }));
    assert.match(empty, /Current Projects/);
    assert.match(empty, /No current projects/);
    assert.doesNotMatch(empty, /Today 5|Chief of Staff|priority|Agent OS|kanban|Trello/i);
    assert.doesNotMatch(empty, /<table/i);

    const one = renderToStaticMarkup(
      createElement(OpenProjectsHome, { projects: [card()] }),
    );
    assert.match(one, /Oval ring/);
    assert.match(one, /IN PRODUCTION/);
    assertNativeDisclosure(one, PROJECT_A);
    assert.match(one, new RegExp(CURRENT_PROJECTS_OPEN_LABEL));
    assert.match(
      one,
      /\/executive-dashboard\/concierge\/projects\/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/,
    );

    const many = Array.from({ length: 8 }, (_, index) =>
      card({
        projectId: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${index}`,
        title: `Active ${index}`,
        href: `/executive-dashboard/concierge/projects/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${index}`,
      }),
    );
    const html = renderToStaticMarkup(
      createElement(OpenProjectsHome, { projects: many }),
    );
    assert.equal([...html.matchAll(/data-current-project=/g)].length, 8);
    for (const row of many) {
      assert.match(html, new RegExp(row.title));
      assertNativeDisclosure(html, row.projectId);
    }
  });

  it("keeps Open Job ownership distinguishable from lifecycle and does not invent Gmail requests", () => {
    const html = renderToStaticMarkup(
      createElement(OpenProjectsHome, {
        projects: [
          card({
            title: "J.Pennock",
            collapsedLine: "YOUR TURN — Confirm engraving",
            collapsedLineKind: "ownership",
            currentAction: {
              label: "YOUR TURN",
              detail: "Confirm engraving",
              source: "ownership",
            },
          }),
          card({
            projectId: PROJECT_B,
            title: "Lee / Spiegel",
            href: `/executive-dashboard/concierge/projects/${PROJECT_B}`,
            collapsedLine: "CAD / DESIGN",
            collapsedLineKind: "lifecycle",
            currentAction: {
              label: "CAD / DESIGN",
              detail: null,
              source: "lifecycle",
            },
          }),
        ],
      }),
    );
    assert.match(html, /YOUR TURN — Confirm engraving/);
    assert.match(html, /data-line-kind="ownership"/);
    assert.match(html, /data-line-kind="lifecycle"/);
    assert.match(html, /CAD \/ DESIGN/);
    assert.doesNotMatch(html, /Latest request \/ change/);
    assert.doesNotMatch(html, /Not recorded yet/);
    assert.doesNotMatch(html, /inferred from Gmail|latest email|thread body/i);
  });

  it("omits empty Progress chrome and does not reserve Latest request / change", () => {
    const html = renderToStaticMarkup(
      createElement(OpenProjectsHome, { projects: [card({ progress: [] })] }),
    );
    assert.doesNotMatch(html, />Progress</);
    assert.doesNotMatch(html, /Latest request \/ change/);
    assert.doesNotMatch(html, /Not recorded yet/);
  });

  it("renders snapshot, files, thumbnail, long names, and private artifact hrefs", () => {
    const href = conciergeProjectArtifactFilePath(PROJECT_A, PROJECT_B);
    const long =
      "K. West — wedding band with an unusually long private working title for mobile wrapping";
    const html = renderToStaticMarkup(
      createElement(OpenProjectsHome, {
        projects: [
          card({
            title: long,
            snapshot: [
              { fieldName: "cad_job_number", label: "CAD", value: "C025964" },
              { fieldName: "finger_size", label: "Finger size", value: "12.5" },
            ],
            latestFile: {
              artifactId: PROJECT_B,
              kindLabel: "CAD",
              title: "CAD on finger",
              href,
              mimeType: "image/png",
              thumbnailSrc: href,
            },
            files: [
              {
                artifactId: PROJECT_B,
                kindLabel: "CAD",
                title: "CAD on finger",
                href,
                mimeType: "image/png",
                thumbnailSrc: href,
              },
              {
                artifactId: PROJECT_A,
                kindLabel: "Document",
                title: "Order confirmation",
                href: conciergeProjectArtifactFilePath(PROJECT_A, PROJECT_A),
                mimeType: "application/pdf",
                thumbnailSrc: null,
              },
            ],
            fileCount: 2,
          }),
        ],
      }),
    );
    assert.match(html, /break-words/);
    assert.match(html, new RegExp(long.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(html, /C025964/);
    assert.match(html, /12\.5/);
    assert.doesNotMatch(html, /Supply notes|Center stone|Metal/);
    assert.match(html, /CAD on finger/);
    assert.match(html, /Order confirmation/);
    assert.match(html, /Files · 2/);
    assert.match(html, /hg-current-project-thumb/);
    assert.match(html, /block min-h-11 min-w-0 max-w-full/);
    assert.match(html, new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(html, new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(html, /supabase|storage\/v1|getPublicUrl/i);
    assert.match(html, /min-h-11/);
    assert.match(html, /min-w-0/);
    assert.match(html, /hg-current-project-status/);
    assert.doesNotMatch(html, /Latest request \/ change/);
  });

  it("keeps Command Center CoS quiet and does not reintroduce aria-expanded", () => {
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
    const home = readFileSync(join(CONCIERGE_DIR, "page.tsx"), "utf8");
    const css = readFileSync(join(CONCIERGE_DIR, "concierge.css"), "utf8");
    const work = renderToStaticMarkup(createElement(OpenProjectsHome, { projects: [card()] }));
    assert.match(cos, /Chief of Staff/);
    assert.match(cos, /Nothing in memory needs your attention yet/);
    assert.match(command, /ChiefOfStaffToday/);
    assert.match(command, /OpenProjectsHome/);
    assert.match(home, /loadCurrentProjectCards/);
    assert.doesNotMatch(command, /composeChiefOfStaffBrief|activateCoS|agent-os/);
    assert.match(work, /Current Projects/);
    assert.doesNotMatch(work, /aria-expanded/);
    assert.doesNotMatch(work, /Today 5|Chief of Staff/);
    assert.match(css, /hg-current-projects/);
    assert.match(css, /hg-current-project-toggle:focus-visible/);
    assert.match(css, /hg-current-project-status/);
    assert.match(css, /object-fit:\s*contain/);
    assert.doesNotMatch(work, /Latest request \/ change/);
  });
});
