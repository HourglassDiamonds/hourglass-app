import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { InMemoryCandidateStore } from "@/lib/continuum/candidates/store";
import { InMemoryGmailIndexStore } from "@/lib/continuum/client-memory/gmail/store";
import { GMAIL_SOURCE_SYSTEM } from "@/lib/continuum/client-memory/gmail/types";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import { evidenceFromIndexed } from "./candidates/types";
import type { GmailCandidateEvidence, GmailCandidateWorld } from "./candidates/types";
import {
  packGmailReconstructionCursor,
  parseGmailReconstructionCursor,
  runHistoricalGmailReconstructionChunk,
  selectHistoricalReconstructionThreads,
  GMAIL_RECONSTRUCTION_MAX_THREADS,
} from "./historical-reconstruction";
import { GMAIL_HISTORICAL_JOB_KEY } from "./types";

const NOW = "2026-09-10T12:00:00.000Z";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function world(): GmailCandidateWorld {
  return { people: [], projects: [], internalEmailHashes: [] };
}

function indexInput(input: {
  messageId: string;
  threadId: string;
  sentAt: string;
  fromEmail?: string;
  subject?: string;
  direction?: "inbound" | "outbound";
  plaintext?: string;
}) {
  return {
    messageId: input.messageId,
    threadId: input.threadId,
    sentAt: input.sentAt,
    subject: input.subject ?? "CAD CR5001024 finger size 11",
    fromEmail: input.fromEmail ?? "lee@client.test",
    toEmails: ["justin@hourglass.test"],
    direction: input.direction ?? "inbound" as const,
    labelIds: ["INBOX"],
    hasAttachments: false,
    plaintext: input.plaintext ?? "Please change finger size to 11 CAD CR5001024",
  };
}

