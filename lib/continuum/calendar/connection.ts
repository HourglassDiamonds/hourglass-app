/**
 * Founder Calendar connection controls: pause / resume / disconnect / revoked.
 * PAUSE retains encrypted refresh token and stops live reads.
 * DISCONNECT revokes Google token where possible, deletes ciphertext,
 * and does not touch Person/Project/Gmail/Open Job/CoS data.
 */

import { randomUUID } from "node:crypto";
import {
  CALENDAR_FOUNDER_SLOT,
  type CalendarConnection,
  type CalendarTokenCiphertext,
} from "./types";

export type CalendarConnectionStore = {
  getFounderConnection(): Promise<CalendarConnection | null>;
  putConnection(row: CalendarConnection): Promise<CalendarConnection>;
};

function cloneConnection(row: CalendarConnection): CalendarConnection {
  return {
    ...row,
    refreshToken: row.refreshToken ? { ...row.refreshToken } : null,
  };
}

export class InMemoryCalendarConnectionStore implements CalendarConnectionStore {
  private row: CalendarConnection | null = null;

  async getFounderConnection(): Promise<CalendarConnection | null> {
    return this.row ? cloneConnection(this.row) : null;
  }

  async putConnection(row: CalendarConnection): Promise<CalendarConnection> {
    this.row = cloneConnection(row);
    return cloneConnection(this.row);
  }
}

export function isCalendarReadEligible(
  connection: CalendarConnection | null,
): boolean {
  return Boolean(
    connection &&
      connection.status === "connected" &&
      connection.refreshToken,
  );
}

export function connectFounderCalendar(input: {
  existing: CalendarConnection | null;
  calendarEmailHash: string;
  refreshToken: CalendarTokenCiphertext;
  grantedScope: string;
  providerTokenType: string | null;
  now: string;
}): CalendarConnection {
  const connectionId = input.existing?.connectionId ?? randomUUID();
  return {
    connectionId,
    calendarSlot: CALENDAR_FOUNDER_SLOT,
    calendarEmailHash: input.calendarEmailHash,
    status: "connected",
    refreshToken: input.refreshToken,
    grantedScope: input.grantedScope,
    providerTokenType: input.providerTokenType,
    connectedAt: input.existing?.connectedAt ?? input.now,
    updatedAt: input.now,
    lastReadAt: input.existing?.lastReadAt ?? null,
    statusErrorCode: null,
  };
}

export function pauseCalendarConnection(
  existing: CalendarConnection,
  now: string,
): CalendarConnection {
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

export function resumeCalendarConnection(
  existing: CalendarConnection,
  now: string,
): CalendarConnection {
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

export function disconnectCalendarConnection(
  existing: CalendarConnection,
  now: string,
): CalendarConnection {
  return {
    ...cloneConnection(existing),
    status: "disconnected",
    refreshToken: null,
    updatedAt: now,
    statusErrorCode: null,
  };
}

export function revokeCalendarConnection(
  existing: CalendarConnection,
  now: string,
  errorCode = "invalid_grant",
): CalendarConnection {
  return {
    ...cloneConnection(existing),
    status: "revoked",
    refreshToken: null,
    updatedAt: now,
    statusErrorCode: errorCode,
  };
}

export async function applyCalendarPause(
  store: CalendarConnectionStore,
  now: string,
): Promise<CalendarConnection> {
  const existing = await store.getFounderConnection();
  if (!existing || !existing.refreshToken) throw new Error("connection-inactive");
  if (existing.status !== "connected" && existing.status !== "paused") {
    throw new Error("connection-inactive");
  }
  return store.putConnection(pauseCalendarConnection(existing, now));
}

export async function applyCalendarResume(
  store: CalendarConnectionStore,
  now: string,
): Promise<CalendarConnection> {
  const existing = await store.getFounderConnection();
  if (!existing) throw new Error("connection-inactive");
  return store.putConnection(resumeCalendarConnection(existing, now));
}

export async function applyCalendarDisconnect(input: {
  store: CalendarConnectionStore;
  now: string;
  decryptRefreshToken: (wrapped: CalendarTokenCiphertext) => string;
  revokeToken: (token: string) => Promise<void>;
}): Promise<CalendarConnection> {
  const existing = await input.store.getFounderConnection();
  if (!existing) throw new Error("connection-inactive");
  if (existing.refreshToken) {
    try {
      const refresh = input.decryptRefreshToken(existing.refreshToken);
      await input.revokeToken(refresh);
    } catch {
      /* best-effort revoke */
    }
  }
  return input.store.putConnection(
    disconnectCalendarConnection(existing, input.now),
  );
}

export async function applyCalendarInvalidGrant(
  store: CalendarConnectionStore,
  now: string,
): Promise<CalendarConnection | null> {
  const existing = await store.getFounderConnection();
  if (!existing) return null;
  return store.putConnection(revokeCalendarConnection(existing, now));
}

export function readOnlyCalendarConnectionStore(
  store: CalendarConnectionStore,
): CalendarConnectionStore {
  return {
    getFounderConnection: () => store.getFounderConnection(),
    async putConnection() {
      throw new Error("calendar-connection-write-forbidden");
    },
  };
}
