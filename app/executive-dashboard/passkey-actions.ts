"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  EXECUTIVE_DASHBOARD_PASSKEY_AUTH_ERROR,
  executiveDashboardPostLoginPath,
} from "@/lib/executive-dashboard/access";
import { issueExecutiveDashboardSession } from "@/lib/executive-dashboard/issue-session";
import {
  clearExecutiveDashboardLoginFailures,
  getExecutiveDashboardAuthClientIp,
} from "@/lib/executive-dashboard/rate-limit";
import { shouldUseSecureExecutiveDashboardCookie } from "@/lib/executive-dashboard/session";
import {
  beginPasskeyAuthentication as beginPasskeyAuthenticationFlow,
  completePasskeyAuthentication as completePasskeyAuthenticationFlow,
} from "@/lib/executive-dashboard/passkeys/authenticate";
import {
  PASSKEY_CHALLENGE_COOKIE,
  clearPasskeyChallengeCookieOptions,
  passkeyChallengeCookieOptions,
} from "@/lib/executive-dashboard/passkeys/challenges";
import { getFounderPasskeyRuntime } from "@/lib/executive-dashboard/passkeys/load";
import { logPasskeyOperation } from "@/lib/executive-dashboard/passkeys/log";
import {
  checkPasskeyChallengeIssueRateLimit,
  checkPasskeyVerifyRateLimit,
  clearPasskeyVerifyFailures,
  delayPasskeyFailure,
  recordPasskeyVerifyFailure,
} from "@/lib/executive-dashboard/passkeys/rate-limit";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/server";

export type PasskeyAuthBeginState =
  | { ok: true; options: PublicKeyCredentialRequestOptionsJSON }
  | { ok: false; error: string };

export type PasskeyAuthCompleteState =
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

export async function beginPasskeyAuthentication(): Promise<PasskeyAuthBeginState> {
  const ip = await clientIp();
  if (!checkPasskeyChallengeIssueRateLimit(ip)) {
    logPasskeyOperation({
      op: "auth.challenge",
      ok: false,
      reason: "rate-limited",
    });
    await delayPasskeyFailure();
    return { ok: false, error: EXECUTIVE_DASHBOARD_PASSKEY_AUTH_ERROR };
  }

  const runtime = getFounderPasskeyRuntime();
  if (!runtime.ok) {
    logPasskeyOperation({
      op: "auth.challenge",
      ok: false,
      reason: "unavailable",
    });
    return { ok: false, error: EXECUTIVE_DASHBOARD_PASSKEY_AUTH_ERROR };
  }

  const result = await beginPasskeyAuthenticationFlow(runtime);
  if (!result.ok) {
    logPasskeyOperation({
      op: "auth.challenge",
      ok: false,
      reason: result.reason,
    });
    return { ok: false, error: EXECUTIVE_DASHBOARD_PASSKEY_AUTH_ERROR };
  }

  await setChallengeCookie(result.challengeToken);
  logPasskeyOperation({ op: "auth.challenge", ok: true, reason: "ok" });
  return { ok: true, options: result.options };
}

export async function completePasskeyAuthentication(
  response: unknown,
): Promise<PasskeyAuthCompleteState> {
  const ip = await clientIp();
  if (!checkPasskeyVerifyRateLimit(ip)) {
    logPasskeyOperation({
      op: "auth.verify",
      ok: false,
      reason: "rate-limited",
    });
    await delayPasskeyFailure();
    return { ok: false, error: EXECUTIVE_DASHBOARD_PASSKEY_AUTH_ERROR };
  }

  const runtime = getFounderPasskeyRuntime();
  const challengeToken = await readAndClearChallengeCookie();
  if (!runtime.ok) {
    recordPasskeyVerifyFailure(ip);
    logPasskeyOperation({
      op: "auth.verify",
      ok: false,
      reason: "unavailable",
    });
    await delayPasskeyFailure();
    return { ok: false, error: EXECUTIVE_DASHBOARD_PASSKEY_AUTH_ERROR };
  }

  const result = await completePasskeyAuthenticationFlow(runtime, {
    challengeToken,
    response,
  });
  if (!result.ok) {
    recordPasskeyVerifyFailure(ip);
    logPasskeyOperation({
      op: "auth.verify",
      ok: false,
      reason: result.reason,
    });
    await delayPasskeyFailure();
    return { ok: false, error: EXECUTIVE_DASHBOARD_PASSKEY_AUTH_ERROR };
  }

  clearPasskeyVerifyFailures(ip);
  clearExecutiveDashboardLoginFailures(ip);
  await issueExecutiveDashboardSession(runtime.username, runtime.secret);
  logPasskeyOperation({ op: "auth.verify", ok: true, reason: "ok" });
  redirect(executiveDashboardPostLoginPath());
}
