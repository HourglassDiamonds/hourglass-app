/**
 * Server-only founder passkey loaders.
 * Session-gated management; login discovery is unauthenticated but
 * only reveals whether at least one passkey exists.
 */

import { cookies } from "next/headers";
import { readExecutiveDashboardSession } from "@/lib/executive-dashboard/access";
import { getExecutiveDashboardAuthConfig } from "@/lib/executive-dashboard/env";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";
import { simpleWebAuthnCrypto } from "./crypto";
import { createSupabaseFounderPasskeyStore, createSupabasePasskeyChallengeLedger } from "./server";
import type {
  FounderPasskeyRecord,
  FounderPasskeyStore,
  PasskeyChallengeLedger,
} from "./types";

export async function readFounderPasskeySession(): Promise<
  | { ok: true; username: string; token: string }
  | { ok: false; reason: string }
> {
  const jar = await cookies();
  const token = jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value;
  const session = readExecutiveDashboardSession(token);
  if (!session.ok) return { ok: false, reason: session.reason };
  if (!token) return { ok: false, reason: "missing-session" };
  return { ok: true, username: session.username, token };
}

export function tryCreateFounderPasskeyStore(): FounderPasskeyStore | null {
  try {
    return createSupabaseFounderPasskeyStore();
  } catch {
    return null;
  }
}

export function tryCreatePasskeyChallengeLedger(): PasskeyChallengeLedger | null {
  try {
    return createSupabasePasskeyChallengeLedger();
  } catch {
    return null;
  }
}

export function getFounderPasskeyRuntime():
  | {
      ok: true;
      store: FounderPasskeyStore;
      challenges: PasskeyChallengeLedger;
      crypto: typeof simpleWebAuthnCrypto;
      secret: string;
      username: string;
    }
  | { ok: false; reason: "unavailable" } {
  const config = getExecutiveDashboardAuthConfig();
  if (!config.ok) return { ok: false, reason: "unavailable" };
  const store = tryCreateFounderPasskeyStore();
  const challenges = tryCreatePasskeyChallengeLedger();
  if (!store || !challenges) return { ok: false, reason: "unavailable" };
  return {
    ok: true,
    store,
    challenges,
    crypto: simpleWebAuthnCrypto,
    secret: config.sessionSecret,
    username: config.username,
  };
}

export async function founderPasskeysAreEnrolled(): Promise<boolean> {
  const store = tryCreateFounderPasskeyStore();
  if (!store) return false;
  try {
    return await store.hasActive();
  } catch {
    return false;
  }
}

export async function listActiveFounderPasskeys(): Promise<
  | { ok: true; passkeys: FounderPasskeyRecord[] }
  | { ok: false; reason: "unauthorized" | "unavailable" }
> {
  const session = await readFounderPasskeySession();
  if (!session.ok) return { ok: false, reason: "unauthorized" };
  const store = tryCreateFounderPasskeyStore();
  if (!store) return { ok: false, reason: "unavailable" };
  try {
    const rows = await store.list();
    return {
      ok: true,
      passkeys: rows.filter((row) => row.revokedAt == null),
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
