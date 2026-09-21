import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { TodayGmailThreadContext } from "@/lib/continuum/candidates/founder-attention";
import { composeTodayBriefingPacket } from "./briefing-packet";
import { composeCosOperatingLoop } from "./compose";
import { composeTodayDocket } from "./docket";
import { fixtureCandidate } from "./fixtures";
import {
  dedupeTodaySeeds,
  todayGroupKeysFor,
  type TodayDocketSeed,
} from "./today-docket-boundary";
import type { CosProjectContext } from "./types";

const NOW = "2026-09-21T14:00:00.000Z";
const PERSON = "person-riley-chen";
const PROJECT_ENGAGEMENT = "project-engagement";
const PROJECT_EARRINGS = "project-repair";
const CAD_ENGAGEMENT = "C031001";
const CAD_EARRINGS = "C031002";
const THREAD_ENGAGEMENT = "1a031001aaaa";
const THREAD_EARRINGS = "1a031002bbbb";
const THREAD_SHARED = "1a0abcabcabc01";
const GMAIL = "https://mail.google.com/mail/u/0/#all";
const NIURKA_EMAIL = "niurka@vlorajewelry.com";
const NIURKA_HASH = hashEmail(NIURKA_EMAIL)!;
const FOUNDER_HASH = hashEmail("justin@hourglassdiamonds.com")!;
const REMAINING = {
  matchedText: "I'll send the chain options and pricing today.",
  headline: "I'll send the chain options and pricing today.",
  explanation: "I'll send the chain options and pricing today.",
  recommended: "I'll send the chain options and pricing today.",
};

function packet(input: {
  itemId: string;
  displayName: string;
  projectId?: string | null;
  personId?: string | null;
  threadSubject?: string | null;
  organizationLabel?: string | null;
  vendorContactName?: string | null;
  sourceRefs?: readonly string[];
  remaining?: boolean;
}) {
  return composeTodayBriefingPacket({
    itemId: input.itemId,
    displayNameHint: input.displayName,
    organizationLabel: input.organizationLabel ?? null,
    vendorContactName: input.vendorContactName,
    communication: input.organizationLabel ? "vendor" : null,
    projectName: input.threadSubject ?? input.displayName,
    projectId: input.projectId ?? null,
    personId: input.personId ?? null,
    threadSubject: input.threadSubject ?? null,
    lifecycle: null,
    remainingFounderCommitment: input.remaining === false ? null : REMAINING,
    waitingState: null,
    noFounderAction: false,
    staleInboundSatisfied: false,
    evidence: [],
    sourceRefs: input.sourceRefs ?? [],
  });
}

