/**
 * Achedekal/Alea project-scoped candidate related-thread discovery tests.
 * Synthetic metadata only. Does not write production truth.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import type { GmailIndexedMessage } from "@/lib/continuum/client-memory/gmail/types";
import { InMemoryGmailIndexStore } from "@/lib/continuum/client-memory/gmail/store";
import {
  ACHEDEKAL_DISCOVERY_WARNING,
  ACHEDEKAL_PROJECT_ID,
  ACHEDEKAL_RELATED_THREAD_CANDIDATE_LIMIT,
} from "./achedekal-acceptance";
import {
  executeAchedekalCandidateDiscovery,
  failedAchedekalDiscovery,
  sanitizeAchedekalDiscoveryFailure,
  type AchedekalDiscoveryAttachments,
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
  ALEA_DISCOVERY_DUAL_PROJECT_THREAD_ID,
  ALEA_DISCOVERY_GENERIC_PERSON_THREAD_ID,
  ALEA_DISCOVERY_INTERNAL_THREAD_ID,
  ALEA_DISCOVERY_MULTI_CAD_THREAD_ID,
  ALEA_DISCOVERY_OTHER_CLIENT_THREAD_ID,
  ALEA_DISCOVERY_RELATED_CAD_THREAD_ID,
  ALEA_DISCOVERY_SPAM_THREAD_ID,
  ALEA_DISCOVERY_VENDOR_UNRELATED_THREAD_ID,
  ALEA_DISCOVERY_WEAK_ORDER_THREAD_ID,
  ALEA_DISCOVERY_WEAK_SUPPORT_THREAD_ID,
  aleaChedekalDiscoveryIndexedMessages,
} from "./alea-chedekal-fixture";
import type { ExistingProjectBook } from "./project-book-containment";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const DIR = dirname(fileURLToPath(import.meta.url));
const PERSON_HASH = hashEmail("chedekal@example.com")!;
const OTHER_PROJECT_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

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

function indexOf(messages: readonly GmailIndexedMessage[]): AchedekalDiscoveryIndex {
  return {
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

function targetProject(): AchedekalDiscoveryProject {
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
  };
}

function books(): ExistingProjectBook[] {
  return [
    {
      projectId: ACHEDEKAL_PROJECT_ID,
      personId: ALEA_CHEDEKAL_FIXTURE_PERSON_ID,
      title: "A. Achedekal",
      lifecycle: "historical_closed",
      items: [],
      cadJobNumbers: [ALEA_CHEDEKAL_PROJECT_A_CAD],
      orderNumbers: [ALEA_CHEDEKAL_PROJECT_A_ORDER],
      gmailThreadIds: [ALEA_CHEDEKAL_FIXTURE_THREAD_ID],
      artifactRefs: [],
      vendors: ["Vendor North"],
      subjectTerms: ["bracelet"],
      dateRange: {
        start: "2024-03-01T00:00:00.000Z",
        end: "2024-04-30T00:00:00.000Z",
      },
    },
    {
      projectId: ALEA_CHEDEKAL_FIXTURE_PROJECT_B_ID,
      personId: ALEA_CHEDEKAL_FIXTURE_PERSON_ID,
      title: "Alea project B",
      lifecycle: "historical_closed",
      items: [],
      cadJobNumbers: [ALEA_CHEDEKAL_PROJECT_B_CAD],
      orderNumbers: [ALEA_CHEDEKAL_PROJECT_B_ORDER],
      gmailThreadIds: [ALEA_CHEDEKAL_PROJECT_B_THREAD_ID],
      artifactRefs: [],
      vendors: ["Vendor North"],
      subjectTerms: ["necklace"],
      dateRange: {
        start: "2026-01-01T00:00:00.000Z",
        end: "2026-12-31T00:00:00.000Z",
      },
    },
  ];
}

async function discover(over: {
  founderSessionOk?: boolean;
  requestedProjectId?: string | null;
  requestedThreadId?: string | null;
  requestedQuery?: string | null;
  messages?: GmailIndexedMessage[];
  attachments?: AchedekalDiscoveryAttachments;
} = {}) {
  const attachments = over.attachments ?? new InMemoryGmailAttachmentStore();
  if (!over.attachments) {
    await attachments.putAttachment({
      attachmentId: "att-cad-follow-up",
      messageId: "idx-related-cad",
      threadId: ALEA_DISCOVERY_RELATED_CAD_THREAD_ID,
      filename: "cad-8821-follow-up.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      indexedAt: "2026-08-28T00:00:00.000Z",
    });
  }
  return executeAchedekalCandidateDiscovery({
    founderSessionOk: over.founderSessionOk ?? true,
    requestedProjectId: over.requestedProjectId,
    requestedThreadId: over.requestedThreadId,
    requestedQuery: over.requestedQuery,
    catalog: catalogOf(targetProject(), books()),
    index: indexOf(over.messages ?? aleaChedekalDiscoveryIndexedMessages()),
    attachments,
  });
}

function idsOf(
  rows: readonly { threadId: string }[],
): string[] {
  return rows.map((row) => row.threadId).sort();
}

describe("Alea candidate related-thread discovery acceptance", () => {
  it("discovers metadata candidates without opening or attaching threads", async () => {
    const result = await discover({
      requestedProjectId: OTHER_PROJECT_ID,
      requestedThreadId: "caller-thread",
      requestedQuery: "in:anywhere Alea",
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.safeErrorCode, "project-not-found");

    const ok = await discover({
      requestedProjectId: ACHEDEKAL_PROJECT_ID,
      requestedThreadId: "ignored-thread",
      requestedQuery: "ignored gmail q",
    });
    assert.equal(ok.ok, true);
    if (!ok.ok) return;
    assert.equal(ok.projectName.includes("Achedekal"), true);
    assert.equal(ok.lifecycle, "Historical / closed");
    assert.equal(ok.warning, ACHEDEKAL_DISCOVERY_WARNING);
    assert.equal(ok.automaticApply, false);
    assert.equal(ok.automaticCreate, false);
    assert.equal(ok.fetchesRelatedThreads, false);
    assert.equal(ok.fetchesGmail, false);
    assert.equal(ok.knownThread?.threadId, ALEA_CHEDEKAL_FIXTURE_THREAD_ID);
    assert.equal(ok.knownThread?.source, "indexed-metadata");
    assert.equal(ok.knownThread?.messageCount, 4);
    assert.equal(ok.knownThreadIndexStatus, "indexed");

    const relatedIds = idsOf(ok.related);
    assert.equal(relatedIds.includes(ALEA_CHEDEKAL_FIXTURE_THREAD_ID), false);
    assert.equal(relatedIds.includes(ALEA_DISCOVERY_RELATED_CAD_THREAD_ID), true);
    assert.equal(relatedIds.includes(ALEA_DISCOVERY_MULTI_CAD_THREAD_ID), true);
    assert.equal(relatedIds.includes(ALEA_DISCOVERY_WEAK_SUPPORT_THREAD_ID), true);
    assert.equal(relatedIds.includes(ALEA_DISCOVERY_VENDOR_UNRELATED_THREAD_ID), false);
    assert.equal(relatedIds.includes(ALEA_DISCOVERY_GENERIC_PERSON_THREAD_ID), false);
    assert.equal(relatedIds.includes(ALEA_DISCOVERY_WEAK_ORDER_THREAD_ID), false);
    assert.equal(relatedIds.includes(ALEA_DISCOVERY_INTERNAL_THREAD_ID), false);
    assert.equal(relatedIds.includes(ALEA_DISCOVERY_SPAM_THREAD_ID), false);
    assert.equal(relatedIds.includes(ALEA_DISCOVERY_OTHER_CLIENT_THREAD_ID), false);
    assert.equal(relatedIds.includes(ALEA_CHEDEKAL_PROJECT_B_THREAD_ID), false);
    assert.equal(relatedIds.includes(ALEA_DISCOVERY_DUAL_PROJECT_THREAD_ID), false);

    const cad = ok.related.find(
      (row) => row.threadId === ALEA_DISCOVERY_RELATED_CAD_THREAD_ID,
    );
    assert.ok(cad);
    assert.equal(cad.reviewStatus, "candidate");
    assert.equal(cad.opened, false);
    assert.equal(cad.metadataOnly, true);
    assert.equal(cad.attachedProjectId, null);
    assert.equal(cad.fetchApproved, false);
    assert.equal(cad.requiresFounderReview, true);
    assert.equal(cad.score >= 100, true);
    assert.equal(
      cad.reasons.some((reason) => reason.kind === "cad_identifier_strong"),
      true,
    );
    assert.equal(cad.attachmentCount >= 1, true);

    const multi = ok.related.find(
      (row) => row.threadId === ALEA_DISCOVERY_MULTI_CAD_THREAD_ID,
    );
    assert.ok(multi);
    assert.equal(multi.messageCount, 3);
    assert.equal(multi.score < 300, true);
    assert.equal(
      multi.reasons.filter((reason) => reason.kind === "cad_identifier_strong").length >= 1,
      true,
    );

    const weakSupport = ok.related.find(
      (row) => row.threadId === ALEA_DISCOVERY_WEAK_SUPPORT_THREAD_ID,
    );
    assert.ok(weakSupport);
    assert.equal(weakSupport.strength === "exact" || weakSupport.strength === "strong", false);
    assert.equal(weakSupport.requiresFounderReview, true);

    const unassignedIds = [
      ...idsOf(ok.ambiguous),
      ...idsOf(ok.unassigned),
    ];
    assert.equal(unassignedIds.includes(ALEA_CHEDEKAL_PROJECT_B_THREAD_ID), true);
    const projectB =
      ok.unassigned.find((row) => row.threadId === ALEA_CHEDEKAL_PROJECT_B_THREAD_ID) ??
      ok.ambiguous.find((row) => row.threadId === ALEA_CHEDEKAL_PROJECT_B_THREAD_ID);
    assert.ok(projectB);
    assert.equal(projectB.attachedProjectId, null);
    assert.equal(projectB.automaticCreate, false);
    assert.equal(projectB.requiresFounderReview, true);
    assert.equal(
      projectB.reasons.some(
        (reason) =>
          reason.kind === "possible_new_project" ||
          reason.kind === "spans_multiple_projects",
      ),
      true,
    );

    const dual =
      ok.ambiguous.find((row) => row.threadId === ALEA_DISCOVERY_DUAL_PROJECT_THREAD_ID) ??
      ok.unassigned.find((row) => row.threadId === ALEA_DISCOVERY_DUAL_PROJECT_THREAD_ID);
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

  it("requires founder auth and cannot be overridden by caller search input", async () => {
    const denied = await discover({ founderSessionOk: false });
    assert.equal(denied.ok, false);
    if (!denied.ok) assert.equal(denied.safeErrorCode, "unauthorized");
    const sanitized = sanitizeAchedekalDiscoveryFailure(
      failedAchedekalDiscovery("unauthorized"),
    );
    assert.deepEqual(Object.keys(sanitized).sort(), ["ok", "safeErrorCode"]);
  });

  it("does not mutate canonical records or fetch Gmail", async () => {
    const source = readFileSync(join(DIR, "achedekal-candidate-discovery.ts"), "utf8");
    assert.doesNotMatch(source, /runExactProjectThreadFetch|getThread\(|listMessages\(/);
    assert.doesNotMatch(source, /users\.messages|users\.threads|gmail\.googleapis/);
    assert.doesNotMatch(source, /\/messages\/[^?\s"'`]+\/attachments\//);
    assert.doesNotMatch(source, /correctProjectSpec|applyProjectSpecCorrection|correctProjectKind|saveProjectKindCorrection/);
    assert.doesNotMatch(source, /editPersonProfile|createPersonAtomic|insertEntity\(/);
    assert.doesNotMatch(source, /insertSourceNote|writeHumanIntake|chief-of-staff/);
    assert.doesNotMatch(source, /createOpenJob|today-5|console\.(log|info|debug|warn|error)/);
    assert.doesNotMatch(source, /gtag|analytics|localStorage/);
    assert.match(source, /automaticApply: false/);
    assert.match(source, /automaticCreate: false/);
  });
});

describe("bounded Gmail metadata discovery helpers", () => {
  it("searches indexed subjects and participant hashes without bodies", async () => {
    const store = new InMemoryGmailIndexStore();
    const sample = aleaChedekalDiscoveryIndexedMessages()[3]!;
    await store.indexMessage(
      {
        messageId: sample.messageId,
        threadId: sample.threadId,
        sentAt: sample.sentAt,
        subject: sample.subject,
        fromEmail: "founder@hourglass.example",
        toEmails: ["chedekal@example.com"],
        direction: "outbound",
        hasAttachments: true,
      },
      sample.indexedAt,
    );
    const byToken = await store.listMessagesMatchingSubjectTokens(["CAD-8821"]);
    assert.equal(byToken.length, 1);
    assert.equal("plainText" in byToken[0]!, false);
    const byHash = await store.listMessagesTouchingEmailHash(
      hashEmail("chedekal@example.com")!,
    );
    assert.equal(byHash.length, 1);
    const none = await store.listMessagesMatchingSubjectTokens([]);
    assert.equal(none.length, 0);
  });
});

describe("Achedekal discovery UI and route stay founder-only and fetch-free", () => {
  it("adds a metadata-only related-thread control beside exact-thread review", () => {
    const page = readFileSync(
      join(
        ROOT,
        "app/executive-dashboard/concierge/project-reconstruction/achedekal/page.tsx",
      ),
      "utf8",
    );
    const form = readFileSync(
      join(
        ROOT,
        "app/executive-dashboard/concierge/components/achedekal-related-threads.tsx",
      ),
      "utf8",
    );
    const actions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/achedekal-discovery-actions.ts"),
      "utf8",
    );
    const reviewForm = readFileSync(
      join(
        ROOT,
        "app/executive-dashboard/concierge/components/achedekal-review-form.tsx",
      ),
      "utf8",
    );
    assert.match(page, /getAuthenticatedProjectDeskReader/);
    assert.match(page, /AchedekalRelatedThreadsForm/);
    assert.match(page, /AchedekalReviewForm/);
    assert.match(page, /index: false/);
    assert.doesNotMatch(page, /getThread|listMessages|users\.threads/);
    assert.match(reviewForm, /Review Gmail evidence/);
    assert.match(form, /Find possible related threads/);
    assert.match(form, /NOT OPENED|Not opened/);
    assert.match(form, /METADATA ONLY|Metadata only/);
    assert.match(form, /FOUNDER REVIEW REQUIRED|Founder review required/);
    assert.match(form, /No indexed metadata available for the stored project thread/);
    assert.match(form, /Related limit/);
    assert.match(form, /Ambiguous/);
    assert.match(form, /possible new project/i);
    assert.doesNotMatch(form, /Open thread|Read email|Fetch thread|Review Gmail evidence/);
    assert.doesNotMatch(form, /Apply Correction|Open Job|Move Project|Merge Project/);
    assert.doesNotMatch(form, /formData\.get\(/);
    assert.match(actions, /"use server"/);
    assert.match(actions, /executeAchedekalCandidateDiscovery/);
    assert.match(actions, /ACHEDEKAL_PROJECT_ID/);
    assert.match(actions, /listProjects\(\)/);
    assert.doesNotMatch(actions, /listProjects\(\{\s*limit:\s*64\s*\}\)/);
    assert.doesNotMatch(actions, /formData\.get\(/);
    assert.doesNotMatch(actions, /createLiveGmailApi|runExactProjectThreadFetch|getThread\(/);
      assert.doesNotMatch(actions, /correctProjectSpec|correctProjectKind|insertProjectHistory|insertSourceNote/);
    assert.doesNotMatch(actions, /createOpenJob|chief-of-staff|today-5/);
    assert.equal(ACHEDEKAL_RELATED_THREAD_CANDIDATE_LIMIT, 20);
  });
});
