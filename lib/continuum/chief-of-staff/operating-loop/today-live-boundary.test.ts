import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import {
  classifyTodayCommunication,
  isNonActionableSystemMail,
  isPromotionalSenderInfrastructure,
  looksLikeHumanPersonName,
  type TodayGmailThreadContext,
} from "@/lib/continuum/candidates/founder-attention";
import { composeCosOperatingLoop } from "./compose";
import { composeTodayDocket } from "./docket";
import { fixtureCandidate } from "./fixtures";
import { isCurrentTodayDocketItem } from "./today-final-invariant";
import type { CosProjectContext } from "./types";

const NOW = "2026-09-18T20:00:00.000Z";
const SARAH_PROJECT = "sarah-leishman-project";
const SARAH_PERSON = "sarah-leishman-person-id";
const SARAH_THREAD = "1a0881b53067a9e6";
const SARAH_IN = "sarah-old-your-turn-in";
const SARAH_CAD = "sarah-cad-c026143";
const SARAH_OUT = "sarah-founder-out-today";
const JEN_PROJECT = "jen-spiegel-cad-project";
const JEN_PERSON = "jen-spiegel-person-id";
const JEN_THREAD = "19fc9f4c3d36dbed";
const JEN_IN = "jen-in-19fc9f4c3d36dbed";
const JEN_OUT = "jen-out-19fc9f4c3d36dbed";
const AF_THREAD = "1a0f1a2b3c4d5e6f";
const AF_MSG = "1a0f1a2b3c4d5e70";
const HUMAN_THREAD = "19aa111122223333";
const HUMAN_MSG = "19aa111122223334";
const NEW_CLIENT_THREAD = "19bb444455556666";
const NEW_CLIENT_MSG = "19bb444455556667";
const NIURKA_EMAIL = "niurka@vlorajewelry.com";
const NIURKA_HASH = hashEmail(NIURKA_EMAIL)!;
const FOUNDER_HASH = hashEmail("justin@hourglassdiamonds.com")!;

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
    knownPeople?: Parameters<typeof composeCosOperatingLoop>[0]["knownPeople"];
    vendorDirectory?: readonly string[];
  },
) {
  const loop = composeCosOperatingLoop({
    jobs: [],
    candidates,
    projects: options?.projects ?? new Map(),
    nowIso: NOW,
    threadContext: options?.threadContext,
    knownPeople: options?.knownPeople,
    vendorDirectory: options?.vendorDirectory,
  });
  return { loop, docket: composeTodayDocket(loop) };
}

function persistedYourTurn(input: {
  candidateId: string;
  threadId: string;
  messageId: string;
  timestamp: string;
  matchedText: string;
  projectId?: string;
}): ContinuumCandidate {
  return gmailRow({
    candidateId: input.candidateId,
    sourceRef: `gc1|${input.threadId}|${input.messageId}`,
    sourceTimestamp: input.timestamp,
    candidateType: "open_job",
    proposedTarget: input.projectId
      ? { kind: "open_job", projectId: input.projectId }
      : { kind: "none" },
    payload: {
      kind: "open_job",
      jobKind: "request",
      subject: "design reply",
      detail: input.matchedText,
      waitingOnActor: "founder",
      dueAt: null,
      createJob: false,
    },
    evidenceBasis: {
      ruleIds: ["explicit_cad_feedback", "explicit_client_request"],
      matchedText: input.matchedText,
    },
  });
}

