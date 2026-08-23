import {
  CONTINUUM_FOUNDER_WEBAUTHN_USER_ID,
  getContinuumWebAuthnRelyingParty,
} from "./config";
import {
  consumePasskeyChallengeToken,
  createPasskeyChallengeToken,
  sessionFingerprint,
} from "./challenges";
import type { PasskeyCrypto } from "./crypto";
import { parseRegistrationResponse } from "./parse";
import type {
  FounderPasskeyStore,
  PasskeyChallengePayload,
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

  const { token } = createPasskeyChallengeToken(
    {
      kind: "reg",
      challenge: options.challenge,
      founderUserId: CONTINUUM_FOUNDER_WEBAUTHN_USER_ID,
      sessionFingerprint: sessionFingerprint(input.sessionToken, deps.secret),
      secret: deps.secret,
    },
    clockOf(deps).now(),
  );

  return { ok: true, options, challengeToken: token };
}

function challengeKind(
  payload: PasskeyChallengePayload,
  expected: "reg" | "auth",
): PasskeyOperationReason | null {
  if (payload.k !== expected) return "wrong-challenge-kind";
  if (payload.uid !== CONTINUUM_FOUNDER_WEBAUTHN_USER_ID) {
    return "invalid-challenge";
  }
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

  const consumed = consumePasskeyChallengeToken(
    input.challengeToken,
    deps.secret,
    clockOf(deps).now(),
  );
  if (!consumed.ok) return { ok: false, reason: consumed.reason };

  const kindError = challengeKind(consumed.payload, "reg");
  if (kindError) return { ok: false, reason: kindError };

  const expectedFp = sessionFingerprint(input.sessionToken, deps.secret);
  if (!consumed.payload.sfp || consumed.payload.sfp !== expectedFp) {
    return { ok: false, reason: "session-mismatch" };
  }

  const response = parseRegistrationResponse(input.response);
  if (!response) return { ok: false, reason: "invalid-response" };

  const verified = await deps.crypto.verifyRegistrationResponse({
    response,
    expectedChallenge: consumed.payload.ch,
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
