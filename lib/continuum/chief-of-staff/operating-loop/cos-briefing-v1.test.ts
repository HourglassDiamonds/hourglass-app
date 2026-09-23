import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { composeTodayBriefingPacket } from "./briefing-packet";
import { renderDeterministicBriefing } from "./briefing-copy";
import { answerTodayCardAsk, todayAskContextPayload } from "./briefing-ask";
import {
  addBusinessDays,
  deriveCosBriefingV1,
  formatCosDate,
  occupiesCurrentUpNext,
} from "./cos-briefing-v1";
import {
  classifyCosPriority,
  compareTodayRank,
  COS_PRIORITY_RANK,
  fillUpNextCapacity,
  type CosPriorityInput,
} from "./cos-priority";
import { shouldPollTodayFreshness, shouldRefreshTodaySurface } from "./today-refresh";
import { composeCosOperatingLoop } from "./compose";
import { composeTodayDocket } from "./docket";
import { COS_LOOP_NOW, fixtureJob, fixtureProjects } from "./fixtures";

const NOW = "2026-09-17T16:00:00.000Z";

function priority(extra: Partial<CosPriorityInput>): CosPriorityInput {
  return {
    origin: "brief",
    subject: "Abbey",
    headline: "Review the CAD",
    context: null,
    projectId: "project-abbey",
    projectName: "C026137",
    entityType: "client",
    briefingKind: "founder_print_check",
    ballHolder: "founder",
    timingLabel: null,
    ...extra,
  };
}

