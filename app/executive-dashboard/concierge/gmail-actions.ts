"use server";

import { applyDisconnect, applyPause, applyResume } from "@/lib/continuum/gmail/connection";
import { getAuthenticatedGmailConnectionStore } from "@/lib/continuum/gmail/load";
import { liveGmailOAuthTokenExchanger } from "@/lib/continuum/gmail/oauth";
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
