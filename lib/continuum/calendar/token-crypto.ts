/**
 * AES-256-GCM wrapping for the Calendar refresh token.
 * Server-only CONTINUUM_CALENDAR_TOKEN_KEK. Access tokens never persist.
 * Never read Gmail token custody secrets or Intelligence Google secrets.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getContinuumCalendarTokenKek } from "./env";
import { CALENDAR_TOKEN_ENC_ALG, type CalendarTokenCiphertext } from "./types";

const KEY_BYTES = 32;
const IV_BYTES = 12;

export type CalendarTokenKekError = "token-kek-missing" | "token-kek-invalid";

function decodeKek(raw: string): Buffer | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    return Buffer.from(value, "hex");
  }
  try {
    const b64 = Buffer.from(value, "base64");
    if (b64.length === KEY_BYTES) return b64;
  } catch {
    return null;
  }
  try {
    const url = Buffer.from(value, "base64url");
    if (url.length === KEY_BYTES) return url;
  } catch {
    return null;
  }
  return null;
}

export function loadCalendarTokenKek(
  raw = getContinuumCalendarTokenKek(),
): { ok: true; key: Buffer } | { ok: false; error: CalendarTokenKekError } {
  if (!raw) return { ok: false, error: "token-kek-missing" };
  const key = decodeKek(raw);
  if (!key || key.length !== KEY_BYTES) {
    return { ok: false, error: "token-kek-invalid" };
  }
  return { ok: true, key };
}

export function encryptCalendarRefreshToken(
  plaintext: string,
  key: Buffer,
): CalendarTokenCiphertext {
  if (!plaintext) throw new Error("refresh-token-required");
  if (key.length !== KEY_BYTES) throw new Error("token-kek-invalid");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(CALENDAR_TOKEN_ENC_ALG, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    alg: CALENDAR_TOKEN_ENC_ALG,
    version: 1,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

export function decryptCalendarRefreshToken(
  wrapped: CalendarTokenCiphertext,
  key: Buffer,
): string {
  if (key.length !== KEY_BYTES) throw new Error("token-kek-invalid");
  if (wrapped.alg !== CALENDAR_TOKEN_ENC_ALG) throw new Error("token-alg-invalid");
  if (wrapped.version !== 1) throw new Error("token-version-invalid");
  const iv = Buffer.from(wrapped.iv, "base64");
  const tag = Buffer.from(wrapped.tag, "base64");
  const ciphertext = Buffer.from(wrapped.ciphertext, "base64");
  if (iv.length !== IV_BYTES) throw new Error("token-iv-invalid");
  const decipher = createDecipheriv(CALENDAR_TOKEN_ENC_ALG, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
