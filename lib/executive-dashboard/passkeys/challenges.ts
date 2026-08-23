import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  PASSKEY_CHALLENGE_COOKIE,
  PASSKEY_CHALLENGE_TTL_MS,
  PASSKEY_CHALLENGE_TTL_SEC,
} from "./config";
import type { PasskeyChallengeKind, PasskeyChallengePayload } from "./types";
import { EXECUTIVE_DASHBOARD_SESSION_PATH } from "../session";

const consumed = new Map<string, number>();
const MAX_CONSUMED = 4_000;

function hmacSign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

function signaturesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function pruneConsumed(now: number): void {
  const cutoff = now - PASSKEY_CHALLENGE_TTL_MS;
  for (const [jti, exp] of consumed) {
    if (exp <= cutoff) consumed.delete(jti);
  }
  while (consumed.size > MAX_CONSUMED) {
    const first = consumed.keys().next().value;
    if (!first) break;
    consumed.delete(first);
  }
}

export function sessionFingerprint(sessionToken: string, secret: string): string {
  return hmacSign(`sfp:${sessionToken}`, secret).slice(0, 24);
}

export function passkeyChallengeCookieOptions(secure: boolean): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: EXECUTIVE_DASHBOARD_SESSION_PATH,
    maxAge: PASSKEY_CHALLENGE_TTL_SEC,
  };
}

export function clearPasskeyChallengeCookieOptions(secure: boolean): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    ...passkeyChallengeCookieOptions(secure),
    maxAge: 0,
  };
}

export function createPasskeyChallengeToken(
  input: {
    kind: PasskeyChallengeKind;
    challenge: string;
    founderUserId: string;
    sessionFingerprint?: string;
    secret: string;
  },
  nowMs = Date.now(),
  ttlMs = PASSKEY_CHALLENGE_TTL_MS,
): { token: string; payload: PasskeyChallengePayload } {
  const iat = Math.floor(nowMs / 1000);
  const payload: PasskeyChallengePayload = {
    v: 1,
    k: input.kind,
    jti: randomBytes(16).toString("base64url"),
    ch: input.challenge,
    iat,
    exp: iat + Math.floor(ttlMs / 1000),
    uid: input.founderUserId,
  };
  if (input.sessionFingerprint) payload.sfp = input.sessionFingerprint;
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const token = `${body}.${hmacSign(body, input.secret)}`;
  return { token, payload };
}

export type ConsumePasskeyChallengeResult =
  | { ok: true; payload: PasskeyChallengePayload }
  | {
      ok: false;
      reason:
        | "missing-challenge"
        | "invalid-challenge"
        | "expired-challenge"
        | "replayed-challenge";
    };

export function consumePasskeyChallengeToken(
  token: string | undefined | null,
  secret: string,
  nowMs = Date.now(),
): ConsumePasskeyChallengeResult {
  if (!token) return { ok: false, reason: "missing-challenge" };
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, reason: "invalid-challenge" };
  }
  const [body, sig] = parts;
  const expected = hmacSign(body, secret);
  if (!signaturesMatch(sig, expected)) {
    return { ok: false, reason: "invalid-challenge" };
  }

  let payload: PasskeyChallengePayload;
  try {
    payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as PasskeyChallengePayload;
  } catch {
    return { ok: false, reason: "invalid-challenge" };
  }

  if (payload.v !== 1) return { ok: false, reason: "invalid-challenge" };
  if (payload.k !== "reg" && payload.k !== "auth") {
    return { ok: false, reason: "invalid-challenge" };
  }
  if (typeof payload.jti !== "string" || !payload.jti) {
    return { ok: false, reason: "invalid-challenge" };
  }
  if (typeof payload.ch !== "string" || !payload.ch) {
    return { ok: false, reason: "invalid-challenge" };
  }
  if (typeof payload.uid !== "string" || !payload.uid) {
    return { ok: false, reason: "invalid-challenge" };
  }
  if (typeof payload.iat !== "number" || typeof payload.exp !== "number") {
    return { ok: false, reason: "invalid-challenge" };
  }

  const nowSec = Math.floor(nowMs / 1000);
  if (payload.exp <= nowSec) return { ok: false, reason: "expired-challenge" };
  if (payload.iat > nowSec + 60) return { ok: false, reason: "invalid-challenge" };

  pruneConsumed(nowMs);
  if (consumed.has(payload.jti)) {
    return { ok: false, reason: "replayed-challenge" };
  }
  consumed.set(payload.jti, payload.exp * 1000);
  return { ok: true, payload };
}

export function resetPasskeyChallenges(): void {
  consumed.clear();
}

export { PASSKEY_CHALLENGE_COOKIE };
