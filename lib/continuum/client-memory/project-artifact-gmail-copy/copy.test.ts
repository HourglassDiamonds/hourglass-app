import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { InMemoryClientMemoryStore } from "../store";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "../types";
import { InMemoryGmailIndexStore } from "../gmail/store";
import { InMemoryGmailAttachmentStore } from "@/lib/continuum/gmail/attachments";
import {
  connectFounderMailbox,
  InMemoryGmailConnectionStore,
} from "@/lib/continuum/gmail/connection";
import { MockKnownArtifactGmailApi } from "@/lib/continuum/gmail/known-artifact-gmail";
import { GMAIL_READONLY_SCOPE, type GmailTokenCiphertext } from "@/lib/continuum/gmail/types";
import {
  createInMemoryProjectArtifactWriter,
} from "../project-artifacts/writer";
import { InMemoryProjectArtifactStore } from "../project-artifacts/store";
import { PROJECT_ARTIFACT_MAX_BYTES } from "../project-artifacts/types";
import { artifactSourceIdentityKey } from "../project-artifacts/storage";
import {
  copyGmailAttachmentToProject,
  GMAIL_COPY_APPROVAL,
  type CopyGmailAttachmentToProjectDeps,
  type CopyGmailAttachmentToProjectInput,
} from "./copy";
import { parseGmailCopySourceRef } from "./source-ref";
import { GMAIL_COPY_SOURCE_SYSTEM, gmailCopyIdentityPrefix } from "./source-ref";

const NOW = "2026-09-06T16:00:00.000Z";
const ACTOR = "justin";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]);
const PNG_DATA = Buffer.from(PNG).toString("base64url");
const MSG = "msg-copy-1";
const ATT = "att-copy-1";
const THREAD = "thread-copy-1";
const TOKEN: GmailTokenCiphertext = {
  alg: "aes-256-gcm",
  version: 1,
  iv: "aa",
  tag: "bb",
  ciphertext: "cc",
};

