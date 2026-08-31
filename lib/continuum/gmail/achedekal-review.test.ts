import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { ACHEDEKAL_PROJECT_ID } from "./achedekal-acceptance";
import {
  ACHEDEKAL_REVIEW_FAILURE_KEYS,
  executeAchedekalEvidenceReview,
  presentAchedekalReview,
  sanitizeAchedekalReviewFailure,
  type AchedekalReviewFailure,
} from "./achedekal-review";
import { MockGmailApi } from "./adapter";
import {
  connectFounderMailbox,
  InMemoryGmailConnectionStore,
  type GmailConnectionStore,
} from "./connection";
import {
  lookupFromGetProjectHistory,
  type ExactProjectThreadFetchInput,
  type ExactProjectThreadPointer,
} from "./exact-thread";
import {
  ACHEDEKAL_THREAD,
  ACHEDEKAL_THREAD_ID,
  ADJACENCY_THREAD,
  ADJACENCY_THREAD_ID,
  AMBIGUOUS_SIZE_THREAD,
  AMBIGUOUS_SIZE_THREAD_ID,
  FIXTURE_CLIENT_EMAIL,
  FIXTURE_FOUNDER_EMAIL,
  NO_EVIDENCE_THREAD,
  NO_EVIDENCE_THREAD_ID,
  OTHER_PROJECT_THREAD,
  OTHER_PROJECT_THREAD_ID,
} from "./exact-thread-fixtures";
import type { GmailAccessTokenRefresh } from "./oauth";
import { buildExactThreadReconstructionHandoff } from "./reconstruction-evidence";
import { protectExactThread } from "./exact-thread-payload";
import { decryptRefreshToken, encryptRefreshToken } from "./token-crypto";
import { GMAIL_READONLY_SCOPE, type GmailConnection } from "./types";
import { InMemoryClientMemoryStore } from "@/lib/continuum/client-memory/store";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "@/lib/continuum/client-memory/types";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const KEY = Buffer.from("c".repeat(64), "hex");
const NOW = "2026-08-28T13:00:00.000Z";
const ACCESS = "access-in-memory-only";
const OTHER_PROJECT_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

class RecordingStore implements GmailConnectionStore {
  writes = 0;

  constructor(private readonly inner: InMemoryGmailConnectionStore) {}

  getFounderConnection() {
    return this.inner.getFounderConnection();
  }

  async putConnection(row: GmailConnection) {
    this.writes += 1;
    return this.inner.putConnection(row);
  }
}

class RecordingLookup {
  requested: string[] = [];

  constructor(private readonly rows: Map<string, ExactProjectThreadPointer>) {}

  getByProjectId(projectId: string) {
    this.requested.push(projectId);
    return Promise.resolve(this.rows.get(projectId) ?? null);
  }
}

async function connectedStore(): Promise<RecordingStore> {
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
}): ExactProjectThreadPointer {
  return {
    projectId: input.projectId,
    gmailThreadId: input.gmailThreadId,
    fingerSize: "141",
    orderNumber: "140",
    cadJobNumber: "CAD-1",
    metal: "platinum",
    centerStone: null,
  };
}

async function seedAchedekal(
  store: InMemoryClientMemoryStore,
  gmailThreadId: string | null = ACHEDEKAL_THREAD_ID,
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
    id: ACHEDEKAL_PROJECT_ID,
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
    displayTitle: "Achedekal ring",
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
    gmailThreadId,
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
    if (projectId !== ACHEDEKAL_PROJECT_ID) return null;
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
  result: AchedekalReviewFailure,
  serialized = JSON.stringify(result),
) {
  assert.deepEqual(Object.keys(result).sort(), [...ACHEDEKAL_REVIEW_FAILURE_KEYS].sort());
  assert.deepEqual(sanitizeAchedekalReviewFailure(result), result);
  assert.equal(serialized.includes(FIXTURE_FOUNDER_EMAIL), false);
  assert.equal(serialized.includes(FIXTURE_CLIENT_EMAIL), false);
  assert.equal(serialized.includes("refresh-keep"), false);
  assert.equal(serialized.includes(ACCESS), false);
  assert.equal(serialized.includes(ACHEDEKAL_THREAD_ID), false);
  assert.equal(serialized.includes(OTHER_PROJECT_THREAD_ID), false);
  assert.equal(serialized.includes("Ring size"), false);
  assert.equal(serialized.includes("ciphertext"), false);
  assert.doesNotMatch(serialized, /stack|subject|snippet|payload|plainText/i);
}

