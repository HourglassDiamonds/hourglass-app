import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";
import { ChiefOfStaffToday } from "../../../app/executive-dashboard/concierge/components/chief-of-staff-today";
import { composeTodayDocket } from "../chief-of-staff/operating-loop/docket";
import { selectOpenEmailSources } from "../chief-of-staff/operating-loop/email-source";
import { COS_SPRINT_CLEAR_COPY } from "../chief-of-staff/operating-loop/master-sprint";
import {
  COS_OPERATING_LOOP_CONTRACT_VERSION,
  type CosOperatingLoopView,
} from "../chief-of-staff/operating-loop/types";
import { COS_CAUGHT_UP_HEADING } from "../chief-of-staff/operating-loop/present";
import {
  CONCIERGE_ASK_PATH,
  OPERATING_DESTINATIONS,
} from "./destinations";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONCIERGE_DIR = join(ROOT, "app", "executive-dashboard", "concierge");

function read(rel: string): string {
  return readFileSync(join(CONCIERGE_DIR, rel), "utf8");
}

function loop(extra: Partial<CosOperatingLoopView> = {}): CosOperatingLoopView {
  return {
    contractVersion: COS_OPERATING_LOOP_CONTRACT_VERSION,
    status: "caught-up",
    heading: COS_CAUGHT_UP_HEADING,
    quietDetail: "When new work is recorded, the next actions will appear here.",
    top5: [],
    remainingCount: 0,
    brief: [],
    watching: [],
    needsYourDecision: [],
    worthKnowing: [],
    recap: [],
    anomalies: [],
    proposedActions: [],
    ...extra,
  };
}

describe("Overnight founder operating regression", () => {
  it("keeps exactly five founder destinations and five mobile tabs", () => {
    const nav = read(join("components", "concierge-operating-nav.tsx"));
    assert.deepEqual(
      OPERATING_DESTINATIONS.map((row) => row.id),
      ["today", "projects", "clients", "repairs", "concierge"],
    );
    assert.match(nav, /grid grid-cols-5/);
    assert.match(nav, /data-operating-nav="mobile"/);
    assert.doesNotMatch(nav, /grid-cols-6/);
    assert.equal(CONCIERGE_ASK_PATH, "/executive-dashboard/concierge/ask");
  });

  it("keeps Today to three Up next items with overflow-safe wrapping actions", () => {
    const briefs = Array.from({ length: 4 }, (_, index) => ({
      id: `brief-${index}`,
      rank: index + 1,
      rankClass: "deadline_risk" as const,
      personLabel: `Person ${index}`,
      projectTitle: `Project ${index}`,
      projectId: `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb${index}`,
      headline: `Do action ${index}`,
      explanation: "Live client work.",
      recommended: `Do action ${index}`,
      stateLabel: null,
      urgencyLabel: null,
      actions: [],
      evidence: [],
      openJobLabel: null,
      projectStateLabel: null,
      candidateIds: [`cand-${index}`],
      proposedAction: null,
      specConflict: null,
    }));
    const docket = composeTodayDocket(loop({ status: "active", brief: briefs }));
    assert.equal(docket.items.length, 3);
    assert.equal(docket.queuedCount, 1);
    const html = renderToStaticMarkup(
      createElement(ChiefOfStaffToday, {
        loop: loop({ status: "active", brief: briefs }),
      }),
    );
    assert.match(html, /overflow-x-hidden/);
    assert.match(html, /break-words/);
    assert.match(html, /flex-wrap/);
    assert.doesNotMatch(html, /Concierge Brief|Recommended:|Top 5/);
    const actions = read(join("components", "cos-docket-actions.tsx"));
    assert.match(actions, /flex-wrap/);
  });

  it("fills unused Up next from Master Sprint without a second queue", () => {
    const docket = composeTodayDocket(
      loop({
        masterSprint: [
          {
            id: "sprint-a",
            title: "Approved sprint item A",
            action: "Advance approved sprint item A",
            why: "Canonical approved sprint item.",
          },
        ],
      }),
    );
    assert.equal(docket.items.length, 1);
    assert.equal(docket.items[0]?.lane, "master_sprint");
    assert.equal(docket.items[0]?.context, COS_SPRINT_CLEAR_COPY);
    const html = renderToStaticMarkup(
      createElement(ChiefOfStaffToday, {
        loop: loop({
          masterSprint: [
            {
              id: "sprint-a",
              title: "Approved sprint item A",
              action: "Advance approved sprint item A",
              why: "Canonical approved sprint item.",
            },
          ],
        }),
      }),
    );
    assert.match(html, /data-cos-docket-lane="master_sprint"/);
    assert.doesNotMatch(html, /Sprint dashboard/);
  });

  it("fails closed on generated Morning Brief Open Email", () => {
    const sources = selectOpenEmailSources({
      beats: [
        {
          at: "Sep 9",
          label: "Morning Brief",
          summary: "Follow up today",
          speaker: "system",
          sourceHref: "https://mail.google.com/mail/u/0/#all/1a085d41ae9efcf6/1a085d41ae9efcf6",
          candidateId: "brief-only",
          generatedSource: true,
        },
      ],
      fallbackHref: "https://mail.google.com/mail/u/0/#all/1a085d41ae9efcf6/1a085d41ae9efcf6",
    });
    assert.deepEqual(sources, []);
  });

  it("keeps Projects Clients Repairs and Concierge destination wiring", () => {
    assert.match(read(join("projects", "page.tsx")), /ProjectsOperatingHome/);
    assert.match(read(join("clients", "page.tsx")), /ClientsHome/);
    assert.match(read(join("repairs", "page.tsx")), /projectKind === "repair_service"/);
    assert.match(read(join("ask", "page.tsx")), /ConciergeAskHome/);
    assert.match(read(join("components", "concierge-ask-home.tsx")), /QuickCapture/);
    assert.doesNotMatch(read(join("clients", "page.tsx")), /from\("continuum_clients"\)/);
    assert.doesNotMatch(read(join("repairs", "page.tsx")), /continuum_repairs[^_]/);
  });
});
