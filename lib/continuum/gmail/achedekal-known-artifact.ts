/**
 * Founder-only Achedekal known-artifact preview.
 * One project, one stored thread, one indexed JPEG.
 * Bytes are transient: Gmail → server memory → founder browser.
 * No persistence. No related-thread fetch. No other attachments.
 */

import type { GmailIndexStore } from "@/lib/continuum/client-memory/gmail/store";
import { coerceGmailThreadId } from "@/lib/continuum/client-memory/gmail";
import {
  ACHEDEKAL_KNOWN_ARTIFACT_BYTE_CAP,
  ACHEDEKAL_KNOWN_ARTIFACT_FILENAME,
  ACHEDEKAL_KNOWN_ARTIFACT_MIME,
  ACHEDEKAL_PROJECT_ID,
  isPermittedAchedekalProjectId,
} from "./achedekal-acceptance";
import type { GmailAttachmentStore } from "./attachments";
import type { GmailConnectionStore } from "./connection";
import type {
  ExactProjectThreadLookup,
  ExactProjectThreadPointer,
} from "./exact-thread";
import {
  decodeGmailAttachmentBytes,
  type KnownArtifactGmailApi,
} from "./known-artifact-gmail";
import type { GmailAccessTokenRefresh } from "./oauth";
import type { GmailAttachmentMeta, GmailConnection, GmailTokenCiphertext } from "./types";

export const ACHEDEKAL_KNOWN_ARTIFACT_ERROR_CODES = [
  "unauthorized",
  "forbidden",
  "unavailable",
  "artifact-unavailable",
] as const;

export type AchedekalKnownArtifactSafeErrorCode =
  (typeof ACHEDEKAL_KNOWN_ARTIFACT_ERROR_CODES)[number];

export type AchedekalKnownArtifactFailure = {
  ok: false;
  safeErrorCode: AchedekalKnownArtifactSafeErrorCode;
};

export type AchedekalKnownArtifactSuccess = {
  ok: true;
  safeErrorCode: null;
  mimeType: typeof ACHEDEKAL_KNOWN_ARTIFACT_MIME;
  bytes: Buffer;
  automaticApply: false;
};

export type AchedekalKnownArtifactResult =
  | AchedekalKnownArtifactFailure
  | AchedekalKnownArtifactSuccess;

export type AchedekalKnownArtifactInput = {
  founderSessionOk: boolean;
  requestedProjectId?: string | null;
  requestedThreadId?: string | null;
  requestedMessageId?: string | null;
  requestedAttachmentId?: string | null;
  requestedFilename?: string | null;
  requestedQuery?: string | null;
  projects: ExactProjectThreadLookup;
  index: GmailIndexStore;
  attachments: GmailAttachmentStore;
  connections: GmailConnectionStore;
  decryptRefreshToken: (wrapped: GmailTokenCiphertext) => string;
  refreshAccessToken: (refreshToken: string) => Promise<GmailAccessTokenRefresh>;
  createApi: (accessToken: string) => KnownArtifactGmailApi;
};

function isErrorCode(
  value: string | null,
): value is AchedekalKnownArtifactSafeErrorCode {
  return (
    typeof value === "string" &&
    (ACHEDEKAL_KNOWN_ARTIFACT_ERROR_CODES as readonly string[]).includes(value)
  );
}

export function failedAchedekalKnownArtifact(
  code: AchedekalKnownArtifactSafeErrorCode,
): AchedekalKnownArtifactFailure {
  return { ok: false, safeErrorCode: code };
}

export function sanitizeAchedekalKnownArtifactFailure(
  raw: AchedekalKnownArtifactFailure,
): AchedekalKnownArtifactFailure {
  const code = isErrorCode(raw.safeErrorCode)
    ? raw.safeErrorCode
    : "artifact-unavailable";
  return { ok: false, safeErrorCode: code };
}

function isConnectedCredential(
  row: GmailConnection | null,
): row is GmailConnection & { refreshToken: GmailTokenCiphertext } {
  return Boolean(row && row.status === "connected" && row.refreshToken);
}

function filenamesMatch(
  left: string | null | undefined,
  right: string,
): boolean {
  return (left ?? "").trim().toLowerCase() === right.trim().toLowerCase();
}

