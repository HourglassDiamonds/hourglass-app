import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";
import { CommandCenterHome } from "../../../app/executive-dashboard/concierge/components/command-center-home";
import { ProjectsOperatingHome } from "../../../app/executive-dashboard/concierge/components/projects-operating-home";
import { RepairsHome } from "../../../app/executive-dashboard/concierge/components/repairs-home";
import { composeContinuumHome } from "../dashboard/compose";
import { composeCosOperatingLoop } from "../chief-of-staff/operating-loop/compose";
import { CURRENT_PROJECT_OPERATING_GROUP_LABELS } from "../client-memory/open-projects/operating-groups";
import type { CurrentProjectCard } from "../client-memory/open-projects/card";
import {
  CONCIERGE_ASK_PATH,
  OPERATING_DESTINATIONS,
} from "./destinations";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONCIERGE_DIR = join(ROOT, "app", "executive-dashboard", "concierge");

function read(rel: string): string {
  return readFileSync(join(CONCIERGE_DIR, rel), "utf8");
}

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

describe("Founder Operating UX V1 shell", () => {
  it("makes ConciergeShell a five-destination operating chrome", () => {
    const shell = read(join("components", "concierge-shell.tsx"));
    const nav = read(join("components", "concierge-operating-nav.tsx"));
    const css = read("concierge.css");
    const layout = read("layout.tsx");
    assert.match(layout, /ContinuumEnvBadge/);
    assert.match(css, /hg-continuum-env-badge/);
    assert.match(shell, /ConciergeOperatingNav/);
    assert.match(shell, /data-operating-shell/);
    assert.match(shell, /pb-\[calc\(5\.75rem\+env\(safe-area-inset-bottom\)\)\]/);
    assert.match(nav, /data-operating-nav="desktop"/);
    assert.match(nav, /data-operating-nav="mobile"/);
    assert.match(nav, /OPERATING_DESTINATIONS/);
    assert.match(nav, /OPERATING_TOOL_LINKS/);
    assert.match(nav, /hidden/);
    assert.match(nav, /md:block/);
    assert.match(nav, /md:hidden/);
    assert.match(nav, /grid grid-cols-5/);
    assert.doesNotMatch(nav, /grid-cols-6|grid-cols-4/);
    assert.doesNotMatch(nav, /hamburger|sidebar|drawer/i);
    assert.equal(OPERATING_DESTINATIONS.length, 5);
    assert.match(css, /--font-continuum-sans/);
    assert.match(css, /--font-continuum-serif/);
    assert.doesNotMatch(css, /minmax\(0,\s*1\.7fr\) minmax\(0,\s*0\.95fr\)/);
  });

  it("keeps Today as the Chief-of-Staff surface only", () => {
    const home = read("page.tsx");
    const command = read(join("components", "command-center-home.tsx"));
    const model = composeContinuumHome({
      now: new Date("2026-08-24T18:00:00.000Z"),
    });
    const loop = composeCosOperatingLoop({
      jobs: [],
      nowIso: "2026-08-24T18:00:00.000Z",
    });
    const html = renderToStaticMarkup(
      createElement(CommandCenterHome, { model, operatingLoop: loop }),
    );
    assert.match(home, /loadContinuumHomeModel/);
    assert.match(home, /loadCosOperatingLoop/);
    assert.doesNotMatch(home, /loadCurrentProjectCards/);
    assert.doesNotMatch(home, /loadProjectBookPreview/);
    assert.match(command, /ChiefOfStaffToday/);
    assert.doesNotMatch(command, /OpenProjectsHome/);
    assert.doesNotMatch(command, /AskConciergeShell/);
    assert.doesNotMatch(command, /QuickCapture/);
    assert.doesNotMatch(command, /ConciergeSearch/);
    assert.doesNotMatch(command, /CONCIERGE_GMAIL_PATH/);
    assert.match(html, /Good afternoon, Justin/);
    assert.match(html, /caught up/);
    assert.doesNotMatch(html, /Concierge Brief|Recommended:|Top 5/);
    assert.doesNotMatch(html, /Current Projects|Ask Concierge|Quick Capture|People/);
    assert.doesNotMatch(html, /Chief of Staff/);
  });

  it("makes Projects the OpenProjectsHome operating board with Active and Past", () => {
    const page = read(join("projects", "page.tsx"));
    const html = renderToStaticMarkup(
      createElement(ProjectsOperatingHome, {
        active: [card()],
        past: [],
        view: "active",
      }),
    );
    const past = renderToStaticMarkup(
      createElement(ProjectsOperatingHome, {
        active: [],
        past: [],
        view: "past",
      }),
    );
    assert.match(page, /ProjectsOperatingHome/);
    assert.match(page, /loadCurrentProjectCards/);
    assert.match(page, /selectOpenProjectWork/);
    assert.doesNotMatch(page, /ProjectBookView/);
    assert.match(html, />Projects</);
    assert.match(html, /Active/);
    assert.match(html, /Past/);
    assert.match(html, /Lee \/ Spiegel/);
    assert.match(html, /YOUR TURN/);
    assert.match(html, new RegExp(CURRENT_PROJECT_OPERATING_GROUP_LABELS.your_turn));
    assert.match(past, /Past work is not searchable yet/);
  });

  it("creates Clients as a Person directory over searchPeople", () => {
    const page = read(join("clients", "page.tsx"));
    const home = read(join("components", "clients-home.tsx"));
    const search = read(join("components", "concierge-search.tsx"));
    assert.match(page, /ClientsHome/);
    assert.match(page, /loadOpenProjectWork/);
    assert.doesNotMatch(page, /create table|from\("continuum_clients"\)/);
    assert.match(search, /searchPeople|searchConciergeClients/);
    assert.match(home, /Clients/);
    assert.match(home, /ConciergeSearch/);
    assert.match(home, /autoFocus/);
    assert.match(home, /conciergeClientPath/);
    assert.match(home, /Add client/);
  });

  it("creates Repairs as a view over repair_service Projects", () => {
    const page = read(join("repairs", "page.tsx"));
    const html = renderToStaticMarkup(
      createElement(RepairsHome, {
        current: [card()],
        issued: [],
        other: [],
        quotesConnected: true,
      }),
    );
    assert.match(page, /projectKind === "repair_service"/);
    assert.match(page, /getAuthenticatedRepairQuoteReader/);
    assert.match(page, /OpenProjectsHome|composeCurrentProjectCards/);
    assert.doesNotMatch(page, /create table|continuum_repairs[^_]/);
    assert.match(html, />Repairs</);
    assert.match(html, /Current repairs/);
    assert.match(html, /Issued quotes/);
    assert.match(html, /Repair quotes|New repair quote/);
    assert.match(
      html,
      /\/executive-dashboard\/concierge\/projects\/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\/repair/,
    );
  });

  it("moves Ask Concierge and Quick Capture to /ask without inventing conversation", () => {
    const page = read(join("ask", "page.tsx"));
    const home = read(join("components", "concierge-ask-home.tsx"));
    const ask = read(join("components", "ask-concierge-shell.tsx"));
    assert.match(page, /ConciergeAskHome/);
    assert.match(home, /Concierge/);
    assert.match(home, /AskConciergeShell/);
    assert.match(home, /QuickCapture/);
    assert.match(home, /ASK_UNSUPPORTED_DETAIL/);
    assert.match(ask, /Who has a birthday in November/);
    assert.doesNotMatch(ask, /Ask anything about your relationships/);
    assert.equal(CONCIERGE_ASK_PATH, "/executive-dashboard/concierge/ask");
  });
});