function seed(input: {
  id: string;
  projectId?: string | null;
  personId?: string | null;
  threadId?: string | null;
  threadSubject?: string | null;
  candidateIds?: readonly string[];
  displayName?: string;
  organizationLabel?: string | null;
  vendorContactName?: string | null;
  sourceRefs?: readonly string[];
  remaining?: boolean;
}): TodayDocketSeed {
  const built = packet({
    itemId: input.id,
    displayName: input.displayName ?? "Riley Chen",
    projectId: input.projectId,
    personId: input.personId,
    threadSubject: input.threadSubject,
    organizationLabel: input.organizationLabel,
    vendorContactName: input.vendorContactName,
    sourceRefs: input.sourceRefs,
    remaining: input.remaining,
  });
  return {
    id: input.id,
    origin: "brief",
    subject: input.displayName ?? "Riley Chen",
    headline: REMAINING.headline,
    context: REMAINING.explanation,
    brief: null,
    job: null,
    decision: null,
    anomaly: null,
    packet: built,
    briefing: null,
    projectId: input.projectId ?? null,
    candidateIds: input.candidateIds ?? [],
    threadId: input.threadId ?? null,
    threadSubject: input.threadSubject ?? null,
    declined: false,
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

function founderCommitment(input: {
  candidateId: string;
  threadId: string;
  messageId: string;
  text: string;
  projectId?: string;
}): ContinuumCandidate {
  return gmailRow({
    candidateId: input.candidateId,
    sourceRef: `gc1|${input.threadId}|${input.messageId}`,
    sourceTimestamp: NOW,
    candidateType: "open_job",
    proposedTarget: input.projectId
      ? { kind: "open_job", projectId: input.projectId }
      : { kind: "none" },
    payload: {
      kind: "open_job",
      jobKind: "commitment",
      subject: input.text,
      detail: input.text,
      waitingOnActor: "founder",
      dueAt: null,
      createJob: false,
    },
    evidenceBasis: {
      ruleIds: ["explicit_founder_commitment"],
      matchedText: input.text,
    },
  });
}

describe("Today grouping safety: personId never collapses distinct work", () => {
  it("A: same person + two different projectIds remain two groups", () => {
    const grouped = dedupeTodaySeeds([
      seed({
        id: "engagement",
        projectId: PROJECT_ENGAGEMENT,
        personId: PERSON,
        threadId: THREAD_ENGAGEMENT,
        threadSubject: `RE: HGD x Riley-${CAD_ENGAGEMENT}`,
        candidateIds: ["cand-engagement"],
      }),
      seed({
        id: "earrings",
        projectId: PROJECT_EARRINGS,
        personId: PERSON,
        threadId: THREAD_EARRINGS,
        threadSubject: `RE: HGD x Riley-${CAD_EARRINGS}`,
        candidateIds: ["cand-earrings"],
      }),
    ]);
    assert.equal(grouped.length, 2);
    assert.equal(
      todayGroupKeysFor(grouped[0]!).some((key) => key.startsWith("person:")),
      false,
    );
    assert.equal(
      todayGroupKeysFor(grouped[1]!).some((key) => key.startsWith("person:")),
      false,
    );
  });

  it("B: same person + two different CAD ids remain two groups", () => {
    const grouped = dedupeTodaySeeds([
      seed({
        id: "cad-one",
        personId: PERSON,
        threadSubject: `RE: HGD x Riley-${CAD_ENGAGEMENT}`,
        candidateIds: ["cand-cad-one"],
      }),
      seed({
        id: "cad-two",
        personId: PERSON,
        threadSubject: `RE: HGD x Riley-${CAD_EARRINGS}`,
        candidateIds: ["cand-cad-two"],
      }),
    ]);
    assert.equal(grouped.length, 2);
  });

  it("C: same vendor contact + two different client projects remain two groups", () => {
    const grouped = dedupeTodaySeeds([
      seed({
        id: "vendor-engagement",
        projectId: PROJECT_ENGAGEMENT,
        personId: "vendor-contact-niurka",
        displayName: "Niurka Lulo",
        organizationLabel: "Vlora",
        vendorContactName: "Niurka Lulo",
        threadId: THREAD_ENGAGEMENT,
        threadSubject: `RE: HGD x Riley-${CAD_ENGAGEMENT}`,
        candidateIds: ["cand-vendor-engagement"],
      }),
      seed({
        id: "vendor-earrings",
        projectId: PROJECT_EARRINGS,
        personId: "vendor-contact-niurka",
        displayName: "Niurka Lulo",
        organizationLabel: "Vlora",
        vendorContactName: "Niurka Lulo",
        threadId: THREAD_EARRINGS,
        threadSubject: `RE: HGD x Riley-${CAD_EARRINGS}`,
        candidateIds: ["cand-vendor-earrings"],
      }),
    ]);
    assert.equal(grouped.length, 2);
    assert.equal(
      grouped.some((row) => todayGroupKeysFor(row).some((key) => /vlora|org:/i.test(key))),
      false,
    );
  });

  it("D: same person + same project + two producers collapse to one group", () => {
    const grouped = dedupeTodaySeeds([
      seed({
        id: "brief-producer",
        projectId: PROJECT_EARRINGS,
        personId: PERSON,
        threadId: THREAD_EARRINGS,
        threadSubject: `RE: HGD x Riley-${CAD_EARRINGS}`,
        candidateIds: ["cand-stl"],
      }),
      seed({
        id: "decision-producer",
        projectId: PROJECT_EARRINGS,
        personId: PERSON,
        candidateIds: ["cand-print"],
        displayName: "Riley Chen",
      }),
    ]);
    assert.equal(grouped.length, 1);
  });

  it("E: same Gmail thread recovered from href across producers collapses to one group", () => {
    const grouped = dedupeTodaySeeds([
      seed({
        id: "brief-thread",
        personId: PERSON,
        threadId: THREAD_SHARED,
        candidateIds: ["cand-brief"],
      }),
      seed({
        id: "decision-href",
        personId: PERSON,
        candidateIds: ["cand-decision"],
        sourceRefs: [`${GMAIL}/${THREAD_SHARED}/1a0abcabcabc02`],
      }),
    ]);
    assert.equal(grouped.length, 1);
    assert.ok(todayGroupKeysFor(grouped[0]!).includes(`thread:${THREAD_SHARED}`));
  });

  it("F: no strong project/CAD/thread + same person + same unresolved loop may dedupe", () => {
    const grouped = dedupeTodaySeeds([
      seed({
        id: "assoc-seed",
        personId: PERSON,
        candidateIds: ["cand-assoc"],
      }),
      seed({
        id: "note-seed",
        personId: PERSON,
        candidateIds: ["cand-note"],
      }),
    ]);
    assert.equal(grouped.length, 1);
    assert.ok(todayGroupKeysFor(grouped[0]!).includes(`person:${PERSON}`));
  });

  it("authenticated compose keeps two current projects for one person distinct", () => {
    const projects = new Map<string, CosProjectContext>([
      [
        PROJECT_ENGAGEMENT,
        {
          projectId: PROJECT_ENGAGEMENT,
          title: "Riley engagement",
          personName: "Riley Chen",
          people: [{ personId: PERSON, displayName: "Riley Chen", role: "client" }],
          isCurrent: true,
          specs: [{ fieldName: "cad_job_number", value: CAD_ENGAGEMENT }],
          gmailThreadId: THREAD_ENGAGEMENT,
        },
      ],
      [
        PROJECT_EARRINGS,
        {
          projectId: PROJECT_EARRINGS,
          title: "Riley earrings",
          personName: "Riley Chen",
          people: [{ personId: PERSON, displayName: "Riley Chen", role: "client" }],
          isCurrent: true,
          specs: [{ fieldName: "cad_job_number", value: CAD_EARRINGS }],
          gmailThreadId: THREAD_EARRINGS,
        },
      ],
    ]);
    const threadContext = new Map<string, TodayGmailThreadContext>([
      [
        THREAD_ENGAGEMENT,
        {
          subject: `RE: HGD x Riley-${CAD_ENGAGEMENT}`,
          fromDisplayName: "Riley Chen",
          fromEmail: "riley@example.test",
          messages: [
            {
              messageId: "eng-out",
              sentAt: NOW,
              direction: "outbound",
              fromEmailHash: FOUNDER_HASH,
            },
          ],
        },
      ],
      [
        THREAD_EARRINGS,
        {
          subject: `RE: HGD x Riley-${CAD_EARRINGS}`,
          fromDisplayName: "Niurka Lulo",
          fromEmail: NIURKA_EMAIL,
          messages: [
            {
              messageId: "ear-out",
              sentAt: NOW,
              direction: "outbound",
              fromEmailHash: FOUNDER_HASH,
            },
          ],
        },
      ],
    ]);
    const loop = composeCosOperatingLoop({
      jobs: [],
      candidates: [
        founderCommitment({
          candidateId: "riley-engagement",
          threadId: THREAD_ENGAGEMENT,
          messageId: "eng-out",
          text: "I'll print the engagement model today.",
          projectId: PROJECT_ENGAGEMENT,
        }),
        founderCommitment({
          candidateId: "riley-earrings",
          threadId: THREAD_EARRINGS,
          messageId: "ear-out",
          text: "I'll print the earring model today.",
          projectId: PROJECT_EARRINGS,
        }),
      ],
      projects,
      nowIso: NOW,
      threadContext,
      knownPeople: [
        {
          personId: PERSON,
          displayName: "Riley Chen",
          roles: ["client"],
          emailHash: hashEmail("riley@example.test")!,
        },
        {
          personId: "vendor-contact-niurka",
          displayName: "Niurka Lulo",
          roles: ["vendor-contact"],
          organizationName: "Vlora",
          emailHash: NIURKA_HASH,
        },
      ],
      vendorDirectory: ["vlora"],
    });
    const docket = composeTodayDocket(loop);
    const riley = [
      ...docket.items.filter((item) => /Riley|C031001|C031002/i.test(`${item.subject} ${item.headline}`)),
      ...docket.watching.filter((row) => /Riley|C031001|C031002/i.test(`${row.title} ${row.detail}`)),
    ];
    const projectIds = new Set(riley.map((row) => row.briefingPacket?.projectId).filter(Boolean));
    assert.equal(
      riley.length,
      2,
      `expected two Riley groups, got ${riley.map((row) => ("subject" in row ? row.subject : row.title)).join("|")}`,
    );
    assert.equal(projectIds.has(PROJECT_ENGAGEMENT), true);
    assert.equal(projectIds.has(PROJECT_EARRINGS), true);
  });
});
