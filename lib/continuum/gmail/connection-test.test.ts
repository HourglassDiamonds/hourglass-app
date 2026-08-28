import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { MockGmailApi } from "./adapter";
import {
  connectFounderMailbox,
  InMemoryGmailConnectionStore,
  type GmailConnectionStore,
} from "./connection";
import {
  CONCIERGE_GMAIL_PATH,
  GMAIL_CONNECTION_TEST_MAX_RESULTS,
  GMAIL_CONNECTION_TEST_QUERY,
  GMAIL_CONNECTION_TEST_RESULT_KEYS,
  failedGmailConnectionTest,
  gmailConnectionTestResultKeys,
  readOnlyGmailConnectionStore,
  runGmailConnectionTest,
  sanitizeGmailConnectionTestResult,
  type GmailConnectionTestResult,
} from "./connection-test";
import type { GmailAccessTokenRefresh } from "./oauth";
import { decryptRefreshToken, encryptRefreshToken } from "./token-crypto";
import { GMAIL_READONLY_SCOPE, type GmailConnection } from "./types";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const KEY = Buffer.from("c".repeat(64), "hex");
const FOUNDER = "founder@hourglass.example";
const NOW = "2026-08-27T16:00:00.000Z";
const ACCESS = "access-in-memory-only";

class RecordingStore implements GmailConnectionStore {
  writes = 0;
  lastWritten: GmailConnection | null = null;

  constructor(private readonly inner: InMemoryGmailConnectionStore) {}

  getFounderConnection() {
    return this.inner.getFounderConnection();
  }

  async putConnection(row: GmailConnection) {
    this.writes += 1;
    this.lastWritten = row;
    return this.inner.putConnection(row);
  }
}

async function connectedStore(
  extras: Partial<GmailConnection> = {},
): Promise<{
  inner: InMemoryGmailConnectionStore;
  store: RecordingStore;
}> {
  const inner = new InMemoryGmailConnectionStore();
  const wrapped = encryptRefreshToken("refresh-keep", KEY);
  await inner.putConnection({
    ...connectFounderMailbox({
      existing: null,
      mailboxEmailHash: "ab".repeat(32),
      refreshToken: wrapped,
      grantedScope: GMAIL_READONLY_SCOPE,
      providerTokenType: "Bearer",
      now: NOW,
    }),
    lastSyncAt: null,
    ...extras,
  });
  return { inner, store: new RecordingStore(inner) };
}

function refreshOk(): (
  refreshToken: string,
) => Promise<GmailAccessTokenRefresh> {
  return async () => ({ ok: true, accessToken: ACCESS });
}

function assertSafeOutput(
  result: GmailConnectionTestResult,
  serialized = JSON.stringify(result),
) {
  assert.deepEqual(gmailConnectionTestResultKeys(result), GMAIL_CONNECTION_TEST_RESULT_KEYS);
  assert.equal(serialized.includes(FOUNDER), false);
  assert.equal(serialized.includes("other@example.com"), false);
  assert.equal(serialized.includes("refresh-keep"), false);
  assert.equal(serialized.includes(ACCESS), false);
  assert.equal(serialized.includes("msg-"), false);
  assert.equal(serialized.includes("thread-"), false);
  assert.equal(serialized.includes("Anniversary"), false);
  assert.equal(serialized.includes("ciphertext"), false);
  assert.doesNotMatch(serialized, /[0-9a-f]{64}/i);
}