async function reviewExact(input: {
  founderSessionOk?: boolean;
  requestedProjectId?: string | null;
  requestedThreadId?: string | null;
  requestedQuery?: string | null;
  projects: ExactProjectThreadFetchInput["projects"];
  connections: RecordingStore;
  api: MockGmailApi;
}) {
  return executeAchedekalEvidenceReview({
    founderSessionOk: input.founderSessionOk ?? true,
    projectId: ACHEDEKAL_PROJECT_ID,
    requestedProjectId: input.requestedProjectId,
    requestedThreadId: input.requestedThreadId,
    requestedQuery: input.requestedQuery,
    projects: input.projects,
    connections: input.connections,
    decryptRefreshToken: (wrapped) => decryptRefreshToken(wrapped, KEY),
    refreshAccessToken: refreshOk(),
    createApi: () => input.api,
  });
}

function assertNoPii(serialized: string) {
  assert.equal(serialized.includes(FIXTURE_FOUNDER_EMAIL), false);
  assert.equal(serialized.includes(FIXTURE_CLIENT_EMAIL), false);
  assert.equal(serialized.includes(ACHEDEKAL_THREAD_ID), false);
  assert.equal(serialized.includes(OTHER_PROJECT_THREAD_ID), false);
  assert.equal(serialized.includes("att-cad-render-1"), false);
  assert.equal(serialized.includes("refresh-keep"), false);
  assert.equal(serialized.includes(ACCESS), false);
  assert.doesNotMatch(serialized, /threadId|attachmentId|ciphertext/i);
}

