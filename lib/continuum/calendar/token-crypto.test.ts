import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { randomBytes } from "node:crypto";
import {
  decryptCalendarRefreshToken,
  encryptCalendarRefreshToken,
  loadCalendarTokenKek,
} from "./token-crypto";

const KEY = Buffer.from("a".repeat(64), "hex");

describe("Calendar refresh-token AES-256-GCM", () => {
  it("round-trips a refresh token", () => {
    const wrapped = encryptCalendarRefreshToken("refresh-token-value", KEY);
    assert.equal(wrapped.alg, "aes-256-gcm");
    assert.equal(wrapped.version, 1);
    assert.notEqual(wrapped.ciphertext, "refresh-token-value");
    assert.equal(decryptCalendarRefreshToken(wrapped, KEY), "refresh-token-value");
  });

  it("rejects a missing or invalid KEK and never reads the Gmail KEK", () => {
    const previous = process.env.CONTINUUM_CALENDAR_TOKEN_KEK;
    const gmail = process.env.CONTINUUM_GMAIL_TOKEN_KEK;
    delete process.env.CONTINUUM_CALENDAR_TOKEN_KEK;
    process.env.CONTINUUM_GMAIL_TOKEN_KEK = "a".repeat(64);
    assert.equal(loadCalendarTokenKek().ok, false);
    process.env.CONTINUUM_CALENDAR_TOKEN_KEK = "short";
    assert.deepEqual(loadCalendarTokenKek(), {
      ok: false,
      error: "token-kek-invalid",
    });
    process.env.CONTINUUM_CALENDAR_TOKEN_KEK = "a".repeat(64);
    assert.equal(loadCalendarTokenKek().ok, true);
    if (previous === undefined) delete process.env.CONTINUUM_CALENDAR_TOKEN_KEK;
    else process.env.CONTINUUM_CALENDAR_TOKEN_KEK = previous;
    if (gmail === undefined) delete process.env.CONTINUUM_GMAIL_TOKEN_KEK;
    else process.env.CONTINUUM_GMAIL_TOKEN_KEK = gmail;
  });

  it("fails closed on the wrong key or tampered ciphertext", () => {
    const wrapped = encryptCalendarRefreshToken("refresh-token-value", KEY);
    const other = Buffer.from("b".repeat(64), "hex");
    assert.throws(() => decryptCalendarRefreshToken(wrapped, other));
    const tampered = { ...wrapped, ciphertext: randomBytes(16).toString("base64") };
    assert.throws(() => decryptCalendarRefreshToken(tampered, KEY));
  });
});
