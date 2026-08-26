/**
 * Server-only founder digital-card loader.
 * Checks the executive-dashboard session before constructing the service-role store.
 */

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";
import { saveOwnerDigitalCard } from "./owner";
import { createSupabaseDigitalCardStore } from "./server";
import type { DigitalCardStore } from "./store";
import type { DigitalCard, SaveDigitalCardInput, SaveDigitalCardResult } from "./types";

export type AuthenticatedDigitalCardAccess =
  | { ok: true; username: string; store: DigitalCardStore }
  | { ok: false; reason: "unauthorized" | "unavailable" };

export async function getAuthenticatedDigitalCardAccess(): Promise<AuthenticatedDigitalCardAccess> {
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
      username: session.username,
      store: createSupabaseDigitalCardStore(),
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export async function loadOwnerDigitalCard(): Promise<
  | { ok: true; username: string; card: DigitalCard | null }
  | { ok: false; reason: "unauthorized" | "unavailable" }
> {
  const auth = await getAuthenticatedDigitalCardAccess();
  if (!auth.ok) return auth;
  try {
    const card = await auth.store.getCardByOwner(auth.username);
    return { ok: true, username: auth.username, card };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export async function saveAuthenticatedDigitalCard(
  input: SaveDigitalCardInput,
): Promise<SaveDigitalCardResult> {
  const auth = await getAuthenticatedDigitalCardAccess();
  if (!auth.ok) {
    return { status: "unauthorized" };
  }
  return saveOwnerDigitalCard(
    {
      nowIso: () => new Date().toISOString(),
      newId: () => randomUUID(),
      ownerUsername: auth.username,
      getCardByOwner: (owner) => auth.store.getCardByOwner(owner),
      getCardBySlug: (slug) => auth.store.getCardBySlug(slug),
      upsertCard: (card) => auth.store.upsertCard(card),
    },
    input,
  );
}
