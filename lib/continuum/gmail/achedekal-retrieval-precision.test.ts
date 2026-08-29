/**
 * Alea candidate retrieval precision / participant-role regressions.
 * Synthetic metadata only. Does not write production truth.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import {
  GMAIL_SOURCE_SYSTEM,
  type GmailIndexedMessage,
} from "@/lib/continuum/client-memory/gmail/types";
import {
  ACHEDEKAL_AMBIGUOUS_THREAD_CANDIDATE_LIMIT,
  ACHEDEKAL_PROJECT_ID,
  ACHEDEKAL_RELATED_THREAD_CANDIDATE_LIMIT,
  ACHEDEKAL_UNASSIGNED_THREAD_CANDIDATE_LIMIT,
} from "./achedekal-acceptance";
import {
  DISCOVERY_ZERO_SCORE_DISPLAY_RULE,
  executeAchedekalCandidateDiscovery,
  isMeaningfulDiscoveryReviewRow,
  type AchedekalDiscoveryCatalog,
  type AchedekalDiscoveryIndex,
  type AchedekalDiscoveryProject,
} from "./achedekal-candidate-discovery";
import { InMemoryGmailAttachmentStore } from "./attachments";
import {
  ALEA_CHEDEKAL_FIXTURE_PERSON_ID,
  ALEA_CHEDEKAL_FIXTURE_PROJECT_B_ID,
  ALEA_CHEDEKAL_FIXTURE_THREAD_ID,
  ALEA_CHEDEKAL_PROJECT_A_CAD,
  ALEA_CHEDEKAL_PROJECT_A_ORDER,
  ALEA_CHEDEKAL_PROJECT_B_CAD,
  ALEA_CHEDEKAL_PROJECT_B_ORDER,
  ALEA_CHEDEKAL_PROJECT_B_THREAD_ID,
  ALEA_COLLISION_FAR_CAD,
  ALEA_COLLISION_FAR_PROJECT_ID,
  ALEA_COLLISION_FAR_THREAD_ID,
  ALEA_DISCOVERY_CC_EMAIL,
  ALEA_DISCOVERY_DUAL_PROJECT_THREAD_ID,
  ALEA_DISCOVERY_GENERIC_PERSON_THREAD_ID,
  ALEA_DISCOVERY_RELATED_CAD_THREAD_ID,
  ALEA_DISCOVERY_VENDOR_EMAIL,
  ALEA_DISCOVERY_VENDOR_UNRELATED_THREAD_ID,
  ALEA_VENDOR_FLOOD_COUNT,
  aleaChedekalDiscoveryIndexedMessages,
  aleaVendorFloodThreadId,
} from "./alea-chedekal-fixture";
import type { ExistingProjectBook } from "./project-book-containment";
import { INTERNAL_HOURGLASS_ADDRESSES } from "./project-reconstruction";

const DIR = dirname(fileURLToPath(import.meta.url));
const PERSON_HASH = hashEmail("chedekal@example.com")!;
const VENDOR_HASH = hashEmail(ALEA_DISCOVERY_VENDOR_EMAIL)!;
const CC_HASH = hashEmail(ALEA_DISCOVERY_CC_EMAIL)!;
const FOUNDER_HASH = hashEmail(INTERNAL_HOURGLASS_ADDRESSES[0])!;

function book(over: Partial<ExistingProjectBook> & { projectId: string }): ExistingProjectBook {
  return {
    personId: ALEA_CHEDEKAL_FIXTURE_PERSON_ID,
    title: over.title ?? over.projectId,
    lifecycle: "historical_closed",
    items: [],
    cadJobNumbers: [],
    orderNumbers: [],
    gmailThreadIds: [],
    artifactRefs: [],
    vendors: [],
    subjectTerms: [],
    dateRange: null,
    ...over,
  };
}

function defaultBooks(): ExistingProjectBook[] {
  return [
    book({
      projectId: ACHEDEKAL_PROJECT_ID,
      title: "A. Achedekal",
      cadJobNumbers: [ALEA_CHEDEKAL_PROJECT_A_CAD],
      orderNumbers: [ALEA_CHEDEKAL_PROJECT_A_ORDER],
      gmailThreadIds: [ALEA_CHEDEKAL_FIXTURE_THREAD_ID],
      vendors: ["Vendor North"],
    }),
    book({
      projectId: ALEA_CHEDEKAL_FIXTURE_PROJECT_B_ID,
      title: "Alea project B",
      cadJobNumbers: [ALEA_CHEDEKAL_PROJECT_B_CAD],
      orderNumbers: [ALEA_CHEDEKAL_PROJECT_B_ORDER],
      gmailThreadIds: [ALEA_CHEDEKAL_PROJECT_B_THREAD_ID],
      vendors: ["Vendor North"],
    }),
  ];
}

function target(over: Partial<AchedekalDiscoveryProject> = {}): AchedekalDiscoveryProject {
  return {
    projectId: ACHEDEKAL_PROJECT_ID,
    gmailThreadId: ALEA_CHEDEKAL_FIXTURE_THREAD_ID,
    cadJobNumber: ALEA_CHEDEKAL_PROJECT_A_CAD,
    orderNumber: ALEA_CHEDEKAL_PROJECT_A_ORDER,
    fingerSize: "141",
    metal: null,
    centerStone: null,
    personId: ALEA_CHEDEKAL_FIXTURE_PERSON_ID,
    personEmailHash: PERSON_HASH,
    personEmailHashes: [PERSON_HASH],
    ...over,
  };
}

function catalogOf(
  project: AchedekalDiscoveryProject,
  books: readonly ExistingProjectBook[],
): AchedekalDiscoveryCatalog {
  return {
    async getTargetProject() {
      return project;
    },
    async listProjectBooks() {
      return books;
    },
  };
}

function trackingIndex(messages: readonly GmailIndexedMessage[]): AchedekalDiscoveryIndex & {
  hashQueries: string[];
} {
  const hashQueries: string[] = [];
  return {
    hashQueries,
    async listMessagesByThread(threadId: string) {
      return messages.filter((row) => row.threadId === threadId);
    },
    async listMessagesMatchingSubjectTokens(tokens: readonly string[]) {
      const needles = tokens.map((token) => token.trim().toLowerCase()).filter(Boolean);
      if (needles.length === 0) return [];
      return messages.filter((row) => {
        const subject = (row.subject ?? "").toLowerCase();
        return needles.some((needle) => subject.includes(needle));
      });
    },
    async listMessagesTouchingEmailHash(emailHash: string) {
      const hash = emailHash.trim();
      hashQueries.push(hash);
      return messages.filter(
        (row) =>
          row.fromEmailHash === hash ||
          row.toEmailHashes.includes(hash) ||
          row.ccEmailHashes.includes(hash) ||
          row.bccEmailHashes.includes(hash),
      );
    },
  };
}

function indexed(input: {
  messageId: string;
  threadId: string;
  subject: string;
  fromEmail: string;
}): GmailIndexedMessage {
  return {
    messageId: input.messageId,
    threadId: input.threadId,
    sentAt: "2024-04-09T10:00:00.000Z",
    indexedAt: "2026-08-28T00:00:00.000Z",
    subject: input.subject,
    fromEmailHash: hashEmail(input.fromEmail),
    toEmailHashes: [FOUNDER_HASH],
    ccEmailHashes: [],
    bccEmailHashes: [],
    direction: "inbound",
    labelIds: [],
    hasAttachments: false,
    sourceSystem: GMAIL_SOURCE_SYSTEM,
  };
}

async function run(over: {
  project?: AchedekalDiscoveryProject;
  books?: readonly ExistingProjectBook[];
  messages?: readonly GmailIndexedMessage[];
} = {}) {
  const messages = over.messages ?? aleaChedekalDiscoveryIndexedMessages();
  const index = trackingIndex(messages);
  const result = await executeAchedekalCandidateDiscovery({
    founderSessionOk: true,
    catalog: catalogOf(over.project ?? target(), over.books ?? defaultBooks()),
    index,
    attachments: new InMemoryGmailAttachmentStore(),
    internalEmailHashes: [FOUNDER_HASH],
  });
  return { result, index };
}

function allIds(result: Extract<Awaited<ReturnType<typeof run>>["result"], { ok: true }>) {
  return [
    ...result.related.map((row) => row.threadId),
    ...result.ambiguous.map((row) => row.threadId),
    ...result.unassigned.map((row) => row.threadId),
  ];
}

describe("Alea retrieval precision", () => {
  it("does not flood review queues with Vendor North's unrelated jobs", async () => {
    const { result, index } = await run();
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const ids = allIds(result);
    for (let n = 1; n <= ALEA_VENDOR_FLOOD_COUNT; n += 1) {
      assert.equal(ids.includes(aleaVendorFloodThreadId(n)), false, `flood ${n}`);
    }
    assert.equal(ids.includes(ALEA_DISCOVERY_VENDOR_UNRELATED_THREAD_ID), false);
    assert.equal(index.hashQueries.includes(VENDOR_HASH), false);
    assert.equal(index.hashQueries.includes(CC_HASH), false);
    assert.equal(index.hashQueries.includes(FOUNDER_HASH), false);
    assert.equal(index.hashQueries.includes(PERSON_HASH), true);
  });

  it("seeds canonical Person retrieval and keeps vendor/internal/CC from seeding", async () => {
    const { result, index } = await run();
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(
      result.related.some((row) => row.threadId === ALEA_DISCOVERY_RELATED_CAD_THREAD_ID),
      true,
    );
    assert.deepEqual(
      [...new Set(index.hashQueries)],
      [PERSON_HASH],
    );
  });

  it("routes same Person + different project to possible_new_project, not attach", async () => {
    const { result } = await run();
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const row =
      result.unassigned.find((item) => item.threadId === ALEA_CHEDEKAL_PROJECT_B_THREAD_ID) ??
      result.ambiguous.find((item) => item.threadId === ALEA_CHEDEKAL_PROJECT_B_THREAD_ID);
    assert.ok(row);
    assert.equal(row.attachedProjectId, null);
    assert.equal(row.automaticCreate, false);
    assert.equal(row.requiresFounderReview, true);
    assert.equal(
      row.reasons.some((reason) => reason.kind === "possible_new_project"),
      true,
    );
    assert.equal(
      result.related.some((item) => item.threadId === ALEA_CHEDEKAL_PROJECT_B_THREAD_ID),
      false,
    );
    assert.equal(
      result.related.some((item) => item.threadId === ALEA_DISCOVERY_GENERIC_PERSON_THREAD_ID),
      false,
    );
    assert.equal(
      result.unassigned.some((item) => item.threadId === ALEA_DISCOVERY_GENERIC_PERSON_THREAD_ID),
      false,
    );
  });

  it("still detects collision when the owning Project Book is beyond position 64", async () => {
    const fillers = Array.from({ length: 70 }, (_, index) =>
      book({
        projectId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        title: `Filler ${index + 1}`,
        cadJobNumbers: [`CAD-${7000 + index}`],
      }),
    );
    const far = book({
      projectId: ALEA_COLLISION_FAR_PROJECT_ID,
      title: "Far collision book",
      cadJobNumbers: [ALEA_COLLISION_FAR_CAD],
      gmailThreadIds: [ALEA_COLLISION_FAR_THREAD_ID],
    });
    const { result } = await run({
      books: [...fillers, ...defaultBooks(), far],
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const hit =
      result.ambiguous.find((row) => row.threadId === ALEA_COLLISION_FAR_THREAD_ID) ??
      result.unassigned.find((row) => row.threadId === ALEA_COLLISION_FAR_THREAD_ID);
    assert.ok(hit);
    assert.equal(hit.attachedProjectId, null);
    assert.equal(hit.requiresFounderReview, true);
    assert.equal(
      hit.reasons.some((reason) => reason.kind === "ambiguous_between_projects"),
      true,
    );
    assert.equal(
      result.related.some((row) => row.threadId === ALEA_COLLISION_FAR_THREAD_ID),
      false,
    );
  });

  it("marks dual-project strong identifiers ambiguous with no first-match wins", async () => {
    const { result } = await run();
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const dual =
      result.ambiguous.find((row) => row.threadId === ALEA_DISCOVERY_DUAL_PROJECT_THREAD_ID) ??
      result.unassigned.find((row) => row.threadId === ALEA_DISCOVERY_DUAL_PROJECT_THREAD_ID);
    assert.ok(dual);
    assert.equal(dual.reviewStatus, "ambiguous");
    assert.equal(dual.attachedProjectId, null);
    assert.equal(dual.requiresFounderReview, true);
    assert.equal(dual.automaticCreate, false);
    assert.equal(
      dual.reasons.some((reason) => reason.kind === "ambiguous_between_projects"),
      true,
    );
  });

  it("keeps related / ambiguous / unassigned budgets independent", async () => {
    const extras: GmailIndexedMessage[] = [];
    for (let index = 1; index <= 25; index += 1) {
      extras.push(
        indexed({
          messageId: `budget-related-${index}`,
          threadId: `19budgetrel${String(index).padStart(5, "0")}`,
          subject: `${ALEA_CHEDEKAL_PROJECT_A_CAD} related ${index}`,
          fromEmail: "chedekal@example.com",
        }),
      );
    }
    for (let index = 1; index <= 15; index += 1) {
      extras.push(
        indexed({
          messageId: `budget-ambiguous-${index}`,
          threadId: `19budgetamb${String(index).padStart(5, "0")}`,
          subject: `${ALEA_CHEDEKAL_PROJECT_A_CAD} ${ALEA_CHEDEKAL_PROJECT_B_CAD} both ${index}`,
          fromEmail: "chedekal@example.com",
        }),
      );
    }
    for (let index = 1; index <= 15; index += 1) {
      extras.push(
        indexed({
          messageId: `budget-unassigned-${index}`,
          threadId: `19budgetuna${String(index).padStart(5, "0")}`,
          subject: `${ALEA_CHEDEKAL_PROJECT_B_CAD} later ${index}`,
          fromEmail: "chedekal@example.com",
        }),
      );
    }
    const { result } = await run({
      messages: [...aleaChedekalDiscoveryIndexedMessages(), ...extras],
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.related.length, ACHEDEKAL_RELATED_THREAD_CANDIDATE_LIMIT);
    assert.equal(result.ambiguous.length, ACHEDEKAL_AMBIGUOUS_THREAD_CANDIDATE_LIMIT);
    assert.equal(result.unassigned.length, ACHEDEKAL_UNASSIGNED_THREAD_CANDIDATE_LIMIT);
    assert.equal(result.resultsLimited, true);
    assert.equal(result.relatedLimit, 20);
    assert.equal(result.ambiguousLimit, 10);
    assert.equal(result.unassignedLimit, 10);
  });

  it("shows honest empty-index copy instead of fabricated zero metadata", async () => {
    const { result } = await run({
      messages: aleaChedekalDiscoveryIndexedMessages().filter(
        (row) => row.threadId !== ALEA_CHEDEKAL_FIXTURE_THREAD_ID,
      ),
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.knownThread, null);
    assert.equal(result.knownThreadIndexStatus, "empty-index");
  });

  it("does not invent Person identity when the Project Book has no canonical hash", async () => {
    const { result, index } = await run({
      project: target({
        personId: null,
        personEmailHash: null,
        personEmailHashes: [],
      }),
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(index.hashQueries.includes(VENDOR_HASH), false);
    assert.equal(index.hashQueries.includes(PERSON_HASH), false);
    assert.equal(index.hashQueries.length, 0);
    const ids = allIds(result);
    for (let n = 1; n <= ALEA_VENDOR_FLOOD_COUNT; n += 1) {
      assert.equal(ids.includes(aleaVendorFloodThreadId(n)), false);
    }
    assert.equal(
      result.related.some((row) => row.threadId === ALEA_DISCOVERY_RELATED_CAD_THREAD_ID),
      true,
    );
    assert.equal(result.lifecycle, "Historical / closed");
    assert.equal(result.automaticCreate, false);
    assert.equal(result.automaticApply, false);
  });

  it("hides score-0 insufficient vendor noise and keeps meaningful review rows", () => {
    assert.match(DISCOVERY_ZERO_SCORE_DISPLAY_RULE, /score-0/i);
    assert.equal(
      isMeaningfulDiscoveryReviewRow({
        score: 0,
        strength: "insufficient",
        reviewStatus: "unassigned",
        reasons: [{ kind: "vendor_only", value: "x", detail: "noise" }],
      }),
      false,
    );
    assert.equal(
      isMeaningfulDiscoveryReviewRow({
        score: 0,
        strength: "insufficient",
        reviewStatus: "unassigned",
        reasons: [
          {
            kind: "possible_new_project",
            value: "t",
            detail: "Person-related other project",
          },
        ],
      }),
      true,
    );
    assert.equal(
      isMeaningfulDiscoveryReviewRow({
        score: 0,
        strength: "insufficient",
        reviewStatus: "candidate",
        reasons: [{ kind: "cad_identifier_strong", value: "CAD-1", detail: "cad" }],
      }),
      false,
    );
  });

  it("does not add Gmail body fetch, related-thread fetch, or canonical writes", () => {
    const source = readFileSync(join(DIR, "achedekal-candidate-discovery.ts"), "utf8");
    const roles = readFileSync(join(DIR, "participant-retrieval-role.ts"), "utf8");
    const actions = readFileSync(
      join(DIR, "../../../app/executive-dashboard/concierge/achedekal-discovery-actions.ts"),
      "utf8",
    );
    for (const text of [source, roles, actions]) {
      assert.doesNotMatch(text, /users\.threads\.get|users\.messages\.list|users\.messages\.get/);
      assert.doesNotMatch(text, /gmail\.googleapis|createLiveGmailApi/);
      assert.doesNotMatch(text, /\/messages\/[^?\s"'`]+\/attachments\//);
      assert.doesNotMatch(text, /editPersonProfile|createPersonAtomic|insertEntity\(/);
      assert.doesNotMatch(text, /correctProjectSpec|insertProjectHistory|writeHumanIntake/);
      assert.doesNotMatch(text, /createOpenJob|today-5|chief-of-staff/);
    }
    assert.match(source, /automaticApply: false/);
    assert.match(source, /automaticCreate: false/);
    assert.doesNotMatch(actions, /listProjects\(\{\s*limit:\s*64\s*\}\)/);
  });
});
