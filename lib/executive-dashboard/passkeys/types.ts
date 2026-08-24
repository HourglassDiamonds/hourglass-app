export type PasskeyTransport = string;

export type FounderPasskeyRecord = {
  id: string;
  founderUserId: string;
  credentialId: string;
  publicKey: Uint8Array;
  counter: number;
  transports: PasskeyTransport[] | null;
  deviceType: string | null;
  backedUp: boolean | null;
  createdAt: string;
  lastUsedAt: string | null;
  label: string | null;
  revokedAt: string | null;
};

export type FounderPasskeyInsert = {
  founderUserId: string;
  credentialId: string;
  publicKey: Uint8Array;
  counter: number;
  transports: PasskeyTransport[] | null;
  deviceType: string | null;
  backedUp: boolean | null;
  label: string | null;
  createdAt: string;
};

export type FounderPasskeyStore = {
  list(): Promise<FounderPasskeyRecord[]>;
  getByCredentialId(credentialId: string): Promise<FounderPasskeyRecord | null>;
  insert(record: FounderPasskeyInsert): Promise<FounderPasskeyRecord>;
  updateAfterAuthentication(
    credentialId: string,
    update: {
      counter: number;
      lastUsedAt: string;
      backedUp: boolean | null;
      deviceType: string | null;
    },
  ): Promise<boolean>;
  revoke(id: string, revokedAt: string): Promise<boolean>;
  hasActive(): Promise<boolean>;
};

export type PasskeyChallengeKind = "reg" | "auth";

export type PasskeyChallengePayload = {
  v: 2;
  k: PasskeyChallengeKind;
  jti: string;
  iat: number;
  exp: number;
  uid: string;
  sfp?: string;
};

export type PasskeyChallengeRecord = {
  jti: string;
  purpose: PasskeyChallengeKind;
  founderUserId: string;
  challenge: string;
  origin: string;
  rpId: string;
  sessionFingerprint: string | null;
  expiresAt: string;
  consumedAt: string | null;
  createdAt: string;
};

export type PasskeyChallengeIssue = {
  jti: string;
  purpose: PasskeyChallengeKind;
  founderUserId: string;
  challenge: string;
  origin: string;
  rpId: string;
  sessionFingerprint: string | null;
  expiresAt: string;
  createdAt: string;
};

export type PasskeyChallengeLedger = {
  issue(record: PasskeyChallengeIssue): Promise<void>;
  consume(
    jti: string,
  ): Promise<
    | { ok: true; record: PasskeyChallengeRecord }
    | { ok: false; reason: "missing-challenge" | "replayed-challenge" | "expired-challenge" }
  >;
};

export type PasskeyPairingStoredStatus =
  | "pending"
  | "claimed"
  | "approved"
  | "completed"
  | "cancelled";

export type PasskeyPairingStatus = PasskeyPairingStoredStatus | "expired";

export type PasskeyPairingRecord = {
  id: string;
  founderUserId: string;
  tokenHash: string;
  status: PasskeyPairingStoredStatus;
  matchCode: string;
  deviceHint: string | null;
  claimedSessionHash: string | null;
  createdAt: string;
  expiresAt: string;
  claimedAt: string | null;
  approvedAt: string | null;
  completedAt: string | null;
};

export type PasskeyPairingPublicView = {
  id: string;
  status: PasskeyPairingStatus;
  matchCode: string;
  deviceHint: string | null;
  createdAt: string;
  expiresAt: string;
};

export type PasskeyPairingInsert = {
  founderUserId: string;
  tokenHash: string;
  matchCode: string;
  createdAt: string;
  expiresAt: string;
};

export type PasskeyPairingStore = {
  insert(record: PasskeyPairingInsert): Promise<PasskeyPairingRecord>;
  getById(id: string): Promise<PasskeyPairingRecord | null>;
  claim(input: {
    tokenHash: string;
    claimedSessionHash: string;
    deviceHint: string | null;
  }): Promise<
    | { ok: true; record: PasskeyPairingRecord }
    | { ok: false; reason: "invalid-pairing" | "already-claimed" | "pairing-expired" }
  >;
  transition(
    id: string,
    from: "claimed" | "approved",
    to: "approved" | "completed",
  ): Promise<
    | { ok: true; record: PasskeyPairingRecord }
    | { ok: false; reason: "pairing-not-usable" }
  >;
  cancel(id: string): Promise<
    | { ok: true; record: PasskeyPairingRecord }
    | { ok: false; reason: "pairing-not-usable" }
  >;
};

export type PasskeyOperationReason =
  | "ok"
  | "unauthenticated"
  | "unavailable"
  | "rate-limited"
  | "invalid-rp"
  | "missing-challenge"
  | "invalid-challenge"
  | "expired-challenge"
  | "replayed-challenge"
  | "wrong-challenge-kind"
  | "session-mismatch"
  | "unknown-credential"
  | "revoked-credential"
  | "origin-mismatch"
  | "rp-mismatch"
  | "challenge-mismatch"
  | "counter-invalid"
  | "verify-failed"
  | "store-failed"
  | "invalid-response"
  | "invalid-pairing"
  | "already-claimed"
  | "pairing-expired"
  | "pairing-not-approved"
  | "pairing-not-usable";

export const PASSKEY_GENERIC_AUTH_REASON: PasskeyOperationReason = "verify-failed";
