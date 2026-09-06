"use server";

/**
 * Founder-only Gmail attachment COPY-IN. Explicit approval required.
 * Does not run from incremental sync, history continuation, or AI.
 */

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { copyGmailAttachmentToProject } from "@/lib/continuum/client-memory/project-artifact-gmail-copy/copy";
import type { CopyGmailAttachmentToProjectResult } from "@/lib/continuum/client-memory/project-artifact-gmail-copy/copy";
import { getAuthenticatedGmailArtifactCopy } from "@/lib/continuum/client-memory/project-artifact-gmail-copy/load";
import { createSupabaseClientMemoryStore } from "@/lib/continuum/client-memory/persistence/supabase";
import { conciergeProjectPath } from "@/lib/continuum/client-memory/read/presentation";
import { createLiveKnownArtifactGmailApi } from "@/lib/continuum/gmail/known-artifact-gmail";
import { liveGmailAccessTokenRefresher } from "@/lib/continuum/gmail/oauth";
import { decryptRefreshToken, loadGmailTokenKek } from "@/lib/continuum/gmail/token-crypto";

export type CopyGmailProjectArtifactState =
  | { ok: false; message: string; duplicate: false }
  | { ok: true; duplicate: true; message: string }
  | null;

function humanCopyMessage(
  result: CopyGmailAttachmentToProjectResult,
): string {
  if (result.ok) return "Unable to copy the Gmail file.";
  if (result.reason === "unauthorized") return "Sign in to continue.";
  if (result.reason === "approval-required") {
    return "Copy to project requires an explicit founder action.";
  }
  if (result.reason === "project-not-found" || result.reason === "entity-kind-mismatch") {
    return "That project could not be found.";
  }
  if (result.reason === "attachment-not-indexed") {
    return "That Gmail attachment is not in the indexed evidence.";
  }
  if (result.reason === "unsupported-mime") {
    return "That file type is not supported for project files.";
  }
  if (result.reason === "oversized") return "That file is over 25 MB.";
  if (result.reason === "gmail-attachment-failed") {
    return "Gmail could not provide the attachment.";
  }
  if (result.reason === "storage-failed" || result.reason === "db-failed") {
    return "Unable to store the project file.";
  }
  if (result.reason === "identity-too-long") {
    return "That Gmail attachment identity is too long to record.";
  }
  return "Unable to copy the Gmail file.";
}

export async function copyGmailProjectArtifact(
  _prev: CopyGmailProjectArtifactState,
  formData: FormData,
): Promise<CopyGmailProjectArtifactState> {
  const auth = await getAuthenticatedGmailArtifactCopy();
  if (!auth.ok) {
    return {
      ok: false,
      duplicate: false,
      message:
        auth.reason === "unauthorized"
          ? "Sign in to continue."
          : "Unable to copy the Gmail file.",
    };
  }
  const kek = loadGmailTokenKek();
  if (!kek.ok) {
    return {
      ok: false,
      duplicate: false,
      message: "Unable to copy the Gmail file.",
    };
  }

  let memory: ReturnType<typeof createSupabaseClientMemoryStore>;
  try {
    memory = createSupabaseClientMemoryStore();
  } catch {
    return {
      ok: false,
      duplicate: false,
      message: "Unable to copy the Gmail file.",
    };
  }

  const projectId = String(formData.get("projectId") ?? "").trim();
  const result = await copyGmailAttachmentToProject(
    {
      nowIso: () => new Date().toISOString(),
      newArtifactId: () => randomUUID(),
      getEntity: (id) => memory.getEntity(id),
      getProjectProfile: (projectIdValue) =>
        memory.getProjectProfile(projectIdValue),
      getIndexedMessage: (messageId) => auth.index.getMessage(messageId),
      getIndexedAttachment: async (messageId, attachmentId) => {
        const rows = await auth.attachments.listByMessage(messageId);
        return rows.find((row) => row.attachmentId === attachmentId) ?? null;
      },
      findByIdentityKey: (identityKey) => auth.writer.findByIdentityKey(identityKey),
      applyPreparedCreate: (artifact, bytes, identityKey) =>
        auth.writer.applyPreparedCreate(artifact, bytes, identityKey),
      removeStoredObject: (storagePath) =>
        auth.writer.removeStoredObject(storagePath),
      connections: auth.connections,
      decryptRefreshToken: (wrapped) => decryptRefreshToken(wrapped, kek.key),
      refreshAccessToken: (refreshToken) =>
        liveGmailAccessTokenRefresher.refreshAccessToken(refreshToken),
      createApi: (accessToken) => createLiveKnownArtifactGmailApi(accessToken),
    },
    {
      founderSessionOk: true,
      approval: String(formData.get("approval") ?? ""),
      mutationId: String(formData.get("mutationId") ?? "").trim(),
      projectId,
      messageId: String(formData.get("messageId") ?? ""),
      attachmentId: String(formData.get("attachmentId") ?? ""),
      kind: String(formData.get("kind") ?? ""),
      title: String(formData.get("title") ?? ""),
      actor: auth.username,
    },
  );

  if (result.ok && result.status === "already-present") {
    return {
      ok: true,
      duplicate: true,
      message: "That Gmail file is already a project file.",
    };
  }
  if (result.ok) {
    redirect(`${conciergeProjectPath(projectId)}?saved=file`);
  }
  return {
    ok: false,
    duplicate: false,
    message: humanCopyMessage(result),
  };
}
