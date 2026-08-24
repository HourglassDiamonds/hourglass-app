"use server";

import { headers } from "next/headers";
import { getExecutiveDashboardAuthClientIp } from "@/lib/executive-dashboard/rate-limit";
import {
  getFounderPasskeyPairingRuntime,
  readFounderPasskeySession,
} from "@/lib/executive-dashboard/passkeys/load";
import { logPasskeyOperation } from "@/lib/executive-dashboard/passkeys/log";
import {
  approveIphonePairing,
  cancelIphonePairing,
  createIphonePairing,
  readIphonePairingForDesktop,
  type PairingPublicView,
} from "@/lib/executive-dashboard/passkeys/pairing";
import {
  checkPasskeyChallengeIssueRateLimit,
  delayPasskeyFailure,
} from "@/lib/executive-dashboard/passkeys/rate-limit";

const PAIR_SETUP_ERROR = "Unable to start iPhone setup. Try again.";

export type CreateIphonePairingState =
  | {
      ok: true;
      pairingId: string;
      pairUrl: string;
      matchCode: string;
      expiresAt: string;
    }
  | { ok: false; error: string };

export type IphonePairingStatusState =
  | { ok: true; pairing: PairingPublicView }
  | { ok: false; error: string };

async function clientIp(): Promise<string> {
  const headerList = await headers();
  return getExecutiveDashboardAuthClientIp(headerList);
}

export async function createIphonePairingAction(): Promise<CreateIphonePairingState> {
  const session = await readFounderPasskeySession();
  if (!session.ok) {
    logPasskeyOperation({
      op: "pair.create",
      ok: false,
      reason: "unauthenticated",
    });
    return { ok: false, error: PAIR_SETUP_ERROR };
  }

  const ip = await clientIp();
  if (!checkPasskeyChallengeIssueRateLimit(ip)) {
    logPasskeyOperation({
      op: "pair.create",
      ok: false,
      reason: "rate-limited",
    });
    await delayPasskeyFailure();
    return { ok: false, error: PAIR_SETUP_ERROR };
  }

  const runtime = getFounderPasskeyPairingRuntime();
  if (!runtime.ok) {
    logPasskeyOperation({
      op: "pair.create",
      ok: false,
      reason: "unavailable",
    });
    return { ok: false, error: PAIR_SETUP_ERROR };
  }

  const result = await createIphonePairing(runtime, { sessionOk: true });
  if (!result.ok) {
    logPasskeyOperation({
      op: "pair.create",
      ok: false,
      reason: result.reason,
    });
    return { ok: false, error: PAIR_SETUP_ERROR };
  }

  logPasskeyOperation({
    op: "pair.create",
    ok: true,
    reason: "ok",
    pairingId: result.pairingId,
  });
  return {
    ok: true,
    pairingId: result.pairingId,
    pairUrl: result.pairUrl,
    matchCode: result.matchCode,
    expiresAt: result.expiresAt,
  };
}

export async function readIphonePairingStatusAction(
  pairingId: string,
): Promise<IphonePairingStatusState> {
  const session = await readFounderPasskeySession();
  const runtime = getFounderPasskeyPairingRuntime();
  if (!session.ok || !runtime.ok) {
    return { ok: false, error: PAIR_SETUP_ERROR };
  }
  const result = await readIphonePairingForDesktop(runtime, {
    sessionOk: true,
    pairingId,
  });
  if (!result.ok) {
    logPasskeyOperation({
      op: "pair.status",
      ok: false,
      reason: result.reason,
      pairingId,
    });
    return { ok: false, error: PAIR_SETUP_ERROR };
  }
  return { ok: true, pairing: result.pairing };
}

export async function approveIphonePairingAction(
  pairingId: string,
): Promise<IphonePairingStatusState> {
  const session = await readFounderPasskeySession();
  const runtime = getFounderPasskeyPairingRuntime();
  if (!session.ok) {
    logPasskeyOperation({
      op: "pair.approve",
      ok: false,
      reason: "unauthenticated",
      pairingId,
    });
    return { ok: false, error: PAIR_SETUP_ERROR };
  }
  if (!runtime.ok) {
    logPasskeyOperation({
      op: "pair.approve",
      ok: false,
      reason: "unavailable",
      pairingId,
    });
    return { ok: false, error: PAIR_SETUP_ERROR };
  }
  const result = await approveIphonePairing(runtime, {
    founderSessionOk: true,
    pairingId,
  });
  logPasskeyOperation({
    op: "pair.approve",
    ok: result.ok,
    reason: result.ok ? "ok" : result.reason,
    pairingId,
  });
  if (!result.ok) return { ok: false, error: PAIR_SETUP_ERROR };
  return { ok: true, pairing: result.pairing };
}

export async function cancelIphonePairingAction(
  pairingId: string,
): Promise<IphonePairingStatusState> {
  const session = await readFounderPasskeySession();
  const runtime = getFounderPasskeyPairingRuntime();
  if (!session.ok) {
    logPasskeyOperation({
      op: "pair.cancel",
      ok: false,
      reason: "unauthenticated",
      pairingId,
    });
    return { ok: false, error: PAIR_SETUP_ERROR };
  }
  if (!runtime.ok) {
    return { ok: false, error: PAIR_SETUP_ERROR };
  }
  const result = await cancelIphonePairing(runtime, {
    founderSessionOk: true,
    pairingId,
  });
  logPasskeyOperation({
    op: "pair.cancel",
    ok: result.ok,
    reason: result.ok ? "ok" : result.reason,
    pairingId,
  });
  if (!result.ok) return { ok: false, error: PAIR_SETUP_ERROR };
  return { ok: true, pairing: result.pairing };
}
