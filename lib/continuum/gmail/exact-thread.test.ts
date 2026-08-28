import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { createLiveGmailApi, GmailHttpError, MockGmailApi } from "./adapter";
import {
  connectFounderMailbox,
  InMemoryGmailConnectionStore,
  type GmailConnectionStore,
} from "./connection";
import {
  EXACT_PROJECT_THREAD_FETCH_FAILURE_KEYS,
  exactProjectThreadFetchFailureKeys,
  exactThreadOnlyApi,
  failedExactProjectThreadFetch,
  lookupFromGetProjectHistory,
  runExactProjectThreadFetch,
  type ExactProjectThreadFetchFailure,
  type ExactProjectThreadFetchInput,
  type ExactProjectThreadPointer,
} from "./exact-thread";
import {
  ACHEDEKAL_THREAD,
  ACHEDEKAL_THREAD_ID,
  ADJACENCY_THREAD,
  ADJACENCY_THREAD_ID,
  FIXTURE_CLIENT_EMAIL,
  FIXTURE_FOUNDER_EMAIL,
  NO_EVIDENCE_THREAD,
  NO_EVIDENCE_THREAD_ID,
  ORDERED_THREAD,
  ORDERED_THREAD_ID,
  OTHER_PROJECT_THREAD,
  OTHER_PROJECT_THREAD_ID,
} from "./exact-thread-fixtures";
import type { GmailAccessTokenRefresh } from "./oauth";
import { decryptRefreshToken, encryptRefreshToken } from "./token-crypto";
import { GMAIL_READONLY_SCOPE, type GmailConnection } from "./types";
import { InMemoryClientMemoryStore } from "@/lib/continuum/client-memory/store";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "@/lib/continuum/client-memory/types";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const KEY = Buffer.from("c".repeat(64), "hex");
const NOW = "2026-08-28T13:00:00.000Z";
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

class MapLookup {
  constructor(private readonly rows: Map<string, ExactProjectThreadPointer>) {}

  getByProjectId(projectId: string) {
    return Promise.resolve(this.rows.get(projectId) ?? null);
  }
}

async function connectedStore(
  extras: Partial<GmailConnection> = {},
): Promise<RecordingStore> {
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
  return new RecordingStore(inner);
}

function refreshOk(): (
  refreshToken: string,
) => Promise<GmailAccessTokenRefresh> {
  return async () => ({ ok: true, accessToken: ACCESS });
}

function pointer(input: {
  projectId: string;
  gmailThreadId: string | null;
  fingerSize?: string | null;
  orderNumber?: string | null;
}): ExactProjectThreadPointer {
  return {
    projectId: input.projectId,
    gmailThreadId: input.gmailThreadId,
    fingerSize: input.fingerSize ?? "141",
    orderNumber: input.orderNumber ?? "140",
    cadJobNumber: "CAD-1",
    metal: "platinum",
    centerStone: null,
  };
}

async function seedAchedekal(
  store: InMemoryClientMemoryStore,
  extras: { gmailThreadId: string | null; title?: string } = {
    gmailThreadId: ACHEDEKAL_THREAD_ID,
  },
) {
  const person = await store.insertEntity({
    kind: "person",
    createdAt: NOW,
    createdBy: "test",
  });
  const project = await store.insertEntity({
    kind: "project",
    createdAt: NOW,
    createdBy: "test",
  });
  await store.insertPersonProfile({
    personId: person.record.id,
    displayName: "A. Achedekal",
    givenName: "A.",
    familyName: "Achedekal",
    organizationName: null,
    email: null,
    phone: null,
    streetAddress: null,
    city: null,
    state: null,
    country: null,
    postalCode: null,
    roles: ["client"],
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: NOW,
    updatedAt: NOW,
  });
  await store.insertProjectProfile({
    projectId: project.record.id,
    displayTitle: extras.title ?? "Achedekal ring",
    visibility: "internal-only",
    importRowKey: `continuum-reconciliation-v3:ReconciledProjects:${randomUUID()}`,
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: NOW,
    updatedAt: NOW,
  });
  await store.insertRelationship({
    id: randomUUID(),
    fromEntityId: person.record.id,
    toEntityId: project.record.id,
    kind: "client-project",
    status: "active",
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: NOW,
    createdBy: "test",
  });
  await store.insertProjectHistory({
    projectId: project.record.id,
    cadJobNumber: "CAD-1",
    orderNumber: "140",
    gmailThreadId: extras.gmailThreadId,
    matchJudgment: "exact",
    matchJudgmentRaw: "Exact",
    fingerSize: "141",
    metal: "platinum",
    centerStone: null,
    diamondSupplyNotes: null,
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: NOW,
    updatedAt: NOW,
  });
  return { personId: person.record.id, projectId: project.record.id };
}

