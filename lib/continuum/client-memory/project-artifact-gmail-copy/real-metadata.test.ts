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
import { createInMemoryProjectArtifactWriter } from "../project-artifacts/writer";
import { InMemoryProjectArtifactStore } from "../project-artifacts/store";
import {
  PROJECT_ARTIFACT_KINDS,
  PROJECT_ARTIFACT_MAX_BYTES,
  PROJECT_ARTIFACT_SOURCE_REF_MAX,
} from "../project-artifacts/types";
import { parseArtifactBytes } from "../project-artifacts/validate";
import {
  copyGmailAttachmentToProject,
  GMAIL_COPY_APPROVAL,
  type CopyGmailAttachmentToProjectDeps,
} from "./copy";
import { parseGmailCopySourceRef } from "./source-ref";
import {
  previewGmailCopyMime,
  resolveGmailCopyMime,
} from "./mime";

const NOW = "2026-09-06T16:00:00.000Z";
const ACTOR = "justin";
const TOKEN: GmailTokenCiphertext = {
  alg: "aes-256-gcm",
  version: 1,
  iv: "aa",
  tag: "bb",
  ciphertext: "cc",
};

const REAL_MESSAGE_ID = "19c4f8a2b1e90d3f";
const REAL_THREAD_ID = "19c4f8a2b1e90d40";
const REAL_FILENAME = "Pennock CAD finger render.JPG";
const SARAH_FILENAME = "CAD Finger Render.JPG";

function realAttachmentId(length = 426): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  let out = "ANGjdJ8_";
  while (out.length < length) {
    out += alphabet[out.length % alphabet.length];
  }
  return out.slice(0, length);
}

function jpegOfSize(byteLength: number): Uint8Array {
  const bytes = new Uint8Array(byteLength);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  bytes.fill(0x11, 3);
  return bytes;
}

const JPEG = jpegOfSize(64);
const JPEG_DATA = Buffer.from(JPEG).toString("base64url");
const REAL_ATTACHMENT_ID = realAttachmentId(426);

