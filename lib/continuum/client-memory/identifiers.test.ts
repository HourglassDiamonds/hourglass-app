import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { coerceGmailThreadId } from "./gmail";
import { classifyPhone, hashPhone } from "./hashes";
import { prepareIdentityClaims } from "./identity";

describe("Client Memory phone and Gmail identifiers", () => {
  it("hashes US/+1 numbers and refuses international last-10 collapse", () => {
    assert.equal(classifyPhone("305-555-0100").status, "us-compatible");
    assert.equal(classifyPhone("+1 (305) 555-0100").status, "us-compatible");
    assert.equal(classifyPhone("+44 20 7946 0958").status, "international");
    assert.ok(hashPhone("3055550100"));
    assert.equal(hashPhone("+44 20 7946 0958"), null);
    const prepared = prepareIdentityClaims({
      phone: "+44 20 7946 0958",
      importRowKey: "continuum-reconciliation-v3:People:2",
    });
    assert.equal(prepared.unsupportedPhone, true);
    assert.equal(
      prepared.claims.some((claim) => claim.identityKind === "phone_hash"),
      false,
    );
  });

  it("treats Gmail thread ids as opaque strings and rejects tiny Excel numbers", () => {
    assert.deepEqual(coerceGmailThreadId("19fc1a2b3c4d5e6f"), {
      status: "canonical",
      value: "19fc1a2b3c4d5e6f",
    });
    assert.deepEqual(coerceGmailThreadId(1876498123456), {
      status: "canonical",
      value: "1876498123456",
    });
    assert.equal(coerceGmailThreadId(42).status, "invalid");
    assert.equal(coerceGmailThreadId(0).status, "invalid");
    assert.equal(coerceGmailThreadId(1.5).status, "invalid");
    assert.equal(coerceGmailThreadId("1.23E+16").status, "invalid");
    assert.equal(coerceGmailThreadId(null).status, "blank");
  });
});