function lookupFromStore(store: InMemoryClientMemoryStore) {
  return lookupFromGetProjectHistory(async (projectId) => {
    const history = await store.getProjectHistory(projectId);
    if (!history) return null;
    return {
      projectId: history.projectId,
      gmailThreadId: history.gmailThreadId,
      fingerSize: history.fingerSize,
      orderNumber: history.orderNumber,
      cadJobNumber: history.cadJobNumber,
      metal: history.metal,
      centerStone: history.centerStone,
    };
  });
}

function assertSafeFailure(
  result: ExactProjectThreadFetchFailure,
  serialized = JSON.stringify(result),
) {
  assert.deepEqual(
    exactProjectThreadFetchFailureKeys(result),
    [...EXACT_PROJECT_THREAD_FETCH_FAILURE_KEYS].sort(),
  );
  assert.equal(serialized.includes(FIXTURE_FOUNDER_EMAIL), false);
  assert.equal(serialized.includes(FIXTURE_CLIENT_EMAIL), false);
  assert.equal(serialized.includes("refresh-keep"), false);
  assert.equal(serialized.includes(ACCESS), false);
  assert.equal(serialized.includes(ACHEDEKAL_THREAD_ID), false);
  assert.equal(serialized.includes(OTHER_PROJECT_THREAD_ID), false);
  assert.equal(serialized.includes("Ring size"), false);
  assert.equal(serialized.includes("Achedekal"), false);
  assert.equal(serialized.includes("cad-render"), false);
  assert.equal(serialized.includes("ciphertext"), false);
  assert.doesNotMatch(serialized, /subject|snippet|payload|plainText/i);
}

async function fetchExact(input: {
  founderSessionOk?: boolean;
  projectId: string;
  projects: ExactProjectThreadFetchInput["projects"];
  connections: RecordingStore;
  api: MockGmailApi;
  refreshAccessToken?: ExactProjectThreadFetchInput["refreshAccessToken"];
  decryptRefreshToken?: ExactProjectThreadFetchInput["decryptRefreshToken"];
}) {
  return runExactProjectThreadFetch({
    founderSessionOk: input.founderSessionOk ?? true,
    projectId: input.projectId,
    projects: input.projects,
    connections: input.connections,
    decryptRefreshToken:
      input.decryptRefreshToken ?? ((wrapped) => decryptRefreshToken(wrapped, KEY)),
    refreshAccessToken: input.refreshAccessToken ?? refreshOk(),
    createApi: () => input.api,
  });
}

