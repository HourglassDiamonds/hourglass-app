import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InMemoryCandidateStore } from "@/lib/continuum/candidates/store";
import { InMemoryGmailIndexStore } from "@/lib/continuum/client-memory/gmail/store";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import { MockGmailApi, GmailHttpError } from "./adapter";
import { connectFounderMailbox, InMemoryGmailConnectionStore } from "./connection";
import { encodeGmailBody } from "./exact-thread-fixtures";
import { runGmailNewProjectIntakeScan } from "./intake-scan";
import { encryptRefreshToken } from "./token-crypto";
import { GMAIL_READONLY_SCOPE, type GmailApiThread } from "./types";
import { NEW_PROJECT_CONTEXT_TOPIC } from "./candidates/new-project";

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
});