describe("Achedekal founder-only Gmail evidence review", () => {
  it("rejects an unauthenticated caller", async () => {
    const api = new MockGmailApi();
    api.setThread(ACHEDEKAL_THREAD);
    const connections = await connectedStore();
    const result = await reviewExact({
      founderSessionOk: false,
      projects: new RecordingLookup(
        new Map([
          [
            ACHEDEKAL_PROJECT_ID,
            pointer({
              projectId: ACHEDEKAL_PROJECT_ID,
              gmailThreadId: ACHEDEKAL_THREAD_ID,
            }),
          ],
        ]),
      ),
      connections,
      api,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.safeErrorCode, "unauthorized");
    assert.deepEqual(api.calls, []);
    assertSafeFailure(result);
  });

  it("allows a founder-authenticated review of the stored Achedekal thread", async () => {
    const api = new MockGmailApi();
    api.setThread(ACHEDEKAL_THREAD);
    api.setThread(OTHER_PROJECT_THREAD);
    const connections = await connectedStore();
    const lookup = new RecordingLookup(
      new Map([
        [
          ACHEDEKAL_PROJECT_ID,
          pointer({
            projectId: ACHEDEKAL_PROJECT_ID,
            gmailThreadId: ACHEDEKAL_THREAD_ID,
          }),
        ],
        [
          OTHER_PROJECT_ID,
          pointer({
            projectId: OTHER_PROJECT_ID,
            gmailThreadId: OTHER_PROJECT_THREAD_ID,
          }),
        ],
      ]),
    );
    const result = await reviewExact({
      requestedThreadId: OTHER_PROJECT_THREAD_ID,
      requestedQuery: "subject:Achedekal",
      projects: lookup,
      connections,
      api,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(lookup.requested, [ACHEDEKAL_PROJECT_ID]);
    assert.deepEqual(api.calls, [{ method: "getThread", threadId: ACHEDEKAL_THREAD_ID }]);
    assert.equal(result.projectName, "A. Achedekal");
    assert.equal(result.lifecycle, "Historical / closed");
    assert.equal(result.automaticApply, false);
    assert.equal(
      result.currentSpecs.find((row) => row.field === "finger_size")?.value,
      "141",
    );
    assert.equal(
      result.currentSpecs.find((row) => row.field === "order_number")?.value,
      "140",
    );
    assert.equal(result.ringSizeStatus, "explicit");
    assert.deepEqual(result.proposedCorrections, [
      {
        field: "finger_size",
        label: "Finger size",
        currentValue: "141",
        candidateValue: "6.5",
        requiresFounderApproval: true,
        automaticApply: false,
      },
    ]);
    assert.equal(result.attachments.some((row) => row.filename === "cad-render.pdf"), true);
    assert.equal(result.attachments.some((row) => "attachmentId" in row), false);
    assert.equal(result.threadSummary.messageCount, 2);
    assert.equal(result.threadSummary.attachmentCount, 1);
    assertNoPii(JSON.stringify(result));
    assert.equal(connections.writes, 0);
  });

  it("rejects an arbitrary project id without fetching Gmail", async () => {
    const api = new MockGmailApi();
    api.setThread(ACHEDEKAL_THREAD);
    const connections = await connectedStore();
    const result = await reviewExact({
      requestedProjectId: OTHER_PROJECT_ID,
      projects: new RecordingLookup(
        new Map([
          [
            ACHEDEKAL_PROJECT_ID,
            pointer({
              projectId: ACHEDEKAL_PROJECT_ID,
              gmailThreadId: ACHEDEKAL_THREAD_ID,
            }),
          ],
        ]),
      ),
      connections,
      api,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.safeErrorCode, "project-not-found");
    assert.deepEqual(api.calls, []);
    assertSafeFailure(result);
  });

  it("does not present hedged size language as a clean proposed correction", () => {
    const view = presentAchedekalReview(
      buildExactThreadReconstructionHandoff({
        projectId: ACHEDEKAL_PROJECT_ID,
        currentSpecs: {
          fingerSize: "141",
          orderNumber: "140",
          cadJobNumber: "CAD-1",
          metal: "platinum",
          centerStone: null,
        },
        thread: protectExactThread(AMBIGUOUS_SIZE_THREAD),
      }),
    );
    assert.equal(view.ringSizeStatus, "ambiguous");
    assert.deepEqual(view.proposedCorrections, []);
    assert.equal(view.ambiguousSizeEvidence.length > 0, true);
    assert.equal(view.currentSpecs.find((row) => row.field === "finger_size")?.value, "141");
  });

  it("shows no explicit ring-size evidence and does not infer 141/140 adjacency", async () => {
    const api = new MockGmailApi();
    api.setThread(NO_EVIDENCE_THREAD);
    api.setThread(ADJACENCY_THREAD);
    const connections = await connectedStore();
    const none = await reviewExact({
      projects: new RecordingLookup(
        new Map([
          [
            ACHEDEKAL_PROJECT_ID,
            pointer({
              projectId: ACHEDEKAL_PROJECT_ID,
              gmailThreadId: NO_EVIDENCE_THREAD_ID,
            }),
          ],
        ]),
      ),
      connections,
      api,
    });
    assert.equal(none.ok, true);
    if (!none.ok) return;
    assert.equal(none.ringSizeStatus, "none");
    assert.deepEqual(none.proposedCorrections, []);
    assert.equal(none.currentSpecs.find((row) => row.field === "finger_size")?.value, "141");

    const adjacency = presentAchedekalReview(
      buildExactThreadReconstructionHandoff({
        projectId: ACHEDEKAL_PROJECT_ID,
        currentSpecs: {
          fingerSize: "141",
          orderNumber: "140",
          cadJobNumber: "CAD-1",
          metal: "platinum",
          centerStone: null,
        },
        thread: protectExactThread(ADJACENCY_THREAD),
      }),
    );
    assert.equal(adjacency.ringSizeStatus, "none");
    assert.deepEqual(adjacency.proposedCorrections, []);
    void AMBIGUOUS_SIZE_THREAD_ID;
    void ADJACENCY_THREAD_ID;
  });

  it("does not mutate project history, specs, or side systems", async () => {
    const memory = new InMemoryClientMemoryStore();
    await seedAchedekal(memory);
    const before = await memory.getProjectHistory(ACHEDEKAL_PROJECT_ID);
    const api = new MockGmailApi();
    api.setThread(ACHEDEKAL_THREAD);
    const connections = await connectedStore();
    const result = await reviewExact({
      projects: lookupFromStore(memory),
      connections,
      api,
    });
    assert.equal(result.ok, true);
    const after = await memory.getProjectHistory(ACHEDEKAL_PROJECT_ID);
    assert.equal(after?.fingerSize, "141");
    assert.equal(after?.orderNumber, "140");
    assert.equal(after?.gmailThreadId, ACHEDEKAL_THREAD_ID);
    assert.equal(before?.fingerSize, after?.fingerSize);
    assert.equal(memory.listProjectHistoryRevisions(ACHEDEKAL_PROJECT_ID).length, 0);
    assert.equal(connections.writes, 0);
    assert.equal(api.calls.some((call) => call.method !== "getThread"), false);
  });

  it("serializes fetch failures without Gmail or OAuth details", async () => {
    const api = new MockGmailApi();
    const connections = await connectedStore();
    const result = await reviewExact({
      projects: new RecordingLookup(
        new Map([
          [
            ACHEDEKAL_PROJECT_ID,
            pointer({
              projectId: ACHEDEKAL_PROJECT_ID,
              gmailThreadId: ACHEDEKAL_THREAD_ID,
            }),
          ],
        ]),
      ),
      connections,
      api,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.safeErrorCode, "gmail-thread-unavailable");
    assertSafeFailure(result);
  });

  it("keeps the founder route private, click-gated, one-project, and mutation-free", () => {
    const page = readFileSync(
      join(
        ROOT,
        "app/executive-dashboard/concierge/project-reconstruction/achedekal/page.tsx",
      ),
      "utf8",
    );
    const form = readFileSync(
      join(
        ROOT,
        "app/executive-dashboard/concierge/components/achedekal-review-form.tsx",
      ),
      "utf8",
    );
    const actions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/achedekal-review-actions.ts"),
      "utf8",
    );
    const review = readFileSync(join(ROOT, "lib/continuum/gmail/achedekal-review.ts"), "utf8");
    assert.match(page, /force-dynamic/);
    assert.match(page, /index: false/);
    assert.match(page, /getAuthenticatedProjectDeskReader/);
    assert.match(page, /ACHEDEKAL_PROJECT_ID/);
    assert.doesNotMatch(page, /runExactProjectThreadFetch|executeAchedekalEvidenceReview/);
    assert.doesNotMatch(page, /getThread|listMessages|getMessage/);
    assert.match(form, /Review Gmail evidence/);
    assert.match(form, /reviewAchedekalGmailEvidence/);
    assert.doesNotMatch(form, /Apply Correction|automaticApply: true/);
    assert.doesNotMatch(form, /formData\.get\(|hidden|threadId|gmail_thread/);
    assert.match(actions, /"use server"/);
    assert.match(actions, /getAuthenticatedGmailConnectionStore/);
    assert.match(actions, /founderSessionOk: true/);
    assert.match(actions, /ACHEDEKAL_PROJECT_ID/);
    assert.match(actions, /isPermittedAchedekalProjectId/);
    assert.match(actions, /getProjectHistory/);
    assert.doesNotMatch(actions, /formData\.get\(/);
    assert.doesNotMatch(actions, /correctProjectSpec|applyProjectSpecCorrection|correctProjectKind|saveProjectKindCorrection/);
    assert.doesNotMatch(actions, /insertProjectHistory|insertSourceNote|insertObservation/);
    assert.doesNotMatch(actions, /insertEvent|createOpenJob|chief-of-staff|today-5/);
    assert.doesNotMatch(review, /correctProjectSpec|applyProjectSpecCorrection|correctProjectKind|saveProjectKindCorrection/);
    assert.doesNotMatch(review, /console\.(log|info|debug|warn|error)/);
    assert.doesNotMatch(review, /gtag|analytics|localStorage/);
    assert.doesNotMatch(review, /\/messages\/[^?\s"'`]+\/attachments\//);
    assert.doesNotMatch(
      readFileSync(join(ROOT, "app/api/continuum/gmail/oauth/start/route.ts"), "utf8"),
      /reviewAchedekalGmailEvidence|executeAchedekalEvidenceReview/,
    );
  });
});
