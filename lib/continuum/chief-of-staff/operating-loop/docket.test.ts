import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChiefOfStaffToday } from "../../../../app/executive-dashboard/concierge/components/chief-of-staff-today";
import {
  composeTodayDocket,
  COS_DOCKET_TITLE,
  COS_DOCKET_VISIBLE_LIMIT,
  cosQueuedLabel,
  cosWatchingCountLabel,
  docketSubject,
  masterSprintDocketItems,
} from "./docket";
import { composeCosOperatingLoop } from "./compose";
import {
  COS_CAUGHT_UP_HEADING,
  COS_BRIEF_TITLE,
} from "./present";
import {
  COS_LOOP_NOW,
  COS_LOOP_PROJECT_A,
  fixtureJob,
  fixtureProjects,
  fixtureCandidate,
} from "./fixtures";
import {
  COS_OPERATING_LOOP_CONTRACT_VERSION,
  type CosBriefItem,
  type CosMasterSprintItem,
  type CosOperatingLoopView,
  type CosTop5Item,
} from "./types";
import { COS_SPRINT_CLEAR_COPY } from "./master-sprint";

function briefItem(extra: Partial<CosBriefItem> = {}): CosBriefItem {
  return {
    id: "brief-travis",
    rank: 1,
    rankClass: "deadline_risk",
    personLabel: "Travis Morse",
    projectTitle: "Chicken ring",
    projectId: COS_LOOP_PROJECT_A,
    headline: "Finger size still disagrees",
    explanation: "Finger size differs: approved 12.5 vs latest evidence 11. Older spec notes were superseded.",
    recommended: "Confirm the current finger size.",
    stateLabel: null,
    urgencyLabel: null,
    actions: [],
    evidence: [],
    openJobLabel: null,
    projectStateLabel: null,
    candidateIds: ["cand-1"],
    proposedAction: null,
    specConflict: {
      fieldName: "finger_size",
      fieldLabel: "Finger size",
      canonicalValue: "12.5",
      proposedValue: "11",
      candidateId: "cand-1",
      canMutate: true,
    },
    ...extra,
  };
}

function jobItem(extra: Partial<CosTop5Item> = {}): CosTop5Item {
  return {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    sourceType: "open_job",
    action: "Call the setter",
    clientLabel: "Lee",
    projectTitle: "Lee / Spiegel",
    projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    ownership: "YOUR TURN",
    timing: "No due date",
    why: "Founder action · Recorded Open Job",
    accordionHref: "/executive-dashboard/concierge/projects#toggle",
    jobHref: "/executive-dashboard/concierge/projects/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/jobs/cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    completable: true,
    writer: "open_job.resolve",
    mutationId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    editHref: "/executive-dashboard/concierge/action/cccccccc-cccc-4ccc-8ccc-cccccccccccc/edit",
    ...extra,
  };
}

function sprintSeed(id: string, title: string): CosMasterSprintItem {
  return {
    id,
    title,
    action: `Advance ${title}`,
    why: `${title} remains on the approved sprint.`,
  };
}

