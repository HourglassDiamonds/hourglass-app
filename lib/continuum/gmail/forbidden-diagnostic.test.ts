import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  runGmailForbiddenDiagnostic,
  type GmailForbiddenDiagnosticDependencies,
} from "./forbidden-diagnostic";
import type { SourceViewerFetchResult } from "./source-viewer";

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, "../../..");
const APPROVED_THREAD = "1a0881b53067a9e6";

function dependencies(
  fetched: SourceViewerFetchResult,
): GmailForbiddenDiagnosticDependencies & {
  indexedCalls: string[];
  fetchCalls: string[];
} {
  const indexedCalls: string[] = [];
  const fetchCalls: string[] = [];
  return {
    founderSessionOk: true,
    indexedCalls,
    fetchCalls,
    async listIndexedMessagesByThread(threadId) {
      indexedCalls.push(threadId);
      return [
        {
          threadId: APPROVED_THREAD,
          messageId: "indexed-message",
          sentAt: "2026-10-09T12:00:00.000Z",
          subject: null,
        },
      ];
    },
    async createBatch() {
      return {
        async fetchThread({ threadId }) {
          fetchCalls.push(threadId);
          return fetched;
        },
      };
    },
  };
}

describe("temporary Gmail forbidden diagnostic", () => {
  it("requires founder authentication before index or Gmail access", async () => {
    const deps = dependencies({
      ok: false,
      safeErrorCode: "insufficient_permissions",
      httpStatus: 403,
    });
    deps.founderSessionOk = false;

    const result = await runGmailForbiddenDiagnostic(deps);

    assert.deepEqual(result, {
      success: false,
      httpStatus: null,
      normalizedCategory: "unknown_forbidden",
    });
    assert.equal(deps.indexedCalls.length, 0);
    assert.equal(deps.fetchCalls.length, 0);
  });

  it("uses one immutable indexed thread and performs exactly one fetch", async () => {
    const deps = dependencies({
      ok: false,
      safeErrorCode: "domain_policy",
      httpStatus: 403,
    });

    const result = await runGmailForbiddenDiagnostic(deps);

    assert.deepEqual(deps.indexedCalls, [APPROVED_THREAD]);
    assert.deepEqual(deps.fetchCalls, [APPROVED_THREAD]);
    assert.deepEqual(result, {
      success: false,
      httpStatus: 403,
      normalizedCategory: "domain_policy",
    });
  });

  it("does not create a Gmail batch when the fixed thread is unindexed", async () => {
    let batchCalls = 0;
    const result = await runGmailForbiddenDiagnostic({
      founderSessionOk: true,
      listIndexedMessagesByThread: async () => [],
      createBatch: async () => {
        batchCalls += 1;
        return null;
      },
    });

    assert.equal(batchCalls, 0);
    assert.equal(result.success, false);
    assert.equal(result.httpStatus, null);
    assert.equal(result.normalizedCategory, "unknown_forbidden");
  });

  it("fails closed for unknown failures and never returns private fields", async () => {
    const deps = dependencies({
      ok: false,
      safeErrorCode: "thread-fetch-failed",
      httpStatus: 500,
    });
    const result = await runGmailForbiddenDiagnostic(deps);
    const serialized = JSON.stringify(result);

    assert.deepEqual(result, {
      success: false,
      httpStatus: 500,
      normalizedCategory: "unknown_forbidden",
    });
    assert.deepEqual(Object.keys(result).sort(), [
      "httpStatus",
      "normalizedCategory",
      "success",
    ]);
    assert.doesNotMatch(
      serialized,
      /message|subject|participant|filename|attachment|token|credential|thread/i,
    );
  });

  it("returns success metadata without returning fetched content", async () => {
    const deps = dependencies({
      ok: true,
      safeErrorCode: null,
      threadId: APPROVED_THREAD,
      indexedSubject: "private subject",
      messages: [],
      plaintextPersisted: false,
      gmailMutation: false,
      cursorUnchanged: true,
      readOnly: true,
    });

    assert.deepEqual(await runGmailForbiddenDiagnostic(deps), {
      success: true,
      httpStatus: 200,
      normalizedCategory: null,
    });
  });

  it("keeps a zero-argument authenticated CSRF-protected action and manual guard", () => {
    const action = readFileSync(
      join(
        ROOT,
        "app/executive-dashboard/concierge/gmail-forbidden-diagnostic-actions.ts",
      ),
      "utf8",
    );
    const component = readFileSync(
      join(
        ROOT,
        "app/executive-dashboard/concierge/components/gmail-forbidden-diagnostic.tsx",
      ),
      "utf8",
    );
    const core = readFileSync(join(DIR, "forbidden-diagnostic.ts"), "utf8");

    assert.match(action, /^"use server";/);
    assert.match(
      action,
      /export async function runGmailForbiddenDiagnosticAction\(\)/,
    );
    assert.match(action, /getAuthenticatedGmailHistoryStores\(\)/);
    assert.doesNotMatch(action, /FormData|threadId:|messageId:|console\./);
    assert.match(component, /onClick=\{run\}/);
    assert.match(component, /submitted\.current = true/);
    assert.match(component, /disabled=\{pending \|\| attempted\}/);
    assert.doesNotMatch(component, /useEffect|FormData|threadId|messageId/);
    assert.doesNotMatch(
      `${action}\n${core}`,
      /putCheckpoint|indexMessage\(|publishPersistedTodaySnapshot|revalidatePath|OPENAI_API_KEY|requestSterling|console\./,
    );
    assert.doesNotMatch(action, /export async function GET|export async function POST/);
  });
});