describe("Gmail founder zero-write connection test", () => {
  it("requires founder auth and makes no Gmail or DB calls", async () => {
    const api = new MockGmailApi();
    const { store } = await connectedStore();
    const result = await runGmailConnectionTest({
      founderSessionOk: false,
      connections: store,
      decryptRefreshToken: (wrapped) => decryptRefreshToken(wrapped, KEY),
      refreshAccessToken: refreshOk(),
      createApi: () => api,
      founderEmail: FOUNDER,
    });
    assert.deepEqual(result, failedGmailConnectionTest("unauthorized"));
    assert.equal(api.calls.length, 0);
    assert.equal(store.writes, 0);
    const row = await store.getFounderConnection();
    assert.equal(row?.lastSyncAt, null);
    assertSafeOutput(result);
  });

  it("returns gmail-not-connected when no founder row exists", async () => {
    const api = new MockGmailApi();
    const store = new RecordingStore(new InMemoryGmailConnectionStore());
    const result = await runGmailConnectionTest({
      founderSessionOk: true,
      connections: store,
      decryptRefreshToken: () => "refresh-keep",
      refreshAccessToken: refreshOk(),
      createApi: () => api,
      founderEmail: FOUNDER,
    });
    assert.equal(result.safeErrorCode, "gmail-not-connected");
    assert.equal(result.connectionVerified, false);
    assert.equal(api.calls.length, 0);
    assert.equal(store.writes, 0);
  });

  it("returns gmail-not-connected when status is not connected", async () => {
    const api = new MockGmailApi();
    const { store } = await connectedStore({ status: "paused" });
    const result = await runGmailConnectionTest({
      founderSessionOk: true,
      connections: store,
      decryptRefreshToken: () => {
        throw new Error("should-not-decrypt");
      },
      refreshAccessToken: refreshOk(),
      createApi: () => api,
      founderEmail: FOUNDER,
    });
    assert.equal(result.safeErrorCode, "gmail-not-connected");
    assert.equal(api.calls.length, 0);
    assert.equal(store.writes, 0);
  });

  it("decrypts a connected encrypted credential and lists five recent ids", async () => {
    const api = new MockGmailApi();
    api.setProfile({ emailAddress: FOUNDER });
    api.setListPage(null, {
      messages: [
        { id: "msg-1", threadId: "thread-1" },
        { id: "msg-2", threadId: "thread-2" },
        { id: "msg-3", threadId: "thread-3" },
        { id: "msg-4", threadId: "thread-4" },
        { id: "msg-5", threadId: "thread-5" },
      ],
      nextPageToken: null,
      resultSizeEstimate: 42,
    });
    const { store } = await connectedStore();
    const decrypted: string[] = [];
    const result = await runGmailConnectionTest({
      founderSessionOk: true,
      connections: store,
      decryptRefreshToken: (wrapped) => {
        const token = decryptRefreshToken(wrapped, KEY);
        decrypted.push(token);
        return token;
      },
      refreshAccessToken: async (refreshToken) => {
        assert.equal(refreshToken, "refresh-keep");
        return { ok: true, accessToken: ACCESS };
      },
      createApi: (accessToken) => {
        assert.equal(accessToken, ACCESS);
        return api;
      },
      founderEmail: FOUNDER,
    });
    assert.deepEqual(decrypted, ["refresh-keep"]);
    assert.equal(result.connectionVerified, true);
    assert.equal(result.mailboxVerified, true);
    assert.equal(result.querySucceeded, true);
    assert.equal(result.resultSizeEstimate, 42);
    assert.equal(result.returnedIdCount, 5);
    assert.equal(result.labelsAvailableFromListResponse, false);
    assert.equal(result.safeErrorCode, null);
    const list = api.calls.find((call) => call.method === "listMessages");
    assert.ok(list && list.method === "listMessages");
    assert.equal(list.q, GMAIL_CONNECTION_TEST_QUERY);
    assert.equal(list.q, "(in:inbox OR in:sent) newer_than:7d");
    assert.equal(list.maxResults, GMAIL_CONNECTION_TEST_MAX_RESULTS);
    assert.equal(list.maxResults, 5);
    assert.equal(
      api.calls.filter((call) => call.method === "getMessage").length,
      0,
    );
    assert.equal(
      api.calls.filter((call) => call.method === "getThread").length,
      0,
    );
    api.assertNeverFetchedAttachmentBytes();
    assert.equal(store.writes, 0);
    assert.equal((await store.getFounderConnection())?.lastSyncAt, null);
    assertSafeOutput(result);
  });

  it("treats missing list labels as pass-compatible", async () => {
    const api = new MockGmailApi();
    api.setProfile({ emailAddress: FOUNDER });
    api.setListPage(null, {
      messages: [{ id: "msg-1", threadId: "thread-1" }],
      nextPageToken: null,
    });
    const { store } = await connectedStore();
    const result = await runGmailConnectionTest({
      founderSessionOk: true,
      connections: store,
      decryptRefreshToken: (wrapped) => decryptRefreshToken(wrapped, KEY),
      refreshAccessToken: refreshOk(),
      createApi: () => api,
      founderEmail: FOUNDER,
    });
    assert.equal(result.querySucceeded, true);
    assert.equal(result.labelsAvailableFromListResponse, false);
    assert.equal(result.safeErrorCode, null);
  });

  it("returns decrypt-failed without Gmail calls or writes", async () => {
    const api = new MockGmailApi();
    const { store } = await connectedStore();
    const result = await runGmailConnectionTest({
      founderSessionOk: true,
      connections: store,
      decryptRefreshToken: () => {
        throw new Error("token-alg-invalid");
      },
      refreshAccessToken: refreshOk(),
      createApi: () => api,
      founderEmail: FOUNDER,
    });
    assert.equal(result.safeErrorCode, "decrypt-failed");
    assert.equal(result.connectionVerified, false);
    assert.equal(api.calls.length, 0);
    assert.equal(store.writes, 0);
  });

  it("returns token-refresh-failed without profile or list calls", async () => {
    const api = new MockGmailApi();
    const { store } = await connectedStore();
    const result = await runGmailConnectionTest({
      founderSessionOk: true,
      connections: store,
      decryptRefreshToken: (wrapped) => decryptRefreshToken(wrapped, KEY),
      refreshAccessToken: async () => ({
        ok: false,
        error: "token-refresh-failed",
      }),
      createApi: () => api,
      founderEmail: FOUNDER,
    });
    assert.equal(result.safeErrorCode, "token-refresh-failed");
    assert.equal(api.calls.length, 0);
    assert.equal(store.writes, 0);
  });

  it("stops without persisting when Google rotates the refresh token", async () => {
    const api = new MockGmailApi();
    const { store } = await connectedStore();
    const result = await runGmailConnectionTest({
      founderSessionOk: true,
      connections: store,
      decryptRefreshToken: (wrapped) => decryptRefreshToken(wrapped, KEY),
      refreshAccessToken: async () => ({
        ok: false,
        error: "refresh-token-rotated",
      }),
      createApi: () => api,
      founderEmail: FOUNDER,
    });
    assert.equal(result.safeErrorCode, "refresh-token-rotated");
    assert.equal(api.calls.length, 0);
    assert.equal(store.writes, 0);
    assert.equal((await store.getFounderConnection())?.lastSyncAt, null);
  });

  it("verifies users.getProfile success and mailbox mismatch without listing", async () => {
    const api = new MockGmailApi();
    api.setProfile({ emailAddress: "other@example.com" });
    const { store } = await connectedStore();
    const result = await runGmailConnectionTest({
      founderSessionOk: true,
      connections: store,
      decryptRefreshToken: (wrapped) => decryptRefreshToken(wrapped, KEY),
      refreshAccessToken: refreshOk(),
      createApi: () => api,
      founderEmail: FOUNDER,
    });
    assert.equal(result.connectionVerified, true);
    assert.equal(result.mailboxVerified, false);
    assert.equal(result.querySucceeded, false);
    assert.equal(result.safeErrorCode, "gmail-wrong-mailbox");
    assert.deepEqual(
      api.calls.map((call) => call.method),
      ["getProfile"],
    );
    assert.equal(store.writes, 0);
    assertSafeOutput(result);
  });

  it("never calls getMessage, getThread, or attachments.get", async () => {
    const api = new MockGmailApi();
    api.setProfile({ emailAddress: FOUNDER });
    api.setListPage(null, {
      messages: [
        { id: "msg-inbox-1", threadId: "thread-sarah-1" },
        { id: "msg-sent-1", threadId: "thread-sarah-1" },
      ],
      nextPageToken: "should-not-follow",
      resultSizeEstimate: 9,
    });
    const { store } = await connectedStore();
    const result = await runGmailConnectionTest({
      founderSessionOk: true,
      connections: store,
      decryptRefreshToken: (wrapped) => decryptRefreshToken(wrapped, KEY),
      refreshAccessToken: refreshOk(),
      createApi: () => api,
      founderEmail: FOUNDER,
    });
    assert.equal(result.querySucceeded, true);
    assert.equal(result.returnedIdCount, 2);
    assert.equal(
      api.calls.some((call) => call.method === "getMessage"),
      false,
    );
    assert.equal(
      api.calls.some((call) => call.method === "getThread"),
      false,
    );
    api.assertNeverFetchedAttachmentBytes();
    assert.equal(store.writes, 0);
    assert.doesNotMatch(JSON.stringify(result), /msg-inbox-1|thread-sarah-1/);
  });

  it("makes zero connection writes and does not update last_sync_at", async () => {
    const api = new MockGmailApi();
    api.setProfile({ emailAddress: FOUNDER });
    api.setListPage(null, { messages: [], nextPageToken: null });
    const { store } = await connectedStore();
    const before = await store.getFounderConnection();
    await runGmailConnectionTest({
      founderSessionOk: true,
      connections: readOnlyGmailConnectionStore(store),
      decryptRefreshToken: (wrapped) => decryptRefreshToken(wrapped, KEY),
      refreshAccessToken: refreshOk(),
      createApi: () => api,
      founderEmail: FOUNDER,
    });
    assert.equal(store.writes, 0);
    const after = await store.getFounderConnection();
    assert.equal(after?.lastSyncAt, before?.lastSyncAt ?? null);
    assert.equal(after?.updatedAt, before?.updatedAt);
    assert.equal(after?.status, "connected");
  });

  it("keeps sanitized keys only", () => {
    const dirty = sanitizeGmailConnectionTestResult({
      connectionVerified: true,
      mailboxVerified: true,
      querySucceeded: true,
      resultSizeEstimate: Number.NaN,
      returnedIdCount: 99,
      labelsAvailableFromListResponse: true,
      safeErrorCode: "gmail-wrong-mailbox",
    });
    assert.equal(dirty.returnedIdCount, 5);
    assert.equal(dirty.resultSizeEstimate, null);
    assert.deepEqual(Object.keys(dirty).sort(), GMAIL_CONNECTION_TEST_RESULT_KEYS);
  });

  it("does not log PII or tokens in the probe, action, or UI", () => {
    const files = [
      join(ROOT, "lib/continuum/gmail/connection-test.ts"),
      join(ROOT, "lib/continuum/gmail/oauth.ts"),
      join(ROOT, "app/executive-dashboard/concierge/gmail-actions.ts"),
      join(ROOT, "app/executive-dashboard/concierge/gmail/page.tsx"),
      join(
        ROOT,
        "app/executive-dashboard/concierge/components/gmail-connection-test.tsx",
      ),
      join(
        ROOT,
        "app/executive-dashboard/concierge/components/command-center-home.tsx",
      ),
    ];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
      assert.doesNotMatch(source, /runHistoricalSync|indexMessage|putCheckpoint/);
      assert.doesNotMatch(source, /\.getMessage\(|\.getThread\(/);
      assert.doesNotMatch(source, /attachments\.get|\/attachments\//);
      assert.doesNotMatch(source, /formData\.get\([`'"]q[`'"]\)/);
      assert.doesNotMatch(source, /formData\.get\([`'"]mailbox/);
    }
    const probe = readFileSync(
      join(ROOT, "lib/continuum/gmail/connection-test.ts"),
      "utf8",
    );
    assert.match(probe, /GMAIL_CONNECTION_TEST_MAX_RESULTS = 5/);
    assert.match(
      probe,
      /\(in:inbox OR in:sent\) newer_than:7d/,
    );
    assert.doesNotMatch(probe, /putConnection\(/);
    assert.doesNotMatch(probe, /lastSyncAt:/);
    assert.doesNotMatch(probe, /applyPause|applyResume|applyDisconnect|applyInvalidGrant/);
    assert.match(probe, /CONCIERGE_GMAIL_PATH/);
    assert.equal(CONCIERGE_GMAIL_PATH, "/executive-dashboard/concierge/gmail");
  });
});
