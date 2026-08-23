"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  EXECUTIVE_DASHBOARD_PASSKEY_ENROLL_ERROR,
  EXECUTIVE_DASHBOARD_PASSKEYS_PATH,
} from "@/lib/executive-dashboard/access";
import { getExecutiveDashboardAuthClientIp } from "@/lib/executive-dashboard/rate-limit";
import { shouldUseSecureExecutiveDashboardCookie } from "@/lib/executive-dashboard/session";
import {
  revokeFounderPasskey,
} from "@/lib/executive-dashboard/passkeys/authenticate";
import {
  PASSKEY_CHALLENGE_COOKIE,
  clearPasskeyChallengeCookieOptions,
  passkeyChallengeCookieOptions,
} from "@/lib/executive-dashboard/passkeys/challenges";
import {
  getFounderPasskeyRuntime,
  readFounderPasskeySession,
} from "@/lib/executive-dashboard/passkeys/load";
import { logPasskeyOperation } from "@/lib/executive-dashboard/passkeys/log";
import {
  checkPasskeyChallengeIssueRateLimit,
  checkPasskeyVerifyRateLimit,
  delayPasskeyFailure,
  recordPasskeyVerifyFailure,
} from "@/lib/executive-dashboard/passkeys/rate-limit";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/server";
import {
  beginPasskeyRegistration as beginPasskeyRegistrationFlow,
  completePasskeyRegistration as completePasskeyRegistrationFlow,
} from "@/lib/executive-dashboard/passkeys/register";

export type PasskeyEnrollBeginState =
  | { ok: true; options: PublicKeyCredentialCreationOptionsJSON }
  | { ok: false; error: string };

export type PasskeyEnrollCompleteState =
  | { ok: true }
  | { ok: false; error: string };

async function clientIp(): Promise<string> {
  const headerList = await headers();
  return getExecutiveDashboardAuthClientIp(headerList);
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

export async function beginPasskeyRegistration(): Promise<PasskeyEnrollBeginState> {
  const session = await readFounderPasskeySession();
  if (!session.ok) {
    logPasskeyOperation({
      op: "reg.challenge",
      ok: false,
      reason: "unauthenticated",
    });
    return { ok: false, error: EXECUTIVE_DASHBOARD_PASSKEY_ENROLL_ERROR };
  }

  const ip = await clientIp();
  if (!checkPasskeyChallengeIssueRateLimit(ip)) {
    logPasskeyOperation({
      op: "reg.challenge",
      ok: false,
      reason: "rate-limited",
    });
    await delayPasskeyFailure();
    return { ok: false, error: EXECUTIVE_DASHBOARD_PASSKEY_ENROLL_ERROR };
  }

  const runtime = getFounderPasskeyRuntime();
  if (!runtime.ok) {
    logPasskeyOperation({
      op: "reg.challenge",
      ok: false,
      reason: "unavailable",
    });
    return { ok: false, error: EXECUTIVE_DASHBOARD_PASSKEY_ENROLL_ERROR };
  }

  const result = await beginPasskeyRegistrationFlow(runtime, {
    sessionOk: true,
    sessionToken: session.token,
  });
  if (!result.ok) {
    logPasskeyOperation({
      op: "reg.challenge",
      ok: false,
      reason: result.reason,
    });
    return { ok: false, error: EXECUTIVE_DASHBOARD_PASSKEY_ENROLL_ERROR };
  }

  await setChallengeCookie(result.challengeToken);
  logPasskeyOperation({ op: "reg.challenge", ok: true, reason: "ok" });
  return { ok: true, options: result.options };
}

export async function completePasskeyRegistration(
  response: unknown,
  label?: string,
): Promise<PasskeyEnrollCompleteState> {
  const session = await readFounderPasskeySession();
  const ip = await clientIp();
  if (!checkPasskeyVerifyRateLimit(ip)) {
    logPasskeyOperation({
      op: "reg.verify",
      ok: false,
      reason: "rate-limited",
    });
    await delayPasskeyFailure();
    return { ok: false, error: EXECUTIVE_DASHBOARD_PASSKEY_ENROLL_ERROR };
  }

  const challengeToken = await readAndClearChallengeCookie();
  if (!session.ok) {
    recordPasskeyVerifyFailure(ip);
    logPasskeyOperation({
      op: "reg.verify",
      ok: false,
      reason: "unauthenticated",
    });
    return { ok: false, error: EXECUTIVE_DASHBOARD_PASSKEY_ENROLL_ERROR };
  }

  const runtime = getFounderPasskeyRuntime();
  if (!runtime.ok) {
    recordPasskeyVerifyFailure(ip);
    logPasskeyOperation({
      op: "reg.verify",
      ok: false,
      reason: "unavailable",
    });
    return { ok: false, error: EXECUTIVE_DASHBOARD_PASSKEY_ENROLL_ERROR };
  }

  const result = await completePasskeyRegistrationFlow(runtime, {
    sessionOk: true,
    sessionToken: session.token,
    challengeToken,
    response,
    label,
  });
  if (!result.ok) {
    recordPasskeyVerifyFailure(ip);
    logPasskeyOperation({
      op: "reg.verify",
      ok: false,
      reason: result.reason,
    });
    await delayPasskeyFailure();
    return { ok: false, error: EXECUTIVE_DASHBOARD_PASSKEY_ENROLL_ERROR };
  }

  logPasskeyOperation({ op: "reg.verify", ok: true, reason: "ok" });
  revalidatePath(EXECUTIVE_DASHBOARD_PASSKEYS_PATH);
  return { ok: true };
}

export async function revokePasskey(formData: FormData): Promise<void> {
  const session = await readFounderPasskeySession();
  const runtime = getFounderPasskeyRuntime();
  const id = String(formData.get("id") ?? "");
  if (!session.ok) {
    logPasskeyOperation({
      op: "reg.revoke",
      ok: false,
      reason: "unauthenticated",
    });
    return;
  }
  if (!runtime.ok) {
    logPasskeyOperation({
      op: "reg.revoke",
      ok: false,
      reason: "unavailable",
    });
    return;
  }
  const result = await revokeFounderPasskey(runtime, {
    sessionOk: true,
    id,
  });
  logPasskeyOperation({
    op: "reg.revoke",
    ok: result.ok,
    reason: result.ok ? "ok" : result.reason,
  });
  revalidatePath(EXECUTIVE_DASHBOARD_PASSKEYS_PATH);
}
