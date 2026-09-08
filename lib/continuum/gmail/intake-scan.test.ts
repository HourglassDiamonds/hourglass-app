import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CANDIDATE_PARSER_GMAIL_V1, type ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { InMemoryCandidateStore } from "@/lib/continuum/candidates/store";
import { packGmailCandidateSourceRef } from "./candidates/source-ref";
import { InMemoryGmailIndexStore } from "@/lib/continuum/client-memory/gmail/store";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import { MockGmailApi, GmailHttpError } from "./adapter";
import { connectFounderMailbox, InMemoryGmailConnectionStore } from "./connection";
import { encodeGmailBody } from "./exact-thread-fixtures";
import {
  classifyGmailIntakeAttention,
  formatGmailIntakeScanNotice,
  recentIndexedThreadIds,
  relatedCommercialThreadIds,
  runGmailNewProjectIntakeScan,
  summarizeGmailIntakeScan,
} from "./intake-scan";
import { encryptRefreshToken } from "./token-crypto";
import { GMAIL_READONLY_SCOPE, type GmailApiThread } from "./types";
import {
  NEW_PROJECT_CONTEXT_TOPIC,
  TRANSACTIONAL_CUSTOMER_NOTICE_RULE,
  WAITING_ON_CLIENT_TOPIC,
} from "./candidates/new-project";

const KEY = Buffer.from("c".repeat(64), "hex");
const NOW = "2026-09-08T12:00:00.000Z";
const THREAD = "19intake001thread";
const MESSAGE = "19intake001msg000";
const NONCE = "UNIQUE_BODY_NONCE_INTAKE_111";

function thread(): GmailApiThread {
  return {
    id: THREAD,
    messages: [
      {
        id: MESSAGE,
        threadId: THREAD,
        labelIds: ["INBOX"],
        internalDate: String(Date.parse("2026-09-07T15:00:00.000Z")),
        payload: {
          mimeType: "text/plain",
          headers: [
            { name: "From", value: "Nate <nate.pearl@example.test>" },
            { name: "Subject", value: "Another piece" },
          ],
          body: {
            data: encodeGmailBody(
              `I'd like to work together again to create another piece. ${NONCE}`,
            ),
            size: 40,
          },
        },
      },
    ],
  };
}

