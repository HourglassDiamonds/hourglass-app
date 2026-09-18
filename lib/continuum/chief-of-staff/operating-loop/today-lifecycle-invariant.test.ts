import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { TodayGmailThreadContext } from "@/lib/continuum/candidates/founder-attention";
import { composeCosOperatingLoop } from "./compose";
import { composeTodayDocket } from "./docket";
import { fixtureCandidate, fixtureJob } from "./fixtures";
import type { CosProjectContext } from "./types";

const NOW = "2026-09-18T20:00:00.000Z";
const TRAVIS_PROJECT = "travis-chicken-ring-project";
const TRAVIS_PERSON = "travis-morse-person-id";
const TRAVIS_THREAD = "19ffcce49298efeb";
const TRAVIS_MSG = "1a08c4df80609947";
const TRAVIS_CANDIDATE =
  "e2f3673c23480009fc75c14eacf0ff2410794092feb9219364598cbda690af53";
const SARAH_PROJECT = "sarah-leishman-project";
const SARAH_PERSON = "sarah-leishman-person-id";
const SARAH_THREAD = "1a0881b53067a9e6";
const SARAH_CAD = "sarah-cad-c026143";
const SARAH_OUT = "sarah-founder-out-today";
const JEN_PROJECT = "jen-spiegel-cad-project";
const JEN_PERSON = "jen-spiegel-person-id";
const JEN_THREAD = "19fc9f4c3d36dbed";
const JEN_IN = "jen-in-19fc9f4c3d36dbed";
const JEN_OUT = "jen-out-19fc9f4c3d36dbed";
const NATE_THREAD = "19a854e42f90344f";
const NATE_IN = "nate-in-19a854e42f90344f";
const NATE_EMAIL = "nate.pearl@example.test";
const NATE_HASH = hashEmail(NATE_EMAIL)!;
const NATE_ID = "nate-pearl-person-id-000000000000000001";
const NIURKA_EMAIL = "niurka@vlorajewelry.com";
const NIURKA_HASH = hashEmail(NIURKA_EMAIL)!;

function gmailRow(
  extra: Partial<ContinuumCandidate> & Pick<ContinuumCandidate, "candidateId">,
): ContinuumCandidate {
  return fixtureCandidate({
    sourceSystem: "gmail",
    proposedTarget: { kind: "none" },
    ...extra,
  });
}

function todayOf(
  candidates: ContinuumCandidate[],
  options?: {
    projects?: Map<string, CosProjectContext>;
    threadContext?: Map<string, TodayGmailThreadContext>;
    jobs?: Parameters<typeof composeCosOperatingLoop>[0]["jobs"];
    vendorDirectory?: readonly string[];
    knownPeople?: Parameters<typeof composeCosOperatingLoop>[0]["knownPeople"];
  },
) {
  const loop = composeCosOperatingLoop({
    jobs: options?.jobs ?? [],
    candidates,
    projects: options?.projects ?? new Map(),
    nowIso: NOW,
    threadContext: options?.threadContext,
    vendorDirectory: options?.vendorDirectory,
    knownPeople: options?.knownPeople,
  });
  return { loop, docket: composeTodayDocket(loop) };
}

function projectOf(
  extra: CosProjectContext,
): Map<string, CosProjectContext> {
  return new Map([[extra.projectId, extra]]);
}

