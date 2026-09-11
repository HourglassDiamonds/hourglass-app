import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChiefOfStaffToday } from "../../../../app/executive-dashboard/concierge/components/chief-of-staff-today";
import {
  selectFounderControls,
  snoozeUntilForPreset,
  presentFounderEvidence,
} from "./founder-actions";
import { composeTodayDocket } from "./docket";
import { COS_LOOP_PROJECT_A } from "./fixtures";
import {
  COS_OPERATING_LOOP_CONTRACT_VERSION,
  type CosBriefItem,
  type CosOperatingLoopView,
  type CosTop5Item,
} from "./types";
import { COS_CAUGHT_UP_HEADING } from "./present";
import { currentProjectFocusHref } from "@/lib/continuum/client-memory/open-projects/present";

function brief(extra: Partial<CosBriefItem> = {}): CosBriefItem {
  return {
    id: "brief-travis",
    rank: 1,
    rankClass: "deadline_risk",
    personLabel: "Travis Morse",
    projectTitle: "Chicken ring",
    projectId: COS_LOOP_PROJECT_A,
    headline: "Confirm the finger size before this moves forward.",
    explanation: "The project says 12.5, but the latest evidence says 11.",
    recommended: "Confirm the current finger size.",
    stateLabel: null,
    urgencyLabel: null,
    actions: [
      {
        kind: "open_project",
        label: "Open project",
        href: currentProjectFocusHref(COS_LOOP_PROJECT_A),
      },
      {
        kind: "open_email",
        label: "Open email",
        href: "https://mail.google.com/mail/u/0/#all/abc123def0/aaa111bbb2",
      },
    ],
    evidence: [
      {
        at: "Sep 8",
        label: "Sep 8 · Travis",
        summary: "Size is 11",
        speaker: "client",
        sourceHref: "https://mail.google.com/mail/u/0/#all/abc123def0/aaa111bbb2",
        candidateId: "cand-1",
      },
    ],
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

function job(extra: Partial<CosTop5Item> = {}): CosTop5Item {
  return {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    sourceType: "open_job",
    action: "Call the setter",
    clientLabel: "Lee",
    projectTitle: "Lee / Spiegel",
    projectId: COS_LOOP_PROJECT_A,
    ownership: "YOUR TURN",
    timing: "No due date",
    why: "Founder action · Recorded Open Job",
    accordionHref: currentProjectFocusHref(COS_LOOP_PROJECT_A),
    jobHref: "/executive-dashboard/concierge/projects/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/jobs/cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    completable: true,
    writer: "open_job.resolve",
    mutationId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    editHref: "/executive-dashboard/concierge/action/cccccccc-cccc-4ccc-8ccc-cccccccccccc/edit",
    ...extra,
  };
}

function loop(extra: Partial<CosOperatingLoopView> = {}): CosOperatingLoopView {
  return {
    contractVersion: COS_OPERATING_LOOP_CONTRACT_VERSION,
    status: "active",
    heading: COS_CAUGHT_UP_HEADING,
    quietDetail: null,
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

describe("Today founder contextual actions", () => {
  it("selects Keep / Update / Need to verify for spec conflicts, not Travis-specific UI", () => {
    const docket = composeTodayDocket(loop({ brief: [brief()] }));
    const controls = selectFounderControls(docket.items[0]!);
    assert.equal(controls.family, "spec_conflict");
    assert.deepEqual(
      controls.actions.map((row) => row.verb),
      ["keep_canonical", "adopt_evidence", "need_to_verify"],
    );
    assert.equal(controls.actions[0]?.label, "Keep 12.5");
    assert.equal(controls.actions[1]?.label, "Update to 11");
    assert.equal(controls.fallback.length, 0);
    assert.match(controls.openProjectHref ?? "", /\?project=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/);
    assert.match(controls.openProjectHref ?? "", /#current-project-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-toggle/);
    assert.match(controls.openEmail?.href ?? "", /mail\.google\.com\/mail\/u\/0\/#all\/abc123def0/);
    assert.doesNotMatch(controls.openEmail?.href ?? "", /morning.?brief|concierge\/ask/i);

    const withoutAction = selectFounderControls(composeTodayDocket(loop({
      brief: [brief({ actions: [] })],
    })).items[0]!);
    assert.match(withoutAction.openProjectHref ?? "", /\?project=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/);
  });

  it("opens the client Gmail thread when a Morning Brief also restates the same item", () => {
    const clientHref = "https://mail.google.com/mail/u/0/#all/abc123def0/aaa111bbb2";
    const briefHref = "https://mail.google.com/mail/u/0/#all/fed098cba1/ccc222ddd3";
    const item = brief({
      canonicalGmailThreadId: "abc123def0",
      specConflict: {
        fieldName: "finger_size",
        fieldLabel: "Finger size",
        canonicalValue: "12.5",
        proposedValue: "11",
        candidateId: "cand-brief",
        canMutate: true,
      },
      actions: [
        {
          kind: "open_project",
          label: "Open project",
          href: currentProjectFocusHref(COS_LOOP_PROJECT_A),
        },
        {
          kind: "open_email",
          label: "Open email",
          href: briefHref,
        },
      ],
      evidence: [
        {
          at: "Sep 8",
          label: "Sep 8 · Travis Morse → Justin",
          summary: "Size is 11",
          speaker: "client",
          sourceHref: clientHref,
          candidateId: "cand-1",
        },
        {
          at: "Sep 9",
          label: "Sep 9 · the client → Justin",
          summary: "Hourglass Morning Brief restates finger size 11",
          speaker: "client",
          sourceHref: briefHref,
          candidateId: "cand-brief",
          generatedSource: true,
        },
      ],
    });
    const controls = selectFounderControls(composeTodayDocket(loop({ brief: [item] })).items[0]!);
    assert.equal(controls.openEmail?.href, clientHref);
    assert.deepEqual(controls.emailSources.map((row) => row.href), [clientHref]);
    assert.equal(controls.emailSources.some((row) => row.href === briefHref), false);
    const html = renderToStaticMarkup(
      createElement(ChiefOfStaffToday, { loop: loop({ brief: [item] }) }),
    );
    assert.match(html, /Open email/);
    assert.match(html, /abc123def0\/aaa111bbb2/);
    assert.match(html, /Evidence/);
  });

  it("hides Open Email when no real Gmail source can be identified", () => {
    const briefHref = "https://mail.google.com/mail/u/0/#all/fed098cba1/ccc222ddd3";
    const item = brief({
      canonicalGmailThreadId: "abc123def0",
      actions: [
        {
          kind: "open_email",
          label: "Open email",
          href: briefHref,
        },
      ],
      evidence: [
        {
          at: "Sep 9",
          label: "Sep 9 · the client → Justin",
          summary: "Generated operating brief",
          speaker: "client",
          sourceHref: briefHref,
          candidateId: "cand-brief",
          generatedSource: true,
        },
      ],
    });
    const controls = selectFounderControls(composeTodayDocket(loop({ brief: [item] })).items[0]!);
    assert.equal(controls.openEmail, null);
    assert.equal(controls.emailSources.length, 0);
    const html = renderToStaticMarkup(
      createElement(ChiefOfStaffToday, { loop: loop({ brief: [item] }) }),
    );
    assert.doesNotMatch(html, />Open email</);
    assert.match(html, /Evidence/);
  });

  it("opens the client thread when project.gmailThreadId points at generated mail", () => {
    const clientHref = "https://mail.google.com/mail/u/0/#all/abc123def0/aaa111bbb2";
    const briefHref = "https://mail.google.com/mail/u/0/#all/fed098cba1/ccc222ddd3";
    const item = brief({
      canonicalGmailThreadId: "fed098cba1",
      specConflict: {
        fieldName: "finger_size",
        fieldLabel: "Finger size",
        canonicalValue: "12.5",
        proposedValue: "11",
        candidateId: "cand-brief",
        canMutate: true,
      },
      actions: [
        {
          kind: "open_email",
          label: "Open email",
          href: briefHref,
        },
      ],
      evidence: [
        {
          at: "Sep 8",
          label: "Sep 8 · Travis Morse → Justin",
          summary: "Size is 11",
          speaker: "client",
          sourceHref: clientHref,
          candidateId: "cand-1",
        },
        {
          at: "Sep 9",
          label: "Sep 9 · the client → Justin",
          summary: "Generated operating brief restates finger size 11",
          speaker: "client",
          sourceHref: briefHref,
          candidateId: "cand-brief",
          generatedSource: true,
        },
      ],
    });
    const controls = selectFounderControls(composeTodayDocket(loop({ brief: [item] })).items[0]!);
    assert.equal(controls.openEmail?.href, clientHref);
    assert.equal(controls.emailSources.some((row) => row.href === briefHref), false);
  });

  it("does not offer Update when the spec mutation is not safely supported", () => {
    const docket = composeTodayDocket(loop({
      brief: [brief({
        specConflict: {
          fieldName: "finger_size",
          fieldLabel: "Finger size",
          canonicalValue: "12.5",
          proposedValue: "fourteen",
          candidateId: "cand-1",
          canMutate: false,
        },
      })],
    }));
    const controls = selectFounderControls(docket.items[0]!);
    assert.equal(controls.actions.some((row) => row.verb === "adopt_evidence"), false);
    assert.equal(controls.actions.some((row) => row.verb === "need_to_verify"), true);
  });

  it("uses Responded / Snooze for client-response items and Complete / Snooze / Disregard as fallback", () => {
    const reply = selectFounderControls(composeTodayDocket(loop({
      brief: [brief({
        specConflict: null,
        rankClass: "client_reply",
        explanation: "Lee replied to the latest design question.",
        recommended: "Send the recap and next step.",
        headline: "Send the recap and next step.",
      })],
    })).items[0]!);
    assert.equal(reply.family, "client_response");
    assert.deepEqual(reply.actions.map((row) => row.verb), ["responded", "snooze"]);

    const cad = selectFounderControls(composeTodayDocket(loop({
      brief: [brief({
        specConflict: null,
        explanation: "The latest CAD is waiting on your approval.",
        recommended: "Approve the CAD render.",
        headline: "Approve the CAD render.",
      })],
    })).items[0]!);
    assert.equal(cad.family, "cad_decision");
    assert.deepEqual(cad.actions.map((row) => row.verb), ["approve", "request_changes"]);

    const vendor = selectFounderControls(composeTodayDocket(loop({
      brief: [brief({
        specConflict: null,
        rankClass: "production_blocker",
        explanation: "The shop has not confirmed the work.",
        recommended: "Confirm status with the shop.",
        headline: "Confirm status with the shop.",
      })],
    })).items[0]!);
    assert.equal(vendor.family, "vendor_blocker");
    assert.deepEqual(vendor.actions.map((row) => row.verb), ["resolved", "follow_up"]);

    const openJob = selectFounderControls(composeTodayDocket(loop({
      top5: [job()],
    })).items[0]!);
    assert.equal(openJob.family, "open_job");
    assert.deepEqual(openJob.fallback.map((row) => row.verb), ["complete", "snooze", "disregard"]);
  });

  it("uses Confirm person / Snooze for unassigned replies, not Responded", () => {
    const unassignedBrief = brief({
      specConflict: null,
      personLabel: null,
      projectTitle: null,
      projectId: null,
      rankClass: "client_reply",
      headline: "Identify the client, then send the recap.",
      recommended: "Identify the client, then send the recap.",
      explanation:
        "A client replied to a design question, but this conversation isn't attached to a person yet.",
      actions: [
        {
          kind: "confirm_person",
          label: "Confirm person",
          href: "/executive-dashboard/concierge/gmail/intake?personAssociation=assoc-1",
        },
        {
          kind: "open_email",
          label: "Open email",
          href: "https://mail.google.com/mail/u/0/#all/abc123def0/aaa111bbb2",
        },
      ],
    });
    const controls = selectFounderControls(
      composeTodayDocket(loop({ brief: [unassignedBrief] })).items[0]!,
    );
    assert.equal(controls.family, "person_association");
    assert.equal(controls.confirmPerson?.candidateId, "assoc-1");
    assert.match(controls.confirmPerson?.href ?? "", /\/executive-dashboard\/concierge\/gmail\/intake/);
    assert.match(controls.confirmPerson?.href ?? "", /personAssociation=assoc-1/);
    assert.match(controls.confirmPerson?.href ?? "", /returnTo=%2Fexecutive-dashboard%2Fconcierge/);
    assert.deepEqual(controls.actions.map((row) => row.verb), ["snooze"]);
    assert.equal(controls.fallback.length, 0);

    const html = renderToStaticMarkup(
      createElement(ChiefOfStaffToday, { loop: loop({ brief: [unassignedBrief] }) }),
    );
    assert.match(html, /data-cos-founder-family="person_association"/);
    assert.match(html, /Confirm person/);
    assert.match(html, /Snooze/);
    assert.doesNotMatch(html, />Responded</);
    assert.match(html, /Open email/);
    assert.match(html, /Evidence/);
  });

  it("presents evidence without moderator or candidate-store language", () => {
    const docket = composeTodayDocket(loop({
      brief: [brief({
        evidence: [
          {
            at: "Sep 8",
            label: "approved_value=12.5",
            summary: "latest_candidate=11 source=email_gc1",
            speaker: "client",
            sourceHref: "https://mail.google.com/mail/u/0/#all/abc123def0",
            candidateId: "cand-1",
          },
        ],
      })],
    }));
    const evidence = presentFounderEvidence(docket.items[0]!);
    assert.equal(evidence?.why, "Why Continuum flagged this");
    assert.deepEqual(evidence?.facts, [
      { label: "Project record", value: "12.5" },
      { label: "Latest client evidence", value: "11" },
    ]);
    assert.match(evidence?.source ?? "", /Sep 8 email from Travis Morse/);
    const html = renderToStaticMarkup(
      createElement(ChiefOfStaffToday, { loop: loop({ brief: [brief()] }) }),
    );
    assert.match(html, /Project record: 12\.5/);
    assert.match(html, /Latest client evidence: 11/);
    assert.doesNotMatch(html, /approved_value=|latest_candidate=|candidate state|approved vs candidate/i);
  });

  it("offers Complete and Disregard for Master Sprint items without snooze or CAD verbs", () => {
    const docket = composeTodayDocket(loop({
      masterSprint: [{
        id: "sprint-a",
        title: "Approved CAD follow-up",
        action: "Advance the approved CAD follow-up",
        why: "Canonical approved sprint item.",
      }],
    }));
    const item = docket.items[0]!;
    assert.equal(item.origin, "master_sprint");
    const controls = selectFounderControls(item);
    assert.equal(controls.family, "generic");
    assert.deepEqual(
      controls.actions.map((row) => row.verb),
      ["complete"],
    );
    assert.deepEqual(
      controls.fallback.map((row) => row.verb),
      ["disregard"],
    );
    assert.equal(controls.actions.some((row) => row.needsSnooze), false);
    assert.equal(controls.fallback.some((row) => row.needsSnooze), false);
    assert.equal(controls.completableJob, false);
    const html = renderToStaticMarkup(
      createElement(ChiefOfStaffToday, {
        loop: loop({
          masterSprint: [{
            id: "sprint-a",
            title: "Approved CAD follow-up",
            action: "Advance the approved CAD follow-up",
            why: "Canonical approved sprint item.",
          }],
        }),
      }),
    );
    assert.match(html, /Complete/);
    assert.match(html, /Disregard/);
    assert.doesNotMatch(html, />Snooze</);
    assert.doesNotMatch(html, />Approve</);
    assert.doesNotMatch(html, /Request changes/);
  });

  it("encodes snooze presets on founder local calendar days", () => {
    const now = "2026-09-09T20:15:00.000Z";
    assert.equal(snoozeUntilForPreset("tomorrow", now), "2026-09-10T00:00:00.000Z");
    assert.equal(snoozeUntilForPreset("3_days", now), "2026-09-12T00:00:00.000Z");
    assert.equal(snoozeUntilForPreset("1_week", now), "2026-09-16T00:00:00.000Z");
    assert.equal(snoozeUntilForPreset("choose_date", now, "2026-09-20"), "2026-09-20T00:00:00.000Z");
    const later = snoozeUntilForPreset("later_today", now);
    assert.ok(later);
    assert.ok(Date.parse(later!) > Date.parse(now));
  });
});
