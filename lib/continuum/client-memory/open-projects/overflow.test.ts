import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";
import { OpenProjectsHome } from "../../../../app/executive-dashboard/concierge/components/open-projects-home";
import type { CurrentProjectCard } from "./card";

const CONCIERGE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../app/executive-dashboard/concierge",
);

const EIGHT_TITLES = [
  "J.Pennock",
  "C. Binder",
  "A. Very Long Reconstructed Client Project Title That Must Wrap",
  "Hourglass custom oval",
  "Shop hold — waiting on CAD",
  "Delivery ready band",
  "Repair intake",
  "Reset and engrave",
];

function card(
  title: string,
  projectId: string,
  extra: Partial<CurrentProjectCard> = {},
): CurrentProjectCard {
  return {
    projectId,
    title,
    href: `/executive-dashboard/concierge/projects/${projectId}`,
    collapsedLine: "CAD / DESIGN",
    collapsedLineKind: "lifecycle",
    currentAction: {
      label: "CAD / DESIGN",
      detail: null,
      source: "lifecycle",
    },
    snapshot: [],
    latestFile: null,
    files: [],
    fileCount: 0,
    progress: [],
    ...extra,
  };
}

describe("Current Projects Command Center overflow", () => {
  it("does not keep a competing Projects or Open Projects operating list on Command Center", () => {
    const command = readFileSync(
      join(CONCIERGE_DIR, "components", "command-center-home.tsx"),
      "utf8",
    );
    const home = readFileSync(join(CONCIERGE_DIR, "page.tsx"), "utf8");
    const css = readFileSync(join(CONCIERGE_DIR, "concierge.css"), "utf8");
    const shell = readFileSync(
      join(CONCIERGE_DIR, "components", "concierge-shell.tsx"),
      "utf8",
    );

    assert.match(command, /OpenProjectsHome/);
    assert.match(command, /data-command-center/);
    assert.doesNotMatch(command, /from "\.\/projects-home"/);
    assert.doesNotMatch(command, /<ProjectsHome/);
    assert.doesNotMatch(command, /Current operating state is unknown/);
    assert.doesNotMatch(command, />Open Projects</);
    assert.doesNotMatch(home, /loadProjectBookPreview/);
    assert.doesNotMatch(home, /projects=\{projects\}/);
    assert.match(home, /loadCurrentProjectCards/);
    assert.match(home, /openProjects=\{openProjects\}/);
    assert.match(command, /People/);
    assert.match(command, /QuickCapture/);
    assert.match(css, /width:\s*100%/);
    assert.match(css, /min-width:\s*0/);
    assert.match(css, /overflow-x:\s*hidden/);
    assert.match(css, /minmax\(0,\s*1\.7fr\) minmax\(0,\s*0\.95fr\)/);
    assert.doesNotMatch(css, /minmax\(20rem/);
    assert.match(shell, /overflow-x-hidden/);
    assert.match(shell, /md:max-w-\[75rem\]/);
  });

  it("keeps all eight Current Projects visible without a duplicate Projects rail", () => {
    const html = renderToStaticMarkup(
      createElement(OpenProjectsHome, {
        projects: EIGHT_TITLES.map((title, index) =>
          card(title, `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa${String(index).padStart(2, "0")}`),
        ),
      }),
    );
    assert.equal([...html.matchAll(/data-current-project=/g)].length, 8);
    for (const title of EIGHT_TITLES) {
      assert.match(html, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    assert.match(html, /Current Projects/);
    assert.doesNotMatch(html, />Projects</);
    assert.doesNotMatch(html, /Open Projects/);
    assert.doesNotMatch(html, /Current operating state is unknown/);
    assert.doesNotMatch(html, /View all projects/);
    assert.doesNotMatch(html, /data-current-action/);
  });
});
