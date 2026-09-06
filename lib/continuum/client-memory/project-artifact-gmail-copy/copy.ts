/**
 * Founder-approved Gmail attachment → private Project Artifact copy-in.
 * COPY-IN only. No Gmail mutation. No incremental sync. No autonomous copy.
 * Attachment bytes are fetched only after explicit founder approval.
 */

import type { ClientMemoryEntity, ProjectProfile } from "../types";
import type { GmailIndexedMessage } from "../gmail/types";
import type { GmailAttachmentMeta } from "@/lib/continuum/gmail/types";
import type { GmailConnection, GmailTokenCiphertext } from "@/lib/continuum/gmail/types";
import type { GmailConnectionStore } from "@/lib/continuum/gmail/connection";
import type { GmailAccessTokenRefresh } from "@/lib/continuum/gmail/oauth";
import {
  decodeGmailAttachmentBytes,
  type KnownArtifactGmailApi,
} from "@/lib/continuum/gmail/known-artifact-gmail";
import {
  PROJECT_ARTIFACTS_BUCKET,
  PROJECT_ARTIFACT_MAX_BYTES,
  type ProjectArtifact,
} from "../project-artifacts/types";
import {
  isProjectArtifactKind,
  isProjectArtifactUuid,
  parseArtifactBytes,
  parseArtifactCreatedBy,
  parseArtifactTitle,
  parseOriginalFilename,
} from "../project-artifacts/validate";
import { artifactSourceIdentityKey, projectArtifactObjectPath } from "../project-artifacts/storage";
import type { CreateProjectArtifactApplyResult } from "../project-artifacts/create";
import { isProjectArtifactWriteError } from "../project-artifacts/write-error";
import { GMAIL_COPY_APPROVAL } from "./constants";
import { mapGmailCopyArtifactKind } from "./kind";
import { previewGmailCopyMime, resolveGmailCopyMime } from "./mime";
import {
  GMAIL_COPY_SOURCE_SYSTEM,
  gmailCopyIdentityPrefix,
  packGmailCopySourceRef,
  parseGmailAttachmentId,
  parseGmailCopyId,
} from "./source-ref";

export { GMAIL_COPY_APPROVAL } from "./constants";

export const GMAIL_COPY_ERROR_CODES = [
  "unauthorized",
  "approval-required",
  "invalid-input",
  "project-not-found",
  "entity-kind-mismatch",
  "attachment-not-indexed",
  "unsupported-mime",
  "oversized",
  "identity-too-long",
  "gmail-attachment-failed",
  "storage-failed",
  "db-failed",
  "unavailable",
] as const;

export type GmailCopyErrorCode = (typeof GMAIL_COPY_ERROR_CODES)[number];

export type CopyGmailAttachmentToProjectResult =
  | {
      ok: true;
      status: "created" | "already-present";
      artifact: ProjectArtifact;
      fetchedAttachment: boolean;
    }
  | {
      ok: false;
      reason: GmailCopyErrorCode;
      fetchedAttachment: boolean;
    };

export type CopyGmailAttachmentToProjectInput = {
  founderSessionOk: boolean;
  approval: string | null | undefined;
  mutationId: string;
  projectId: string;
  messageId: string;
  attachmentId: string;
  kind: string;
  title: string;
  actor: string;
};

export type CopyGmailAttachmentToProjectDeps = {
  nowIso: () => string;
  newArtifactId: () => string;
  getEntity: (id: string) => Promise<Pick<ClientMemoryEntity, "kind"> | null>;
  getProjectProfile: (projectId: string) => Promise<ProjectProfile | null>;
  getIndexedMessage: (messageId: string) => Promise<GmailIndexedMessage | null>;
  getIndexedAttachment: (
    messageId: string,
    attachmentId: string,
  ) => Promise<GmailAttachmentMeta | null>;
  findByIdentityKey: (identityKey: string) => Promise<ProjectArtifact | null>;
  applyPreparedCreate: (
    artifact: ProjectArtifact,
    bytes: Uint8Array,
    identityKey?: string | null,
  ) => Promise<CreateProjectArtifactApplyResult>;
  removeStoredObject: (storagePath: string) => Promise<void>;
  connections: GmailConnectionStore;
  decryptRefreshToken: (wrapped: GmailTokenCiphertext) => string;
  refreshAccessToken: (refreshToken: string) => Promise<GmailAccessTokenRefresh>;
  createApi: (accessToken: string) => KnownArtifactGmailApi;
};

function failed(
  reason: GmailCopyErrorCode,
  fetchedAttachment = false,
): CopyGmailAttachmentToProjectResult {
  return { ok: false, reason, fetchedAttachment };
}

function isConnectedCredential(
  row: GmailConnection | null,
): row is GmailConnection & { refreshToken: GmailTokenCiphertext } {
  return Boolean(row && row.status === "connected" && row.refreshToken);
}

function titleFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").trim() || filename;
  return base.slice(0, 160);
}