export function selectAchedekalKnownArtifact(
  storedThreadId: string,
  indexedMessageIds: ReadonlySet<string>,
  rows: readonly GmailAttachmentMeta[],
): GmailAttachmentMeta | null {
  const eligible = rows.filter((row) => {
    if (!filenamesMatch(row.filename, ACHEDEKAL_KNOWN_ARTIFACT_FILENAME)) {
      return false;
    }
    if ((row.mimeType ?? "").trim().toLowerCase() !== ACHEDEKAL_KNOWN_ARTIFACT_MIME) {
      return false;
    }
    if (row.threadId.trim() !== storedThreadId) return false;
    if (!row.attachmentId.trim()) return false;
    if (!row.messageId.trim()) return false;
    if (!indexedMessageIds.has(row.messageId)) return false;
    if (row.sizeBytes == null || !Number.isFinite(row.sizeBytes)) return false;
    if (row.sizeBytes <= 0 || row.sizeBytes > ACHEDEKAL_KNOWN_ARTIFACT_BYTE_CAP) {
      return false;
    }
    return true;
  });
  if (eligible.length !== 1) return null;
  return eligible[0] ?? null;
}

export async function executeAchedekalKnownArtifactPreview(
  input: AchedekalKnownArtifactInput,
): Promise<AchedekalKnownArtifactResult> {
  if (!input.founderSessionOk) {
    return failedAchedekalKnownArtifact("unauthorized");
  }

  void input.requestedProjectId;
  void input.requestedThreadId;
  void input.requestedMessageId;
  void input.requestedAttachmentId;
  void input.requestedFilename;
  void input.requestedQuery;

  let pointer: ExactProjectThreadPointer | null;
  try {
    pointer = await input.projects.getByProjectId(ACHEDEKAL_PROJECT_ID);
  } catch {
    return failedAchedekalKnownArtifact("unavailable");
  }
  if (
    !pointer ||
    !isPermittedAchedekalProjectId(pointer.projectId) ||
    pointer.projectId !== ACHEDEKAL_PROJECT_ID
  ) {
    return failedAchedekalKnownArtifact("artifact-unavailable");
  }

  const coerced = coerceGmailThreadId(pointer.gmailThreadId);
  if (coerced.status !== "canonical") {
    return failedAchedekalKnownArtifact("artifact-unavailable");
  }
  const storedThreadId = coerced.value;

  let indexedMessages;
  let indexedAttachments;
  try {
    indexedMessages = await input.index.listMessagesByThread(storedThreadId);
    indexedAttachments = await input.attachments.listByThread(storedThreadId);
  } catch {
    return failedAchedekalKnownArtifact("unavailable");
  }

  const indexedMessageIds = new Set(
    indexedMessages
      .filter((row) => row.threadId === storedThreadId)
      .map((row) => row.messageId),
  );
  const target = selectAchedekalKnownArtifact(
    storedThreadId,
    indexedMessageIds,
    indexedAttachments,
  );
  if (!target) {
    return failedAchedekalKnownArtifact("artifact-unavailable");
  }

  let connection: GmailConnection | null;
  try {
    connection = await input.connections.getFounderConnection();
  } catch {
    return failedAchedekalKnownArtifact("unavailable");
  }
  if (!isConnectedCredential(connection)) {
    return failedAchedekalKnownArtifact("unavailable");
  }

  let refreshToken: string;
  try {
    refreshToken = input.decryptRefreshToken(connection.refreshToken);
    if (!refreshToken) {
      return failedAchedekalKnownArtifact("unavailable");
    }
  } catch {
    return failedAchedekalKnownArtifact("unavailable");
  }

  let refreshed: GmailAccessTokenRefresh;
  try {
    refreshed = await input.refreshAccessToken(refreshToken);
  } catch {
    return failedAchedekalKnownArtifact("unavailable");
  }
  if (!refreshed.ok) {
    return failedAchedekalKnownArtifact("unavailable");
  }

  const api = input.createApi(refreshed.accessToken);
  try {
    const attachment = await api.getAttachment(target.messageId, target.attachmentId);
    const bytes = decodeGmailAttachmentBytes(attachment.data);
    if (!bytes || bytes.length === 0 || bytes.length > ACHEDEKAL_KNOWN_ARTIFACT_BYTE_CAP) {
      return failedAchedekalKnownArtifact("artifact-unavailable");
    }
    return {
      ok: true,
      safeErrorCode: null,
      mimeType: ACHEDEKAL_KNOWN_ARTIFACT_MIME,
      bytes,
      automaticApply: false,
    };
  } catch {
    return failedAchedekalKnownArtifact("artifact-unavailable");
  }
}