describe("Today live boundary truth", () => {
  it("SARAH: persisted old yourTurn + later founder outbound is not Up next", () => {
    const { docket, loop } = todayOf(
      [
        persistedYourTurn({
          candidateId: "sarah-stale-your-turn",
          threadId: SARAH_THREAD,
          messageId: SARAH_IN,
          timestamp: "2026-09-16T16:00:00.000Z",
          matchedText: "I like the updated gallery. What do you think we should do next?",
          projectId: SARAH_PROJECT,
        }),
      ],
      {
        projects: new Map([
          [
            SARAH_PROJECT,
            {
              projectId: SARAH_PROJECT,
              title: "Leishman ring",
              personName: "Sarah Leishman",
              people: [
                { personId: SARAH_PERSON, displayName: "Sarah Leishman", role: "client" },
              ],
              isCurrent: true,
              lifecycleStage: "cad",
              gmailThreadId: SARAH_THREAD,
            },
          ],
        ]),
        threadContext: new Map([
          [
            SARAH_THREAD,
            {
              subject: "RE: HGD x Sarah CAD",
              fromDisplayName: "Niurka Lulo",
              fromEmail: NIURKA_EMAIL,
              messages: [
                {
                  messageId: SARAH_IN,
                  sentAt: "2026-09-16T16:00:00.000Z",
                  direction: "inbound",
                },
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
                  fromEmailHash: FOUNDER_HASH,
                },
              ],
            },
          ],
        ]),
        vendorDirectory: ["Vlora"],
        knownPeople: [
          {
            personId: "founder-justin",
            displayName: "Justin Smith",
            roles: ["owner"],
            organizationName: "Hourglass Diamonds",
            emailHash: FOUNDER_HASH,
          },
        ],
      },
    );
    const hay = docket.items
      .map((item) => `${item.subject} ${item.headline} ${item.context ?? ""}`)
      .join("\n");
    assert.doesNotMatch(hay, /Send the recap|Sarah replied|Responded/i);
    assert.equal(
      docket.items.some((item) => /Sarah Leishman/i.test(item.subject)),
      false,
    );
    assert.ok(
      loop.watching.length > 0 ||
        loop.brief.every((row) => /shop|CAD|waiting/i.test(`${row.recommended} ${row.headline}`)),
    );
    const recapItem = {
      origin: "brief" as const,
      headline: "Send the recap and next step.",
      context: "Sarah replied to the latest design question. I'd send the recap now, while the conversation is still live.",
      brief: loop.brief[0] ?? {
        id: "brief:project:" + SARAH_PROJECT,
        rank: 1,
        rankClass: "client_reply" as const,
        personLabel: "Sarah Leishman",
        projectTitle: "Leishman ring",
        projectId: SARAH_PROJECT,
        canonicalGmailThreadId: SARAH_THREAD,
        recoveredGmailThreadId: SARAH_THREAD,
        headline: "Your turn",
        explanation: "Sarah answered a design question. The latest meaningful turn is theirs.",
        recommended: "Send the recap / next step.",
        stateLabel: "CAD",
        urgencyLabel: null,
        actions: [],
        evidence: [],
        openJobLabel: null,
        projectStateLabel: "CAD",
        candidateIds: ["sarah-stale-your-turn"],
        proposedAction: null,
        specConflict: null,
        lifecycleStage: "cad",
      },
      job: null,
      decision: null,
      anomaly: null,
    };
    assert.equal(
      isCurrentTodayDocketItem(recapItem, {
        lifecycleByProject: loop.lifecycleByProject,
        lifecycleByGmailThread: loop.lifecycleByGmailThread,
        threadContext: loop.threadContext,
        founderEmailHashes: loop.founderEmailHashes,
      }),
      false,
    );
  });

  it("JEN: persisted old yourTurn + IN_PRODUCTION + later founder outbound is not Up next", () => {
    const { docket, loop } = todayOf(
      [
        persistedYourTurn({
          candidateId: "jen-stale-your-turn",
          threadId: JEN_THREAD,
          messageId: JEN_IN,
          timestamp: "2026-09-12T16:00:00.000Z",
          matchedText: "Could we try a rounded claw? I like the rounded prongs more than the claw.",
        }),
      ],
      {
        projects: new Map([
          [
            JEN_PROJECT,
            {
              projectId: JEN_PROJECT,
              title: "Lee / Spiegel",
              personName: "Jen Spiegel",
              people: [{ personId: JEN_PERSON, displayName: "Jen Spiegel", role: "client" }],
              isCurrent: true,
              lifecycleStage: "production",
              gmailThreadId: JEN_THREAD,
            },
          ],
        ]),
        threadContext: new Map([
          [
            JEN_THREAD,
            {
              subject: "Re: Cornflower Blue - Yogo Sapphire - Lee",
              fromDisplayName: "Jen Spiegel",
              fromEmail: "jen.spiegel@example.test",
              messages: [
                {
                  messageId: JEN_IN,
                  sentAt: "2026-09-12T16:00:00.000Z",
                  direction: "inbound",
                },
                {
                  messageId: JEN_OUT,
                  sentAt: "2026-09-14T18:30:00.000Z",
                  direction: "outbound",
                  fromEmailHash: FOUNDER_HASH,
                },
              ],
            },
          ],
        ]),
        knownPeople: [
          {
            personId: "founder-justin",
            displayName: "Justin Smith",
            roles: ["owner"],
            organizationName: "Hourglass Diamonds",
            emailHash: FOUNDER_HASH,
          },
        ],
      },
    );
    const hay = docket.items
      .map((item) => `${item.subject} ${item.headline} ${item.context ?? ""}`)
      .join("\n");
    assert.doesNotMatch(hay, /Send the recap|Jen replied|Responded/i);
    assert.equal(
      docket.items.some((item) => /Jen Spiegel/i.test(item.subject)),
      false,
    );
    assert.ok(
      loop.watching.length > 0 ||
        loop.brief.every((row) => /production|shop|waiting/i.test(`${row.recommended} ${row.headline}`)),
    );
    assert.equal(
      isCurrentTodayDocketItem(
        {
          origin: "brief",
          headline: "Send the recap and next step.",
          context: "Jen replied to the latest design question. I'd send the recap now, while the conversation is still live.",
          brief: {
            id: "brief:thread:" + JEN_THREAD,
            rank: 1,
            rankClass: "client_reply",
            personLabel: "Jen Spiegel",
            projectTitle: "Lee / Spiegel",
            projectId: null,
            canonicalGmailThreadId: JEN_THREAD,
            recoveredGmailThreadId: JEN_THREAD,
            headline: "Your turn",
            explanation: "Jen answered a design question. The latest meaningful turn is theirs.",
            recommended: "Send the recap / next step.",
            stateLabel: null,
            urgencyLabel: null,
            actions: [],
            evidence: [],
            openJobLabel: null,
            projectStateLabel: null,
            candidateIds: ["jen-stale-your-turn"],
            proposedAction: null,
            specConflict: null,
            lifecycleStage: null,
          },
          job: null,
          decision: null,
          anomaly: null,
        },
        {
          lifecycleByProject: loop.lifecycleByProject,
          lifecycleByGmailThread: loop.lifecycleByGmailThread,
          threadContext: loop.threadContext,
          founderEmailHashes: loop.founderEmailHashes,
        },
      ),
      false,
    );
  });

  it("A&F: promotional ESP + product Platinum phrase is not Confirm Person or Today", () => {
    const assoc = gmailRow({
      candidateId: "af-assoc",
      sourceRef: `gc1|${AF_THREAD}|${AF_MSG}`,
      sourceTimestamp: "2026-09-18T12:00:00.000Z",
      candidateType: "person_association",
      proposedTarget: { kind: "person", personId: null },
      payload: {
        kind: "person_association",
        displayName: "Platinum",
        emailHash: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        mintPerson: false,
        mergePersons: false,
      },
      evidenceBasis: {
        ruleIds: ["unresolved_email_hash"],
        matchedText: "Platinum",
        supportingSourceRefs: [`gc1|${AF_THREAD}|${AF_MSG}`],
      },
    });
    const blast = gmailRow({
      candidateId: "af-blast",
      sourceRef: `gc1|${AF_THREAD}|${AF_MSG}`,
      sourceTimestamp: "2026-09-18T12:00:00.000Z",
      candidateType: "open_job",
      payload: {
        kind: "open_job",
        jobKind: "request",
        subject: "1.81 Carat Emerald & Diamond Ring in Platinum",
        detail: "A&F Corp via shared1.ccsend.com",
        waitingOnActor: "founder",
        dueAt: null,
        createJob: false,
      },
      evidenceBasis: {
        ruleIds: ["explicit_follow_up"],
        matchedText: "1.81 Carat Emerald & Diamond Ring in Platinum from shared1.ccsend.com",
      },
    });
    const thread = {
      subject: "1.81 Carat Emerald & Diamond Ring in Platinum",
      fromDisplayName: "A&F Corp via Constant Contact",
      fromEmail: "bounce-mc.us11_123@shared1.ccsend.com",
      messages: [
        {
          messageId: AF_MSG,
          sentAt: "2026-09-18T12:00:00.000Z",
          direction: "inbound" as const,
          labelIds: ["INBOX", "CATEGORY_PERSONAL"],
        },
      ],
    };
    assert.equal(looksLikeHumanPersonName("Platinum"), false);
    assert.equal(
      isPromotionalSenderInfrastructure({
        fromEmail: thread.fromEmail,
        fromDisplayName: thread.fromDisplayName,
      }),
      true,
    );
    assert.equal(isNonActionableSystemMail({ candidates: [assoc, blast], thread }), true);
    assert.equal(classifyTodayCommunication({ candidates: [assoc, blast], thread }), "platform");
    const { docket, loop } = todayOf([assoc, blast], {
      threadContext: new Map([[AF_THREAD, thread]]),
    });
    assert.equal(docket.items.length, 0);
    assert.equal(loop.brief.length, 0);
    assert.equal(
      docket.items.some((item) =>
        item.brief?.actions.some((action) => action.kind === "confirm_person"),
      ),
      false,
    );
    assert.doesNotMatch(
      docket.items.map((item) => `${item.subject} ${item.headline}`).join("\n"),
      /Platinum|Identify who this is from/i,
    );
  });

  it("GENUINE UNKNOWN HUMAN: recoverable person + current obligation keeps Confirm Person", () => {
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "human-assoc",
          sourceRef: `gc1|${HUMAN_THREAD}|${HUMAN_MSG}`,
          sourceTimestamp: "2026-09-18T15:00:00.000Z",
          candidateType: "person_association",
          proposedTarget: { kind: "person", personId: null },
          payload: {
            kind: "person_association",
            displayName: null,
            emailHash: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
            mintPerson: false,
            mergePersons: false,
          },
          evidenceBasis: {
            ruleIds: ["unresolved_email_hash"],
            matchedText: null,
            supportingSourceRefs: [`gc1|${HUMAN_THREAD}|${HUMAN_MSG}`],
          },
        }),
        gmailRow({
          candidateId: "human-ask",
          sourceRef: `gc1|${HUMAN_THREAD}|${HUMAN_MSG}`,
          sourceTimestamp: "2026-09-18T15:00:00.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "Can you confirm the next step",
            detail: null,
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_client_request"],
            matchedText: "Can you confirm the next step for this design?",
            supportingSourceRefs: [`gc1|${HUMAN_THREAD}|${HUMAN_MSG}`],
          },
        }),
      ],
      {
        threadContext: new Map([
          [
            HUMAN_THREAD,
            {
              subject: "New custom ring",
              fromDisplayName: "Alex Rivera",
              fromEmail: "alex.rivera@example.test",
              messages: [
                {
                  messageId: HUMAN_MSG,
                  sentAt: "2026-09-18T15:00:00.000Z",
                  direction: "inbound",
                },
              ],
            },
          ],
        ]),
      },
    );
    assert.equal(
      docket.items.some((item) =>
        item.brief?.actions.some((action) => action.kind === "confirm_person"),
      ),
      true,
    );
  });

  it("GENUINE NEW CLIENT INBOUND: unanswered current ask stays actionable", () => {
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "nate-ask",
          sourceRef: `gc1|${NEW_CLIENT_THREAD}|${NEW_CLIENT_MSG}`,
          sourceTimestamp: "2026-09-18T17:00:00.000Z",
          candidateType: "open_job",
          proposedTarget: { kind: "none" },
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "pearl and platinum chain",
            detail: "Can you send chain video, options, and pricing?",
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_client_request"],
            matchedText: "Can you send chain video, options, and pricing?",
          },
        }),
      ],
      {
        threadContext: new Map([
          [
            NEW_CLIENT_THREAD,
            {
              subject: "Pearl chain",
              fromDisplayName: "Nate Pearl",
              fromEmail: "nate.pearl@example.test",
              messages: [
                {
                  messageId: NEW_CLIENT_MSG,
                  sentAt: "2026-09-18T17:00:00.000Z",
                  direction: "inbound",
                },
              ],
            },
          ],
        ]),
        knownPeople: [
          {
            personId: "nate-pearl-person-id",
            displayName: "Nate Pearl",
            roles: ["client"],
            organizationName: null,
            emailHash: hashEmail("nate.pearl@example.test")!,
          },
        ],
      },
    );
    assert.ok(docket.items.length > 0);
    assert.doesNotMatch(
      docket.items.map((item) => item.headline).join("\n"),
      /Identify who this is from/i,
    );
  });
});