export async function copyGmailAttachmentToProject(
  deps: CopyGmailAttachmentToProjectDeps,
  input: CopyGmailAttachmentToProjectInput,
): Promise<CopyGmailAttachmentToProjectResult> {
  if (!input.founderSessionOk) return failed("unauthorized");
  if ((input.approval ?? "").trim() !== GMAIL_COPY_APPROVAL) {
    return failed("approval-required");
  }

  const mutationId = input.mutationId.trim();
  const projectId = input.projectId.trim();
  if (!isProjectArtifactUuid(mutationId) || !isProjectArtifactUuid(projectId)) {
    return failed("invalid-input");
  }
  const messageId = parseGmailCopyId(input.messageId);
  const attachmentId = parseGmailAttachmentId(input.attachmentId);
  if (!messageId || !attachmentId) return failed("invalid-input");
  const kind = mapGmailCopyArtifactKind(input.kind);
  if (!kind || !isProjectArtifactKind(kind)) return failed("invalid-input");
  const createdBy = parseArtifactCreatedBy(input.actor);
  if (!createdBy.ok) return failed("invalid-input");

  try {
    const entity = await deps.getEntity(projectId);
    if (!entity) return failed("project-not-found");
    if (entity.kind !== "project") return failed("entity-kind-mismatch");
    const profile = await deps.getProjectProfile(projectId);
    if (!profile || profile.projectId !== projectId) {
      return failed("project-not-found");
    }

    const indexedAttachment = await deps.getIndexedAttachment(
      messageId,
      attachmentId,
    );
    if (!indexedAttachment) return failed("attachment-not-indexed");
    if (indexedAttachment.messageId !== messageId) {
      return failed("attachment-not-indexed");
    }
    if (indexedAttachment.attachmentId !== attachmentId) {
      return failed("attachment-not-indexed");
    }

    const indexedMessage = await deps.getIndexedMessage(messageId);
    if (!indexedMessage || indexedMessage.messageId !== messageId) {
      return failed("attachment-not-indexed");
    }
    if (indexedMessage.threadId !== indexedAttachment.threadId) {
      return failed("attachment-not-indexed");
    }

    const filename = parseOriginalFilename(indexedAttachment.filename);
    if (!filename.ok) return failed("invalid-input");
    const titleParsed = parseArtifactTitle(
      input.title.trim() ? input.title : titleFromFilename(filename.filename),
    );
    if (!titleParsed.ok) return failed("invalid-input");

    const packed = packGmailCopySourceRef({
      messageId,
      attachmentId,
      threadId: indexedAttachment.threadId,
      sentAt: indexedMessage.sentAt,
      fromEmailHash: indexedMessage.fromEmailHash,
    });
    if (!packed.ok) return failed("identity-too-long");

    const identityKey = artifactSourceIdentityKey(
      projectId,
      GMAIL_COPY_SOURCE_SYSTEM,
      gmailCopyIdentityPrefix(messageId, attachmentId),
    );
    const existing = await deps.findByIdentityKey(identityKey);
    if (existing) {
      return {
        ok: true,
        status: "already-present",
        artifact: existing,
        fetchedAttachment: false,
      };
    }

    if (
      typeof indexedAttachment.sizeBytes === "number" &&
      indexedAttachment.sizeBytes > PROJECT_ARTIFACT_MAX_BYTES
    ) {
      return failed("oversized");
    }

    const previewMime = previewGmailCopyMime(
      indexedAttachment.mimeType,
      filename.filename,
    );
    if (previewMime === "unsupported-mime") return failed("unsupported-mime");

    let connection: GmailConnection | null;
    try {
      connection = await deps.connections.getFounderConnection();
    } catch {
      return failed("unavailable");
    }
    if (!isConnectedCredential(connection)) return failed("unavailable");

    let refreshToken: string;
    try {
      refreshToken = deps.decryptRefreshToken(connection.refreshToken);
      if (!refreshToken) return failed("unavailable");
    } catch {
      return failed("unavailable");
    }

    let refreshed: GmailAccessTokenRefresh;
    try {
      refreshed = await deps.refreshAccessToken(refreshToken);
    } catch {
      return failed("unavailable");
    }
    if (!refreshed.ok) return failed("unavailable");

    const api = deps.createApi(refreshed.accessToken);
    let fetched = false;
    let bytes: Uint8Array;
    try {
      const attachment = await api.getAttachment(messageId, attachmentId);
      fetched = true;
      const decoded = decodeGmailAttachmentBytes(attachment.data);
      if (!decoded || decoded.length === 0) {
        return failed("gmail-attachment-failed", true);
      }
      bytes = new Uint8Array(decoded);
    } catch {
      return failed("gmail-attachment-failed", fetched);
    }

    const parsedBytes = parseArtifactBytes(bytes);
    if (!parsedBytes.ok) return failed("oversized", true);

    const mime = resolveGmailCopyMime(
      indexedAttachment.mimeType,
      parsedBytes.bytes,
      filename.filename,
    );
    if (!mime.ok) return failed("unsupported-mime", true);

    const artifactId = deps.newArtifactId();
    const storagePath = projectArtifactObjectPath(
      projectId,
      artifactId,
      mime.mimeType,
    );
    if (!storagePath) return failed("unsupported-mime", true);

    const artifact: ProjectArtifact = {
      artifactId,
      projectId,
      kind,
      title: titleParsed.title,
      originalFilename: filename.filename,
      mimeType: mime.mimeType,
      byteSize: parsedBytes.bytes.byteLength,
      storageBucket: PROJECT_ARTIFACTS_BUCKET,
      storagePath,
      createdAt: deps.nowIso(),
      createdBy: createdBy.createdBy,
      sourceSystem: GMAIL_COPY_SOURCE_SYSTEM,
      sourceRef: packed.sourceRef,
      createdMutationId: mutationId,
    };

    try {
      const written = await deps.applyPreparedCreate(
        artifact,
        parsedBytes.bytes,
        identityKey,
      );
      return {
        ok: true,
        status: written.status,
        artifact: written.artifact,
        fetchedAttachment: true,
      };
    } catch (error) {
      if (isProjectArtifactWriteError(error)) {
        if (error.phase === "storage") return failed("storage-failed", true);
        if (error.storagePath) {
          try {
            await deps.removeStoredObject(error.storagePath);
          } catch {
            return failed("db-failed", true);
          }
        }
        return failed("db-failed", true);
      }
      return failed("unavailable", true);
    }
  } catch {
    return failed("unavailable");
  }
}
