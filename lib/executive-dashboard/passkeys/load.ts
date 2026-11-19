/**
 * Server-only founder passkey loaders.
 * Session-gated management; login discovery is unauthenticated but
 * only reveals whether at least one passkey exists.
 */

import { cookies } from "next/headers";
import { readExecutiveDashboardSession } from "@/lib/executive-dashboard/access";
import { getExecutiveDashboardSessionConfig } from "@/lib/executive-dashboard/env";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";
import { simpleWebAuthnCrypto } from "./crypto";
import { InMemoryPasskeyChallengeLedger } from "./challenge-ledger";
import { InMemoryFounderPasskeyStore } from "./store";
import { CONTINUUM_FOUNDER_WEBAUTHN_USER_ID } from "./config";
import { isOperationalShadowBrowserE2eRuntime } from
  "@/lib/continuum/today-sterling/operational-shadow-browser-e2e-runtime";
import { createSupabaseFounderPasskeyStore, createSupabasePasskeyChallengeLedger, createSupabasePasskeyPairingStore } from "./server";
import type {
  FounderPasskeyRecord,
  FounderPasskeyStore,
  PasskeyChallengeLedger,
  PasskeyPairingStore,
} from "./types";

type BrowserE2ePasskeyState = {
  store: FounderPasskeyStore;
  challenges: PasskeyChallengeLedger;
};

const browserE2eGlobal = globalThis as typeof globalThis & {
  __continuumPasskeyBrowserE2e?: BrowserE2ePasskeyState;
};

function browserE2ePasskeyState(): BrowserE2ePasskeyState {
  if (!browserE2eGlobal.__continuumPasskeyBrowserE2e) {
    const store = new InMemoryFounderPasskeyStore();
    const credentialId = process.env.CONTINUUM_PASSKEY_BROWSER_E2E_CREDENTIAL_ID
      ?.trim();
    const publicKey = process.env.CONTINUUM_PASSKEY_BROWSER_E2E_PUBLIC_KEY
      ?.trim();
    if (credentialId && publicKey) {
      void store.insert({
        founderUserId: CONTINUUM_FOUNDER_WEBAUTHN_USER_ID,
        credentialId,
        publicKey: new Uint8Array(Buffer.from(publicKey, "base64url")),
        counter: 0,
        transports: ["internal"],
        deviceType: "singleDevice",
        backedUp: false,
        createdAt: new Date().toISOString(),
        label: "Synthetic browser authenticator",
      });
    }
    browserE2eGlobal.__continuumPasskeyBrowserE2e = {
      store,
      challenges: new InMemoryPasskeyChallengeLedger(),
    };
  }
  return browserE2eGlobal.__continuumPasskeyBrowserE2e;
}

export async function readFounderPasskeySession(): Promise<
  | { ok: true; username: string; token: string }
  | { ok: false; reason: string }
> {
  const jar = await cookies();
  const token = jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value;
  const session = await readExecutiveDashboardSession(token);
  if (!session.ok) return { ok: false, reason: session.reason };
  if (!token) return { ok: false, reason: "missing-session" };
  return { ok: true, username: session.username, token };
}

export function tryCreateFounderPasskeyStore(): FounderPasskeyStore | null {
  if (isOperationalShadowBrowserE2eRuntime()) {
    return browserE2ePasskeyState().store;
  }
  try {
    return createSupabaseFounderPasskeyStore();
  } catch {
    return null;
  }
}

export function tryCreatePasskeyChallengeLedger(): PasskeyChallengeLedger | null {
  if (isOperationalShadowBrowserE2eRuntime()) {
    return browserE2ePasskeyState().challenges;
  }
  try {
    return createSupabasePasskeyChallengeLedger();
  } catch {
    return null;
  }
}

export function tryCreatePasskeyPairingStore(): PasskeyPairingStore | null {
  try {
    return createSupabasePasskeyPairingStore();
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
  const config = getExecutiveDashboardSessionConfig();
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

export function getFounderPasskeyPairingRuntime():
  | {
      ok: true;
      store: FounderPasskeyStore;
      challenges: PasskeyChallengeLedger;
      pairings: PasskeyPairingStore;
      crypto: typeof simpleWebAuthnCrypto;
      secret: string;
      username: string;
    }
  | { ok: false; reason: "unavailable" } {
  const base = getFounderPasskeyRuntime();
  if (!base.ok) return base;
  const pairings = tryCreatePasskeyPairingStore();
  if (!pairings) return { ok: false, reason: "unavailable" };
  return { ...base, pairings };
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
