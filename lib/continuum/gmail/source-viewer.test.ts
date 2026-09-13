import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { GmailHttpError, MockGmailApi } from "./adapter";
import { exactThreadOnlyApi } from "./exact-thread";
import { encodeGmailBody } from "./exact-thread-fixtures";
import { InMemoryGmailIndexStore } from "@/lib/continuum/client-memory/gmail/store";
import { InMemoryGmailConnectionStore, connectFounderMailbox } from "./connection";
import { encryptRefreshToken } from "./token-crypto";
import { GMAIL_READONLY_SCOPE, type GmailApiThread } from "./types";
import { runSourceViewerFetch } from "./source-viewer";
import { presentSourceViewer } from "@/lib/continuum/chief-of-staff/operating-loop/email-viewer";

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, "../../..");
const KEY = Buffer.from("c".repeat(64), "hex");
const NOW = "2026-09-08T12:00:00.000Z";
const THREAD = "19aa0b0c0d0e0f01";
const MESSAGE = "19aa0b0c0d0e0f02";
const OTHER_MSG = "19aa0b0c0d0e0f03";
const UNIQUE_BODY = "UNIQUE_VIEWER_BODY_DO_NOT_PUT_ON_TODAY";

function thread(): GmailApiThread {
  return {
    id: THREAD,
    messages: [
      {
        id: MESSAGE,
        threadId: THREAD,
        labelIds: ["INBOX"],
        internalDate: String(Date.parse("2026-09-07T15:00:00.000Z")),
        snippet: "I'd like to work together again",
        payload: {
          mimeType: "text/plain",
          headers: [
            { name: "From", value: "Nate Pearl <nate.pearl@example.test>" },
            { name: "To", value: "Justin <justin@hourglass.test>" },
            { name: "Subject", value: "Another piece" },
          ],
          body: {
            data: encodeGmailBody(UNIQUE_BODY),
            size: UNIQUE_BODY.length,
          },
        },
      },
      {
        id: OTHER_MSG,
        threadId: THREAD,
        labelIds: ["INBOX"],
        internalDate: String(Date.parse("2026-09-07T16:00:00.000Z")),
        snippet: "Other client",
        payload: {
          mimeType: "text/plain",
          headers: [
            { name: "From", value: "Other Client <other@example.test>" },
            { name: "Subject", value: "Unrelated" },
          ],
          body: {
            data: encodeGmailBody("UNRELATED_CLIENT_BODY"),
            size: 20,
          },
        },
      },
    ],
  };
}

async function connectedIndex() {
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
  return { index, connections };
}

