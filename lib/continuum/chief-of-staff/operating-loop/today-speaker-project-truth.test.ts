import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import { GMAIL_SOURCE_SYSTEM } from "@/lib/continuum/client-memory/gmail/types";
import type { GmailIndexedMessage } from "@/lib/continuum/client-memory/gmail/types";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { TodayGmailThreadContext } from "@/lib/continuum/candidates/founder-attention";
import { proposeGmailCandidates } from "@/lib/continuum/gmail/candidates/propose";
import { extractOpenJobs } from "@/lib/continuum/gmail/candidates/parse";
import { splitOwnAndQuotedText } from "@/lib/continuum/gmail/candidates/spec-provenance";
import type {
  GmailCandidateEvidence,
  GmailCandidateWorld,
} from "@/lib/continuum/gmail/candidates/types";
import { composeCosOperatingLoop } from "./compose";
import { composeTodayDocket } from "./docket";
import { fixtureCandidate } from "./fixtures";
import { reconcileThreadTruthState } from "./thread-truth";
import { selectFounderControls } from "./founder-actions";
import type { CosProjectContext } from "./types";

const NOW = "2026-09-19T16:00:00.000Z";
const FOUNDER_HASH = hashEmail("justin@hourglassdiamonds.com")!;
const SARAH_THREAD = "1a0881b53067a9e6";
const SARAH_PROJECT = "sarah-leishman-project";
const JEN_PROJECT = "da1cb824-lee-spiegel";
const JEN_PERSON = "jen-spiegel-person";
const JEN_NAMED = "19fc9f4c3d36dbed";
const JEN_SIBLING_SHOP = "1a0b18dcd27676a1";
const JEN_SIBLING_CAD = "1a0a777131b641f1";
const LISA_THREAD = "1a0b6af75e1daa3c";
const HUMAN_THREAD = "19aa111122223333";
const NEW_CLIENT_THREAD = "19bb444455556666";

function world(): GmailCandidateWorld {
  return {
    people: [],
    projects: [],
    internalEmailHashes: [FOUNDER_HASH],
  };
}

function indexed(input: {
  messageId: string;
  threadId: string;
  sentAt: string;
  direction: GmailIndexedMessage["direction"];
  subject?: string;
  fromEmail?: string;
}): GmailIndexedMessage {
  return {
    messageId: input.messageId,
    threadId: input.threadId,
    sentAt: input.sentAt,
    indexedAt: NOW,
    subject: input.subject ?? null,
    fromEmailHash: hashEmail(input.fromEmail ?? null),
    toEmailHashes: [],
    ccEmailHashes: [],
    bccEmailHashes: [],
    direction: input.direction,
    labelIds: input.direction === "outbound" ? ["SENT"] : ["INBOX"],
    hasAttachments: false,
    sourceSystem: GMAIL_SOURCE_SYSTEM,
  };
}

function evidence(
  input: Parameters<typeof indexed>[0] & { plaintext?: string },
): GmailCandidateEvidence {
  const row = indexed(input);
  return {
    indexed: row,
    plaintext: input.plaintext ?? null,
    fromEmailHash: row.fromEmailHash,
    attachments: [],
  };
}

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
  },
) {
  const loop = composeCosOperatingLoop({
    jobs: options?.jobs ?? [],
    candidates,
    projects: options?.projects ?? new Map(),
    nowIso: NOW,
    threadContext: options?.threadContext,
    knownPeople: [
      {
        personId: "founder-justin",
        displayName: "Justin Smith",
        roles: ["owner"],
        organizationName: "Hourglass Diamonds",
        emailHash: FOUNDER_HASH,
      },
    ],
  });
  return { loop, docket: composeTodayDocket(loop) };
}

function docketHay(docket: ReturnType<typeof composeTodayDocket>): string {
  return docket.items
    .map((item) => `${item.subject} ${item.headline} ${item.context ?? ""}`)
    .join("\n");
}

function jenProject(lifecycleStage: string | null = "cad"): CosProjectContext {
  return {
    projectId: JEN_PROJECT,
    title: "Lee / Spiegel",
    personName: "Jen Spiegel",
    people: [{ personId: JEN_PERSON, displayName: "Jen Spiegel", role: "client" }],
    isCurrent: true,
    lifecycleStage,
    specs: [{ fieldName: "cad_job_number", value: "C025964" }],
    gmailThreadId: null,
  };
}

