import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyDisconnect,
  applyInvalidGrant,
  applyPause,
  applyResume,
  connectFounderMailbox,
  InMemoryGmailConnectionStore,
  isSyncEligible,
} from "./connection";
import { encryptRefreshToken } from "./token-crypto";
import { GMAIL_READONLY_SCOPE } from "./types";

const KEY = Buffer.from("d".repeat(64), "hex");
const NOW = "2026-08-27T16:00:00.000Z";

async function connectedStore() {
  const store = new InMemoryGmailConnectionStore();
  const wrapped = encryptRefreshToken("refresh-keep", KEY);
  await store.putConnection(
    connectFounderMailbox({
      existing: null,
      mailboxEmailHash: "ab".repeat(32),
      refreshToken: wrapped,
      grantedScope: GMAIL_READONLY_SCOPE,
      providerTokenType: "Bearer",
      now: NOW,
    }),
  );
  return store;
}

describe("Gmail connection controls", () => {
  it("pauses while retaining ciphertext and resume restores sync eligibility", async () => {
    const store = await connectedStore();
    const paused = await applyPause(store, NOW);
    assert.equal(paused.status, "paused");
    assert.ok(paused.refreshToken);
    assert.equal(isSyncEligible(paused), false);
    const resumed = await applyResume(store, NOW);
    assert.equal(resumed.status, "connected");
    assert.ok(resumed.refreshToken);
    assert.equal(isSyncEligible(resumed), true);
  });

  it("disconnects by revoking, deleting ciphertext, and keeping the row", async () => {
    const store = await connectedStore();
    const revoked: string[] = [];
    const next = await applyDisconnect({
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
    assert.equal(isSyncEligible(next), false);
    assert.ok(await store.getFounderConnection());
  });

  it("clears ciphertext on invalid_grant", async () => {
    const store = await connectedStore();
    const next = await applyInvalidGrant(store, NOW);
    assert.equal(next?.status, "revoked");
    assert.equal(next?.refreshToken, null);
    assert.equal(next?.statusErrorCode, "invalid_grant");
  });
});
