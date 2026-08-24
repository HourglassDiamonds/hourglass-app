/**
 * iPhone QR pairing flows. Pairing authorization is not a founder session.
 * WebAuthn registration reuses the durable challenge ledger.
 */

import { CONTINUUM_FOUNDER_WEBAUTHN_USER_ID, PASSKEY_PAIRING_TTL_MS, PASSKEY_PAIRING_TTL_SEC } from "./config";
import { getContinuumWebAuthnRelyingParty } from "./config";
import type {
  PasskeyChallengeLedger,
  PasskeyPairingPublicView,
  PasskeyPairingRecord,
  PasskeyPairingStatus,
  PasskeyPairingStore,
  PasskeyOperationReason,
} from "./types";
import type { FounderPasskeyStore } from "./types";
import type { PasskeyCrypto } from "./crypto";
import {
  hashPairingSession,
  hashPairingToken,
  newMatchCode,
  newPairingNonce,
  newPairingToken,
  pairingDeviceHint,
  pairingPageUrl,
  createPasskeyPairingCookie,
  readPasskeyPairingCookie,
} from "./pairing-token";
import {
  beginPasskeyRegistration,
  verifyPasskeyRegistration,
  type PasskeyRegistrationDeps,
} from "./register";

export type PasskeyPairingDeps = PasskeyRegistrationDeps & {
  pairings: PasskeyPairingStore;
};

export type PairingPublicView = PasskeyPairingPublicView;

export function effectivePairingStatus(
  record: PasskeyPairingRecord,
  nowMs: number,
): PasskeyPairingStatus {
  if (record.status === "completed" || record.status === "cancelled") {
    return record.status;
  }
  if (Date.parse(record.expiresAt) <= nowMs) return "expired";
  return record.status;
}

export function toPairingPublicView(
  record: PasskeyPairingRecord,
  nowMs: number,
): PairingPublicView {
  return {
    id: record.id,
    status: effectivePairingStatus(record, nowMs),
    matchCode: record.matchCode,
    deviceHint: record.deviceHint,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
  };
}

function clockOf(deps: PasskeyPairingDeps) {
  return deps.clock ?? {
    now: () => Date.now(),
    nowIso: () => new Date().toISOString(),
  };
}

export async function createIphonePairing(
  deps: PasskeyPairingDeps,
  input: { sessionOk: boolean },
): Promise<
  | {
      ok: true;
      pairingId: string;
      pairUrl: string;
      matchCode: string;
      expiresAt: string;
      rawToken: string;
    }
  | { ok: false; reason: PasskeyOperationReason }
