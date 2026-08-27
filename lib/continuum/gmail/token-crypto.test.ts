import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { randomBytes } from "node:crypto";
import {
  decryptRefreshToken,
  encryptRefreshToken,
  loadGmailTokenKek,
} from "./token-crypto";

const KEY = Buffer.from("a".repeat(64), "hex");

describe("Gmail refresh-token AES-256-GCM", () => {
  it("round-trips a refresh token", () => {
    const wrapped = encryptRefreshToken("refresh-token-value", KEY);
    assert.equal(wrapped.alg, "aes-256-gcm");
    assert.equal(wrapped.version, 1);
    assert.notEqual(wrapped.ciphertext, "refresh-token-value");
    assert.equal(decryptRefreshToken(wrapped, KEY), "refresh-token-value");
  });

  it("rejects a missing or invalid KEK", () => {
    const previous = process.env.CONTINUUM_GMAIL_TOKEN_KEK;
    delete process.env.CONTINUUM_GMAIL_TOKEN_KEK;
    assert.equal(loadGmailTokenKek().ok, false);
    process.env.CONTINUUM_GMAIL_TOKEN_KEK = "short";
    assert.deepEqual(loadGmailTokenKek(), {
      ok: false,
      error: "token-kek-invalid",
    });
    process.env.CONTINUUM_GMAIL_TOKEN_KEK = "a".repeat(64);
    const loaded = loadGmailTokenKek();
    assert.equal(loaded.ok, true);
    if (previous === undefined) delete process.env.CONTINUUM_GMAIL_TOKEN_KEK;
    else process.env.CONTINUUM_GMAIL_TOKEN_KEK = previous;
  });

  it("fails closed on the wrong key or tampered ciphertext", () => {
    const wrapped = encryptRefreshToken("refresh-token-value", KEY);
    const other = Buffer.from("b".repeat(64), "hex");
    assert.throws(() => decryptRefreshToken(wrapped, other));
    const tampered = { ...wrapped, ciphertext: randomBytes(16).toString("base64") };
    assert.throws(() => decryptRefreshToken(tampered, KEY));
  });

  it("does not read NEXT_PUBLIC token KEK", () => {
    const previous = process.env.CONTINUUM_GMAIL_TOKEN_KEK;
    const publicPrevious = process.env.NEXT_PUBLIC_CONTINUUM_GMAIL_TOKEN_KEK;
    delete process.env.CONTINUUM_GMAIL_TOKEN_KEK;
    process.env.NEXT_PUBLIC_CONTINUUM_GMAIL_TOKEN_KEK = "a".repeat(64);
    assert.equal(loadGmailTokenKek().ok, false);
    if (previous === undefined) delete process.env.CONTINUUM_GMAIL_TOKEN_KEK;
    else process.env.CONTINUUM_GMAIL_TOKEN_KEK = previous;
    if (publicPrevious === undefined) {
      delete process.env.NEXT_PUBLIC_CONTINUUM_GMAIL_TOKEN_KEK;
    } else {
      process.env.NEXT_PUBLIC_CONTINUUM_GMAIL_TOKEN_KEK = publicPrevious;
    }
  });
});