async function seedProject(store: InMemoryClientMemoryStore) {
  const person = await store.insertEntity({
    kind: "person",
    createdAt: NOW,
    createdBy: "test",
  });
  await store.insertPersonProfile({
    personId: person.record.id,
    displayName: "Ada Lovelace",
    givenName: "Ada",
    familyName: "Lovelace",
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
  const project = await store.insertEntity({
    kind: "project",
    createdAt: NOW,
    createdBy: "test",
  });
  await store.insertProjectProfile({
    projectId: project.record.id,
    displayTitle: "Oval ring",
    visibility: "internal-only",
    importRowKey: `continuum-gmail-copy-15:${randomUUID()}`,
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: NOW,
    updatedAt: NOW,
    projectKind: null,
  });
  return { personId: person.record.id, projectId: project.record.id };
}

async function connectedStore() {
  const store = new InMemoryGmailConnectionStore();
  await store.putConnection(
    connectFounderMailbox({
      existing: null,
      mailboxEmailHash: "ab".repeat(32),
      refreshToken: TOKEN,
      grantedScope: GMAIL_READONLY_SCOPE,
      providerTokenType: "Bearer",
      now: NOW,
    }),
  );
  return store;
}

async function seedIndexed(input: {
  index: InMemoryGmailIndexStore;
  attachments: InMemoryGmailAttachmentStore;
  mimeType?: string | null;
  filename?: string | null;
  sizeBytes?: number | null;
}) {
  await input.index.indexMessage(
    {
      messageId: MSG,
      threadId: THREAD,
      sentAt: NOW,
      subject: "Render attached",
      fromEmail: "cad@example.com",
      direction: "inbound",
      hasAttachments: true,
    },
    NOW,
  );
  await input.attachments.putAttachment({
    attachmentId: ATT,
    messageId: MSG,
    threadId: THREAD,
    filename: input.filename === undefined ? "render-1.png" : input.filename,
    mimeType: input.mimeType === undefined ? "image/png" : input.mimeType,
    sizeBytes: input.sizeBytes === undefined ? PNG.byteLength : input.sizeBytes,
    indexedAt: NOW,
  });
}

async function harness(
  extra: {
    mimeType?: string | null;
    filename?: string | null;
    sizeBytes?: number | null;
    failBytes?: boolean;
    failInsert?: boolean;
    apiError?: Error;
    skipAttachmentSeed?: boolean;
  } = {},
) {
  const memory = new InMemoryClientMemoryStore();
  const artifacts = new InMemoryProjectArtifactStore();
  if (extra.failBytes) artifacts.failNextBytes = true;
  if (extra.failInsert) artifacts.failNextInsert = true;
  const writer = createInMemoryProjectArtifactWriter(memory, artifacts, () => NOW);
  const seeded = await seedProject(memory);
  const index = new InMemoryGmailIndexStore();
  const attachments = new InMemoryGmailAttachmentStore();
  if (!extra.skipAttachmentSeed) {
    await seedIndexed({
      index,
      attachments,
      mimeType: extra.mimeType,
      filename: extra.filename,
      sizeBytes: extra.sizeBytes,
    });
  }
  const api = new MockKnownArtifactGmailApi();
  if (extra.apiError) {
    api.errors.set(`getAttachment:${MSG}:${ATT}`, extra.apiError);
  } else {
    api.setAttachment(MSG, ATT, { data: PNG_DATA, size: PNG.byteLength });
  }
  const createApiCalls = { count: 0 };
  const deps: CopyGmailAttachmentToProjectDeps = {
    nowIso: () => NOW,
    newArtifactId: () => randomUUID(),
    getEntity: (id) => memory.getEntity(id),
    getProjectProfile: (projectId) => memory.getProjectProfile(projectId),
    getIndexedMessage: (messageId) => index.getMessage(messageId),
    getIndexedAttachment: async (messageId, attachmentId) => {
      const rows = await attachments.listByMessage(messageId);
      return rows.find((row) => row.attachmentId === attachmentId) ?? null;
    },
    findByIdentityKey: (identityKey) => writer.findByIdentityKey(identityKey),
    applyPreparedCreate: (artifact, bytes, identityKey) =>
      writer.applyPreparedCreate(artifact, bytes, identityKey),
    removeStoredObject: (storagePath) => writer.removeStoredObject(storagePath),
    connections: await connectedStore(),
    decryptRefreshToken: () => "refresh-keep",
    refreshAccessToken: async () => ({ ok: true, accessToken: "access-in-memory-only" }),
    createApi: (token) => {
      createApiCalls.count += 1;
      assert.equal(token, "access-in-memory-only");
      return api;
    },
  };
  const input: CopyGmailAttachmentToProjectInput = {
    founderSessionOk: true,
    approval: GMAIL_COPY_APPROVAL,
    mutationId: randomUUID(),
    projectId: seeded.projectId,
    messageId: MSG,
    attachmentId: ATT,
    kind: "render",
    title: "Render 1",
    actor: ACTOR,
  };
  return { deps, input, api, createApiCalls, artifacts, writer, seeded, memory };
}

describe("Gmail attachment copy-in", () => {
  it("rejects unauthenticated and unapproved requests before attachment fetch", async () => {
    const unauth = await harness();
    const denied = await copyGmailAttachmentToProject(unauth.deps, {
      ...unauth.input,
      founderSessionOk: false,
    });
    assert.equal(denied.ok, false);
    if (denied.ok) return;
    assert.equal(denied.reason, "unauthorized");
    assert.equal(denied.fetchedAttachment, false);
    assert.equal(unauth.createApiCalls.count, 0);
    assert.deepEqual(unauth.api.calls, []);

    const unapproved = await harness();
    const missing = await copyGmailAttachmentToProject(unapproved.deps, {
      ...unapproved.input,
      approval: null,
    });
    assert.equal(missing.ok, false);
    if (missing.ok) return;
    assert.equal(missing.reason, "approval-required");
    assert.equal(unapproved.createApiCalls.count, 0);
    assert.deepEqual(unapproved.api.calls, []);
  });

  it("binds the copy to the explicit Project and retains Gmail provenance", async () => {
    const { deps, input, api, artifacts, seeded } = await harness();
    const result = await copyGmailAttachmentToProject(deps, input);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.status, "created");
    assert.equal(result.fetchedAttachment, true);
    assert.equal(result.artifact.projectId, seeded.projectId);
    assert.equal(result.artifact.sourceSystem, "gmail");
    assert.equal(result.artifact.originalFilename, "render-1.png");
    assert.equal(result.artifact.mimeType, "image/png");
    assert.equal(result.artifact.storageBucket, "continuum-project-artifacts");
    assert.match(result.artifact.storagePath, new RegExp(seeded.projectId));
    assert.equal(result.artifact.createdAt, NOW);
    const provenance = parseGmailCopySourceRef(result.artifact.sourceRef);
    assert.ok(provenance);
    assert.equal(provenance?.messageId, MSG);
    assert.equal(provenance?.attachmentId, ATT);
    assert.equal(provenance?.threadId, THREAD);
    assert.equal(provenance?.sentAt, NOW);
    assert.equal(typeof provenance?.fromEmailHash, "string");
    assert.deepEqual(api.calls, [
      { method: "getAttachment", messageId: MSG, attachmentId: ATT },
    ]);
    assert.equal(artifacts.listArtifacts(seeded.projectId).length, 1);
    const bytes = artifacts.getBytes(result.artifact.artifactId);
    assert.ok(bytes);
    assert.equal(bytes?.byteLength, PNG.byteLength);
  });

  it("does not fetch when the same Gmail identity is already copied into the Project", async () => {
    const first = await harness();
    const created = await copyGmailAttachmentToProject(first.deps, first.input);
    assert.equal(created.ok, true);
    const second = await copyGmailAttachmentToProject(first.deps, {
      ...first.input,
      mutationId: randomUUID(),
      title: "Render 1 again",
    });
    assert.equal(second.ok, true);
    if (!second.ok || !created.ok) return;
    assert.equal(second.status, "already-present");
    assert.equal(second.fetchedAttachment, false);
    assert.equal(second.artifact.artifactId, created.artifact.artifactId);
    assert.equal(first.api.calls.length, 1);
    assert.equal(first.artifacts.listArtifacts().length, 1);
  });

  it("does not dedupe merely on filename across Projects", async () => {
    const first = await harness();
    const created = await copyGmailAttachmentToProject(first.deps, first.input);
    assert.equal(created.ok, true);
    const other = await seedProject(first.memory);
    const copied = await copyGmailAttachmentToProject(first.deps, {
      ...first.input,
      mutationId: randomUUID(),
      projectId: other.projectId,
    });
    assert.equal(copied.ok, true);
    if (!copied.ok || !created.ok) return;
    assert.equal(copied.status, "created");
    assert.notEqual(copied.artifact.artifactId, created.artifact.artifactId);
    assert.equal(first.artifacts.listArtifacts().length, 2);
  });

  it("rejects unsupported MIME before fetch and does not guess from filename", async () => {
    const zip = await harness({
      mimeType: "application/zip",
      filename: "render-1.png",
    });
    const result = await copyGmailAttachmentToProject(zip.deps, zip.input);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "unsupported-mime");
    assert.equal(zip.createApiCalls.count, 0);
    assert.deepEqual(zip.api.calls, []);
    assert.equal(zip.artifacts.listArtifacts().length, 0);
  });

  it("rejects octet-stream unless a supported filename and magic bytes prove an allowed type", async () => {
    const unsafe = await harness({ mimeType: "application/octet-stream" });
    unsafe.api.setAttachment(MSG, ATT, {
      data: Buffer.from([0x00, 0x01, 0x02, 0x03]).toString("base64url"),
      size: 4,
    });
    const denied = await copyGmailAttachmentToProject(unsafe.deps, unsafe.input);
    assert.equal(denied.ok, false);
    if (denied.ok) return;
    assert.equal(denied.reason, "unsupported-mime");
    assert.equal(denied.fetchedAttachment, true);

    const safe = await harness({ mimeType: "application/octet-stream" });
    const accepted = await copyGmailAttachmentToProject(safe.deps, safe.input);
    assert.equal(accepted.ok, true);
    if (!accepted.ok) return;
    assert.equal(accepted.artifact.mimeType, "image/png");

    const exe = await harness({
      mimeType: "application/octet-stream",
      filename: "payload.exe",
    });
    const blocked = await copyGmailAttachmentToProject(exe.deps, exe.input);
    assert.equal(blocked.ok, false);
    if (blocked.ok) return;
    assert.equal(blocked.reason, "unsupported-mime");
    assert.equal(exe.createApiCalls.count, 0);
    assert.deepEqual(exe.api.calls, []);
  });

  it("rejects oversized metadata without fetching bytes", async () => {
    const oversized = await harness({
      sizeBytes: PROJECT_ARTIFACT_MAX_BYTES + 1,
    });
    const result = await copyGmailAttachmentToProject(
      oversized.deps,
      oversized.input,
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "oversized");
    assert.equal(oversized.createApiCalls.count, 0);
    assert.deepEqual(oversized.api.calls, []);
  });

  it("maps Gmail attachment failure, storage failure, and DB failure without partial rows", async () => {
    const gmailFail = await harness({ apiError: new Error("gmail-attachment-missing") });
    const missing = await copyGmailAttachmentToProject(gmailFail.deps, gmailFail.input);
    assert.equal(missing.ok, false);
    if (missing.ok) return;
    assert.equal(missing.reason, "gmail-attachment-failed");
    assert.equal(gmailFail.artifacts.listArtifacts().length, 0);

    const storageFail = await harness({ failBytes: true });
    const stored = await copyGmailAttachmentToProject(
      storageFail.deps,
      storageFail.input,
    );
    assert.equal(stored.ok, false);
    if (stored.ok) return;
    assert.equal(stored.reason, "storage-failed");
    assert.equal(storageFail.artifacts.listArtifacts().length, 0);

    const dbFail = await harness({ failInsert: true });
    const db = await copyGmailAttachmentToProject(dbFail.deps, dbFail.input);
    assert.equal(db.ok, false);
    if (db.ok) return;
    assert.equal(db.reason, "db-failed");
    assert.equal(dbFail.artifacts.listArtifacts().length, 0);
    const identity = artifactSourceIdentityKey(
      dbFail.input.projectId,
      GMAIL_COPY_SOURCE_SYSTEM,
      gmailCopyIdentityPrefix(MSG, ATT),
    );
    assert.equal(await dbFail.writer.findByIdentityKey(identity), null);
    for (const row of dbFail.artifacts.listArtifacts()) {
      assert.equal(dbFail.artifacts.getBytes(row.artifactId), null);
    }
  });

  it("does not copy without an indexed attachment or a real Project", async () => {
    const missing = await harness({ skipAttachmentSeed: true });
    const notIndexed = await copyGmailAttachmentToProject(
      missing.deps,
      missing.input,
    );
    assert.equal(notIndexed.ok, false);
    if (notIndexed.ok) return;
    assert.equal(notIndexed.reason, "attachment-not-indexed");
    assert.equal(missing.createApiCalls.count, 0);

    const wrong = await harness();
    const asPerson = await copyGmailAttachmentToProject(wrong.deps, {
      ...wrong.input,
      projectId: wrong.seeded.personId,
    });
    assert.equal(asPerson.ok, false);
    if (asPerson.ok) return;
    assert.equal(asPerson.reason, "entity-kind-mismatch");
    assert.equal(wrong.createApiCalls.count, 0);
  });
});
