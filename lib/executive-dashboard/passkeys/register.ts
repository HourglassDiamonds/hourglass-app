import {
  CONTINUUM_FOUNDER_WEBAUTHN_USER_ID,
  PASSKEY_CHALLENGE_TTL_MS,
  getContinuumWebAuthnRelyingParty,
} from "./config";
import {
  createPasskeyChallengeToken,
  newPasskeyChallengeJti,
  readPasskeyChallengeCookie,
  sessionFingerprint,
} from "./challenges";
import type { PasskeyCrypto } from "./crypto";
import { parseRegistrationResponse } from "./parse";
import type {
  FounderPasskeyStore,
  PasskeyChallengeLedger,
  PasskeyChallengeRecord,
  PasskeyOperationReason,
} from "./types";

export type PasskeyFlowClock = {
  now(): number;
  nowIso(): string;
};

export const defaultPasskeyClock: PasskeyFlowClock = {
  now: () => Date.now(),
  nowIso: () => new Date().toISOString(),
};

export type PasskeyRegistrationDeps = {
  store: FounderPasskeyStore;
  challenges: PasskeyChallengeLedger;
  crypto: PasskeyCrypto;
  secret: string;
  clock?: PasskeyFlowClock;
};

export type BeginRegistrationInput = {
  sessionOk: boolean;
  sessionToken: string | undefined;
};

export type BeginRegistrationResult =
  | {
      ok: true;
      options: Awaited<
        ReturnType<PasskeyCrypto["generateRegistrationOptions"]>
      >;
      challengeToken: string;
    }
  | { ok: false; reason: PasskeyOperationReason };

export type CompleteRegistrationInput = {
  sessionOk: boolean;
  sessionToken: string | undefined;
  challengeToken: string | undefined;
  response: unknown;
  label?: string | null;
};

export type CompleteRegistrationResult =
  | { ok: true; id: string }
  | { ok: false; reason: PasskeyOperationReason };

function clockOf(deps: PasskeyRegistrationDeps): PasskeyFlowClock {
  return deps.clock ?? defaultPasskeyClock;
}

export async function beginPasskeyRegistration(
  deps: PasskeyRegistrationDeps,
  input: BeginRegistrationInput,
): Promise<BeginRegistrationResult> {
  if (!input.sessionOk || !input.sessionToken) {
    return { ok: false, reason: "unauthenticated" };
  }
  const rp = getContinuumWebAuthnRelyingParty();
  if (!rp.ok) return { ok: false, reason: "invalid-rp" };

  let existing: Awaited<ReturnType<FounderPasskeyStore["list"]>>;
  try {
    existing = await deps.store.list();
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  const options = await deps.crypto.generateRegistrationOptions({
    rpID: rp.rpID,
    excludeCredentialIds: existing
      .filter((row) => row.revokedAt == null)
      .map((row) => ({
        id: row.credentialId,
        transports: row.transports ?? undefined,
      })),
  });

  const now = clockOf(deps).now();
  const jti = newPasskeyChallengeJti();
  const sfp = sessionFingerprint(input.sessionToken, deps.secret);
  try {
    await deps.challenges.issue({
      jti,
      purpose: "reg",
      founderUserId: CONTINUUM_FOUNDER_WEBAUTHN_USER_ID,
      challenge: options.challenge,
      origin: rp.origin,
      rpId: rp.rpID,
      sessionFingerprint: sfp,
      expiresAt: new Date(now + PASSKEY_CHALLENGE_TTL_MS).toISOString(),
      createdAt: clockOf(deps).nowIso(),
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  const { token } = createPasskeyChallengeToken(
    {
      kind: "reg",
      jti,
      founderUserId: CONTINUUM_FOUNDER_WEBAUTHN_USER_ID,
      sessionFingerprint: sfp,
      secret: deps.secret,
    },
    now,
  );

  return { ok: true, options, challengeToken: token };
}

function bindChallenge(
  record: PasskeyChallengeRecord,
  expected: {
    kind: "reg" | "auth";
    origin: string;
    rpId: string;
  },
): PasskeyOperationReason | null {
  if (record.purpose !== expected.kind) return "wrong-challenge-kind";
  if (record.founderUserId !== CONTINUUM_FOUNDER_WEBAUTHN_USER_ID) {
    return "invalid-challenge";
  }
  if (record.origin !== expected.origin) return "origin-mismatch";
  if (record.rpId !== expected.rpId) return "rp-mismatch";
  return null;
}

export async function completePasskeyRegistration(
  deps: PasskeyRegistrationDeps,
  input: CompleteRegistrationInput,
): Promise<CompleteRegistrationResult> {
  if (!input.sessionOk || !input.sessionToken) {
    return { ok: false, reason: "unauthenticated" };
  }

  const rp = getContinuumWebAuthnRelyingParty();
  if (!rp.ok) return { ok: false, reason: "invalid-rp" };

  const cookie = readPasskeyChallengeCookie(
    input.challengeToken,
    deps.secret,
    clockOf(deps).now(),
  );
  if (!cookie.ok) return { ok: false, reason: cookie.reason };
  if (cookie.payload.k !== "reg") return { ok: false, reason: "wrong-challenge-kind" };
  if (cookie.payload.uid !== CONTINUUM_FOUNDER_WEBAUTHN_USER_ID) {
    return { ok: false, reason: "invalid-challenge" };
  }

  const expectedFp = sessionFingerprint(input.sessionToken, deps.secret);
  if (!cookie.payload.sfp || cookie.payload.sfp !== expectedFp) {
    return { ok: false, reason: "session-mismatch" };
  }

  let consumed: Awaited<ReturnType<PasskeyChallengeLedger["consume"]>>;
  try {
    consumed = await deps.challenges.consume(cookie.payload.jti);
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (!consumed.ok) return { ok: false, reason: consumed.reason };

  const bindError = bindChallenge(consumed.record, {
    kind: "reg",
    origin: rp.origin,
    rpId: rp.rpID,
  });
  if (bindError) return { ok: false, reason: bindError };
  if (
    !consumed.record.sessionFingerprint ||
    consumed.record.sessionFingerprint !== expectedFp
  ) {
    return { ok: false, reason: "session-mismatch" };
  }

  const response = parseRegistrationResponse(input.response);
  if (!response) return { ok: false, reason: "invalid-response" };

  const verified = await deps.crypto.verifyRegistrationResponse({
    response,
    expectedChallenge: consumed.record.challenge,
    expectedOrigin: rp.origin,
    expectedRPID: rp.rpID,
  });
  if (!verified.verified) return { ok: false, reason: "verify-failed" };

  const label = input.label?.trim() ? input.label.trim().slice(0, 80) : null;

  try {
    const saved = await deps.store.insert({
      founderUserId: CONTINUUM_FOUNDER_WEBAUTHN_USER_ID,
      credentialId: verified.credential.id,
      publicKey: verified.credential.publicKey,
      counter: verified.credential.counter,
      transports: verified.credential.transports
        ? [...verified.credential.transports]
        : null,
      deviceType: verified.deviceType,
      backedUp: verified.backedUp,
      label,
      createdAt: clockOf(deps).nowIso(),
    });
    return { ok: true, id: saved.id };
  } catch {
    return { ok: false, reason: "store-failed" };
  }
}