> {
  if (!input.sessionOk) return { ok: false, reason: "unauthenticated" };
  const rp = getContinuumWebAuthnRelyingParty();
  if (!rp.ok) return { ok: false, reason: "invalid-rp" };

  const now = clockOf(deps).now();
  const rawToken = newPairingToken();
  const matchCode = newMatchCode();
  const expiresAt = new Date(now + PASSKEY_PAIRING_TTL_MS).toISOString();

  let saved: PasskeyPairingRecord;
  try {
    saved = await deps.pairings.insert({
      founderUserId: CONTINUUM_FOUNDER_WEBAUTHN_USER_ID,
      tokenHash: hashPairingToken(rawToken),
      matchCode,
      createdAt: clockOf(deps).nowIso(),
      expiresAt,
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  return {
    ok: true,
    pairingId: saved.id,
    pairUrl: pairingPageUrl(rp.origin, rawToken),
    matchCode,
    expiresAt,
    rawToken,
  };
}

export async function claimIphonePairing(
  deps: PasskeyPairingDeps,
  input: { rawToken: string | undefined; userAgent?: string | null },
): Promise<
  | {
      ok: true;
      pairing: PairingPublicView;
      pairingCookie: string;
      cookieMaxAgeSec: number;
    }
  | { ok: false; reason: PasskeyOperationReason }
> {
  if (!input.rawToken) return { ok: false, reason: "invalid-pairing" };
  const nonce = newPairingNonce();
  const claimedSessionHash = hashPairingSession(nonce);
  let claimed: Awaited<ReturnType<PasskeyPairingStore["claim"]>>;
  try {
    claimed = await deps.pairings.claim({
      tokenHash: hashPairingToken(input.rawToken),
      claimedSessionHash,
      deviceHint: pairingDeviceHint(input.userAgent),
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  // device hint applied below if claim helper needs it — pass through store
  if (!claimed.ok) return claimed;

  const remainingMs = Math.max(
    1_000,
    Date.parse(claimed.record.expiresAt) - clockOf(deps).now(),
  );
  const cookieMaxAgeSec = Math.min(
    PASSKEY_PAIRING_TTL_SEC,
    Math.max(1, Math.ceil(remainingMs / 1000)),
  );
  const { token } = createPasskeyPairingCookie(
    {
      pairingId: claimed.record.id,
      nonce,
      secret: deps.secret,
    },
    clockOf(deps).now(),
    remainingMs,
  );

  return {
    ok: true,
    pairing: toPairingPublicView(claimed.record, clockOf(deps).now()),
    pairingCookie: token,
    cookieMaxAgeSec,
  };
}

export async function readIphonePairingForPhone(
  deps: PasskeyPairingDeps,
  input: { pairingCookie: string | undefined },
): Promise<
  | { ok: true; pairing: PairingPublicView; pairingId: string; nonce: string }
  | { ok: false; reason: PasskeyOperationReason }
> {
  const cookie = readPasskeyPairingCookie(
    input.pairingCookie,
    deps.secret,
    clockOf(deps).now(),
  );
  if (!cookie.ok) return { ok: false, reason: cookie.reason };

  let record: PasskeyPairingRecord | null;
  try {
    record = await deps.pairings.getById(cookie.payload.pid);
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (!record) return { ok: false, reason: "invalid-pairing" };
  if (
    !record.claimedSessionHash ||
    record.claimedSessionHash !== hashPairingSession(cookie.payload.nonce)
  ) {
    return { ok: false, reason: "session-mismatch" };
  }
  return {
    ok: true,
    pairing: toPairingPublicView(record, clockOf(deps).now()),
    pairingId: record.id,
    nonce: cookie.payload.nonce,
  };
}

export async function readIphonePairingForDesktop(
  deps: PasskeyPairingDeps,
  input: { sessionOk: boolean; pairingId: string },
): Promise<
  | { ok: true; pairing: PairingPublicView }
  | { ok: false; reason: PasskeyOperationReason }
> {
  if (!input.sessionOk) return { ok: false, reason: "unauthenticated" };
  let record: PasskeyPairingRecord | null;
  try {
    record = await deps.pairings.getById(input.pairingId);
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (!record) return { ok: false, reason: "invalid-pairing" };
  return {
    ok: true,
    pairing: toPairingPublicView(record, clockOf(deps).now()),
  };
}

export async function approveIphonePairing(
  deps: PasskeyPairingDeps,
  input: { founderSessionOk: boolean; pairingId: string },
): Promise<
  | { ok: true; pairing: PairingPublicView }
  | { ok: false; reason: PasskeyOperationReason }
> {
  if (!input.founderSessionOk) return { ok: false, reason: "unauthenticated" };
  let result: Awaited<ReturnType<PasskeyPairingStore["transition"]>>;
  try {
    result = await deps.pairings.transition(input.pairingId, "claimed", "approved");
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (!result.ok) return result;
  return {
    ok: true,
    pairing: toPairingPublicView(result.record, clockOf(deps).now()),
  };
}

export async function cancelIphonePairing(
  deps: PasskeyPairingDeps,
  input: { founderSessionOk: boolean; pairingId: string },
): Promise<
  | { ok: true; pairing: PairingPublicView }
  | { ok: false; reason: PasskeyOperationReason }
> {
  if (!input.founderSessionOk) return { ok: false, reason: "unauthenticated" };
  let result: Awaited<ReturnType<PasskeyPairingStore["cancel"]>>;
  try {
    result = await deps.pairings.cancel(input.pairingId);
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (!result.ok) return result;
  return {
    ok: true,
    pairing: toPairingPublicView(result.record, clockOf(deps).now()),
  };
}

async function requireApprovedPhonePairing(
  deps: PasskeyPairingDeps,
  pairingCookie: string | undefined,
): Promise<
  | { ok: true; pairingId: string; nonce: string }
  | { ok: false; reason: PasskeyOperationReason }
> {
  const loaded = await readIphonePairingForPhone(deps, { pairingCookie });
  if (!loaded.ok) return loaded;
  if (loaded.pairing.status !== "approved") {
    return { ok: false, reason: "pairing-not-approved" };
  }
  return { ok: true, pairingId: loaded.pairingId, nonce: loaded.nonce };
}

export async function beginIphonePairingRegistration(
  deps: PasskeyPairingDeps,
  input: { pairingCookie: string | undefined },
): Promise<
  | {
      ok: true;
      options: Awaited<ReturnType<PasskeyCrypto["generateRegistrationOptions"]>>;
      challengeToken: string;
    }
  | { ok: false; reason: PasskeyOperationReason }
> {
  const approved = await requireApprovedPhonePairing(deps, input.pairingCookie);
  if (!approved.ok) return approved;
  if (!input.pairingCookie) return { ok: false, reason: "invalid-pairing" };

  return beginPasskeyRegistration(deps, {
    sessionOk: true,
    // Pairing cookie fingerprint — not hgd_ed_session. Durable ledger
    // still stores purpose=reg, founder_user_id, origin, rpID, and this sfp.
    sessionToken: input.pairingCookie,
    authenticatorAttachment: "platform",
  });
}

export async function completeIphonePairingRegistration(
  deps: PasskeyPairingDeps,
  input: {
    founderSessionOk?: boolean;
    pairingCookie: string | undefined;
    challengeToken: string | undefined;
    response: unknown;
    label?: string | null;
  },
): Promise<
  | { ok: true; id: string; issueFounderSession: true }
  | { ok: false; reason: PasskeyOperationReason }
> {
  const approved = await requireApprovedPhonePairing(deps, input.pairingCookie);
  if (!approved.ok) return approved;
  if (!input.pairingCookie) return { ok: false, reason: "invalid-pairing" };

  const verified = await verifyPasskeyRegistration(deps, {
    sessionOk: true,
    sessionToken: input.pairingCookie,
    challengeToken: input.challengeToken,
    response: input.response,
    label: input.label?.trim() ? input.label : "iPhone",
  });
  if (!verified.ok) return verified;

  let finished: Awaited<ReturnType<PasskeyPairingStore["finalize"]>>;
  try {
    finished = await deps.pairings.finalize({
      pairingId: approved.pairingId,
      founderUserId: CONTINUUM_FOUNDER_WEBAUTHN_USER_ID,
      claimedSessionHash: hashPairingSession(approved.nonce),
      credential: {
        founderUserId: CONTINUUM_FOUNDER_WEBAUTHN_USER_ID,
        credentialId: verified.credentialId,
        publicKey: verified.publicKey,
        counter: verified.counter,
        transports: verified.transports,
        deviceType: verified.deviceType,
        backedUp: verified.backedUp,
        label: verified.label,
        createdAt: clockOf(deps).nowIso(),
      },
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (!finished.ok) return finished;
  return { ok: true, id: finished.credential.id, issueFounderSession: true };
}

export type { FounderPasskeyStore, PasskeyChallengeLedger };
