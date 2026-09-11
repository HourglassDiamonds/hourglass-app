import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { InMemoryCandidateStore } from "@/lib/continuum/candidates/store";
import { InMemoryGmailIndexStore } from "@/lib/continuum/client-memory/gmail/store";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import { MockGmailApi } from "./adapter";
import { InMemoryGmailAttachmentStore } from "./attachments";
import {
  connectFounderMailbox,
  InMemoryGmailConnectionStore,
} from "./connection";
import { encodeGmailBody } from "./exact-thread-fixtures";
import { FIXTURE_FOUNDER_EMAIL } from "./fixtures";
import {
  CONTINUUM_GMAIL_FRESHNESS_CRON_PATH,
  GMAIL_FRESHNESS_CYCLE_RESULT_KEYS,
  runGmailFreshnessCycle,
  sanitizeGmailFreshnessCycleResult,
  shouldRetryGmailIntake,
  shouldRunGmailOperatingFreshness,
} from "./freshness-cycle";
import { encryptRefreshToken } from "./token-crypto";
import {
  GMAIL_INCREMENTAL_JOB_KEY,
  GMAIL_READONLY_SCOPE,
  type GmailApiMessage,
  type GmailApiThread,
} from "./types";
import { NEW_PROJECT_CONTEXT_TOPIC } from "./candidates/new-project";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const KEY = Buffer.from("b".repeat(64), "hex");
const FOUNDER_HASH = hashEmail(FIXTURE_FOUNDER_EMAIL)!;
const NOW = new Date("2026-09-10T16:00:00.000Z");
const HISTORY_START = "100";
const HISTORY_NEXT = "200";
const THREAD = "thread-fresh-new-1";
const MESSAGE = "msg-fresh-new-1";

const NEW_PROJECT_MESSAGE: GmailApiMessage = {
  id: MESSAGE,
  threadId: THREAD,
  labelIds: ["INBOX", "UNREAD"],
  internalDate: String(Date.parse("2026-09-10T15:50:00.000Z")),
  payload: {
    mimeType: "text/plain",
    headers: [
      { name: "From", value: "Nate <nate.pearl@example.test>" },
      { name: "To", value: FIXTURE_FOUNDER_EMAIL },
      { name: "Subject", value: "Another piece" },
    ],
    body: {
      data: encodeGmailBody(
        "I'd like to work together again to create another piece.",
      ),
      size: 40,
    },
  },
};

function thread(): GmailApiThread {
  return {
    id: THREAD,
    messages: [NEW_PROJECT_MESSAGE],
  };
}

function emptyWorld() {
  return {
    people: [],
    projects: [],
    internalEmailHashes: [] as const,
  };
}

async function connected() {
  const connections = new InMemoryGmailConnectionStore();
  await connections.putConnection(
    connectFounderMailbox({
      existing: null,
      mailboxEmailHash: FOUNDER_HASH,
      refreshToken: encryptRefreshToken("refresh-fresh", KEY),
      grantedScope: GMAIL_READONLY_SCOPE,
      providerTokenType: "Bearer",
      now: NOW.toISOString(),
    }),
  );
  return connections;
}

async function completeHistorical(index: InMemoryGmailIndexStore) {
  await index.putCheckpoint({
    jobKey: "gmail-historical",
    status: "completed",
    windowStart: "2024-08-28T00:00:00.000Z",
    windowEnd: NOW.toISOString(),
    pageToken: null,
    historyId: null,
    cursorMessageId: null,
    indexedCount: 1,
    updatedAt: NOW.toISOString(),
    errorCode: null,
  });
}

function readyApi() {
  const api = new MockGmailApi();
  api.setProfile({ emailAddress: FIXTURE_FOUNDER_EMAIL, historyId: HISTORY_START });
  api.setMessage(NEW_PROJECT_MESSAGE);
  api.setThread(thread());
  api.setListPage(null, { messages: [], nextPageToken: null });
  api.setHistoryPage(HISTORY_START, null, {
    history: [
      {
        id: "101",
        messagesAdded: [
          {
            message: {
              id: MESSAGE,
              threadId: THREAD,
              labelIds: ["INBOX"],
            },
          },
        ],
      },
    ],
    nextPageToken: null,
    historyId: HISTORY_NEXT,
  });
  return api;
}

