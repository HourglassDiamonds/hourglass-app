import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONCIERGE_MAX,
  normalizePreferredContactMethod,
  phoneRequiredForContactMethod,
  validateConciergeContactFields,
} from "./validation";

describe("normalizePreferredContactMethod", () => {
  it("normalizes known methods", () => {
    assert.equal(normalizePreferredContactMethod("Email"), "email");
    assert.equal(normalizePreferredContactMethod("PHONE"), "phone");
    assert.equal(normalizePreferredContactMethod("text"), "text");
    assert.equal(normalizePreferredContactMethod("Any Is Fine"), "any");
  });
});

describe("phoneRequiredForContactMethod", () => {
  it("requires phone for phone and text only", () => {
    assert.equal(phoneRequiredForContactMethod("phone"), true);
    assert.equal(phoneRequiredForContactMethod("text"), true);
    assert.equal(phoneRequiredForContactMethod("email"), false);
    assert.equal(phoneRequiredForContactMethod("any"), false);
    assert.equal(phoneRequiredForContactMethod(undefined), false);
  });
});

describe("validateConciergeContactFields", () => {
  const base = {
    fullName: "Alex Example",
    email: "alex@example.com",
    phone: "",
    inspirationNotes: "Looking for a quiet oval.",
  };

  it("rejects phone preference without a phone number", () => {
    const result = validateConciergeContactFields({
      ...base,
      preferredContactMethod: "phone",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /phone number/i);
      assert.doesNotMatch(result.message, /alex@example.com/i);
    }
  });

  it("rejects text preference without a phone number", () => {
    const result = validateConciergeContactFields({
      ...base,
      preferredContactMethod: "text",
    });
    assert.equal(result.ok, false);
  });

  it("allows email preference without a phone number", () => {
    const result = validateConciergeContactFields({
      ...base,
      preferredContactMethod: "email",
    });
    assert.equal(result.ok, true);
  });

  it("allows any preference without a phone number", () => {
    const result = validateConciergeContactFields({
      ...base,
      preferredContactMethod: "any",
    });
    assert.equal(result.ok, true);
  });

  it("accepts phone preference with a valid phone", () => {
    const result = validateConciergeContactFields({
      ...base,
      phone: "(704) 555-1212",
      preferredContactMethod: "phone",
    });
    assert.equal(result.ok, true);
  });

  it("truncates oversized fields safely", () => {
    const result = validateConciergeContactFields({
      fullName: "A".repeat(CONCIERGE_MAX.fullName + 40),
      email: `${"b".repeat(40)}@example.com`,
      phone: "",
      preferredContactMethod: "email",
      inspirationNotes: "N".repeat(CONCIERGE_MAX.inspirationNotes + 100),
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.fullName.length, CONCIERGE_MAX.fullName);
      assert.equal(result.notes.length, CONCIERGE_MAX.inspirationNotes);
    }
  });

  it("rejects invalid email without echoing the value", () => {
    const result = validateConciergeContactFields({
      ...base,
      email: "not-an-email",
      preferredContactMethod: "email",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.doesNotMatch(result.message, /not-an-email/);
    }
  });
});
