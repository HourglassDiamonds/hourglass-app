import { randomUUID } from "node:crypto";
import type {
  FounderPasskeyInsert,
  FounderPasskeyRecord,
  FounderPasskeyStore,
} from "./types";

function cloneKey(key: Uint8Array): Uint8Array {
  return Uint8Array.from(key);
}

export class InMemoryFounderPasskeyStore implements FounderPasskeyStore {
  private rows: FounderPasskeyRecord[] = [];

  async list(): Promise<FounderPasskeyRecord[]> {
    return this.rows.map((row) => ({
      ...row,
      publicKey: cloneKey(row.publicKey),
    }));
  }

  async getByCredentialId(
    credentialId: string,
  ): Promise<FounderPasskeyRecord | null> {
    const row = this.rows.find((item) => item.credentialId === credentialId);
    if (!row) return null;
    return { ...row, publicKey: cloneKey(row.publicKey) };
  }

  async insert(record: FounderPasskeyInsert): Promise<FounderPasskeyRecord> {
    if (this.rows.some((row) => row.credentialId === record.credentialId)) {
      throw new Error("duplicate-credential");
    }
    const saved: FounderPasskeyRecord = {
      id: randomUUID(),
      founderUserId: record.founderUserId,
      credentialId: record.credentialId,
      publicKey: cloneKey(record.publicKey),
      counter: record.counter,
      transports: record.transports ? [...record.transports] : null,
      deviceType: record.deviceType,
      backedUp: record.backedUp,
      createdAt: record.createdAt,
      lastUsedAt: null,
      label: record.label,
      revokedAt: null,
    };
    this.rows.push(saved);
    return { ...saved, publicKey: cloneKey(saved.publicKey) };
  }

  async updateAfterAuthentication(
    credentialId: string,
    update: {
      counter: number;
      lastUsedAt: string;
      backedUp: boolean | null;
      deviceType: string | null;
    },
  ): Promise<boolean> {
    const row = this.rows.find(
      (item) => item.credentialId === credentialId && item.revokedAt == null,
    );
    if (!row) return false;
    row.counter = update.counter;
    row.lastUsedAt = update.lastUsedAt;
    row.backedUp = update.backedUp;
    row.deviceType = update.deviceType;
    return true;
  }

  async revoke(id: string, revokedAt: string): Promise<boolean> {
    const row = this.rows.find((item) => item.id === id);
    if (!row || row.revokedAt) return false;
    row.revokedAt = revokedAt;
    return true;
  }

  async hasActive(): Promise<boolean> {
    return this.rows.some((row) => row.revokedAt == null);
  }
}
