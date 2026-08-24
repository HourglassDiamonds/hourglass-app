"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  EXECUTIVE_DASHBOARD_CONCIERGE_PATH,
  EXECUTIVE_DASHBOARD_PASSKEY_ENROLL_ERROR,
  EXECUTIVE_DASHBOARD_PASSKEY_PAIR_ERROR,
} from "@/lib/executive-dashboard/access";
import { issueExecutiveDashboardSession } from "@/lib/executive-dashboard/issue-session";
import { getExecutiveDashboardAuthClientIp } from "@/lib/executive-dashboard/rate-limit";
import { shouldUseSecureExecutiveDashboardCookie } from "@/lib/executive-dashboard/session";
import { getFounderPasskeyPairingRuntime } from "@/lib/executive-dashboard/passkeys/load";
import { logPasskeyOperation } from "@/lib/executive-dashboard/passkeys/log";
import {
  beginIphonePairingRegistration,
  claimIphonePairing,
  completeIphonePairingRegistration,
  readIphonePairingForPhone,
  type PairingPublicView,
} from "@/lib/executive-dashboard/passkeys/pairing";
import {
  PASSKEY_CHALLENGE_COOKIE,
  clearPasskeyChallengeCookieOptions,
  passkeyChallengeCookieOptions,
} from "@/lib/executive-dashboard/passkeys/challenges";
import {
  PASSKEY_PAIRING_COOKIE,
  clearPasskeyPairingCookieOptions,
  passkeyPairingCookieOptions,
} from "@/lib/executive-dashboard/passkeys/pairing-token";
import {
  checkPasskeyChallengeIssueRateLimit,
  checkPasskeyVerifyRateLimit,
  delayPasskeyFailure,
  recordPasskeyVerifyFailure,
} from "@/lib/executive-dashboard/passkeys/rate-limit";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/server";

export type PhonePairingViewState =
  | { ok: true; pairing: PairingPublicView }
  | { ok: false; error: string };

export type PhonePairingBeginState =
  | { ok: true; options: PublicKeyCredentialCreationOptionsJSON }
  | { ok: false; error: string };

export type PhonePairingCompleteState =
  | { ok: true }
  | { ok: false; error: string };

async function clientIp(): Promise<string> {
  const headerList = await headers();
  return getExecutiveDashboardAuthClientIp(headerList);
}

async function setPairingCookie(token: string, maxAgeSec: number): Promise<void> {
  const jar = await cookies();
  jar.set(
    PASSKEY_PAIRING_COOKIE,
    token,
    passkeyPairingCookieOptions(
      shouldUseSecureExecutiveDashboardCookie(),
      maxAgeSec,
    ),
  );
}

async function readPairingCookie(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(PASSKEY_PAIRING_COOKIE)?.value;
}

async function clearPairingCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(
    PASSKEY_PAIRING_COOKIE,
    "",
    clearPasskeyPairingCookieOptions(shouldUseSecureExecutiveDashboardCookie()),
  );
}

async function setChallengeCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(
    PASSKEY_CHALLENGE_COOKIE,
    token,
    passkeyChallengeCookieOptions(shouldUseSecureExecutiveDashboardCookie()),
  );
}

async function readAndClearChallengeCookie(): Promise<string | undefined> {
  const jar = await cookies();
  const token = jar.get(PASSKEY_CHALLENGE_COOKIE)?.value;
  jar.set(
    PASSKEY_CHALLENGE_COOKIE,
    "",
    clearPasskeyChallengeCookieOptions(shouldUseSecureExecutiveDashboardCookie()),
  );
  return token;
}

export async function claimIphonePairingFromTokenAction(
  rawToken: string,
): Promise<PhonePairingViewState> {
  const runtime = getFounderPasskeyPairingRuntime();
  if (!runtime.ok) {
    logPasskeyOperation({ op: "pair.claim", ok: false, reason: "unavailable" });
    return { ok: false, error: EXECUTIVE_DASHBOARD_PASSKEY_PAIR_ERROR };
  }
  const headerList = await headers();
  const result = await claimIphonePairing(runtime, {
    rawToken,
    userAgent: headerList.get("user-agent"),
  });
  if (!result.ok) {
    logPasskeyOperation({
      op: "pair.claim",
      ok: false,
      reason: result.reason,
    });
    return { ok: false, error: EXECUTIVE_DASHBOARD_PASSKEY_PAIR_ERROR };
  }
  await setPairingCookie(result.pairingCookie, result.cookieMaxAgeSec);
  logPasskeyOperation({
    op: "pair.claim",
    ok: true,
    reason: "ok",
    pairingId: result.pairing.id,
  });
  return { ok: true, pairing: result.pairing };
}

