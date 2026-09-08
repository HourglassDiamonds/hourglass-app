import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InMemoryCandidateStore } from "@/lib/continuum/candidates/store";
import { InMemoryGmailIndexStore } from "@/lib/continuum/client-memory/gmail/store";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import { MockGmailApi } from "./adapter";
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
});
