/**
 * Founder Gmail connection controls: pause / resume / disconnect / revoked.
 * PAUSE retains encrypted refresh token and stops sync.
 * DISCONNECT revokes Google token where possible, deletes ciphertext,
 * keeps already indexed Gmail evidence, and does not touch Person/Project data.
 */

import { randomUUID } from "node:crypto";
import { GMAIL_FOUNDER_MAILBOX_SLOT, type GmailConnection } from "./types";
import type { GmailTokenCiphertext } from "./types";

export type GmailConnectionStore = {
  getFounderConnection(): Promise<GmailConnection | null>;
  putConnection(row: GmailConnection): Promise<GmailConnection>;
};

function cloneConnection(row: GmailConnection): GmailConnection {
  return {
    ...row,
    refreshToken: row.refreshToken ? { ...row.refreshToken } : null,
  };
}

export class InMemoryGmailConnectionStore implements GmailConnectionStore {
  private row: GmailConnection | null = null;

  async getFounderConnection(): Promise<GmailConnection | null> {
    return this.row ? cloneConnection(this.row) : null;
  }

  async putConnection(row: GmailConnection): Promise<GmailConnection> {
    this.row = cloneConnection(row);
    return cloneConnection(this.row);
  }
}

export function isSyncEligible(connection: GmailConnection | null): boolean {
  return Boolean(
    connection &&
      connection.status === "connected" &&
      connection.refreshToken,
  );
}

export function connectFounderMailbox(input: {
  existing: GmailConnection | null;
  mailboxEmailHash: string;
  refreshToken: GmailTokenCiphertext;
  grantedScope: string;
  providerTokenType: string | null;
  now: string;
}): GmailConnection {
  const connectionId = input.existing?.connectionId ?? randomUUID();
  return {
    connectionId,
    mailboxSlot: GMAIL_FOUNDER_MAILBOX_SLOT,
    mailboxEmailHash: input.mailboxEmailHash,
    status: "connected",
    refreshToken: input.refreshToken,
    grantedScope: input.grantedScope,
    providerTokenType: input.providerTokenType,
    connectedAt: input.existing?.connectedAt ?? input.now,
    updatedAt: input.now,
    lastSyncAt: input.existing?.lastSyncAt ?? null,
    statusErrorCode: null,
  };
}

export function pauseConnection(
  existing: GmailConnection,
  now: string,
): GmailConnection {
  if (!existing.refreshToken) {
    throw new Error("connection-inactive");
  }
  return {
    ...cloneConnection(existing),
    status: "paused",
    updatedAt: now,
    statusErrorCode: null,
  };
}

export function resumeConnection(
  existing: GmailConnection,
  now: string,
): GmailConnection {
  if (existing.status !== "paused" || !existing.refreshToken) {
    throw new Error("connection-inactive");
  }
  return {
    ...cloneConnection(existing),
    status: "connected",
    updatedAt: now,
    statusErrorCode: null,
  };
}

export function disconnectConnection(
  existing: GmailConnection,
  now: string,
): GmailConnection {
  return {
    ...cloneConnection(existing),
    status: "disconnected",
    refreshToken: null,
    updatedAt: now,
    statusErrorCode: null,
  };
}

export function revokeConnection(
  existing: GmailConnection,
  now: string,
  errorCode = "invalid_grant",
): GmailConnection {
  return {
    ...cloneConnection(existing),
    status: "revoked",
    refreshToken: null,
    updatedAt: now,
    statusErrorCode: errorCode,
  };
}

export async function applyPause(
  store: GmailConnectionStore,
  now: string,
): Promise<GmailConnection> {
  const existing = await store.getFounderConnection();
  if (!existing || !existing.refreshToken) throw new Error("connection-inactive");
  if (existing.status !== "connected" && existing.status !== "paused") {
    throw new Error("connection-inactive");
  }
  const next = pauseConnection(existing, now);
  return store.putConnection(next);
}

export async function applyResume(
  store: GmailConnectionStore,
  now: string,
): Promise<GmailConnection> {
  const existing = await store.getFounderConnection();
  if (!existing) throw new Error("connection-inactive");
  const next = resumeConnection(existing, now);
  return store.putConnection(next);
}

export async function applyDisconnect(input: {
  store: GmailConnectionStore;
  now: string;
  decryptRefreshToken: (wrapped: GmailTokenCiphertext) => string;
  revokeToken: (token: string) => Promise<void>;
}): Promise<GmailConnection> {
  const existing = await input.store.getFounderConnection();
  if (!existing) throw new Error("connection-inactive");
  if (existing.refreshToken) {
    try {
      const refresh = input.decryptRefreshToken(existing.refreshToken);
      await input.revokeToken(refresh);
    } catch {
      // Best-effort Google revoke. Ciphertext is still deleted locally.
    }
  }
  return input.store.putConnection(disconnectConnection(existing, input.now));
}

export async function applyInvalidGrant(
  store: GmailConnectionStore,
  now: string,
): Promise<GmailConnection | null> {
  const existing = await store.getFounderConnection();
  if (!existing) return null;
  return store.putConnection(revokeConnection(existing, now, "invalid_grant"));
}