describe("exact project Gmail thread fetch", () => {
  it("fetches only the stored canonical thread and returns protected evidence", async () => {
    const api = new MockGmailApi();
    api.setThread(ACHEDEKAL_THREAD);
    api.setThread(OTHER_PROJECT_THREAD);
    const connections = await connectedStore();
    const projectId = "proj-achedekal";
    const result = await fetchExact({
      projectId,
      projects: new MapLookup(
        new Map([
          [projectId, pointer({ projectId, gmailThreadId: ACHEDEKAL_THREAD_ID })],
          [
            "proj-other",
            pointer({
              projectId: "proj-other",
              gmailThreadId: OTHER_PROJECT_THREAD_ID,
              fingerSize: "7",
            }),
          ],
        ]),
      ),
      connections,
      api,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.reconstruction.thread.threadId, ACHEDEKAL_THREAD_ID);
    assert.deepEqual(
      result.reconstruction.thread.messages.map((row) => row.messageId),
      ["msg-achedekal-1", "msg-achedekal-2"],
    );
    assert.equal(result.reconstruction.thread.messages[1]?.plainText, "Ring size 6.5");
    assert.equal(result.reconstruction.thread.messages[1]?.from, FIXTURE_FOUNDER_EMAIL);
    assert.deepEqual(result.reconstruction.thread.messages[1]?.to, [FIXTURE_CLIENT_EMAIL]);
    assert.equal(
      result.reconstruction.thread.messages[1]?.attachments[0]?.filename,
      "cad-render.pdf",
    );
    assert.equal(
      result.reconstruction.thread.messages[1]?.attachments[0]?.attachmentId,
      "att-cad-render-1",
    );
    assert.equal(result.reconstruction.currentSpecs.fingerSize, "141");
    assert.equal(result.reconstruction.currentSpecs.orderNumber, "140");
    assert.deepEqual(api.calls, [{ method: "getThread", threadId: ACHEDEKAL_THREAD_ID }]);
    assert.equal(connections.writes, 0);
    api.assertNeverFetchedAttachmentBytes();
  });

  it("requires founder auth and does not call Gmail", async () => {
    const api = new MockGmailApi();
    api.setThread(ACHEDEKAL_THREAD);
    const connections = await connectedStore();
    const projectId = "proj-achedekal";
    const result = await fetchExact({
      founderSessionOk: false,
      projectId,
      projects: new MapLookup(
        new Map([[projectId, pointer({ projectId, gmailThreadId: ACHEDEKAL_THREAD_ID })]]),
      ),
      connections,
      api,
    });
    assert.deepEqual(result, failedExactProjectThreadFetch("unauthorized"));
    assert.equal(api.calls.length, 0);
    assert.equal(connections.writes, 0);
    assertSafeFailure(result);
  });

  it("rejects an invalid stored pointer without calling Gmail", async () => {
    const api = new MockGmailApi();
    api.setThread(ACHEDEKAL_THREAD);
    const connections = await connectedStore();
    const projectId = "proj-invalid";
    const result = await fetchExact({
      projectId,
      projects: new MapLookup(
        new Map([
          [projectId, pointer({ projectId, gmailThreadId: "1.23E+16" })],
        ]),
      ),
      connections,
      api,
    });
    assert.deepEqual(result, failedExactProjectThreadFetch("invalid-pointer"));
    assert.equal(api.calls.length, 0);
    assert.equal(connections.writes, 0);
    assertSafeFailure(result);
  });

  it("rejects a blank stored pointer without calling Gmail", async () => {
    const api = new MockGmailApi();
    const connections = await connectedStore();
    const projectId = "proj-blank";
    for (const gmailThreadId of [null, "", "   "]) {
      const result = await fetchExact({
        projectId,
        projects: new MapLookup(
          new Map([[projectId, pointer({ projectId, gmailThreadId })]]),
        ),
        connections,
        api,
      });
      assert.deepEqual(result, failedExactProjectThreadFetch("blank-pointer"));
    }
    assert.equal(api.calls.length, 0);
    assert.equal(connections.writes, 0);
  });

  it("does not let one project fetch another project's stored pointer", async () => {
    const api = new MockGmailApi();
    api.setThread(ACHEDEKAL_THREAD);
    api.setThread(OTHER_PROJECT_THREAD);
    const connections = await connectedStore();
    const achedekalId = "proj-achedekal";
    const otherId = "proj-other";
    const projects = new MapLookup(
      new Map([
        [achedekalId, pointer({ projectId: achedekalId, gmailThreadId: ACHEDEKAL_THREAD_ID })],
        [otherId, pointer({ projectId: otherId, gmailThreadId: OTHER_PROJECT_THREAD_ID })],
      ]),
    );
    const other = await fetchExact({
      projectId: otherId,
      projects,
      connections,
      api,
    });
    assert.equal(other.ok, true);
    if (!other.ok) return;
    assert.equal(other.reconstruction.thread.threadId, OTHER_PROJECT_THREAD_ID);
    assert.equal(other.reconstruction.thread.messages[0]?.plainText, "Ring size 7.25");
    const mixed = await runExactProjectThreadFetch({
      founderSessionOk: true,
      projectId: achedekalId,
      projects: {
        getByProjectId: async (id) => {
          if (id !== achedekalId) return null;
          return pointer({
            projectId: otherId,
            gmailThreadId: OTHER_PROJECT_THREAD_ID,
          });
        },
      },
      connections,
      decryptRefreshToken: (wrapped) => decryptRefreshToken(wrapped, KEY),
      refreshAccessToken: refreshOk(),
      createApi: () => api,
    });
    assert.deepEqual(mixed, failedExactProjectThreadFetch("project-not-found"));
    assert.deepEqual(
      api.calls.filter((call) => call.method === "getThread"),
      [{ method: "getThread", threadId: OTHER_PROJECT_THREAD_ID }],
    );
  });

  it("fails closed on token refresh failure without fetching a thread", async () => {
    const api = new MockGmailApi();
    api.setThread(ACHEDEKAL_THREAD);
    const connections = await connectedStore();
    const projectId = "proj-achedekal";
    const result = await fetchExact({
      projectId,
      projects: new MapLookup(
        new Map([[projectId, pointer({ projectId, gmailThreadId: ACHEDEKAL_THREAD_ID })]]),
      ),
      connections,
      api,
      refreshAccessToken: async () => ({ ok: false, error: "token-refresh-failed" }),
    });
    assert.deepEqual(result, failedExactProjectThreadFetch("token-refresh-failed"));
    assert.equal(api.calls.length, 0);
    assertSafeFailure(result);
  });

  it("maps Gmail 404 and inaccessible thread errors without leaking identifiers", async () => {
    const missing = new MockGmailApi();
    missing.errors.set(`getThread:${ACHEDEKAL_THREAD_ID}`, new GmailHttpError(404, "notFound"));
    const forbidden = new MockGmailApi();
    forbidden.errors.set(
      `getThread:${ACHEDEKAL_THREAD_ID}`,
      new GmailHttpError(403, "forbidden"),
    );
    const connections = await connectedStore();
    const projectId = "proj-achedekal";
    const projects = new MapLookup(
      new Map([[projectId, pointer({ projectId, gmailThreadId: ACHEDEKAL_THREAD_ID })]]),
    );
    const notFound = await fetchExact({
      projectId,
      projects,
      connections,
      api: missing,
    });
    const inaccessible = await fetchExact({
      projectId,
      projects,
      connections,
      api: forbidden,
    });
    assert.deepEqual(notFound, failedExactProjectThreadFetch("thread-not-found"));
    assert.deepEqual(inaccessible, failedExactProjectThreadFetch("thread-inaccessible"));
    assertSafeFailure(notFound);
    assertSafeFailure(inaccessible);
    assert.deepEqual(missing.calls, [{ method: "getThread", threadId: ACHEDEKAL_THREAD_ID }]);
  });

  it("orders a multi-message thread by internalDate ascending", async () => {
    const api = new MockGmailApi();
    api.setThread(ORDERED_THREAD);
    const connections = await connectedStore();
    const projectId = "proj-ordered";
    const result = await fetchExact({
      projectId,
      projects: new MapLookup(
        new Map([[projectId, pointer({ projectId, gmailThreadId: ORDERED_THREAD_ID })]]),
      ),
      connections,
      api,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(
      result.reconstruction.thread.messages.map((row) => row.messageId),
      ["msg-order-1", "msg-order-2", "msg-order-3"],
    );
    assert.deepEqual(
      result.reconstruction.thread.messages.map((row) => row.subject),
      ["First", "Second", "Third"],
    );
  });

  it("does not write Persons, Projects, specs, CoS, or attachment bytes", async () => {
    const memory = new InMemoryClientMemoryStore();
    const seeded = await seedAchedekal(memory);
    const before = await memory.inspectCounts();
    const beforeHistory = await memory.getProjectHistory(seeded.projectId);
    const api = new MockGmailApi();
    api.setThread(ACHEDEKAL_THREAD);
    const connections = await connectedStore();
    const result = await fetchExact({
      projectId: seeded.projectId,
      projects: lookupFromStore(memory),
      connections,
      api,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const after = await memory.inspectCounts();
    const afterHistory = await memory.getProjectHistory(seeded.projectId);
    assert.deepEqual(after, before);
    assert.equal(afterHistory?.fingerSize, "141");
    assert.equal(afterHistory?.orderNumber, "140");
    assert.equal(afterHistory?.gmailThreadId, ACHEDEKAL_THREAD_ID);
    assert.equal(beforeHistory?.fingerSize, afterHistory?.fingerSize);
    assert.equal(memory.listProjectHistoryRevisions(seeded.projectId).length, 0);
    assert.equal(connections.writes, 0);
    assert.equal(result.reconstruction.proposedCorrections[0]?.automaticApply, false);
    api.assertNeverFetchedAttachmentBytes();
    const live = createLiveGmailApi.toString();
    assert.doesNotMatch(live, /\/attachments\//);
    assert.doesNotMatch(live, /messages\.attachments\.get/);
  });

  it("forbids mailbox-wide list and attachment byte retrieval on this path", async () => {
    const api = new MockGmailApi();
    api.setThread(ACHEDEKAL_THREAD);
    const bounded = exactThreadOnlyApi(api);
    await assert.rejects(bounded.listMessages({ q: "in:inbox" }), /messages\.list-forbidden/);
    await assert.rejects(bounded.getMessage("msg-achedekal-1"), /messages\.get-forbidden/);
    await assert.rejects(bounded.getProfile(), /users\.getProfile-forbidden/);
    const thread = await bounded.getThread(ACHEDEKAL_THREAD_ID);
    assert.equal(thread.id, ACHEDEKAL_THREAD_ID);
    api.assertNeverFetchedAttachmentBytes();
  });

  it("does not log PII and keeps exact-thread fetch off public routes", () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const fetchSource = readFileSync(join(dir, "exact-thread.ts"), "utf8");
    const payloadSource = readFileSync(join(dir, "exact-thread-payload.ts"), "utf8");
    const evidenceSource = readFileSync(join(dir, "reconstruction-evidence.ts"), "utf8");
    const barrel = readFileSync(join(dir, "index.ts"), "utf8");
    const server = readFileSync(join(dir, "server.ts"), "utf8");
    const actions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/gmail-actions.ts"),
      "utf8",
    );
    const historyActions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/gmail-history-actions.ts"),
      "utf8",
    );
    for (const source of [fetchSource, payloadSource, evidenceSource]) {
      assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
      assert.doesNotMatch(source, /correctProjectSpec|applyProjectSpecCorrection/);
      assert.doesNotMatch(source, /insertEvent|insertObservation|insertEvidence/);
      assert.doesNotMatch(source, /insertSourceNote|createPersonAtomic|insertWish/);
      assert.doesNotMatch(source, /putCheckpoint|tryClaimHistoricalChunk|indexMessage/);
      assert.doesNotMatch(source, /\/messages\/[^?\s"'`]+\/attachments\//);
      assert.doesNotMatch(source, /messages\.attachments\.get/);
      assert.doesNotMatch(source, /gtag|analytics|localStorage/);
    }
    assert.doesNotMatch(fetchSource, /input\.threadId/);
    assert.match(fetchSource, /coerceGmailThreadId\(pointer\.gmailThreadId\)/);
    assert.doesNotMatch(barrel, /runExactProjectThreadFetch/);
    assert.match(server, /runExactProjectThreadFetch/);
    assert.doesNotMatch(actions, /runExactProjectThreadFetch/);
    assert.doesNotMatch(historyActions, /runExactProjectThreadFetch/);
    const oauthStart = readFileSync(
      join(ROOT, "app/api/continuum/gmail/oauth/start/route.ts"),
      "utf8",
    );
    const oauthCallback = readFileSync(
      join(ROOT, "app/api/continuum/gmail/oauth/callback/route.ts"),
      "utf8",
    );
    for (const source of [oauthStart, oauthCallback]) {
      assert.doesNotMatch(source, /runExactProjectThreadFetch|protectExactThread/);
    }
  });

  it("does not propose a finger size when the exact thread has no size language", async () => {
    const api = new MockGmailApi();
    api.setThread(NO_EVIDENCE_THREAD);
    const connections = await connectedStore();
    const projectId = "proj-no-size";
    const result = await fetchExact({
      projectId,
      projects: new MapLookup(
        new Map([[projectId, pointer({ projectId, gmailThreadId: NO_EVIDENCE_THREAD_ID })]]),
      ),
      connections,
      api,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.reconstruction.currentSpecs.fingerSize, "141");
    assert.equal(result.reconstruction.currentSpecs.orderNumber, "140");
    assert.equal(
      result.reconstruction.candidateEvidence.some((row) => row.kind === "finger_size"),
      false,
    );
    assert.deepEqual(result.reconstruction.proposedCorrections, []);
  });

  it("does not infer finger size from 141/140 adjacency", async () => {
    const api = new MockGmailApi();
    api.setThread(ADJACENCY_THREAD);
    const connections = await connectedStore();
    const projectId = "proj-adjacency";
    const result = await fetchExact({
      projectId,
      projects: new MapLookup(
        new Map([[projectId, pointer({ projectId, gmailThreadId: ADJACENCY_THREAD_ID })]]),
      ),
      connections,
      api,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(
      result.reconstruction.candidateEvidence.some((row) => row.kind === "finger_size"),
      false,
    );
    assert.deepEqual(result.reconstruction.proposedCorrections, []);
    assert.equal(result.reconstruction.currentSpecs.orderNumber, "140");
    assert.equal(result.reconstruction.currentSpecs.fingerSize, "141");
  });
});