describe("Today lifecycle + persisted truth invariant", () => {
  it("TRAVIS: delivered project + historical finger-size conflict is not Up next", () => {
    const { docket, loop } = todayOf(
      [
        gmailRow({
          candidateId: TRAVIS_CANDIDATE,
          sourceRef: `gc1|${TRAVIS_THREAD}|${TRAVIS_MSG}`,
          sourceTimestamp: "2026-09-10T12:00:00.000Z",
          candidateType: "structured_spec",
          candidateState: "conflict",
          proposedTarget: {
            kind: "project_spec",
            projectId: TRAVIS_PROJECT,
            fieldName: "finger_size",
          },
          payload: {
            kind: "structured_spec",
            fieldName: "finger_size",
            proposedValue: "11",
            currentValue: "12.5",
            conflict: true,
            sourceProvenance: "EXACT",
          },
          evidenceBasis: {
            ruleIds: ["spec_conflict_review_required", "explicit_finger_size"],
            matchedText: "finger size 11",
          },
        }),
      ],
      {
        projects: projectOf({
          projectId: TRAVIS_PROJECT,
          title: "Chicken ring",
          personName: "Travis Morse",
          people: [
            { personId: TRAVIS_PERSON, displayName: "Travis Morse", role: "client" },
          ],
          isCurrent: false,
          lifecycleStage: "completed",
          specs: [{ fieldName: "finger_size", value: "12.5" }],
          gmailThreadId: TRAVIS_THREAD,
        }),
      },
    );
    const hay = docket.items
      .map((item) => `${item.subject} ${item.headline} ${item.context ?? ""}`)
      .join("\n");
    assert.doesNotMatch(hay, /Travis|finger size|12\.5|latest evidence says 11/i);
    assert.equal(loop.brief.length, 0);
    assert.equal(
      docket.items.some((item) => item.origin === "anomaly" || item.origin === "decision"),
      false,
    );
  });

  it("JEN: in production + historical design reply is watching, not recap", () => {
    const inboundText =
      "Could we try a rounded claw? I like the rounded prongs more than the claw.";
    const { docket, loop } = todayOf(
      [
        gmailRow({
          candidateId: "jen-design-ask",
          sourceRef: `gc1|${JEN_THREAD}|${JEN_IN}`,
          sourceTimestamp: "2026-09-15T16:00:00.000Z",
          candidateType: "open_job",
          proposedTarget: { kind: "open_job", projectId: JEN_PROJECT },
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "rounded claw version",
            detail: inboundText,
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_cad_feedback", "explicit_client_request"],
            matchedText: inboundText,
          },
        }),
      ],
      {
        projects: projectOf({
          projectId: JEN_PROJECT,
          title: "Lee / Spiegel",
          personName: "Jen Spiegel",
          people: [{ personId: JEN_PERSON, displayName: "Jen Spiegel", role: "client" }],
          isCurrent: true,
          lifecycleStage: "production",
          specs: [{ fieldName: "cad_job_number", value: "C025964" }],
          gmailThreadId: JEN_THREAD,
        }),
        threadContext: new Map([
          [
            JEN_THREAD,
            {
              subject: "Re: Cornflower Blue - Yogo Sapphire - Lee",
              fromDisplayName: "Jen Spiegel",
              fromEmail: "jen.spiegel@example.test",
              messages: [
                { messageId: JEN_IN, sentAt: "2026-09-15T16:00:00.000Z", direction: "inbound" },
                { messageId: JEN_OUT, sentAt: "2026-09-16T18:30:00.000Z", direction: "outbound" },
              ],
            },
          ],
        ]),
      },
    );
    assert.equal(
      docket.items.some((item) => /recap|Responded|CAD job/i.test(`${item.headline} ${item.context ?? ""}`)),
      false,
    );
    assert.equal(
      docket.items.some((item) => /Jen Spiegel/i.test(item.subject)),
      false,
    );
    assert.ok(
      loop.watching.length > 0 || loop.brief.every((row) => /production|shop/i.test(row.recommended)),
    );
  });

  it("SARAH: waiting on shop after later founder outbound is not recap", () => {
    const { docket, loop } = todayOf(
      [
        gmailRow({
          candidateId: "sarah-cad",
          sourceRef: `gc1|${SARAH_THREAD}|${SARAH_CAD}`,
          sourceTimestamp: "2026-09-18T14:00:00.000Z",
          candidateType: "project_context",
          proposedTarget: { kind: "project", projectId: SARAH_PROJECT },
          payload: {
            kind: "project_context",
            topic: "cad_revision",
            value: "C026143 Mod 1",
          },
          evidenceBasis: {
            ruleIds: ["exact_cad_job"],
            matchedText: "updated CAD C026143 Mod 1",
          },
        }),
        gmailRow({
          candidateId: "sarah-out",
          sourceRef: `gc1|${SARAH_THREAD}|${SARAH_OUT}`,
          sourceTimestamp: "2026-09-18T18:00:00.000Z",
          candidateType: "follow_up",
          proposedTarget: { kind: "project", projectId: SARAH_PROJECT },
          payload: {
            kind: "follow_up",
            text: "After speaking with Sarah, please revise the gallery and send the next CAD.",
            dueAt: null,
            sourceTimestamp: "2026-09-18T18:00:00.000Z",
          },
          evidenceBasis: {
            ruleIds: ["explicit_founder_commitment"],
            matchedText: "After speaking with Sarah, please revise the gallery.",
          },
        }),
      ],
      {
        projects: projectOf({
          projectId: SARAH_PROJECT,
          title: "Leishman ring",
          personName: "Sarah Leishman",
          people: [
            { personId: SARAH_PERSON, displayName: "Sarah Leishman", role: "client" },
          ],
          isCurrent: true,
          lifecycleStage: "cad",
          gmailThreadId: SARAH_THREAD,
        }),
        threadContext: new Map([
          [
            SARAH_THREAD,
            {
              subject: "RE: HGD x Sarah CAD",
              fromDisplayName: "Niurka",
              fromEmail: NIURKA_EMAIL,
              messages: [
                {
                  messageId: SARAH_CAD,
                  sentAt: "2026-09-18T14:00:00.000Z",
                  direction: "inbound",
                  fromEmailHash: NIURKA_HASH,
                },
                {
                  messageId: SARAH_OUT,
                  sentAt: "2026-09-18T18:00:00.000Z",
                  direction: "outbound",
                },
              ],
            },
          ],
        ]),
        vendorDirectory: [NIURKA_HASH],
        knownPeople: [
          {
            personId: "niurka-vendor-contact",
            displayName: "Niurka Lulo",
            roles: ["vendor-contact"],
            organizationName: "Vlora",
            emailHash: NIURKA_HASH,
          },
        ],
      },
    );
    assert.equal(
      docket.items.some((item) => /recap|Sarah Leishman/i.test(`${item.subject} ${item.headline}`)),
      false,
    );
    assert.ok(
      loop.watching.some((row) => /CAD|shop/i.test(`${row.title} ${row.detail}`)) ||
        loop.brief.every((row) => /Wait on the shop|No action/i.test(row.recommended)),
    );
  });

  it("DELIVERED + new client repair request can surface", () => {
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "repair-now",
          sourceRef: "gc1|repair-thread|repair-in",
          sourceTimestamp: "2026-09-18T16:00:00.000Z",
          candidateType: "open_job",
          proposedTarget: { kind: "open_job", projectId: TRAVIS_PROJECT },
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "repair a loose prong",
            detail: "The ring arrived but a prong is loose. Can you repair it?",
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_client_request"],
            matchedText: "The ring arrived but a prong is loose. Can you repair it?",
          },
        }),
      ],
      {
        projects: projectOf({
          projectId: TRAVIS_PROJECT,
          title: "Chicken ring",
          personName: "Travis Morse",
          people: [
            { personId: TRAVIS_PERSON, displayName: "Travis Morse", role: "client" },
          ],
          isCurrent: false,
          lifecycleStage: "completed",
          gmailThreadId: "repair-thread",
        }),
        threadContext: new Map([
          [
            "repair-thread",
            {
              subject: "Repair request",
              fromDisplayName: "Travis Morse",
              fromEmail: "travis@example.test",
              messages: [
                {
                  messageId: "repair-in",
                  sentAt: "2026-09-18T16:00:00.000Z",
                  direction: "inbound",
                },
              ],
            },
          ],
        ]),
        knownPeople: [
          {
            personId: TRAVIS_PERSON,
            displayName: "Travis Morse",
            roles: ["client"],
            emailHash: hashEmail("travis@example.test")!,
          },
        ],
      },
    );
    assert.ok(docket.items.some((item) => /repair/i.test(`${item.headline} ${item.context ?? ""}`)));
  });

  it("IN_PRODUCTION + vendor asks for founder approval can surface", () => {
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "vendor-approve",
          sourceRef: `gc1|${JEN_THREAD}|vendor-ask`,
          sourceTimestamp: "2026-09-18T15:00:00.000Z",
          candidateType: "follow_up",
          proposedTarget: { kind: "project", projectId: JEN_PROJECT },
          payload: {
            kind: "follow_up",
            text: "Can you approve the gallery thickness before we proceed?",
            dueAt: null,
            sourceTimestamp: "2026-09-18T15:00:00.000Z",
          },
          evidenceBasis: {
            ruleIds: ["explicit_production_question"],
            matchedText: "Can you approve the gallery thickness before we proceed?",
          },
        }),
      ],
      {
        projects: projectOf({
          projectId: JEN_PROJECT,
          title: "Lee / Spiegel",
          personName: "Jen Spiegel",
          people: [{ personId: JEN_PERSON, displayName: "Jen Spiegel", role: "client" }],
          isCurrent: true,
          lifecycleStage: "production",
          gmailThreadId: JEN_THREAD,
        }),
        vendorDirectory: [NIURKA_HASH],
        threadContext: new Map([
          [
            JEN_THREAD,
            {
              subject: "RE: production approval",
              fromDisplayName: "Niurka",
              fromEmail: NIURKA_EMAIL,
              messages: [
                {
                  messageId: "vendor-ask",
                  sentAt: "2026-09-18T15:00:00.000Z",
                  direction: "inbound",
                  fromEmailHash: NIURKA_HASH,
                },
              ],
            },
          ],
        ]),
      },
    );
    assert.ok(
      docket.items.some((item) =>
        /approve|approval|Respond|shop needs/i.test(`${item.headline} ${item.context ?? ""}`),
      ),
    );
  });

  it("IN_PRODUCTION + old design email cannot surface", () => {
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "old-design",
          sourceRef: `gc1|${JEN_THREAD}|${JEN_IN}`,
          sourceTimestamp: "2026-09-01T16:00:00.000Z",
          candidateType: "open_job",
          proposedTarget: { kind: "open_job", projectId: JEN_PROJECT },
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "design recap",
            detail: "I answered a design question about the claw.",
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_cad_feedback"],
            matchedText: "I like the rounded prongs. Could we try that?",
          },
        }),
      ],
      {
        projects: projectOf({
          projectId: JEN_PROJECT,
          title: "Lee / Spiegel",
          personName: "Jen Spiegel",
          people: [{ personId: JEN_PERSON, displayName: "Jen Spiegel", role: "client" }],
          isCurrent: true,
          lifecycleStage: "production",
          gmailThreadId: JEN_THREAD,
        }),
      },
    );
    assert.equal(
      docket.items.some((item) => /recap|design question|Jen Spiegel/i.test(`${item.subject} ${item.headline}`)),
      false,
    );
  });

  it("genuine unanswered inbound remains actionable", () => {
    const inbound = [
      "1. estimated cost comparison:",
      "- actual pearls",
      "- platinum beadwork",
      "2. chain options",
    ].join("\n");
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "nate-live-ask",
          sourceRef: `gc1|${NATE_THREAD}|${NATE_IN}`,
          sourceTimestamp: "2026-09-17T16:00:00.000Z",
          candidateType: "open_job",
          proposedTarget: { kind: "none" },
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "estimated cost comparison pearls vs platinum beadwork",
            detail: inbound,
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_client_request"],
            matchedText: inbound,
          },
        }),
      ],
      {
        threadContext: new Map([
          [
            NATE_THREAD,
            {
              subject: "Re: Pearl pendant",
              fromDisplayName: "Nate Pearl",
              fromEmail: NATE_EMAIL,
              messages: [
                {
                  messageId: NATE_IN,
                  sentAt: "2026-09-17T16:00:00.000Z",
                  direction: "inbound",
                  fromEmailHash: NATE_HASH,
                },
              ],
            },
          ],
        ]),
        knownPeople: [
          {
            personId: NATE_ID,
            displayName: "Nate Pearl",
            roles: ["client"],
            emailHash: NATE_HASH,
          },
        ],
      },
    );
    const card = docket.items.find((item) =>
      /Nate|pearl|chain/i.test(`${item.subject} ${item.headline} ${item.context ?? ""}`),
    );
    assert.ok(card);
    assert.doesNotMatch(card?.headline ?? "", /Send the recap/i);
  });

  it("genuine open job remains actionable if not satisfied", () => {
    const job = fixtureJob({
      jobId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      projectId: JEN_PROJECT,
      subject: "Call the setter about the gallery",
    });
    const { docket } = todayOf([], {
      jobs: [job],
      projects: projectOf({
        projectId: JEN_PROJECT,
        title: "Lee / Spiegel",
        personName: "Jen Spiegel",
        people: [{ personId: JEN_PERSON, displayName: "Jen Spiegel", role: "client" }],
        isCurrent: true,
        lifecycleStage: "production",
      }),
    });
    assert.ok(
      docket.items.some(
        (item) => item.origin === "open_job" && /setter/i.test(item.headline),
      ),
    );
  });
});
