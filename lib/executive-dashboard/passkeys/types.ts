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
  | "invalid-response";

export const PASSKEY_GENERIC_AUTH_REASON: PasskeyOperationReason = "verify-failed";
