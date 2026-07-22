import { createHmac, timingSafeEqual } from "node:crypto";

export const EXECUTIVE_DASHBOARD_SESSION_COOKIE = "hgd_ed_session";
export const EXECUTIVE_DASHBOARD_SESSION_MAX_AGE_SEC = 60 * 60 * 12; // 12 hours
export const EXECUTIVE_DASHBOARD_SESSION_PATH = "/executive-dashboard";

export type ExecutiveDashboardSessionPayload = {
  v: 1;
  u: string;
  iat: number;
  exp: number;
};

function b64urlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function hmacSign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

function signaturesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function createExecutiveDashboardSessionToken(
  username: string,
  secret: string,
  nowMs = Date.now(),
  maxAgeSec = EXECUTIVE_DASHBOARD_SESSION_MAX_AGE_SEC,
): string {
  const iat = Math.floor(nowMs / 1000);
  const payload: ExecutiveDashboardSessionPayload = {
    v: 1,
    u: username,
    iat,
    exp: iat + maxAgeSec,
  };
  const body = b64urlJson(payload);
  const sig = hmacSign(body, secret);
  return `${body}.${sig}`;
}

export function verifyExecutiveDashboardSessionToken(
  token: string,
  secret: string,
  expectedUsername: string,
  nowMs = Date.now(),
): ExecutiveDashboardSessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;

  const expectedSig = hmacSign(body, secret);
  if (!signaturesMatch(sig, expectedSig)) return null;

  let payload: ExecutiveDashboardSessionPayload;
  try {
    payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as ExecutiveDashboardSessionPayload;
  } catch {
    return null;
  }

  if (payload.v !== 1) return null;
  if (typeof payload.u !== "string" || !payload.u) return null;
  if (typeof payload.iat !== "number" || typeof payload.exp !== "number") {
    return null;
  }
  if (payload.u !== expectedUsername) return null;

  const nowSec = Math.floor(nowMs / 1000);
  if (payload.exp <= nowSec) return null;
  if (payload.iat > nowSec + 60) return null;

  return payload;
}

export function executiveDashboardSessionCookieOptions(secure: boolean): {
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
    maxAge: EXECUTIVE_DASHBOARD_SESSION_MAX_AGE_SEC,
  };
}

/** Secure cookies on Vercel (HTTPS). Local next start stays HTTP-compatible. */
export function shouldUseSecureExecutiveDashboardCookie(): boolean {
  return process.env.VERCEL === "1";
}