describe("read-only source viewer fetch", () => {
  it("fails closed without a founder session and does not list mail", async () => {
    const api = new MockGmailApi();
    const result = await runSourceViewerFetch({
      founderSessionOk: false,
      threadId: THREAD,
      index: new InMemoryGmailIndexStore(),
      connections: new InMemoryGmailConnectionStore(),
      decryptRefreshToken: () => "refresh",
      refreshAccessToken: async () => ({ ok: true, accessToken: "access" }),
      createApi: () => api,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.safeErrorCode, "unauthorized");
    assert.equal(api.calls.length, 0);
  });

  it("does not fetch an unindexed thread", async () => {
    const { connections } = await connectedIndex();
    const api = new MockGmailApi();
    api.setThread(thread());
    const result = await runSourceViewerFetch({
      founderSessionOk: true,
      threadId: THREAD,
      index: new InMemoryGmailIndexStore(),
      connections,
      decryptRefreshToken: () => "refresh-keep",
      refreshAccessToken: async () => ({ ok: true, accessToken: "access" }),
      createApi: () => api,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.safeErrorCode, "not-indexed");
    assert.equal(api.calls.some((call) => call.method === "getThread"), false);
  });

  it("loads the indexed client message with sender email and drops unrelated thread mail", async () => {
    const { index, connections } = await connectedIndex();
    const api = new MockGmailApi();
    api.setThread(thread());
    const result = await runSourceViewerFetch({
      founderSessionOk: true,
      threadId: THREAD,
      messageId: MESSAGE,
      index,
      connections,
      decryptRefreshToken: () => "refresh-keep",
      refreshAccessToken: async () => ({ ok: true, accessToken: "access" }),
      createApi: () => api,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.gmailMutation, false);
    assert.equal(result.plaintextPersisted, false);
    assert.equal(result.readOnly, true);
    assert.equal(result.indexedSubject, "Another piece");
    assert.equal(result.messages.length, 1);
    assert.equal(result.messages[0]?.fromEmail, "nate.pearl@example.test");
    assert.match(result.messages[0]?.fromRaw ?? "", /Nate Pearl/);
    assert.equal(result.messages[0]?.plainText, UNIQUE_BODY);
    assert.equal(result.messages.some((row) => row.messageId === OTHER_MSG), false);
    assert.equal(api.calls.some((call) => call.method === "getThread"), true);
    assert.equal(api.calls.some((call) => call.method === "listMessages"), false);
    const stored = await index.getMessage(MESSAGE);
    assert.equal("plaintext" in (stored ?? {}), false);
    const wrapped = exactThreadOnlyApi(api);
    await assert.rejects(() => wrapped.listMessages({ q: "in:inbox" }));
    await assert.rejects(() => wrapped.getMessage(MESSAGE));
    const view = presentSourceViewer({
      href: `https://mail.google.com/mail/u/0/#all/${THREAD}/${MESSAGE}`,
      threadId: THREAD,
      messages: result.messages,
      request: {
        sources: [{ href: `https://mail.google.com/mail/u/0/#all/${THREAD}/${MESSAGE}`, label: "Source email" }],
        personLabel: null,
        projectTitle: null,
        why: "Why Continuum flagged this",
        facts: [],
        beats: [],
      },
      internalEmails: ["justin@hourglass.test"],
    });
    assert.equal(view?.focused.fromDisplayName, "Nate Pearl");
    assert.equal(view?.focused.fromEmail, "nate.pearl@example.test");
    assert.equal(view?.gmailHref.includes(THREAD), true);
    assert.equal(view?.sourceRef, `gc1|${THREAD}|${MESSAGE}`);
  });

  it("uses snippet when the body is empty", async () => {
    const { index, connections } = await connectedIndex();
    const api = new MockGmailApi();
    api.setThread({
      id: THREAD,
      messages: [{
        id: MESSAGE,
        threadId: THREAD,
        labelIds: ["INBOX"],
        internalDate: String(Date.parse("2026-09-07T15:00:00.000Z")),
        snippet: "Snippet only fallback",
        payload: {
          mimeType: "text/plain",
          headers: [
            { name: "From", value: "jordan@example.test" },
            { name: "Subject", value: "Another piece" },
          ],
          body: { data: null, size: 0 },
        },
      }],
    });
    const result = await runSourceViewerFetch({
      founderSessionOk: true,
      threadId: THREAD,
      messageId: MESSAGE,
      index,
      connections,
      decryptRefreshToken: () => "refresh-keep",
      refreshAccessToken: async () => ({ ok: true, accessToken: "access" }),
      createApi: () => api,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const view = presentSourceViewer({
      href: `https://mail.google.com/mail/u/0/#all/${THREAD}/${MESSAGE}`,
      threadId: THREAD,
      messages: result.messages,
      request: {
        sources: [],
        personLabel: null,
        projectTitle: null,
        why: null,
        facts: [],
        beats: [],
      },
    });
    assert.equal(view?.focused.body, "Snippet only fallback");
    assert.equal(view?.focused.snippetFallback, true);
    assert.equal(view?.focused.fromEmail, "jordan@example.test");
  });

  it("isolates a Gmail 404 and stays read-only", async () => {
    const { index, connections } = await connectedIndex();
    const api = new MockGmailApi();
    api.errors.set(`getThread:${THREAD}`, new GmailHttpError(404, "notFound"));
    const result = await runSourceViewerFetch({
      founderSessionOk: true,
      threadId: THREAD,
      messageId: MESSAGE,
      index,
      connections,
      decryptRefreshToken: () => "refresh-keep",
      refreshAccessToken: async () => ({ ok: true, accessToken: "access" }),
      createApi: () => api,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.safeErrorCode, "thread-not-found");
  });

  it("does not persist bodies, change checkpoints, or gain write scopes", () => {
    const source = readFileSync(join(DIR, "source-viewer.ts"), "utf8");
    const run = readFileSync(join(DIR, "source-viewer-run.ts"), "utf8");
    const actions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/source-viewer-actions.ts"),
      "utf8",
    );
    const ui = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/components/cos-source-viewer.tsx"),
      "utf8",
    );
    for (const text of [source, run, actions, ui]) {
      assert.doesNotMatch(text, /users\.messages\.send|gmail\.modify|gmail\.compose|gmail\.send/);
      assert.doesNotMatch(text, /putCheckpoint|indexMessage\(/);
      assert.doesNotMatch(text, /\/attachments\//);
      assert.doesNotMatch(text, /listMessages\(/);
    }
    assert.match(source, /exactThreadOnlyApi/);
    assert.match(ui, /OPEN_IN_GMAIL_LABEL/);
    assert.match(ui, /VIEW_EMAIL_LABEL/);
    assert.doesNotMatch(ui, />Reply<|>Archive<|>Send</);
    const oauth = readFileSync(join(DIR, "oauth.ts"), "utf8");
    assert.match(oauth, /gmail\.readonly/);
    assert.doesNotMatch(oauth, /gmail\.modify|gmail\.compose|gmail\.send/);
  });
});