describe("Historical Gmail reconstruction foundation", () => {
  it("packs and parses a resumable cursor without guessing", () => {
    const packed = packGmailReconstructionCursor({
      version: "gr1",
      sentAt: "2024-01-02T15:00:00.000Z",
      threadId: "aaaaaaaaaa",
    });
    assert.equal(packed, "gr1|2024-01-02T15:00:00.000Z|aaaaaaaaaa");
    assert.deepEqual(parseGmailReconstructionCursor(packed), {
      version: "gr1",
      sentAt: "2024-01-02T15:00:00.000Z",
      threadId: "aaaaaaaaaa",
    });
    assert.equal(parseGmailReconstructionCursor("gr1|done")?.done, true);
    assert.equal(parseGmailReconstructionCursor("gr1|not-an-iso|aaaaaaaaaa"), null);
    assert.equal(parseGmailReconstructionCursor("gr1|2024-01-02T15:00:00.000Z|a@b.com"), null);
  });

  it("selects oldest indexed threads first and resumes after the cursor", () => {
    const messages = [
      {
        messageId: "m3",
        threadId: "cccccccccc",
        sentAt: "2026-03-01T00:00:00.000Z",
        indexedAt: NOW,
        subject: null,
        fromEmailHash: null,
        toEmailHashes: [],
        ccEmailHashes: [],
        bccEmailHashes: [],
        direction: "inbound" as const,
        labelIds: [],
        hasAttachments: false,
        sourceSystem: GMAIL_SOURCE_SYSTEM,
      },
      {
        messageId: "m1",
        threadId: "aaaaaaaaaa",
        sentAt: "2025-01-01T00:00:00.000Z",
        indexedAt: NOW,
        subject: null,
        fromEmailHash: null,
        toEmailHashes: [],
        ccEmailHashes: [],
        bccEmailHashes: [],
        direction: "inbound" as const,
        labelIds: [],
        hasAttachments: false,
        sourceSystem: GMAIL_SOURCE_SYSTEM,
      },
      {
        messageId: "m2",
        threadId: "bbbbbbbbbb",
        sentAt: "2025-06-01T00:00:00.000Z",
        indexedAt: NOW,
        subject: null,
        fromEmailHash: null,
        toEmailHashes: [],
        ccEmailHashes: [],
        bccEmailHashes: [],
        direction: "inbound" as const,
        labelIds: [],
        hasAttachments: false,
        sourceSystem: GMAIL_SOURCE_SYSTEM,
      },
    ];
    const first = selectHistoricalReconstructionThreads({
      messages,
      limit: 2,
    });
    assert.deepEqual(first.threadIds, ["aaaaaaaaaa", "bbbbbbbbbb"]);
    assert.equal(first.completed, false);
    const second = selectHistoricalReconstructionThreads({
      messages,
      cursor: first.nextCursor,
      limit: 2,
    });
    assert.deepEqual(second.threadIds, ["cccccccccc"]);
    assert.equal(second.completed, true);
    assert.equal(parseGmailReconstructionCursor(second.nextCursor)?.done, true);
  });

  it("hydrates Candidates from a bounded historical sample without minting People or Projects", async () => {
    const index = new InMemoryGmailIndexStore();
    const store = new InMemoryCandidateStore();
    const bodies = new Map<string, string>();
    for (const row of [
      indexInput({
        messageId: "bbbbbbbbbb",
        threadId: "aaaaaaaaaa",
        sentAt: "2025-02-01T12:00:00.000Z",
      }),
      indexInput({
        messageId: "dddddddddd",
        threadId: "cccccccccc",
        sentAt: "2025-03-01T12:00:00.000Z",
        plaintext: "Can you design a new necklace for me?",
        subject: "New design request",
      }),
    ]) {
      await index.indexMessage(row, NOW);
      bodies.set(row.threadId, row.plaintext);
    }

    const fetchEvidence = async (
      threadIds: readonly string[],
    ): Promise<{ ok: true; evidence: GmailCandidateEvidence[] }> => {
      const evidence: GmailCandidateEvidence[] = [];
      for (const threadId of threadIds) {
        const rows = await index.listMessagesByThread(threadId);
        for (const indexed of rows) {
          evidence.push({
            ...evidenceFromIndexed(indexed),
            plaintext: bodies.get(threadId) ?? null,
            fromEmailHash: indexed.fromEmailHash ?? hashEmail("lee@client.test"),
          });
        }
      }
      return { ok: true, evidence };
    };

    const first = await runHistoricalGmailReconstructionChunk({
      founderSessionOk: true,
      index,
      store,
      world: world(),
      nowIso: NOW,
      fetchEvidence,
      maxThreads: 1,
    });
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(first.threadCount, 1);
    assert.equal(first.completed, false);
    assert.equal(first.mintedPeople, false);
    assert.equal(first.mintedProjects, false);
    assert.ok(first.insertedCount > 0);

    const before = (await store.list()).length;
    const second = await runHistoricalGmailReconstructionChunk({
      founderSessionOk: true,
      index,
      store,
      world: world(),
      nowIso: NOW,
      fetchEvidence,
      cursor: first.cursor,
      maxThreads: 1,
    });
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.completed, true);
    const again = await runHistoricalGmailReconstructionChunk({
      founderSessionOk: true,
      index,
      store,
      world: world(),
      nowIso: NOW,
      fetchEvidence,
      cursor: first.cursor,
      maxThreads: 1,
    });
    assert.equal(again.ok, true);
    if (!again.ok) return;
    assert.equal(again.duplicateCount > 0 || again.insertedCount === 0, true);
    assert.equal((await store.list()).every((row) => row.canonical === false), true);
    assert.equal((await store.list()).every((row) => row.automaticApply === false), true);
    assert.ok((await store.list()).length >= before);
    assert.ok(GMAIL_RECONSTRUCTION_MAX_THREADS <= 5);
  });

  it("persists the reconstruction cursor on a completed historical index checkpoint", async () => {
    const index = new InMemoryGmailIndexStore();
    const store = new InMemoryCandidateStore();
    await index.indexMessage(
      indexInput({
        messageId: "bbbbbbbbbb",
        threadId: "aaaaaaaaaa",
        sentAt: "2025-02-01T12:00:00.000Z",
      }),
      NOW,
    );
    await index.putCheckpoint({
      jobKey: GMAIL_HISTORICAL_JOB_KEY,
      status: "completed",
      windowStart: "2024-01-01T00:00:00.000Z",
      windowEnd: NOW,
      pageToken: null,
      historyId: null,
      cursorMessageId: "bbbbbbbbbb",
      indexedCount: 1,
      updatedAt: NOW,
      errorCode: null,
    });
    const result = await runHistoricalGmailReconstructionChunk({
      founderSessionOk: true,
      index,
      store,
      world: world(),
      nowIso: NOW,
      fetchEvidence: async (threadIds) => ({
        ok: true,
        evidence: (await index.listMessagesByThread(threadIds[0]!)).map((row) => ({
          ...evidenceFromIndexed(row),
          plaintext: "Please change finger size to 11 CAD CR5001024",
        })),
      }),
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.persistedCursor, true);
    const checkpoint = await index.getCheckpoint(GMAIL_HISTORICAL_JOB_KEY);
    assert.equal(checkpoint?.status, "completed");
    assert.equal(checkpoint?.pageToken, null);
    assert.equal(checkpoint?.historyId, result.cursor);
    assert.ok(checkpoint?.historyId?.startsWith("gr1|"));
  });

  it("does not persist a cursor onto an in-progress historical backfill", async () => {
    const index = new InMemoryGmailIndexStore();
    const store = new InMemoryCandidateStore();
    await index.indexMessage(
      indexInput({
        messageId: "bbbbbbbbbb",
        threadId: "aaaaaaaaaa",
        sentAt: "2025-02-01T12:00:00.000Z",
      }),
      NOW,
    );
    await index.putCheckpoint({
      jobKey: GMAIL_HISTORICAL_JOB_KEY,
      status: "running",
      windowStart: "2024-01-01T00:00:00.000Z",
      windowEnd: NOW,
      pageToken: "gmail-page-2",
      historyId: null,
      cursorMessageId: "bbbbbbbbbb",
      indexedCount: 1,
      updatedAt: NOW,
      errorCode: null,
    });
    const result = await runHistoricalGmailReconstructionChunk({
      founderSessionOk: true,
      index,
      store,
      world: world(),
      nowIso: NOW,
      fetchEvidence: async () => ({ ok: true, evidence: [] }),
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.persistedCursor, false);
    assert.equal((await index.getCheckpoint(GMAIL_HISTORICAL_JOB_KEY))?.pageToken, "gmail-page-2");
    assert.equal((await index.getCheckpoint(GMAIL_HISTORICAL_JOB_KEY))?.historyId, null);
  });

  it("fails closed without founder session or secret protection", async () => {
    const result = await runHistoricalGmailReconstructionChunk({
      founderSessionOk: false,
      index: new InMemoryGmailIndexStore(),
      store: new InMemoryCandidateStore(),
      world: world(),
      nowIso: NOW,
      fetchEvidence: async () => ({ ok: true, evidence: [] }),
    });
    assert.deepEqual(result, { ok: false, safeErrorCode: "unauthorized" });
  });

  it("stays off cron and public API", () => {
    const vercel = readFileSync(join(ROOT, "vercel.json"), "utf8");
    assert.doesNotMatch(vercel, /historical-reconstruction|gmail-reconstruction/);
    const reconstruction = readFileSync(
      join(ROOT, "lib/continuum/gmail/historical-reconstruction.ts"),
      "utf8",
    );
    assert.doesNotMatch(reconstruction, /createPersonAtomic|writesPersons: true/);
  });
});
