import {
  CONTINUUM_FOUNDER_WEBAUTHN_USER_ID,
  getContinuumWebAuthnRelyingParty,
} from "./config";
import {
  consumePasskeyChallengeToken,
  createPasskeyChallengeToken,
} from "./challenges";
import type { PasskeyCrypto } from "./crypto";
import { parseAuthenticationResponse } from "./parse";
import type { FounderPasskeyStore, PasskeyOperationReason } from "./types";
import {
  defaultPasskeyClock,
  type PasskeyFlowClock,
} from "./register";

export type PasskeyAuthenticationDeps = {
  store: FounderPasskeyStore;
  crypto: PasskeyCrypto;
  secret: string;
  clock?: PasskeyFlowClock;
};

export type BeginAuthenticationResult =
  | {
      ok: true;
      options: Awaited<
        ReturnType<PasskeyCrypto["generateAuthenticationOptions"]>
      >;
      challengeToken: string;
    }
  | { ok: false; reason: PasskeyOperationReason };

export type CompleteAuthenticationResult =
  | { ok: true }
  | { ok: false; reason: PasskeyOperationReason };

function clockOf(deps: PasskeyAuthenticationDeps): PasskeyFlowClock {
  return deps.clock ?? defaultPasskeyClock;
}

export async function beginPasskeyAuthentication(
  deps: PasskeyAuthenticationDeps,
): Promise<BeginAuthenticationResult> {
  const rp = getContinuumWebAuthnRelyingParty();
  if (!rp.ok) return { ok: false, reason: "invalid-rp" };

  let rows: Awaited<ReturnType<FounderPasskeyStore["list"]>>;
  try {
    rows = await deps.store.list();
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  const active = rows.filter((row) => row.revokedAt == null);
  if (active.length === 0) return { ok: false, reason: "unavailable" };

  const options = await deps.crypto.generateAuthenticationOptions({
    rpID: rp.rpID,
    allowCredentials: active.map((row) => ({
      id: row.credentialId,
      transports: row.transports ?? undefined,
    })),
  });

  const { token } = createPasskeyChallengeToken(
    {
      kind: "auth",
      challenge: options.challenge,
      founderUserId: CONTINUUM_FOUNDER_WEBAUTHN_USER_ID,
      secret: deps.secret,
    },
    clockOf(deps).now(),
  );

  return { ok: true, options, challengeToken: token };
}

export async function completePasskeyAuthentication(
  deps: PasskeyAuthenticationDeps,
  input: {
    challengeToken: string | undefined;
    response: unknown;
  },
): Promise<CompleteAuthenticationResult> {
  const rp = getContinuumWebAuthnRelyingParty();
  if (!rp.ok) return { ok: false, reason: "invalid-rp" };

  const consumed = consumePasskeyChallengeToken(
    input.challengeToken,
    deps.secret,
    clockOf(deps).now(),
  );
  if (!consumed.ok) return { ok: false, reason: consumed.reason };
  if (consumed.payload.k !== "auth") {
    return { ok: false, reason: "wrong-challenge-kind" };
  }
  if (consumed.payload.uid !== CONTINUUM_FOUNDER_WEBAUTHN_USER_ID) {
    return { ok: false, reason: "invalid-challenge" };
  }

  const response = parseAuthenticationResponse(input.response);
  if (!response) return { ok: false, reason: "invalid-response" };

  let credential: Awaited<
    ReturnType<FounderPasskeyStore["getByCredentialId"]>
  >;
  try {
    credential = await deps.store.getByCredentialId(response.id);
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  if (!credential) return { ok: false, reason: "unknown-credential" };
  if (credential.revokedAt) return { ok: false, reason: "revoked-credential" };
  if (credential.founderUserId !== CONTINUUM_FOUNDER_WEBAUTHN_USER_ID) {
    return { ok: false, reason: "unknown-credential" };
  }

  const verified = await deps.crypto.verifyAuthenticationResponse({
    response,
    expectedChallenge: consumed.payload.ch,
    expectedOrigin: rp.origin,
    expectedRPID: rp.rpID,
    credential,
  });
  if (!verified.verified) return { ok: false, reason: verified.reason };

  if (
    credential.counter > 0 &&
    verified.newCounter <= credential.counter
  ) {
    return { ok: false, reason: "counter-invalid" };
  }

  let updated: boolean;
  try {
    updated = await deps.store.updateAfterAuthentication(credential.credentialId, {
      counter: verified.newCounter,
      lastUsedAt: clockOf(deps).nowIso(),
      backedUp: verified.backedUp,
      deviceType: verified.deviceType,
    });
  } catch {
    return { ok: false, reason: "store-failed" };
  }
  if (!updated) return { ok: false, reason: "store-failed" };

  return { ok: true };
}

export async function revokeFounderPasskey(
  deps: { store: FounderPasskeyStore; clock?: PasskeyFlowClock },
  input: { sessionOk: boolean; id: string },
): Promise<{ ok: true } | { ok: false; reason: PasskeyOperationReason }> {
  if (!input.sessionOk) return { ok: false, reason: "unauthenticated" };
  if (typeof input.id !== "string" || !input.id) {
    return { ok: false, reason: "invalid-response" };
  }
  try {
    const ok = await deps.store.revoke(
      input.id,
      (deps.clock ?? defaultPasskeyClock).nowIso(),
    );
    if (!ok) return { ok: false, reason: "unknown-credential" };
    return { ok: true };
  } catch {
    return { ok: false, reason: "store-failed" };
  }
}
