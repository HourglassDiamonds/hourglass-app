/**
 * Continuum founder WebAuthn relying-party configuration.
 *
 * Production canonical origin is www. Apex redirects to www; WebAuthn
 * stays on www. Do not use *.vercel.app as a production RP ID.
 *
 * Founder WebAuthn user.id (V1, one subject):
 *   CONTINUUM_FOUNDER_WEBAUTHN_USER_ID
 *   = 8f3c1d2e-9a70-4b5e-8c11-00c0711aa001
 *
 * This is a stable internal authenticator subject. It is not an email,
 * not EXECUTIVE_DASHBOARD_USERNAME, and not a Client Memory person id.
 * Do not change it after a production credential is enrolled.
 *
 * Enrollment on Windows Chrome: do not force platform attachment so the
 * browser may offer hybrid/QR to an iPhone. iPhone Safari and the
 * installed Continuum PWA use the platform authenticator (Face ID)
 * through WebAuthn — not a native Face ID API.
 */

export const CONTINUUM_PRODUCTION_WEBAUTHN_ORIGIN =
  "https://www.hourglassdiamonds.com";
export const CONTINUUM_PRODUCTION_WEBAUTHN_RP_ID = "hourglassdiamonds.com";

export const CONTINUUM_WEBAUTHN_RP_NAME = "Continuum";
export const CONTINUUM_WEBAUTHN_USER_NAME = "continuum-founder";
export const CONTINUUM_WEBAUTHN_USER_DISPLAY_NAME = "Continuum";

/**
 * Stable internal founder WebAuthn user.id for Continuum V1.
 * Encoded as UTF-8 bytes when passed to SimpleWebAuthn.
 */
export const CONTINUUM_FOUNDER_WEBAUTHN_USER_ID =
  "8f3c1d2e-9a70-4b5e-8c11-00c0711aa001";

export const PASSKEY_CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const PASSKEY_CHALLENGE_TTL_SEC = 5 * 60;
export const PASSKEY_WEBAUTHN_TIMEOUT_MS = 60_000;

export const PASSKEY_CHALLENGE_COOKIE = "hgd_ed_wa_chal";

/** One-time iPhone QR bootstrap. Raw token is never stored. */
export const PASSKEY_PAIRING_COOKIE = "hgd_ed_pk_pair";
export const PASSKEY_PAIRING_TTL_MS = 5 * 60 * 1000;
export const PASSKEY_PAIRING_TTL_SEC = 5 * 60;
export const PASSKEY_PAIRING_TOKEN_BYTES = 32;

export type ContinuumWebAuthnRelyingParty =
  | { ok: true; origin: string; rpID: string }
  | { ok: false; reason: "invalid-rp" };

export function founderWebAuthnUserIdBytes(): Uint8Array {
  return new TextEncoder().encode(CONTINUUM_FOUNDER_WEBAUTHN_USER_ID);
}

export function isWebAuthnRpIdValidForOrigin(
  rpID: string,
  origin: string,
): boolean {
  if (!rpID || rpID.includes("/") || rpID.startsWith(".")) return false;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  const host = url.hostname;
  const localhost =
    host === "localhost" || host === "127.0.0.1";
  if (url.protocol !== "https:" && !localhost) return false;
  if (host === rpID) return true;
  return host.endsWith(`.${rpID}`);
}

function trimmed(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v ? v.replace(/\/$/, "") : undefined;
}

function isVercelAppHost(hostname: string): boolean {
  return hostname === "vercel.app" || hostname.endsWith(".vercel.app");
}

/**
 * Production is a strict constant pair. Preview/local may use
 * CONTINUUM_WEBAUTHN_ORIGIN + CONTINUUM_WEBAUTHN_RP_ID, then VERCEL_URL
 * on preview, then localhost. Production ignores those overrides.
 */
export function getContinuumWebAuthnRelyingParty(): ContinuumWebAuthnRelyingParty {
  if (process.env.VERCEL_ENV === "production") {
    if (
      !isWebAuthnRpIdValidForOrigin(
        CONTINUUM_PRODUCTION_WEBAUTHN_RP_ID,
        CONTINUUM_PRODUCTION_WEBAUTHN_ORIGIN,
      )
    ) {
      return { ok: false, reason: "invalid-rp" };
    }
    return {
      ok: true,
      origin: CONTINUUM_PRODUCTION_WEBAUTHN_ORIGIN,
      rpID: CONTINUUM_PRODUCTION_WEBAUTHN_RP_ID,
    };
  }

  const envOrigin = trimmed(process.env.CONTINUUM_WEBAUTHN_ORIGIN);
  const envRpId = trimmed(process.env.CONTINUUM_WEBAUTHN_RP_ID);
  if (envOrigin && envRpId) {
    if (!isWebAuthnRpIdValidForOrigin(envRpId, envOrigin)) {
      return { ok: false, reason: "invalid-rp" };
    }
    return { ok: true, origin: envOrigin, rpID: envRpId };
  }

  if (process.env.VERCEL_ENV === "preview") {
    const host = trimmed(process.env.VERCEL_URL)?.replace(/^https?:\/\//, "");
    if (host && isVercelAppHost(host)) {
      const origin = `https://${host}`;
      if (isWebAuthnRpIdValidForOrigin(host, origin)) {
        return { ok: true, origin, rpID: host };
      }
    }
  }

  const localOrigin = "http://localhost:3000";
  const localRpId = "localhost";
  if (!isWebAuthnRpIdValidForOrigin(localRpId, localOrigin)) {
    return { ok: false, reason: "invalid-rp" };
  }
  return { ok: true, origin: localOrigin, rpID: localRpId };
}