export async function readPhonePairingAction(): Promise<PhonePairingViewState> {
  const runtime = getFounderPasskeyPairingRuntime();
  if (!runtime.ok) {
    return { ok: false, error: EXECUTIVE_DASHBOARD_PASSKEY_PAIR_ERROR };
  }
  const result = await readIphonePairingForPhone(runtime, {
    pairingCookie: await readPairingCookie(),
  });
  if (!result.ok) {
    return { ok: false, error: EXECUTIVE_DASHBOARD_PASSKEY_PAIR_ERROR };
  }
  return { ok: true, pairing: result.pairing };
}

export async function beginIphonePairingRegistrationAction(): Promise<PhonePairingBeginState> {
  const ip = await clientIp();
  if (!checkPasskeyChallengeIssueRateLimit(ip)) {
    logPasskeyOperation({
      op: "pair.reg.challenge",
      ok: false,
      reason: "rate-limited",
    });
    await delayPasskeyFailure();
    return { ok: false, error: EXECUTIVE_DASHBOARD_PASSKEY_ENROLL_ERROR };
  }
  const runtime = getFounderPasskeyPairingRuntime();
  if (!runtime.ok) {
    return { ok: false, error: EXECUTIVE_DASHBOARD_PASSKEY_PAIR_ERROR };
  }
  const result = await beginIphonePairingRegistration(runtime, {
    pairingCookie: await readPairingCookie(),
  });
  if (!result.ok) {
    logPasskeyOperation({
      op: "pair.reg.challenge",
      ok: false,
      reason: result.reason,
    });
    return {
      ok: false,
      error:
        result.reason === "pairing-not-approved"
          ? EXECUTIVE_DASHBOARD_PASSKEY_PAIR_ERROR
          : EXECUTIVE_DASHBOARD_PASSKEY_ENROLL_ERROR,
    };
  }
  await setChallengeCookie(result.challengeToken);
  logPasskeyOperation({ op: "pair.reg.challenge", ok: true, reason: "ok" });
  return { ok: true, options: result.options };
}

export async function completeIphonePairingRegistrationAction(
  response: unknown,
): Promise<PhonePairingCompleteState> {
  const ip = await clientIp();
  if (!checkPasskeyVerifyRateLimit(ip)) {
    logPasskeyOperation({
      op: "pair.reg.verify",
      ok: false,
      reason: "rate-limited",
    });
    await delayPasskeyFailure();
    return { ok: false, error: EXECUTIVE_DASHBOARD_PASSKEY_ENROLL_ERROR };
  }

  const runtime = getFounderPasskeyPairingRuntime();
  const challengeToken = await readAndClearChallengeCookie();
  if (!runtime.ok) {
    recordPasskeyVerifyFailure(ip);
    return { ok: false, error: EXECUTIVE_DASHBOARD_PASSKEY_PAIR_ERROR };
  }

  const result = await completeIphonePairingRegistration(runtime, {
    pairingCookie: await readPairingCookie(),
    challengeToken,
    response,
    label: "iPhone",
  });
  if (!result.ok) {
    recordPasskeyVerifyFailure(ip);
    logPasskeyOperation({
      op: "pair.reg.verify",
      ok: false,
      reason: result.reason,
    });
    await delayPasskeyFailure();
    return { ok: false, error: EXECUTIVE_DASHBOARD_PASSKEY_ENROLL_ERROR };
  }

  logPasskeyOperation({
    op: "pair.reg.verify",
    ok: true,
    reason: "ok",
  });
  await issueExecutiveDashboardSession(runtime.username, runtime.secret);
  await clearPairingCookie();
  redirect(EXECUTIVE_DASHBOARD_CONCIERGE_PATH);
}