async function seedProject(store: InMemoryClientMemoryStore) {
  const person = await store.insertEntity({
    kind: "person",
    createdAt: NOW,
    createdBy: "test",
  });
  await store.insertPersonProfile({
    personId: person.record.id,
    displayName: "Pennock",
    givenName: "Pennock",
    familyName: null,
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
    displayTitle: "Pennock ring",
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

async function harness(extra: {
  messageId?: string;
  attachmentId?: string;
  threadId?: string;
  filename?: string;
  mimeType?: string | null;
  kind?: string;
  bytes?: Uint8Array;
  sizeBytes?: number | null;
} = {}) {
  const messageId = extra.messageId ?? REAL_MESSAGE_ID;
  const attachmentId = extra.attachmentId ?? REAL_ATTACHMENT_ID;
  const threadId = extra.threadId ?? REAL_THREAD_ID;
  const filename = extra.filename ?? REAL_FILENAME;
  const bytes = extra.bytes ?? JPEG;
  const memory = new InMemoryClientMemoryStore();
  const artifacts = new InMemoryProjectArtifactStore();
  const writer = createInMemoryProjectArtifactWriter(memory, artifacts, () => NOW);
  const seeded = await seedProject(memory);
  const index = new InMemoryGmailIndexStore();
  const attachments = new InMemoryGmailAttachmentStore();
  await index.indexMessage(
    {
      messageId,
      threadId,
      sentAt: NOW,
      subject: "CAD presentation",
      fromEmail: "sarah@example.com",
      direction: "inbound",
      hasAttachments: true,
    },
    NOW,
  );
  await attachments.putAttachment({
    attachmentId,
    messageId,
    threadId,
    filename,
    mimeType: extra.mimeType === undefined ? "image/jpeg" : extra.mimeType,
    sizeBytes: extra.sizeBytes === undefined ? bytes.byteLength : extra.sizeBytes,
    indexedAt: NOW,
  });
  const api = new MockKnownArtifactGmailApi();
  api.setAttachment(messageId, attachmentId, {
    data: Buffer.from(bytes).toString("base64url"),
    size: bytes.byteLength,
  });
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
  return {
    deps,
    input: {
      founderSessionOk: true,
      approval: GMAIL_COPY_APPROVAL,
      mutationId: randomUUID(),
      projectId: seeded.projectId,
      messageId,
      attachmentId,
      kind: extra.kind ?? "cad_render",
      title: "Pennock CAD",
      actor: ACTOR,
    },
    api,
    createApiCalls,
    artifacts,
    writer,
    seeded,
    memory,
    index,
    attachments,
    bytes,
  };
}

describe("Gmail copy-in real-metadata provenance", () => {
  it("accepts a current-manifest Gmail attachment id and keeps every provenance field", async () => {
    assert.ok(REAL_ATTACHMENT_ID.length >= 426);
    const { deps, input, artifacts, seeded } = await harness();
    const result = await copyGmailAttachmentToProject(deps, input);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.status, "created");
    assert.equal(result.artifact.sourceSystem, "gmail");
    assert.equal(result.artifact.kind, "cad");
    assert.equal(
      (PROJECT_ARTIFACT_KINDS as readonly string[]).includes(result.artifact.kind),
      true,
    );
    assert.equal(
      ["cad_render", "vendor_paperwork", "client_image"].includes(result.artifact.kind),
      false,
    );
    assert.ok((result.artifact.sourceRef?.length ?? 0) > PROJECT_ARTIFACT_SOURCE_REF_MAX);
    const provenance = parseGmailCopySourceRef(result.artifact.sourceRef);
    assert.ok(provenance);
    assert.equal(provenance?.messageId, REAL_MESSAGE_ID);
    assert.equal(provenance?.attachmentId, REAL_ATTACHMENT_ID);
    assert.equal(provenance?.threadId, REAL_THREAD_ID);
    assert.equal(provenance?.sentAt, NOW);
    assert.equal(typeof provenance?.fromEmailHash, "string");
    assert.equal(provenance?.fromEmailHash?.length, 64);
    assert.equal(result.artifact.sourceRef, [
      "gm1",
      REAL_MESSAGE_ID,
      REAL_ATTACHMENT_ID,
      REAL_THREAD_ID,
      NOW,
      provenance?.fromEmailHash,
    ].join("|"));
    assert.equal(artifacts.listArtifacts(seeded.projectId).length, 1);
  });

  it("treats the long Gmail identity as the duplicate key, not the filename", async () => {
    const first = await harness();
    const created = await copyGmailAttachmentToProject(first.deps, first.input);
    assert.equal(created.ok, true);
    const again = await copyGmailAttachmentToProject(first.deps, {
      ...first.input,
      mutationId: randomUUID(),
      title: "Pennock CAD again",
    });
    assert.equal(again.ok, true);
    if (!again.ok || !created.ok) return;
    assert.equal(again.status, "already-present");
    assert.equal(again.fetchedAttachment, false);
    assert.equal(again.artifact.artifactId, created.artifact.artifactId);
    assert.equal(first.api.calls.length, 1);

    const otherProject = await seedProject(first.memory);
    const other = await copyGmailAttachmentToProject(first.deps, {
      ...first.input,
      mutationId: randomUUID(),
      projectId: otherProject.projectId,
    });
    assert.equal(other.ok, true);
    if (!other.ok) return;
    assert.equal(other.status, "created");
    assert.notEqual(other.artifact.artifactId, created.artifact.artifactId);

    const otherSourceId = realAttachmentId(430);
    await first.index.indexMessage(
      {
        messageId: "19aabbccddeeff01",
        threadId: "19aabbccddeeff02",
        sentAt: NOW,
        subject: "Another CAD",
        fromEmail: "sarah@example.com",
        direction: "inbound",
        hasAttachments: true,
      },
      NOW,
    );
    await first.attachments.putAttachment({
      attachmentId: otherSourceId,
      messageId: "19aabbccddeeff01",
      threadId: "19aabbccddeeff02",
      filename: REAL_FILENAME,
      mimeType: "image/jpeg",
      sizeBytes: JPEG.byteLength,
      indexedAt: NOW,
    });
    first.api.setAttachment("19aabbccddeeff01", otherSourceId, {
      data: JPEG_DATA,
      size: JPEG.byteLength,
    });
    const sameName = await copyGmailAttachmentToProject(first.deps, {
      ...first.input,
      mutationId: randomUUID(),
      messageId: "19aabbccddeeff01",
      attachmentId: otherSourceId,
    });
    assert.equal(sameName.ok, true);
    if (!sameName.ok) return;
    assert.equal(sameName.status, "created");
    assert.equal(sameName.artifact.originalFilename, REAL_FILENAME);
    assert.notEqual(sameName.artifact.artifactId, created.artifact.artifactId);
    assert.equal(first.artifacts.listArtifacts(first.seeded.projectId).length, 2);
  });

  it("rejects a Gmail identity that still exceeds 2048 after the bounded expansion", async () => {
    const overlong = realAttachmentId(2000);
    const { deps, input, createApiCalls, api, artifacts } = await harness({
      attachmentId: overlong,
    });
    const result = await copyGmailAttachmentToProject(deps, input);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "identity-too-long");
    assert.equal(result.fetchedAttachment, false);
    assert.equal(createApiCalls.count, 0);
    assert.deepEqual(api.calls, []);
    assert.equal(artifacts.listArtifacts().length, 0);
  });

  it("normalizes Sarah octet-stream CAD images from filename plus magic, not filename alone", async () => {
    assert.equal(
      previewGmailCopyMime("application/octet-stream", SARAH_FILENAME),
      "needs-bytes",
    );
    assert.equal(
      previewGmailCopyMime("application/octet-stream", "payload.exe"),
      "unsupported-mime",
    );
    const filenameOnly = resolveGmailCopyMime(
      "application/octet-stream",
      null,
      SARAH_FILENAME,
    );
    assert.equal(filenameOnly.ok, false);
    const { deps, input, createApiCalls } = await harness({
      filename: SARAH_FILENAME,
      mimeType: "application/octet-stream",
      kind: "CAD finger render",
    });
    const result = await copyGmailAttachmentToProject(deps, input);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.artifact.mimeType, "image/jpeg");
    assert.equal(result.artifact.kind, "cad");
    assert.equal(result.artifact.originalFilename, SARAH_FILENAME);
    assert.ok(createApiCalls.count >= 1);

    const spoofed = await harness({
      filename: SARAH_FILENAME,
      mimeType: "application/octet-stream",
      bytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]),
    });
    const denied = await copyGmailAttachmentToProject(spoofed.deps, spoofed.input);
    assert.equal(denied.ok, false);
    if (denied.ok) return;
    assert.equal(denied.reason, "unsupported-mime");
    assert.equal(denied.fetchedAttachment, true);
    assert.equal(spoofed.artifacts.listArtifacts().length, 0);
  });

  it("accepts 1 MB and 8 MB JPEGs under the live 25 MB artifact limit", async () => {
    const oneMb = jpegOfSize(1 * 1024 * 1024);
    const eightMb = jpegOfSize(8 * 1024 * 1024);
    assert.equal(parseArtifactBytes(oneMb).ok, true);
    assert.equal(parseArtifactBytes(eightMb).ok, true);
    assert.ok(oneMb.byteLength < PROJECT_ARTIFACT_MAX_BYTES);
    assert.ok(eightMb.byteLength < PROJECT_ARTIFACT_MAX_BYTES);
    const first = await harness({
      bytes: oneMb,
      sizeBytes: oneMb.byteLength,
      kind: "cad",
    });
    const copiedOne = await copyGmailAttachmentToProject(first.deps, first.input);
    assert.equal(copiedOne.ok, true);
    if (!copiedOne.ok) return;
    assert.equal(copiedOne.artifact.byteSize, oneMb.byteLength);
    assert.equal(copiedOne.artifact.mimeType, "image/jpeg");

    const second = await harness({
      bytes: eightMb,
      sizeBytes: eightMb.byteLength,
      attachmentId: realAttachmentId(428),
      kind: "cad",
    });
    const copiedEight = await copyGmailAttachmentToProject(second.deps, second.input);
    assert.equal(copiedEight.ok, true);
    if (!copiedEight.ok) return;
    assert.equal(copiedEight.artifact.byteSize, eightMb.byteLength);
  });
});
