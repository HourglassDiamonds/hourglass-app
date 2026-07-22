import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 } as const;
const KEYLEN = 32;

/**
 * Format: scrypt$<salt_base64url>$<hash_base64url>
 * Generate via stdin (do not put the password on the command line) — see .env.example.
 */
export function hashExecutiveDashboardPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN, SCRYPT_OPTIONS);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

function decodePart(value: string): Buffer | null {
  try {
    const buf = Buffer.from(value, "base64url");
    return buf.length > 0 ? buf : null;
  } catch {
    return null;
  }
}

/**
 * Timing-safe password verification against a stored scrypt hash.
 * Malformed hashes always return false (fail closed).
 */
export function verifyExecutiveDashboardPassword(
  password: string,
  storedHash: string,
): boolean {
  const parts = storedHash.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    // Burn comparable work to reduce timing oracle on malformed config.
    scryptSync(password, "invalid-salt", KEYLEN, SCRYPT_OPTIONS);
    return false;
  }

  const salt = decodePart(parts[1]);
  const expected = decodePart(parts[2]);
  if (!salt || !expected || expected.length !== KEYLEN) {
    scryptSync(password, "invalid-salt", KEYLEN, SCRYPT_OPTIONS);
    return false;
  }

  const actual = scryptSync(password, salt, KEYLEN, SCRYPT_OPTIONS);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function usernamesMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