describe("Today speaker authorship + cross-thread project truth", () => {
  it("A: inbound I'll send is an external commitment, never a founder action", () => {
    const hits = extractOpenJobs(
      "I'll send the drawings tomorrow.",
      "inbound",
      "client",
    );
    assert.equal(
      hits.some((row) => row.ruleIds.includes("explicit_founder_commitment")),
      false,
    );
    assert.ok(hits.some((row) => row.ruleIds.includes("explicit_external_commitment")));
    assert.equal(
      hits.every((row) => row.waitingOnActor !== "founder"),
      true,
    );
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: world(),
      evidence: [
        evidence({
          messageId: "in-drawings",
          threadId: "t-drawings",
          sentAt: "2026-09-18T12:00:00.000Z",
          direction: "inbound",
          fromEmail: "vendor@shop.test",
          plaintext: "I'll send the drawings tomorrow.",
        }),
      ],
    });
    const jobs = proposed.candidates.filter((row) => row.candidateType === "open_job");
    assert.equal(
      jobs.some((row) => row.evidenceBasis.ruleIds.includes("explicit_founder_commitment")),
      false,
    );
    assert.ok(
      jobs.some((row) => row.evidenceBasis.ruleIds.includes("explicit_external_commitment")),
    );
  });

  it("B: founder reply quoting inbound I'll send still creates no founder commitment", () => {
    const plaintext = [
      "Thanks.",
      "",
      "On Fri, the shop wrote:",
      "I'll send the drawings tomorrow.",
    ].join("\n");
    const split = splitOwnAndQuotedText(plaintext);
    assert.match(split.own, /Thanks/);
    assert.match(split.quoted, /I'll send the drawings tomorrow/);
    const hits = extractOpenJobs(split.own, "outbound", "founder");
    assert.equal(
      hits.some((row) => row.ruleIds.includes("explicit_founder_commitment")),
      false,
    );
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: world(),
      evidence: [
        evidence({
          messageId: "out-thanks",
          threadId: "t-drawings",
          sentAt: "2026-09-18T13:00:00.000Z",
          direction: "outbound",
          fromEmail: "justin@hourglassdiamonds.com",
          plaintext,
        }),
      ],
    });
    assert.equal(
      proposed.candidates.some(
        (row) =>
          row.candidateType === "open_job" &&
          row.evidenceBasis.ruleIds.includes("explicit_founder_commitment"),
      ),
      false,
    );
  });

  it("C: founder OWN I'll send pricing is a founder commitment", () => {
    const hits = extractOpenJobs(
      "I'll send pricing tomorrow.",
      "outbound",
      "founder",
    );
    assert.ok(hits.some((row) => row.ruleIds.includes("explicit_founder_commitment")));
    assert.equal(
      hits.every((row) => row.waitingOnActor === "founder"),
      true,
    );
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: world(),
      evidence: [
        evidence({
          messageId: "out-pricing",
          threadId: "t-pricing",
          sentAt: "2026-09-18T14:00:00.000Z",
          direction: "outbound",
          fromEmail: "justin@hourglassdiamonds.com",
          plaintext: "I'll send pricing tomorrow.",
        }),
      ],
    });
    assert.ok(
      proposed.candidates.some(
        (row) =>
          row.candidateType === "open_job" &&
          row.evidenceBasis.ruleIds.includes("explicit_founder_commitment"),
      ),
    );
  });

  it("D: founder OWN decline after an unsolicited offer closes the beat with no Today action", () => {
    const inboundText = "I'll send the free signup link.";
    const outboundText = [
      "No thank you.",
      "",
      "On Fri, Lisa wrote:",
      inboundText,
    ].join("\n");
    const { docket, loop } = todayOf(
      [
        gmailRow({
          candidateId: "lisa-inbound",
          sourceRef: `gc1|${LISA_THREAD}|lisa-in`,
          sourceTimestamp: "2026-09-18T22:42:23.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "commitment",
            subject: inboundText,
            detail: inboundText,
            waitingOnActor: "client",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_external_commitment"],
            matchedText: inboundText,
          },
        }),
        gmailRow({
          candidateId: "lisa-outbound",
          sourceRef: `gc1|${LISA_THREAD}|lisa-out`,
          sourceTimestamp: "2026-09-19T11:40:01.000Z",
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "client_approval",
            value: "No thank you.",
          },
          evidenceBasis: {
            ruleIds: ["gmail_participant"],
            matchedText: outboundText,
          },
        }),
      ],
      {
        threadContext: new Map([
          [
            LISA_THREAD,
            {
              subject: "INVENTORY PLANNING FOR HOURGLASS DIAMONDS",
              fromDisplayName: "Lisa",
              fromEmail: "lisa@vendor.test",
              messages: [
                {
                  messageId: "lisa-in",
                  sentAt: "2026-09-18T22:42:23.000Z",
                  direction: "inbound",
                },
                {
                  messageId: "lisa-out",
                  sentAt: "2026-09-19T11:40:01.000Z",
                  direction: "outbound",
                  fromEmailHash: FOUNDER_HASH,
                },
              ],
            },
          ],
        ]),
      },
    );
    const truth = reconcileThreadTruthState({
      rows: [
        gmailRow({
          candidateId: "lisa-inbound",
          sourceRef: `gc1|${LISA_THREAD}|lisa-in`,
          sourceTimestamp: "2026-09-18T22:42:23.000Z",
          evidenceBasis: {
            ruleIds: ["explicit_external_commitment"],
            matchedText: inboundText,
          },
        }),
        gmailRow({
          candidateId: "lisa-outbound",
          sourceRef: `gc1|${LISA_THREAD}|lisa-out`,
          sourceTimestamp: "2026-09-19T11:40:01.000Z",
          evidenceBasis: {
            ruleIds: ["gmail_participant"],
            matchedText: outboundText,
          },
        }),
      ],
      thread: {
        messages: [
          {
            messageId: "lisa-in",
            sentAt: "2026-09-18T22:42:23.000Z",
            direction: "inbound",
          },
          {
            messageId: "lisa-out",
            sentAt: "2026-09-19T11:40:01.000Z",
            direction: "outbound",
            fromEmailHash: FOUNDER_HASH,
          },
        ],
      },
    });
    assert.equal(truth.remainingCommitment, null);
    assert.equal(truth.declinedCurrentBeat, true);
    assert.equal(docket.items.length, 0);
    assert.equal(loop.brief.length, 0);
    assert.doesNotMatch(docketHay(docket), /signup link|You already replied/i);
  });

  it("E: Sarah production-shaped indexed chronology suppresses a persisted yourTurn recap", () => {
    const { docket, loop } = todayOf(
      [
        gmailRow({
          candidateId: "sarah-stale-your-turn",
          sourceRef: `gc1|${SARAH_THREAD}|sarah-in`,
          sourceTimestamp: "2026-09-18T14:46:03.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "design reply",
            detail: "I like the updated gallery. What do you think we should do next?",
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_cad_feedback", "explicit_client_request"],
            matchedText: "I like the updated gallery. What do you think we should do next?",
          },
        }),
      ],
      {
        threadContext: new Map([
          [
            SARAH_THREAD,
            {
              subject: "RE: HGD x Sarah CAD",
              fromDisplayName: "Sarah Leishman",
              fromEmail: "sarah@example.test",
              messages: [
                {
                  messageId: "sarah-in",
                  sentAt: "2026-09-18T14:46:03.000Z",
                  direction: "inbound",
                },
                {
                  messageId: "sarah-out",
                  sentAt: "2026-09-18T18:26:23.000Z",
                  direction: "outbound",
                  fromEmailHash: FOUNDER_HASH,
                },
              ],
            },
          ],
        ]),
      },
    );
    assert.doesNotMatch(docketHay(docket), /Send the recap|Responded/i);
    assert.equal(
      docket.items.some((item) => /Sarah/i.test(item.subject)),
      false,
    );
    assert.equal(
      loop.brief.some((row) => /Send the recap/i.test(`${row.headline} ${row.recommended}`)),
      false,
    );
  });

  it("F: Jen exact C025964 association + newer outbound suppresses historical design recap without inventing production", () => {
    const { docket, loop } = todayOf(
      [
        gmailRow({
          candidateId: "jen-stale-design",
          sourceRef: `gc1|${JEN_NAMED}|jen-in`,
          sourceTimestamp: "2026-09-11T11:20:09.000Z",
          candidateType: "open_job",
          proposedTarget: { kind: "open_job", projectId: JEN_PROJECT },
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "design reply",
            detail: "Could we try a rounded claw?",
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_cad_feedback", "explicit_client_request"],
            matchedText: "Could we try a rounded claw?",
          },
        }),
      ],
      {
        projects: new Map([[JEN_PROJECT, jenProject("cad")]]),
        threadContext: new Map([
          [
            JEN_NAMED,
            {
              subject: "Re: Cornflower Blue - Yogo Sapphire - Lee C025964",
              fromDisplayName: "Jen Spiegel",
              fromEmail: "jen.spiegel@example.test",
              messages: [
                {
                  messageId: "jen-in",
                  sentAt: "2026-09-11T11:20:09.000Z",
                  direction: "inbound",
                },
                {
                  messageId: "jen-out",
                  sentAt: "2026-09-14T21:00:17.000Z",
                  direction: "outbound",
                  fromEmailHash: FOUNDER_HASH,
                },
              ],
            },
          ],
          [
            JEN_SIBLING_SHOP,
            {
              subject: "RE: HGD x Tim/Jenn-C025964-RN08318",
              fromDisplayName: "Vlora",
              fromEmail: "vlora@vendor.test",
              messages: [
                {
                  messageId: "jen-shop-in",
                  sentAt: "2026-09-17T22:47:16.000Z",
                  direction: "inbound",
                },
              ],
            },
          ],
          [
            JEN_SIBLING_CAD,
            {
              subject: "CAD C025964",
              fromDisplayName: "Tim Lee",
              fromEmail: "timlee591@gmail.com",
              messages: [
                {
                  messageId: "jen-cad-out",
                  sentAt: "2026-09-16T23:33:34.000Z",
                  direction: "outbound",
                  fromEmailHash: FOUNDER_HASH,
                },
              ],
            },
          ],
        ]),
      },
    );
    assert.doesNotMatch(docketHay(docket), /Send the recap|Responded/i);
    assert.equal(loop.lifecycleByProject?.get(JEN_PROJECT), "cad");
    assert.equal(
      [...(loop.associatedGmailThreadsByProject?.get(JEN_PROJECT) ?? [])].sort().join(","),
      [JEN_NAMED, JEN_SIBLING_CAD, JEN_SIBLING_SHOP].sort().join(","),
    );
  });

  it("G: sibling thread with a genuine new founder-owned obligation may surface", () => {
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "jen-new-own",
          sourceRef: `gc1|${JEN_SIBLING_CAD}|jen-new-out`,
          sourceTimestamp: "2026-09-16T23:33:34.000Z",
          candidateType: "open_job",
          proposedTarget: { kind: "open_job", projectId: JEN_PROJECT },
          payload: {
            kind: "open_job",
            jobKind: "commitment",
            subject: "I'll send the production photos tomorrow.",
            detail: "I'll send the production photos tomorrow.",
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_founder_commitment"],
            matchedText: "I'll send the production photos tomorrow.",
          },
        }),
        gmailRow({
          candidateId: "jen-new-in",
          sourceRef: `gc1|${JEN_SIBLING_CAD}|jen-new-in`,
          sourceTimestamp: "2026-09-16T22:00:00.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "Can you send the production photos",
            detail: "Can you send the production photos when you have them?",
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_client_request"],
            matchedText: "Can you send the production photos when you have them?",
          },
        }),
      ],
      {
        projects: new Map([[JEN_PROJECT, jenProject("cad")]]),
        threadContext: new Map([
          [
            JEN_SIBLING_CAD,
            {
              subject: "CAD C025964",
              fromDisplayName: "Jen Spiegel",
              fromEmail: "jen.spiegel@example.test",
              messages: [
                {
                  messageId: "jen-new-in",
                  sentAt: "2026-09-16T22:00:00.000Z",
                  direction: "inbound",
                },
                {
                  messageId: "jen-new-out",
                  sentAt: "2026-09-16T23:33:34.000Z",
                  direction: "outbound",
                  fromEmailHash: FOUNDER_HASH,
                },
              ],
            },
          ],
        ]),
      },
    );
    assert.ok(
      docket.items.some((item) =>
        /production photos|I'll send/i.test(
          `${item.subject} ${item.headline} ${item.context ?? ""} ${item.brief?.recommended ?? ""}`,
        ),
      ),
    );
  });

  it("H: historical sibling thread alone cannot resurrect a stale design action", () => {
    const { docket, loop } = todayOf(
      [
        gmailRow({
          candidateId: "jen-historical-sibling",
          sourceRef: `gc1|${JEN_NAMED}|jen-old-in`,
          sourceTimestamp: "2026-09-11T11:20:09.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "design reply",
            detail: "Could we try a rounded claw?",
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_cad_feedback", "explicit_client_request"],
            matchedText: "Could we try a rounded claw?",
          },
        }),
      ],
      {
        projects: new Map([[JEN_PROJECT, jenProject("cad")]]),
        threadContext: new Map([
          [
            JEN_NAMED,
            {
              subject: "Re: Cornflower Blue C025964",
              fromDisplayName: "Jen Spiegel",
              fromEmail: "jen.spiegel@example.test",
              messages: [
                {
                  messageId: "jen-old-in",
                  sentAt: "2026-09-11T11:20:09.000Z",
                  direction: "inbound",
                },
              ],
            },
          ],
          [
            JEN_SIBLING_CAD,
            {
              subject: "CAD C025964",
              fromDisplayName: "Tim Lee",
              fromEmail: "timlee591@gmail.com",
              messages: [
                {
                  messageId: "jen-later-out",
                  sentAt: "2026-09-14T21:00:17.000Z",
                  direction: "outbound",
                  fromEmailHash: FOUNDER_HASH,
                },
              ],
            },
          ],
        ]),
      },
    );
    assert.doesNotMatch(docketHay(docket), /Send the recap|Responded/i);
    assert.equal(
      loop.brief.some((row) => /Send the recap/i.test(`${row.headline} ${row.recommended}`)),
      false,
    );
  });

  it("I: genuine unknown human with unresolved inbound still allows Confirm Person", () => {
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "human-assoc",
          sourceRef: `gc1|${HUMAN_THREAD}|human-msg`,
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
            supportingSourceRefs: [`gc1|${HUMAN_THREAD}|human-msg`],
          },
        }),
        gmailRow({
          candidateId: "human-ask",
          sourceRef: `gc1|${HUMAN_THREAD}|human-msg`,
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
            supportingSourceRefs: [`gc1|${HUMAN_THREAD}|human-msg`],
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
                  messageId: "human-msg",
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
        /Alex|custom ring|next step/i.test(`${item.subject} ${item.headline}`),
      ),
      true,
    );
    assert.equal(
      docket.items.some((item) =>
        item.brief?.actions.some((action) => action.kind === "confirm_person"),
      ),
      false,
    );
  });

  it("J: genuine new client inbound remains actionable", () => {
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "nate-ask",
          sourceRef: `gc1|${NEW_CLIENT_THREAD}|nate-msg`,
          sourceTimestamp: "2026-09-18T17:00:00.000Z",
          candidateType: "open_job",
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
                  messageId: "nate-msg",
                  sentAt: "2026-09-18T17:00:00.000Z",
                  direction: "inbound",
                },
              ],
            },
          ],
        ]),
      },
    );
    assert.ok(docket.items.length > 0);
    assert.doesNotMatch(docketHay(docket), /No thank you/i);
  });

  it("D2: persisted match-only I'll send on SENT is not a founder-owned Inventory card", () => {
    const inboundText = "I'll send the free signup link.";
    const { docket, loop } = todayOf(
      [
        gmailRow({
          candidateId: "lisa-match-only",
          sourceRef: `gc1|${LISA_THREAD}|lisa-out`,
          sourceTimestamp: "2026-09-19T11:40:01.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "commitment",
            subject: inboundText,
            detail: inboundText,
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_founder_commitment"],
            matchedText: inboundText,
          },
        }),
      ],
      {
        threadContext: new Map([
          [
            LISA_THREAD,
            {
              subject: "INVENTORY PLANNING FOR HOURGLASS DIAMONDS",
              fromDisplayName: "Lisa",
              fromEmail: "lisa@vendor.test",
              messages: [
                {
                  messageId: "lisa-in",
                  sentAt: "2026-09-18T22:42:23.000Z",
                  direction: "inbound",
                },
                {
                  messageId: "lisa-out",
                  sentAt: "2026-09-19T11:40:01.000Z",
                  direction: "outbound",
                  fromEmailHash: FOUNDER_HASH,
                },
              ],
            },
          ],
        ]),
      },
    );
    const truth = reconcileThreadTruthState({
      rows: [
        gmailRow({
          candidateId: "lisa-match-only",
          sourceRef: `gc1|${LISA_THREAD}|lisa-out`,
          sourceTimestamp: "2026-09-19T11:40:01.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "commitment",
            subject: inboundText,
            detail: inboundText,
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_founder_commitment"],
            matchedText: inboundText,
          },
        }),
      ],
      thread: {
        messages: [
          {
            messageId: "lisa-in",
            sentAt: "2026-09-18T22:42:23.000Z",
            direction: "inbound",
          },
          {
            messageId: "lisa-out",
            sentAt: "2026-09-19T11:40:01.000Z",
            direction: "outbound",
            fromEmailHash: FOUNDER_HASH,
          },
        ],
      },
    });
    assert.equal(truth.remainingCommitment, null);
    assert.equal(docket.items.length, 0);
    assert.equal(loop.brief.length, 0);
    assert.doesNotMatch(docketHay(docket), /signup link|You already replied|INVENTORY/i);
  });

  it("K: quoted C021479-RN07247 does not bind to current Abbey C026137 or Confirm Person", () => {
    const niurkaHash = hashEmail("niurka@vlorajewelry.com")!;
    const abbeyThread = "1a08760c6837bb32";
    const abbeyProject = "abbey-earrings-c026137";
    const engagementProject = "abbey-engagement-c021479";
    const quoted = [
      "On Tue, founder wrote:",
      "Previously we made engagement (C021479-RN07247) for her.",
      "She'd like to copy the leaf style prong from her engagement.",
    ].join("\n");
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: {
        people: [],
        projects: [
          {
            projectId: abbeyProject,
            title: "Abbey earrings",
            gmailThreadId: abbeyThread,
            cadJobNumber: "C026137",
            orderNumber: null,
            fingerSize: null,
            metal: null,
            centerStone: null,
            diamondSupplyNotes: null,
            personIds: [],
            founderApprovedCurrent: true,
          },
          {
            projectId: engagementProject,
            title: "Abbey engagement",
            gmailThreadId: null,
            cadJobNumber: "C021479",
            orderNumber: null,
            fingerSize: null,
            metal: null,
            centerStone: null,
            diamondSupplyNotes: null,
            personIds: [],
            founderApprovedCurrent: true,
          },
        ],
        internalEmailHashes: [FOUNDER_HASH],
      },
      evidence: [
        evidence({
          messageId: "niurka-stl",
          threadId: abbeyThread,
          sentAt: "2026-09-17T15:00:00.000Z",
          direction: "inbound",
          fromEmail: "niurka@vlorajewelry.com",
          subject: "RE: HGD x Abbey-C026137",
          plaintext: [
            "Here is the C026137 Mod 1 STL.",
            "",
            quoted,
          ].join("\n"),
        }),
      ],
    });
    assert.equal(
      proposed.candidates.some(
        (row) =>
          row.candidateType === "project_context" &&
          row.payload.kind === "project_context" &&
          row.payload.topic === "workshop_job_id" &&
          row.payload.value === "RN07247" &&
          row.proposedTarget.kind === "project" &&
          row.proposedTarget.projectId === abbeyProject,
      ),
      false,
    );
    assert.ok(
      proposed.candidates.some(
        (row) =>
          row.candidateType === "project_context" &&
          row.payload.kind === "project_context" &&
          row.payload.topic === "historical_workshop_job_id" &&
          row.payload.value === "RN07247" &&
          row.proposedTarget.kind === "none",
      ),
    );
    assert.ok(
      proposed.candidates.some(
        (row) =>
          row.candidateType === "project_context" &&
          row.payload.kind === "project_context" &&
          row.payload.topic === "historical_cad_job_number" &&
          row.payload.value === "C021479" &&
          row.proposedTarget.kind === "none",
      ),
    );
    const { docket, loop } = todayOf(
      [
        gmailRow({
          candidateId: "niurka-assoc",
          sourceRef: `gc1|${abbeyThread}|niurka-stl`,
          sourceTimestamp: "2026-09-17T15:00:00.000Z",
          candidateType: "person_association",
          proposedTarget: { kind: "person", personId: null },
          payload: {
            kind: "person_association",
            displayName: "Niurka Lulo",
            emailHash: niurkaHash,
            mintPerson: false,
            mergePersons: false,
          },
          evidenceBasis: {
            ruleIds: ["gmail_participant"],
            matchedText: "Niurka Lulo",
          },
        }),
        gmailRow({
          candidateId: "niurka-rn-quoted",
          sourceRef: `gc1|${abbeyThread}|niurka-stl`,
          sourceTimestamp: "2026-09-17T15:00:00.000Z",
          candidateType: "project_context",
          proposedTarget: { kind: "project", projectId: abbeyProject },
          payload: {
            kind: "project_context",
            topic: "workshop_job_id",
            value: "RN07247",
          },
          evidenceBasis: {
            ruleIds: ["exact_workshopJobId"],
            matchedText: "RN07247",
          },
        }),
        gmailRow({
          candidateId: "niurka-stl",
          sourceRef: `gc1|${abbeyThread}|niurka-stl`,
          sourceTimestamp: "2026-09-17T15:00:00.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "commitment",
            subject: "Here is the C026137 Mod 1 STL",
            detail: null,
            waitingOnActor: "vendor",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_vendor_commitment"],
            matchedText: "Here is the C026137 Mod 1 STL.",
          },
        }),
      ],
      {
        projects: new Map([
          [
            abbeyProject,
            {
              projectId: abbeyProject,
              title: "Abbey earrings",
              personName: "Abbey",
              people: [],
              isCurrent: true,
              lifecycleStage: "cad",
              specs: [{ fieldName: "cad_job_number", value: "C026137" }],
              gmailThreadId: abbeyThread,
            },
          ],
          [
            engagementProject,
            {
              projectId: engagementProject,
              title: "Abbey engagement",
              personName: "Abbey",
              people: [],
              isCurrent: true,
              lifecycleStage: "complete",
              specs: [{ fieldName: "cad_job_number", value: "C021479" }],
              gmailThreadId: null,
            },
          ],
        ]),
        threadContext: new Map([
          [
            abbeyThread,
            {
              subject: "RE: HGD x Abbey-C026137",
              fromDisplayName: "Niurka Lulo",
              fromEmail: "niurka@vlorajewelry.com",
              messages: [
                {
                  messageId: "founder-ask",
                  sentAt: "2026-09-16T18:00:00.000Z",
                  direction: "outbound",
                  fromEmailHash: FOUNDER_HASH,
                },
                {
                  messageId: "niurka-stl",
                  sentAt: "2026-09-17T15:00:00.000Z",
                  direction: "inbound",
                  fromEmailHash: niurkaHash,
                },
                {
                  messageId: "founder-abbey",
                  sentAt: "2026-09-17T18:00:00.000Z",
                  direction: "outbound",
                  fromEmailHash: FOUNDER_HASH,
                },
              ],
            },
          ],
        ]),
      },
    );
    assert.equal(
      docket.items.some((item) => selectFounderControls(item).confirmPerson != null),
      false,
    );
    assert.equal(
      loop.brief.some((row) => row.actions.some((action) => action.kind === "confirm_person")),
      false,
    );
    assert.doesNotMatch(docketHay(docket), /Identify who this is from|Unassigned/i);
    assert.doesNotMatch(docketHay(docket), /RN07247/);
    const abbeyCard = docket.items.find((item) => /Abbey/i.test(item.subject));
    if (abbeyCard) {
      assert.doesNotMatch(`${abbeyCard.headline} ${abbeyCard.context ?? ""}`, /RN07247/);
    }
  });
});
