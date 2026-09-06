/**
 * Server-only founder Gmail → Project Artifact copy-in loader.
 * Does not run from incremental sync or background continuation.
 */

import { cookies } from "next/headers";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { createSupabaseProjectArtifactWriter } from "@/lib/continuum/client-memory/project-artifacts/server";
import type { ProjectArtifactWriter } from "@/lib/continuum/client-memory/project-artifacts/writer";
import { createSupabaseGmailIndexStore } from "@/lib/continuum/client-memory/gmail/server";
import type { GmailIndexStore } from "@/lib/continuum/client-memory/gmail/store";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";
import type { GmailAttachmentStore } from "@/lib/continuum/gmail/attachments";
import type { GmailConnectionStore } from "@/lib/continuum/gmail/connection";
import {
  createSupabaseGmailAttachmentStore,
  createSupabaseGmailConnectionStore,
} from "@/lib/continuum/gmail/server";

export type AuthenticatedGmailArtifactCopy =
  | {
      ok: true;
      writer: ProjectArtifactWriter;
      connections: GmailConnectionStore;
      index: GmailIndexStore;
      attachments: GmailAttachmentStore;
      username: string;
    }
  | { ok: false; reason: "unauthorized" | "unavailable" };

export async function getAuthenticatedGmailArtifactCopy(): Promise<AuthenticatedGmailArtifactCopy> {
  const jar = await cookies();
  const session = requireInternalClientMemorySession(
    jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
  );
  if (!session.ok) return { ok: false, reason: "unauthorized" };
  try {
    return {
      ok: true,
      writer: createSupabaseProjectArtifactWriter(),
      connections: createSupabaseGmailConnectionStore(),
      index: createSupabaseGmailIndexStore(),
      attachments: createSupabaseGmailAttachmentStore(),
      username: session.username,
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
