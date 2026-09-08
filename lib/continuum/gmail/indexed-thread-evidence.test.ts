import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { GmailHttpError, MockGmailApi } from "./adapter";
import { exactThreadOnlyApi } from "./exact-thread";
import { encodeGmailBody } from "./exact-thread-fixtures";
import { runIndexedThreadEvidenceFetch } from "./indexed-thread-evidence";
import { InMemoryGmailIndexStore } from "@/lib/continuum/client-memory/gmail/store";
import { InMemoryGmailConnectionStore, connectFounderMailbox } from "./connection";
import { encryptRefreshToken } from "./token-crypto";
import { GMAIL_READONLY_SCOPE, type GmailApiThread } from "./types";

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, "../../..");
const KEY = Buffer.from("c".repeat(64), "hex");
const NOW = "2026-09-08T12:00:00.000Z";
const THREAD = "19natenewproj001";
const MESSAGE = "19natenewmsg0001";

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
              "I'd like to work together again to create another piece.",
            ),
            size: 20,
          },
        },
      },
    ],
  };
}

describe("indexed thread evidence reader", () => {
  it("fails closed without a founder session and does not list mail", async () => {
    const result = await runIndexedThreadEvidenceFetch({
      founderSessionOk: false,
      threadIds: [THREAD],
      index: new InMemoryGmailIndexStore(),
      connections: new InMemoryGmailConnectionStore(),
      decryptRefreshToken: () => "refresh",
      refreshAccessToken: async () => ({ ok: true, accessToken: "access" }),
      createApi: () => new MockGmailApi(),
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.safeErrorCode, "unauthorized");
  });

  it("reads plaintext transiently for an already-indexed thread without persisting the body", async () => {
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
    const result = await runIndexedThreadEvidenceFetch({
      founderSessionOk: true,
      threadIds: [THREAD],
      index,
      connections,
      decryptRefreshToken: (wrapped) => {
        assert.ok(wrapped);
        return "refresh-keep";
      },
      refreshAccessToken: async () => ({ ok: true, accessToken: "access" }),
      createApi: (token) => {
        assert.equal(token, "access");
        return api;
      },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.plaintextPersisted, false);
    assert.equal(result.gmailMutation, false);
    assert.equal(result.cursorUnchanged, true);
    assert.deepEqual(result.unreadThreads, []);
    assert.equal(result.evidence[0]?.plaintext?.includes("create another piece"), true);
    const stored = await index.getMessage(MESSAGE);
    assert.equal("plaintext" in (stored ?? {}), false);
    assert.equal(api.calls.some((call) => call.method === "getThread"), true);
    assert.equal(api.calls.some((call) => call.method === "listMessages"), false);
    const wrapped = exactThreadOnlyApi(api);
    await assert.rejects(() => wrapped.listMessages({ q: "in:inbox" }));
  });

  it("does not persist bodies, change the #16B cursor, or broaden OAuth", () => {
    const source = readFileSync(join(DIR, "indexed-thread-evidence.ts"), "utf8");
    assert.match(source, /exactThreadOnlyApi/);
    assert.match(source, /protectExactThread/);
    assert.doesNotMatch(source, /putCheckpoint|indexMessage/);
    assert.doesNotMatch(source, /listMessages\(/);
    assert.doesNotMatch(source, /users\.messages\.send|gmail\.modify/);
    assert.doesNotMatch(source, /gmail\.compose|gmail\.modify/);
    const oauth = readFileSync(join(DIR, "oauth.ts"), "utf8");
    assert.match(oauth, /gmail\.readonly/);
    assert.doesNotMatch(oauth, /gmail\.modify|gmail\.compose|gmail\.send/);
    const indexedDryRun = readFileSync(
      join(DIR, "candidates", "indexed-dry-run.ts"),
      "utf8",
    );
    assert.match(indexedDryRun, /gmailFetch: false/);
    assert.match(indexedDryRun, /plaintextUsed: false/);
    const page = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/gmail/candidates/page.tsx"),
      "utf8",
    );
    assert.doesNotMatch(page, /runIndexedThreadEvidenceFetch/);
  });

  it("isolates a Gmail 404 thread and continues the rest of the scan", async () => {
    const missing = "19missingthread001";
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
        messageId: "19missingmsg0001",
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
    const result = await runIndexedThreadEvidenceFetch({
      founderSessionOk: true,
      threadIds: [THREAD, missing],
      index,
      connections,
      decryptRefreshToken: () => "refresh-keep",
      refreshAccessToken: async () => ({ ok: true, accessToken: "access" }),
      createApi: () => api,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.evidence.length, 1);
    assert.equal(result.evidence[0]?.indexed.threadId, THREAD);
    assert.equal(result.unreadThreads.length, 1);
    assert.equal(result.unreadThreads[0]?.threadId, missing);
    assert.equal(result.unreadThreads[0]?.safeErrorCode, "thread-not-found");
    assert.equal(result.plaintextPersisted, false);
  });

  it("isolates a malformed MIME thread and continues the rest of the scan", async () => {
    const malformed = "19malformedthread01";
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
        messageId: "19malformedmsg0001",
        threadId: malformed,
        sentAt: "2026-09-07T16:00:00.000Z",
        subject: "Broken",
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
    api.setThread({
      id: malformed,
      messages: undefined as unknown as GmailApiThread["messages"],
    });
    const result = await runIndexedThreadEvidenceFetch({
      founderSessionOk: true,
      threadIds: [THREAD, malformed],
      index,
      connections,
      decryptRefreshToken: () => "refresh-keep",
      refreshAccessToken: async () => ({ ok: true, accessToken: "access" }),
      createApi: () => api,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.evidence.length, 1);
    assert.equal(result.unreadThreads.length, 1);
    assert.equal(result.unreadThreads[0]?.threadId, malformed);
    assert.equal(result.unreadThreads[0]?.safeErrorCode, "thread-fetch-failed");
    assert.equal(
      JSON.stringify(result).includes("UNIQUE_BODY"),
      false,
    );
  });
});