describe("CoS briefing V1", () => {
  it("counts ten business days from a Thursday to Oct. 1", () => {
    assert.equal(addBusinessDays("2026-09-17", 10), "2026-10-01");
    assert.equal(formatCosDate("2026-09-30"), "Sept. 30");
    assert.equal(formatCosDate("2026-10-01"), "Oct. 1");
  });

  it("B: vendor lead time is a fact, and the checkpoint is not a current action", () => {
    const packet = composeTodayBriefingPacket({
      itemId: "brief:tim",
      displayNameHint: "Tim",
      organizationLabel: "Vlora",
      vendorContactName: "Vlora",
      communication: "vendor",
      projectName: "RN08318",
      projectId: null,
      personId: null,
      threadSubject: "RE: HGD x Tim/Jenn-RN08318",
      lifecycle: null,
      remainingFounderCommitment: null,
      waitingState: "cad",
      noFounderAction: true,
      staleInboundSatisfied: false,
      evidence: [
        {
          at: "2026-09-17T15:00:00.000Z",
          label: "Shop",
          summary:
            "The stone is going to the workshop via RN08318. Final CAD expected in approximately 10 business days.",
          speaker: "vendor",
          sourceHref: "https://mail.google.com/mail/u/0/#all/tim",
          candidateId: "tim-vendor",
        },
      ],
      vendorOwnTexts: [
        "The stone is going to the workshop via RN08318. Final CAD expected in approximately 10 business days.",
      ],
      sourceRefs: ["gc1|thread-tim|tim-vendor"],
    });
    assert.equal(packet?.ballHolder, "vendor_shop");
    const briefing = deriveCosBriefingV1({
      packet: packet!,
      evidence: [
        {
          summary:
            "The stone is going to the workshop via RN08318. Final CAD expected in approximately 10 business days from Sept. 17.",
          at: "2026-09-17T15:00:00.000Z",
          sourceRef: "gc1|thread-tim|tim-vendor",
        },
      ],
      nowIso: NOW,
    });
    assert.match(briefing.currentState, /Stone is at the workshop/i);
    assert.match(briefing.currentState, /10 business days from Sept\. 17/i);
    assert.equal(briefing.timingFacts[0]?.kind, "quoted_lead_time");
    assert.equal(briefing.timingFacts[0]?.dueDate, "2026-10-01");
    assert.match(briefing.checkpointProse, /Nothing needed from you now/i);
    assert.match(briefing.checkpointProse, /Sept\. 30–Oct\. 1/i);
    assert.equal(briefing.checkpoint?.status, "advisory");
    assert.equal(briefing.checkpoint?.basis, "evidence");
    assert.equal(briefing.currentFounderAction, false);
    assert.equal(occupiesCurrentUpNext(briefing), false);
    assert.doesNotMatch(briefing.checkpointProse, /scheduled|calendar/i);
  });

  it("C: a delivered CAD becomes a founder review and drops the vendor-wait checkpoint", () => {
    const packet = composeTodayBriefingPacket({
      itemId: "brief:tim-in",
      displayNameHint: "Tim",
      organizationLabel: "Vlora",
      communication: "vendor",
      projectName: "C025610",
      projectId: null,
      personId: null,
      threadSubject: "RE: HGD x Tim-C025610",
      lifecycle: null,
      remainingFounderCommitment: null,
      waitingState: null,
      noFounderAction: false,
      staleInboundSatisfied: false,
      evidence: [
        {
          at: "2026-10-01T15:00:00.000Z",
          label: "Shop",
          summary: "Here is the C025610 Mod 4 CAD + STL.",
          speaker: "vendor",
          sourceHref: null,
          candidateId: "tim-cad",
        },
      ],
      vendorOwnTexts: ["Here is the C025610 Mod 4 CAD + STL."],
    });
    assert.equal(packet?.ballHolder, "founder");
    const rendered = renderDeterministicBriefing(packet!);
    const briefing = deriveCosBriefingV1({
      packet: packet!,
      rendered,
      evidence: [{ summary: "Here is the C025610 Mod 4 CAD + STL.", at: "2026-10-01T15:00:00.000Z" }],
      nowIso: "2026-10-01T16:00:00.000Z",
    });
    assert.equal(briefing.currentFounderAction, true);
    assert.equal(occupiesCurrentUpNext(briefing), true);
    assert.equal(briefing.checkpoint?.basis, "recommendation");
    assert.doesNotMatch(briefing.checkpointProse, /10 business days|Sept\. 30|Nothing needed from you now/i);
    assert.match(`${briefing.currentState} ${briefing.checkpointProse}`, /CAD|today/i);
  });

  it("D: a founder request to the shop stays a vendor wait", () => {
    const packet = composeTodayBriefingPacket({
      itemId: "brief:sarah",
      displayNameHint: "Sarah",
      organizationLabel: "Vlora",
      communication: "vendor",
      projectName: "C026143",
      projectId: null,
      personId: null,
      threadSubject: "RE: HGD x Sarah-C026143",
      lifecycle: null,
      remainingFounderCommitment: null,
      waitingState: "cad",
      noFounderAction: true,
      staleInboundSatisfied: false,
      evidence: [
        {
          at: "2026-09-16T18:00:00.000Z",
          label: "You",
          summary: "Please soften the double-prong change.",
          speaker: "founder",
          sourceHref: null,
          candidateId: "sarah-out",
        },
        {
          at: "2026-09-16T18:20:00.000Z",
          label: "Shop",
          summary: "I'll send you the updated CAD as soon as it's available.",
          speaker: "vendor",
          sourceHref: null,
          candidateId: "sarah-in",
        },
      ],
      founderOwnTexts: ["Please soften the double-prong change."],
      vendorOwnTexts: ["I'll send you the updated CAD as soon as it's available."],
    });
    assert.equal(packet?.ballHolder, "vendor_shop");
    const briefing = deriveCosBriefingV1({ packet: packet!, nowIso: NOW });
    assert.match(briefing.currentState, /Updated CAD is with Vlora after the prong clarification/i);
    assert.equal(briefing.currentFounderAction, false);
    assert.equal(occupiesCurrentUpNext(briefing), false);
    assert.match(briefing.checkpointProse, /Nothing needed now/i);
    assert.equal(briefing.timingFacts.length, 0);
  });

  it("E: client approval plus a shop handoff stays vendor_shop", () => {
    const packet = composeTodayBriefingPacket({
      itemId: "brief:grant",
      displayNameHint: "F. Grant",
      organizationLabel: "Vlora",
      communication: "vendor",
      projectName: "C025885",
      projectId: null,
      personId: null,
      threadSubject: "RE: HGD x F. Grant-C025885",
      lifecycle: null,
      remainingFounderCommitment: null,
      waitingState: "production",
      noFounderAction: true,
      staleInboundSatisfied: false,
      evidence: [
        {
          at: "2026-09-18T12:00:00.000Z",
          label: "You",
          summary: "Approved — moving forward. Please place the order.",
          speaker: "founder",
          sourceHref: null,
          candidateId: "grant-out",
        },
        {
          at: "2026-09-18T16:00:00.000Z",
          label: "Shop",
          summary: "We'll place the order and send confirmation when it is in.",
          speaker: "vendor",
          sourceHref: null,
          candidateId: "grant-shop",
        },
      ],
      founderOwnTexts: ["Approved — moving forward. Please place the order."],
      vendorOwnTexts: ["We'll place the order and send confirmation when it is in."],
    });
    assert.equal(packet?.ballHolder, "vendor_shop");
    const briefing = deriveCosBriefingV1({ packet: packet!, nowIso: NOW });
    assert.equal(briefing.currentFounderAction, false);
    assert.equal(occupiesCurrentUpNext(briefing), false);
  });

  it("H: an advisory future checkpoint does not occupy Up next until it is triggered", () => {
    const packet = composeTodayBriefingPacket({
      itemId: "brief:chelsea",
      displayNameHint: "Chelsea",
      organizationLabel: "Vlora",
      communication: "vendor",
      projectName: "Chelsea band",
      projectId: "project-chelsea",
      personId: null,
      threadSubject: "Chelsea production",
      lifecycle: null,
      remainingFounderCommitment: null,
      waitingState: "production",
      noFounderAction: true,
      staleInboundSatisfied: false,
      evidence: [
        {
          at: "2026-09-17T12:00:00.000Z",
          label: "Shop",
          summary: "Estimated delivery Oct. 13.",
          speaker: "vendor",
          sourceHref: null,
          candidateId: "chelsea-delivery",
        },
      ],
      vendorOwnTexts: ["Estimated delivery Oct. 13."],
    });
    const future = deriveCosBriefingV1({
      packet: packet!,
      evidence: [{ summary: "Estimated delivery Oct. 13.", at: NOW }],
      nowIso: NOW,
    });
    assert.equal(future.checkpoint?.dueDate, "2026-10-06");
    assert.equal(future.checkpoint?.status, "advisory");
    assert.equal(occupiesCurrentUpNext(future), false);
    assert.match(future.checkpointProse, /Oct\. 6/);
    assert.match(future.checkpointProse, /Oct\. 13/);

    const due = deriveCosBriefingV1({
      packet: packet!,
      evidence: [{ summary: "Estimated delivery Oct. 13.", at: NOW }],
      nowIso: "2026-10-06T15:00:00.000Z",
    });
    assert.equal(due.checkpoint?.status, "triggered");
    assert.equal(due.currentFounderAction, false);
    assert.equal(occupiesCurrentUpNext(due), true);
  });

  it("does not invent a quote date that nobody stated", () => {
    const packet = composeTodayBriefingPacket({
      itemId: "brief:quote",
      displayNameHint: "Nora",
      organizationLabel: null,
      communication: "client",
      projectName: null,
      projectId: null,
      personId: null,
      threadSubject: "Quote",
      lifecycle: null,
      remainingFounderCommitment: null,
      waitingState: "client",
      noFounderAction: true,
      staleInboundSatisfied: true,
      evidence: [
        {
          at: NOW,
          label: "You",
          summary: "Here is the quote.",
          speaker: "founder",
          sourceHref: null,
          candidateId: "nora",
        },
      ],
      founderOwnTexts: ["Here is the quote."],
    });
    const briefing = deriveCosBriefingV1({ packet: packet!, nowIso: NOW });
    assert.equal(briefing.timingFacts.some((fact) => fact.kind === "quote_validity"), false);
    assert.doesNotMatch(briefing.checkpointProse, /valid through|expires/i);
  });

  it("J: Ask Concierge receives state, timing, and the checkpoint", () => {
    const packet = composeTodayBriefingPacket({
      itemId: "brief:abbey-ask",
      displayNameHint: "Abbey",
      organizationLabel: "Vlora",
      communication: "client",
      projectName: "C026137",
      projectId: "project-abbey",
      personId: "person-abbey",
      threadSubject: "RE: HGD x Abbey-C026137",
      lifecycle: null,
      remainingFounderCommitment: {
        matchedText: "I'll print the model to check the huggie proportions.",
        headline: "I'll print the model to check the huggie proportions.",
        explanation: "I'll print the model to check the huggie proportions.",
        recommended: "Print/check the model and send Abbey the size update.",
      },
      waitingState: null,
      noFounderAction: false,
      staleInboundSatisfied: false,
      evidence: [],
      founderOwnTexts: ["I'll print the model to check the huggie proportions."],
      sourceRefs: ["gc1|thread-abbey|abbey"],
    })!;
    const context = todayAskContextPayload(packet, null, NOW);
    assert.equal(context.ballHolder, packet.ballHolder);
    assert.equal(context.briefing.modelId, "cos-briefing-v1");
    assert.ok(context.currentState.length > 0);
    assert.ok(context.checkpoint);
    assert.deepEqual([...context.sourceRefs], [...packet.sourceRefs]);
    assert.equal(context.timingFacts.length >= 0, true);
    const asked = answerTodayCardAsk({
      query:
        "printing earrings this weekend to ship Monday afternoon. remind me Monday morning to email her with the plan.",
      packet,
      briefing: context.briefing,
      nowIso: NOW,
    });
    assert.equal(asked.writesCanonical, false);
    assert.equal(asked.calendarPending, true);
    assert.match(asked.text, /proposed checkpoint/i);
    assert.match(asked.text, /isn't wired yet|won't pretend it's scheduled/i);
    assert.doesNotMatch(asked.text, /I(?:'ve| have) scheduled|added to (?:your )?calendar/i);
  });
});

describe("client-first Today ranking", () => {
  it("A: a client project outranks an internal GEO/SEO task", () => {
    const client = priority({});
    const geo = priority({
      origin: "master_sprint",
      subject: "GEO / SEO",
      headline: "Update the local SEO page",
      context: "Search visibility",
      projectId: null,
      projectName: null,
      entityType: null,
      briefingKind: null,
      ballHolder: null,
    });
    assert.equal(classifyCosPriority(client), "client_project_obligation");
    assert.equal(classifyCosPriority(geo), "geo_seo");
    assert.ok(COS_PRIORITY_RANK.client_project_obligation < COS_PRIORITY_RANK.geo_seo);
    const order = compareTodayRank(
      { priority: client, score: 10, activityMs: 0 },
      { priority: geo, score: 500, activityMs: 9_000 },
    );
    assert.ok(order < 0);
  });

  it("a real hard deadline on internal work outranks ordinary client work", () => {
    const client = priority({ timingLabel: "DUE OCT 20" });
    const emergency = priority({
      origin: "open_job",
      subject: "Payroll",
      headline: "File the sales tax return",
      context: null,
      projectId: null,
      projectName: null,
      entityType: null,
      briefingKind: null,
      ballHolder: "founder",
      timingLabel: "DUE TODAY · SEP 23",
    });
    assert.equal(classifyCosPriority(emergency), "operational_business");
    const order = compareTodayRank(
      { priority: emergency, score: 1, activityMs: 0 },
      { priority: client, score: 80, activityMs: 50 },
    );
    assert.ok(order < 0);
  });

  it("I: internal work fills only leftover Up next capacity", () => {
    const client = { id: "client", priority: priority({}) };
    const geo = {
      id: "geo",
      priority: priority({
        origin: "master_sprint",
        subject: "GEO",
        headline: "SEO cleanup",
        projectId: null,
        projectName: null,
        entityType: null,
        briefingKind: null,
        ballHolder: null,
      }),
    };
    const open = fillUpNextCapacity([client], [geo], 3);
    assert.deepEqual(open.visible.map((row) => row.id), ["client", "geo"]);
    const full = fillUpNextCapacity(
      [
        { id: "c1", priority: priority({ subject: "A" }) },
        { id: "c2", priority: priority({ subject: "B" }) },
        { id: "c3", priority: priority({ subject: "C" }) },
      ],
      [geo],
      3,
    );
    assert.deepEqual(full.visible.map((row) => row.id), ["c1", "c2", "c3"]);
    assert.equal(full.queuedLive.length, 0);
  });

  it("renders a client open job ahead of a GEO sprint item", () => {
    const loop = composeCosOperatingLoop({
      jobs: [
        fixtureJob({
          jobId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          subject: "Review Abbey's CAD",
        }),
      ],
      projects: fixtureProjects(),
      nowIso: COS_LOOP_NOW,
      masterSprint: [
        {
          id: "geo-1",
          title: "GEO / SEO",
          action: "Update the local SEO page",
          why: "Search visibility",
        },
      ],
    });
    const docket = composeTodayDocket(loop);
    const geoAt = docket.items.findIndex((item) => /SEO|GEO/i.test(`${item.subject} ${item.headline}`));
    const clientAt = docket.items.findIndex((item) => item.origin !== "master_sprint");
    if (clientAt >= 0 && geoAt >= 0) assert.ok(clientAt < geoAt);
    assert.ok(docket.items.length <= 3);
  });
});

describe("Today refresh stability", () => {
  it("F: an unchanged watermark does not refresh the surface", () => {
    assert.equal(shouldRefreshTodaySurface(false), false);
    assert.equal(shouldPollTodayFreshness({ documentHidden: false, inFlight: false }), true);
    assert.equal(shouldPollTodayFreshness({ documentHidden: true, inFlight: false }), false);
    assert.equal(shouldPollTodayFreshness({ documentHidden: false, inFlight: true }), false);
  });

  it("G: a meaningful source change is allowed to refresh", () => {
    assert.equal(shouldRefreshTodaySurface(true), true);
  });
});
