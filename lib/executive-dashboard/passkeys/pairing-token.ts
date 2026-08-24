/**
 * One-time QR pairing token + HttpOnly pairing cookie.
 * Raw token is returned once to the authenticated desktop; only the hash
 * is persisted. Never log the token or pair URL.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  PASSKEY_PAIRING_COOKIE,
  PASSKEY_PAIRING_TTL_MS,
  PASSKEY_PAIRING_TTL_SEC,
  PASSKEY_PAIRING_TOKEN_BYTES,
} from "./config";
import { EXECUTIVE_DASHBOARD_SESSION_PATH } from "../session";
import { EXECUTIVE_DASHBOARD_PASSKEY_PAIR_PATH } from "../access";
import { formatMatchCode } from "./pairing-format";

export { PASSKEY_PAIRING_COOKIE, PASSKEY_PAIRING_TTL_MS, PASSKEY_PAIRING_TTL_SEC };
export { formatMatchCode };

export type PasskeyPairingCookiePayload = {
  v: 1;
  pid: string;
  nonce: string;
  iat: number;
  exp: number;
};

function hmacSign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

function signaturesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function newPairingToken(): string {
  return randomBytes(PASSKEY_PAIRING_TOKEN_BYTES).toString("base64url");
}

export function hashPairingToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("base64url");
}

export function newPairingNonce(): string {
  return randomBytes(32).toString("base64url");
}

export function hashPairingSession(nonce: string): string {
  return createHash("sha256").update(`pair-sfp:${nonce}`, "utf8").digest("base64url");
}

export function newMatchCode(): string {
  const n = randomBytes(4).readUInt32BE(0) % 1_000_000;
  return n.toString().padStart(6, "0");
}

export function pairingPageUrl(origin: string, rawToken?: string): string {
  const base = `${origin.replace(/\/$/, "")}${EXECUTIVE_DASHBOARD_PASSKEY_PAIR_PATH}`;
  if (!rawToken) return base;
  return `${base}?t=${encodeURIComponent(rawToken)}`;
}

export function passkeyPairingCookieOptions(secure: boolean): {
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
    maxAge: PASSKEY_PAIRING_TTL_SEC,
  };
}

export function clearPasskeyPairingCookieOptions(secure: boolean): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    ...passkeyPairingCookieOptions(secure),
    maxAge: 0,
  };
}

export function createPasskeyPairingCookie(
  input: { pairingId: string; nonce: string; secret: string },
  nowMs = Date.now(),
  ttlMs = PASSKEY_PAIRING_TTL_MS,
): { token: string; payload: PasskeyPairingCookiePayload } {
  const iat = Math.floor(nowMs / 1000);
  const payload: PasskeyPairingCookiePayload = {
    v: 1,
    pid: input.pairingId,
    nonce: input.nonce,
    iat,
    exp: iat + Math.floor(ttlMs / 1000),
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return { token: `${body}.${hmacSign(body, input.secret)}`, payload };
}

export type ReadPasskeyPairingCookieResult =
  | { ok: true; payload: PasskeyPairingCookiePayload }
  | {
      ok: false;
      reason: "invalid-pairing" | "pairing-expired";
    };

export function readPasskeyPairingCookie(
  token: string | undefined | null,
  secret: string,
  nowMs = Date.now(),
): ReadPasskeyPairingCookieResult {
  if (!token) return { ok: false, reason: "invalid-pairing" };
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, reason: "invalid-pairing" };
  }
  const [body, sig] = parts;
  const expected = hmacSign(body, secret);
  if (!signaturesMatch(sig, expected)) {
    return { ok: false, reason: "invalid-pairing" };
  }

  let payload: PasskeyPairingCookiePayload;
  try {
    payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as PasskeyPairingCookiePayload;
  } catch {
    return { ok: false, reason: "invalid-pairing" };
  }

  if (payload.v !== 1) return { ok: false, reason: "invalid-pairing" };
  if (typeof payload.pid !== "string" || !payload.pid) {
    return { ok: false, reason: "invalid-pairing" };
  }
  if (typeof payload.nonce !== "string" || !payload.nonce) {
    return { ok: false, reason: "invalid-pairing" };
  }
  if (typeof payload.iat !== "number" || typeof payload.exp !== "number") {
    return { ok: false, reason: "invalid-pairing" };
  }

  const nowSec = Math.floor(nowMs / 1000);
  if (payload.exp <= nowSec) return { ok: false, reason: "pairing-expired" };
  if (payload.iat > nowSec + 60) return { ok: false, reason: "invalid-pairing" };

  return { ok: true, payload };
}

/** Coarse UA hint only. No hardware IDs. */
export function pairingDeviceHint(userAgent: string | null | undefined): string {
  const ua = userAgent ?? "";
  const device = /iPhone/i.test(ua)
    ? "iPhone"
    : /iPad/i.test(ua)
      ? "iPad"
      : "Phone";
  const browser =
    /CriOS/i.test(ua)
      ? "Chrome"
      : /FxiOS/i.test(ua)
        ? "Firefox"
        : /EdgiOS/i.test(ua)
          ? "Edge"
          : /Safari/i.test(ua)
            ? "Safari"
            : "Browser";
  return `${device} / ${browser}`.slice(0, 40);
}
