/**
 * Server-only Gmail connection loader.
 * Founder executive-dashboard session required before service-role access.
 */

import { cookies } from "next/headers";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { createSupabaseGmailIndexStore } from "@/lib/continuum/client-memory/gmail/server";
import type { GmailIndexStore } from "@/lib/continuum/client-memory/gmail/store";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";
import type { GmailAttachmentStore } from "./attachments";
import type { GmailConnectionStore } from "./connection";
import { createSupabaseGmailAttachmentStore, createSupabaseGmailConnectionStore } from "./server";

export type AuthenticatedGmailConnectionStore =
  | { ok: true; store: GmailConnectionStore; username: string }
  | { ok: false; reason: "unauthorized" | "unavailable" };

export async function getAuthenticatedGmailConnectionStore(): Promise<AuthenticatedGmailConnectionStore> {
  const jar = await cookies();
  const session = requireInternalClientMemorySession(
    jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
  );
  if (!session.ok) {
    return { ok: false, reason: "unauthorized" };
  }
  try {
    return {
      ok: true,
      store: createSupabaseGmailConnectionStore(),
      username: session.username,
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export type AuthenticatedGmailHistoryStores =
  | {
      ok: true;
      connections: GmailConnectionStore;
      index: GmailIndexStore;
      attachments: GmailAttachmentStore;
      username: string;
    }
  | { ok: false; reason: "unauthorized" | "unavailable" };

export async function getAuthenticatedGmailHistoryStores(): Promise<AuthenticatedGmailHistoryStores> {
  const jar = await cookies();
  const session = requireInternalClientMemorySession(
    jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
  );
  if (!session.ok) {
    return { ok: false, reason: "unauthorized" };
  }
  try {
    return {
      ok: true,
      connections: createSupabaseGmailConnectionStore(),
      index: createSupabaseGmailIndexStore(),
      attachments: createSupabaseGmailAttachmentStore(),
      username: session.username,
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