function loopOf(extra: Partial<CosOperatingLoopView> = {}): CosOperatingLoopView {
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

describe("Today Chief of Staff docket", () => {
  it("uses Person / Project as the subject line", () => {
    assert.equal(docketSubject("Travis Morse", "Chicken ring"), "Travis Morse / Chicken ring");
    assert.equal(docketSubject("Travis Morse", "Chicken ring (his) / Travis"), "Travis Morse");
    assert.equal(docketSubject("Lee", "Lee / Spiegel"), "Lee");
    assert.equal(docketSubject(null, "Matching earrings"), "Matching earrings");
  });

  it("keeps Master Sprint on the same grammar with an empty Phase 1A slot", () => {
    const items = masterSprintDocketItems(loopOf());
    assert.deepEqual(items, []);
    const docket = composeTodayDocket(loopOf({
      brief: [briefItem()],
      remainingCount: 2,
    }));
    assert.equal(docket.items.every((item) => item.lane === "live_work"), true);
    assert.equal(docket.queuedCount, 0);
    assert.equal(cosQueuedLabel(2), "+2 queued");
    assert.equal(cosWatchingCountLabel(3), "Watching · 3");
  });

  it("does not treat Brief-only work as caught up", () => {
    const docket = composeTodayDocket(loopOf({
      status: "caught-up",
      heading: COS_CAUGHT_UP_HEADING,
      brief: [briefItem()],
    }));
    assert.equal(docket.showCaughtUp, false);
    assert.equal(docket.items.length, 1);
    assert.equal(docket.items[0]?.headline, "Confirm the finger size before this moves forward.");
    assert.equal(docket.items[0]?.subject, "Travis Morse / Chicken ring");
    assert.equal(
      docket.items[0]?.context,
      "The project says 12.5, but the latest evidence says 11. I'd verify the current finger size before production.",
    );
    assert.equal(docket.title, COS_DOCKET_TITLE);
  });

  it("briefs unassigned replies as an identity-first next action", () => {
    const docket = composeTodayDocket(loopOf({
      brief: [briefItem({
        id: "brief-unassigned",
        personLabel: null,
        projectTitle: null,
        recommended: "Send the recap / next step.",
        explanation: "The client answered a design question. The latest meaningful turn is theirs.",
      })],
    }));
    assert.equal(docket.items[0]?.subject, "Unassigned");
    assert.equal(docket.items[0]?.headline, "Identify the client, then send the recap.");
    assert.match(
      docket.items[0]?.context ?? "",
      /isn't attached to a person yet/i,
    );
  });

  it("dedupes a Top 5 job already covered by a Brief item", () => {
    const docket = composeTodayDocket(loopOf({
      status: "active",
      brief: [briefItem()],
      top5: [jobItem({ projectId: COS_LOOP_PROJECT_A })],
    }));
    assert.equal(docket.items.length, 1);
    assert.equal(docket.items[0]?.origin, "brief");
  });

  it("renders one numbered queue without Concierge Brief, Top 5, or Recommended", () => {
    const html = renderToStaticMarkup(
      createElement(ChiefOfStaffToday, {
        loop: loopOf({
          status: "active",
          brief: [briefItem({
            actions: [
              { kind: "add_to_top5", label: "Add to Top 5", href: "/executive-dashboard/concierge/action/new?project=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
              { kind: "open_email", label: "Open email", href: "https://mail.google.com/mail/u/0/#all/abc123def0" },
            ],
          })],
          top5: [jobItem()],
          remainingCount: 4,
          watching: [{ id: "w1", title: "Handled", detail: "Shop has it", projectId: null }],
        }),
      }),
    );
    assert.match(html, /Up next/i);
    assert.match(html, /1 · Travis Morse \/ Chicken ring/i);
    assert.match(html, /Confirm the finger size before this moves forward/);
    assert.match(html, /The project says 12\.5, but the latest evidence says 11/);
    assert.doesNotMatch(html, /differs: approved|meaningful turn|superseded/i);
    assert.doesNotMatch(html, /Review evidence/);
    assert.match(html, /Keep 12\.5/);
    assert.match(html, /Update to 11/);
    assert.match(html, /Need to verify/);
    assert.match(html, /<div[^>]*data-cos-founder-family="spec_conflict"/);
    assert.match(html, /2 · Lee/);
    assert.doesNotMatch(html, /\+\d+ queued/);
    assert.match(html, /Watching · 1/);
    assert.doesNotMatch(html, /Add to Today/);
    assert.doesNotMatch(html, /Concierge Brief/);
    assert.doesNotMatch(html, /Recommended:/);
    assert.doesNotMatch(html, /Earlier attention view/);
    assert.doesNotMatch(html, /Needs your decision/);
    assert.doesNotMatch(html, /caught up/);
  });

  it("shows caught up only when the live-work queue and Master Sprint slot are empty", () => {
    const html = renderToStaticMarkup(
      createElement(ChiefOfStaffToday, { loop: loopOf() }),
    );
    assert.match(html, /caught up/);
    assert.doesNotMatch(html, /Up next/i);
    const withBrief = renderToStaticMarkup(
      createElement(ChiefOfStaffToday, {
        loop: loopOf({ brief: [briefItem()] }),
      }),
    );
    assert.doesNotMatch(withBrief, /caught up/);
    assert.match(withBrief, /Up next/i);
    const withJobs = composeTodayDocket(loopOf({
      status: "active",
      top5: [jobItem(), jobItem({ id: "job-2", action: "Send CAD" })],
    }));
    assert.equal(withJobs.items.length, 2);
  });

  it("renders at most three Up next items and keeps the rest as +N queued", () => {
    const briefs = Array.from({ length: 5 }, (_, index) =>
      briefItem({
        id: `brief-${index}`,
        rank: index + 1,
        personLabel: `Person ${index}`,
        projectTitle: `Project ${index}`,
        projectId: `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb${index}`,
        recommended: `Do action ${index}`,
        candidateIds: [`cand-${index}`],
      }),
    );
    const docket = composeTodayDocket(loopOf({
      status: "active",
      brief: briefs,
      remainingCount: 3,
    }));
    assert.equal(COS_DOCKET_VISIBLE_LIMIT, 3);
    assert.equal(docket.items.length, 3);
    assert.equal(docket.queuedCount, 2);
    const html = renderToStaticMarkup(
      createElement(ChiefOfStaffToday, {
        loop: loopOf({
          status: "active",
          brief: briefs,
          remainingCount: 3,
          watching: [{ id: "w1", title: "Handled", detail: "Shop has it", projectId: null }],
        }),
      }),
    );
    assert.match(html, /1 · Person 0/);
    assert.match(html, /3 · Person 2/);
    assert.doesNotMatch(html, /4 · Person 3/);
    assert.match(html, /\+2 queued/);
    assert.doesNotMatch(html, /\+5 queued/);
    assert.match(html, /Watching · 1/);
    const queuedAt = html.indexOf("+2 queued");
    const watchingAt = html.indexOf("Watching · 1");
    assert.ok(queuedAt >= 0 && watchingAt > queuedAt);
  });

  it("does not count Top 5 remainingCount as founder-facing queued work", () => {
    const docket = composeTodayDocket(loopOf({
      status: "active",
      brief: [briefItem()],
      remainingCount: 5,
    }));
    assert.equal(docket.items.length, 1);
    assert.equal(docket.queuedCount, 0);
  });

  it("counts +N from docket overflow only, including after one visible item is resolved", () => {
    const briefs = Array.from({ length: 5 }, (_, index) =>
      briefItem({
        id: `brief-${index}`,
        rank: index + 1,
        personLabel: `Person ${index}`,
        projectTitle: `Project ${index}`,
        projectId: `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb${index}`,
        candidateIds: [`cand-${index}`],
      }),
    );
    const before = composeTodayDocket(loopOf({ status: "active", brief: briefs, remainingCount: 5 }));
    assert.equal(before.queuedCount, 2);
    const after = composeTodayDocket(loopOf({
      status: "active",
      brief: briefs.slice(1),
      remainingCount: 5,
    }));
    assert.equal(after.items.length, 3);
    assert.equal(after.queuedCount, 1);
  });

  it("keeps compose ranking untouched while still surfacing Brief in the docket", () => {
    const view = composeCosOperatingLoop({
      jobs: [],
      candidates: [
        fixtureCandidate({
          candidateId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        }),
      ],
      projects: fixtureProjects(),
      nowIso: COS_LOOP_NOW,
    });
    assert.equal(view.status, "caught-up");
    assert.equal(COS_BRIEF_TITLE, "Concierge Brief");
    const docket = composeTodayDocket(view);
    if (view.brief.length > 0) {
      assert.equal(docket.showCaughtUp, false);
      assert.ok(docket.items.length > 0);
    }
    const jobs = [
      fixtureJob({
        jobId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        subject: "Send CAD",
      }),
    ];
    const active = composeCosOperatingLoop({
      jobs,
      projects: fixtureProjects(),
      nowIso: COS_LOOP_NOW,
    });
    assert.equal(active.status, "active");
    assert.equal(active.top5.length, 1);
    const activeDocket = composeTodayDocket(active);
    assert.equal(activeDocket.showCaughtUp, false);
    assert.ok(activeDocket.items.some((item) => item.origin === "open_job" || item.origin === "brief"));
  });

  it("fills unused Up next slots from approved Master Sprint items", () => {
    const sprint = [
      sprintSeed("sprint-a", "Approved sprint item A"),
      sprintSeed("sprint-b", "Approved sprint item B"),
      sprintSeed("sprint-c", "Approved sprint item C"),
      sprintSeed("sprint-d", "Approved sprint item D"),
    ];
    const emptyLive = composeTodayDocket(loopOf({ masterSprint: sprint }));
    assert.equal(emptyLive.showCaughtUp, false);
    assert.equal(emptyLive.items.length, 3);
    assert.equal(emptyLive.queuedCount, 0);
    assert.equal(emptyLive.items.every((item) => item.lane === "master_sprint"), true);
    assert.equal(emptyLive.items[0]?.id, "sprint-a");
    assert.equal(emptyLive.items[0]?.context, COS_SPRINT_CLEAR_COPY);
    assert.doesNotMatch(emptyLive.items.map((item) => item.id).join(","), /sprint-d/);

    const oneLive = composeTodayDocket(loopOf({
      status: "active",
      brief: [briefItem()],
      masterSprint: sprint,
    }));
    assert.equal(oneLive.items.length, 3);
    assert.equal(oneLive.items[0]?.lane, "live_work");
    assert.equal(oneLive.items[1]?.lane, "master_sprint");
    assert.equal(oneLive.items[2]?.lane, "master_sprint");
    assert.equal(oneLive.queuedCount, 0);
    assert.equal(oneLive.items[1]?.context, "Approved sprint item A remains on the approved sprint.");

    const fullLive = composeTodayDocket(loopOf({
      status: "active",
      brief: [
        briefItem({ id: "brief-1" }),
        briefItem({ id: "brief-2", personLabel: "Lee", projectTitle: "Lee ring" }),
        briefItem({ id: "brief-3", personLabel: "Sam", projectTitle: "Sam ring" }),
      ],
      masterSprint: sprint,
    }));
    assert.equal(fullLive.items.length, 3);
    assert.equal(fullLive.items.every((item) => item.lane === "live_work"), true);
    assert.equal(fullLive.queuedCount, 0);

    const afterOneLiveClears = composeTodayDocket(loopOf({
      status: "active",
      brief: [
        briefItem({ id: "brief-2", personLabel: "Lee", projectTitle: "Lee ring" }),
        briefItem({ id: "brief-3", personLabel: "Sam", projectTitle: "Sam ring" }),
      ],
      masterSprint: sprint,
    }));
    assert.equal(afterOneLiveClears.items.length, 3);
    assert.equal(afterOneLiveClears.items.filter((item) => item.lane === "live_work").length, 2);
    assert.equal(afterOneLiveClears.items[2]?.id, "sprint-a");
    assert.equal(afterOneLiveClears.items[2]?.lane, "master_sprint");

    const overflowLive = composeTodayDocket(loopOf({
      status: "active",
      brief: Array.from({ length: 5 }, (_, index) =>
        briefItem({
          id: `brief-${index}`,
          rank: index + 1,
          personLabel: `Person ${index}`,
          projectTitle: `Project ${index}`,
        }),
      ),
      masterSprint: sprint,
    }));
    assert.equal(overflowLive.items.length, 3);
    assert.equal(overflowLive.queuedCount, 2);
    assert.equal(overflowLive.items.every((item) => item.lane === "live_work"), true);

    const html = renderToStaticMarkup(
      createElement(ChiefOfStaffToday, {
        loop: loopOf({ masterSprint: sprint }),
      }),
    );
    assert.match(html, /data-cos-docket-lane="master_sprint"/);
    assert.match(html, /Client work is clear\. Continuing with the sprint\./);
    assert.match(html, /Complete/);
    assert.doesNotMatch(html, /Sprint dashboard|Master Sprint/);
    assert.doesNotMatch(html, /caught up/);
  });

  it("passes approved Master Sprint items through compose without inventing work", () => {
    const view = composeCosOperatingLoop({
      jobs: [],
      nowIso: COS_LOOP_NOW,
      masterSprint: [sprintSeed("sprint-a", "Approved sprint item A")],
    });
    assert.equal(view.status, "caught-up");
    assert.equal(view.masterSprint?.length, 1);
    const docket = composeTodayDocket(view);
    assert.equal(docket.items[0]?.origin, "master_sprint");
    const empty = composeCosOperatingLoop({
      jobs: [],
      nowIso: COS_LOOP_NOW,
    });
    assert.deepEqual(empty.masterSprint, []);
    assert.equal(composeTodayDocket(empty).showCaughtUp, true);
  });
});