describe("Gmail new-project intake scan", () => {
  it("ingests proposals from a transient body read without persisting the nonce", async () => {
    const index = new InMemoryGmailIndexStore();
    await index.indexMessage(
      {
        messageId: MESSAGE,
        threadId: THREAD,
        sentAt: "2026-09-07T15:00:00.000Z",
        subject: "Another piece",
        fromEmail: "nate.pearl@example.test",
        direction: "inbound",
        hasAttachments: false,
      },
      NOW,
    );
    const connections = new InMemoryGmailConnectionStore();
    await connections.putConnection(
      connectFounderMailbox({
        existing: null,
        mailboxEmailHash: "ab".repeat(32),
        refreshToken: encryptRefreshToken("refresh-keep", KEY),
        grantedScope: GMAIL_READONLY_SCOPE,
        providerTokenType: "Bearer",
        now: NOW,
      }),
    );
    const api = new MockGmailApi();
    api.setThread(thread());
    const store = new InMemoryCandidateStore();
    const personId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const result = await runGmailNewProjectIntakeScan({
      founderSessionOk: true,
      index,
      connections,
      decryptRefreshToken: () => "refresh-keep",
      refreshAccessToken: async () => ({ ok: true, accessToken: "access" }),
      createApi: () => api,
      world: {
        people: [
          {
            personId,
            displayName: "Nathan Pearl",
            emailHash: hashEmail("nate.pearl@example.test"),
            role: "client",
            projectIds: [],
          },
        ],
        projects: [],
        internalEmailHashes: [],
      },
      store,
      nowIso: NOW,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.plaintextPersisted, false);
    assert.equal(result.gmailMutation, false);
    assert.equal(result.cursorUnchanged, true);
    assert.equal(result.unreadThreadCount, 0);
    assert.equal(result.threadCount, 1);
    assert.equal(result.newProjectProposalCount, 1);
    assert.ok(result.insertedIds.length > 0);
    assert.doesNotMatch(
      formatGmailIntakeScanNotice({
        threadCount: result.threadCount,
        threadReadCount: result.threadReadCount,
        unreadThreadCount: result.unreadThreadCount,
        newProjectProposalCount: result.newProjectProposalCount,
        actionReviewCount: result.actionReviewCount,
        relationshipUpdateCount: result.relationshipUpdateCount,
        backgroundObservationCount: result.backgroundObservationCount,
      }),
      /need attention|other review item/i,
    );
    const rows = await store.list();
    const serialized = JSON.stringify(rows);
    assert.equal(serialized.includes(NONCE), false);
    assert.equal(
      rows.some(
        (row) =>
          row.payload.kind === "project_context" &&
          row.payload.topic === NEW_PROJECT_CONTEXT_TOPIC,
      ),
      true,
    );
    const stored = await index.getMessage(MESSAGE);
    assert.equal("plaintext" in (stored ?? {}), false);
    assert.equal(api.calls.some((call) => call.method === "listMessages"), false);
  });

  it("extracts Nate's new-project evidence when the Person world is empty", async () => {
    const index = new InMemoryGmailIndexStore();
    await index.indexMessage(
      {
        messageId: MESSAGE,
        threadId: THREAD,
        sentAt: "2026-09-07T15:00:00.000Z",
        subject: "Another piece",
        fromEmail: "nate.pearl@example.test",
        direction: "inbound",
        hasAttachments: false,
      },
      NOW,
    );
    const connections = new InMemoryGmailConnectionStore();
    await connections.putConnection(
      connectFounderMailbox({
        existing: null,
        mailboxEmailHash: "ab".repeat(32),
        refreshToken: encryptRefreshToken("refresh-keep", KEY),
        grantedScope: GMAIL_READONLY_SCOPE,
        providerTokenType: "Bearer",
        now: NOW,
      }),
    );
    const api = new MockGmailApi();
    api.setThread(thread());
    const store = new InMemoryCandidateStore();
    const result = await runGmailNewProjectIntakeScan({
      founderSessionOk: true,
      index,
      connections,
      decryptRefreshToken: () => "refresh-keep",
      refreshAccessToken: async () => ({ ok: true, accessToken: "access" }),
      createApi: () => api,
      world: { people: [], projects: [], internalEmailHashes: [] },
      store,
      nowIso: NOW,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const rows = await store.list();
    assert.equal(
      rows.some(
        (row) =>
          row.payload.kind === "project_context" &&
          row.payload.topic === NEW_PROJECT_CONTEXT_TOPIC,
      ),
      true,
    );
    assert.equal(
      rows.some(
        (row) =>
          row.candidateType === "person_association" &&
          row.proposedTarget.kind === "person" &&
          row.proposedTarget.personId === null,
      ),
      true,
    );
    assert.equal(JSON.stringify(rows).includes(NONCE), false);
  });

  it("continues the scan when one indexed thread 404s and does not persist the nonce", async () => {
    const missing = "19intake404thread";
    const index = new InMemoryGmailIndexStore();
    await index.indexMessage(
      {
        messageId: MESSAGE,
        threadId: THREAD,
        sentAt: "2026-09-07T15:00:00.000Z",
        subject: "Another piece",
        fromEmail: "nate.pearl@example.test",
        direction: "inbound",
        hasAttachments: false,
      },
      NOW,
    );
    await index.indexMessage(
      {
        messageId: "19intake404msg000",
        threadId: missing,
        sentAt: "2026-09-07T16:00:00.000Z",
        subject: "Gone",
        fromEmail: "other@example.test",
        direction: "inbound",
        hasAttachments: false,
      },
      NOW,
    );
    const connections = new InMemoryGmailConnectionStore();
    await connections.putConnection(
      connectFounderMailbox({
        existing: null,
        mailboxEmailHash: "ab".repeat(32),
        refreshToken: encryptRefreshToken("refresh-keep", KEY),
        grantedScope: GMAIL_READONLY_SCOPE,
        providerTokenType: "Bearer",
        now: NOW,
      }),
    );
    const api = new MockGmailApi();
    api.setThread(thread());
    api.errors.set(`getThread:${missing}`, new GmailHttpError(404, "notFound"));
    const store = new InMemoryCandidateStore();
    const result = await runGmailNewProjectIntakeScan({
      founderSessionOk: true,
      index,
      connections,
      decryptRefreshToken: () => "refresh-keep",
      refreshAccessToken: async () => ({ ok: true, accessToken: "access" }),
      createApi: () => api,
      world: { people: [], projects: [], internalEmailHashes: [] },
      store,
      nowIso: NOW,
      threadIds: [THREAD, missing],
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.threadCount, 2);
    assert.equal(result.unreadThreadCount, 1);
    assert.equal(result.threadReadCount, 1);
    assert.equal(JSON.stringify(await store.list()).includes(NONCE), false);
    assert.equal(
      (await store.list()).some(
        (row) =>
          row.payload.kind === "project_context" &&
          row.payload.topic === NEW_PROJECT_CONTEXT_TOPIC,
      ),
      true,
    );
  });

  it("surfaces Candidate write failure without claiming success or writing a Project", async () => {
    const index = new InMemoryGmailIndexStore();
    await index.indexMessage(
      {
        messageId: MESSAGE,
        threadId: THREAD,
        sentAt: "2026-09-07T15:00:00.000Z",
        subject: "Another piece",
        fromEmail: "nate.pearl@example.test",
        direction: "inbound",
        hasAttachments: false,
      },
      NOW,
    );
    const connections = new InMemoryGmailConnectionStore();
    await connections.putConnection(
      connectFounderMailbox({
        existing: null,
        mailboxEmailHash: "ab".repeat(32),
        refreshToken: encryptRefreshToken("refresh-keep", KEY),
        grantedScope: GMAIL_READONLY_SCOPE,
        providerTokenType: "Bearer",
        now: NOW,
      }),
    );
    const api = new MockGmailApi();
    api.setThread(thread());
    const store = {
      async put() {
        throw new Error("candidate-write-failed");
      },
      async get() {
        return null;
      },
      async list() {
        return [];
      },
      async replace() {
        throw new Error("candidate-write-failed");
      },
      async applyReview() {
        return { ok: false as const, reason: "not-found" as const };
      },
    };
    const result = await runGmailNewProjectIntakeScan({
      founderSessionOk: true,
      index,
      connections,
      decryptRefreshToken: () => "refresh-keep",
      refreshAccessToken: async () => ({ ok: true, accessToken: "access" }),
      createApi: () => api,
      world: { people: [], projects: [], internalEmailHashes: [] },
      store,
      nowIso: NOW,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.safeErrorCode, "candidate-store-unavailable");
  });

  it("selects newest thread activity instead of the first 30 inbound rows", async () => {
    const index = new InMemoryGmailIndexStore();
    for (let i = 0; i < 30; i += 1) {
      await index.indexMessage(
        {
          messageId: `old-in-${String(i).padStart(2, "0")}`,
          threadId: `old-thread-${String(i).padStart(2, "0")}`,
          sentAt: new Date(Date.parse("2026-09-03T00:00:00.000Z") + i * 3600000).toISOString(),
          subject: "Older mail",
          fromEmail: `old${i}@example.test`,
          direction: "inbound",
          hasAttachments: false,
        },
        NOW,
      );
    }
    await index.indexMessage(
      {
        messageId: "nate-in-recent",
        threadId: "nate-featured-thread",
        sentAt: "2026-09-08T15:00:00.000Z",
        subject: "Re: Featured Ring",
        fromEmail: "nate.pearl@example.test",
        direction: "inbound",
        hasAttachments: false,
      },
      NOW,
    );
    await index.indexMessage(
      {
        messageId: "outbound-only-msg",
        threadId: "outbound-only-thread",
        sentAt: "2026-09-08T18:00:00.000Z",
        subject: "Sent only",
        fromEmail: "justin@hourglass.example",
        direction: "outbound",
        hasAttachments: false,
      },
      NOW,
    );
    const ids = await recentIndexedThreadIds(index, 30);
    assert.equal(ids[0], "outbound-only-thread");
    assert.ok(ids.includes("nate-featured-thread"));
    assert.equal(ids.includes("old-thread-00"), false);
    assert.equal(ids.length, 30);
  });

  it("does not label a global Candidate dump as this scan's new-project findings", () => {
    assert.equal(
      formatGmailIntakeScanNotice({
        threadCount: 30,
        threadReadCount: 30,
        unreadThreadCount: 0,
        newProjectProposalCount: 0,
        actionReviewCount: 0,
        relationshipUpdateCount: 0,
        backgroundObservationCount: 329,
      }),
      "Scanned 30 indexed threads. No new-project proposals from this scan. 329 background observations processed.",
    );
    assert.equal(
      formatGmailIntakeScanNotice({
        threadCount: 30,
        threadReadCount: 29,
        unreadThreadCount: 1,
        newProjectProposalCount: 1,
        actionReviewCount: 2,
        relationshipUpdateCount: 3,
        backgroundObservationCount: 754,
      }),
      "Scanned 30 indexed threads. 1 new project detected. 2 actions need review. 3 relationship updates. 754 background observations processed. 1 thread could not be read.",
    );
    assert.equal(
      summarizeGmailIntakeScan({
        threadCount: 30,
        unreadThreadCount: 0,
        proposed: [],
      }).newProjectProposalCount,
      0,
    );
  });

  it("counts founder attention narrowly and rolls subordinate evidence into background", () => {
    const packedProject = packGmailCandidateSourceRef({
      threadId: "t-new",
      messageId: "m-new",
    });
    const packedOther = packGmailCandidateSourceRef({
      threadId: "t-other",
      messageId: "m-other",
    });
    assert.equal(packedProject.ok, true);
    assert.equal(packedOther.ok, true);
    if (!packedProject.ok || !packedOther.ok) return;
    function row(
      input: Pick<ContinuumCandidate, "candidateId" | "candidateType" | "payload"> &
        Partial<ContinuumCandidate>,
    ): ContinuumCandidate {
      return {
        sourceSystem: "gmail",
        sourceRef: packedProject.sourceRef,
        sourceTimestamp: NOW,
        proposedTarget: { kind: "none" },
        confidence: "medium",
        evidenceBasis: { ruleIds: [], matchedText: null },
        candidateState: "active",
        reviewStatus: "pending",
        lastReviewAction: null,
        founderEditedPayload: null,
        founderEditedTarget: null,
        reviewedAt: null,
        createdAt: NOW,
        canonical: false,
        automaticApply: false,
        parserVersion: CANDIDATE_PARSER_GMAIL_V1,
        supersedesCandidateId: null,
        supersededByCandidateId: null,
        ...input,
      };
    }
    const newProject = row({
      candidateId: "np",
      candidateType: "project_context",
      payload: {
        kind: "project_context",
        topic: NEW_PROJECT_CONTEXT_TOPIC,
        value: "Matching Marquise Earrings",
      },
    });
    const spec = row({
      candidateId: "spec",
      candidateType: "structured_spec",
      payload: {
        kind: "structured_spec",
        fieldName: "metal",
        proposedValue: "14k yellow gold",
        currentValue: null,
        conflict: false,
      },
    });
    const date = row({
      candidateId: "date",
      candidateType: "date",
      payload: {
        kind: "date",
        raw: "next week",
        isoDate: null,
        precision: "unresolved",
        role: "mentioned",
        sourceTimestamp: NOW,
        resolutionCalendar: null,
      },
    });
    const personOnThread = row({
      candidateId: "person-new",
      candidateType: "person_association",
      payload: {
        kind: "person_association",
        displayName: "Abbey Castillo",
        emailHash: hashEmail("serinitybloom@gmail.com"),
        mintPerson: false,
        mergePersons: false,
      },
    });
    const standaloneJob = row({
      candidateId: "job",
      candidateType: "open_job",
      sourceRef: packedOther.sourceRef,
      payload: {
        kind: "open_job",
        jobKind: "request",
        subject: "Reply to vendor",
        detail: null,
        waitingOnActor: "founder",
        dueAt: null,
        createJob: false,
      },
    });
    const standalonePerson = row({
      candidateId: "person-other",
      candidateType: "person_association",
      sourceRef: packedOther.sourceRef,
      payload: {
        kind: "person_association",
        displayName: "Vendor",
        emailHash: hashEmail("vendor@example.test"),
        mintPerson: false,
        mergePersons: false,
      },
    });
    const threads = new Set(["t-new"]);
    assert.equal(classifyGmailIntakeAttention(newProject, threads), "new_project");
    assert.equal(classifyGmailIntakeAttention(spec, threads), "background");
    assert.equal(classifyGmailIntakeAttention(date, threads), "background");
    assert.equal(classifyGmailIntakeAttention(personOnThread, threads), "background");
    assert.equal(classifyGmailIntakeAttention(standaloneJob, threads), "action");
    assert.equal(classifyGmailIntakeAttention(standalonePerson, threads), "relationship");
    const summary = summarizeGmailIntakeScan({
      threadCount: 30,
      unreadThreadCount: 0,
      proposed: [newProject, spec, date, personOnThread, standaloneJob, standalonePerson],
    });
    assert.equal(summary.newProjectProposalCount, 1);
    assert.equal(summary.actionReviewCount, 1);
    assert.equal(summary.relationshipUpdateCount, 1);
    assert.equal(summary.backgroundObservationCount, 3);
  });

  it("surfaces Nate and Abbey real-shape proposals, keeps unresolved Person, and does not multiply on rescan", async () => {
    const nateThread = "19natefeatured001";
    const abbeyThread = "1aabbeynewpiece01";
    const nateIn = "nate-in-001";
    const nateOut = "nate-out-001";
    const abbeyIn = "abbey-in-001";
    const abbeyOut = "abbey-out-001";
    const nateNonce = "UNIQUE_BODY_NONCE_NATE_SCAN_777";
    const abbeyNonce = "UNIQUE_BODY_NONCE_ABBEY_SCAN_888";
    const index = new InMemoryGmailIndexStore();
    await index.indexMessage(
      {
        messageId: nateIn,
        threadId: nateThread,
        sentAt: "2026-09-07T15:00:00.000Z",
        subject: "Re: Featured Ring",
        fromEmail: "nate.pearl@example.test",
        direction: "inbound",
        hasAttachments: false,
      },
      NOW,
    );
    await index.indexMessage(
      {
        messageId: nateOut,
        threadId: nateThread,
        sentAt: "2026-09-07T18:00:00.000Z",
        subject: "Re: Featured Ring",
        fromEmail: "justin@hourglass.example",
        direction: "outbound",
        hasAttachments: false,
      },
      NOW,
    );
    await index.indexMessage(
      {
        messageId: abbeyIn,
        threadId: abbeyThread,
        sentAt: "2026-09-07T16:00:00.000Z",
        subject: "A new piece",
        fromEmail: "serinitybloom@gmail.com",
        direction: "inbound",
        hasAttachments: false,
      },
      NOW,
    );
    await index.indexMessage(
      {
        messageId: abbeyOut,
        threadId: abbeyThread,
        sentAt: "2026-09-07T19:00:00.000Z",
        subject: "Re: A new piece",
        fromEmail: "justin@hourglass.example",
        direction: "outbound",
        hasAttachments: false,
      },
      NOW,
    );
    const connections = new InMemoryGmailConnectionStore();
    await connections.putConnection(
      connectFounderMailbox({
        existing: null,
        mailboxEmailHash: "ab".repeat(32),
        refreshToken: encryptRefreshToken("refresh-keep", KEY),
        grantedScope: GMAIL_READONLY_SCOPE,
        providerTokenType: "Bearer",
        now: NOW,
      }),
    );
    const api = new MockGmailApi();
    api.setThread({
      id: nateThread,
      messages: [
        {
          id: nateIn,
          threadId: nateThread,
          labelIds: ["INBOX"],
          internalDate: String(Date.parse("2026-09-07T15:00:00.000Z")),
          payload: {
            mimeType: "text/plain",
            headers: [
              { name: "From", value: "Nate <nate.pearl@example.test>" },
              { name: "Subject", value: "Re: Featured Ring" },
            ],
            body: {
              data: encodeGmailBody(
                `I'd like to work together again to create another piece. I'd like a necklace/pendant based on the same dagger-draped-in-pearls artwork from the wedding ring. It's a gift for my wife. ${nateNonce}`,
              ),
              size: 40,
            },
          },
        },
        {
          id: nateOut,
          threadId: nateThread,
          labelIds: ["SENT"],
          internalDate: String(Date.parse("2026-09-07T18:00:00.000Z")),
          payload: {
            mimeType: "text/plain",
            headers: [
              { name: "From", value: "Justin <justin@hourglass.example>" },
              { name: "Subject", value: "Re: Featured Ring" },
            ],
            body: {
              data: encodeGmailBody(
                "Would you like to discuss this on a call, or should I proceed to a first render?",
              ),
              size: 40,
            },
          },
        },
      ],
    });
    api.setThread({
      id: abbeyThread,
      messages: [
        {
          id: abbeyIn,
          threadId: abbeyThread,
          labelIds: ["INBOX"],
          internalDate: String(Date.parse("2026-09-07T16:00:00.000Z")),
          payload: {
            mimeType: "text/plain",
            headers: [
              { name: "From", value: "Abbey Castillo <serinitybloom@gmail.com>" },
              { name: "Subject", value: "A new piece" },
            ],
            body: {
              data: encodeGmailBody(
                `I'm reaching back out to ask about a new piece I'd like designed. Matching marquise dangle/hoop earrings, a pair of marquise lab-grown diamonds approximately 1 ct each, similar quality/brightness, 14k yellow gold, locking/secure back, possible flower detail. ${abbeyNonce}`,
              ),
              size: 40,
            },
          },
        },
        {
          id: abbeyOut,
          threadId: abbeyThread,
          labelIds: ["SENT"],
          internalDate: String(Date.parse("2026-09-07T19:00:00.000Z")),
          payload: {
            mimeType: "text/plain",
            headers: [
              { name: "From", value: "Justin <justin@hourglass.example>" },
              { name: "Subject", value: "Re: A new piece" },
            ],
            body: {
              data: encodeGmailBody(
                "Would you prefer a plain yellow-gold flower or a diamond center? Also modular huggie vs standard drop construction?",
              ),
              size: 40,
            },
          },
        },
      ],
    });
    const store = new InMemoryCandidateStore();
    const scanInput = {
      founderSessionOk: true,
      index,
      connections,
      decryptRefreshToken: () => "refresh-keep",
      refreshAccessToken: async () => ({ ok: true as const, accessToken: "access" }),
      createApi: () => api,
      world: {
        people: [
          {
            personId: "abbey-wagner",
            displayName: "Abbey Wagner",
            emailHash: hashEmail("abbey.wagner@example.test"),
            role: "client" as const,
            projectIds: [],
          },
        ],
        projects: [],
        internalEmailHashes: [hashEmail("justin@hourglass.example")!],
      },
      store,
      nowIso: NOW,
    };
    const first = await runGmailNewProjectIntakeScan(scanInput);
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const selected = await recentIndexedThreadIds(index, 30);
    assert.ok(selected.includes(nateThread));
    assert.ok(selected.includes(abbeyThread));
    assert.equal(first.newProjectProposalCount, 2);
    assert.equal(first.unreadThreadCount, 0);
    assert.equal(typeof first.backgroundObservationCount, "number");
    assert.ok(first.backgroundObservationCount > 0);
    assert.equal(first.actionReviewCount, 0);
    const rows = await store.list();
    const serialized = JSON.stringify(rows);
    assert.equal(serialized.includes(nateNonce), false);
    assert.equal(serialized.includes(abbeyNonce), false);
    const titles = rows
      .filter(
        (row) =>
          row.payload.kind === "project_context" &&
          row.payload.topic === NEW_PROJECT_CONTEXT_TOPIC,
      )
      .map((row) => (row.payload.kind === "project_context" ? row.payload.value : ""));
    assert.ok(titles.includes("Dagger & Pearls Pendant / Necklace"));
    assert.ok(titles.includes("Matching Marquise Earrings"));
    assert.equal(
      rows.some(
        (row) =>
          row.payload.kind === "project_context" &&
          row.payload.topic === WAITING_ON_CLIENT_TOPIC,
      ),
      true,
    );
    const waitingValues = rows
      .filter(
        (row) =>
          row.payload.kind === "project_context" &&
          row.payload.topic === WAITING_ON_CLIENT_TOPIC,
      )
      .map((row) =>
        row.payload.kind === "project_context" ? row.payload.value : "",
      );
    assert.ok(waitingValues.every((value) => value.length < 80));
    assert.equal(
      waitingValues.every((value) =>
        value === "call or first render" || value === "design question",
      ),
      true,
    );
    assert.equal(rows.some((row) => row.candidateType === "open_job"), false);
    assert.equal(
      rows.some(
        (row) =>
          row.proposedTarget.kind === "person" &&
          row.proposedTarget.personId === "abbey-wagner",
      ),
      false,
    );
    const abbeyPerson = rows.find(
      (row) =>
        row.candidateType === "person_association" &&
        row.sourceRef.includes(abbeyThread),
    );
    if (abbeyPerson?.proposedTarget.kind === "person") {
      assert.equal(abbeyPerson.proposedTarget.personId, null);
    }
    if (abbeyPerson?.payload.kind === "person_association") {
      assert.notEqual(abbeyPerson.payload.displayName, "Abbey Wagner");
    }
    const nateProject = rows.find(
      (row) =>
        row.payload.kind === "project_context" &&
        row.payload.topic === NEW_PROJECT_CONTEXT_TOPIC &&
        row.payload.value === "Dagger & Pearls Pendant / Necklace",
    );
    assert.ok(nateProject);
    await store.applyReview(nateProject.candidateId, { action: "defer" }, NOW);
    const second = await runGmailNewProjectIntakeScan(scanInput);
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.deepEqual(second.insertedIds, []);
    assert.equal(second.duplicateIds.length, first.insertedIds.length);
    assert.equal(second.newProjectProposalCount, first.newProjectProposalCount);
    assert.equal((await store.list()).length, first.insertedIds.length);
    const after = await store.get(nateProject!.candidateId);
    assert.equal(after?.reviewStatus, "deferred");
    assert.equal(api.calls.some((call) => call.method === "listMessages"), false);
    assert.equal(api.calls.some((call) => call.method === "listHistory"), false);
  });

  it("fetches related jewelry threads for a transactional notice without counting them as scanned", async () => {
    const payThread = "19paythread000001";
    const ringThread = "19ringthread00001";
    const payMessage = "19paymsg000000001";
    const ringMessage = "19ringmsg00000001";
    const ringNonce = "UNIQUE_BODY_NONCE_RING_222";
    const index = new InMemoryGmailIndexStore();
    await index.indexMessage(
      {
        messageId: payMessage,
        threadId: payThread,
        sentAt: "2026-09-08T18:00:00.000Z",
        subject: "Payment received Invoice 1215",
        fromEmail: "notifications@intuit.com",
        direction: "inbound",
        hasAttachments: false,
      },
      NOW,
    );
    await index.indexMessage(
      {
        messageId: ringMessage,
        threadId: ringThread,
        sentAt: "2026-08-10T15:00:00.000Z",
        subject: "Engagement Ring",
        fromEmail: "morgan.ellis@example.test",
        direction: "inbound",
        hasAttachments: false,
      },
      NOW,
    );
    const connections = new InMemoryGmailConnectionStore();
    await connections.putConnection(
      connectFounderMailbox({
        existing: null,
        mailboxEmailHash: "ab".repeat(32),
        refreshToken: encryptRefreshToken("refresh-keep", KEY),
        grantedScope: GMAIL_READONLY_SCOPE,
        providerTokenType: "Bearer",
        now: NOW,
      }),
    );
    const api = new MockGmailApi();
    api.setThread({
      id: payThread,
      messages: [
        {
          id: payMessage,
          threadId: payThread,
          labelIds: ["INBOX"],
          internalDate: String(Date.parse("2026-09-08T18:00:00.000Z")),
          payload: {
            mimeType: "text/plain",
            headers: [
              { name: "From", value: "QuickBooks <notifications@intuit.com>" },
              { name: "Subject", value: "Payment received Invoice 1215" },
            ],
            body: {
              data: encodeGmailBody(
                "Invoice #1215-(Morgan Ellis)\nCustomer: Morgan Ellis\nAmount: $3,183.90\nPayment received\nmorgan.ellis@example.test",
              ),
              size: 40,
            },
          },
        },
      ],
    });
    api.setThread({
      id: ringThread,
      messages: [
        {
          id: ringMessage,
          threadId: ringThread,
          labelIds: ["INBOX"],
          internalDate: String(Date.parse("2026-08-10T15:00:00.000Z")),
          payload: {
            mimeType: "text/plain",
            headers: [
              { name: "From", value: "Morgan <morgan.ellis@example.test>" },
              { name: "Subject", value: "Engagement Ring" },
            ],
            body: {
              data: encodeGmailBody(
                `I'm planning to propose and wanted to talk about an engagement ring. ${ringNonce}`,
              ),
              size: 40,
            },
          },
        },
      ],
    });
    const store = new InMemoryCandidateStore();
    const result = await runGmailNewProjectIntakeScan({
      founderSessionOk: true,
      index,
      connections,
      decryptRefreshToken: () => "refresh-keep",
      refreshAccessToken: async () => ({ ok: true, accessToken: "access" }),
      createApi: () => api,
      world: { people: [], projects: [], internalEmailHashes: [] },
      store,
      nowIso: NOW,
      threadIds: [payThread],
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.threadCount, 1);
    assert.equal(result.gmailMutation, false);
    assert.equal(api.calls.some((call) => call.method === "listMessages"), false);
    assert.equal(
      api.calls.some((call) => call.method === "getThread" && call.threadId === payThread),
      true,
    );
    assert.equal(
      api.calls.some((call) => call.method === "getThread" && call.threadId === ringThread),
      true,
    );
    const rows = await store.list();
    assert.equal(JSON.stringify(rows).includes(ringNonce), false);
    assert.equal(
      rows.some(
        (row) =>
          row.payload.kind === "project_context" &&
          row.payload.topic === NEW_PROJECT_CONTEXT_TOPIC &&
          row.evidenceBasis.ruleIds.includes(TRANSACTIONAL_CUSTOMER_NOTICE_RULE),
      ),
      true,
    );
    const related = await relatedCommercialThreadIds(
      index,
      [
        {
          indexed: (await index.getMessage(payMessage))!,
          plaintext:
            "Invoice #1215-(Morgan Ellis)\nCustomer: Morgan Ellis\nPayment received\nmorgan.ellis@example.test",
          fromEmailHash: hashEmail("notifications@intuit.com"),
          attachments: [],
        },
      ],
      new Set([payThread]),
    );
    assert.deepEqual(related, [ringThread]);
  });
});
