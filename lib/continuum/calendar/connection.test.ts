import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyCalendarDisconnect,
  applyCalendarInvalidGrant,
  applyCalendarPause,
  applyCalendarResume,
  connectFounderCalendar,
  InMemoryCalendarConnectionStore,
  isCalendarReadEligible,
  readOnlyCalendarConnectionStore,
} from "./connection";
import { encryptCalendarRefreshToken } from "./token-crypto";
import { CALENDAR_READONLY_SCOPE } from "./types";

const KEY = Buffer.from("d".repeat(64), "hex");
const NOW = "2026-03-10T16:00:00.000Z";

async function connectedStore() {
  const store = new InMemoryCalendarConnectionStore();
  const wrapped = encryptCalendarRefreshToken("refresh-keep", KEY);
  await store.putConnection(
    connectFounderCalendar({
      existing: null,
      calendarEmailHash: "ab".repeat(32),
      refreshToken: wrapped,
      grantedScope: CALENDAR_READONLY_SCOPE,
      providerTokenType: "Bearer",
      now: NOW,
    }),
  );
  return store;
}

describe("Calendar connection controls", () => {
  it("pauses while retaining ciphertext and resume restores read eligibility", async () => {
    const store = await connectedStore();
    const paused = await applyCalendarPause(store, NOW);
    assert.equal(paused.status, "paused");
    assert.ok(paused.refreshToken);
    assert.equal(isCalendarReadEligible(paused), false);
    const resumed = await applyCalendarResume(store, NOW);
    assert.equal(resumed.status, "connected");
    assert.ok(resumed.refreshToken);
    assert.equal(isCalendarReadEligible(resumed), true);
  });

  it("disconnects by revoking, deleting ciphertext, and keeping the row", async () => {
    const store = await connectedStore();
    const revoked: string[] = [];
    const next = await applyCalendarDisconnect({
      store,
      now: NOW,
      decryptRefreshToken: () => "refresh-keep",
      revokeToken: async (token) => {
        revoked.push(token);
      },
    });
    assert.equal(next.status, "disconnected");
    assert.equal(next.refreshToken, null);
    assert.deepEqual(revoked, ["refresh-keep"]);
    assert.ok(await store.getFounderConnection());
  });

  it("clears ciphertext on invalid_grant", async () => {
    const store = await connectedStore();
    const next = await applyCalendarInvalidGrant(store, NOW);
    assert.equal(next?.status, "revoked");
    assert.equal(next?.refreshToken, null);
    assert.equal(next?.statusErrorCode, "invalid_grant");
  });

  it("blocks writes through the read-only connection wrapper", async () => {
    const store = await connectedStore();
    const readOnly = readOnlyCalendarConnectionStore(store);
    await assert.rejects(
      readOnly.putConnection((await store.getFounderConnection())!),
      /calendar-connection-write-forbidden/,
    );
  });
});
