import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { MockGmailApi } from "./adapter";
import {
  runGmailEvidenceCompletenessAudit,
  type GmailEvidenceAuditDependencies,
} from "./evidence-completeness-audit";
import { exactThreadOnlyApi } from "./exact-thread";
import type { PreparedIndexedMessage, SourceViewerFetchResult } from "./source-viewer";

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, "../../..");
const ACTION = join(
  ROOT,
  "app/executive-dashboard/concierge/gmail-evidence-audit-actions.ts",
);
const AUDIT = join(DIR, "evidence-completeness-audit.ts");
const AUTHORIZED_THREADS = [
  "1a0881b53067a9e6",
  "1a01c4ee4d198ef0",
  "1a09120d797337d9",
  "19a854e42f90344f",
] as const;

function indexed(threadId: string, suffix = "01"): PreparedIndexedMessage {
  return {
    messageId: `${threadId}-${suffix}`,
    threadId,
    sentAt: "2026-10-09T12:00:00.000Z",
    subject: null,
  };
}

function liveSuccess(
  threadId: string,
  rows: readonly PreparedIndexedMessage[],
): SourceViewerFetchResult {
  return {
    ok: true,
    safeErrorCode: null,
    threadId,
    indexedSubject: null,
    messages: rows.map((row) => ({
      messageId: row.messageId,
      fromRaw: "Sensitive Sender <private@example.test>",
      fromEmail: "private@example.test",
      to: ["founder@example.test"],
      cc: [],
      subject: "PRIVATE SUBJECT",
      sentAt: row.sentAt,
      plainText:
        "Please review the updated CAD.\n\nOn Tuesday, someone wrote:\nPRIVATE QUOTED HISTORY",
      snippet: "PRIVATE SNIPPET",
      attachments: [{ filename: "PRIVATE-FILE.stl", mimeType: "model/stl" }],
    })),
    plaintextPersisted: false,
    gmailMutation: false,
    cursorUnchanged: true,
    readOnly: true,
  };
}

function dependencies(
  overrides: Partial<GmailEvidenceAuditDependencies> = {},
): GmailEvidenceAuditDependencies {
  return {
    founderSessionOk: true,
    listIndexedMessagesByThread: async (threadId) => [indexed(threadId)],
    createBatch: async () => ({
      fetchThread: async ({ threadId, indexed: rows }) =>
        liveSuccess(threadId, rows),
    }),
    ...overrides,
  };
}

describe("private Gmail evidence completeness audit", () => {
  it("requires founder authentication before index or Gmail access", async () => {
    let indexCalls = 0;
    let batchCalls = 0;
    const result = await runGmailEvidenceCompletenessAudit(
      dependencies({
        founderSessionOk: false,
        listIndexedMessagesByThread: async () => {
          indexCalls += 1;
          return [];
        },
        createBatch: async () => {
          batchCalls += 1;
          return null;
        },
      }),
    );

    assert.equal(indexCalls, 0);
    assert.equal(batchCalls, 0);
    assert.equal(result.completeness, "incomplete");
    assert.deepEqual(result.safeErrorCategories, ["unauthorized"]);
  });

  it("uses only the immutable four-thread scope and returns aggregates", async () => {
    const indexedCalls: string[] = [];
    const fetchedCalls: string[] = [];
    const result = await runGmailEvidenceCompletenessAudit(
      dependencies({
        listIndexedMessagesByThread: async (threadId) => {
          indexedCalls.push(threadId);
          return [indexed(threadId)];
        },
        createBatch: async () => ({
          fetchThread: async ({ threadId, indexed: rows }) => {
            fetchedCalls.push(threadId);
            return liveSuccess(threadId, rows);
          },
        }),
      }),
    );

    assert.deepEqual(indexedCalls, AUTHORIZED_THREADS);
    assert.deepEqual(fetchedCalls, AUTHORIZED_THREADS);
    assert.equal(result.completeness, "complete");
    assert.equal(result.cases.sarah.scopedMessageCount, 2);
    assert.equal(result.cases.sarah.indexedMessageCount, 2);
    assert.equal(result.cases.nathan.indexedMessageCount, 2);
    assert.equal(result.cases.sarah.substantiveAuthorOwnedContentCount, 2);
    assert.equal(result.cases.nathan.attachmentPresenceMessageCount, 2);

    const serialized = JSON.stringify(result);
    for (const forbidden of [
      ...AUTHORIZED_THREADS,
      "private@example.test",
      "PRIVATE SUBJECT",
      "PRIVATE QUOTED HISTORY",
      "PRIVATE SNIPPET",
      "PRIVATE-FILE.stl",
    ]) {
      assert.doesNotMatch(serialized, new RegExp(forbidden, "i"));
    }
    assert.deepEqual(Object.keys(result).sort(), [
      "cases",
      "completeness",
      "safeErrorCategories",
    ]);
  });

  it("rejects an unindexed allowed thread without fetching it", async () => {
    const missing = AUTHORIZED_THREADS[1];
    const fetchedCalls: string[] = [];
    const result = await runGmailEvidenceCompletenessAudit(
      dependencies({
        listIndexedMessagesByThread: async (threadId) =>
          threadId === missing ? [] : [indexed(threadId)],
        createBatch: async () => ({
          fetchThread: async ({ threadId, indexed: rows }) => {
            fetchedCalls.push(threadId);
            return liveSuccess(threadId, rows);
          },
        }),
      }),
    );

    assert.equal(fetchedCalls.includes(missing), false);
    assert.equal(result.cases.sarah.completeness, "incomplete");
    assert.deepEqual(result.cases.sarah.safeErrorCategories, [
      "unindexed-thread",
    ]);
  });

  it("exposes only safe errors when dependencies throw sensitive text", async () => {
    const result = await runGmailEvidenceCompletenessAudit(
      dependencies({
        listIndexedMessagesByThread: async () => {
          throw new Error("ACCESS_TOKEN=secret PRIVATE BODY");
        },
        createBatch: async () => {
          throw new Error("refresh_token=secret PRIVATE BODY");
        },
      }),
    );
    const serialized = JSON.stringify(result);

    assert.deepEqual(result.safeErrorCategories, ["index-unavailable"]);
    assert.doesNotMatch(serialized, /secret|private body|access_token|refresh_token/i);
  });

  it("keeps mailbox-wide Gmail retrieval unavailable", async () => {
    const api = new MockGmailApi();
    const exact = exactThreadOnlyApi(api);

    await assert.rejects(() => exact.getProfile());
    await assert.rejects(() => exact.listMessages({ q: "in:anywhere" }));
    await assert.rejects(() =>
      exact.listHistory({ startHistoryId: "1" }),
    );
    await assert.rejects(() => exact.getMessage("message"));
    assert.equal(api.calls.length, 0);
  });

  it("contains no persistence, cursor, publication, model, or logging path", () => {
    const source = `${readFileSync(AUDIT, "utf8")}\n${readFileSync(ACTION, "utf8")}`;

    assert.match(source, /getAuthenticatedGmailHistoryStores/);
    assert.match(source, /createLiveSourceViewerBatch/);
    assert.doesNotMatch(
      source,
      /putCheckpoint|indexMessage\(|publishPersistedTodaySnapshot|revalidatePath|OPENAI_API_KEY|requestSterling|console\./,
    );
    assert.doesNotMatch(source, /export async function GET|export async function POST/);
    assert.match(
      readFileSync(ACTION, "utf8"),
      /runPrivateGmailEvidenceAuditAction\(\)/,
    );
  });
});