function assertSafeOutput(
  result: ReturnType<typeof sanitizeGmailFreshnessCycleResult>,
) {
  const serialized = JSON.stringify(result);
  assert.deepEqual(
    Object.keys(result).sort(),
    [...GMAIL_FRESHNESS_CYCLE_RESULT_KEYS].sort(),
  );
  assert.equal(serialized.includes("nate.pearl"), false);
  assert.equal(serialized.includes(THREAD), false);
  assert.equal(serialized.includes(MESSAGE), false);
  assert.equal(serialized.includes("Another piece"), false);
}

describe("Gmail operating freshness cycle", () => {
  it("fails closed without founder session or secret protection", async () => {
    const result = await runGmailFreshnessCycle({
      founderSessionOk: false,
      enabled: true,
      connections: await connected(),
      index: new InMemoryGmailIndexStore(),
      attachments: new InMemoryGmailAttachmentStore(),
      decryptRefreshToken: () => "refresh-fresh",
      refreshAccessToken: async () => ({ ok: true, accessToken: "access" }),
      createApi: () => readyApi(),
      world: emptyWorld(),
      store: new InMemoryCandidateStore(),
      nowIso: NOW.toISOString(),
    });
    assert.equal(result.safeErrorCode, "unauthorized");
    assert.equal(result.ranIncremental, false);
    assert.equal(result.intakeRan, false);
    assertSafeOutput(result);
  });

  it("no-ops when the incremental kill switch is off", async () => {
    const api = readyApi();
    const result = await runGmailFreshnessCycle({
      founderSessionOk: true,
      enabled: false,
      connections: await connected(),
      index: new InMemoryGmailIndexStore(),
      attachments: new InMemoryGmailAttachmentStore(),
      decryptRefreshToken: () => "refresh-fresh",
      refreshAccessToken: async () => ({ ok: true, accessToken: "access" }),
      createApi: () => api,
      world: emptyWorld(),
      store: new InMemoryCandidateStore(),
      nowIso: NOW.toISOString(),
    });
    assert.equal(result.safeErrorCode, "sync-disabled");
    assert.equal(api.calls.length, 0);
    assertSafeOutput(result);
  });

  it("indexes a new Gmail message and ingests a candidate without duplicating on repeat", async () => {
    const api = readyApi();
    const index = new InMemoryGmailIndexStore();
    await completeHistorical(index);
    const store = new InMemoryCandidateStore();
    const clock = { now: () => NOW, sleep: async () => {} };
    const input = {
      founderSessionOk: false,
      secretProtectedOk: true,
      enabled: true as const,
      connections: await connected(),
      index,
      attachments: new InMemoryGmailAttachmentStore(),
      decryptRefreshToken: () => "refresh-fresh",
      refreshAccessToken: async () => ({ ok: true, accessToken: "access" }),
      createApi: () => api,
      world: emptyWorld(),
      store,
      nowIso: NOW.toISOString(),
      clock,
    };
    const first = await runGmailFreshnessCycle(input);
    assert.equal(first.safeErrorCode, null);
    assert.equal(first.ranIncremental, true);
    assert.equal(first.intakeRan, true);
    assert.equal(first.insertedCount > 0, true);
    assert.equal(first.docketMayHaveChanged, true);
    assert.equal((await index.getMessage(MESSAGE))?.threadId, THREAD);
    assert.equal((await index.getCheckpoint(GMAIL_INCREMENTAL_JOB_KEY))?.historyId, HISTORY_NEXT);
    const rows = await store.list();
    assert.equal(
      rows.some(
        (row) =>
          row.payload.kind === "project_context" &&
          row.payload.topic === NEW_PROJECT_CONTEXT_TOPIC,
      ),
      true,
    );
    assertSafeOutput(first);

    const second = await runGmailFreshnessCycle(input);
    assert.equal(second.safeErrorCode, null);
    assert.equal(second.skippedAsFresh, true);
    assert.equal(second.ranIncremental, false);
    assert.equal(second.insertedCount, 0);
    assert.equal(second.duplicateCount > 0, true);
    assert.equal((await store.list()).length, rows.length);
    assertSafeOutput(second);
  });

  it("treats a current incremental checkpoint as fresh until the operating window elapses", () => {
    assert.equal(
      shouldRunGmailOperatingFreshness({
        lastSuccessfulSyncAt: "2026-09-10T16:00:00.000Z",
        nowIso: "2026-09-10T16:00:30.000Z",
        morePagesRemain: false,
      }),
      false,
    );
    assert.equal(
      shouldRunGmailOperatingFreshness({
        lastSuccessfulSyncAt: "2026-09-10T16:00:00.000Z",
        nowIso: "2026-09-10T16:01:00.000Z",
        morePagesRemain: false,
      }),
      true,
    );
    assert.equal(
      shouldRunGmailOperatingFreshness({
        lastSuccessfulSyncAt: "2026-09-10T16:00:00.000Z",
        nowIso: "2026-09-10T16:00:30.000Z",
        morePagesRemain: true,
      }),
      true,
    );
    assert.equal(
      shouldRetryGmailIntake({
        indexedThisCycle: 0,
        newestIndexedAt: "2026-09-10T16:00:00.000Z",
        nowIso: "2026-09-10T16:04:00.000Z",
      }),
      true,
    );
    assert.equal(
      shouldRetryGmailIntake({
        indexedThisCycle: 0,
        newestIndexedAt: "2026-09-10T16:00:00.000Z",
        nowIso: "2026-09-10T16:06:00.000Z",
      }),
      false,
    );
  });

  it("keeps the durable poller secret-protected, kill-switched, and off the incremental UI", () => {
    const route = readFileSync(
      join(ROOT, "app/api/cron/continuum-gmail-freshness/route.ts"),
      "utf8",
    );
    const cycle = readFileSync(join(ROOT, "lib/continuum/gmail/freshness-cycle.ts"), "utf8");
    const run = readFileSync(join(ROOT, "lib/continuum/gmail/freshness-run.ts"), "utf8");
    const actions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/gmail-freshness-actions.ts"),
      "utf8",
    );
    const ui = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/components/gmail-operating-freshness.tsx"),
      "utf8",
    );
    const home = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/page.tsx"),
      "utf8",
    );
    const vercel = readFileSync(join(ROOT, "vercel.json"), "utf8");
    const incrementalUi = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/components/gmail-incremental.tsx"),
      "utf8",
    );
    assert.match(route, /verifyCronRequest/);
    assert.match(route, /secretProtectedOk: true/);
    assert.doesNotMatch(route, /verifyCronQuerySecret/);
    assert.doesNotMatch(route, /runGmailIncrementalChunk|runGmailNewProjectIntakeScan/);
    assert.doesNotMatch(route, /ingestGmailCandidates|proposeGmailCandidates/);
    assert.doesNotMatch(route, /subject|snippet|threadId|messageId|mailboxEmailHash/);
    assert.doesNotMatch(route, /users\.watch|pubsub/i);
    assert.match(cycle, /runGmailIncrementalChunk/);
    assert.match(cycle, /runGmailNewProjectIntakeScan/);
    assert.doesNotMatch(cycle, /createPersonAtomic|insertSourceNote/);
    assert.doesNotMatch(cycle, /users\.watch\(/);
    assert.match(run, /isGmailIncrementalSyncEnabled/);
    assert.match(run, /import "server-only"/);
    assert.doesNotMatch(run, /console\.(log|info|debug|warn|error)/);
    assert.match(actions, /"use server"/);
    assert.match(actions, /getAuthenticatedGmailHistoryStores/);
    assert.match(ui, /return null/);
    assert.match(home, /GmailOperatingFreshness/);
    assert.doesNotMatch(incrementalUi, /continuum-gmail-freshness/);
    assert.match(vercel, /continuum-gmail-freshness/);
    assert.match(vercel, /concierge-sla/);
    assert.equal(CONTINUUM_GMAIL_FRESHNESS_CRON_PATH, "/api/cron/continuum-gmail-freshness");
  });
});
