"use server";

import { createLiveGmailApi } from "@/lib/continuum/gmail/adapter";
import { applyDisconnect, applyPause, applyResume } from "@/lib/continuum/gmail/connection";
import {
  failedGmailConnectionTest,
  readOnlyGmailConnectionStore,
  runGmailConnectionTest,
  type GmailConnectionTestResult,
} from "@/lib/continuum/gmail/connection-test";
import { getAuthenticatedGmailConnectionStore } from "@/lib/continuum/gmail/load";
import {
  liveGmailAccessTokenRefresher,
  liveGmailOAuthTokenExchanger,
} from "@/lib/continuum/gmail/oauth";
import { decryptRefreshToken, loadGmailTokenKek } from "@/lib/continuum/gmail/token-crypto";

export type GmailConnectionControlState =
  | { ok: true; status: "paused" | "connected" | "disconnected" }
  | { ok: false; error: "unauthorized" | "unavailable" | "connection-inactive" };

async function withStore() {
  return getAuthenticatedGmailConnectionStore();
}

export async function pauseGmailConnection(): Promise<GmailConnectionControlState> {
  const auth = await withStore();
  if (!auth.ok) return { ok: false, error: auth.reason };
  try {
    await applyPause(auth.store, new Date().toISOString());
    return { ok: true, status: "paused" };
  } catch {
    return { ok: false, error: "connection-inactive" };
  }
}

export async function resumeGmailConnection(): Promise<GmailConnectionControlState> {
  const auth = await withStore();
  if (!auth.ok) return { ok: false, error: auth.reason };
  try {
    await applyResume(auth.store, new Date().toISOString());
    return { ok: true, status: "connected" };
  } catch {
    return { ok: false, error: "connection-inactive" };
  }
}

export async function disconnectGmailConnection(): Promise<GmailConnectionControlState> {
  const auth = await withStore();
  if (!auth.ok) return { ok: false, error: auth.reason };
  const kek = loadGmailTokenKek();
  if (!kek.ok) return { ok: false, error: "unavailable" };
  try {
    await applyDisconnect({
      store: auth.store,
      now: new Date().toISOString(),
      decryptRefreshToken: (wrapped) => decryptRefreshToken(wrapped, kek.key),
      revokeToken: (token) => liveGmailOAuthTokenExchanger.revokeToken(token),
    });
    return { ok: true, status: "disconnected" };
  } catch {
    return { ok: false, error: "connection-inactive" };
  }
}

export async function testGmailConnection(
  _prev: GmailConnectionTestResult | null,
  _formData: FormData,
): Promise<GmailConnectionTestResult> {
  const auth = await getAuthenticatedGmailConnectionStore();
  if (!auth.ok) {
    return failedGmailConnectionTest(
      auth.reason === "unauthorized" ? "unauthorized" : "unavailable",
    );
  }
  const kek = loadGmailTokenKek();
  if (!kek.ok) return failedGmailConnectionTest("decrypt-failed");
  return runGmailConnectionTest({
    founderSessionOk: true,
    connections: readOnlyGmailConnectionStore(auth.store),
    decryptRefreshToken: (wrapped) => decryptRefreshToken(wrapped, kek.key),
    refreshAccessToken: (refreshToken) =>
      liveGmailAccessTokenRefresher.refreshAccessToken(refreshToken),
    createApi: (accessToken) => createLiveGmailApi(accessToken),
  });
}
